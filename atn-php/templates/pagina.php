<article class="section legal">
    <div class="container legal__inner">
        <h1 class="h2 h2--lg"><?= e($pg['title'] ?? '') ?></h1>
        <div class="prose"><?= clean_html((string) ($pg['content'] ?? '')) ?></div>
    </div>
</article>
