# CLAUDE.md — Mi ayuda de Arena Breakout

Web personal de fans (no oficial), en español y a pantalla completa: calculadora de la furgoneta (Comerciante de campo) de Arena Breakout: Infinite al estilo de abibuilder.com/merchant, con los 38 sonidos del juego, candidatos con probabilidad real por mapa y carga, qué carga comprar y vender.

## Stack

- `index.html` único: HTML + CSS + JS sin dependencias, sin peticiones a otros sitios, funciona offline
- Datos del juego incrustados en `index.html` (bloque `DATOS`), generados con `scripts/generar-datos.mjs`
- `audio/1.ogg … 38.ogg` (sonido al coger) e `img/<id>.png` (189 objetos), copiados al proyecto
- HTMLAudioElement para los sonidos, localStorage (prefijo `abiAyuda:`)
- Hosting: Cloudflare Pages, proyecto `arena-abi` (subida directa con wrangler)

## Arquitectura

```
index.html                 tokens CSS (oscuro por defecto; claro con data-theme="claro") → cabecera → 01 calculadora → 02 vender
                           <script>: bloque /* DATOS:INICIO … DATOS:FIN */ generado, configuración editable y módulos
datos/fuente.json          tablas del juego (items, pools, profiles, types, sounds) tal cual las publica la comunidad
datos/traducciones.json    nombres en español de objetos, categorías, cargas, mapas y modos
scripts/generar-datos.mjs  fuente + traducciones → bloque DATOS de index.html (avisa si falta una traducción)
audio/  img/               sonidos e imágenes del juego
```

01 calculadora (`.app`): a la izquierda `<details id="panelFiltros">` fijo (buscar, mapa/modo, formato con siluetas,
rotación, tipo y precio de carga, rareza, categoría, valorar con mercado/contacto); a la derecha «¿Cómo se usa?»,
tarjetas de los 38 sonidos (▶ Coger + miniaturas en color de rareza, «+N»), Candidatos (probabilidad condicionada
a filtros y sonido, valor esperado) y «¿Qué carga comprar?» (valor esperado, beneficio, P. de ganar; clic = elegir carga).
02 vender: lista de lo que llevo, % de venta por modo y orden por moneda/casilla. Sin pie.

Modelo: un **perfil** de reparto agrupa varios mapa·modo (p. ej. perfil 4 = Estación de TV · Confinamiento, Northridge,
Aeropuerto · Confinamiento). Un **reparto** = [perfil, tipo de carga, precio, peso, total, [[id, peso]]]. Puede haber
varios repartos con el mismo tipo y precio: `distribucion()` los mezcla según su peso.

## Comandos

- App de escritorio (desde `Arena/escritorio/`): `npm start`, `npm run autoprueba` (detector con audio sintético), `npm run prueba-bucle` (suena por Sonar - Gaming y lo capta), `npm run dist` → `dist/OidoFurgoneta.exe`. `preparar` copia datos, audio e img de la web a `app/`.
- Si se cambia el detector, copiarlo de `escritorio/app/detector.js` al bloque `const Detector` de `index.html` (son el mismo código).

- Ver en local: preview `arena` de `.claude/launch.json` (puerto 8766).
- Regenerar datos tras un parche: sustituir `datos/fuente.json` y `node scripts/generar-datos.mjs` (desde `Arena/`).
- Desplegar: solo la web (`index.html`, `audio/`, `img/`), copiándola a una carpeta limpia y `npx wrangler pages deploy . --project-name arena-abi --branch main` desde ahí: desde `Arena/` falla porque entra `escritorio/` (el .exe de 100 MB y node_modules).
- Repo: https://github.com/AleexX26/arena (rama `main`). Web: https://arena-abi.pages.dev
- Ojo: Pages no está conectado a Git: un push NO publica, hay que repetir el `wrangler pages deploy`.

## Decisiones

- 2026-10-26: la app de escritorio copia el diseño del detector de la web/referencia: ventana de 1040 px a dos columnas (detector con top 3 e historial con «Usar» | objetos posibles), «Probar con sonido» suena por la salida que se escucha (setSinkId) para probar de verdad, listas completas de tipo y precio. Prueba por Sonar - Gaming: 10/10. `--foto=<png>` guarda una captura en las pruebas.

- 2026-10-26: detector de sonido en tiempo real en la web (como el de abi-sound-calculate-items): audio del sistema (getDisplayMedia, compartir pantalla con audio) o micrófono, AudioWorklet desde un Blob para seguir con un solo archivo, y el mismo Detector que la app de escritorio (copiado en index.html). Top 3, historial con «Usar» y aplica el sonido a Candidatos. Prueba: 9-10/10 pasando los .ogg por un MediaStream.
- 2026-10-26: Tipo y Precio de carga listan siempre los 19 valores (marcando «no sale aquí»); nombres de carga como la web de referencia («Artículos del hogar», «Objetos militares»).
- 2026-10-24: app de escritorio en `escritorio/` (Electron, .exe portátil): captura propia WASAPI con `captura.ps1` porque el loopback de Chromium falla con los auriculares del usuario (0x88890008); por defecto escucha «SteelSeries Sonar - Gaming» (Sonar ecualiza la mezcla de los auriculares). Prueba real: 10/10.

- 2026-10-24: estructura de la interfaz como abibuilder.com/merchant (le gusta al usuario): filtros a la izquierda, tarjetas de sonido con miniaturas, candidatos debajo. En móvil, filtros plegados y botón flotante «Ver candidatos».
- 2026-10-24: quitados a petición del usuario el pie (aviso y créditos), caja secreta, analizador de micro, raid y la tabla de objetos (la sustituyen los candidatos). Los créditos quedan en README.md.
- 2026-10-24: la calculadora de la furgoneta va primero.
- 2026-10-24: datos, sonidos e imágenes tomados de abi-sound-calculate-items.cayetanomoron2000.workers.dev (seed.js, tablas v1.0.0.151.10) e hexaov91/abi-assets, con permiso del usuario. Los 38 sonidos coinciden con los de abibuilder.com/merchant (mismo archivo «…_Up» por ID).
- 2026-10-24: solo el sonido al coger (el usuario no quiere «al soltar»).
- 2026-10-24: todo en español con traducciones propias de los 189 objetos; el nombre original se muestra pequeño y la búsqueda acepta los dos.
- 2026-10-24: a todo el ancho (sin max-width), margen lateral `--margen: clamp(16px, 2.5vw, 40px)`.
- 2026-10-23: moneda de Zombis sin fin desconocida → campo editable y % 100 por defecto, marcado «verificar en el juego».
- 2026-10-23: Pages `arena-abi` creado con `wrangler pages project create --force` (solo la primera vez).

## Patrones reutilizables

- **almacen.leer/guardar**: localStorage en try/catch con valor por defecto. En `index.html`.
- **filtrados()**: objetos que pasan los filtros + distribución de la carga elegida. En `index.html`.
- **distribucion(perfil, tipo, precio)**: probabilidad de cada objeto mezclando repartos por peso. En `index.html`.
- **svgFormato(t)**: silueta de casillas para elegir tamaño. En `index.html`.
- **generar-datos.mjs**: patrón «fuente de terceros + traducciones → bloque entre marcadores en el HTML».

## Relacionado

- Reglas generales: [[../CLAUDE]]

## Última actualización

2026-10-26
