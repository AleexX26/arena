# Mi ayuda de Arena Breakout

Web personal de ayuda para **Arena Breakout: Infinite**, en español, de una sola página (`index.html`, sin dependencias, funciona sin conexión).

1. **Calculadora de la furgoneta**: eliges mapa y modo, y ves qué carga del Comerciante de campo compensa comprar (valor esperado, probabilidad de ganar), más la lista de lo que vendes.
2. **Identificar por sonido**: los 38 sonidos del juego para escucharlos; al elegir uno ves qué objetos pueden ser y con qué probabilidad en la carga comprada.
3. Tabla de los 189 objetos con filtros, caja secreta de la Estación de TV, analizador por micrófono (experimental) y raid.

## Datos

- `datos/fuente.json`: tablas de reparto del juego (v1.0.0.151.10, extraídas por Maoyan y publicadas en [ABI Builder](https://abibuilder.com/merchant)).
- `datos/traducciones.json`: nombres en español (traducción propia).
- `audio/<n>.ogg`: sonido al coger el objeto de cada ID (1-38). `img/<id>.png`: imagen de cada objeto ([hexaov91/abi-assets](https://github.com/hexaov91/abi-assets)).

Tras un parche: sustituir `datos/fuente.json` y ejecutar

```bash
node scripts/generar-datos.mjs
```

**Proyecto de fans no oficial**, sin relación con MoreFun Studio. Imágenes y sonidos pertenecen a sus dueños.

## Desplegar

```bash
npx wrangler pages deploy . --project-name arena-abi --branch main
```
