// Proceso principal: ventana pequeña "siempre encima" y captura del audio de Windows (loopback).
const { app, BrowserWindow, session, desktopCapturer, ipcMain, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');

const CARPETA_APP = path.join(__dirname, 'app');
// Pruebas sin ventana: --autoprueba (detector con audio sintético) y --prueba-bucle (altavoces → captura)
// --analizar=<archivo en app/>: pasa una grabación por el detector
const ANALIZAR = process.argv.find(a => a.startsWith('--analizar='))?.slice(11);
const PRUEBA = ANALIZAR ? '--autoprueba' : ['--autoprueba', '--prueba-bucle'].find(a => process.argv.includes(a));
const AUTOPRUEBA = Boolean(PRUEBA);

// app:// sirve los archivos de app/ como origen seguro (fetch, AudioWorklet y getDisplayMedia lo necesitan)
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1040,
    height: 860,
    minWidth: 380,
    minHeight: 480,
    title: 'Oído de la furgoneta',
    backgroundColor: '#141617',
    autoHideMenuBar: true,
    alwaysOnTop: true,
    show: PRUEBA !== '--autoprueba',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      // Sigue escuchando aunque el juego tenga el foco
      backgroundThrottling: false
    }
  });
  ventana.setAlwaysOnTop(true, 'screen-saver');
  ventana.loadURL('app://local/index.html');
  return ventana;
}

app.whenReady().then(() => {
  protocol.handle('app', peticion => {
    const ruta = path.normalize(path.join(CARPETA_APP, decodeURIComponent(new URL(peticion.url).pathname)));
    if (!ruta.startsWith(CARPETA_APP)) return new Response('Prohibido', { status: 403 });
    return net.fetch(pathToFileURL(ruta).toString());
  });

  // getDisplayMedia del renderer: se concede la pantalla principal + el audio de todo el sistema
  session.defaultSession.setDisplayMediaRequestHandler((_peticion, responder) => {
    desktopCapturer.getSources({ types: ['screen'] })
      .then(fuentes => responder({ video: fuentes[0], audio: 'loopback' }))
      .catch(() => responder({}));
  });

  const ventana = crearVentana();

  // Captura propia del audio del sistema (captura.ps1, WASAPI). Chromium falla con algunas salidas
  // (error 0x88890008, formato no soportado); esta usa el formato del dispositivo.
  let proceso = null;
  const pararCaptura = () => { proceso?.kill(); proceso = null; };
  const argsPs = extra => ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'captura.ps1'), ...extra];

  // Salidas de audio activas: { predeterminada, salidas: [nombres] }
  ipcMain.handle('captura-salidas', () => new Promise(resolver => {
    const hijo = spawn('powershell.exe', argsPs(['-Listar']), { windowsHide: true });
    let texto = '';
    hijo.stdout.on('data', d => { texto += d.toString('utf8'); });
    hijo.on('exit', () => { try { resolver(JSON.parse(texto)); } catch { resolver({ predeterminada: '', salidas: [] }); } });
    hijo.on('error', () => resolver({ predeterminada: '', salidas: [] }));
  }));

  ipcMain.handle('captura-iniciar', (_e, dispositivo = '') => new Promise((resolver, rechazar) => {
    pararCaptura();
    const hijo = spawn('powershell.exe', argsPs(dispositivo ? ['-Dispositivo', String(dispositivo)] : []), { windowsHide: true });
    proceso = hijo;
    let cabecera = null, resto = Buffer.alloc(0), errores = '';
    hijo.stdout.on('data', datos => {
      resto = Buffer.concat([resto, datos]);
      if (!cabecera) {
        if (resto.length < 4) return;
        cabecera = resto.readInt32LE(0);
        resto = resto.subarray(4);
        resolver({ frecuencia: cabecera });
      }
      const util = resto.length - (resto.length % 4);
      if (util && !ventana.isDestroyed()) ventana.webContents.send('captura-audio', new Uint8Array(resto.subarray(0, util)));
      resto = resto.subarray(util);
    });
    hijo.stderr.on('data', d => { errores += d.toString(); });
    hijo.on('error', err => rechazar(err));
    hijo.on('exit', codigo => {
      if (proceso === hijo) proceso = null;
      const msg = errores.trim() || `la captura terminó (código ${codigo})`;
      if (!cabecera) rechazar(new Error(msg));
      else if (!ventana.isDestroyed()) ventana.webContents.send('captura-fin', msg);
    });
  }));
  ipcMain.handle('captura-parar', () => pararCaptura());
  app.on('before-quit', pararCaptura);

  ipcMain.handle('siempre-encima', (_e, activo) => {
    ventana.setAlwaysOnTop(Boolean(activo), 'screen-saver');
    return ventana.isAlwaysOnTop();
  });

  if (AUTOPRUEBA) {
    ventana.webContents.once('did-finish-load', async () => {
      try {
        // true = cuenta como gesto del usuario (getDisplayMedia lo exige)
        const resultado = await ventana.webContents.executeJavaScript(ANALIZAR ? `analizarGrabacion(${JSON.stringify(ANALIZAR)})` : PRUEBA === '--autoprueba' ? 'autoprueba()' : "pruebaBucle([1, 12, 28, 33], 'juego')", true);
        console.log(JSON.stringify(resultado, null, 2));
        // --foto=<ruta.png>: guarda una captura de la ventana (para revisar el diseño)
        const foto = process.argv.find(x => x.startsWith('--foto='));
        if (foto) require('node:fs').writeFileSync(foto.slice(7), (await ventana.webContents.capturePage()).toPNG());
      } catch (err) {
        console.error('Autoprueba fallida:', err);
        process.exitCode = 1;
      }
      app.quit();
    });
  }
});

app.on('window-all-closed', () => app.quit());
