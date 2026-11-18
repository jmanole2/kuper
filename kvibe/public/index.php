<?php
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

$src = capture_source();
$state = contest_state();

if ($state !== 'open') {
    http_response_code(200);
    view('closed', ['state' => $state]);
    exit;
}

if (random_int(1, 50) === 1) {
    try { cleanup_pending(); } catch (Throwable $ex) { error_log('cleanup: ' . $ex->getMessage()); }
}

$errors = [];
$old = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $old = [
        'first_name' => clean_text($_POST['first_name'] ?? ''),
        'last_name'  => clean_text($_POST['last_name'] ?? ''),
        'email'      => trim((string) ($_POST['email'] ?? '')),
        'phone'      => trim((string) ($_POST['phone'] ?? '')),
        'category'   => (string) ($_POST['category'] ?? ''),
        'slogan'     => clean_text($_POST['slogan'] ?? ''),
        'terms'      => !empty($_POST['terms']),
        'privacy'    => !empty($_POST['privacy']),
    ];

    try {
        if (post_too_large()) {
            throw new UserError('Tu foto es demasiado pesada. Elige una imagen más ligera.');
        }
        csrf_check();

        // --- Validación de campos ---
        $nameMax = (int) cfg('name_max');
        if ($old['first_name'] === '' || mb_strlen($old['first_name']) > $nameMax) $errors['first_name'] = 'Escribe tu nombre.';
        if ($old['last_name'] === ''  || mb_strlen($old['last_name']) > $nameMax)  $errors['last_name'] = 'Escribe tu apellido.';
        $email = normalize_email($old['email']);
        if (!$email) $errors['email'] = 'Escribe un correo válido.';
        $phone = normalize_phone($old['phone']);
        if (!$phone) $errors['phone'] = 'Escribe tu celular a 10 dígitos.';
        $category = null;
        if (cfg('category_enabled') && $old['category'] !== '') {
            if (!array_key_exists($old['category'], cfg('categories'))) $errors['category'] = 'Elige una opción de la lista.';
            else $category = $old['category'];
        }
        $sloganLen = mb_strlen($old['slogan']);
        if ($sloganLen === 0) $errors['slogan'] = 'Escribe tu slogan.';
        elseif ($sloganLen > (int) cfg('slogan_max')) $errors['slogan'] = 'Tu slogan puede tener máximo ' . cfg('slogan_max') . ' caracteres.';
        if (!$old['terms'])   $errors['terms'] = 'Debes aceptar los Términos y Condiciones.';
        if (!$old['privacy']) $errors['privacy'] = 'Debes aceptar el Aviso de Privacidad.';
        if (empty($_FILES['photo']) || ($_FILES['photo']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            $errors['photo'] = 'Sube tu foto para participar.';
        }
        if ($errors) throw new UserError('Revisa los campos marcados.');

        // --- Anti-abuso ---
        $captchaToken = $_POST['cf-turnstile-response'] ?? $_POST['g-recaptcha-response'] ?? null;
        if (!captcha_verify($captchaToken)) {
            throw new UserError('No pudimos verificar que eres humano. Recarga la página e inténtalo de nuevo.');
        }
        rate_check('submit_per_device', device_id());
        rate_check('submit_per_ip', client_ip());

        // --- Duplicados ---
        $st = db()->prepare('SELECT 1 FROM entries WHERE email = ? OR phone = ? LIMIT 1');
        $st->execute([$email, $phone]);
        if ($st->fetchColumn()) throw new UserError(t('duplicate'));

        // --- Foto ---
        try {
            $photo = store_upload($_FILES['photo']);
        } catch (UserError $ex) {
            $errors['photo'] = $ex->getMessage();
            throw new UserError('Revisa los campos marcados.');
        }

        // --- Registro pendiente + código ---
        // Si había un registro sin verificar con el mismo correo o celular, se reemplaza.
        $st = db()->prepare('SELECT id, photo_file FROM pending_entries WHERE email = ? OR phone = ?');
        $st->execute([$email, $phone]);
        foreach ($st->fetchAll() as $p) {
            delete_pending_photo($p['photo_file']);
            db()->prepare('DELETE FROM pending_entries WHERE id = ?')->execute([$p['id']]);
        }

        $code = random_code();
        $token = bin2hex(random_bytes(32));
        $ts = now();
        db()->prepare(
            'INSERT INTO pending_entries
             (token, first_name, last_name, email, phone, category, slogan, photo_file, src,
              terms_version, privacy_version, accepted_at, code_hash, code_expires_at, attempts, sends,
              last_sent_at, ip, user_agent, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,?,?,?,?)'
        )->execute([
            $token, $old['first_name'], $old['last_name'], $email, $phone, $category, $old['slogan'], $photo, $src,
            cfg('legal.terms.version'), cfg('legal.privacy.version'), $ts,
            password_hash($code, PASSWORD_DEFAULT),
            date('Y-m-d H:i:s', time() + 60 * (int) cfg('verify.code_ttl_min')),
            $ts, client_ip(), user_agent(), $ts,
        ]);

        try {
            send_code_email($email, $old['first_name'], $code);
        } catch (Throwable $ex) {
            error_log('mail: ' . $ex->getMessage());
            db()->prepare('DELETE FROM pending_entries WHERE token = ?')->execute([$token]);
            delete_pending_photo($photo);
            throw new UserError('No pudimos enviarte el código por correo. Revisa tu correo e inténtalo de nuevo en unos minutos.');
        }

        session_regenerate_id(true);
        $_SESSION['pending'] = $token;
        redirect('verificar.php');
    } catch (UserError $ex) {
        $formError = $ex->getMessage();
    } catch (Throwable $ex) {
        error_log('submit: ' . $ex);
        $formError = 'Ocurrió un error. Inténtalo de nuevo en unos minutos.';
    }
}

view('landing', [
    'errors'    => $errors,
    'old'       => $old,
    'formError' => $formError ?? null,
]);
