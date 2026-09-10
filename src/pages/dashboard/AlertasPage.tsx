import { useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { Link } from "react-router-dom";
import { useAlertas } from "../../hooks/dashboard/useAlertas";
import { estadoColor, CLASIFICACION_FILTROS, type ClasificacionFiltro } from "../../utils/helpers";
import { MESES } from "../../constants/meses";

const numeroWhatsapp = (celular: string) => {
  let num = (celular || "").replace(/\D/g, "");
  if (num.length === 9 && num.startsWith("9")) num = "51" + num;
  return num;
};

const MOSTRAR_ALERTAS_PH = false;
const MOSTRAR_SERVICIO_PROXIMO = true;
const ANIO_ALERTAS = new Date().getFullYear() + 1;

const filtrarAlertaVisible = (alertas: any[]) => alertas
  .map((a: any) => ({
    ...a,
    ph: MOSTRAR_ALERTAS_PH ? a.ph : null,
    revision: a.revision && (MOSTRAR_SERVICIO_PROXIMO || a.revision.vencido) ? a.revision : null,
  }))
  .map((a: any) => ({ ...a, vencido: !!(a.revision?.vencido || a.ph?.vencido) }))
  .filter((a: any) => a.revision || a.ph);

const clasificarEmpresa = (empresa: any, filtro: ClasificacionFiltro): boolean => {
  if (!filtro) return true;
  if (filtro === "multisede") return empresa.sedes.length > 1;
  if (filtro === "sin_clasificar") return !empresa.tipoCliente;
  return empresa.tipoCliente === filtro;
};

const MotivoBadge = ({ label, vencido, tono }: { label: string; vencido: boolean; tono: "ambar" | "azul" }) => {
  const colores = vencido
    ? "text-red-400 bg-red-950/30 border-red-900/40"
    : tono === "ambar"
      ? "text-amber-400 bg-amber-950/30 border-amber-900/40"
      : "text-sky-400 bg-sky-950/30 border-sky-900/40";
  return <span className={`text-[10px] font-black px-2 py-1 rounded-md border whitespace-nowrap ${colores}`}>{vencido ? "🔴" : tono === "ambar" ? "🟡" : "🔵"} {label}</span>;
};

function AlertaRow({ a, onDescartar }: { a: any; onDescartar: (uid: string, motivo: string) => void }) {
  const [descartando, setDescartando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const confirmarDescarte = () => {
    onDescartar(a.uid, motivo.trim());
    setDescartando(false);
    setMotivo("");
  };

  return (
    <>
      <tr className={`border-b border-zinc-800/40 last:border-0 ${a.vencido ? "bg-red-950/10" : ""}`}>
        <td className="px-3 py-2.5 text-xs font-bold text-zinc-200 whitespace-nowrap">{a.nSerie || "—"}</td>
        <td className="px-3 py-2.5 text-xs text-zinc-400 whitespace-nowrap">{a.nInterno || "—"}</td>
        <td className="px-3 py-2.5 text-xs text-zinc-400 whitespace-nowrap max-w-32 truncate">{a.marca || "—"}</td>
        <td className="px-3 py-2.5 text-xs text-zinc-400 whitespace-nowrap">{a.agente || "—"}</td>
        <td className="px-3 py-2.5 text-xs text-zinc-400 whitespace-nowrap">{a.capacidad || "—"}</td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${estadoColor[a.estado] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{a.estado || "—"}</span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {a.revision && (
              <MotivoBadge label={a.revision.vencido ? `Servicio vencido — ${a.revision.vence}` : `Servicio/recarga por vencer: ${a.revision.vence}`} vencido={a.revision.vencido} tono="ambar" />
            )}
            {a.ph && (
              <MotivoBadge label={a.ph.vencido ? `PH vencida — ${a.ph.vence}` : `PH por vencer: ${a.ph.vence}`} vencido={a.ph.vencido} tono="azul" />
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-right whitespace-nowrap">
          <button onClick={() => setDescartando((v) => !v)} className="text-[11px] font-bold text-zinc-500 hover:text-zinc-300 px-2.5 py-1 rounded-lg hover:bg-zinc-800/60">
            🔕 Descartar
          </button>
        </td>
      </tr>
      {descartando && (
        <tr className="border-b border-zinc-800/40 last:border-0 bg-zinc-950/40">
          <td colSpan={8} className="px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-zinc-500">El cliente no continuará o no responde. Motivo (opcional):</span>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: Cliente no responde hace 2 meses" className="flex-1 min-w-40 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-red-600" />
              <button onClick={confirmarDescarte} className="text-[11px] font-bold text-white bg-red-700 hover:bg-red-600 px-3 py-1.5 rounded-lg">Confirmar</button>
              <button onClick={() => setDescartando(false)} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg">Cancelar</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function TablaAlertas({ alertas, onDescartar }: { alertas: any[]; onDescartar: (uid: string, motivo: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800/60">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-zinc-900/60 border-b border-zinc-800/60">
            <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Serie</th>
            <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">N° Interno</th>
            <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Marca</th>
            <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Agente</th>
            <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Peso</th>
            <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Estado</th>
            <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Motivo de la alerta</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {alertas.map((a: any) => <AlertaRow key={a.uid} a={a} onDescartar={onDescartar} />)}
        </tbody>
      </table>
    </div>
  );
}

function TablaAlertasPorMes({ alertas, onDescartar }: { alertas: any[]; onDescartar: (uid: string, motivo: string) => void }) {
  const grupos = new Map<string, any[]>();
  alertas.forEach((a: any) => {
    const clave = a.revision?.vence || "Sin mes definido";
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(a);
  });
  const entradas = Array.from(grupos.entries()).sort(([, ga], [, gb]) => (ga[0]?.revision?.dias ?? 0) - (gb[0]?.revision?.dias ?? 0));

  return (
    <div className="flex flex-col gap-3">
      {entradas.map(([mes, lista]) => (
        <div key={mes} className="flex flex-col gap-2">
          <p className="text-xs font-black text-zinc-400 uppercase tracking-wide px-1">🗓️ {mes} <span className="text-zinc-600 font-bold normal-case">({lista.length})</span></p>
          <TablaAlertas alertas={lista} onDescartar={onDescartar} />
        </div>
      ))}
    </div>
  );
}

function SilenciarEmpresaBoton({ empresaId, onDescartar }: { empresaId: string; onDescartar: (empresaId: string, motivo: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");

  const confirmar = () => {
    onDescartar(empresaId, motivo.trim());
    setAbierto(false);
    setMotivo("");
  };

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="text-xs font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800">🔕 Silenciar empresa</button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" className="flex-1 min-w-40 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-red-600" />
      <button onClick={confirmar} className="text-xs font-bold text-white bg-red-700 hover:bg-red-600 px-3 py-1.5 rounded-lg">Confirmar</button>
      <button onClick={() => setAbierto(false)} className="text-xs font-bold text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg">Cancelar</button>
    </div>
  );
}

function EmpresasSilenciadasPanel({ empresas, onReactivar }: { empresas: any[]; onReactivar: (empresaId: string) => void }) {
  if (empresas.length === 0) return null;
  return (
    <div className="mt-8 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
        <h2 className="text-base font-black text-zinc-100">🔕 Empresas con Alertas Silenciadas</h2>
        <p className="text-xs text-zinc-500 mt-1">{empresas.length} empresa{empresas.length === 1 ? "" : "s"} silenciada{empresas.length === 1 ? "" : "s"}</p>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {empresas.map((e: any) => (
          <div key={e.empresaId} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-zinc-200 truncate">{e.razonSocial}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{e.tipoCliente === "persona" ? "DNI" : "RUC"} {e.ruc || "—"}{e.motivo && ` · ${e.motivo}`}</p>
            </div>
            <button onClick={() => onReactivar(e.empresaId)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-900/40 shrink-0">✅ Reactivar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExtintoresSilenciadosPanel({ extintores, onReactivar }: { extintores: any[]; onReactivar: (uid: string) => void }) {
  if (extintores.length === 0) return null;
  return (
    <div className="mt-8 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/60">
        <h2 className="text-base font-black text-zinc-100">🔕 Extintores con Alerta Silenciada</h2>
        <p className="text-xs text-zinc-500 mt-1">{extintores.length} extintor{extintores.length === 1 ? "" : "es"} silenciado{extintores.length === 1 ? "" : "s"}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-zinc-900/60 border-b border-zinc-800/60">
              <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Empresa</th>
              <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Serie</th>
              <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">N° Interno</th>
              <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Marca</th>
              <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Estado</th>
              <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Motivo</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {extintores.map((e: any) => (
              <tr key={e.uid} className="border-b border-zinc-800/40 last:border-0">
                <td className="px-3 py-2.5 text-xs font-bold text-zinc-200 whitespace-nowrap">{e.razonSocial}{e.sedeNombre && <span className="text-zinc-500 font-normal"> · {e.sedeNombre}</span>}</td>
                <td className="px-3 py-2.5 text-xs text-zinc-400 whitespace-nowrap">{e.nSerie || "—"}</td>
                <td className="px-3 py-2.5 text-xs text-zinc-400 whitespace-nowrap">{e.nInterno || "—"}</td>
                <td className="px-3 py-2.5 text-xs text-zinc-400 whitespace-nowrap max-w-32 truncate">{e.marca || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${estadoColor[e.estado] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{e.estado || "—"}</span>
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500">{e.motivo || "—"}</td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <button onClick={() => onReactivar(e.uid)} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-900/40">✅ Reactivar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AlertasPage({ socket }: { socket: Socket | null }) {
  const {
    empresas, loading, recargar,
    descartarAlerta, reactivarAlerta, descartarAlertaEmpresa, reactivarAlertaEmpresa,
    empresasSilenciadas, extintoresSilenciados,
  } = useAlertas(socket);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "vencidas" | "proximas">("todas");
  const [fTipo, setFTipo] = useState<ClasificacionFiltro>("");
  const [mesSeleccionado, setMesSeleccionado] = useState<number | "">("");

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const mensajeWhatsapp = (razonSocial: string, alertas: any[]) => {
    const lineas = alertas.slice(0, 5).map((a) => {
      const motivo = a.revision && a.ph ? "Revisión y Prueba Hidrostática" : a.revision ? "Revisión anual" : "Prueba Hidrostática";
      return `• ${motivo} — ${a.nInterno || a.nSerie || "extintor"}`;
    });
    return encodeURIComponent(`Hola, le escribimos de FAMA para coordinar el servicio de sus extintores en ${razonSocial}:\n${lineas.join("\n")}`);
  };

  const empresasVisibles = useMemo(() => empresas
    .map((empresa: any) => {
      const sedes = empresa.sedes
        .map((sede: any) => ({ ...sede, alertas: filtrarAlertaVisible(sede.alertas) }))
        .filter((sede: any) => sede.alertas.length > 0);
      return { ...empresa, sedes };
    })
    .filter((empresa: any) => empresa.sedes.length > 0), [empresas]);

  const empresasPorClasificacionYBusqueda = empresasVisibles
    .filter((empresa: any) => clasificarEmpresa(empresa, fTipo))
    .filter((empresa: any) => !busqueda.trim() || empresa.razonSocial.toLowerCase().includes(busqueda.trim().toLowerCase()));

  const aplicarFiltroEstado = (alertas: any[]) => alertas.filter((a: any) => filtroEstado === "todas" || (filtroEstado === "vencidas" ? a.vencido : !a.vencido));

  const alertasPorClasificacionYBusqueda = empresasPorClasificacionYBusqueda.flatMap((e: any) => e.sedes.flatMap((s: any) => s.alertas));
  const poolPorEstado = aplicarFiltroEstado(alertasPorClasificacionYBusqueda);
  const totalTodosLosMeses = poolPorEstado.length;

  const conteoMeses = useMemo(() => {
    const conteo: Record<number, number> = {};
    for (const a of poolPorEstado) {
      if (a.revision?.anio === ANIO_ALERTAS) {
        conteo[a.revision.mes] = (conteo[a.revision.mes] || 0) + 1;
      }
    }
    return conteo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresasPorClasificacionYBusqueda, filtroEstado]);

  const poolPorMes = mesSeleccionado === ""
    ? alertasPorClasificacionYBusqueda
    : alertasPorClasificacionYBusqueda.filter((a: any) => a.revision?.mes === mesSeleccionado && a.revision?.anio === ANIO_ALERTAS);
  const totalPoolMes = poolPorMes.length;
  const vencidasPoolMes = poolPorMes.filter((a: any) => a.vencido).length;
  const proximasPoolMes = totalPoolMes - vencidasPoolMes;

  const empresasFiltradas = empresasPorClasificacionYBusqueda
    .map((empresa: any) => {
      const sedes = empresa.sedes
        .map((sede: any) => ({
          ...sede,
          alertas: aplicarFiltroEstado(sede.alertas)
            .filter((a: any) => mesSeleccionado === "" || (a.revision?.mes === mesSeleccionado && a.revision?.anio === ANIO_ALERTAS)),
        }))
        .filter((sede: any) => sede.alertas.length > 0);
      return { ...empresa, sedes };
    })
    .filter((empresa: any) => empresa.sedes.length > 0);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50">
        <div>
          <h1 className="text-xl font-black text-white">🔔 Alertas de Vencimiento</h1>
          <p className="text-xs text-zinc-500 mt-1">{MOSTRAR_ALERTAS_PH ? "Servicio/recarga y Prueba Hidrostática por vencer" : "Servicio vencido (1 año desde el último servicio)"}</p>
        </div>
        <button onClick={recargar} className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-sm font-bold text-zinc-300 self-start md:self-auto">🔄 Actualizar</button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <button onClick={() => setFiltroEstado("todas")} className={`px-4 py-3 rounded-2xl border text-left transition-all ${filtroEstado === "todas" ? "bg-zinc-800 border-zinc-600" : "bg-zinc-900/30 border-zinc-800/60 hover:border-zinc-700"}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{mesSeleccionado === "" ? "Todos" : "Todos · mes"}</p>
          <p className="text-2xl font-black text-white">{totalPoolMes}</p>
        </button>
        <button onClick={() => setFiltroEstado("vencidas")} className={`px-4 py-3 rounded-2xl border text-left transition-all ${filtroEstado === "vencidas" ? "bg-red-950/40 border-red-700" : "bg-red-950/20 border-red-900/40 hover:border-red-800"}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-400">🔴 Vencidos</p>
          <p className="text-2xl font-black text-red-400">{vencidasPoolMes}</p>
        </button>
        <button onClick={() => setFiltroEstado("proximas")} className={`px-4 py-3 rounded-2xl border text-left transition-all ${filtroEstado === "proximas" ? "bg-amber-950/40 border-amber-700" : "bg-amber-950/20 border-amber-900/40 hover:border-amber-800"}`}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">🟡 Próximos</p>
          <p className="text-2xl font-black text-amber-400">{proximasPoolMes}</p>
        </button>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm pointer-events-none">🔎</span>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar empresa..." className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-red-600" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CLASIFICACION_FILTROS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFTipo(f.value)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${fTipo === f.value ? "bg-red-600 border-red-600 text-white" : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 bg-zinc-900/20 p-4 rounded-2xl border border-zinc-800/40">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Mes de vencimiento {ANIO_ALERTAS}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <button
            onClick={() => setMesSeleccionado("")}
            className={`flex flex-col items-start gap-1 px-3.5 py-3 rounded-xl border transition-all ${mesSeleccionado === "" ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/30" : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-600"}`}
          >
            <span className="text-xs font-black">Todos</span>
            <span className={`text-lg font-black ${mesSeleccionado === "" ? "text-white" : "text-zinc-500"}`}>{totalTodosLosMeses}</span>
          </button>
          {MESES.map((m) => {
            const mesNum = Number(m.value);
            const total = conteoMeses[mesNum] || 0;
            const activo = mesSeleccionado === mesNum;
            return (
              <button
                key={m.value}
                onClick={() => setMesSeleccionado(mesNum)}
                disabled={total === 0}
                className={`flex flex-col items-start gap-1 px-3.5 py-3 rounded-xl border transition-all ${activo ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-900/30" : total === 0 ? "bg-zinc-950/40 border-zinc-900 text-zinc-700 cursor-not-allowed" : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-600"}`}
              >
                <span className="text-xs font-black">{m.label}</span>
                <span className={`text-lg font-black ${activo ? "text-white" : total === 0 ? "text-zinc-800" : "text-zinc-500"}`}>{total}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6 flex items-start gap-2.5 bg-zinc-900/20 px-4 py-3 rounded-xl border border-zinc-800/40">
        <span className="text-sm shrink-0">ℹ️</span>
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          El servicio/recarga aplica a cualquier trabajo o venta (Recarga, Mantenimiento, etc.) por igual y se considera vencido 1 año después del último servicio. La próxima alerta se calcula con el mismo mes en que corresponde el servicio (ej: servicio en Enero {ANIO_ALERTAS} → próxima alerta Enero {ANIO_ALERTAS + 1}).{MOSTRAR_ALERTAS_PH ? " La Prueba Hidrostática vence cada 5 años según el dato ya registrado en el extintor." : ""} Al descartar una alerta, esta deja de mostrarse hasta que se registre un nuevo servicio sobre ese extintor.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : empresasFiltradas.length === 0 ? (
        <div className="text-center py-20 text-zinc-600 bg-zinc-950/20 rounded-2xl border border-dashed border-zinc-800/60">
          <p className="text-5xl mb-3 opacity-80">{busqueda || fTipo || mesSeleccionado !== "" ? "🔎" : "✅"}</p>
          <p className="text-sm font-medium">{busqueda || fTipo || mesSeleccionado !== "" ? "Ninguna empresa coincide con los filtros aplicados" : "No hay vencimientos próximos en el rango seleccionado"}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {empresasFiltradas.map((empresa: any) => {
            const sedesNombradas = empresa.sedes.filter((s: any) => s.nombre);
            const esMultisede = empresa.sedes.length > 1;
            const sedeUnica = sedesNombradas.length === 1 && empresa.sedes.length === 1 ? sedesNombradas[0].nombre : null;
            const icono = esMultisede ? "🏬" : empresa.tipoCliente === "persona" ? "👤" : "🏢";
            const todasLasAlertas = empresa.sedes.flatMap((s: any) => s.alertas);
            const vencidasEmpresa = todasLasAlertas.filter((a: any) => a.vencido).length;
            const isOpen = expanded[empresa.empresaId];
            return (
              <div key={empresa.empresaId} className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm">
                <button onClick={() => toggle(empresa.empresaId)} className={`w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 text-left transition-colors ${isOpen ? "bg-zinc-800/40 border-b border-zinc-800/80" : "bg-zinc-900/60 hover:bg-zinc-800/60"}`}>
                  <div className="min-w-0">
                    <p className="text-base font-black text-zinc-100 truncate">{icono} {empresa.razonSocial}{esMultisede && <span className="ml-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest align-middle">Multisede</span>}</p>
                    <p className="text-xs text-zinc-500 font-medium mt-1">
                      {empresa.nombresApellidos || "Sin contacto"} · {empresa.celular || "Sin celular"}
                      {sedeUnica && ` · 📍 ${sedeUnica}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {vencidasEmpresa > 0 && <span className="text-xs font-bold text-red-400 bg-red-950/30 border border-red-900/30 px-3 py-1 rounded-lg">{vencidasEmpresa} vencido{vencidasEmpresa !== 1 ? "s" : ""}</span>}
                    {todasLasAlertas.length - vencidasEmpresa > 0 && <span className="text-xs font-bold text-amber-400 bg-amber-950/30 border border-amber-900/30 px-3 py-1 rounded-lg">{todasLasAlertas.length - vencidasEmpresa} próximo{todasLasAlertas.length - vencidasEmpresa !== 1 ? "s" : ""}</span>}
                    <div className={`w-8 h-8 rounded-full bg-zinc-950/50 border border-zinc-800 flex items-center justify-center text-zinc-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>▼</div>
                  </div>
                </button>

                {isOpen && (
                  <div className="p-5 flex flex-col gap-4 bg-zinc-950/20">
                    <div className="flex flex-wrap items-center justify-between gap-2 -mt-1">
                      <Link to={`/dashboard/${empresa.slug}`} className="text-xs font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg bg-zinc-800/60 hover:bg-zinc-800">Ver registro completo</Link>
                      <div className="flex flex-wrap items-center gap-2">
                        {!esMultisede && empresa.celular && (
                          <a href={`https://wa.me/${numeroWhatsapp(empresa.celular)}?text=${mensajeWhatsapp(empresa.razonSocial, todasLasAlertas)}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-900/40">📲 Contactar</a>
                        )}
                        <SilenciarEmpresaBoton empresaId={empresa.empresaId} onDescartar={descartarAlertaEmpresa} />
                      </div>
                    </div>

                    {esMultisede ? (
                      empresa.sedes.map((sede: any) => {
                        const sedeKey = `${empresa.empresaId}::${sede.sedeId || "sin-sede"}`;
                        const sedeAbierta = !!expanded[sedeKey];
                        return (
                          <div key={sede.sedeId || "__sin_sede__"} className="rounded-xl border border-zinc-800/60 overflow-hidden">
                            <button onClick={() => toggle(sedeKey)} className={`w-full px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-left transition-colors ${sedeAbierta ? "bg-zinc-800/40" : "bg-zinc-900/60 hover:bg-zinc-800/60"}`}>
                              <span className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full bg-zinc-950/50 border border-zinc-800 flex items-center justify-center text-zinc-400 text-[10px] transition-transform duration-300 ${sedeAbierta ? "rotate-180" : ""}`}>▼</span>
                                <span className="text-sm font-bold text-zinc-200">{sede.nombre ? `📍 ${sede.nombre}` : "Sin sede asignada"}</span>
                                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-950/40 px-1.5 py-0.5 rounded-md">{sede.alertas.length}</span>
                              </span>
                              {empresa.celular && (
                                <a href={`https://wa.me/${numeroWhatsapp(empresa.celular)}?text=${mensajeWhatsapp(empresa.razonSocial, sede.alertas)}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs font-bold text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/40 border border-emerald-900/40">📲 Contactar</a>
                              )}
                            </button>
                            {sedeAbierta && (
                              <div className="p-3 bg-zinc-950/20">
                                {mesSeleccionado === "" ? (
                                  <TablaAlertasPorMes alertas={sede.alertas} onDescartar={descartarAlerta} />
                                ) : (
                                  <TablaAlertas alertas={sede.alertas} onDescartar={descartarAlerta} />
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : mesSeleccionado === "" ? (
                      <TablaAlertasPorMes alertas={todasLasAlertas} onDescartar={descartarAlerta} />
                    ) : (
                      <TablaAlertas alertas={todasLasAlertas} onDescartar={descartarAlerta} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <EmpresasSilenciadasPanel empresas={empresasSilenciadas} onReactivar={reactivarAlertaEmpresa} />
      <ExtintoresSilenciadosPanel extintores={extintoresSilenciados} onReactivar={reactivarAlerta} />
    </div>
  );
}