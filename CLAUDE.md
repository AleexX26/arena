# CLAUDE.md — Mi ayuda de Arena Breakout

Web personal de fans (no oficial), toda en español y a pantalla completa, para Arena Breakout: Infinite: calculadora de la furgoneta (Comerciante de campo) con probabilidades reales por mapa, identificar objetos por los 38 sonidos del juego, caja secreta de la Estación de TV y raids.

## Stack

- `index.html` único: HTML + CSS + JS sin dependencias, sin peticiones a otros sitios, funciona offline
- Datos del juego incrustados en `index.html` (bloque `DATOS`), generados con `scripts/generar-datos.mjs`
- `audio/1.ogg … 38.ogg` (sonido al coger) e `img/<id>.png` (189 objetos), copiados al proyecto
- Web Audio API (pitidos, AnalyserNode, FFT propia para huellas), MediaRecorder (micro), localStorage (prefijo `abiAyuda:`)
- Hosting: Cloudflare Pages, proyecto `arena-abi` (subida directa con wrangler)

## Arquitectura

```
index.html                 tokens CSS (oscuro por defecto; claro con data-theme="claro") → 6 secciones → <script>
                           bloque /* DATOS:INICIO … DATOS:FIN */ generado, luego configuración editable y módulos
datos/fuente.json          tablas del juego (items, pools, profiles, types, sounds) tal cual las publica la comunidad
datos/traducciones.json    nombres en español de objetos, categorías, cargas, mapas y modos
scripts/generar-datos.mjs  fuente + traducciones → bloque DATOS de index.html (avisa si falta una traducción)
audio/  img/               sonidos e imágenes del juego
```

Secciones: 01 calculadora de la furgoneta (mapa/modo, tipo y precio de carga, «valorar con» mercado/contacto;
tabla «¿qué carga comprar?» con valor esperado, beneficio y P. de ganar; vender: lista, % venta, orden por moneda/casilla)
· 02 sonido (38 botones que suenan; objetos posibles con probabilidad condicionada al sonido) · 03 tabla de objetos
· 04 caja secreta 60 s + 5 cajas gratuitas · 05 analizar (micro/archivo vs. los 38 sonidos) · 06 checklist, temporizador y beneficio.

Modelo: un **perfil** de reparto agrupa varios mapa·modo (p. ej. perfil 4 = Estación de TV · Confinamiento, Northridge,
Aeropuerto · Confinamiento). Un **reparto** = [perfil, tipo de carga, precio, peso, total, [[id, peso]]]. Puede haber
varios repartos con el mismo tipo y precio: `distribucion()` los mezcla según su peso.

## Comandos

- Ver en local: preview `arena` de `.claude/launch.json` (puerto 8766). Abrir con doble clic no sirve para el analizador (fetch de los .ogg) y el micro necesita https o localhost.
- Regenerar datos tras un parche: sustituir `datos/fuente.json` y `node scripts/generar-datos.mjs` (desde `Arena/`).
- Desplegar: `npx wrangler pages deploy . --project-name arena-abi --branch main` (desde `Arena/`).
- Repo: https://github.com/AleexX26/arena (rama `main`). Web: https://arena-abi.pages.dev
- Ojo: Pages no está conectado a Git: un push NO publica, hay que repetir el `wrangler pages deploy`.

## Decisiones

- 2026-10-24: la calculadora de la furgoneta va primero (petición del usuario): escenario + qué comprar + vender en el apartado 01; el sonido pasa al 02.
- 2026-10-24: datos, sonidos e imágenes tomados de abi-sound-calculate-items.cayetanomoron2000.workers.dev (seed.js con tablas v1.0.0.151.10) e hexaov91/abi-assets, con permiso del usuario. Comprobado que los 38 sonidos coinciden con los de abibuilder.com/merchant (mismo archivo «…_Up» por ID).
- 2026-10-24: solo el sonido al coger (el usuario no quiere «al soltar») y fuera la sección de subir audios propios y el «Importar JSON».
- 2026-10-24: todo en español con traducciones propias de los 189 objetos; el nombre original se muestra pequeño y la búsqueda acepta los dos.
- 2026-10-24: a todo el ancho (sin max-width), margen lateral `--margen: clamp(16px, 2.5vw, 40px)`.
- 2026-10-24: analizador sin calibración manual: compara contra huellas de los 38 .ogg calculadas en el navegador (FFT propia, 24 bandas log, 70 % forma del espectro + 15 % golpes + 15 % duración). Autoprueba: 38/38.
- 2026-10-23: moneda de Zombis sin fin desconocida → campo editable y % 100 por defecto, marcado «verificar en el juego».
- 2026-10-23: Pages `arena-abi` creado con `wrangler pages project create --force` (solo la primera vez).

## Patrones reutilizables

- **almacen.leer/guardar**: localStorage en try/catch con valor por defecto. En `index.html`.
- **distribucion(perfil, tipo, precio)**: probabilidad de cada objeto mezclando repartos por peso. En `index.html`.
- **fft / huellaDeBuffer / parecido**: huella acústica sin librerías para comparar audios. En `index.html`.
- **pitar(frec, dur, veces)**: pitidos con Web Audio sin archivos. En `index.html`.
- **generar-datos.mjs**: patrón «fuente de terceros + traducciones → bloque entre marcadores en el HTML».

## Relacionado

- Reglas generales: [[../CLAUDE]]

## Última actualización

2026-10-24
