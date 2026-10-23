// Genera el bloque de datos de index.html a partir de datos/fuente.json (tablas del juego)
// y datos/traducciones.json (nombres en español).
// Uso: node scripts/generar-datos.mjs   (desde la carpeta Arena/)
import { readFileSync, writeFileSync } from 'node:fs';

const fuente = JSON.parse(readFileSync('datos/fuente.json', 'utf8'));
const tr = JSON.parse(readFileSync('datos/traducciones.json', 'utf8'));
const avisos = [];

// "Farm Lockdown, Valley Lockdown, Distorted Valley Anomaly" → ["Granja · Confinamiento", …]
function traducirPerfil(texto) {
  return texto.split(',').map(s => s.trim()).map(s => {
    const mapa = Object.keys(tr.mapas).find(m => s.startsWith(m + ' '));
    if (!mapa) return s;
    const modo = s.slice(mapa.length + 1);
    return `${tr.mapas[mapa]} · ${tr.modos[modo] ?? modo}`;
  });
}

const objetos = fuente.items.map(i => {
  const nombre = tr.objetos[i.id];
  if (!nombre) avisos.push(`Sin traducción: ${i.id} ${i.name}`);
  const cat = tr.categorias[i.category];
  if (!cat) avisos.push(`Categoría sin traducir: ${i.category}`);
  // [id, nombre, nombre original, rareza 1-6, ancho, alto, categoría, precio mercado, precio contacto, sonido]
  return [i.id, nombre ?? i.name, i.name, tr.rarezas[i.rarity] ?? 1, i.w, i.h, cat ?? i.category, i.ref, i.contact, Number(i.soundId) || 0];
});
const ids = new Set(objetos.map(o => o[0]));

const tipos = {};
for (const [k, v] of Object.entries(fuente.types)) {
  tipos[k] = tr.cargas[v] ?? v;
  if (!tr.cargas[v]) avisos.push(`Carga sin traducir: ${v}`);
}

const perfiles = fuente.profiles.map(p => ({
  id: p.id,
  mapas: p.known ? traducirPerfil(p.label) : [],
  conocido: !!p.known
}));

// [perfil, tipo de carga, precio, peso del reparto, total, [[id objeto, peso], …]]
const repartos = fuente.pools.map(p => {
  p[5].forEach(([id]) => { if (!ids.has(id)) avisos.push(`Objeto ${id} en un reparto pero no en la lista`); });
  return [p[0], p[1], p[2], p[3], p[4], p[5].filter(([id]) => ids.has(id))];
});

const datos = { version: fuente.version, fecha: fuente.scrapedAt.slice(0, 10), objetos, tipos, perfiles, repartos };
const bloque = `/* DATOS:INICIO (generado por scripts/generar-datos.mjs, no editar a mano) */\nconst DATOS = ${JSON.stringify(datos)};\n/* DATOS:FIN */`;

const html = readFileSync('index.html', 'utf8');
const re = /\/\* DATOS:INICIO[\s\S]*?\/\* DATOS:FIN \*\//;
if (!re.test(html)) throw new Error('No encuentro los marcadores DATOS:INICIO / DATOS:FIN en index.html');
writeFileSync('index.html', html.replace(re, () => bloque));

console.log(`Datos v${datos.version}: ${objetos.length} objetos, ${repartos.length} repartos, ${perfiles.length} perfiles.`);
if (avisos.length) console.log('Avisos:\n - ' + [...new Set(avisos)].join('\n - '));
