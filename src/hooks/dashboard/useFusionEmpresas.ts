import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

export function useFusionEmpresas(socket: Socket | null) {
  const [preview, setPreview] = useState<any | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [historial, setHistorial] = useState<any[]>([]);

  const cargarPreview = (empresaOrigenId: string, empresaDestinoId: string, onDone?: (ok: boolean, error?: string) => void) => {
    if (!socket) return;
    setCargandoPreview(true);
    socket.emit("fusion:preview", { empresaOrigenId, empresaDestinoId }, (res: any) => {
      setCargandoPreview(false);
      setPreview(res?.success ? res.preview : null);
      onDone?.(!!res?.success, res?.error);
    });
  };

  const ejecutar = (payload: any, onDone?: (ok: boolean, logId?: string, error?: string) => void) => {
    if (!socket) return;
    setEjecutando(true);
    socket.emit("fusion:ejecutar", payload, (res: any) => {
      setEjecutando(false);
      onDone?.(!!res?.success, res?.logId, res?.error);
    });
  };

  const revertir = (logId: string, empresaOrigenId: string, empresaDestinoId: string, onDone?: (ok: boolean, error?: string) => void) => {
    if (!socket) return;
    socket.emit("fusion:revertir", { logId, empresaOrigenId, empresaDestinoId }, (res: any) => {
      onDone?.(!!res?.success, res?.error);
    });
  };

  const cargarHistorial = () => {
    if (!socket) return;
    socket.emit("fusion:historial", {}, (res: any) => {
      if (res?.success) setHistorial(res.historial || []);
    });
  };

  useEffect(() => {
    if (!socket) return;
    cargarHistorial();
    socket.on("fusion:changed", cargarHistorial);
    return () => { socket.off("fusion:changed", cargarHistorial); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const limpiarPreview = () => setPreview(null);

  return { preview, cargandoPreview, cargarPreview, limpiarPreview, ejecutando, ejecutar, revertir, historial, cargarHistorial };
}