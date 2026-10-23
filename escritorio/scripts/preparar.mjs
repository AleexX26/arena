// Copia a app/ los datos, sonidos e imágenes de la web (../index.html, ../audio, ../img).
// Se ejecuta solo antes de "npm start", "npm run autoprueba" y "npm run dist".
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const web = readFileSync('../index.html', 'utf8');
const bloque = /const DATOS = (\{[\s\S]*?\});\n\/\* DATOS:FIN \*\//.exec(web);
if (!bloque) throw new Error('No encuentro el bloque DATOS en ../index.html (ejecuta antes node scripts/generar-datos.mjs en Arena/)');
writeFileSync('app/datos.js', `// Generado por scripts/preparar.mjs desde ../index.html: no editar.\nconst DATOS = ${bloque[1]};\n`);

for (const carpeta of ['audio', 'img']) {
  mkdirSync(join('app', carpeta), { recursive: true });
  const archivos = readdirSync(join('..', carpeta));
  archivos.forEach(a => copyFileSync(join('..', carpeta, a), join('app', carpeta, a)));
  console.log(`${carpeta}: ${archivos.length} archivos`);
}
console.log('Datos copiados a app/datos.js');
