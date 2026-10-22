const registrationForm = document.querySelector(".registration-form");
const registrationBack = document.querySelector(".registration-back");
const registrationName = document.querySelector("#registration-name");
const registrationEmail = document.querySelector("#registration-email");
const registrationStatus = document.querySelector(".registration-status");
const keyboardContainer = document.querySelector(".registration-keyboard");
const routeInputs = Array.from(document.querySelectorAll('input[name="recorridos"]'));

const zoneId = new URLSearchParams(window.location.search).get("zona");
if (zoneId) {
  registrationBack.href = `./menu.html?zona=${encodeURIComponent(zoneId)}&vista=edificios`;
  const currentRoute = routeInputs.find((input) => input.value === zoneId);
  if (currentRoute) currentRoute.checked = true;
}

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

// Exact key bounds from the exported 1454 × 390 Figma keyboard.
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

let activeInput = registrationName;
let language = "en";
let shifted = false;
let symbolsVisible = false;
let keyboard;

function currentLayoutName() {
  return symbolsVisible ? "symbols" : `${language}${shifted ? "-shift" : ""}`;
}

function showKeyboard() {
  keyboardContainer.classList.remove("is-hidden");
}

function updateStatus(message = "") {
  registrationStatus.textContent = message;
}

function syncCaretFromInput() {
  if (typeof activeInput.selectionStart === "number") {
    keyboard.setCaretPosition(activeInput.selectionStart, activeInput.selectionEnd);
  }
}

function activateInput(input) {
  activeInput = input;
  showKeyboard();
  keyboard.setOptions({ inputName: input.name });
  keyboard.setInput(input.value, input.name);
  syncCaretFromInput();
}

function updateInput(value) {
  activeInput.value = value;
  const caret = keyboard.getCaretPosition();
  const caretEnd = keyboard.getCaretPositionEnd();
  if (typeof caret === "number") activeInput.setSelectionRange(caret, typeof caretEnd === "number" ? caretEnd : caret);
  updateStatus();
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
    if (activeInput === registrationName) registrationEmail.focus();
    else registrationForm.requestSubmit();
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
  keyboard = new window.SimpleKeyboard.default(".registration-keyboard", {
    inputName: registrationName.name,
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
    maxLength: { nombre: registrationName.maxLength, email: registrationEmail.maxLength },
    onChange: updateInput,
    onKeyPress: handleKeyPress,
    onRender: labelKeys
  });
}

for (const input of [registrationName, registrationEmail]) {
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

const registrationSubmit = registrationForm.querySelector(".registration-submit");
const registrationSubmission = window.kaluzForms
  ? window.kaluzForms.createSubmission("api/registros/")
  : null;

// Si la persona corrige los datos después de un intento fallido, se trata de un envío nuevo.
registrationForm.addEventListener("input", () => registrationSubmission?.reset());
registrationForm.addEventListener("change", () => registrationSubmission?.reset());

function clearRegistrationForm() {
  registrationForm.reset();
  for (const input of [registrationName, registrationEmail]) {
    if (keyboard) keyboard.setInput("", input.name);
  }
  if (zoneId) {
    const currentRoute = routeInputs.find((input) => input.value === zoneId);
    if (currentRoute) currentRoute.checked = true;
  }
}

registrationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = registrationName.value.trim();
  const email = registrationEmail.value.trim();
  if (name.length < 2) {
    updateStatus("Escribe tu nombre completo.");
    registrationName.focus();
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    updateStatus("Escribe un correo electrónico válido.");
    registrationEmail.focus();
    return;
  }
  if (!routeInputs.some((input) => input.checked)) {
    updateStatus("Selecciona al menos un recorrido.");
    routeInputs[0].focus();
    return;
  }
  if (!registrationSubmission) {
    updateStatus("Por ahora no podemos completar el registro. Tus datos no se han enviado.");
    return;
  }

  registrationSubmit.disabled = true;
  updateStatus("Enviando…");

  const result = await registrationSubmission.send({
    nombre: name,
    correo: email,
    recorridos: routeInputs.filter((input) => input.checked).map((input) => input.value)
  });

  registrationSubmit.disabled = false;

  if (result.busy) return;

  if (result.ok) {
    clearRegistrationForm();
    updateStatus(result.queued
      ? "¡Gracias! Tu registro quedó guardado y se enviará en unos momentos."
      : "¡Gracias! Te enviaremos información de los recorridos.");
    return;
  }

  updateStatus(result.invalid && result.message
    ? result.message
    : "No pudimos enviar tu registro. Inténtalo de nuevo en un momento.");
});
