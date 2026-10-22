<?php if (($hasAdminShell ?? false) === true): ?>
</section>
<?php endif; ?>

<footer id="footer">
    <span>SM Kaluz</span>
    <i aria-hidden="true"></i>
    <span>Administración <?= date("Y") ?></span>
</footer>

<script src="/admin/vendors/bower_components/jquery/dist/jquery.min.js"></script>
<script src="/admin/vendors/bower_components/bootstrap/dist/js/bootstrap.min.js"></script>
<script src="/admin/vendors/datatables/jquery.dataTables.min.js"></script>
<script src="/admin/vendors/datatables/dataTables.foundation.js"></script>
<script src="/admin/js/admin.js"></script>

<script>
window.kaluzDataTableLanguage = {
    emptyTable: "No hay información disponible",
    info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
    infoEmpty: "Mostrando 0 a 0 de 0 registros",
    infoFiltered: "(filtrado de _MAX_ registros)",
    lengthMenu: "Mostrar _MENU_ registros",
    loadingRecords: "Cargando…",
    processing: "Procesando…",
    search: "Buscar:",
    zeroRecords: "No se encontraron resultados",
    paginate: {
        first: "Primero",
        last: "Último",
        next: "Siguiente",
        previous: "Anterior"
    }
};

if (window.fetch) {
    var kaluzFetch = window.fetch;

    window.fetch = function () {
        return kaluzFetch.apply(this, arguments).then(function (response) {
            if (response.status === 401) {
                window.location.href = "/admin/login/";
            }

            return response;
        });
    };
}
</script>
