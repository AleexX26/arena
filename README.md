# Mi ayuda de Arena Breakout

Web personal de ayuda para **Arena Breakout: Infinite**, de una sola página (`index.html`, sin dependencias, funciona sin conexión).

- Identificar objetos del Comerciante de campo y de las cajas misteriosas por su **ID de sonido**.
- Tabla de objetos con filtros, calculadora de la furgoneta y valor esperado de cajas misteriosas.
- Cuenta atrás de 60 s para la caja fuerte secreta de TV Station y checklist de las 5 cajas gratuitas.
- Botones para tus propios audios, analizador experimental (espectrograma y huellas), checklist de raid y beneficio.

Los datos de sonidos están en `SONIDOS_EJEMPLO` al principio del script; la tabla completa se pega con **Importar JSON**.
Datos de la comunidad: [ABI Builder](https://abibuilder.com/merchant) (Maoyan). Todo lo marcado "verificar en el juego" puede cambiar con los parches.

**Proyecto de fans no oficial**, sin relación con MoreFun Studio.

## Desplegar

```bash
npx wrangler pages deploy . --project-name arena-abi --branch main
```
