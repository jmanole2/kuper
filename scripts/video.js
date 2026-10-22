const video = document.querySelector("#intro-video");
const intro = document.querySelector(".video-screen__intro");
const skip = document.querySelector(".video-screen__skip");
const introStartedAt = performance.now();

function revealVideo() {
  const delay = Math.max(0, 650 - (performance.now() - introStartedAt));
  window.setTimeout(() => intro.classList.add("is-hidden"), delay);
}

video.addEventListener("canplay", revealVideo, { once: true });
video.addEventListener("error", revealVideo, { once: true });

const player = new Plyr("#intro-video", {
  autoplay: true,
  muted: true,
  playsinline: true,
  hideControls: false,
  resetOnEnd: false,
  iconUrl: "../assets/vendor/plyr/plyr.svg",
  controls: ["play-large", "play", "progress", "current-time", "duration"],
  storage: { enabled: false },
  i18n: {
    play: "Reproducir",
    pause: "Pausar",
    restart: "Volver a reproducir",
    currentTime: "Tiempo transcurrido",
    duration: "Duración",
    seek: "Buscar",
  },
});

function showSkip() {
  if (skip.classList.contains("is-visible") || player.currentTime < 2) return;
  skip.classList.add("is-visible");
  skip.removeAttribute("aria-hidden");
  skip.removeAttribute("tabindex");
}

player.on("timeupdate", showSkip);
player.on("ended", () => window.kioskNavigate("./menu.html"));
player.on("ready", () => {
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) revealVideo();
  showSkip();
  player.play().catch(() => {});
});
