'use strict';
/* =============================================================================
   OÍDO DE LA FURGONETA — interfaz
   DATOS viene de datos.js (copiado de la web) y Detector de detector.js.
   ========================================================================== */
const NUM_SONIDOS = 38;
const RAREZAS = ['', 'Común', 'Poco común', 'Raro', 'Épico', 'Legendario', 'Mítico'];
const MITICO = 6; // "rojo"
const ESCENARIO_INICIAL = { mapa: 'Estación de TV · Confinamiento', tipo: 100022, precio: 70000 };
const MAX_HISTORIAL = 8;
const TAMANOS = ['1x1', '1x2', '2x1', '2x2', '2x3', '3x2'];

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmt(n) {
  if (!Number.isFinite(n)) return '—';
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '−' : '') + s;
}
function fmtCorto(n) {
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2).replace('.', ',') + ' M';
  if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + ' K';
  return String(Math.round(n));
}
const pct = p => (p >= 0.995 || p === 0 ? Math.round(p * 100) : p < 0.01 ? '<1' : (p * 100).toFixed(p < 0.1 ? 1 : 0).replace('.', ',')) + ' %';
const signo = n => (n > 0 ? '+' : '') + fmt(n);
const almacen = {
  leer(k, d) { try { const v = localStorage.getItem('oido:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  guardar(k, v) { try { localStorage.setItem('oido:' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
};
const mensaje = txt => { $('#mensaje').textContent = txt; };

/* ---------- modelo (igual que en la web) ---------- */
const OBJETOS = DATOS.objetos.map(o => ({ id: o[0], nombre: o[1], original: o[2], rareza: o[3], tamano: `${o[4]}x${o[5]}`, categoria: o[6], mercado: o[7], contacto: o[8], sonido: o[9] }));
const REPARTOS = DATOS.repartos.map(r => ({ perfil: r[0], tipo: r[1], precio: r[2], peso: r[3], objetos: r[5] }));
const nombreTipo = t => DATOS.tipos[t] ?? String(t);
const MAPAS = (() => {
  const l = [];
  DATOS.perfiles.forEach(p => {
    if (p.conocido) p.mapas.forEach(m => l.push({ etiqueta: m, perfil: p.id }));
    else l.push({ etiqueta: `Perfil ${p.id} (sin identificar)`, perfil: p.id });
  });
  return l.sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'));
})();
const perfilDe = etiqueta => MAPAS.find(m => m.etiqueta === etiqueta)?.perfil ?? null;
const repartosDe = ({ perfil = null, tipo = null, precio = null } = {}) =>
  REPARTOS.filter(r => (!perfil || r.perfil === perfil) && (!tipo || r.tipo === tipo) && (!precio || r.precio === precio));

/** Probabilidad de cada objeto en una carga; mezcla los repartos con el mismo tipo y precio según su peso. */
function distribucion(perfil, tipo, precio) {
  const rs = repartosDe({ perfil, tipo, precio });
  const total = rs.reduce((s, r) => s + r.peso, 0);
  if (!rs.length || !total) return null;
  const prob = new Map();
  rs.forEach(r => {
    const suma = r.objetos.reduce((s, [, w]) => s + w, 0);
    if (suma) r.objetos.forEach(([id, w]) => prob.set(id, (prob.get(id) || 0) + (r.peso / total) * (w / suma)));
  });
  return prob;
}

/* ---------- escenario (mapa, carga, precio) ---------- */
const esc0 = almacen.leer('escenario', {});
const escenario = {
  mapa: typeof esc0.mapa === 'string' && (esc0.mapa === '' || perfilDe(esc0.mapa)) ? esc0.mapa : ESCENARIO_INICIAL.mapa,
  tipo: Number.isFinite(esc0.tipo) ? esc0.tipo : ESCENARIO_INICIAL.tipo,
  precio: Number.isFinite(esc0.precio) ? esc0.precio : ESCENARIO_INICIAL.precio,
  formato: TAMANOS.includes(esc0.formato) ? esc0.formato : '',
  rotar: esc0.rotar !== false
};
const perfilActual = () => (escenario.mapa ? perfilDe(escenario.mapa) : null);

/** ¿El objeto encaja con el tamaño elegido (girado también, si se permite)? */
function encajaTamano(o) {
  if (!escenario.formato) return true;
  return o.tamano === escenario.formato || (escenario.rotar && o.tamano === escenario.formato.split('x').reverse().join('x'));
}

/** Objetos posibles con la carga y el tamaño elegidos (y su probabilidad si hay tipo y precio). */
function posibles() {
  const perfil = perfilActual();
  const dist = escenario.tipo && escenario.precio ? distribucion(perfil, escenario.tipo, escenario.precio) : null;
  if (dist) return { dist, lista: OBJETOS.filter(o => dist.has(o.id) && encajaTamano(o)) };
  const ids = new Set(repartosDe({ perfil, tipo: escenario.tipo || null }).flatMap(r => r.objetos.map(([id]) => id)));
  return { dist: null, lista: OBJETOS.filter(o => ids.has(o.id) && encajaTamano(o)) };
}

/** Cargas (tipo · precio) del mapa elegido en las que sale un objeto. */
function dondeSale(id) {
  const vistas = new Map();
  repartosDe({ perfil: perfilActual() }).forEach(r => {
    if (r.objetos.some(([oid]) => oid === id)) vistas.set(r.tipo + '|' + r.precio, `${nombreTipo(r.tipo)} ${fmtCorto(r.precio)}`);
  });
  return [...vistas.values()];
}

function pintarFormatos() {
  $('#eFormato').innerHTML = ['', ...TAMANOS].map(t =>
    `<button type="button" data-formato="${t}" aria-pressed="${escenario.formato === t}">${t || 'Todos'}</button>`).join('');
}

function rellenarTipos() {
  const tipos = [...new Set(repartosDe({ perfil: perfilActual() }).map(r => r.tipo))].sort((a, b) => nombreTipo(a).localeCompare(nombreTipo(b), 'es'));
  if (escenario.tipo && !tipos.includes(escenario.tipo)) escenario.tipo = tipos.includes(100022) ? 100022 : 0;
  $('#eTipo').innerHTML = '<option value="0">Cualquiera</option>' + tipos.map(t => `<option value="${t}">${esc(nombreTipo(t))}</option>`).join('');
  $('#eTipo').value = String(escenario.tipo);
  rellenarPrecios();
}
function rellenarPrecios() {
  const precios = escenario.tipo ? [...new Set(repartosDe({ perfil: perfilActual(), tipo: escenario.tipo }).map(r => r.precio))].sort((a, b) => a - b) : [];
  if (!precios.includes(escenario.precio)) escenario.precio = precios[0] ?? 0;
  $('#ePrecio').innerHTML = precios.length ? precios.map(p => `<option value="${p}">${fmt(p)}</option>`).join('') : '<option value="0">—</option>';
  $('#ePrecio').value = String(escenario.precio);
  $('#ePrecio').disabled = !precios.length;
}

function resumenCarga() {
  const { dist, lista } = posibles();
  let txt;
  const masa = dist ? lista.reduce((s, o) => s + dist.get(o.id), 0) : 0;
  if (masa) {
    const rojo = lista.filter(o => o.rareza === MITICO).reduce((s, o) => s + dist.get(o.id), 0) / masa;
    const esperado = lista.reduce((s, o) => s + dist.get(o.id) * o.mercado, 0) / masa;
    txt = `${lista.length} objetos posibles · rojo ${pct(rojo)} · valor esperado ${fmt(esperado)} (${signo(esperado - escenario.precio)}).`;
  } else txt = lista.length ? `${lista.length} objetos posibles. Elige tipo y precio para ver probabilidades.` : 'Ningún objeto de esta carga tiene ese tamaño.';
  $('#resumenCarga').textContent = txt;
}

function escenarioCambiado() {
  almacen.guardar('escenario', escenario);
  resumenCarga();
  actualizarPermitidos();
  pintarManual();
  pintarResultado();
}

function iniciarEscenario() {
  $('#eMapa').innerHTML = '<option value="">Todos los mapas</option>' + MAPAS.map(m => `<option value="${esc(m.etiqueta)}">${esc(m.etiqueta)}</option>`).join('');
  $('#eMapa').value = escenario.mapa;
  rellenarTipos();
  $('#eMapa').addEventListener('change', e => { escenario.mapa = e.target.value; rellenarTipos(); escenarioCambiado(); });
  $('#eTipo').addEventListener('change', e => { escenario.tipo = Number(e.target.value); rellenarPrecios(); escenarioCambiado(); });
  $('#ePrecio').addEventListener('change', e => { escenario.precio = Number(e.target.value); escenarioCambiado(); });
  pintarFormatos();
  $('#eRotar').checked = escenario.rotar;
  $('#eFormato').addEventListener('click', e => {
    const b = e.target.closest('[data-formato]');
    if (!b) return;
    escenario.formato = b.dataset.formato;
    pintarFormatos();
    $(`#eFormato [data-formato="${escenario.formato}"]`).focus();
    escenarioCambiado();
  });
  $('#eRotar').addEventListener('change', e => { escenario.rotar = e.target.checked; escenarioCambiado(); });
  resumenCarga();
}

/* ---------- resultado ---------- */
const estado = { deteccion: null, historial: [] };

function htmlIcono(o) {
  return `<span class="icono" style="--rc: var(--r${o.rareza})"><img src="img/${esc(o.id)}.png" alt=""></span>`;
}

function pintarResultado(nuevo = false) {
  const caja = $('#contenidoResultado');
  const det = estado.deteccion;
  if (!det) {
    caja.innerHTML = '<p class="esperando">Esperando un sonido… Coge un objeto de la furgoneta o de la caja.</p>';
    return;
  }
  const s = det.id;
  const { dist, lista } = posibles();
  let cands = lista.filter(o => o.sonido === s);
  const todos = OBJETOS.filter(o => o.sonido === s);
  const fuera = !cands.length;
  if (fuera) cands = todos; // el sonido no sale en la carga elegida: se muestran todos sus objetos
  const masa = dist && !fuera ? cands.reduce((t, o) => t + (dist.get(o.id) || 0), 0) : 0;
  const prob = o => (masa ? (dist.get(o.id) || 0) / masa : null);
  cands = [...cands].sort((a, b) => (prob(b) ?? 0) - (prob(a) ?? 0) || b.mercado - a.mercado);

  const rojos = cands.filter(o => o.rareza === MITICO);
  let rojoHtml;
  if (masa) {
    const pr = rojos.reduce((t, o) => t + prob(o), 0);
    rojoHtml = `<div class="rojo${pr === 0 ? ' cero' : ''}"><span>Probabilidad de rojo</span><b>${pct(pr)}</b></div>`;
  } else {
    rojoHtml = `<div class="rojo${rojos.length ? '' : ' cero'}"><span>Rojos posibles</span><b>${rojos.length} de ${cands.length}</b></div>`;
  }
  const esperado = masa ? cands.reduce((t, o) => t + prob(o) * o.mercado, 0) : null;
  const valores = cands.map(o => o.mercado);
  const datos = [
    `<span>Valor <b>${fmtCorto(Math.min(...valores))} – ${fmtCorto(Math.max(...valores))}</b></span>`,
    esperado !== null ? `<span>Esperado <b class="${esperado >= escenario.precio ? 'positivo' : 'negativo'}">${fmt(esperado)} (${signo(esperado - escenario.precio)})</b></span>` : ''
  ].join('');
  const alternativas = (det.alternativas || []).filter(a => a.parecido > 0.3).map(a =>
    `<button data-elegir="${a.id}" title="Ver el sonido ${a.id}">#${a.id} · ${Math.round(a.parecido * 100)} %</button>`).join('');

  caja.innerHTML = `
    <div class="cab-res">
      <span class="sonido">Sonido ${s}</span>
      <span class="parecido">${det.manual ? 'elegido a mano' : `${Math.round(det.parecido * 100)} % parecido`} · <span id="hace"></span></span>
    </div>
    ${fuera ? `<p class="nota negativo">Este sonido no sale en la carga ni el tamaño elegidos. ¿Has puesto bien mapa, carga, precio y tamaño? Se muestran todos sus objetos.</p>` : ''}
    <p class="probable">${cands.length === 1 ? 'Es' : 'Lo más probable'}: <strong>${esc(cands[0].nombre)}</strong>${prob(cands[0]) !== null && cands.length > 1 ? ` (${pct(prob(cands[0]))})` : ''}</p>
    ${rojoHtml}
    <div class="datos">${datos}${cands.length === 1 ? '<span class="positivo">✓ Identificación segura</span>' : ''}</div>
    <ul class="candidatos">${cands.map(o => {
      const p = prob(o);
      const cargas = dondeSale(o.id);
      return `<li class="${o.rareza === MITICO ? 'mitico' : ''}">
        ${htmlIcono(o)}
        <span class="nm">${esc(o.nombre)}<small>${esc(o.original)}</small></span>
        <span class="p">${p !== null ? pct(p) : ''}<small>${fmtCorto(o.mercado)}</small></span>
        ${p !== null ? `<span class="barra-p"><div style="width:${Math.max(1, p * 100)}%"></div></span>` : ''}
        <span class="ficha">
          <span class="r${o.rareza}">${RAREZAS[o.rareza]}</span> · ${esc(o.tamano)} · ${esc(o.categoria)} · sonido ${o.sonido}<br>
          Mercado <b>${fmt(o.mercado)}</b> · Contacto <b>${fmt(o.contacto)}</b>
          ${cargas.length ? `<br>Sale en: ${esc(cargas.join(', '))}` : ''}
        </span>
      </li>`;
    }).join('')}</ul>
    ${alternativas ? `<div class="alternativas">¿O quizá? ${alternativas}</div>` : ''}`;
  actualizarHace();
  if (nuevo) {
    const r = $('#resultado');
    r.classList.remove('nuevo'); void r.offsetWidth; r.classList.add('nuevo');
  }
}

function actualizarHace() {
  const el = $('#hace');
  if (!el || !estado.deteccion) return;
  const s = Math.round((Date.now() - estado.deteccion.cuando) / 1000);
  el.textContent = s < 2 ? 'ahora' : s < 60 ? `hace ${s} s` : `hace ${Math.round(s / 60)} min`;
}
setInterval(actualizarHace, 1000);

function mostrarDeteccion(det) {
  estado.registro?.push(det); // solo durante las pruebas
  estado.historial.unshift(det);
  estado.historial = estado.historial.slice(0, MAX_HISTORIAL);
  pintarHistorial();
  // Las dudosas solo van al historial: no cambian el resultado ni se dicen en voz alta
  if (det.dudoso) return;
  estado.deteccion = det;
  pintarResultado(true);
  if (!det.manual) decir(det.id);
}

function pintarHistorial() {
  $('#historial').innerHTML = estado.historial.length ? estado.historial.map(d => {
    const h = new Date(d.cuando).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const que = d.manual ? 'a mano' : `${Math.round(d.parecido * 100)} %${d.dudoso ? ' · dudoso' : ''}`;
    return `<li class="${d.dudoso ? 'dudoso' : ''}"><span><button data-elegir="${d.id}">#${d.id}</button> ${que}</span><span class="mono">${h}</span></li>`;
  }).join('') : '<li>Nada todavía.</li>';
}

/* ---------- aviso por voz ---------- */
const NUMEROS_TAMANO = { 1: 'uno', 2: 'dos', 3: 'tres' };
let vozEs = null;
function elegirVoz() { vozEs = speechSynthesis.getVoices().find(v => /^es/i.test(v.lang)) || null; }
if ('speechSynthesis' in window) { elegirVoz(); speechSynthesis.addEventListener?.('voiceschanged', elegirVoz); }

/** Dice en voz alta qué puede ser el objeto (los 3 más probables) y la probabilidad de rojo. */
function decir(s) {
  if (!$('#voz').checked || !('speechSynthesis' in window)) return;
  const { dist, lista } = posibles();
  let cands = lista.filter(o => o.sonido === s);
  if (!cands.length) cands = OBJETOS.filter(o => o.sonido === s);
  const masa = dist ? cands.reduce((t, o) => t + (dist.get(o.id) || 0), 0) : 0;
  const prob = o => (masa ? (dist.get(o.id) || 0) / masa : null);
  cands = [...cands].sort((a, b) => (prob(b) ?? 0) - (prob(a) ?? 0) || b.mercado - a.mercado);
  const miles = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} millones` : `${Math.round(n / 1000)} mil`);
  const partes = [cands.length === 1 ? `Es ${cands[0].nombre}` : `Sonido ${s}`];
  cands.slice(0, 3).forEach(o => {
    const p = prob(o);
    const [w, h] = o.tamano.split('x');
    partes.push(`${o.nombre}${p !== null && cands.length > 1 ? `, ${Math.round(p * 100)} por ciento` : ''}, ${RAREZAS[o.rareza]}, ${NUMEROS_TAMANO[w]} por ${NUMEROS_TAMANO[h]}, ${miles(o.mercado)}`);
  });
  if (cands.length > 3) partes.push(`y ${cands.length - 3} más`);
  const rojos = cands.filter(o => o.rareza === MITICO);
  if (masa) partes.push(`Rojo: ${Math.round(rojos.reduce((t, o) => t + prob(o), 0) * 100)} por ciento`);
  else if (rojos.length) partes.push(`Puede ser rojo`);
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(partes.join('. ') + '.');
  u.lang = 'es-ES';
  if (vozEs) u.voice = vozEs;
  u.rate = 1.1;
  // Mientras habla no se avisa de nada nuevo si la voz puede colarse en lo que se capta (no pasa con la salida del juego)
  const fuente = $('#fuente').value;
  const seCuela = !(fuente.startsWith('salida:') && JUEGO.test(fuente));
  if (seCuela) {
    audio.callarHasta = Date.now() + 15000;
    u.onend = u.onerror = () => { audio.callarHasta = Date.now() + 300; };
  }
  speechSynthesis.speak(u);
}

/* ---------- elegir a mano y reproducir ---------- */
const reproductor = { audio: new Audio(), volumen: almacen.leer('volumen', 80) };
function sonar(n) {
  const a = reproductor.audio;
  a.pause(); a.src = `audio/${n}.ogg`; a.volume = reproductor.volumen / 100;
  a.play().catch(() => mensaje('No se pudo reproducir el sonido.'));
}

function pintarManual() {
  const { lista } = posibles();
  const con = new Set(lista.map(o => o.sonido));
  $('#rejillaManual').innerHTML = Array.from({ length: NUM_SONIDOS }, (_, i) => {
    const s = i + 1;
    return `<div class="item"><button class="num${con.has(s) ? '' : ' vacio'}" data-elegir="${s}" aria-label="Ver candidatos del sonido ${s}">${s}</button><button class="play" data-sonar="${s}" aria-label="Escuchar el sonido ${s}">▶</button></div>`;
  }).join('');
}

document.addEventListener('click', e => {
  const elegir = e.target.closest('[data-elegir]');
  if (elegir) { mostrarDeteccion({ id: Number(elegir.dataset.elegir), parecido: 1, manual: true, alternativas: [], cuando: Date.now() }); return; }
  const s = e.target.closest('[data-sonar]');
  if (s) sonar(Number(s.dataset.sonar));
});

/* ---------- escucha del audio del sistema ---------- */
const audio = { activo: false, nativo: false, ctx: null, stream: null, nodo: null, escucha: null, plantillas: new Map() };
let tostadaFuente = '';

/** Decodifica los 38 sonidos del juego a la frecuencia de la captura y prepara sus plantillas (una vez por frecuencia). */
async function cargarPlantillas(sr) {
  if (audio.plantillas.has(sr)) return audio.plantillas.get(sr);
  const ctx = new OfflineAudioContext(1, 1, sr);
  const lista = [];
  for (let s = 1; s <= NUM_SONIDOS; s++) {
    const buf = await ctx.decodeAudioData(await fetch(`audio/${s}.ogg`).then(r => r.arrayBuffer()));
    lista.push(Detector.plantilla(s, mono(buf), buf.sampleRate));
  }
  audio.plantillas.set(sr, lista);
  return lista;
}
function mono(buf) {
  const m = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < m.length; i++) m[i] += d[i] / buf.numberOfChannels; }
  return m;
}

function actualizarPermitidos() {
  if (!audio.escucha) return;
  const { lista } = posibles();
  audio.escucha.permitidos = $('#soloPosibles').checked && lista.length ? new Set(lista.map(o => o.sonido)) : null;
}

/* ---------- de dónde escuchar ----------
   "sistema" = todo lo que suena en la salida predeterminada de Windows. Se captura con captura.ps1 (WASAPI);
   si no se puede, con Chromium; y si tampoco, con una mezcla que aparezca como entrada
   («SteelSeries Sonar - Stream», «Mezcla estéreo», «CABLE Output»…). */
const MEZCLA = /stream|mezcla est[eé]reo|stereo mix|what u hear|cable output|loopback/i;
const SIN_PROCESAR = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

/** Salidas de Windows (se capturan con captura.ps1) y entradas de audio. Por defecto, la salida del juego. */
const JUEGO = /sonar - gaming|gaming|juego/i;
async function rellenarFuentes() {
  const sel = $('#fuente');
  let entradas = [], salidas = { predeterminada: '', salidas: [] };
  try { entradas = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications'); } catch { /* sin dispositivos */ }
  try { salidas = (await window.escritorio?.capturaSistema.salidas()) || salidas; } catch { /* sin captura propia */ }
  const opcionesSalida = salidas.salidas.map(n => {
    const extra = JUEGO.test(n) ? ' (juego, recomendada)' : n === salidas.predeterminada ? ' (predeterminada)' : '';
    return `<option value="salida:${esc(n)}">🔊 ${esc(n)}${extra}</option>`;
  }).join('');
  sel.innerHTML = '<option value="sistema">🔊 Salida predeterminada de Windows</option>' +
    (opcionesSalida ? `<optgroup label="Salidas (lo que suena)">${opcionesSalida}</optgroup>` : '') +
    (entradas.length ? `<optgroup label="Entradas">${entradas.map(d => `<option value="${esc(d.deviceId)}">🎙 ${esc(d.label || 'Entrada sin nombre')}</option>`).join('')}</optgroup>` : '');
  const valores = [...sel.options].map(o => o.value);
  const guardada = almacen.leer('fuente', null);
  const juego = salidas.salidas.find(n => JUEGO.test(n));
  sel.value = guardada && valores.includes(guardada) ? guardada : juego ? 'salida:' + juego : 'sistema';
  return entradas;
}

/** Pasa un trozo de audio al detector y pinta el nivel. */
function procesar(trozo) {
  if (!audio.escucha) return;
  let pico = 0; for (const v of trozo) { const x = Math.abs(v); if (x > pico) pico = x; }
  audio.pico = Math.max(audio.pico || 0, pico);
  if (audio.grabacion) audio.grabacion.push(Float32Array.from(trozo));
  const detecciones = audio.escucha.alimentar(trozo);
  $('#nivelBarra').style.width = Math.max(0, Math.min(100, (audio.escucha.volumen + 70) / 70 * 100)) + '%';
  if (Date.now() < (audio.callarHasta || 0)) return;
  detecciones.forEach(mostrarDeteccion);
}

async function crearEscucha(sr) {
  mensaje('Preparando los 38 sonidos…');
  audio.escucha = new Detector.Escucha(sr, await cargarPlantillas(sr), { umbral: Number($('#umbral').value) / 100 });
  actualizarPermitidos();
}

/** Audio del sistema con captura.ps1 (proceso aparte). */
async function abrirSistemaNativo(dispositivo = '') {
  const cap = window.escritorio?.capturaSistema;
  if (!cap) throw new Error('captura propia no disponible');
  const { frecuencia } = await cap.iniciar(dispositivo);
  await crearEscucha(frecuencia);
  cap.alRecibir(bytes => procesar(bytes.byteOffset % 4 === 0
    ? new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
    : new Float32Array(bytes.slice().buffer)));
  cap.alTerminar(msg => { if (audio.nativo) { parar(); mensaje('Se ha cortado la captura: ' + msg); } });
  audio.nativo = true;
}

/** Entrada de audio (o loopback de Chromium) con un AudioWorklet. */
async function abrirConNavegador(valor) {
  const stream = valor === 'sistema'
    ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: SIN_PROCESAR })
    : await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: valor }, ...SIN_PROCESAR, channelCount: 2 } });
  stream.getVideoTracks().forEach(t => t.stop()); // solo interesa el audio
  const pistas = stream.getAudioTracks();
  if (!pistas.length) throw new Error('no llega audio');
  audio.stream = stream;
  audio.ctx = new AudioContext({ latencyHint: 'interactive' });
  await crearEscucha(audio.ctx.sampleRate);
  pistas[0].addEventListener('ended', () => { if (audio.stream === stream) { parar(); mensaje('Se ha cortado el audio. Vuelve a pulsar «Empezar».'); } });
  await audio.ctx.audioWorklet.addModule('captura-worklet.js');
  audio.nodo = new AudioWorkletNode(audio.ctx, 'captura');
  const mudo = audio.ctx.createGain();
  mudo.gain.value = 0;
  audio.ctx.createMediaStreamSource(new MediaStream(pistas)).connect(audio.nodo).connect(mudo).connect(audio.ctx.destination);
  audio.nodo.port.onmessage = e => procesar(e.data);
}

async function empezar() {
  const btn = $('#btnEscuchar');
  const sel = $('#fuente');
  try {
    btn.disabled = true;
    mensaje('Conectando con el audio…');
    if (sel.value.startsWith('salida:')) {
      await abrirSistemaNativo(sel.value.slice(7));
    } else if (sel.value === 'sistema') {
      try { await abrirSistemaNativo(); } catch (errNativo) {
        try { await abrirConNavegador('sistema'); } catch {
          const mezcla = [...sel.options].find(o => !o.value.startsWith('salida:') && o.value !== 'sistema' && MEZCLA.test(o.textContent));
          if (!mezcla) throw new Error('Windows no deja capturar el audio del sistema (' + (errNativo.message || errNativo) + ').');
          await abrirConNavegador(mezcla.value);
          sel.value = mezcla.value;
          tostadaFuente = `No se pudo capturar el audio del sistema; escuchando «${mezcla.textContent.replace('★ ', '')}».`;
        }
      }
    } else {
      await abrirConNavegador(sel.value);
    }
    audio.activo = true;
    btn.setAttribute('aria-pressed', 'true');
    btn.textContent = '■ Dejar de escuchar';
    $('#estado').textContent = 'Escuchando';
    $('#estado').classList.add('activo');
    mensaje(tostadaFuente || 'Escuchando. Juega con el volumen normal: cuando cojas un objeto, saldrá aquí.');
    tostadaFuente = '';
  } catch (err) {
    parar();
    mensaje('No se pudo empezar: ' + (err.message || err));
  } finally { btn.disabled = false; }
}

function parar() {
  if (audio.nativo) window.escritorio?.capturaSistema.parar();
  audio.nativo = false;
  audio.activo = false;
  audio.stream?.getTracks().forEach(t => t.stop());
  audio.stream = null;
  audio.nodo?.disconnect();
  audio.nodo = null;
  audio.escucha = null;
  audio.ctx?.close().catch(() => {});
  audio.ctx = null;
  $('#btnEscuchar').setAttribute('aria-pressed', 'false');
  $('#btnEscuchar').textContent = '▶ Empezar a escuchar';
  $('#estado').textContent = 'Parado';
  $('#estado').classList.remove('activo');
  $('#nivelBarra').style.width = '0';
}

/* ---------- ajustes ---------- */
function iniciarAjustes() {
  const umbral = $('#umbral');
  umbral.value = almacen.leer('umbral', 60);
  $('#umbralTexto').textContent = umbral.value + ' %';
  umbral.addEventListener('input', () => {
    $('#umbralTexto').textContent = umbral.value + ' %';
    almacen.guardar('umbral', Number(umbral.value));
    if (audio.escucha) audio.escucha.umbral = Number(umbral.value) / 100;
  });
  $('#soloPosibles').checked = almacen.leer('soloPosibles', true);
  $('#soloPosibles').addEventListener('change', e => { almacen.guardar('soloPosibles', e.target.checked); actualizarPermitidos(); });
  const vol = $('#volumen');
  vol.value = reproductor.volumen;
  $('#volTexto').textContent = vol.value + ' %';
  vol.addEventListener('input', () => { reproductor.volumen = Number(vol.value); $('#volTexto').textContent = vol.value + ' %'; almacen.guardar('volumen', reproductor.volumen); });
  $('#voz').checked = almacen.leer('voz', true);
  $('#voz').addEventListener('change', e => { almacen.guardar('voz', e.target.checked); if (!e.target.checked) speechSynthesis.cancel(); });
  const encima = $('#siempreEncima');
  encima.checked = almacen.leer('siempreEncima', true);
  window.escritorio?.siempreEncima(encima.checked);
  encima.addEventListener('change', () => { almacen.guardar('siempreEncima', encima.checked); window.escritorio?.siempreEncima(encima.checked); });
  $('#btnEscuchar').addEventListener('click', () => (audio.activo ? parar() : empezar()));
  rellenarFuentes();
  $('#fuente').addEventListener('change', e => {
    almacen.guardar('fuente', e.target.value);
    if (audio.activo) { parar(); empezar(); }
  });
  navigator.mediaDevices.addEventListener?.('devicechange', rellenarFuentes);
}

/* ---------- autoprueba (npm run autoprueba) ----------
   Mete cada sonido del juego en ruido, con más ruido y con el tono cambiado un 4 %, y comprueba que se reconoce.
   También pasa 20 s de ruido y golpes al azar para contar avisos falsos. */
async function autoprueba() {
  const sr = 48000;
  const ctx = new OfflineAudioContext(1, 1, sr);
  const plantillas = await cargarPlantillas(sr);
  const sonidos = [];
  for (let s = 1; s <= NUM_SONIDOS; s++) sonidos.push(mono(await ctx.decodeAudioData(await fetch(`audio/${s}.ogg`).then(r => r.arrayBuffer()))));
  let semilla = 7;
  const azar = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  const ruido = (n, nivel) => Float32Array.from({ length: n }, () => (azar() * 2 - 1) * nivel);
  const cambiarTono = (m, f) => Float32Array.from({ length: Math.floor(m.length / f) }, (_, i) => {
    const x = i * f, a = Math.floor(x), t = x - a; return (m[a] || 0) * (1 - t) + (m[a + 1] || 0) * t;
  });
  const pasar = (senal, umbral = 0.6) => {
    const e = new Detector.Escucha(sr, plantillas, { umbral });
    const dets = [];
    for (let i = 0; i < senal.length; i += 2048) dets.push(...e.alimentar(senal.subarray(i, i + 2048)));
    return dets.filter(d => !d.dudoso);
  };
  const caso = (nombre, preparar, nivelRuido = 0.003) => {
    let bien = 0; const fallos = [];
    sonidos.forEach((m, i) => {
      const sonido = preparar(m);
      const senal = ruido(Math.round(sr * 0.5) + sonido.length + sr * 2.5, nivelRuido);
      sonido.forEach((v, j) => { senal[Math.round(sr * 0.5) + j] += v * 0.5; });
      const d = pasar(senal)[0];
      if (d?.id === i + 1) bien++;
      else fallos.push(`${i + 1}→${d ? d.id : "nada"}`);
    });
    return { caso: nombre, aciertos: `${bien}/${NUM_SONIDOS}`, fallos };
  };
  const resultados = [
    caso('limpio', m => m),
    caso('ruido medio (−45 dB)', m => m, 0.008),
    caso('ruido fuerte (−39 dB)', m => m, 0.02),
    caso('tono +4 %', m => cambiarTono(m, 1.04)),
    caso('tono −4 %', m => cambiarTono(m, 0.96))
  ];
  // Avisos falsos: 20 s de ruido con golpes secos al azar
  const fondo = ruido(sr * 20, 0.01);
  for (let g = 0; g < 40; g++) { const p = Math.floor(azar() * (fondo.length - 4000)); for (let j = 0; j < 3000; j++) fondo[p + j] += (azar() * 2 - 1) * 0.4 * Math.exp(-j / 400); }
  resultados.push({ caso: 'avisos falsos en 20 s de ruido con 40 golpes', avisos: pasar(fondo).length });
  return resultados;
}
window.autoprueba = autoprueba;

/** Prueba de extremo a extremo (npm run prueba-bucle): suena por los altavoces y se capta por el audio de Windows. */
async function pruebaBucle(lista = [1, 4, 12, 28, 33, 38], salida = null) {
  $('#voz').checked = false;
  const espera = ms => new Promise(r => setTimeout(r, ms));
  // Opcional: reproducir por una salida concreta (p. ej. /Sonar - Gaming/) para probar una mezcla
  if (salida) {
    const disp = (await navigator.mediaDevices.enumerateDevices()).find(d => d.kind === 'audiooutput' && salida.test(d.label));
    if (disp) await reproductor.audio.setSinkId(disp.deviceId);
  }
  await rellenarFuentes();
  const opcion = salida && [...$('#fuente').options].find(o => o.value.startsWith('salida:') && salida.test(o.value));
  $('#fuente').value = opcion ? opcion.value : 'sistema';
  await empezar();
  if (!audio.activo) return { error: $('#mensaje').textContent };
  audio.escucha.permitidos = null;
  await espera(1500);
  const resultados = [];
  for (const s of lista) {
    estado.registro = [];
    audio.pico = 0;
    sonar(s);
    await espera(3000);
    const nuevas = estado.registro;
    resultados.push(`${s}→${nuevas.length ? nuevas.map(d => `${d.id} (${Math.round(d.parecido * 100)} %)`).join(' ') : 'nada'} · pico ${(audio.pico || 0).toFixed(3)}${audio.nativo ? ' (captura propia)' : ''}`);
  }
  parar();
  return resultados;
}
window.pruebaBucle = pruebaBucle;

/* ---------- arranque ---------- */
$('#version').textContent = DATOS.version;
iniciarEscenario();
iniciarAjustes();
pintarManual();
pintarResultado();
pintarHistorial();
