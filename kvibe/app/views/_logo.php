<?php if (cfg('assets.logo')): ?>
<img class="logo-img" src="<?= e(asset(cfg('assets.logo'))) ?>" alt="K-VIBE+">
<?php else: ?>
<span class="logo-ph"><i class="logo-dot" aria-hidden="true"></i>K-VIBE<b>+</b></span>
<?php endif; ?>
