'use strict';
/* =============================================================================
   DETECTOR — reconoce los 38 sonidos de "coger objeto" dentro del audio del sistema.

   1. Cada 10 ms se calcula un fotograma: energía en 32 bandas logarítmicas (80 Hz – 14 kHz) con una FFT propia.
   2. Un "ataque" (subida brusca de volumen sobre el ruido de fondo) marca el posible inicio de un sonido.
   3. Tras el ataque se compara el trozo de espectrograma con cada plantilla (los .ogg del juego) por correlación,
      probando pequeños desplazamientos. La correlación no depende del volumen.
   ========================================================================== */
const Detector = (() => {
  const N = 1024;
  const BANDAS = 32;
  const F_MIN = 80, F_MAX = 14000;
  const PASO_S = 0.01;
  const RANGO_DB = 50;            // lo que quede más de 50 dB por debajo del pico se trata como silencio
  const MAX_FOTOGRAMAS = 80;      // plantillas recortadas a 0,8 s
  // El ataque puede caer antes o después del inicio de la plantilla (sonidos de arranque suave, golpes previos)
  const DESPLAZAMIENTOS = Array.from({ length: 43 }, (_, i) => i - 12);
  const VENTANA_GRUPO = 40;       // ataques a menos de 0,4 s se consideran el mismo sonido
  const RESTA_FONDO = 1.5;        // cuánto ruido de fondo se resta (en potencia) antes de comparar

  // --- FFT radix-2 con tablas precalculadas ---
  const bits = Math.log2(N);
  const inv = new Uint32Array(N);
  for (let i = 0; i < N; i++) { let x = i, y = 0; for (let b = 0; b < bits; b++) { y = (y << 1) | (x & 1); x >>= 1; } inv[i] = y; }
  const COS = new Float32Array(N / 2), SIN = new Float32Array(N / 2);
  for (let k = 0; k < N / 2; k++) { COS[k] = Math.cos(-2 * Math.PI * k / N); SIN[k] = Math.sin(-2 * Math.PI * k / N); }
  const VENTANA = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  const re = new Float32Array(N), im = new Float32Array(N);

  function potencia(muestras, inicio, salida) {
    im.fill(0);
    for (let i = 0; i < N; i++) re[inv[i]] = (muestras[inicio + i] || 0) * VENTANA[i];
    for (let tam = 2; tam <= N; tam <<= 1) {
      const mitad = tam >> 1, paso = N / tam;
      for (let i = 0; i < N; i += tam) {
        for (let j = 0; j < mitad; j++) {
          const wr = COS[j * paso], wi = SIN[j * paso], k = i + j, l = k + mitad;
          const tr = wr * re[l] - wi * im[l], ti = wr * im[l] + wi * re[l];
          re[l] = re[k] - tr; im[l] = im[k] - ti; re[k] += tr; im[k] += ti;
        }
      }
    }
    for (let i = 0; i < N / 2; i++) salida[i] = re[i] * re[i] + im[i] * im[i];
  }

  /** Prepara el analizador para una frecuencia de muestreo. */
  function analizador(sr) {
    const hop = Math.round(sr * PASO_S);
    const hzBin = sr / N;
    const fMax = Math.min(F_MAX, sr / 2 * 0.95);
    const bordes = Array.from({ length: BANDAS + 1 }, (_, i) => F_MIN * Math.pow(fMax / F_MIN, i / BANDAS));
    const rangos = bordes.slice(0, -1).map((b, i) => {
      const i0 = Math.max(1, Math.floor(b / hzBin));
      return [i0, Math.max(i0 + 1, Math.floor(bordes[i + 1] / hzBin))];
    });
    const pot = new Float32Array(N / 2);
    /** Fotograma: bandas en dB y volumen (dBFS) de la ventana. */
    function fotograma(muestras, inicio) {
      potencia(muestras, inicio, pot);
      const db = new Float32Array(BANDAS);
      rangos.forEach(([i0, i1], b) => {
        let s = 0; for (let i = i0; i < i1; i++) s += pot[i];
        db[b] = 10 * Math.log10(s / (i1 - i0) + 1e-12);
      });
      let e = 0; for (let i = 0; i < N; i++) { const v = muestras[inicio + i] || 0; e += v * v; }
      return { db, vol: 10 * Math.log10(e / N + 1e-12) };
    }
    return { hop, fotograma };
  }

  /** Vector normalizado (sin media, norma 1) de un trozo de espectrograma, con el silencio recortado. */
  function vectorNormalizado(trozo) {
    let max = -Infinity;
    trozo.forEach(f => f.db.forEach(v => { if (v > max) max = v; }));
    const piso = max - RANGO_DB;
    const v = new Float32Array(trozo.length * BANDAS);
    let suma = 0;
    trozo.forEach((f, t) => f.db.forEach((x, b) => { const y = Math.max(x, piso); v[t * BANDAS + b] = y; suma += y; }));
    const media = suma / v.length;
    let norma = 0;
    for (let i = 0; i < v.length; i++) { v[i] -= media; norma += v[i] * v[i]; }
    norma = Math.sqrt(norma) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= norma;
    return v;
  }

  /** Espectro medio (forma del timbre) normalizado. */
  function espectroMedio(trozo) {
    const m = new Float32Array(BANDAS);
    trozo.forEach(f => f.db.forEach((x, b) => { m[b] += x / trozo.length; }));
    let media = 0; m.forEach(x => { media += x / BANDAS; });
    let norma = 0;
    for (let b = 0; b < BANDAS; b++) { m[b] -= media; norma += m[b] * m[b]; }
    norma = Math.sqrt(norma) || 1;
    for (let b = 0; b < BANDAS; b++) m[b] /= norma;
    return m;
  }

  const punto = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

  /** Plantilla a partir de las muestras (mono) de un sonido del juego. */
  function plantilla(id, muestras, sr) {
    const { hop, fotograma } = analizador(sr);
    const fotos = [];
    for (let ini = 0; ini < muestras.length; ini += hop) fotos.push(fotograma(muestras, ini));
    const pico = Math.max(...fotos.map(f => f.vol));
    let a = fotos.findIndex(f => f.vol > pico - 30);
    let z = fotos.length - 1;
    while (z > a && fotos[z].vol < pico - 45) z--;
    a = Math.max(0, a - 1);
    const trozo = fotos.slice(a, Math.min(z + 1, a + MAX_FOTOGRAMAS));
    return { id, largo: trozo.length, vector: vectorNormalizado(trozo), medio: espectroMedio(trozo) };
  }

  /**
   * Escucha en continuo: se le pasan trozos de audio con alimentar() y devuelve las detecciones.
   * opciones.umbral: parecido mínimo (0-1) para avisar.
   */
  class Escucha {
    constructor(sr, plantillas, opciones = {}) {
      this.sr = sr;
      this.plantillas = plantillas;
      this.umbral = opciones.umbral ?? 0.6;
      this.permitidos = null; // Set de IDs posibles (null = todos)
      const { hop, fotograma } = analizador(sr);
      this.hop = hop; this.fotograma = fotograma;
      this.buffer = new Float32Array(0);
      this.fotos = []; this.base = 0;        // fotogramas recientes y el índice absoluto del primero
      this.ataques = []; this.ultimoAtaque = -1e9;
      this.grupo = null;                     // evaluaciones de ataques cercanos: se avisa solo del mejor
      this.largoMax = Math.max(...plantillas.map(p => p.largo));
      this.silenciadoHasta = -1;             // para no detectar nuestros propios sonidos de prueba si se pide
      this.volumen = -120;
      this.fondoBandas = null;               // ruido de fondo por banda (sube despacio, baja rápido)
      this.excesoAnterior = 0;
    }

    /** Cuánto sobresale (dB de media por banda) el fotograma sobre el ruido de fondo; actualiza el fondo. */
    exceso(f) {
      if (!this.fondoBandas) { this.fondoBandas = Float32Array.from(f.db); return 0; }
      let e = 0;
      for (let b = 0; b < BANDAS; b++) {
        const d = f.db[b] - this.fondoBandas[b];
        if (d > 0) e += d;
        this.fondoBandas[b] += (d > 0 ? 0.01 : 0.3) * d;
      }
      return e / BANDAS;
    }

    get indice() { return this.base + this.fotos.length; }

    alimentar(trozo) {
      const nuevo = new Float32Array(this.buffer.length + trozo.length);
      nuevo.set(this.buffer); nuevo.set(trozo, this.buffer.length);
      let pos = 0;
      const detecciones = [];
      while (pos + N <= nuevo.length) {
        const f = this.fotograma(nuevo, pos);
        this.fotos.push(f);
        this.volumen = f.vol;
        if (this.fotos.length > 400) { this.fotos.splice(0, 100); this.base += 100; }
        const det = this.revisar();
        if (det) detecciones.push(det);
        pos += this.hop;
      }
      this.buffer = nuevo.slice(pos);
      return detecciones;
    }

    revisar() {
      const k = this.indice - 1;
      const f = this.fotos[this.fotos.length - 1];
      // Ataque: muchas bandas suben de golpe por encima de su ruido de fondo
      const e = this.exceso(f);
      const subida = e - this.excesoAnterior;
      this.excesoAnterior = e;
      if (f.vol > -85 && e > 5 && subida > 2.5 && k - this.ultimoAtaque > 8) {
        this.ataques.push(k);
        this.ultimoAtaque = k;
      }
      const espera = this.largoMax + DESPLAZAMIENTOS[DESPLAZAMIENTOS.length - 1];
      let aviso = null;
      // Evalúa los ataques que ya tienen audio suficiente detrás
      while (this.ataques.length && k - this.ataques[0] >= espera) {
        const ataque = this.ataques.shift();
        if (ataque <= this.silenciadoHasta) continue;
        if (this.grupo && ataque - this.grupo.inicio > VENTANA_GRUPO) aviso = this.cerrarGrupo() || aviso;
        const res = this.evaluar(ataque);
        if (!this.grupo) this.grupo = { inicio: ataque, mejor: res };
        else if (res && (!this.grupo.mejor || res.parecido > this.grupo.mejor.parecido)) this.grupo.mejor = res;
      }
      // Cierra el grupo cuando ya no quedan ataques suyos por evaluar
      if (this.grupo && !(this.ataques.length && this.ataques[0] - this.grupo.inicio <= VENTANA_GRUPO) && k - this.grupo.inicio >= espera + VENTANA_GRUPO) {
        aviso = this.cerrarGrupo() || aviso;
      }
      return aviso;
    }

    cerrarGrupo() {
      const mejor = this.grupo?.mejor;
      this.grupo = null;
      // Hay que parecerse lo bastante y destacar sobre el resto (con exigencia 60 %: destaque mínimo 24 puntos)
      if (!mejor) return null;
      // La cola o el eco de un sonido ya avisado no cuenta como otro objeto
      const ultimo = this.ultimoAviso;
      if (ultimo && mejor.ataque - ultimo.ataque < 150 && mejor.parecido < ultimo.parecido) return null;
      const valido = mejor.parecido >= this.umbral && mejor.destaque >= this.umbral * 0.4;
      if (valido) { this.ultimoAviso = mejor; return { ...mejor, cuando: Date.now() }; }
      // Casi: se informa como dudoso (la interfaz lo enseña aparte, sin darlo por bueno)
      const casi = mejor.parecido >= this.umbral - 0.15 && mejor.destaque >= this.umbral * 0.4 - 0.08;
      return casi ? { ...mejor, dudoso: true, cuando: Date.now() } : null;
    }

    /** Espectro del ruido de fondo (percentil 30 por banda) en el segundo anterior al ataque. */
    fondoAntes(ataque) {
      const fin = ataque - 3 - this.base, ini = Math.max(0, fin - 80);
      const trozo = this.fotos.slice(ini, Math.max(ini, fin));
      if (trozo.length < 10) return null;
      return Float32Array.from({ length: BANDAS }, (_, b) => {
        const v = trozo.map(f => f.db[b]).sort((x, y) => x - y);
        return v[Math.floor(v.length * 0.3)];
      });
    }

    /** Compara lo que empieza en el fotograma `ataque` con todas las plantillas. */
    evaluar(ataque) {
      // Copia de los fotogramas con el ruido de fondo restado (resta espectral)
      const fondo = this.fondoAntes(ataque);
      const desde = Math.max(0, ataque + DESPLAZAMIENTOS[0] - this.base);
      const limpios = this.fotos.slice(desde).map(f => (fondo ? {
        db: f.db.map((x, b) => 10 * Math.log10(Math.max(Math.pow(10, x / 10) - RESTA_FONDO * Math.pow(10, fondo[b] / 10), 1e-12)))
      } : f));
      const resultados = [];
      for (const p of this.plantillas) {
        if (this.permitidos && !this.permitidos.has(p.id)) continue;
        let mejor = -1;
        for (const d of DESPLAZAMIENTOS) {
          const ini = ataque + d - this.base - desde;
          if (ini < 0 || ini + p.largo > limpios.length) continue;
          const trozo = limpios.slice(ini, ini + p.largo);
          const corr = punto(vectorNormalizado(trozo), p.vector);
          const timbre = punto(espectroMedio(trozo), p.medio);
          const puntuacion = 0.75 * corr + 0.25 * timbre;
          if (puntuacion > mejor) mejor = puntuacion;
        }
        resultados.push({ id: p.id, parecido: Math.max(0, mejor) });
      }
      resultados.sort((a, b) => b.parecido - a.parecido);
      if (!resultados.length) return null;
      // Destaque: cuánto supera el mejor a la mediana del resto (un golpe cualquiera se parece a todos por igual)
      const mediana = resultados[Math.floor(resultados.length / 2)].parecido;
      return { id: resultados[0].id, parecido: resultados[0].parecido, destaque: resultados[0].parecido - mediana, alternativas: resultados.slice(1, 4), ataque };
    }
  }

  return { plantilla, Escucha };
})();
