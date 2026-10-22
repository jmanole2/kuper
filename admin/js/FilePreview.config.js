/**
 * FilePreview.config.js
 *
 * Preview de la primera página de PDFs.
 *
 * Requiere:
 * - PDF.js
 * - jQuery
 * - Jasny FileInput
 */


if (typeof pdfjsLib !== 'undefined') {

    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

}


/**
 * Renderiza la primera página de un PDF como canvas.
 *
 * @param {string} inputSelector
 * @param {string} canvasSelector
 * @param {string} containerSelector
 * @param {string|null} fileinputSelector
 * @param {boolean} strictPdf
 */
function createPdfPreview(
    inputSelector,
    canvasSelector,
    containerSelector,
    fileinputSelector = null,
    strictPdf = true
) {

    const input =
        document.querySelector(inputSelector);

    const canvas =
        document.querySelector(canvasSelector);

    const container =
        document.querySelector(containerSelector);


    if (!input || !canvas || !container) {

        console.warn(
            '[PDF Preview] No se encontraron los elementos.'
        );

        return null;

    }


    const context =
        canvas.getContext('2d');


    async function renderPdf(file) {

        if (!file) {
            clearPreview();
            return;
        }


        const isPdf =
            file.type === 'application/pdf' ||
            file.name.toLowerCase().endsWith('.pdf');


        if (!isPdf) {

            clearPreview();

            if (!strictPdf) {
                return;
            }


            input.value = '';

            swal({
                title: 'Selecciona un archivo PDF',
                icon: 'error'
            });

            return;

        }


        try {

            const arrayBuffer =
                await file.arrayBuffer();


            const pdf =
                await pdfjsLib
                    .getDocument({
                        data: arrayBuffer
                    })
                    .promise;


            /* SOLO PRIMERA PÁGINA */

            const page =
                await pdf.getPage(1);


            const viewport =
                page.getViewport({
                    scale: 1.5
                });


            canvas.width =
                viewport.width;


            canvas.height =
                viewport.height;


            context.clearRect(
                0,
                0,
                canvas.width,
                canvas.height
            );


            await page.render({

                canvasContext: context,

                viewport: viewport

            }).promise;


            container.style.display =
                'block';


        } catch (error) {

            console.error(
                '[PDF Preview]',
                error
            );


            clearPreview();


            swal({
                title: 'No se pudo generar la vista previa del PDF',
                icon: 'error'
            });

        }

    }


    function clearPreview() {

        context.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        canvas.width = 0;
        canvas.height = 0;


        container.style.display =
            'none';

    }


    input.addEventListener(
        'change',
        function () {

            const file =
                this.files && this.files.length
                    ? this.files[0]
                    : null;


            renderPdf(file);

        }
    );


    /* =========================================================
       Cuando Jasny FileInput elimina el archivo
       ========================================================= */

    if (fileinputSelector) {

        const $fileinput =
            $(fileinputSelector);


        $fileinput.on(
            'clear.bs.fileinput reset.bs.fileinput',
            function () {

                clearPreview();

            }
        );


        $fileinput
            .find('[data-dismiss="fileinput"]')
            .on(
                'click',
                function () {

                    setTimeout(
                        clearPreview,
                        0
                    );

                }
            );

    }


    return {

        clear() {
            clearPreview();
        }

    };

}
