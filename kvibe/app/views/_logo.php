<?php if (cfg('assets.logo')): ?>
<img class="logo-img" src="<?= e(asset(cfg('assets.logo'))) ?>" alt="K-VIBE+">
<?php else: ?>
<span class="logo-ph">K-VIBE<b>+</b></span>
<?php endif; ?>
