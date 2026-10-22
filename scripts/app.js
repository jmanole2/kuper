const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const IDLE_TIMEOUT_MS = 2 * 60 * 1000;

const stage = document.querySelector(".stage");
const idleReturn = document.body.dataset.idleReturn;
const standbyInfo = document.querySelector(".standby__info");
const standbyInfoTrigger = document.querySelector(".standby__info-trigger");
const standbyStory = document.querySelector("#standby-story");
const standbyScreen = document.querySelector(".standby");
const standbyImage = document.querySelector(".standby__image");
let idleTimer;
let navigating = false;

function fitStage() {
  const scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
  stage.style.setProperty("--stage-scale", scale);
}

function resetIdleTimer() {
  if (!idleReturn) return;
  window.clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    void window.kaluzInteraction?.finish();
    window.location.replace(idleReturn);
  }, IDLE_TIMEOUT_MS);
}

function navigateTo(url, beforeNavigation = null) {
  if (navigating) return;
  navigating = true;
  stage.classList.add("is-leaving");
  const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 480;
  const transition = new Promise((resolve) => window.setTimeout(resolve, delay));
  const pendingTask = beforeNavigation && typeof beforeNavigation.then === "function"
    ? beforeNavigation
    : Promise.resolve();

  Promise.allSettled([transition, pendingTask]).then(() => window.location.assign(url));
}

window.kioskNavigate = navigateTo;

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-transition]");
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const interactionStart = link.hasAttribute("data-interaction-start")
    ? window.kaluzInteraction?.start()
    : null;
  navigateTo(link.href, interactionStart);
});

window.addEventListener("pageshow", () => {
  navigating = false;
  stage.classList.remove("is-leaving");
});

window.addEventListener("resize", fitStage);

if (standbyScreen && standbyImage) {
  const revealStandby = () => {
    window.requestAnimationFrame(() => standbyScreen.classList.remove("is-loading"));
  };

  if (standbyImage.complete) revealStandby();
  else {
    standbyImage.addEventListener("load", revealStandby, { once: true });
    standbyImage.addEventListener("error", revealStandby, { once: true });
  }
}

if (standbyInfo && standbyInfoTrigger && standbyStory) {
  const setStandbyInfoOpen = (isOpen) => {
    standbyInfoTrigger.setAttribute("aria-expanded", String(isOpen));
    standbyStory.setAttribute("aria-hidden", String(!isOpen));
  };

  standbyInfoTrigger.addEventListener("click", () => {
    setStandbyInfoOpen(standbyInfoTrigger.getAttribute("aria-expanded") !== "true");
  });

  document.addEventListener("pointerdown", (event) => {
    if (!standbyInfo.contains(event.target)) setStandbyInfoOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setStandbyInfoOpen(false);
      standbyInfoTrigger.focus();
    }
  });
}

if (idleReturn) {
  for (const eventName of ["pointerdown", "keydown"]) {
    document.addEventListener(eventName, resetIdleTimer, { passive: true });
  }
  resetIdleTimer();
}

fitStage();
