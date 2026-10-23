// El póster aparece de inmediato. El video de 10 MB se solicita solamente
// cuando la cubeta ya mostró su primer cuadro y terminó su acabado principal,
// evitando que ambos recursos compitan durante la primera impresión.
(function () {
  const heroVideo = document.querySelector('.hero-background-video');
  const heroBackground = document.querySelector('.hero-bg');
  let videoRequested = false;

  function requestVideo() {
    if (!heroVideo || videoRequested) return;
    const source = heroVideo.dataset.src;
    if (!source) return;

    videoRequested = true;
    heroVideo.src = source;
    heroVideo.load();

    const playVideo = () => {
      const playPromise = heroVideo.play();
      if (playPromise) playPromise.catch(() => {});
    };

    if (heroVideo.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) playVideo();
    else heroVideo.addEventListener('canplay', playVideo, { once: true });
  }

  function scheduleVideo() {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(requestVideo, { timeout: 1200 });
    } else {
      window.setTimeout(requestVideo, 180);
    }
  }

  function markBackgroundReady() {
    requestAnimationFrame(() => heroBackground?.classList.add('is-ready'));
  }

  markBackgroundReady();

  if (document.documentElement.dataset.heroEnhanced === 'true') {
    scheduleVideo();
  } else {
    window.addEventListener('novaplastica:hero-enhanced', scheduleVideo, { once: true });
    window.addEventListener('load', () => {
      window.setTimeout(scheduleVideo, 6000);
    }, { once: true });
  }
})();
