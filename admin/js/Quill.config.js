/**
 * quill.config.js
 * Toolbar y helper para inicializar Quill.
 * Requiere que Quill y highlight.js ya estén cargados en la página.
 *
 * Uso básico:
 *   const quill = createQuill('#editor');
 *
 * Con sincronización automática a un input hidden:
 *   const quill = createQuill('#editor', '#mi-hidden-input');
 *
 * Con opciones extra:
 *   const quill = createQuill('#editor', '#input', { placeholder: 'Escribe aquí...' });
 */

const quillToolbar = [
    [{ size: ['small', false, 'large', 'huge'] }],
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    [{ color: [] }, { background: [] }],
    [{ font: [] }],
    [{ align: [] }],
    ['bold', 'italic', 'underline', 'strike'],
    ['blockquote', 'code-block'],
    ['link', 'image', 'video', 'formula'],
    [{ header: 1 }, { header: 2 }],
    [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
    [{ script: 'sub' }, { script: 'super' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ direction: 'rtl' }],
    ['clean'],
];

/**
 * Crea una instancia de Quill.
 *
 * @param {string|HTMLElement} editorTarget   Selector o elemento del div editor
 * @param {string|HTMLElement|null} syncTarget Selector o elemento del input hidden a sincronizar
 * @param {object} options  Opciones extra que sobreescriben las base
 * @returns {Quill} instancia creada
 */
function createQuill(editorTarget, syncTarget = null, options = {}) {
    const editorEl = typeof editorTarget === 'string'
        ? document.querySelector(editorTarget)
        : editorTarget;

    if (!editorEl) {
        console.warn('[Quill] Elemento no encontrado:', editorTarget);
        return null;
    }

    const quill = new Quill(editorEl, {
        theme: 'snow',
        modules: {
            imageResize: { displaySize: true },
            syntax:      true,
            toolbar:     quillToolbar,
        },
        ...options,
    });

    if (syncTarget) {
        const inputEl = typeof syncTarget === 'string'
            ? document.querySelector(syncTarget)
            : syncTarget;

        if (inputEl) {
            // Sincronización inicial (por si el editor tiene contenido al cargar)
            inputEl.value = quill.root.innerHTML;

            quill.on('text-change', () => {
                inputEl.value = quill.root.innerHTML;
            });
        } else {
            console.warn('[Quill] Input de sincronización no encontrado:', syncTarget);
        }
    }

    return quill;
}