<?php
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

if (contest_state() !== 'open') redirect('');

$token = $_SESSION['pending'] ?? '';
$load = function () use ($token): ?array {
    if (!$token) return null;
    $st = db()->prepare('SELECT * FROM pending_entries WHERE token = ?');
    $st->execute([$token]);
    return $st->fetch() ?: null;
};

$p = $load();
if (!$p) {
    unset($_SESSION['pending']);
    redirect('');
}

$error = null;
$notice = null;
$v = cfg('verify');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        csrf_check();
        rate_check('verify_per_ip', client_ip());
        $action = $_POST['action'] ?? 'verify';

        if ($action === 'restart') {
            delete_pending_photo($p['photo_file']);
            db()->prepare('DELETE FROM pending_entries WHERE id = ?')->execute([$p['id']]);
            unset($_SESSION['pending']);
            redirect('#participa');
        }

        if ($action === 'resend') {
            $wait = strtotime($p['last_sent_at']) + (int) $v['resend_cooldown'] - time();
            if ($p['sends'] >= $v['max_sends']) throw new UserError('Ya no se pueden enviar más códigos. Vuelve a registrarte.');
            if ($wait > 0) throw new UserError("Espera {$wait} segundos para pedir otro código.");
            $code = random_code();
            db()->prepare('UPDATE pending_entries SET code_hash = ?, code_expires_at = ?, attempts = 0, sends = sends + 1, last_sent_at = ? WHERE id = ?')
                ->execute([password_hash($code, PASSWORD_DEFAULT), date('Y-m-d H:i:s', time() + 60 * (int) $v['code_ttl_min']), now(), $p['id']]);
            try {
                send_code_email($p['email'], $p['first_name'], $code);
            } catch (Throwable $ex) {
                error_log('mail resend: ' . $ex->getMessage());
                throw new UserError('No pudimos reenviar el código. Inténtalo en unos minutos.');
            }
            $notice = 'Te enviamos un código nuevo.';
        } else {
            $code = preg_replace('/\D+/', '', (string) ($_POST['code'] ?? ''));
            if ($p['attempts'] >= $v['max_attempts']) {
                throw new UserError('Superaste el número de intentos. Pide un código nuevo.');
            }
            if (strtotime($p['code_expires_at']) < time()) {
                throw new UserError('Tu código expiró. Pide uno nuevo.');
            }
            if (strlen($code) !== 6 || !password_verify($code, $p['code_hash'])) {
                db()->prepare('UPDATE pending_entries SET attempts = attempts + 1 WHERE id = ?')->execute([$p['id']]);
                $left = $v['max_attempts'] - $p['attempts'] - 1;
                throw new UserError($left > 0
                    ? "El código no es correcto. Te quedan {$left} intentos."
                    : 'El código no es correcto. Pide un código nuevo.');
            }

            // --- Código correcto: guardar participación ---
            $pdo = db();
            $pdo->beginTransaction();
            try {
                $st = $pdo->prepare('SELECT 1 FROM entries WHERE email = ? OR phone = ? LIMIT 1 FOR UPDATE');
                $st->execute([$p['email'], $p['phone']]);
                if ($st->fetchColumn()) throw new UserError(t('duplicate'));

                $ts = now();
                for ($i = 0; ; $i++) {
                    $publicId = random_public_id();
                    try {
                        $pdo->prepare(
                            'INSERT INTO entries
                             (public_id, first_name, last_name, email, phone, category, slogan, photo_file, src,
                              terms_version, terms_accepted_at, privacy_version, privacy_accepted_at,
                              email_verified_at, ip, user_agent, created_at)
                             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
                        )->execute([
                            $publicId, $p['first_name'], $p['last_name'], $p['email'], $p['phone'], $p['category'],
                            $p['slogan'], $p['photo_file'], $p['src'],
                            $p['terms_version'], $p['accepted_at'], $p['privacy_version'], $p['accepted_at'],
                            $ts, $p['ip'], $p['user_agent'], $ts,
                        ]);
                        break;
                    } catch (PDOException $ex) {
                        if ($ex->getCode() !== '23000') throw $ex;
                        // Choque de UNIQUE: si es correo/teléfono es duplicado; si es el folio, reintentar.
                        if (!str_contains($ex->getMessage(), 'uq_public_id') || $i >= 5) throw new UserError(t('duplicate'));
                    }
                }
                $pdo->prepare('DELETE FROM pending_entries WHERE id = ?')->execute([$p['id']]);
                promote_photo($p['photo_file']);
                $pdo->commit();
            } catch (Throwable $ex) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                if ($ex instanceof UserError) {
                    delete_pending_photo($p['photo_file']);
                    $pdo->prepare('DELETE FROM pending_entries WHERE id = ?')->execute([$p['id']]);
                    unset($_SESSION['pending']);
                }
                throw $ex;
            }

            unset($_SESSION['pending']);
            session_regenerate_id(true);
            $_SESSION['done'] = $publicId;
            redirect('gracias.php');
        }
    } catch (UserError $ex) {
        $error = $ex->getMessage();
    } catch (Throwable $ex) {
        error_log('verify: ' . $ex);
        $error = 'Ocurrió un error. Inténtalo de nuevo.';
    }
    $p = $load();
    if (!$p) {
        // Se eliminó (duplicado): mostrar el error en la landing
        view('message', ['title' => 'No pudimos registrar tu participación', 'text' => $error, 'back' => true]);
        exit;
    }
}

view('verify', [
    'email'  => mask_email($p['email']),
    'error'  => $error,
    'notice' => $notice,
    'canResend' => $p['sends'] < $v['max_sends'],
]);
