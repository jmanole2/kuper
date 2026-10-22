/**
 * filepond.config.js
 * Opciones base de FilePond y helper para inicializar instancias.
 * Requiere que FilePond y sus plugins ya estén cargados en la página.
 *
 * Uso:
 *   const pond = createPond('#mi-input');
 *   const pond = createPond('#mi-input', { maxFiles: 5 });
 *   const pond = createPond('#mi-input', {}, (files) => console.log(files));
 */

const pondBaseOptions = {
    allowMultiple:      true,
    allowReorder:       true,
    allowImagePreview:  true,
    allowImageCrop:     false,
    allowImageResize:   false,
    imagePreviewHeight: 200,
    acceptedFileTypes:  ['image/*'],
    maxFiles:           20,
    storeAsFile:        true,
    credits:            false,
    labelIdle: `
        <div style="padding:20px">
            <i class="zmdi zmdi-cloud-upload" style="font-size:40px"></i>
            <br>Arrastra imágenes o
            <span class="filepond--label-action">búscalas</span>
        </div>`,
    labelTapToCancel:  '',
    labelTapToRetry:   '',
    labelTapToUndo:    '',
};

/**
 * Crea una instancia de FilePond.
 *
 * @param {string|HTMLElement} target  Selector CSS o elemento DOM
 * @param {object}             options Opciones extra que sobreescriben las base
 * @param {function}           onReorder  Callback opcional al reordenar (recibe array de filenames)
 * @returns {FilePond} instancia creada
 */
function createPond(target, options = {}, onReorder = null) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;

    if (!el) {
        console.warn('[FilePond] Elemento no encontrado:', target);
        return null;
    }

    return FilePond.create(el, {
        ...pondBaseOptions,
        ...options,
        ...(onReorder ? {
            onreorderfiles(files) {
                onReorder(files.map(f => f.filename));
            }
        } : {})
    });
}