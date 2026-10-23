// Puente mínimo y seguro entre la interfaz y el proceso principal.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('escritorio', {
  siempreEncima: activo => ipcRenderer.invoke('siempre-encima', activo),
  // Audio del sistema capturado por captura.ps1: { frecuencia } al empezar y trozos float32 mono después
  capturaSistema: {
    salidas: () => ipcRenderer.invoke('captura-salidas'),
    iniciar: dispositivo => ipcRenderer.invoke('captura-iniciar', dispositivo),
    parar: () => ipcRenderer.invoke('captura-parar'),
    alRecibir: fn => { ipcRenderer.removeAllListeners('captura-audio'); ipcRenderer.on('captura-audio', (_e, bytes) => fn(bytes)); },
    alTerminar: fn => { ipcRenderer.removeAllListeners('captura-fin'); ipcRenderer.on('captura-fin', (_e, msg) => fn(msg)); }
  }
});
