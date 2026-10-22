(function ($) {
    "use strict";

    $(function () {
        var $body = $("body");
        var $header = $("#header");
        var $sidebar = $("#sidebar");
        var $trigger = $("#menu-trigger");
        var $backdrop = $(".admin-sidebar-backdrop");

        function closeSidebar() {
            $sidebar.removeClass("toggled");
            $trigger.removeClass("open").attr("aria-expanded", "false");
            $header.removeClass("sidebar-toggled");
            $backdrop.removeClass("is-visible");
            $body.removeClass("modal-open");
        }

        function openSidebar() {
            $sidebar.addClass("toggled");
            $trigger.addClass("open").attr("aria-expanded", "true");
            $header.addClass("sidebar-toggled");
            $backdrop.addClass("is-visible");
            $body.addClass("modal-open");
        }

        $("body").on("click", "#menu-trigger", function (event) {
            event.preventDefault();

            if ($sidebar.hasClass("toggled")) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });

        $("body").on("click", "[data-sidebar-close]", closeSidebar);

        $(document).on("keydown", function (event) {
            if (event.key === "Escape" && $sidebar.hasClass("toggled")) {
                closeSidebar();
            }
        });

        $(window).on("resize", function () {
            if (window.matchMedia("(min-width: 992px)").matches) {
                closeSidebar();
            }
        });

        $(window).on("scroll", function () {
            $header.toggleClass("is-scrolled", window.pageYOffset > 8);
        }).trigger("scroll");

        $("body").on("focus", ".form-control", function () {
            $(this).closest(".fg-line").addClass("fg-toggled");
        });

        $("body").on("blur", ".form-control", function () {
            if (!$(this).val()) {
                $(this).closest(".fg-line").removeClass("fg-toggled");
            }
        });

        if ($.fn.tooltip) {
            $("[data-toggle='tooltip']").tooltip();
        }
    });
}(jQuery));
