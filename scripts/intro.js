(function () {
  "use strict";

  const carousel = document.querySelector(".intro-carousel");

  if (!carousel) return;

  const track = carousel.querySelector(".intro-track");
  const slides = Array.from(carousel.querySelectorAll(".intro-slide"));
  const backControl = carousel.querySelector("[data-intro-back]");
  const backLabel = backControl?.querySelector(".intro-back__label");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const screenWidth = 1920;
  const previewOverlap = 270;
  const slidePositions = slides.map((_, index) => index === 0 ? 0 : (index * screenWidth) - previewOverlap);
  const maxPosition = slidePositions.at(-1);
  const requestedSlide = Number(new URLSearchParams(window.location.search).get("slide"));
  let currentIndex = Number.isInteger(requestedSlide) && requestedSlide >= 1 && requestedSlide <= slides.length
    ? requestedSlide - 1
    : 0;
  let position = slidePositions[currentIndex];
  let pointerId = null;
  let pointerStartX = 0;
  let pointerStartPosition = 0;
  let pointerMoved = false;
  let transitionLocked = false;
  let backMode = currentIndex === 0 ? "start" : "previous";
  let labelTimer;

  if (backControl && backLabel && backMode === "previous") {
    backLabel.textContent = "Regresar";
    backControl.setAttribute("aria-label", "Regresar a la sección anterior");
  }

  function waitForImage(image) {
    return new Promise((resolve) => {
      if (image.complete) {
        resolve();
        return;
      }
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", resolve, { once: true });
    });
  }

  function updateBackControl() {
    if (!backControl || !backLabel) return;

    const nextMode = currentIndex === 0 ? "start" : "previous";
    if (nextMode === backMode) return;

    backMode = nextMode;
    window.clearTimeout(labelTimer);
    backControl.classList.add("is-label-changing");
    const fadeDuration = reducedMotion.matches ? 0 : 180;
    labelTimer = window.setTimeout(() => {
      const isStart = backMode === "start";
      backLabel.textContent = isStart ? "INICIO" : "Regresar";
      backControl.setAttribute("aria-label", isStart ? "Volver al inicio" : "Regresar a la sección anterior");
      window.requestAnimationFrame(() => backControl.classList.remove("is-label-changing"));
    }, fadeDuration);
  }

  function updateSlides() {
    slides.forEach((slide, index) => {
      const isActive = index === currentIndex;
      slide.classList.toggle("is-active", isActive);
      if (isActive) slide.setAttribute("aria-current", "true");
      else slide.removeAttribute("aria-current");
      slide.removeAttribute("aria-hidden");
      slide.inert = false;
    });
    updateBackControl();
  }

  function getNearestIndex(value) {
    return slidePositions.reduce((nearest, slidePosition, index) => (
      Math.abs(slidePosition - value) < Math.abs(slidePositions[nearest] - value) ? index : nearest
    ), 0);
  }

  function getNextIndex(value) {
    const index = slidePositions.findIndex((slidePosition) => slidePosition > value + 1);
    return index === -1 ? slides.length - 1 : index;
  }

  function getPreviousIndex(value) {
    for (let index = slidePositions.length - 1; index >= 0; index -= 1) {
      if (slidePositions[index] < value - 1) return index;
    }
    return 0;
  }

  function clampPosition(value) {
    return Math.max(0, Math.min(maxPosition, value));
  }

  function setTrackPosition(nextPosition = position, animate = true) {
    position = clampPosition(nextPosition);
    carousel.classList.toggle("is-positioning", !animate);
    track.style.transform = `translate3d(${-position}px, 0, 0)`;
  }

  function goTo(index) {
    const nextIndex = Math.max(0, Math.min(slides.length - 1, index));
    const nextPosition = slidePositions[nextIndex];

    if (transitionLocked) return;
    if (Math.abs(position - nextPosition) < 1) {
      currentIndex = nextIndex;
      updateSlides();
      return;
    }

    currentIndex = nextIndex;
    transitionLocked = !reducedMotion.matches;
    updateSlides();
    setTrackPosition(nextPosition);
  }

  carousel.addEventListener("click", (event) => {
    if (pointerMoved) {
      event.preventDefault();
      pointerMoved = false;
      return;
    }

    const next = event.target.closest("[data-carousel-next]");
    const previous = event.target.closest("[data-carousel-prev]");
    const slide = event.target.closest(".intro-slide");
    const slideIndex = slides.indexOf(slide);

    if (next) {
      goTo(slideIndex + 1);
    } else if (previous) {
      goTo(slideIndex - 1);
    }
  });

  backControl?.addEventListener("click", () => {
    if (backMode === "start") {
      if (window.kioskNavigate) window.kioskNavigate("../index.html");
      else window.location.assign("../index.html");
      return;
    }

    goTo(getPreviousIndex(position));
  });

  track.addEventListener("transitionend", (event) => {
    if (event.target === track && event.propertyName === "transform") {
      transitionLocked = false;
    }
  });

  carousel.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || transitionLocked || event.target.closest("a, button")) return;

    pointerId = event.pointerId;
    pointerStartX = event.clientX;
    pointerStartPosition = position;
    pointerMoved = false;
    transitionLocked = false;
    carousel.classList.add("is-panning");
    carousel.setPointerCapture(pointerId);
  });

  carousel.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;

    const renderedScale = carousel.getBoundingClientRect().width / screenWidth;
    const delta = (event.clientX - pointerStartX) / renderedScale;
    pointerMoved ||= Math.abs(delta) > 8;
    setTrackPosition(pointerStartPosition - delta, false);
    currentIndex = getNearestIndex(position);
    updateSlides();
  });

  function finishPan(event) {
    if (event.pointerId !== pointerId) return;

    if (carousel.hasPointerCapture(pointerId)) carousel.releasePointerCapture(pointerId);
    pointerId = null;
    carousel.classList.remove("is-panning");
    window.requestAnimationFrame(() => carousel.classList.remove("is-positioning"));
  }

  carousel.addEventListener("pointerup", finishPan);
  carousel.addEventListener("pointercancel", finishPan);

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      goTo(getNextIndex(position));
    } else if (event.key === "ArrowLeft") {
      goTo(getPreviousIndex(position));
    }
  });

  updateSlides();
  setTrackPosition(position, false);
  const images = Array.from(carousel.querySelectorAll("img"));
  Promise.all(images.map(waitForImage)).then(() => {
    window.requestAnimationFrame(() => {
      carousel.classList.remove("is-positioning", "is-loading");
    });
  });
}());
