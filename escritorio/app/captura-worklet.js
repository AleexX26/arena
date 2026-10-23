// Recoge el audio del sistema en trozos de 2048 muestras (mezclado a mono) y los manda a la interfaz.
class Captura extends AudioWorkletProcessor {
  constructor() {
    super();
    this.trozo = new Float32Array(2048);
    this.n = 0;
  }

  process(entradas) {
    const entrada = entradas[0];
    if (entrada && entrada.length) {
      const canales = entrada.length, largo = entrada[0].length;
      for (let i = 0; i < largo; i++) {
        let s = 0;
        for (let c = 0; c < canales; c++) s += entrada[c][i];
        this.trozo[this.n++] = s / canales;
        if (this.n === this.trozo.length) {
          this.port.postMessage(this.trozo.slice(0));
          this.n = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('captura', Captura);
