// Sección 01 (Experiencia): contenido de las pestañas y carrusel de la tarjeta.
(() => {
  const pills = document.querySelectorAll('#expPills .exp-pill');
  const title = document.getElementById('expTitle');
  const text = document.getElementById('expText');
  const caption = document.getElementById('expCaption');
  if (!pills.length || !title) return;

  // Contenido de cada pestaña. Para cambiar de foto por pestaña, agrega photo: 'ruta.jpg'.
  const GRADES = {
    alimenticio: {
      title: 'Envases seguros para tus alimentos',
      text: 'Fabricamos cubetas y tapas en polietileno y polipropileno para contacto con alimentos, con certificación FSSC 22000 e ISO 9001. Atendemos a marcas de lácteos, chocolates e ingredientes.',
      caption: 'Cumplen FDA 21 CFR 177.1520 y directivas europeas para contacto con alimentos.'
    },
    industrial: {
      title: 'Resistencia para pinturas y recubrimientos',
      text: 'Cubetas y tapas rígidas y duraderas en PE-HD y PP para envasar, almacenar y transportar pinturas, recubrimientos y otros productos de uso industrial.',
      caption: 'Diseños de línea en distintas capacidades, listos para tu operación.'
    },
    especiales: {
      title: 'Desarrollamos el envase que tu marca necesita',
      text: 'Personalizamos el color con master batch, imprimimos tu marca en la cubeta y desarrollamos diseños exclusivos por inyección, desde la idea hasta la producción.',
      caption: 'Cuéntanos tu proyecto y te ayudamos a encontrar la solución adecuada.'
    }
  };

  const photo = document.getElementById('expPhoto');
  const select = (key) => {
    const data = GRADES[key];
    if (!data) return;
    pills.forEach((pill) => {
      const on = pill.dataset.grade === key;
      pill.classList.toggle('active', on);
      pill.setAttribute('aria-selected', String(on));
    });
    title.textContent = data.title;
    text.textContent = data.text;
    caption.textContent = data.caption;
    if (data.photo && photo) photo.src = data.photo;
  };
  pills.forEach((pill) => pill.addEventListener('click', () => select(pill.dataset.grade)));

  // Carrusel de la tarjeta "Destacado".
  const img = document.getElementById('expCarouselImg');
  const count = document.getElementById('expCount');
  const dots = Array.from(document.querySelectorAll('#expDots .exp-dot'));
  const SLIDES = [
    { src: 'assets/images/novaplastica_2.jpeg', alt: 'Colaborador operando equipo de impresión en Novaplastica' },
    { src: 'assets/images/novaplastica_1.jpeg', alt: 'Colaborador de Novaplástica supervisando la producción' },
    { src: 'assets/images/experience/catalog/novaplastica_3.jpeg', alt: 'Proceso de impresión en la planta de Novaplástica' }
  ];
  if (!img || !dots.length) return;

  let index = 0;
  let timer = null;
  const show = (i) => {
    index = (i + SLIDES.length) % SLIDES.length;
    img.src = SLIDES[index].src;
    img.alt = SLIDES[index].alt;
    if (count) count.textContent = `${index + 1}/${SLIDES.length}`;
    dots.forEach((dot, n) => dot.classList.toggle('active', n === index));
  };
  const restart = () => {
    clearInterval(timer);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    timer = setInterval(() => show(index + 1), 4500);
  };
  dots.forEach((dot) => dot.addEventListener('click', () => { show(Number(dot.dataset.i)); restart(); }));
  restart();
})();
