// Las secciones inferiores se inicializan únicamente cuando se aproximan al
// viewport. Así la cubeta y el hero conservan la prioridad de red y CPU.
const loadedModules = new Map();
let deferredSectionsInitialized = false;

function loadModule(path) {
  if (!loadedModules.has(path)) {
    loadedModules.set(path, import(path).catch(error => {
      loadedModules.delete(path);
      console.warn(`No se pudo cargar ${path}.`, error);
    }));
  }
  return loadedModules.get(path);
}

function runWhenIdle(callback) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(callback, { timeout: 1200 });
  } else {
    window.setTimeout(callback, 120);
  }
}

function loadNearSection(sectionId, loader, rootMargin = '700px 0px') {
  const section = document.getElementById(sectionId);
  if (!section) return;

  if (!('IntersectionObserver' in window)) {
    runWhenIdle(loader);
    return;
  }

  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    loader();
  }, { rootMargin });

  observer.observe(section);
}

function initializeDeferredSections() {
  if (deferredSectionsInitialized) return;
  deferredSectionsInitialized = true;

  loadNearSection('valores', () => loadModule('./values.js'), '850px 0px');
  loadNearSection('brandValues', () => loadModule('./brand-values.js'), '850px 0px');

  loadNearSection('recognitions', () => loadModule('./recognitions.js'), '900px 0px');

  loadNearSection('coverage', () => loadModule('./coverage-map.js'), '1000px 0px');
  loadNearSection('catalogo', () => loadModule('./catalog.js'), '1000px 0px');
  loadNearSection('materiaPrima', () => loadModule('./materials-scene.js'), '900px 0px');
  loadNearSection('clientes', () => loadModule('./clients-cloud.js'), '900px 0px');
}

if (document.documentElement.dataset.heroFirstFrame === 'true') {
  initializeDeferredSections();
} else {
  window.addEventListener('novaplastica:hero-first-frame', initializeDeferredSections, { once: true });
  window.addEventListener('load', initializeDeferredSections, { once: true });
}
