const menuScreen = document.querySelector(".menu-screen");
const menuHeading = document.querySelector(".menu-header h1");
const menuBack = document.querySelector(".menu-back");
const menuNext = document.querySelector(".menu-next");
const menuNextLabel = menuNext.querySelector("span");
const menuCards = document.querySelector(".menu-zones");
const menuQuestionEnd = document.querySelector(".menu-register__question-end");
const menuRegistrationLink = document.querySelector(".menu-register__cta");
const menuHeader = document.querySelector(".menu-header");
const menuRegister = document.querySelector(".menu-register");
const menuActions = document.querySelector(".menu-actions");
const menuRoutesLink = document.querySelector(".menu-action--routes");
const menuOpinionLink = document.querySelector(".menu-action--opinion");
const menuRoutesTitle = document.querySelector(".menu-action--routes .menu-action__title");
const menuOpinionTitle = document.querySelector(".menu-action--opinion .menu-action__title");
const menuOpinionDetail = document.querySelector(".menu-action--opinion .menu-action__detail");
const placeListZoneNavigation = document.querySelector(".place-list__zone-navigation");
const placeListPreviousZone = document.querySelector(".place-list__zone-link--previous");
const placeListNextZone = document.querySelector(".place-list__zone-link--next");
const zoneInfo = document.querySelector(".zone-info");
const zoneInfoTitle = document.querySelector(".zone-info__title");
const zoneInfoDescription = document.querySelector(".zone-info__description");
const zoneInfoScrollTrack = document.querySelector(".zone-info__scroll-track");
const zoneInfoScrollThumb = document.querySelector(".zone-info__scroll-thumb");
const zoneInfoScrollUp = document.querySelector(".zone-info__scroll-button--up");
const zoneInfoScrollDown = document.querySelector(".zone-info__scroll-button--down");
const zoneInfoVideo = document.querySelector(".zone-info__video");
const zoneInfoPlaces = document.querySelector(".zone-info__places");
const placeDetail = document.querySelector(".place-detail");
const detailBody = document.querySelector(".place-detail__body");
const detailBack = document.querySelector(".place-detail__back");
const detailImage = document.querySelector(".place-detail__image");
const detailTitle = document.querySelector(".place-detail__title");
const detailState = document.querySelector(".place-detail__state");
const detailDescription = document.querySelector(".place-detail__description");
const detailPrevious = document.querySelector(".place-detail__previous");
const detailNext = document.querySelector(".place-detail__next");
const glossaryOverlay = document.querySelector(".glossary-overlay");
const glossaryCutout = document.querySelector(".glossary-cutout");
const glossaryPopup = document.querySelector(".glossary-popup");
const glossaryTitle = document.querySelector("#glossary-title");
const glossaryDefinition = document.querySelector("#glossary-definition");
const glossaryClose = document.querySelector(".glossary-popup__close");
const projectRoot = new URL("../", window.location.href);

let content;
let orderedZones = [];
let currentZoneId = null;
let currentPlaceId = null;
let currentZoneView = "menu";
let changingView = false;
let transitionTimer;
let glossaryTrigger;

function assetUrl(path) {
  return new URL(path, projectRoot).href;
}

function zoneHref(zoneId, zoneView = "info") {
  const href = `?zona=${encodeURIComponent(zoneId)}`;
  return zoneView === "places" ? `${href}&vista=edificios` : href;
}

function viewHref(zoneId, placeId, zoneView = "info") {
  if (!zoneId) return "./menu.html";
  return placeId
    ? `${zoneHref(zoneId, "places")}&lugar=${encodeURIComponent(placeId)}`
    : zoneHref(zoneId, zoneView);
}

function placesInZone(zoneId) {
  return content.ubicaciones
    .filter((place) => place.zonaId === zoneId)
    .sort((a, b) => a.orden - b.orden);
}

function setListingInteractive(interactive) {
  for (const element of [menuHeader, menuCards, menuActions, placeListZoneNavigation]) {
    element.inert = !interactive;
  }
}

function setMainSectionsVisible(visible) {
  menuHeader.hidden = !visible;
  menuCards.hidden = !visible;
  menuRegister.hidden = !visible;
  menuActions.hidden = !visible;
  placeListZoneNavigation.hidden = true;
  placeDetail.hidden = visible;
  zoneInfo.hidden = true;
  menuHeading.hidden = false;
  zoneInfoVideo.pause();
  if (visible) setListingInteractive(true);
}

function setZoneInfoVisible() {
  menuHeader.hidden = false;
  menuCards.hidden = true;
  menuRegister.hidden = true;
  menuActions.hidden = true;
  placeDetail.hidden = true;
  zoneInfo.hidden = false;
  menuHeading.hidden = true;
}

function createImage(path) {
  const image = document.createElement("img");
  image.src = assetUrl(path);
  image.alt = "";
  image.draggable = false;
  return image;
}

function waitForImage(image) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    if (image.complete) {
      finish();
      return;
    }

    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  });
}

function updateZoneScrollIndicator() {
  const maxScroll = Math.max(0, zoneInfoDescription.scrollHeight - zoneInfoDescription.clientHeight);
  const trackHeight = zoneInfoScrollTrack.clientHeight;
  const thumbHeight = maxScroll ? Math.min(trackHeight, 220) : trackHeight;
  const availableTravel = Math.max(0, trackHeight - thumbHeight);
  const thumbOffset = maxScroll ? (zoneInfoDescription.scrollTop / maxScroll) * availableTravel : 0;

  zoneInfoScrollThumb.style.height = `${thumbHeight}px`;
  zoneInfoScrollThumb.style.setProperty("--scroll-thumb-offset", `${thumbOffset}px`);
}

function renderMenu() {
  setMainSectionsVisible(true);
  menuScreen.classList.remove("is-listing", "is-detail", "is-zone-info");
  menuScreen.classList.add("is-menu-home");
  menuScreen.setAttribute("aria-label", "Menú de zonas");
  menuHeading.textContent = "Elige la zona que te gustaría explorar";
  menuBack.href = "./intro.html?slide=4";
  menuBack.setAttribute("data-transition", "");
  menuNext.hidden = true;
  menuQuestionEnd.textContent = "sobre los recorridos de éstas zonas?";
  menuRegistrationLink.href = "./registro.html";
  menuRegister.hidden = true;
  menuActions.hidden = false;
  menuRoutesTitle.innerHTML = "Ahora recorre la ciudad.<br />¿Deseas información<br />sobre nuestras rutas a<br />pie, en bicicleta y<br />experiencias especiales?";
  menuRoutesLink.href = "./registro.html";
  menuOpinionLink.href = "./opinion.html";
  menuOpinionTitle.innerHTML = "Nos interesa conocer<br />tu opinión";
  menuOpinionDetail.textContent = "Queremos mejorar tu experiencia. Compártenos tu opinión";
  menuCards.className = "menu-zones";
  delete menuCards.dataset.zone;
  menuCards.setAttribute("aria-label", "Zonas para explorar");

  const cards = orderedZones.map((zone, index) => {
    const button = document.createElement("button");
    button.className = "menu-zone";
    button.type = "button";
    button.dataset.zone = zone.id;
    button.style.setProperty("--zone-order", index);
    button.style.setProperty("--drift-duration", `${14 + index * 2}s`);

    const imageTrack = document.createElement("span");
    imageTrack.className = "menu-zone__image-track";
    imageTrack.append(createImage(zone.imagen));

    const zoneArrow = document.createElement("span");
    zoneArrow.className = "menu-zone__arrow";
    zoneArrow.setAttribute("aria-hidden", "true");
    zoneArrow.innerHTML = '<svg viewBox="0 0 30 18" fill="none"><path d="M2 9H28M20 1L28 9L20 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>';

    const label = document.createElement("span");
    label.className = "menu-zone__label";
    label.textContent = zone.nombre;
    button.append(imageTrack, zoneArrow, label);
    return button;
  });

  menuCards.replaceChildren(...cards);
}

function renderZoneInfo(zone) {
  setZoneInfoVisible();
  menuScreen.classList.remove("is-listing", "is-detail", "is-menu-home");
  menuScreen.classList.add("is-zone-info");
  menuScreen.setAttribute("aria-label", `Información de ${zone.nombre}`);
  zoneInfo.setAttribute("aria-label", `Información de ${zone.nombre}`);
  zoneInfoTitle.textContent = zone.nombreInformacion || zone.nombre;
  menuBack.href = "./menu.html";
  menuBack.removeAttribute("data-transition");
  menuNext.hidden = true;

  const paragraphs = (zone.informacion || []).map((text) => {
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    return paragraph;
  });
  zoneInfoDescription.replaceChildren(...paragraphs);
  zoneInfoDescription.scrollTop = 0;

  const videoUrl = assetUrl(zone.video || "assets/videos/demo-video.mp4");
  zoneInfoVideo.poster = assetUrl(zone.videoPoster || zone.imagen);
  if (zoneInfoVideo.src !== videoUrl) {
    zoneInfoVideo.src = videoUrl;
    zoneInfoVideo.load();
  }
  zoneInfoVideo.setAttribute("aria-label", `Video de la zona ${zone.nombre}`);
  void zoneInfoVideo.play().catch(() => {});
  window.requestAnimationFrame(updateZoneScrollIndicator);
  document.title = `${zone.nombreInformacion || zone.nombre} · SM Kaluz`;
}

function renderPlaceList(zone) {
  setMainSectionsVisible(true);
  menuScreen.classList.remove("is-detail", "is-menu-home", "is-zone-info");
  menuScreen.classList.add("is-listing");
  menuScreen.setAttribute("aria-label", `Ubicaciones de ${zone.nombre}`);
  menuHeading.textContent = zone.nombreInformacion || zone.nombre;
  menuBack.href = zoneHref(zone.id);
  menuBack.removeAttribute("data-transition");
  menuQuestionEnd.textContent = "sobre los recorridos de ésta zona?";
  menuRegistrationLink.href = `./registro.html?zona=${encodeURIComponent(zone.id)}`;
  menuRegister.hidden = true;
  menuActions.hidden = false;
  placeListZoneNavigation.hidden = false;
  menuRoutesTitle.innerHTML = "Encuentra estos<br />edificios en la ciudad.<br />¿Deseas información<br />sobre nuestras rutas<br />por esta zona?";
  menuRoutesLink.href = `./registro.html?zona=${encodeURIComponent(zone.id)}`;
  menuOpinionLink.href = `./opinion.html?zona=${encodeURIComponent(zone.id)}`;
  menuOpinionTitle.textContent = "Queremos escucharte";
  menuOpinionDetail.textContent = "Queremos mejorar tu experiencia. Compártenos tu opinión";

  const zoneIndex = orderedZones.findIndex((item) => item.id === zone.id);
  const previousZone = orderedZones[(zoneIndex - 1 + orderedZones.length) % orderedZones.length];
  const nextZone = orderedZones[(zoneIndex + 1) % orderedZones.length];
  menuNext.hidden = true;
  placeListPreviousZone.dataset.zone = previousZone.id;
  placeListNextZone.dataset.zone = nextZone.id;
  placeListPreviousZone.querySelector(".place-list__zone-label").textContent = previousZone.nombreInformacion || previousZone.nombre;
  placeListNextZone.querySelector(".place-list__zone-label").textContent = nextZone.nombreInformacion || nextZone.nombre;
  placeListZoneNavigation.hidden = orderedZones.length < 2;

  const places = placesInZone(zone.id);

  menuCards.className = "menu-zones is-place-list";
  menuCards.dataset.zone = zone.id;
  menuCards.setAttribute("aria-label", `Ubicaciones de ${zone.nombre}`);

  if (!places.length) {
    const empty = document.createElement("p");
    empty.className = "place-list__empty";
    empty.textContent = "No hay ubicaciones disponibles para esta zona.";
    menuCards.replaceChildren(empty);
    return;
  }

  const track = document.createElement("div");
  track.className = "place-list__track";
  track.style.setProperty("--visible-count", Math.min(5, places.length));

  for (const [index, place] of places.entries()) {
    const button = document.createElement("button");
    button.className = "place-card";
    button.type = "button";
    button.dataset.place = place.id;
    button.style.setProperty("--card-order", index);

    const imageTrack = document.createElement("span");
    imageTrack.className = "place-card__image-track";
    imageTrack.append(createImage(place.imagen || zone.imagen));

    const cardArrow = document.createElement("span");
    cardArrow.className = "place-card__arrow";
    cardArrow.setAttribute("aria-hidden", "true");
    cardArrow.innerHTML = '<svg viewBox="0 0 30 18" fill="none"><path d="M2 9H28M20 1L28 9L20 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>';

    const label = document.createElement("span");
    label.className = "place-card__label";
    if (place.nombreLineas?.length) {
      button.setAttribute("aria-label", place.nombre);
      for (const line of place.nombreLineas) {
        const labelLine = document.createElement("span");
        labelLine.className = "place-card__label-line";
        labelLine.textContent = line;
        label.append(labelLine);
      }
    } else {
      label.textContent = place.nombre;
    }
    button.append(imageTrack, cardArrow, label);
    track.append(button);
  }

  menuCards.replaceChildren(track);

  if (places.length > 5) {
    for (const [direction, symbol] of [["prev", "‹"], ["next", "›"]]) {
      const button = document.createElement("button");
      button.className = `place-list__scroll place-list__scroll--${direction}`;
      button.type = "button";
      button.setAttribute("aria-label", direction === "prev" ? "Ver ubicaciones anteriores" : "Ver más ubicaciones");
      button.textContent = symbol;
      button.addEventListener("click", () => {
        track.scrollBy({ left: direction === "prev" ? -556 : 556, behavior: "smooth" });
      });
      menuCards.append(button);
    }
  }
}

function renderPlaceDetail(zone, place) {
  closeGlossary(false);
  const listingIsReady = menuScreen.classList.contains("is-listing")
    && menuCards.dataset.zone === zone.id
    && menuCards.querySelector(".place-card");
  if (!listingIsReady) renderPlaceList(zone);

  const detailWasOpen = !placeDetail.hidden;
  menuScreen.classList.remove("is-menu-home", "is-zone-info");
  menuScreen.classList.add("is-detail");
  menuScreen.setAttribute("aria-label", `Detalle de ${place.nombre}`);
  placeDetail.setAttribute("aria-label", `Detalle de ${place.nombre}`);
  placeDetail.hidden = false;
  setListingInteractive(false);
  detailBack.href = zoneHref(zone.id, "places");
  detailImage.src = assetUrl(place.imagenDetalle || place.imagen || zone.imagen);
  detailImage.alt = place.imagenDetalle || place.imagen ? `Fotografía de ${place.nombre}` : `Imagen de la zona ${zone.nombre}`;
  detailTitle.textContent = place.nombre;
  const stateLabels = { existente: "Existente", desaparecido: "Desaparecido", sin_confirmar: "Sin confirmar" };
  detailState.textContent = `Estado: ${stateLabels[place.estado] || "Sin confirmar"}`;

  const paragraphs = [];
  let paragraph = document.createElement("p");
  for (const fragment of place.descripcion || []) {
    if (fragment.nuevoParrafo && paragraph.hasChildNodes()) {
      paragraphs.push(paragraph);
      paragraph = document.createElement("p");
    }
    if (fragment.terminoId && content.glosario[fragment.terminoId]) {
      const term = document.createElement("button");
      term.className = "place-detail__term";
      term.type = "button";
      term.dataset.term = fragment.terminoId;
      term.textContent = fragment.texto;
      term.setAttribute("aria-label", `${fragment.texto}: ver significado`);
      paragraph.append(term);
    } else {
      paragraph.append(document.createTextNode(fragment.texto));
    }
  }
  if (paragraph.hasChildNodes()) paragraphs.push(paragraph);
  detailDescription.replaceChildren(...paragraphs);
  detailDescription.scrollTop = 0;

  const places = placesInZone(zone.id);
  const index = places.findIndex((item) => item.id === place.id);
  const previousPlace = places[(index - 1 + places.length) % places.length];
  const nextPlace = places[(index + 1) % places.length];
  detailPrevious.disabled = places.length < 2;
  detailNext.disabled = places.length < 2;
  detailPrevious.dataset.place = previousPlace.id;
  detailNext.dataset.place = nextPlace.id;
  detailPrevious.querySelector("span").textContent = previousPlace.nombre;
  detailNext.querySelector("span").textContent = nextPlace.nombre;
  detailPrevious.setAttribute("aria-label", `Ver ${previousPlace.nombre}`);
  detailNext.setAttribute("aria-label", `Ver ${nextPlace.nombre}`);

  placeDetail.classList.remove("is-open", "is-closing", "is-switching");
  void placeDetail.offsetWidth;
  placeDetail.classList.add(detailWasOpen ? "is-switching" : "is-open");
  document.title = `${place.nombre} · SM Kaluz`;
}

function closePlaceDetail(zone) {
  placeDetail.hidden = true;
  placeDetail.classList.remove("is-open", "is-closing", "is-switching");
  menuScreen.classList.remove("is-detail");
  menuScreen.setAttribute("aria-label", `Ubicaciones de ${zone.nombre}`);
  setListingInteractive(true);
  document.title = `${zone.nombreInformacion || zone.nombre} · SM Kaluz`;
}

function showView(zoneId, placeId = null, zoneView = zoneId ? "info" : "menu", pushHistory = true) {
  const resolvedZoneView = placeId ? "places" : zoneView;
  if (
    currentZoneId === zoneId
    && currentPlaceId === placeId
    && currentZoneView === resolvedZoneView
    && !changingView
  ) return;
  const zone = orderedZones.find((item) => item.id === zoneId);
  if (zoneId && !zone) return;
  const place = placeId && content.ubicaciones.find((item) => item.id === placeId && item.zonaId === zoneId);
  if (placeId && !place) return;

  closeGlossary(false);
  window.clearTimeout(transitionTimer);
  changingView = true;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isModalTransition = Boolean(currentPlaceId || place);
  const isClosingDetail = Boolean(currentPlaceId && !place);
  const isClosingToCurrentListing = isClosingDetail
    && zone?.id === currentZoneId
    && resolvedZoneView === "places"
    && menuCards.dataset.zone === zone.id;

  if (!isModalTransition) menuScreen.classList.add("is-changing");
  if (isClosingDetail) placeDetail.classList.add("is-closing");

  transitionTimer = window.setTimeout(() => {
    currentZoneId = zoneId;
    currentPlaceId = placeId;
    currentZoneView = resolvedZoneView;
    if (place) renderPlaceDetail(zone, place);
    else if (isClosingToCurrentListing) closePlaceDetail(zone);
    else if (zone && resolvedZoneView === "places") renderPlaceList(zone);
    else if (zone) renderZoneInfo(zone);
    else renderMenu();
    if (!zone) document.title = "Explora las zonas · SM Kaluz";
    if (pushHistory) {
      window.history.pushState(
        { zoneId, placeId, zoneView: resolvedZoneView },
        "",
        viewHref(zoneId, placeId, resolvedZoneView),
      );
    }
    menuScreen.classList.remove("is-changing");
    changingView = false;
  }, reducedMotion ? 0 : isClosingDetail ? 360 : isModalTransition ? 0 : 320);
}

menuCards.addEventListener("click", (event) => {
  const zoneButton = event.target.closest(".menu-zone");
  if (zoneButton) {
    showView(zoneButton.dataset.zone, null, "info");
    return;
  }

  const placeButton = event.target.closest(".place-card");
  if (!placeButton) return;
  showView(currentZoneId, placeButton.dataset.place, "places");
});

menuBack.addEventListener("click", (event) => {
  if (!currentZoneId) return;
  event.preventDefault();
  if (currentZoneView === "places") showView(currentZoneId, null, "info");
  else showView(null, null, "menu");
});

menuNext.addEventListener("click", (event) => {
  event.preventDefault();
  showView(new URL(menuNext.href).searchParams.get("zona"), null, "places");
});

detailBack.addEventListener("click", (event) => {
  event.preventDefault();
  showView(currentZoneId, null, "places");
});

detailPrevious.addEventListener("click", () => {
  if (detailPrevious.dataset.place) showView(currentZoneId, detailPrevious.dataset.place, "places");
});
detailNext.addEventListener("click", () => {
  if (detailNext.dataset.place) showView(currentZoneId, detailNext.dataset.place, "places");
});

zoneInfoPlaces.addEventListener("click", () => {
  showView(currentZoneId, null, "places");
});

placeListZoneNavigation.addEventListener("click", (event) => {
  const zoneButton = event.target.closest(".place-list__zone-link");
  if (zoneButton?.dataset.zone) showView(zoneButton.dataset.zone, null, "places");
});

zoneInfoDescription.addEventListener("scroll", updateZoneScrollIndicator, { passive: true });
zoneInfoScrollUp.addEventListener("click", () => {
  zoneInfoDescription.scrollBy({ top: -190, behavior: "smooth" });
});
zoneInfoScrollDown.addEventListener("click", () => {
  zoneInfoDescription.scrollBy({ top: 190, behavior: "smooth" });
});

zoneInfoVideo.addEventListener("click", () => {
  if (zoneInfoVideo.paused) void zoneInfoVideo.play().catch(() => {});
  else zoneInfoVideo.pause();
});

function positionGlossary(trigger) {
  const stageRect = placeDetail.getBoundingClientRect();
  const termRect = trigger.getBoundingClientRect();
  const scale = stageRect.width / placeDetail.offsetWidth;
  const termLeft = (termRect.left - stageRect.left) / scale;
  const termRight = (termRect.right - stageRect.left) / scale;
  const termTop = (termRect.top - stageRect.top) / scale;
  const termCenterY = (termRect.top + termRect.bottom - 2 * stageRect.top) / (2 * scale);
  glossaryCutout.style.left = `${termLeft}px`;
  glossaryCutout.style.top = `${termTop}px`;
  glossaryCutout.style.width = `${termRect.width / scale}px`;
  glossaryCutout.style.height = `${termRect.height / scale}px`;
  const popupWidth = glossaryPopup.offsetWidth;
  const popupHeight = glossaryPopup.offsetHeight;
  const gap = 18;
  const margin = 24;
  const rightLeft = termRight + gap;
  const leftLeft = termLeft - gap - popupWidth;
  const useRight = rightLeft + popupWidth <= placeDetail.offsetWidth - margin || leftLeft < margin;
  const left = Math.max(margin, Math.min(useRight ? rightLeft : leftLeft, placeDetail.offsetWidth - popupWidth - margin));
  const top = Math.max(margin, Math.min(termCenterY - popupHeight / 2, placeDetail.offsetHeight - popupHeight - margin));
  glossaryPopup.style.left = `${left}px`;
  glossaryPopup.style.top = `${top}px`;
}

detailDescription.addEventListener("click", (event) => {
  const trigger = event.target.closest(".place-detail__term");
  if (!trigger) return;
  const entry = content.glosario[trigger.dataset.term];
  if (!entry) return;
  glossaryTrigger = trigger;
  trigger.classList.add("is-active");
  glossaryTitle.textContent = entry.titulo;
  glossaryDefinition.textContent = entry.significado;
  glossaryOverlay.hidden = false;
  positionGlossary(trigger);
  detailBody.inert = true;
  glossaryClose.focus();
});

function closeGlossary(restoreFocus = true) {
  if (glossaryOverlay.hidden) return;
  glossaryOverlay.hidden = true;
  glossaryTrigger?.classList.remove("is-active");
  detailBody.inert = false;
  if (restoreFocus && glossaryTrigger?.isConnected) glossaryTrigger.focus();
  glossaryTrigger = null;
}

glossaryClose.addEventListener("click", () => closeGlossary());
glossaryOverlay.addEventListener("click", (event) => {
  if (event.target === glossaryOverlay) closeGlossary();
});
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!glossaryOverlay.hidden) closeGlossary();
  else if (!placeDetail.hidden) showView(currentZoneId, null, "places");
});

window.addEventListener("popstate", () => {
  if (!content) return;
  const params = new URLSearchParams(window.location.search);
  const zoneId = params.get("zona");
  const placeId = params.get("lugar");
  const zoneView = params.get("vista") === "edificios" ? "places" : "info";
  const validZone = orderedZones.find((zone) => zone.id === zoneId);
  const validPlace = validZone && content.ubicaciones.find((place) => place.id === placeId && place.zonaId === zoneId);
  showView(validZone?.id || null, validPlace?.id || null, validZone ? zoneView : "menu", false);
});

async function loadMenuContent() {
  try {
    const response = await fetch("../data/content.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    content = await response.json();
    orderedZones = [...content.zonas].sort((a, b) => a.orden - b.orden);
    if (!orderedZones.length) throw new Error("No hay zonas disponibles");

    const params = new URLSearchParams(window.location.search);
    const requestedZoneId = params.get("zona");
    const requestedPlaceId = params.get("lugar");
    const requestedZoneView = params.get("vista") === "edificios" ? "places" : "info";
    const zone = orderedZones.find((item) => item.id === requestedZoneId);
    const place = zone && content.ubicaciones.find((item) => item.id === requestedPlaceId && item.zonaId === zone.id);
    if ((requestedZoneId && !zone) || (requestedPlaceId && !place)) {
      window.history.replaceState(null, "", viewHref(zone?.id || null, null, zone ? requestedZoneView : "menu"));
    }
    currentZoneId = zone?.id || null;
    currentPlaceId = place?.id || null;
    currentZoneView = place ? "places" : zone ? requestedZoneView : "menu";
    if (place) renderPlaceDetail(zone, place);
    else if (zone && requestedZoneView === "places") renderPlaceList(zone);
    else if (zone) renderZoneInfo(zone);
    else renderMenu();

    const visibleImages = Array.from(menuScreen.querySelectorAll("img")).filter((image) => (
      image.src && !image.closest("[hidden]")
    ));
    const rivannaReady = document.fonts
      ? document.fonts.load('60px "Rivanna NF"').catch(() => [])
      : Promise.resolve();
    await Promise.all([
      rivannaReady,
      ...visibleImages.map(waitForImage),
    ]);
  } catch (error) {
    menuCards.className = "menu-zones is-place-list";
    const message = document.createElement("p");
    message.className = "place-list__empty";
    message.textContent = "No se pudo cargar el contenido. Toca para reintentar.";
    const retry = document.createElement("button");
    retry.className = "place-list__retry";
    retry.type = "button";
    retry.textContent = "Reintentar";
    retry.addEventListener("click", () => window.location.reload());
    menuCards.replaceChildren(message, retry);
    console.error("Error al cargar el contenido del menú:", error);
  } finally {
    menuCards.setAttribute("aria-busy", "false");
    menuScreen.classList.remove("is-loading");
  }
}

loadMenuContent();
