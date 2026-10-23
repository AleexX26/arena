# Mi ayuda de Arena Breakout

Web personal de ayuda para **Arena Breakout: Infinite**, en español, de una sola página (`index.html`, sin dependencias, funciona sin conexión).

1. **Calculadora de la furgoneta** (al estilo de ABI Builder): filtros a la izquierda, los 38 sonidos con miniaturas y los candidatos con su probabilidad según mapa y carga.
2. **¿Qué carga comprar?**: valor esperado y probabilidad de ganar de cada carga en tu mapa.
3. Vender a la furgoneta: lista de lo que llevas, % de venta y orden recomendado.

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
