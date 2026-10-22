/**
 * fechas.js
 *
 * Flatpickr reutilizable para fechas y horas.
 *
 * Clases:
 *
 * js-datepicker
 * js-timepicker
 */

document.addEventListener('DOMContentLoaded', function () {

    if (typeof flatpickr === 'undefined') {
        console.warn('[Flatpickr] Librería no cargada.');
        return;
    }


    /* =========================================================
       Idioma español global
       ========================================================= */

    if (flatpickr.l10ns && flatpickr.l10ns.es) {
        flatpickr.localize(flatpickr.l10ns.es);
    }


    /* =========================================================
       FECHA
       ========================================================= */

    flatpickr('.js-datepicker', {

        dateFormat: 'Y-m-d',

        altInput: true,

        altFormat: 'd/m/Y',

        allowInput: true

    });


    /* =========================================================
       HORA
       ========================================================= */

    flatpickr('.js-timepicker', {

        enableTime: true,

        noCalendar: true,

        dateFormat: 'H:i',

        time_24hr: true,

        allowInput: true

    });

});