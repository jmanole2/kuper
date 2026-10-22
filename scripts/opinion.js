const opinionForm = document.querySelector(".opinion-form");
const opinionBack = document.querySelector(".opinion-back");
const opinionStatus = document.querySelector(".opinion-status");
const opinionViewport = document.querySelector(".opinion-fields__viewport");
const opinionScrollTrack = document.querySelector(".opinion-scroll__track");
const opinionScrollThumb = document.querySelector(".opinion-scroll__thumb");
const opinionScrollUp = document.querySelector(".opinion-scroll__button--up");
const opinionScrollDown = document.querySelector(".opinion-scroll__button--down");
const keyboardContainer = document.querySelector(".opinion-keyboard");
const opinionFields = Array.from(document.querySelectorAll(".opinion-field input, .opinion-field textarea"));
const opinionControls = Array.from(document.querySelectorAll(".opinion-field input, .opinion-field select, .opinion-field textarea, .opinion-privacy input"));
const opinionTypes = Array.from(document.querySelectorAll('input[name="tipo"]'));
const countrySelect = document.querySelector('select[name="pais"]');
const genderSelect = document.querySelector('select[name="genero"]');
const privacyInput = document.querySelector('input[name="privacidad"]');
const privacyTrigger = document.querySelector(".opinion-privacy__link");
const privacyModal = document.querySelector(".privacy-modal");
const privacyClose = document.querySelector(".privacy-modal__close");
const privacyContent = document.querySelector(".privacy-modal__content");
const privacyScrollTrack = document.querySelector(".privacy-modal__scroll-track");
const privacyScrollThumb = document.querySelector(".privacy-modal__scroll-thumb");
const privacyScrollUp = document.querySelector(".privacy-modal__scroll-button--up");
const privacyScrollDown = document.querySelector(".privacy-modal__scroll-button--down");
const privacyBackground = Array.from(document.querySelectorAll(".opinion-back, .opinion-intro, .opinion-notice, .opinion-form, .opinion-keyboard"));

const zoneId = new URLSearchParams(window.location.search).get("zona");
if (zoneId) opinionBack.href = `./menu.html?zona=${encodeURIComponent(zoneId)}&vista=edificios`;

const countries = `Afganistán
Albania
Alemania
Andorra
Angola
Antigua y Barbuda
Arabia Saudita
Argelia
Argentina
Armenia
Australia
Austria
Azerbaiyán
Bahamas
Bangladés
Barbados
Baréin
Bélgica
Belice
Benín
Bielorrusia
Birmania
Bolivia
Bosnia y Herzegovina
Botsuana
Brasil
Brunéi
Bulgaria
Burkina Faso
Burundi
Bután
Cabo Verde
Camboya
Camerún
Canadá
Catar
Chad
Chile
China
Chipre
Ciudad del Vaticano
Colombia
Comoras
Corea del Norte
Corea del Sur
Costa de Marfil
Costa Rica
Croacia
Cuba
Dinamarca
Dominica
Ecuador
Egipto
El Salvador
Emiratos Árabes Unidos
Eritrea
Eslovaquia
Eslovenia
España
Estados Unidos
Estonia
Etiopía
Filipinas
Finlandia
Fiyi
Francia
Gabón
Gambia
Georgia
Ghana
Granada
Grecia
Guatemala
Guyana
Guinea
Guinea ecuatorial
Guinea-Bisáu
Haití
Honduras
Hungría
India
Indonesia
Irak
Irán
Irlanda
Islandia
Islas Marshall
Islas Salomón
Israel
Italia
Jamaica
Japón
Jordania
Kazajistán
Kenia
Kirguistán
Kiribati
Kuwait
Laos
Lesoto
Letonia
Líbano
Liberia
Libia
Liechtenstein
Lituania
Luxemburgo
Madagascar
Malasia
Malaui
Maldivas
Malí
Malta
Marruecos
Mauricio
Mauritania
México
Micronesia
Moldavia
Mónaco
Mongolia
Montenegro
Mozambique
Namibia
Nauru
Nepal
Nicaragua
Níger
Nigeria
Noruega
Nueva Zelanda
Omán
Países Bajos
Pakistán
Palaos
Panamá
Papúa Nueva Guinea
Paraguay
Perú
Polonia
Portugal
Reino Unido
República Centroafricana
República Checa
República de Macedonia
República del Congo
República Democrática del Congo
República Dominicana
República Sudafricana
Ruanda
Rumanía
Rusia
Samoa
San Cristóbal y Nieves
San Marino
San Vicente y las Granadinas
Santa Lucía
Santo Tomé y Príncipe
Senegal
Serbia
Seychelles
Sierra Leona
Singapur
Siria
Somalia
Sri Lanka
Suazilandia
Sudán
Sudán del Sur
Suecia
Suiza
Surinam
Tailandia
Tanzania
Tayikistán
Timor Oriental
Togo
Tonga
Trinidad y Tobago
Túnez
Turkmenistán
Turquía
Tuvalu
Ucrania
Uganda
Uruguay
Uzbekistán
Vanuatu
Venezuela
Vietnam
Yemen
Yibuti
Zambia
Zimbabue
Canarias
Indias Orientales Irlandesas
Londres
Holanda
Inglaterra`.split("\n");

countrySelect.append(...countries.map((country) => {
  const option = document.createElement("option");
  option.value = country;
  option.textContent = country;
  return option;
}));

const icon = (paths) => `<svg viewBox="0 0 48 48" fill="none" aria-hidden="true">${paths}</svg>`;
const keyIcons = {
  backspace: icon('<path d="M19 10H41V38H19L6 24L19 10Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M25 19L35 29M35 19L25 29" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'),
  enter: icon('<path d="M39 13V25C39 29 36 32 32 32H10M10 32L18 24M10 32L18 40" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'),
  shift: icon('<path d="M24 6L43 27H34V42H14V27H5L24 6Z" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>'),
  globe: '<img src="../assets/images/registration/globe.png" alt="" width="53" height="53">',
  microphone: icon('<rect x="18" y="5" width="12" height="26" rx="6" stroke="currentColor" stroke-width="2.5"/><path d="M12 22V25C12 31.6 17.4 37 24 37C30.6 37 36 31.6 36 25V22M24 37V43M17 43H31" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'),
  hide: icon('<rect x="5" y="8" width="38" height="26" rx="2" stroke="currentColor" stroke-width="2.5"/><path d="M11 15H15M19 15H23M27 15H31M35 15H39M11 22H15M19 22H23M27 22H31M35 22H39M16 29H32M19 40L24 44L29 40" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>')
};

const letters = {
  en: [
    "q w e r t y u i o p {bksp}",
    "a s d f g h j k l {enter}",
    "{shift} z x c v b n m ; : {shift}",
    "{numbers} {globe} {microphone} {space} {numbers} {hide}"
  ],
  es: [
    "q w e r t y u i o p {bksp}",
    "a s d f g h j k l {enter}",
    "{shift} z x c v b n m ; ñ {shift}",
    "{numbers} {globe} {microphone} {space} {numbers} {hide}"
  ]
};

const layout = {
  en: letters.en,
  "en-shift": letters.en.map((row) => row.split(" ").map((key) => key.length === 1 ? key.toUpperCase() : key).join(" ")),
  es: letters.es,
  "es-shift": letters.es.map((row) => row.split(" ").map((key) => key.length === 1 ? key.toUpperCase() : key).join(" ")),
  symbols: [
    "1 2 3 4 5 6 7 8 9 0 {bksp}",
    "@ # € & * ( ) ' \" {enter}",
    "{shift} % - + = / ; : ! . {shift}",
    "{letters} {globe} {microphone} {space} {letters} {hide}"
  ]
};

const keyGeometry = [
  { top: 30, keys: Array.from({ length: 11 }, (_, index) => [33 + index * 128.918, 108.125]) },
  { top: 112.142, keys: [[85.6763, 106.739], [213.208, 106.739], [340.74, 106.739], [468.272, 106.739], [595.111, 107.432], [722.643, 106.739], [850.175, 106.739], [977.707, 106.739], [1105.24, 106.739], [1232.77, 197.536]] },
  { top: 194.284, keys: [[33, 104.659], [158.453, 105.353], [284.598, 105.353], [410.744, 104.659], [536.197, 104.659], [661.649, 104.659], [787.102, 104.659], [912.555, 105.353], [1038.7, 104.659], [1164.15, 104.659], [1289.61, 140.701]] },
  { top: 276.426, keys: [[33, 104.659], [158.453, 105.353], [284.598, 105.353], [410.744, 643.898], [1075.44, 167.039], [1263.27, 167.039]] }
];

const alternateLabels = {
  q: "1", w: "2", e: "3", r: "4", t: "5", y: "6", u: "7", i: "8", o: "9", p: "0",
  a: "@", s: "#", d: "€", f: "&", g: "*", h: "(", j: ")", k: "'", l: '"',
  z: "%", x: "-", c: "+", v: "=", b: "/", n: ";", m: ":", ";": "!", ":": "?"
};

let activeInput = opinionFields[0];
let language = "en";
let shifted = false;
let symbolsVisible = false;
let keyboard;
let privacyLastFocus;

function currentLayoutName() {
  return symbolsVisible ? "symbols" : `${language}${shifted ? "-shift" : ""}`;
}

function updateStatus(message = "") {
  opinionStatus.textContent = message;
}

function updateScrollIndicator() {
  const maxScroll = Math.max(0, opinionViewport.scrollHeight - opinionViewport.clientHeight);
  const trackHeight = opinionScrollTrack.clientHeight;
  const thumbHeight = maxScroll ? Math.min(trackHeight, 150) : trackHeight;
  const availableTravel = Math.max(0, trackHeight - thumbHeight);
  const thumbOffset = maxScroll ? (opinionViewport.scrollTop / maxScroll) * availableTravel : 0;

  opinionScrollThumb.style.height = `${thumbHeight}px`;
  opinionScrollThumb.style.setProperty("--opinion-scroll-offset", `${thumbOffset}px`);
}

function updatePrivacyScrollIndicator() {
  const maxScroll = Math.max(0, privacyContent.scrollHeight - privacyContent.clientHeight);
  const trackHeight = privacyScrollTrack.clientHeight;
  const proportionalHeight = privacyContent.scrollHeight
    ? (privacyContent.clientHeight / privacyContent.scrollHeight) * trackHeight
    : trackHeight;
  const thumbHeight = maxScroll ? Math.max(80, proportionalHeight) : trackHeight;
  const availableTravel = Math.max(0, trackHeight - thumbHeight);
  const thumbOffset = maxScroll ? (privacyContent.scrollTop / maxScroll) * availableTravel : 0;

  privacyScrollThumb.style.height = `${thumbHeight}px`;
  privacyScrollThumb.style.setProperty("--privacy-scroll-offset", `${thumbOffset}px`);
}

function openPrivacyModal() {
  if (!privacyModal.hidden) return;
  privacyLastFocus = document.activeElement;
  privacyModal.hidden = false;
  privacyContent.scrollTop = 0;
  for (const element of privacyBackground) element.inert = true;
  window.requestAnimationFrame(() => {
    updatePrivacyScrollIndicator();
    privacyModal.focus({ preventScroll: true });
  });
}

function closePrivacyModal() {
  if (privacyModal.hidden) return;
  privacyModal.hidden = true;
  for (const element of privacyBackground) element.inert = false;
  if (privacyLastFocus?.isConnected) privacyLastFocus.focus();
  privacyLastFocus = null;
}

function ensureFieldVisible(control) {
  const field = control.closest(".opinion-field") || control.closest(".opinion-privacy");
  const fieldTop = field.offsetTop;
  const fieldBottom = fieldTop + field.offsetHeight;
  const visibleTop = opinionViewport.scrollTop;
  const visibleBottom = visibleTop + opinionViewport.clientHeight;

  if (fieldTop < visibleTop) opinionViewport.scrollTo({ top: fieldTop, behavior: "smooth" });
  else if (fieldBottom > visibleBottom) opinionViewport.scrollTo({ top: fieldBottom - opinionViewport.clientHeight, behavior: "smooth" });
}

function syncCaretFromInput() {
  if (typeof activeInput.selectionStart === "number") {
    keyboard.setCaretPosition(activeInput.selectionStart, activeInput.selectionEnd);
  }
}

function activateInput(input) {
  activeInput = input;
  keyboardContainer.classList.remove("is-hidden");
  const useSymbols = input.name === "edad";
  if (symbolsVisible !== useSymbols) {
    symbolsVisible = useSymbols;
    shifted = false;
  }
  keyboard.setOptions({ inputName: input.name, layoutName: currentLayoutName() });
  keyboard.setInput(input.value, input.name);
  syncCaretFromInput();
  ensureFieldVisible(input);
}

function updateInput(value) {
  activeInput.value = value;
  const caret = keyboard.getCaretPosition();
  const caretEnd = keyboard.getCaretPositionEnd();
  if (typeof caret === "number") activeInput.setSelectionRange(caret, typeof caretEnd === "number" ? caretEnd : caret);
  updateStatus();
}

function focusNextField() {
  const index = opinionControls.indexOf(activeInput);
  if (index < opinionControls.length - 1) opinionControls[index + 1].focus();
  else opinionForm.requestSubmit();
}

function handleKeyPress(button) {
  if (button === "{numbers}") {
    symbolsVisible = true;
    keyboard.setOptions({ layoutName: currentLayoutName() });
  } else if (button === "{letters}") {
    symbolsVisible = false;
    keyboard.setOptions({ layoutName: currentLayoutName() });
  } else if (button === "{globe}") {
    language = language === "en" ? "es" : "en";
    keyboard.setOptions({ layoutName: currentLayoutName() });
  } else if (button === "{shift}") {
    if (symbolsVisible) return;
    shifted = !shifted;
    keyboard.setOptions({ layoutName: currentLayoutName() });
  } else if (button === "{hide}") {
    keyboardContainer.classList.add("is-hidden");
    activeInput.blur();
  } else if (button === "{microphone}") {
    updateStatus("El dictado por voz no está disponible en este kiosco.");
  } else if (button === "{enter}") {
    focusNextField();
  } else if (shifted && !symbolsVisible && button.length === 1) {
    shifted = false;
    keyboard.setOptions({ layoutName: currentLayoutName() });
  }
}

function labelKeys() {
  keyboardContainer.classList.toggle("is-reference-layout", !symbolsVisible);
  keyboardContainer.classList.toggle("is-spanish-layout", !symbolsVisible && language === "es");
  keyboardContainer.classList.toggle("is-shifted-layout", !symbolsVisible && shifted);
  const keyNames = {
    "{bksp}": "Borrar",
    "{enter}": "Siguiente campo o enviar",
    "{shift}": "Mayúsculas",
    "{numbers}": "Mostrar números y símbolos",
    "{letters}": "Mostrar letras",
    "{globe}": `Cambiar idioma. Actual: ${language === "en" ? "inglés" : "español"}`,
    "{space}": "Espacio",
    "{microphone}": "Entrada por voz no disponible",
    "{hide}": "Ocultar teclado"
  };

  keyboardContainer.querySelectorAll(".hg-row").forEach((row, rowIndex) => {
    const geometry = keyGeometry[rowIndex];
    row.style.top = `${geometry.top}px`;
    row.querySelectorAll(".hg-button").forEach((key, keyIndex) => {
      const [left, width] = geometry.keys[keyIndex];
      key.style.left = `${left}px`;
      key.style.width = `${width}px`;
    });
  });

  keyboardContainer.querySelectorAll(".hg-button").forEach((key) => {
    key.type = "button";
    const value = key.dataset.skbtn;
    key.setAttribute("aria-label", keyNames[value] || value);
    key.removeAttribute("data-alt");
    if (!symbolsVisible && alternateLabels[value.toLowerCase()]) key.dataset.alt = alternateLabels[value.toLowerCase()];
  });
}

if (!window.SimpleKeyboard?.default) {
  updateStatus("No se pudo cargar el teclado. Puedes usar un teclado físico.");
} else {
  keyboard = new window.SimpleKeyboard.default(".opinion-keyboard", {
    inputName: activeInput.name,
    layout,
    layoutName: currentLayoutName(),
    display: {
      "{bksp}": keyIcons.backspace,
      "{enter}": keyIcons.enter,
      "{shift}": keyIcons.shift,
      "{numbers}": "?123",
      "{letters}": "ABC",
      "{globe}": keyIcons.globe,
      "{space}": " ",
      "{microphone}": keyIcons.microphone,
      "{hide}": keyIcons.hide
    },
    theme: "hg-theme-default kaluz-keyboard",
    useButtonTag: true,
    preventMouseDownDefault: true,
    updateCaretOnSelectionChange: true,
    maxLength: Object.fromEntries(opinionFields.map((input) => [input.name, input.maxLength])),
    onChange: updateInput,
    onKeyPress: handleKeyPress,
    onRender: labelKeys
  });
}

for (const input of opinionFields) {
  input.addEventListener("focus", () => {
    if (keyboard) activateInput(input);
  });
  input.addEventListener("input", () => {
    updateStatus();
    if (!keyboard) return;
    if (activeInput !== input) activeInput = input;
    keyboard.setOptions({ inputName: input.name });
    keyboard.setInput(input.value, input.name);
    syncCaretFromInput();
  });
  input.addEventListener("click", () => {
    if (keyboard) syncCaretFromInput();
  });
}

for (const select of [countrySelect, genderSelect]) {
  select.addEventListener("focus", () => {
    keyboardContainer.classList.add("is-hidden");
    ensureFieldVisible(select);
  });
  select.addEventListener("change", () => {
    updateStatus();
    const index = opinionControls.indexOf(select);
    const nextControl = opinionControls[index + 1];
    if (nextControl) nextControl.focus();
  });
}

privacyInput.addEventListener("focus", () => {
  keyboardContainer.classList.add("is-hidden");
  ensureFieldVisible(privacyInput);
});
privacyInput.addEventListener("change", () => updateStatus());

privacyTrigger.addEventListener("click", openPrivacyModal);
privacyClose.addEventListener("click", closePrivacyModal);
privacyModal.addEventListener("click", (event) => {
  if (event.target === privacyModal) closePrivacyModal();
});
privacyContent.addEventListener("scroll", updatePrivacyScrollIndicator, { passive: true });
privacyScrollUp.addEventListener("click", () => privacyContent.scrollBy({ top: -520, behavior: "smooth" }));
privacyScrollDown.addEventListener("click", () => privacyContent.scrollBy({ top: 520, behavior: "smooth" }));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !privacyModal.hidden) closePrivacyModal();
});

for (const input of opinionTypes) input.addEventListener("change", () => updateStatus());

opinionViewport.addEventListener("scroll", updateScrollIndicator, { passive: true });
opinionScrollUp.addEventListener("click", () => opinionViewport.scrollBy({ top: -180, behavior: "smooth" }));
opinionScrollDown.addEventListener("click", () => opinionViewport.scrollBy({ top: 180, behavior: "smooth" }));
window.addEventListener("resize", () => {
  updateScrollIndicator();
  if (!privacyModal.hidden) updatePrivacyScrollIndicator();
});
window.requestAnimationFrame(updateScrollIndicator);

const opinionSubmit = opinionForm.querySelector(".opinion-submit");
const opinionSubmission = window.kaluzForms
  ? window.kaluzForms.createSubmission("api/opiniones/")
  : null;

// Si la persona corrige los datos después de un intento fallido, se trata de un envío nuevo.
opinionForm.addEventListener("input", () => opinionSubmission?.reset());
opinionForm.addEventListener("change", () => opinionSubmission?.reset());

function clearOpinionForm() {
  opinionForm.reset();
  if (keyboard) {
    for (const input of opinionFields) keyboard.setInput("", input.name);
  }
  updateScrollIndicator();
}

opinionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const type = opinionTypes.find((input) => input.checked);
  const values = Object.fromEntries(opinionFields.map((input) => [input.name, input.value.trim()]));

  if (!type) {
    updateStatus("Selecciona si se trata de una felicitación, solicitud o queja.");
    opinionTypes[0].focus();
    return;
  }
  if (values.nombre.length < 2) {
    updateStatus("Escribe tu nombre.");
    opinionFields[0].focus();
    return;
  }
  if (values.apellido_paterno.length < 2) {
    updateStatus("Escribe tu apellido paterno.");
    opinionFields[1].focus();
    return;
  }
  if (!countrySelect.value) {
    updateStatus("Selecciona tu lugar de residencia.");
    countrySelect.focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(values.correo)) {
    updateStatus("Escribe un correo electrónico válido.");
    opinionFields[3].focus();
    return;
  }
  const age = Number(values.edad);
  if (!/^\d{1,3}$/u.test(values.edad) || age < 1 || age > 120) {
    updateStatus("Escribe una edad válida.");
    opinionFields[4].focus();
    return;
  }
  if (!genderSelect.value) {
    updateStatus("Selecciona una opción de género.");
    genderSelect.focus();
    return;
  }
  if (values.comentario.length < 5) {
    updateStatus("Escribe tu comentario.");
    opinionFields[5].focus();
    return;
  }
  if (!privacyInput.checked) {
    updateStatus("Acepta el aviso de privacidad para continuar.");
    privacyInput.focus();
    return;
  }

  if (!opinionSubmission) {
    updateStatus("Por ahora no podemos completar el envío. Tu opinión no se ha enviado.");
    return;
  }

  opinionSubmit.disabled = true;
  updateStatus("Enviando…");

  const result = await opinionSubmission.send({
    tipo: type.value,
    nombre: values.nombre,
    apellido_paterno: values.apellido_paterno,
    apellido_materno: values.apellido_materno,
    pais: countrySelect.value,
    correo: values.correo,
    edad: age,
    genero: genderSelect.value,
    comentario: values.comentario,
    privacidad: privacyInput.checked
  });

  opinionSubmit.disabled = false;

  if (result.busy) return;

  if (result.ok) {
    clearOpinionForm();
    updateStatus("¡Gracias! Recibimos tu opinión.");
    return;
  }

  updateStatus(result.invalid && result.message
    ? result.message
    : "No pudimos enviar tu opinión. Inténtalo de nuevo en un momento.");
});
