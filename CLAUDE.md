# CLAUDE.md — Mi ayuda de Arena Breakout

Web personal de fans (no oficial) para Arena Breakout: Infinite: identificar por su ID de sonido lo que dan el Comerciante de campo ("la furgoneta") y las cajas misteriosas, calculadoras, caja secreta de TV Station y raids.

## Stack

- Un único `index.html`: HTML + CSS + JS sin dependencias, sin peticiones externas, funciona offline
- Web Audio API (pitidos, AnalyserNode), IndexedDB (audios propios), localStorage (resto, prefijo `abiAyuda:`)
- Hosting: Cloudflare Pages, proyecto `arena-abi` (subida directa con wrangler)

## Arquitectura

```
index.html   <style> con tokens en :root (oscuro por defecto: carbón/verde militar/naranja; claro con data-theme="claro")
             → 7 secciones numeradas → <script> con DATOS EDITABLES arriba:
             SONIDOS_EJEMPLO, NUM_IDS, CARGAS, PRECIOS_CARGA, RAREZAS, TAMANOS, MAPAS, MODOS, MIS_SONIDOS, CAJAS_TV, CHECKLIST_BASE
audio/       aquí van los audios propios (extraccion.mp3, pasos.mp3, disparos-lejanos.mp3). No audios del juego.
README.md    qué es y cómo desplegar
```

Secciones: 01 sonido (rejilla 1-38, pestañas coger/soltar, rango min-máx, "identificación segura") · 02 tabla con filtros ·
03 furgoneta (lista, % venta, orden por moneda/casilla, valor esperado de cajas misteriosas con pesos) · 04 caja secreta 60 s +
5 cajas gratuitas · 05 mis sonidos · 06 analizador (espectrograma, huellas calibradas) · 07 checklist + temporizador + beneficio.

## Comandos

- Ver en local: doble clic en `index.html`, o preview `arena` de `.claude/launch.json` (puerto 8766). El micrófono necesita https o localhost.
- Desplegar: `npx wrangler pages deploy . --project-name arena-abi --branch main` (desde `Arena/`).
- Repo: https://github.com/AleexX26/arena (rama `main`). Web: https://arena-abi.pages.dev
- Ojo: Pages no está conectado a Git: un push NO publica, hay que repetir el `wrangler pages deploy`.

## Formato de datos (Importar JSON)

`[{ id, items: [{ nombre, rareza (1-6 o nombre), tamano "2x1", tipo, precio, fuentes: [{ cargo, precio }], imagen?, mapas?: ["TV Station Lockdown"], eventos?: ["coger","soltar"] }] }]`.
Sin `eventos` = el objeto suena igual al coger y al soltar. Sin `mapas` = aparece con cualquier filtro de mapa.

## Decisiones

- 2026-10-23: datos de ejemplo (IDs 1, 4, 5, 12, 28, 38) y lista de mapas/modos comprobados en abibuilder.com/merchant; el resto lo pega el usuario con "Importar JSON" (sin scraping).
- 2026-10-23: nombres de objetos en inglés (como en ABI Builder) y tipos de carga en español.
- 2026-10-23: moneda de Zombie Endless desconocida → campo editable "Moneda Zombie" y % 100 por defecto, marcado "verificar en el juego".
- 2026-10-23: probabilidades de cajas misteriosas no públicas → el valor esperado usa pesos que pone el usuario (por defecto 1) y avisa de que es una apuesta.
- 2026-10-23: huella de sonido = forma del espectro en 24 bandas log (z-score, no depende del volumen) 70 % + nº de golpes 15 % + duración 15 %.
- 2026-10-23: audios subidos en IndexedDB (para poder usarlos desde el móvil sin tocar el repo).
- 2026-10-23: Pages `arena-abi` creado con `wrangler pages project create --force` (solo la primera vez).

## Patrones reutilizables

- **almacen.leer/guardar**: localStorage en try/catch con valor por defecto. En `index.html`.
- **validarDatos(json)**: normaliza y descarta entradas no válidas de la tabla de sonidos. En `index.html`.
- **marcador(it)**: SVG con la rejilla del tamaño real del objeto e iniciales en color de rareza, cuando no hay imagen. En `index.html`.
- **pitar(frec, dur, veces)**: pitidos con Web Audio sin archivos. En `index.html`.
- **calcularHuella / parecido**: huella acústica simple con AnalyserNode. En `index.html`.

## Relacionado

- Reglas generales: [[../CLAUDE]]

## Última actualización

2026-10-23
