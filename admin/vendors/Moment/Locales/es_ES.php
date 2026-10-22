<?php

// locale: spanish (es)
// author: Julio Napurí https://github.com/julionc

use Moment\Moment;

return array(
    "months"        => explode('_', 'Enero_Febrero_Marzo_Abril_Mayo_Junio_Julio_Agosto_Septiembre_Octubre_Noviembre_Diciembre'),
    "monthsShort"   => explode('_', 'ene._feb._mar._abr._may._jun._jul._ago._sep._oct._nov._dic.'),
    "weekdays"      => explode('_', 'Lunes_Martes_Miércoles_Jueves_Viernes_Sábado_Domingo'),
    "weekdaysShort" => explode('_', 'lun._mar._mié._jue._vie._sáb._dom.'),
    "calendar"      => array(
        "sameDay"  => '[hoy]',
        "nextDay"  => '[mañana]',
        "lastDay"  => '[ayer]',
        "lastWeek" => '[el] l',
        "sameElse" => 'l',
        "withTime" => function (Moment $moment) { return '[a la' . ($moment->getHour() !== 1 ? 's' : null) . '] H:i'; },
        "default"  => 'd/m/Y',
    ),
    "relativeTime"  => array(
        "future" => 'en %s',
        "past"   => 'hace %s',
        "s"      => 'unos segundos',
        "m"      => 'un minuto',
        "mm"     => '%d minutos',
        "h"      => 'una hora',
        "hh"     => '%d horas',
        "d"      => 'un día',
        "dd"     => '%d días',
        "M"      => 'un mes',
        "MM"     => '%d meses',
        "y"      => 'un año',
        "yy"     => '%d años',
    ),
    "ordinal"       => function ($number)
    {
        return $number . 'º';
    },
    "week"          => array(
        "dow" => 1, // Monday is the first day of the week.
        "doy" => 4  // The week that contains Jan 4th is the first week of the year.
    ),
);