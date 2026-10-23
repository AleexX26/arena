# Captura "loopback" de una salida de audio de Windows (WASAPI, modo compartido).
# Usa el formato propio del dispositivo, así funciona con cualquier frecuencia (44,1 / 48 / 96 kHz…).
#   -Listar               escribe en JSON las salidas activas y la predeterminada
#   -Dispositivo "texto"  captura la salida cuyo nombre contenga ese texto (si no, la predeterminada)
# Salida al capturar: 4 bytes con la frecuencia (int32) y después muestras float32 mono sin fin.
# Solo escucha lo que suena; no toca ningún otro programa.
param([switch]$Listar, [string]$Dispositivo = '')
$ErrorActionPreference = 'Stop'

Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class EnumeradorMM { }

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  void EnumAudioEndpoints(int flujo, int estado, out IMMDeviceCollection dispositivos);
  void GetDefaultAudioEndpoint(int flujo, int rol, out IMMDevice dispositivo);
}

[Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection {
  void GetCount(out uint total);
  void Item(uint indice, out IMMDevice dispositivo);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  void Activate(ref Guid iid, int contexto, IntPtr parametros, [MarshalAs(UnmanagedType.IUnknown)] out object interfaz);
  void OpenPropertyStore(int acceso, out IPropertyStore propiedades);
}

[StructLayout(LayoutKind.Sequential)]
struct ClavePropiedad { public Guid fmtid; public int pid; }

[StructLayout(LayoutKind.Explicit, Size = 24)]
struct ValorPropiedad { [FieldOffset(0)] public short vt; [FieldOffset(8)] public IntPtr puntero; }

[Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore {
  void GetCount(out uint total);
  void GetAt(uint indice, out ClavePropiedad clave);
  void GetValue(ref ClavePropiedad clave, out ValorPropiedad valor);
}

[Guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioClient {
  void Initialize(int modo, int flags, long duracion, long periodo, IntPtr formato, IntPtr sesion);
  void GetBufferSize(out uint tamano);
  void GetStreamLatency(out long latencia);
  void GetCurrentPadding(out uint relleno);
  void IsFormatSupported(int modo, IntPtr formato, out IntPtr parecido);
  void GetMixFormat(out IntPtr formato);
  void GetDevicePeriod(out long normal, out long minimo);
  void Start();
  void Stop();
  void Reset();
  void SetEventHandle(IntPtr evento);
  void GetService(ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object servicio);
}

[Guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioCaptureClient {
  void GetBuffer(out IntPtr datos, out uint fotogramas, out uint flags, out ulong posicion, out ulong qpc);
  void ReleaseBuffer(uint fotogramas);
  void GetNextPacketSize(out uint fotogramas);
}

public static class CapturaBucle {
  static readonly Guid FLOTANTE = new Guid("00000003-0000-0010-8000-00aa00389b71");

  static string Nombre(IMMDevice d) {
    IPropertyStore p;
    d.OpenPropertyStore(0, out p);
    ClavePropiedad clave = new ClavePropiedad { fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), pid = 14 };
    ValorPropiedad v;
    p.GetValue(ref clave, out v);
    return v.vt == 31 ? Marshal.PtrToStringUni(v.puntero) : "";
  }

  static List<KeyValuePair<string, IMMDevice>> Salidas() {
    IMMDeviceEnumerator e = (IMMDeviceEnumerator)new EnumeradorMM();
    IMMDeviceCollection col;
    e.EnumAudioEndpoints(0, 1, out col);                                  // eRender, ACTIVAS
    uint n; col.GetCount(out n);
    List<KeyValuePair<string, IMMDevice>> lista = new List<KeyValuePair<string, IMMDevice>>();
    for (uint i = 0; i < n; i++) { IMMDevice d; col.Item(i, out d); lista.Add(new KeyValuePair<string, IMMDevice>(Nombre(d), d)); }
    return lista;
  }

  static IMMDevice Predeterminada() {
    IMMDeviceEnumerator e = (IMMDeviceEnumerator)new EnumeradorMM();
    IMMDevice d;
    e.GetDefaultAudioEndpoint(0, 1, out d);                               // eRender, eMultimedia
    return d;
  }

  static string Json(string s) { return "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\""; }

  public static void Listar() {
    StringBuilder sb = new StringBuilder("{\"predeterminada\":" + Json(Nombre(Predeterminada())) + ",\"salidas\":[");
    List<KeyValuePair<string, IMMDevice>> lista = Salidas();
    for (int i = 0; i < lista.Count; i++) sb.Append((i > 0 ? "," : "") + Json(lista[i].Key));
    sb.Append("]}");
    byte[] b = Encoding.UTF8.GetBytes(sb.ToString());
    Stream s = Console.OpenStandardOutput();
    s.Write(b, 0, b.Length);
    s.Flush();
  }

  public static void Capturar(string filtro) {
    IMMDevice dispositivo = null;
    if (!string.IsNullOrEmpty(filtro)) {
      foreach (KeyValuePair<string, IMMDevice> par in Salidas())
        if (par.Key.IndexOf(filtro, StringComparison.OrdinalIgnoreCase) >= 0) { dispositivo = par.Value; break; }
    }
    if (dispositivo == null) dispositivo = Predeterminada();

    Stream salida = Console.OpenStandardOutput();
    Guid iidCliente = typeof(IAudioClient).GUID;
    object o;
    dispositivo.Activate(ref iidCliente, 23, IntPtr.Zero, out o);         // CLSCTX_ALL
    IAudioClient cliente = (IAudioClient)o;

    IntPtr formato;
    cliente.GetMixFormat(out formato);
    int etiqueta = (ushort)Marshal.ReadInt16(formato, 0);
    int canales = Marshal.ReadInt16(formato, 2);
    int frecuencia = Marshal.ReadInt32(formato, 4);
    int bits = Marshal.ReadInt16(formato, 14);
    bool flotante = etiqueta == 3;
    if (etiqueta == 0xFFFE) {
      byte[] g = new byte[16];
      Marshal.Copy(IntPtr.Add(formato, 24), g, 0, 16);
      flotante = new Guid(g) == FLOTANTE;
    }

    cliente.Initialize(0, 0x00020000, 2000000, 0, formato, IntPtr.Zero);  // compartido, LOOPBACK, 200 ms
    Guid iidCaptura = typeof(IAudioCaptureClient).GUID;
    cliente.GetService(ref iidCaptura, out o);
    IAudioCaptureClient captura = (IAudioCaptureClient)o;

    salida.Write(BitConverter.GetBytes(frecuencia), 0, 4);
    salida.Flush();
    cliente.Start();

    System.Diagnostics.Stopwatch reloj = System.Diagnostics.Stopwatch.StartNew();
    long escritas = 0;
    while (true) {
      Thread.Sleep(10);
      uint paquete;
      captura.GetNextPacketSize(out paquete);
      bool hubo = false;
      while (paquete > 0) {
        IntPtr datos; uint n, flags; ulong p1, p2;
        captura.GetBuffer(out datos, out n, out flags, out p1, out p2);
        float[] mono = new float[n];
        if ((flags & 2) == 0) {                                          // 2 = AUDCLNT_BUFFERFLAGS_SILENT
          int total = (int)n * canales;
          if (flotante && bits == 32) {
            float[] t = new float[total]; Marshal.Copy(datos, t, 0, total);
            for (int i = 0; i < n; i++) { float s = 0; for (int c = 0; c < canales; c++) s += t[i * canales + c]; mono[i] = s / canales; }
          } else if (bits == 16) {
            short[] t = new short[total]; Marshal.Copy(datos, t, 0, total);
            for (int i = 0; i < n; i++) { float s = 0; for (int c = 0; c < canales; c++) s += t[i * canales + c] / 32768f; mono[i] = s / canales; }
          } else if (bits == 32) {
            int[] t = new int[total]; Marshal.Copy(datos, t, 0, total);
            for (int i = 0; i < n; i++) { float s = 0; for (int c = 0; c < canales; c++) s += t[i * canales + c] / 2147483648f; mono[i] = s / canales; }
          }
        }
        captura.ReleaseBuffer(n);
        Escribir(salida, mono);
        escritas += n;
        hubo = true;
        captura.GetNextPacketSize(out paquete);
      }
      // Windows no manda nada mientras no suena nada: se rellena con silencio para que el tiempo siga corriendo
      long debidas = (long)(reloj.Elapsed.TotalSeconds * frecuencia);
      if (!hubo && debidas - escritas > frecuencia / 20) {
        int faltan = (int)(debidas - escritas);
        Escribir(salida, new float[faltan]);
        escritas += faltan;
      }
    }
  }

  static void Escribir(Stream s, float[] m) {
    byte[] b = new byte[m.Length * 4];
    Buffer.BlockCopy(m, 0, b, 0, b.Length);
    s.Write(b, 0, b.Length);
    s.Flush();
  }
}
'@

try {
  if ($Listar) { [CapturaBucle]::Listar() } else { [CapturaBucle]::Capturar($Dispositivo) }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
