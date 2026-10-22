/**
 * form-handler.js
 * Registra los componentes Alpine ANTES de que Alpine inicialice el DOM.
 * Necesario porque Alpine carga con `defer`.
 */

document.addEventListener('alpine:init', () => {

    /* ══════════════════════════════════════════════════════════════
       imagenesHandler — imágenes generales fuera de categorías
    ══════════════════════════════════════════════════════════════ */
    Alpine.data('imagenesHandler', (imagenesIniciales = []) => ({

        imagenesExistentes: imagenesIniciales.map((img, i) => ({
            ...img,
            orden: img.orden ?? i,
        })),
        imagenesEliminadas: [],
        dragging: null,
        dragOverId: null,

        dragStart(imagenId) {
            this.dragging = imagenId;
        },

        dragEnter(imagenId) {
            if (this.dragging === null || this.dragging === imagenId) return;
            this.dragOverId = imagenId;
        },

        dragLeave(imagenId) {
            if (this.dragOverId === imagenId) this.dragOverId = null;
        },

        drop(imagenId) {
            if (this.dragging === null || this.dragging === imagenId) {
                this.dragging = null;
                this.dragOverId = null;
                return;
            }

            const imgs = [...this.imagenesExistentes];
            const fromI = imgs.findIndex(img => img.id === this.dragging);
            const toI = imgs.findIndex(img => img.id === imagenId);

            if (fromI !== -1 && toI !== -1) {
                const moved = imgs.splice(fromI, 1)[0];
                imgs.splice(toI, 0, moved);
                this.imagenesExistentes = imgs.map((img, i) => ({ ...img, orden: i }));
            }

            this.dragging = null;
            this.dragOverId = null;
        },

        dragEnd() {
            this.dragging = null;
            this.dragOverId = null;
        },

        eliminarImagen(imagenId) {
            this.imagenesEliminadas.push(imagenId);
            this.imagenesExistentes = this.imagenesExistentes
                .filter(img => img.id !== imagenId)
                .map((img, i) => ({ ...img, orden: i }));
        },

        serializeImagenes() {
            return {
                reorden: this.imagenesExistentes.map(img => ({ id: img.id, orden: img.orden })),
                eliminadas: this.imagenesEliminadas,
            };
        },
    }));

    /* ══════════════════════════════════════════════════════════════
       formHandler — categorías dinámicas con sus imágenes
    ══════════════════════════════════════════════════════════════ */
    Alpine.data('formHandler', (categorias, metadatosIniciales = []) => ({

        categorias: categorias,
        metadatos: [],

        init() {
            if (!Array.isArray(metadatosIniciales) || metadatosIniciales.length === 0) return;

            metadatosIniciales.forEach(item => {
                const uuid = crypto.randomUUID();
                this.metadatos.push({
                    id: uuid,
                    db_id: item.id || null,
                    categoria: String(item.categoria_id || ''),
                    activo: item.status === 2,
                    descripcion: item.descripcion || '',
                    ordenImagenes: [],
                    pond: null,
                    imagenesExistentes: (item.imagenes || []).map((img, i) => ({
                        ...img,
                        orden: img.orden ?? i,
                    })),
                    imagenesEliminadas: [],
                    dragging: null,
                    dragOverId: null,
                });
            });

            this.$nextTick(() => {
                this.metadatos.forEach(item => this._initItem(item.id, item.categoria));
            });
        },

        agregarItem() {
            const uuid = crypto.randomUUID();
            this.metadatos.push({
                id: uuid,
                db_id: null,
                categoria: '',
                activo: false,
                descripcion: '',
                ordenImagenes: [],
                pond: null,
                imagenesExistentes: [],
                imagenesEliminadas: [],
                dragging: null,
                dragOverId: null,
            });
            this.$nextTick(() => this._initItem(uuid));
        },

        eliminarItem(uuid) {
            const item = this.metadatos.find(p => p.id === uuid);
            if (!item) return;

            if (item.pond) {
                try { item.pond.destroy(); } catch (e) { }
            }
            const selectEl = document.getElementById('categoria-' + uuid);
            if (selectEl && typeof $.fn.selectpicker !== 'undefined') {
                try { $(selectEl).selectpicker('destroy'); } catch (e) { }
            }
            this.metadatos = this.metadatos.filter(p => p.id !== uuid);
        },

        dragStart(uuid, imagenId) {
            const item = this.metadatos.find(p => p.id === uuid);
            if (item) item.dragging = imagenId;
        },

        dragEnter(uuid, imagenId) {
            const item = this.metadatos.find(p => p.id === uuid);
            if (!item || item.dragging === imagenId) return;
            item.dragOverId = imagenId;
        },

        dragLeave(uuid, imagenId) {
            const item = this.metadatos.find(p => p.id === uuid);
            if (item && item.dragOverId === imagenId) item.dragOverId = null;
        },

        drop(uuid, imagenId) {
            const item = this.metadatos.find(p => p.id === uuid);
            if (!item || item.dragging === null || item.dragging === imagenId) {
                if (item) { item.dragging = null; item.dragOverId = null; }
                return;
            }

            const imgs = [...item.imagenesExistentes];
            const fromI = imgs.findIndex(img => img.id === item.dragging);
            const toI = imgs.findIndex(img => img.id === imagenId);

            if (fromI !== -1 && toI !== -1) {
                const moved = imgs.splice(fromI, 1)[0];
                imgs.splice(toI, 0, moved);
                item.imagenesExistentes = imgs.map((img, i) => ({ ...img, orden: i }));
            }

            item.dragging = null;
            item.dragOverId = null;
        },

        dragEnd(uuid) {
            const item = this.metadatos.find(p => p.id === uuid);
            if (item) { item.dragging = null; item.dragOverId = null; }
        },

        eliminarImagenExistente(uuid, imagenId) {
            const item = this.metadatos.find(p => p.id === uuid);
            if (!item) return;
            item.imagenesEliminadas.push(imagenId);
            item.imagenesExistentes = item.imagenesExistentes
                .filter(img => img.id !== imagenId)
                .map((img, i) => ({ ...img, orden: i }));
        },

        serializeMeta() {
            this.metadatos.forEach(item => {
                if (item.pond) {
                    item.ordenImagenes = item.pond.getFiles().map(f => f.filename);
                }
            });

            return this.metadatos.map((item, i) => ({
                id: item.id,
                db_id: item.db_id,
                categoria: item.categoria,
                activo: item.activo,
                descripcion: item.descripcion,
                ordenImagenes: item.ordenImagenes,
                imagenesReorden: item.imagenesExistentes.map(img => ({
                    id: img.id, orden: img.orden,
                })),
                imagenesEliminadas: item.imagenesEliminadas,
                index: i,
            }));
        },

        _initItem(uuid, categoriaSeleccionada = '') {
            const selectEl = document.getElementById('categoria-' + uuid);
            const inputEl = document.getElementById('filepond-' + uuid);
            const itemRef = this.metadatos.find(p => p.id === uuid);

            if (selectEl && typeof $.fn.selectpicker !== 'undefined') {
                $(selectEl).selectpicker();
                if (categoriaSeleccionada) {
                    $(selectEl).val(categoriaSeleccionada).selectpicker('refresh');
                }
                $(selectEl).on('changed.bs.select', () => {
                    if (itemRef) itemRef.categoria = selectEl.value;
                });
            }

            if (inputEl && typeof createPond === 'function') {
                const pond = createPond(inputEl, {}, (filenames) => {
                    if (itemRef) itemRef.ordenImagenes = filenames;
                });
                if (itemRef) itemRef.pond = pond;
            }
        },
    }));

    /* ══════════════════════════════════════════════════════════════
   redesSocialesHandler
   Tipo de red + enlace dinámicos
   ══════════════════════════════════════════════════════════════ */

    Alpine.data('redesSocialesHandler', (redesIniciales = []) => ({

        redes: [],

        init() {

            if (Array.isArray(redesIniciales)) {

                redesIniciales.forEach(red => {

                    this.redes.push({
                        id: crypto.randomUUID(),
                        tipo: red.tipo || '',
                        enlace: red.enlace || ''
                    });

                });

            }

            this.$nextTick(() => {

                this.redes.forEach(red => {
                    this._initSelect(red.id, red.tipo);
                });

            });

        },

        agregarRed() {

            const uuid = crypto.randomUUID();

            this.redes.push({
                id: uuid,
                tipo: '',
                enlace: ''
            });

            this.$nextTick(() => {
                this._initSelect(uuid);
            });

        },

        eliminarRed(uuid) {

            const selectEl =
                document.getElementById('red-tipo-' + uuid);

            if (
                selectEl &&
                typeof $.fn.selectpicker !== 'undefined'
            ) {

                try {
                    $(selectEl).selectpicker('destroy');
                } catch (e) { }

            }

            this.redes =
                this.redes.filter(red => red.id !== uuid);

        },

        serializeRedes() {

            return this.redes
                .filter(red =>
                    red.tipo.trim() !== '' ||
                    red.enlace.trim() !== ''
                )
                .map(red => ({
                    tipo: red.tipo,
                    enlace: red.enlace
                }));

        },

        _initSelect(uuid, tipoSeleccionado = '') {

            const selectEl =
                document.getElementById('red-tipo-' + uuid);

            const red =
                this.redes.find(item => item.id === uuid);

            if (!selectEl || !red) {
                return;
            }

            if (typeof $.fn.selectpicker !== 'undefined') {

                $(selectEl).selectpicker();

                if (tipoSeleccionado) {

                    $(selectEl)
                        .val(tipoSeleccionado)
                        .selectpicker('refresh');

                }

                $(selectEl).on(
                    'changed.bs.select',
                    () => {
                        red.tipo = selectEl.value;
                    }
                );

            }

        }

    }));
    /* ══════════════════════════════════════════════════════════════
   redesSocialesHandler
══════════════════════════════════════════════════════════════ */

    Alpine.data('redesSocialesHandler', (redesIniciales = []) => ({

        redes: [],

        init() {

            if (Array.isArray(redesIniciales)) {

                this.redes = redesIniciales.map(red => ({
                    id: crypto.randomUUID(),
                    tipo: String(red.tipo || ''),
                    enlace: red.enlace || ''
                }));

            }

            this.$nextTick(() => {

                this.redes.forEach(red => {

                    this._initSelect(
                        red.id,
                        red.tipo
                    );

                });

            });

        },


        agregarRed() {

            const uuid =
                crypto.randomUUID();

            this.redes.push({
                id: uuid,
                tipo: '',
                enlace: ''
            });

            this.$nextTick(() => {

                this._initSelect(uuid);

            });

        },


        eliminarRed(uuid) {

            const selectEl =
                document.getElementById(
                    'red-tipo-' + uuid
                );


            if (
                selectEl &&
                typeof $ !== 'undefined' &&
                typeof $.fn.selectpicker !== 'undefined'
            ) {

                try {
                    $(selectEl).selectpicker('destroy');
                } catch (e) { }

            }


            this.redes =
                this.redes.filter(
                    red => red.id !== uuid
                );

        },


        serializeRedes() {

            return this.redes
                .filter(red => {

                    return (
                        String(red.tipo || '').trim() !== ''
                        ||
                        String(red.enlace || '').trim() !== ''
                    );

                })
                .map(red => ({

                    tipo:
                        String(red.tipo || '').trim(),

                    enlace:
                        String(red.enlace || '').trim()

                }));

        },


        _initSelect(
            uuid,
            tipoSeleccionado = ''
        ) {

            const selectEl =
                document.getElementById(
                    'red-tipo-' + uuid
                );

            const red =
                this.redes.find(
                    item => item.id === uuid
                );


            if (!selectEl || !red) {
                return;
            }


            selectEl.value =
                tipoSeleccionado;


            if (
                typeof $ !== 'undefined' &&
                typeof $.fn.selectpicker !== 'undefined'
            ) {

                $(selectEl)
                    .selectpicker();


                $(selectEl)
                    .val(tipoSeleccionado)
                    .selectpicker('refresh');


                $(selectEl)
                    .off('changed.bs.select.redes')
                    .on(
                        'changed.bs.select.redes',
                        () => {

                            red.tipo =
                                selectEl.value;

                        }
                    );

            } else {

                selectEl.addEventListener(
                    'change',
                    () => {

                        red.tipo =
                            selectEl.value;

                    }
                );

            }

        }

    }));
});