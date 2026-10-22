<?php
$currentSection = $currentSection ?? "";
$userName = htmlspecialchars($userInfo["nombre"] ?? "Usuario", ENT_QUOTES, "UTF-8");
$userRole = htmlspecialchars($userInfo["nivel"] ?? "administrador", ENT_QUOTES, "UTF-8");
$username = rawurlencode($userInfo["usuario"] ?? "");
$userInitial = function_exists("mb_substr")
    ? mb_strtoupper(mb_substr($userInfo["nombre"] ?? "U", 0, 1, "UTF-8"), "UTF-8")
    : strtoupper(substr($userInfo["nombre"] ?? "U", 0, 1));
$hasAdminShell = true;
?>
<header id="header" class="admin-topbar">
    <div class="admin-topbar__inner">
        <button
            id="menu-trigger"
            class="admin-menu-trigger"
            type="button"
            data-trigger="#sidebar"
            aria-label="Abrir navegación"
            aria-controls="sidebar"
            aria-expanded="false"
        >
            <span></span>
            <span></span>
        </button>

        <a class="admin-brand" href="/admin/menu/" aria-label="Ir al dashboard">
            <span class="admin-brand__mark">SM</span>
            <span class="admin-brand__text">
                <strong>Kaluz</strong>
                <small>Administración</small>
            </span>
        </a>

        <div class="admin-topbar__context">
            <span>Interactivo</span>
            <i aria-hidden="true"></i>
            <strong><?= htmlspecialchars($pageTitle ?? "Dashboard", ENT_QUOTES, "UTF-8") ?></strong>
        </div>

        <div class="admin-user dropdown">
            <a
                class="admin-user__button"
                data-toggle="dropdown"
                href="#"
                aria-label="Abrir menú de usuario"
                aria-haspopup="true"
            >
                <span class="admin-user__avatar"><?= htmlspecialchars($userInitial, ENT_QUOTES, "UTF-8") ?></span>
                <span class="admin-user__meta">
                    <strong><?= $userName ?></strong>
                    <small><?= ucfirst($userRole) ?></small>
                </span>
                <i class="fa fa-chevron-down admin-user__chevron" aria-hidden="true"></i>
            </a>

            <ul class="dropdown-menu admin-user__menu pull-right">
                <li>
                    <a href="/admin/perfil/?username=<?= $username ?>">
                        <i class="fa fa-user"></i>
                        <span>Mi perfil</span>
                    </a>
                </li>
                <li>
                    <a href="/" target="_blank" rel="noopener noreferrer">
                        <i class="fa fa-external-link"></i>
                        <span>Abrir interactivo</span>
                    </a>
                </li>
                <li class="admin-user__separator"></li>
                <li>
                    <a href="/admin/logout/">
                        <i class="fa fa-power-off"></i>
                        <span>Cerrar sesión</span>
                    </a>
                </li>
            </ul>
        </div>
    </div>
</header>

<div class="admin-sidebar-backdrop" data-sidebar-close></div>

<section id="main" class="admin-shell">
    <aside id="sidebar" class="admin-sidebar" aria-label="Navegación principal">
        <div class="admin-sidebar__inner">
            <div class="admin-sidebar__intro">
                <span class="admin-sidebar__eyebrow">Panel de control</span>
                <p>Consulta la actividad, los formularios y las computadoras del kiosco.</p>
            </div>

            <nav>
                <span class="admin-sidebar__label">Navegación</span>
                <ul class="main-menu admin-nav">
                    <li class="<?= $currentSection === "dashboard" ? "active" : "" ?>">
                        <a href="/admin/menu/">
                            <span class="admin-nav__icon"><i class="fa fa-tachometer"></i></span>
                            <span>Vista general</span>
                            <i class="fa fa-chevron-right admin-nav__arrow"></i>
                        </a>
                    </li>
                    <li class="<?= $currentSection === "registros" ? "active" : "" ?>">
                        <a href="/admin/registros/">
                            <span class="admin-nav__icon"><i class="fa fa-envelope"></i></span>
                            <span>Registros</span>
                            <i class="fa fa-chevron-right admin-nav__arrow"></i>
                        </a>
                    </li>
                    <li class="<?= $currentSection === "opiniones" ? "active" : "" ?>">
                        <a href="/admin/opiniones/">
                            <span class="admin-nav__icon"><i class="fa fa-comments"></i></span>
                            <span>Opiniones</span>
                            <i class="fa fa-chevron-right admin-nav__arrow"></i>
                        </a>
                    </li>
                    <li class="<?= $currentSection === "interacciones" ? "active" : "" ?>">
                        <a href="/admin/interacciones/">
                            <span class="admin-nav__icon"><i class="fa fa-hand-o-up"></i></span>
                            <span>Interacciones</span>
                            <i class="fa fa-chevron-right admin-nav__arrow"></i>
                        </a>
                    </li>
                    <li class="<?= $currentSection === "dispositivos" ? "active" : "" ?>">
                        <a href="/admin/dispositivos/">
                            <span class="admin-nav__icon"><i class="fa fa-desktop"></i></span>
                            <span>Dispositivos</span>
                            <i class="fa fa-chevron-right admin-nav__arrow"></i>
                        </a>
                    </li>
                </ul>
            </nav>

            <div class="admin-sidebar__footer">
                <a href="/admin/perfil/?username=<?= $username ?>">
                    <span class="admin-user__avatar admin-user__avatar--small"><?= htmlspecialchars($userInitial, ENT_QUOTES, "UTF-8") ?></span>
                    <span>
                        <strong><?= $userName ?></strong>
                        <small>Administrar cuenta</small>
                    </span>
                    <i class="fa fa-cog"></i>
                </a>
            </div>
        </div>
    </aside>
