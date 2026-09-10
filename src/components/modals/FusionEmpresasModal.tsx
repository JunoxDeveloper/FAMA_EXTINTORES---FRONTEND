import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { useFusionEmpresas } from "../../hooks/dashboard/useFusionEmpresas";
import { useSedes } from "../../hooks/dashboard";
import SedeModal from "./SedeModal";
import { estadoColor, ordinalServicio, mesAnioLabel } from "../../utils/helpers";
import { MESES } from "../../constants";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  socket: Socket | null;
  empresas: { id: string; razonSocial: string; ruc?: string }[];
}

type AccionExtintor = "mover" | "fusionar" | "omitir";

const PASOS = ["Empresas", "Sede", "Extintores", "Servicios", "Historial", "Confirmar"];

const compararExtintores = (a: any, b: any): { uid: string; tipo: "igual" | "similar"; motivo: string; destino: any } | null => {
  const serieA = (a.nSerie || "").trim().toUpperCase();
  const serieB = (b.nSerie || "").trim().toUpperCase();
  if (serieA && serieB && serieA === serieB) return { uid: b.uid, tipo: "igual", motivo: "N° de Serie", destino: b };
  const internoA = (a.nInterno || "").trim().toUpperCase();
  const internoB = (b.nInterno || "").trim().toUpperCase();
  if (internoA && internoB && internoA === internoB) return { uid: b.uid, tipo: "similar", motivo: "N° Interno", destino: b };
  if (a.marca && a.marca === b.marca && a.agenteExtintor === b.agenteExtintor && a.peso === b.peso) {
    return { uid: b.uid, tipo: "similar", motivo: "Marca + Agente + Peso", destino: b };
  }
  return null;
};

export default function FusionEmpresasModal({ isOpen, onClose, socket, empresas }: Props) {
  const { preview, cargandoPreview, cargarPreview, limpiarPreview, ejecutando, ejecutar, revertir, historial } = useFusionEmpresas(socket);

  const [paso, setPaso] = useState(0);
  const [empresaOrigenId, setEmpresaOrigenId] = useState("");
  const [empresaDestinoId, setEmpresaDestinoId] = useState("");
  const [sedeDestinoId, setSedeDestinoId] = useState<string>("");
  const [acciones, setAcciones] = useState<Record<string, { accion: AccionExtintor; destinoUid?: string }>>({});
  const [servicioIds, setServicioIds] = useState<Set<string>>(new Set());
  const [posiciones, setPosiciones] = useState<Record<string, number>>({});
  const [resultado, setResultado] = useState<{ logId: string } | null>(null);
  const [error, setError] = useState("");
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  const sedesHook = useSedes(socket, empresaDestinoId || undefined);

  useEffect(() => {
    if (!isOpen) return;
    setPaso(0);
    setEmpresaOrigenId("");
    setEmpresaDestinoId("");
    setSedeDestinoId("");
    setAcciones({});
    setServicioIds(new Set());
    setPosiciones({});
    setResultado(null);
    setError("");
    setMostrarHistorial(false);
    limpiarPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (preview) {
      setServicioIds(new Set(preview.servicios.map((s: any) => s.id)));
      if (preview.sedesDestino.length > 0) setSedeDestinoId(preview.sedesDestino[0].id);
    }
  }, [preview]);

  useEffect(() => {
    if (preview && paso === 0) irA(preview.sedesDestino.length > 0 ? 1 : 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  if (!isOpen) return null;

  const requiereSede = (preview?.sedesDestino?.length || sedesHook.sedes.length) > 0;
  const sedesDisponibles = sedesHook.sedes.length > 0 ? sedesHook.sedes : (preview?.sedesDestino || []);
  const sedeIdParaComparar = requiereSede ? (sedeDestinoId || null) : null;

  const destinoDeLaSede = preview ? preview.extintoresDestino.filter((d: any) => d.sedeId === sedeIdParaComparar) : [];
  const coincidenciaPorUid: Record<string, ReturnType<typeof compararExtintores>> = {};
  if (preview) {
    preview.extintoresOrigen.forEach((ext: any) => {
      let mejor: ReturnType<typeof compararExtintores> = null;
      for (const d of destinoDeLaSede) {
        const r = compararExtintores(ext, d);
        if (r?.tipo === "igual") { mejor = r; break; }
        if (r?.tipo === "similar" && !mejor) mejor = r;
      }
      coincidenciaPorUid[ext.uid] = mejor;
    });
  }

  const accionEfectiva = (ext: any): { accion: AccionExtintor; destinoUid?: string } => {
    if (acciones[ext.uid]) return acciones[ext.uid];
    const c = coincidenciaPorUid[ext.uid];
    return c?.tipo === "igual" ? { accion: "fusionar", destinoUid: c.uid } : { accion: "mover" };
  };

  const mesClaveDe = (fecha: string) => (fecha || "").slice(0, 7) || "sin-fecha";

  const destinoServiciosDelMes = (mesClave: string) => (preview?.serviciosDestino || [])
    .filter((sd: any) => sd.sedeId === sedeIdParaComparar && mesClaveDe(sd.fechaRetiro) === mesClave)
    .sort((a: any, b: any) => (a.secuencia ?? 0) - (b.secuencia ?? 0));

  const posicionMaximaPara = (servicioId: string, mesClave: string) => {
    const existentes = destinoServiciosDelMes(mesClave).length;
    const otrosMismoMesAntes = serviciosOrdenados.filter((s: any) => servicioIds.has(s.id) && s.id !== servicioId && mesClaveDe(s.fechaRetiro) === mesClave).length;
    return existentes + otrosMismoMesAntes + 1;
  };

  const posicionEfectiva = (servicioId: string, mesClave: string) => posiciones[servicioId] || posicionMaximaPara(servicioId, mesClave);

  const irA = (destino: number) => setPaso(destino);

  const siguienteDesdeEmpresas = () => {
    if (!empresaOrigenId || !empresaDestinoId || empresaOrigenId === empresaDestinoId) {
      setError("Selecciona dos empresas distintas");
      return;
    }
    setError("");
    cargarPreview(empresaOrigenId, empresaDestinoId, (ok, err) => {
      if (!ok) setError(err || "No se pudo cargar la comparación");
    });
  };

  const cambiarAccion = (uid: string, accion: AccionExtintor, destinoUid?: string) => {
    setAcciones((prev) => ({ ...prev, [uid]: { accion, destinoUid } }));
  };

  const toggleServicio = (id: string) => {
    setServicioIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const conteo = preview ? {
    mover: preview.extintoresOrigen.filter((e: any) => accionEfectiva(e).accion === "mover").length,
    fusionar: preview.extintoresOrigen.filter((e: any) => accionEfectiva(e).accion === "fusionar").length,
    omitir: preview.extintoresOrigen.filter((e: any) => accionEfectiva(e).accion === "omitir").length,
  } : { mover: 0, fusionar: 0, omitir: 0 };

  const serviciosOrdenados = preview ? preview.servicios : [];
  const historialSeleccionado = serviciosOrdenados.filter((s: any) => servicioIds.has(s.id));
  const historialPorMesSeleccionado = (() => {
    const mapa = new Map<string, number>();
    historialSeleccionado.forEach((s: any) => {
      const clave = (s.fechaRetiro || "").slice(0, 7) || "sin-fecha";
      mapa.set(clave, (mapa.get(clave) || 0) + 1);
    });
    return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b));
  })();

  const handleConfirmar = () => {
    const extintoresPayload = (preview?.extintoresOrigen || []).map((ext: any) => ({ uid: ext.uid, ...accionEfectiva(ext) }));
    const servicioPosiciones: Record<string, number> = {};
    Array.from(servicioIds).forEach((id) => {
      const s = serviciosOrdenados.find((x: any) => x.id === id);
      if (s) servicioPosiciones[id] = posicionEfectiva(id, mesClaveDe(s.fechaRetiro));
    });
    ejecutar({
      empresaOrigenId,
      empresaDestinoId,
      sedeDestinoId: requiereSede ? (sedeDestinoId || null) : null,
      extintores: extintoresPayload,
      servicioIds: Array.from(servicioIds),
      servicioPosiciones,
      ejecutadoPor: "dashboard",
    }, (ok, logId, err) => {
      if (ok) setResultado({ logId: logId || "" });
      else setError(err || "No se pudo ejecutar la fusión");
    });
  };

  const empresaOrigen = empresas.find((e) => e.id === empresaOrigenId);
  const empresaDestino = empresas.find((e) => e.id === empresaDestinoId);
  const nombreSedeDestino = sedesDisponibles.find((s: any) => s.id === sedeDestinoId)?.nombre;

  const campoResaltado = (motivo: string | undefined, campo: string) => !!motivo && motivo.includes(campo);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white">🔀 Unificar Empresas Duplicadas</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Fusiona sedes, extintores, servicios e historial de una empresa duplicada hacia la empresa oficial</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setMostrarHistorial((v) => !v)} className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300">
              {mostrarHistorial ? "← Volver" : "🕓 Fusiones anteriores"}
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300">✕</button>
          </div>
        </div>

        {mostrarHistorial ? (
          <div className="flex-1 overflow-y-auto p-6">
            {historial.length === 0 ? (
              <p className="text-sm text-zinc-500 text-center py-10">Todavía no se ha ejecutado ninguna fusión.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {historial.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between gap-3 bg-zinc-950/40 border border-zinc-800/60 rounded-xl px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-200 truncate">{log.empresaOrigenNombre} → {log.empresaDestinoNombre}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{new Date(log.createdAt).toLocaleString("es-PE")}{log.revertidoEn ? " · Revertida" : ""}</p>
                    </div>
                    {!log.revertidoEn && (
                      <button
                        onClick={() => {
                          if (!confirm("¿Revertir esta fusión y devolver todo a como estaba?")) return;
                          revertir(log.id, log.empresaOrigenId, log.empresaDestinoId);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-800/60 hover:bg-amber-700/60 text-xs font-bold text-amber-200 shrink-0"
                      >
                        ↺ Revertir
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : resultado ? (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center gap-4 text-center">
            <span className="text-5xl">✅</span>
            <p className="text-base font-bold text-zinc-100">Fusión completada correctamente</p>
            <p className="text-sm text-zinc-400 max-w-md">{empresaOrigen?.razonSocial} fue unificada dentro de {empresaDestino?.razonSocial}. Puedes revertir esta acción si algo no quedó como esperabas.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { if (confirm("¿Revertir la fusión recién realizada?")) revertir(resultado.logId, empresaOrigenId, empresaDestinoId, (ok) => { if (ok) onClose(); }); }}
                className="px-4 py-2.5 rounded-xl bg-amber-800/60 hover:bg-amber-700/60 text-sm font-bold text-amber-200"
              >
                ↺ Deshacer fusión
              </button>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-zinc-200">Cerrar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-stretch justify-between px-6 pt-4 pb-2 shrink-0">
              {PASOS.map((titulo, i) => {
                const activo = paso === i;
                const completado = i < paso;
                const bloqueado = i > 0 && !preview;
                return (
                  <button
                    key={titulo}
                    disabled={bloqueado}
                    onClick={() => !bloqueado && irA(i)}
                    className="flex-1 flex flex-col items-center gap-1.5 group disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${activo ? "bg-red-700 text-white shadow-md" : completado ? "bg-emerald-800/70 text-emerald-100" : "bg-zinc-800 text-zinc-500"}`}>
                      {completado ? "✓" : i + 1}
                    </span>
                    <span className={`text-[9px] font-bold ${activo ? "text-zinc-200" : "text-zinc-600"}`}>{titulo}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
              {error && <p className="text-xs font-bold text-red-400 bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5">⚠️ {error}</p>}

              {paso === 0 && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">Empresa origen (duplicada, se archivará su información)</label>
                      <select value={empresaOrigenId} onChange={(e) => setEmpresaOrigenId(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-600">
                        <option value="">Selecciona una empresa...</option>
                        {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial}{e.ruc ? ` · ${e.ruc}` : ""}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">Empresa destino (oficial, conserva sus datos)</label>
                      <select value={empresaDestinoId} onChange={(e) => setEmpresaDestinoId(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-600">
                        <option value="">Selecciona una empresa...</option>
                        {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial}{e.ruc ? ` · ${e.ruc}` : ""}</option>)}
                      </select>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-500">El nombre, RUC y demás datos generales de la empresa destino no se modifican. Solo se trasladan sedes, extintores, servicios e historial de la empresa origen.</p>
                </div>
              )}

              {paso === 1 && preview && (
                <div className="flex flex-col gap-3">
                  {!requiereSede ? (
                    <p className="text-sm text-zinc-400">{empresaDestino?.razonSocial} no tiene sedes registradas todavía; este paso no aplica.</p>
                  ) : (
                    <>
                      <label className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">¿A qué sede de {empresaDestino?.razonSocial} se trasladarán los datos?</label>
                      <select value={sedeDestinoId} onChange={(e) => setSedeDestinoId(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-600">
                        {sedesDisponibles.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                      </select>
                      <button onClick={sedesHook.openCreateSede} className="self-start px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200">
                        + Crear nueva sede
                      </button>
                      <p className="text-[11px] text-zinc-500">Los extintores de la sede origen solo se compararán contra los extintores ya registrados en esta sede destino.</p>
                    </>
                  )}
                </div>
              )}

              {paso === 2 && preview && (
                <div className="flex flex-col gap-4">
                  <p className="text-[11px] text-zinc-500">
                    Comparando contra los extintores de {requiereSede ? `la sede "${nombreSedeDestino || "—"}"` : `${empresaDestino?.razonSocial}`}. Los campos resaltados son los que generan la coincidencia.
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-zinc-800/60">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-zinc-900/60 border-b border-zinc-800/60 text-left">
                          <th className="px-3 py-2.5 font-black text-zinc-500 uppercase text-[10px]" colSpan={2}>Extintor origen</th>
                          <th className="px-3 py-2.5 font-black text-emerald-500 uppercase text-[10px]" colSpan={2}>Coincide con (destino)</th>
                          <th className="px-3 py-2.5 font-black text-zinc-500 uppercase text-[10px]">Acción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.extintoresOrigen.map((ext: any) => {
                          const actual = accionEfectiva(ext);
                          const coincidencia = coincidenciaPorUid[ext.uid];
                          const destino = coincidencia?.destino;
                          return (
                            <tr key={ext.uid} className="border-b border-zinc-800/40 last:border-0 align-top">
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <p className={`font-bold ${campoResaltado(coincidencia?.motivo, "Serie") ? "text-amber-300" : "text-zinc-200"}`}>{ext.nSerie || "—"}</p>
                                <p className="text-zinc-500">{ext.nInterno || "—"}</p>
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <p className={`${campoResaltado(coincidencia?.motivo, "Marca") || campoResaltado(coincidencia?.motivo, "Agente") ? "text-amber-300 font-bold" : "text-zinc-400"}`}>{ext.marca || "—"} · {ext.agenteExtintor || "—"}</p>
                                <p className={`${campoResaltado(coincidencia?.motivo, "Peso") ? "text-amber-300 font-bold" : "text-zinc-500"}`}>{ext.peso ? `${ext.peso} ${ext.unidadPeso}` : "—"}</p>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${estadoColor[ext.estadoExtintor] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{ext.estadoExtintor || "—"}</span>
                              </td>
                              {destino ? (
                                <>
                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                    <p className={`font-bold ${campoResaltado(coincidencia?.motivo, "Serie") ? "text-amber-300" : "text-zinc-200"}`}>{destino.nSerie || "—"}</p>
                                    <p className="text-zinc-500">{destino.nInterno || "—"}</p>
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                    <p className={`${campoResaltado(coincidencia?.motivo, "Marca") || campoResaltado(coincidencia?.motivo, "Agente") ? "text-amber-300 font-bold" : "text-zinc-400"}`}>{destino.marca || "—"} · {destino.agenteExtintor || "—"}</p>
                                    <p className={`${campoResaltado(coincidencia?.motivo, "Peso") ? "text-amber-300 font-bold" : "text-zinc-500"}`}>{destino.peso ? `${destino.peso} ${destino.unidadPeso}` : "—"}</p>
                                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${coincidencia.tipo === "igual" ? "bg-emerald-950/40 text-emerald-300 border-emerald-900/50" : "bg-amber-950/40 text-amber-300 border-amber-900/50"}`}>
                                      {coincidencia.tipo === "igual" ? "✓ Igual" : "≈ Similar"} · {coincidencia.motivo}
                                    </span>
                                  </td>
                                </>
                              ) : (
                                <td className="px-3 py-2.5 text-zinc-600" colSpan={2}>Sin coincidencia en esta sede</td>
                              )}
                              <td className="px-3 py-2.5">
                                <select
                                  value={actual.accion}
                                  onChange={(e) => cambiarAccion(ext.uid, e.target.value as AccionExtintor, coincidencia?.uid)}
                                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
                                >
                                  <option value="mover">Mover como nuevo</option>
                                  {coincidencia && <option value="fusionar">Fusionar con destino</option>}
                                  <option value="omitir">Omitir (dejar en origen)</option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-md bg-zinc-800 text-[11px] font-bold text-zinc-300">Mover: {conteo.mover}</span>
                    <span className="px-2.5 py-1 rounded-md bg-emerald-950/40 text-[11px] font-bold text-emerald-300">Fusionar: {conteo.fusionar}</span>
                    <span className="px-2.5 py-1 rounded-md bg-zinc-800 text-[11px] font-bold text-zinc-400">Omitir: {conteo.omitir}</span>
                  </div>
                </div>
              )}

              {paso === 3 && preview && (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] text-zinc-500">Selecciona los servicios de {empresaOrigen?.razonSocial} que se trasladarán a {empresaDestino?.razonSocial}. Los servicios que ya existan en el mes de destino conservan prioridad; puedes elegir en qué posición queda cada uno.</p>
                  {serviciosOrdenados.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-6 text-center">Esta empresa no tiene servicios registrados.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                      {serviciosOrdenados.map((s: any, idx: number) => {
                        const seleccionado = servicioIds.has(s.id);
                        const mesClave = mesClaveDe(s.fechaRetiro);
                        const existentesDestino = destinoServiciosDelMes(mesClave).length;
                        const maxPos = posicionMaximaPara(s.id, mesClave);
                        return (
                          <div
                            key={s.id}
                            className={`flex flex-col gap-2 p-4 rounded-2xl border transition-all ${seleccionado ? "bg-zinc-900/60 border-red-700/60" : "bg-zinc-950/30 border-zinc-800/60 opacity-60"}`}
                          >
                            <button onClick={() => toggleServicio(s.id)} className="flex items-center justify-between text-left">
                              <span className="text-sm font-black text-white">{ordinalServicio(idx + 1)} Servicio · {mesAnioLabel(s.fechaRetiro)}</span>
                              <input type="checkbox" checked={seleccionado} onChange={() => toggleServicio(s.id)} className="accent-red-600 w-4 h-4" />
                            </button>
                            <p className="text-xs font-bold text-zinc-400">{s.cantidadExtintores} extintor{s.cantidadExtintores === 1 ? "" : "es"} · Retiro {s.fechaRetiro ? s.fechaRetiro.split("-").reverse().join("/") : "—"}</p>
                            {s.notas && <p className="text-xs text-zinc-500 italic truncate">{s.notas}</p>}
                            {seleccionado && existentesDestino > 0 && (
                              <div className="flex items-center gap-2 pt-1">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Posición en destino</span>
                                <select
                                  value={posicionEfectiva(s.id, mesClave)}
                                  onChange={(e) => setPosiciones((prev) => ({ ...prev, [s.id]: Number(e.target.value) }))}
                                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-200"
                                >
                                  {Array.from({ length: maxPos }, (_, i) => i + 1).map((p) => (
                                    <option key={p} value={p}>{p === maxPos ? `${ordinalServicio(p)} (al final)` : ordinalServicio(p)}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {paso === 4 && preview && (
                <div className="flex flex-col gap-3">
                  <p className="text-[11px] text-zinc-500">Estos historiales mensuales se transferirán completos, sin perder información.</p>
                  {historialPorMesSeleccionado.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-14 text-zinc-500 bg-zinc-900/20 rounded-2xl border border-dashed border-zinc-800">
                      <span className="text-4xl opacity-80">📜</span>
                      <p className="text-sm font-medium">No hay servicios seleccionados para transferir.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {historialPorMesSeleccionado.map(([mes, cantidad]) => {
                        const [anio, mesNum] = mes.split("-");
                        const label = mes === "sin-fecha" ? "Sin fecha" : MESES.find((m) => m.value === String(Number(mesNum)))?.label || mes;
                        return (
                          <div key={mes} className="flex flex-col gap-2 p-4 rounded-2xl border bg-red-950/20 border-red-900/40">
                            <div className="flex items-center justify-between">
                              <span className="text-base font-black text-white">{label}</span>
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                            </div>
                            <span className="text-xs font-bold text-red-400">{cantidad} servicio{cantidad === 1 ? "" : "s"}{anio && mes !== "sin-fecha" ? ` · ${anio}` : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {paso === 5 && preview && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-bold text-zinc-200">Resumen de la fusión</p>
                  <div className="flex flex-col gap-1.5 text-xs text-zinc-400 bg-zinc-950/40 border border-zinc-800/60 rounded-xl p-4">
                    <p><span className="text-zinc-200 font-bold">{empresaOrigen?.razonSocial}</span> se unificará dentro de <span className="text-zinc-200 font-bold">{empresaDestino?.razonSocial}</span>{requiereSede && sedeDestinoId ? ` (sede: ${nombreSedeDestino || "—"})` : ""}.</p>
                    <p>{conteo.mover} extintor{conteo.mover === 1 ? "" : "es"} se moverán como nuevos, {conteo.fusionar} se fusionarán con su equivalente, {conteo.omitir} se omiten.</p>
                    <p>{servicioIds.size} servicio{servicioIds.size === 1 ? "" : "s"} de historial se transferirán, conservando fechas, extintores y evidencias.</p>
                    <p>Los datos generales (nombre, RUC, dirección) de {empresaDestino?.razonSocial} no se modifican.</p>
                  </div>
                  <p className="text-[11px] text-amber-400 font-bold">Esta acción puede revertirse después desde "Fusiones anteriores" si algo no queda correcto.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-zinc-800 flex justify-between gap-2 shrink-0">
              <button
                onClick={() => (paso === 0 ? onClose() : irA(paso === 2 && !requiereSede ? 0 : paso - 1))}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-zinc-300"
              >
                {paso === 0 ? "Cancelar" : "← Atrás"}
              </button>
              {paso === 0 ? (
                <button onClick={siguienteDesdeEmpresas} disabled={cargandoPreview} className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold text-white disabled:opacity-50">
                  {cargandoPreview ? "Comparando..." : "Comparar empresas →"}
                </button>
              ) : paso === 5 ? (
                <button onClick={handleConfirmar} disabled={ejecutando} className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold text-white disabled:opacity-50">
                  {ejecutando ? "Fusionando..." : "✅ Confirmar fusión"}
                </button>
              ) : (
                <button
                  onClick={() => irA(paso + 1)}
                  className="px-5 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold text-white"
                >
                  Siguiente →
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <SedeModal
        isOpen={sedesHook.sedeModal}
        form={sedesHook.editingSede}
        setForm={sedesHook.setEditingSede}
        onClose={() => sedesHook.setSedeModal(false)}
        onSave={() => sedesHook.saveSede()}
        saving={sedesHook.savingSede}
      />
    </div>
  );
}