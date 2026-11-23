// Números escritos con palabras → cifras, para leer las transcripciones de las llamadas:
// "cincuenta y cinco, cuarenta y nueve, treinta" → "55, 49, 30"; "mil quinientos pesos" → "1500 pesos".
// (La asistente de voz dice los números con palabras para pronunciarlos bien; en el panel se leen mejor en cifras.)
const VAL = {
  cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiun: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800,
  novecientos: 900, novecientas: 900,
};
const nivel = (v) => (v >= 100 ? 3 : v >= 20 && v % 10 === 0 ? 2 : 1); // centenas, decenas "redondas", unidades (y 11–29)
const base = (w) => w.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ARTICULOS = new Set(['un', 'una', 'uno']);

function formato(n) { return n >= 10000 ? n.toLocaleString('en-US') : String(n); }

/** Convierte en el texto cada secuencia de números escritos con palabras. Lo demás queda igual. */
export function numerosEnCifras(texto) {
  const s = String(texto ?? '');
  if (!s) return s;
  // Palabras (con acentos) y todo lo que hay entre ellas.
  const partes = s.split(/([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/);
  const out = [];
  let i = 0;
  while (i < partes.length) {
    const w = partes[i];
    const k = i % 2 === 1 ? base(w) : null;
    const porCiento = k === 'ciento' && i >= 2 && base(partes[i - 2]) === 'por'; // "cien por ciento"
    const esNumero = !porCiento && k !== null && (k in VAL || k === 'mil' || k === 'millon' || k === 'millones');
    if (!esNumero) { out.push(w); i++; continue; }
    // Junta una corrida de palabras-número separadas solo por espacios (y "y" entre decena y unidad).
    let total = 0, actual = 0, ultimo = 9, palabras = 0, j = i, fin = i;
    const numeros = [];
    const cerrar = () => { if (palabras) numeros.push({ valor: total + actual, palabras }); total = 0; actual = 0; ultimo = 9; palabras = 0; };
    for (;;) {
      const kk = base(partes[j]);
      if (kk === 'mil') { total += (actual || 1) * 1000; actual = 0; ultimo = 4; palabras++; }
      else if (kk === 'millon' || kk === 'millones') { total = (total + (actual || 1)) * 1_000_000; actual = 0; ultimo = 5; palabras++; }
      else {
        const v = VAL[kk], nv = nivel(v);
        if (palabras && ultimo !== 4 && ultimo !== 5 && nv >= ultimo) cerrar(); // "veinte treinta" son dos números
        if (palabras && actual >= 100 && v >= 100) cerrar();
        actual += v; ultimo = nv; palabras++;
      }
      fin = j;
      // ¿Sigue la corrida? Solo espacios entre palabras; "y" únicamente entre una decena y una unidad.
      const sep = partes[j + 1], sig = partes[j + 2] !== undefined ? base(partes[j + 2]) : null;
      if (sep === undefined || sig === null) break;
      if (/^\s+$/.test(sep) && (sig in VAL || sig === 'mil' || sig === 'millon' || sig === 'millones')) { j += 2; continue; } // el corte entre números lo decide el nivel
      if (/^\s+$/.test(sep) && sig === 'y' && ultimo === 2 && /^\s+$/.test(partes[j + 3] || '') && partes[j + 4] !== undefined) {
        const u = base(partes[j + 4]);
        if (u in VAL && VAL[u] >= 1 && VAL[u] <= 9) { j += 4; actual += VAL[u]; ultimo = 1; fin = j; palabras++;
          const sep2 = partes[j + 1], sig2 = partes[j + 2] !== undefined ? base(partes[j + 2]) : null;
          if (sep2 !== undefined && /^\s+$/.test(sep2) && sig2 !== null && (sig2 in VAL || sig2 === 'mil' || sig2 === 'millon' || sig2 === 'millones')) { j += 2; continue; }
          break; }
      }
      break;
    }
    cerrar();
    // Un "un/una/uno" suelto es artículo ("una cita"), no número.
    if (numeros.length === 1 && numeros[0].palabras === 1 && ARTICULOS.has(k)) { out.push(w); i++; continue; }
    // Dígitos sueltos seguidos ("cero cuatro") van juntos: "04".
    let txt = '';
    numeros.forEach((n, x) => { const digito = n.palabras === 1 && n.valor <= 9, prevDig = x > 0 && numeros[x - 1].palabras === 1 && numeros[x - 1].valor <= 9; txt += (x === 0 || (digito && prevDig) ? '' : ' ') + formato(n.valor); });
    out.push(txt);
    i = fin + 1;
  }
  return out.join('');
}
