<?php
$s = doc('settings');
$h = $d['hero'] ?? [];
$title = ($h['title'] ?? '') ?: ($s['siteName'] ?? '');
$videoUrl = trim((string) ($h['videoUrl'] ?? ''));
$embed = null;
if (preg_match('~(?:youtube\.com/(?:watch\?v=|embed/|shorts/|live/)|youtu\.be/)([\w-]{11})~', $videoUrl, $m)) {
    $embed = 'https://www.youtube-nocookie.com/embed/' . $m[1] . '?rel=0';
} elseif (preg_match('~vimeo\.com/(?:video/)?(\d+)~', $videoUrl, $m)) {
    $embed = 'https://player.vimeo.com/video/' . $m[1];
}
$file = media_get($h['videoFile'] ?? null);
$poster = media_get($h['poster'] ?? null);
?>
<section class="page-hero page-hero--wide" aria-label="Portada">
    <div class="container">
        <h1 class="display page-hero__title">
            <?php if (!empty($h['eyebrow'])): ?><span class="page-hero__eyebrow"><?= e($h['eyebrow']) ?></span><?php endif; ?>
            <?php if (!empty($h['logo'])): ?>
                <?= img_logo($h['logo'], ['alt' => $title, 'class' => 'page-hero__logo', 'eager' => true]) ?>
            <?php else: ?>
                <span><?= e($title) ?></span>
            <?php endif; ?>
        </h1>
        <div class="video">
            <?php if ($embed): ?>
                <iframe src="<?= e($embed) ?>" title="Video más reciente de <?= e($s['siteName'] ?? '') ?>" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            <?php elseif ($file && strpos($file['mime'], 'video/') === 0): ?>
                <video controls preload="metadata"<?= $poster ? ' poster="' . e(media_url($poster, '1600') ?? media_url($poster)) . '"' : '' ?>>
                    <source src="<?= e(media_url($file)) ?>" type="<?= e($file['mime']) ?>">
                </video>
            <?php else: ?>
                <?= img_fill($h['poster'] ?? null, ['sizes' => '(max-width: 1440px) 100vw, 1281px', 'eager' => true]) ?>
            <?php endif; ?>
        </div>
    </div>
</section>

<?php partial('allies', ['class' => 'allies--tight']); ?>
<?php partial('map', ['map' => $d['map'] ?? []]); ?>
<?php partial('testimonials', ['data' => $d['testimonials'] ?? []]); ?>
<?php partial('recetario', ['data' => $d['recetario'] ?? []]); ?>
