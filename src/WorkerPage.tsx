import { useState, useEffect, useRef, useCallback } from "react";
import { ESTADOS, PESOS_KG, PESOS_LB, PESOS_LT, COMP_KEYS, COMP_LABELS, DISTRITOS_LIMA } from "./constants";
import type { EmpresaItem, EmpresaData, Extintor, FormData, WorkerView as View } from "./types";
import { emptyForm, emptyEmpresa } from "./utils/helpers";
import { useSocket } from "./hooks/useSocket";
import { Card, Field, Toggle, SiNo, inputCls } from "./components/ui/WorkerUI";
import { CreatableSelect } from "./components/ui/CreatableSelect";
import { MultiSelect } from "./components/ui/MultiSelect";

export default function App({ user, onLogout }: { user: { id: string; username: string; role: string; displayName: string }; onLogout: () => void }) {
  const { socket, connected, catalogs } = useSocket(user.id, onLogout);
  const MARCAS = catalogs.marcas.map((c) => c.value).sort((a, b) => a.localeCompare(b, "es"));
  const AGENTES = catalogs.agentes.map((c) => c.value).sort((a, b) => a.localeCompare(b, "es"));
  const RECARGAS = catalogs.recargas.map((c) => c.value);
  const MOTIVOS_BAJA = catalogs.motivosBaja.map((c) => c.value);
  const SERVICIOS_EXTRA = catalogs.serviciosExtra.map((c) => c.value);

  const [view, setView] = useState<View>("home");

  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [activeId, setActiveId] = useState("");
  const activeIdRef = useRef("");
  const [empresa, setEmpresa] = useState<EmpresaData>(emptyEmpresa());

  const [extintores, setExtintores] = useState<Extintor[]>([]);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [editingRow, setEditingRow] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const changeActiveId = useCallback((name: string) => {
    activeIdRef.current = name;
    setActiveId(name);
  }, []);

  // ── socket ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onEmpresaList = (list: EmpresaItem[]) => {
      setEmpresas(list);
      if (activeIdRef.current) {
        const stillExists = list.some((e) => e.id === activeIdRef.current);
        if (!stillExists) {
          changeActiveId("");
          setView("home");
          showToast("La empresa activa fue eliminada", "err");
        }
      }
    };

    const onEmpresaDataUpdated = (data: EmpresaData) => {
      if (data.id === activeIdRef.current) setEmpresa((p) => ({ ...p, ...data }));
      setEmpresas((prev) => prev.map((e) => e.id === data.id ? { ...e, razonSocial: data.razonSocial || e.razonSocial } : e));
    };

    const onEmpresaData = (data: EmpresaData) => {
      if (data.id === activeIdRef.current) setEmpresa({ ...emptyEmpresa(), ...data });
    };

    const onExtintorUpdated = ({ id, rows }: { id: string; rows: Extintor[] }) => {
      if (id === activeIdRef.current) setExtintores(rows);
    };

    socket.on("empresa:list", onEmpresaList);
    socket.on("empresa:data:updated", onEmpresaDataUpdated);
    socket.on("empresa:data", onEmpresaData);
    socket.on("extintor:updated", onExtintorUpdated);

    return () => {
      socket.off("empresa:list", onEmpresaList);
      socket.off("empresa:data:updated", onEmpresaDataUpdated);
      socket.off("empresa:data", onEmpresaData);
      socket.off("extintor:updated", onExtintorUpdated);
    };
  }, [socket, changeActiveId]);

  const selectEmpresa = (id: string) => {
    if (!socket) return;
    changeActiveId(id);
    socket.emit("empresa:get", { id });
    socket.emit("extintor:list", { id });
    setView("lista");
  };

  const handleRealizadoPH = (val: string) => {
    const yr = parseInt(val);
    setForm((p) => ({
      ...p,
      realizadoPH: val,
      vencimPH: !isNaN(yr) && val.length === 4 ? String(yr + 5) : p.vencimPH,
    }));
  };

  const handleEmpresaSave = () => {
    if (!socket) return;
    setSaving(true);
    const payload = { ...empresa, ...(activeIdRef.current ? { id: activeIdRef.current } : {}) };
    socket.emit("empresa:save", payload, (res: any) => {
      setSaving(false);
      if (res?.success) {
        showToast("Empresa guardada ✓");
        changeActiveId(res.id);
        socket.emit("extintor:list", { id: res.id });
        setView("lista");
      } else showToast(res?.error || "Error al guardar", "err");
    });
  };

  const handleExtintorSave = () => {
    if (!socket || !activeId) return;
    setSaving(true);
    const payload = {
      ...form, id: activeId,
      nSerie: form.nSerie.trim() === "" ? "S/N" : form.nSerie.trim(),
      ma: form.ma ? "SI" : "", ph: form.ph ? "SI" : "", servicioExtra: form.servicioExtra, motivoBaja: form.motivoBaja,
    };
    if (editingRow !== null) {
      socket.emit("extintor:update", { ...payload, rowIndex: editingRow }, (res: any) => {
        setSaving(false);
        if (res?.success) {
          showToast("Actualizado ✓");
          setView("lista");
          setEditingRow(null);
          setForm(emptyForm());
        } else showToast(res?.error || "Error", "err");
      }
      );
    } else {
      socket.emit("extintor:add", payload, (res: any) => {
        setSaving(false);
        if (res?.success) {
          showToast("Extintor guardado ✓");
          setView("lista");
          setForm(emptyForm());
        } else showToast(res?.error || "Error", "err");
      });
    }
  };

  const handleEdit = (ext: Extintor) => {
    setForm({
      nSerie: ext.nSerie, nInterno: ext.nInterno, marca: ext.marca,
      fechaFabricacion: ext.fechaFabricacion, realizadoPH: ext.realizadoPH,
      vencimPH: ext.vencimPH, estadoExtintor: ext.estadoExtintor,
      agenteExtintor: ext.agenteExtintor, peso: ext.peso,
      unidadPeso: (ext.unidadPeso as "KG" | "LB" | "LT") || "KG",
      ma: ext.ma === "SI", recarga: ext.recarga, ph: ext.ph === "SI",
      valvula: ext.valvula, manguera: ext.manguera, manometro: ext.manometro,
      tobera: ext.tobera, observaciones: ext.observaciones, servicioExtra: ext.servicioExtra || "",
      motivoBaja: ext.motivoBaja || "",
    });
    setEditingRow(ext.rowIndex);
    setView("form");
  };

  const handleDelete = (rowIndex: number) => {
    if (!socket || !confirm("¿Estás seguro de eliminar este extintor?")) return;
    socket.emit("extintor:delete", { id: activeId, rowIndex, role: user.role }, (res: any) => {
      if (res?.success) showToast("Extintor eliminado");
      else showToast("Error al eliminar", "err");
    }
    );
  };

  const setF = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="app-workers flex flex-col h-dvh w-full bg-zinc-50/50 shadow-2xl relative" style={{ fontFamily: "'Instrument Sans', 'SF Pro Display', system-ui, sans-serif" }}>

      {/* ══ HEADER ══ */}
      <header className="relative flex items-center justify-between px-5 md:px-8 bg-linear-to-r from-red-800 to-red-700 shrink-0 h-16 md:h-20 shadow-md z-20">
        <div className="flex items-center justify-start gap-4 z-10 w-1/3">
          {view !== "home" && (
            <button
              onClick={() => setView(view === "form" ? "lista" : "home")}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-red-900/40 hover:bg-red-900/60 text-white transition-all active:scale-95"
            >
              <span className="text-2xl leading-none -mt-1">‹</span>
            </button>
          )}
          <div className="flex items-center gap-2 bg-red-950/30 px-3 py-1.5 rounded-full border border-red-900/30">
            <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-emerald-400 dot-pulse" : "bg-zinc-400"}`} />
            <span className="text-[10px] md:text-xs text-white/90 font-bold hidden sm:inline-block tracking-wide">
              {connected ? "En línea" : "Desconectado"}
            </span>
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
          <div className="text-white font-black text-2xl md:text-3xl tracking-[4px] leading-none drop-shadow-sm">
            FAMA
          </div>
          <div className="text-red-200 text-[9px] md:text-[10px] font-bold tracking-[5px] uppercase mt-1 opacity-90">
            Extintores
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 z-10 w-1/3">
          <div className="flex flex-col items-end text-right sm:flex">
            <span className="text-xs text-white font-bold leading-none truncate max-w-32">
              {user.displayName.split(" ")[0]}
            </span>
            {(user.role === "admin" || user.role === "boss") && (
              <a href="/dashboard" className="text-[9px] text-red-100 hover:text-white font-bold bg-red-950/40 hover:bg-red-900 px-2.5 py-1 rounded-full mt-1.5 transition-all border border-red-900/50">
                Dashboard
              </a>
            )}
          </div>
          <div className="w-px h-8 bg-red-900/50 mx-1 hidden sm:block" />
          <button onClick={onLogout} className="w-10 h-10 flex items-center justify-center rounded-full bg-red-900/40 hover:bg-red-900/60 text-white transition-all active:scale-95" title="Salir">
            ⏻
          </button>
        </div>
      </header>

      {/* ══ TABS (NAVEGACIÓN) ══ */}
      {activeId && view !== "home" && (
        <nav className="flex items-center gap-2 p-3 md:p-4 bg-white border-b border-zinc-200 shrink-0 shadow-sm z-10 overflow-x-auto scrollbar-hide">
          {(["empresa", "lista", "form"] as const).map((v) => {
            const labels = {
              empresa: "🏢 Empresa",
              lista: `📋 Lista${extintores.length ? ` (${extintores.length})` : ""}`,
              form: "➕ Nuevo Extintor",
            };
            const isActive = view === v;
            return (
              <button
                key={v}
                onClick={() => {
                  if (v === "form") { setForm(emptyForm()); setEditingRow(null); }
                  setView(v);
                }}
                className={`flex-1 min-w-fit px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all active:scale-95 ${isActive ? "bg-red-700 text-white shadow-md shadow-red-900/20" : "bg-zinc-100/80 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"}`}
              >
                {labels[v]}
              </button>
            );
          })}
        </nav>
      )}

      {/* ══ TOAST ══ */}
      {toast && (
        <div
          className={`toast-anim fixed top-24 left-1/2 z-50 px-6 py-3.5 rounded-full text-sm font-bold text-white shadow-2xl whitespace-nowrap flex items-center gap-2 ${toast.type === "ok" ? "bg-emerald-600 shadow-emerald-900/30" : "bg-red-600 shadow-red-900/30"}`}
          style={{ transform: "translateX(-50%)" }}
        >
          {toast.type === "ok" ? "✅" : "⚠️"} {toast.msg}
        </div>
      )}

      <main className="flex-1 overflow-hidden relative bg-zinc-50/50">

        {/* ════ VISTA: HOME ════ */}
        {view === "home" && (
          <div className="scroll-area h-full overflow-y-auto p-4 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
            <div className="text-center pt-6 md:pt-10 pb-4">
              <h1 className="text-2xl md:text-4xl font-black text-zinc-800 tracking-tight">Directorio de Empresas</h1>
              <p className="text-sm md:text-base text-zinc-500 mt-2 font-medium">Selecciona un cliente para gestionar sus extintores</p>
            </div>

            {empresas.length === 0 && connected && (
              <div className="flex flex-col items-center justify-center gap-4 py-20 text-zinc-400 bg-white/60 rounded-3xl border-2 border-dashed border-zinc-200 shadow-sm">
                <span className="text-6xl drop-shadow-sm opacity-80">📋</span>
                <p className="text-sm md:text-base font-bold text-zinc-500">No hay empresas registradas aún</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 md:gap-6">
              {empresas.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => selectEmpresa(emp.id)}
                  className="flex items-center gap-4 p-5 bg-white border border-zinc-200/80 rounded-2xl text-left hover:border-red-300 hover:shadow-xl active:bg-red-50 transition-all hover:-translate-y-1 group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-3xl group-hover:bg-red-100 transition-colors shrink-0 shadow-inner">
                    🏢
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-zinc-800 text-sm md:text-base truncate group-hover:text-red-700 transition-colors">
                      {emp.razonSocial}
                    </p>
                    <p className="text-xs text-zinc-400 font-medium mt-0.5 truncate">Toca para gestionar</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center group-hover:bg-red-600 transition-colors shrink-0">
                    <span className="text-zinc-400 group-hover:text-white text-lg font-bold">›</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => { setEmpresa(emptyEmpresa()); changeActiveId(""); setView("empresa"); }}
              className="w-full md:w-auto md:self-center md:px-14 py-4 rounded-2xl bg-red-700 text-white font-black text-sm md:text-base hover:bg-red-600 shadow-lg shadow-red-900/20 transition-all hover:-translate-y-0.5 active:scale-95 mt-4 flex items-center justify-center gap-2"
            >
              <span className="text-xl leading-none">+</span> Registrar Nueva Empresa
            </button>
          </div>
        )}

        {/* ════ VISTA: EMPRESA ════ */}
        {view === "empresa" && (
          <div className="scroll-area h-full overflow-y-auto p-4 md:p-8 flex flex-col gap-6 max-w-4xl mx-auto w-full">
            <Card title="🏢 Datos de la Empresa">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
                <Field label="Razón Social" className="md:col-span-2">
                  <input className={inputCls} value={empresa.razonSocial} onChange={(e) => setEmpresa((p) => ({ ...p, razonSocial: e.target.value }))} placeholder="Nombre oficial de la empresa" />
                </Field>
                <Field label="Dirección" className="md:col-span-2">
                  <input className={inputCls} value={empresa.direccion} onChange={(e) => setEmpresa((p) => ({ ...p, direccion: e.target.value }))} placeholder="Dirección completa" />
                </Field>
                <Field label="Distrito">
                  <select className={inputCls} value={empresa.distrito} onChange={(e) => setEmpresa((p) => ({ ...p, distrito: e.target.value }))}>
                    <option value="">Seleccionar distrito...</option>
                    {DISTRITOS_LIMA.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </Field>
                <Field label="RUC">
                  <div className="relative">
                    <input className={inputCls} value={empresa.ruc} onChange={(e) => { if (e.target.value.length <= 11) setEmpresa((p) => ({ ...p, ruc: e.target.value })); }} placeholder="20xxxxxxxxx" inputMode="numeric" maxLength={11} />
                    <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] md:text-xs font-bold ${empresa.ruc.length === 11 ? "text-emerald-500" : "text-zinc-400 bg-zinc-50 px-1"}`}>
                      {empresa.ruc.length}/11 {empresa.ruc.length === 11 && "✓"}
                    </span>
                  </div>
                </Field>
              </div>
            </Card>

            <Card title="👤 Datos del Solicitante">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
                <Field label="Nombres y Apellidos" className="md:col-span-2">
                  <input className={inputCls} value={empresa.nombresApellidos} onChange={(e) => setEmpresa((p) => ({ ...p, nombresApellidos: e.target.value }))} placeholder="Nombre completo del contacto" />
                </Field>
                <Field label="Celular">
                  <input className={inputCls} value={empresa.celular} onChange={(e) => setEmpresa((p) => ({ ...p, celular: e.target.value }))} placeholder="9xx xxx xxx" inputMode="tel" />
                </Field>
                <Field label="N° Orden de Trabajo">
                  <input className={inputCls} value={empresa.nOrdenTrabajo} onChange={(e) => setEmpresa((p) => ({ ...p, nOrdenTrabajo: e.target.value }))} placeholder="Ej: OT-0001" />
                </Field>
              </div>
            </Card>

            <Card title="📅 Fechas de Servicio">
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
                <Field label="Fecha de Retiro">
                  <input className={inputCls} type="date" value={empresa.fechaRetiro} onChange={(e) => setEmpresa((p) => ({ ...p, fechaRetiro: e.target.value }))} />
                </Field>
                <Field label="Fecha de Entrega (Estimada)">
                  <input className={inputCls} type="date" value={empresa.fechaEntrega} onChange={(e) => setEmpresa((p) => ({ ...p, fechaEntrega: e.target.value }))} />
                </Field>
              </div>
            </Card>

            <div className="flex flex-col pt-2 pb-8">
              <button
                onClick={handleEmpresaSave}
                disabled={saving || !connected || !empresa.razonSocial}
                className="w-full py-4 md:py-5 rounded-2xl bg-red-700 text-white font-black text-sm md:text-base disabled:opacity-50 hover:bg-red-600 shadow-xl shadow-red-900/20 transition-all active:scale-95 hover:-translate-y-0.5"
              >
                {saving ? "⏳ Guardando información..." : "💾 Guardar Datos de Empresa"}
              </button>
            </div>
          </div>
        )}

        {/* ════ VISTA: LISTA DE EXTINTORES ════ */}
        {view === "lista" && (
          <>
            <div className="scroll-area h-full overflow-y-auto p-4 md:p-8 flex flex-col gap-5 max-w-7xl mx-auto w-full">
              <div className="flex items-center gap-4 p-5 bg-white border border-zinc-200/80 rounded-2xl shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center text-2xl shrink-0">🏢</div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Empresa Activa</span>
                  <h2 className="text-base md:text-xl font-black text-zinc-800 truncate leading-tight">
                    {empresa.razonSocial || activeId}
                  </h2>
                </div>
                <button onClick={() => setView("home")} className="hidden sm:block text-xs font-bold text-zinc-500 hover:text-red-600 transition-colors bg-zinc-100 px-4 py-2 rounded-xl">
                  Cambiar
                </button>
              </div>

              {extintores.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 py-24 text-zinc-400 bg-white/60 border-2 border-dashed border-zinc-200 rounded-3xl mt-2">
                  <span className="text-6xl md:text-7xl drop-shadow-sm opacity-80">🧯</span>
                  <p className="text-base font-bold text-zinc-500">Sin extintores registrados</p>
                  <button onClick={() => setView("form")} className="px-8 py-3.5 mt-2 bg-red-700 text-white font-bold rounded-xl text-sm hover:bg-red-600 transition-all shadow-md active:scale-95">
                    Agregar el primero
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 md:gap-6 mt-2">
                  {extintores.map((ext, index) => (
                    <div key={ext.rowIndex} className="bg-white border border-zinc-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col hover:-translate-y-1">

                      {/* Header de Tarjeta */}
                      <div className="flex items-center justify-between px-5 py-4 bg-zinc-50/80 border-b border-zinc-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 text-red-700 font-black text-sm shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-base md:text-lg font-black text-zinc-800 truncate">
                            {ext.nSerie || "S/N"}
                          </span>
                        </div>
                        <div className="flex gap-1.5 shrink-0 ml-2">
                          <button onClick={() => handleEdit(ext)} className="w-9 h-9 rounded-xl bg-white border border-zinc-200 text-sm hover:bg-zinc-100 hover:text-red-600 transition-colors flex items-center justify-center shadow-sm active:scale-95" title="Editar">
                            ✏️
                          </button>
                          <button onClick={() => handleDelete(ext.rowIndex)} className="w-9 h-9 rounded-xl bg-white border border-zinc-200 text-sm hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center shadow-sm active:scale-95" title="Eliminar">
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Cuerpo de Tarjeta */}
                      <div className="px-5 py-5 flex flex-col gap-3 flex-1">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Marca</span>
                            <span className="font-bold text-zinc-800 text-sm truncate">{ext.marca || "—"}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Agente</span>
                            <span className="font-bold text-zinc-800 text-sm truncate">{ext.agenteExtintor || "—"}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Peso</span>
                            <span className="font-black text-zinc-800 text-sm">{ext.peso ? `${ext.peso} ${ext.unidadPeso}` : "—"}</span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Estado</span>
                            <span className="font-bold text-zinc-800 text-sm truncate">{ext.estadoExtintor || "—"}</span>
                          </div>
                        </div>

                        <div className="w-full h-px bg-zinc-100 my-1" />

                        {/* Badges de Servicio */}
                        <div className="flex flex-wrap gap-2 mt-auto">
                          {ext.ma === "SI" && <span className="bg-red-50 text-red-700 text-[10px] font-black px-2.5 py-1 rounded-md border border-red-100 shadow-sm">MA</span>}
                          {ext.recarga && <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-md border border-amber-100 shadow-sm">RE: {ext.recarga}</span>}
                          {ext.ph === "SI" && <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-md border border-blue-100 shadow-sm">PH</span>}
                          {!ext.ma && !ext.recarga && !ext.ph && <span className="text-[10px] font-medium text-zinc-400 italic">Sin servicios registrados</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="min-h-28 w-full shrink-0" />
            </div>

            {/* FAB (Floating Action Button) */}
            <button
              onClick={() => { setForm(emptyForm()); setEditingRow(null); setView("form"); }}
              className="absolute bottom-6 right-6 md:bottom-8 md:right-8 w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-700 hover:bg-red-600 text-white text-4xl md:text-5xl font-light shadow-[0_10px_40px_rgba(185,28,28,0.5)] flex items-center justify-center hover:scale-105 active:scale-90 transition-all z-40"
              title="Agregar Extintor"
            >
              <span className="leading-none -mt-1 md:-mt-2">+</span>
            </button>
          </>
        )}

        {/* ════ VISTA: FORMULARIO DE EXTINTOR ════ */}
        {view === "form" && (
          <div className="scroll-area h-full overflow-y-auto p-4 md:p-8 flex flex-col gap-6 max-w-5xl mx-auto w-full">

            {/* 1. DATOS PRINCIPALES (50/50 Grid) */}
            <Card title={`🧯 ${editingRow !== null ? "Editar Extintor" : "Nuevo Extintor"}`}>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
                <Field label="N° Serie">
                  <input className={inputCls} value={form.nSerie} onChange={setF("nSerie")} placeholder="Ej: ABC-12345" />
                </Field>
                <Field label="N° Interno">
                  <input className={inputCls} value={form.nInterno} onChange={setF("nInterno")} placeholder="Identificador interno" />
                </Field>
                <Field label="Marca">
                  <CreatableSelect
                    value={form.marca}
                    onChange={(v) => setForm((p) => ({ ...p, marca: v }))}
                    options={MARCAS}
                    placeholder="Seleccionar marca..."
                    catalogType="marca"
                    socket={socket}
                    userRole={user.role}
                    className={inputCls}
                  />
                </Field>
                <Field label="Año de Fabricación">
                  <input className={inputCls} value={form.fechaFabricacion} onChange={setF("fechaFabricacion")} placeholder="Ej: 2020" inputMode="numeric" maxLength={4} />
                </Field>
              </div>
            </Card>

            {/* 2. PRUEBA HIDROSTÁTICA & CARACTERÍSTICAS (50/50 Grid con Motivo de Baja dinámico) */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-6 items-start">
              <Card title="🔬 Prueba Hidrostática">
                <div className="flex flex-col gap-5">
                  <Field label="Año Realizado PH">
                    <input className={inputCls} value={form.realizadoPH} onChange={(e) => handleRealizadoPH(e.target.value)} placeholder="Ej: 2024" inputMode="numeric" maxLength={4} />
                  </Field>
                  <Field label="Año Vencimiento PH (Automático +5)">
                    <input className={`${inputCls} bg-zinc-100 text-zinc-500 border-dashed cursor-not-allowed`} value={form.vencimPH} readOnly placeholder="Se calcula solo" />
                  </Field>
                </div>
              </Card>

              {/* Columna derecha: Características + Motivo de Baja (si aplica) */}
              <div className="flex flex-col gap-6">
                <Card title="⚗️ Características del Extintor">
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-4"> {/* CAMBIO: flex-col en lugar de grid-cols-2 */}
                      <Field label="Estado">
                        <select className={inputCls} value={form.estadoExtintor} onChange={setF("estadoExtintor")}>
                          <option value="">Seleccionar...</option>
                          {ESTADOS.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      </Field>
                      <Field label="Agente">
                        <CreatableSelect
                          value={form.agenteExtintor}
                          onChange={(v) => setForm((p) => ({ ...p, agenteExtintor: v }))}
                          options={AGENTES}
                          placeholder="Seleccionar..."
                          catalogType="agente"
                          socket={socket}
                          userRole={user.role}
                          className={inputCls}
                        />
                      </Field>
                    </div>
                    <Field label="Peso y Unidad">
                      <div className="flex flex-col xl:flex-row gap-3">
                        <div className="flex w-full rounded-xl overflow-hidden border-2 border-zinc-200 shrink-0 bg-zinc-50 shadow-sm p-1 gap-1"> {/* CAMBIO: Se agregó w-full */}
                          {(["KG", "LB", "LT"] as const).map((u) => (
                            // CAMBIO: Se reemplazó px-4 por flex-1 para que se estiren equitativamente
                            <button key={u} type="button" onClick={() => setForm((p) => ({ ...p, unidadPeso: u, peso: "" }))} className={`flex-1 py-1.5 rounded-lg text-sm font-black transition-all text-center ${form.unidadPeso === u ? "bg-red-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/50"}`}>
                              {u}
                            </button>
                          ))}
                        </div>
                        <select className={`${inputCls} flex-1`} value={form.peso} onChange={setF("peso")}>
                          <option value="">Seleccionar peso...</option>
                          {(form.unidadPeso === "LB" ? PESOS_LB : form.unidadPeso === "LT" ? PESOS_LT : PESOS_KG).map((p) => (
                            <option key={p} value={p}>{p} {form.unidadPeso}</option>
                          ))}
                        </select>
                      </div>
                    </Field>
                  </div>
                </Card>
              </div>

              {form.estadoExtintor === "De Baja" && (
                <div className="col-span-2 animate-in fade-in slide-in-from-top-4 duration-300">
                  <Card title="⚠️ Motivo de Baja">
                    <MultiSelect
                      // CAMBIO: split(",") más un trim() asegura que funcione aunque falten espacios
                      selected={form.motivoBaja.split(",").map(v => v.trim()).filter(Boolean)}
                      onChange={(vals) => {
                        // CAMBIO: Se aplica trim() antes de guardar para mantener limpieza de datos
                        const motivo = vals.map((v) => v.toUpperCase().trim()).join(", ");
                        setForm((p) => ({ ...p, motivoBaja: motivo }));
                      }}
                      options={MOTIVOS_BAJA}
                      label="Seleccionar Motivos"
                      catalogType="motivo_baja"
                      socket={socket}
                      userRole={user.role}
                      className={inputCls}
                    />
                  </Card>
                </div>
              )}
            </div>

            {/* 3. SERVICIOS (50/50 Grid estirado para igualar alturas) */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-6 items-stretch">
              <Card title="🔧 Servicio Realizado">
                <div className="flex flex-col gap-4 h-full">
                  <Toggle checked={form.ma} label="MA — Mantenimiento" onChange={() => setForm((p) => ({ ...p, ma: !p.ma }))} />
                  <Toggle checked={form.ph} label="PH — Prueba Hidrostática" onChange={() => setForm((p) => ({ ...p, ph: !p.ph }))} />

                  <Field label="Recarga (Seleccione una opción)" className="mt-auto pt-2">
                    <div className="flex flex-col gap-2">
                      {RECARGAS.map((r) => (
                        <button key={r} type="button" onClick={() => setForm((p) => ({ ...p, recarga: p.recarga === r ? "" : r }))} className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all ${form.recarga === r ? "bg-amber-500 border-amber-400 text-white shadow-md" : "bg-white border-zinc-200 text-zinc-500 hover:border-amber-300"}`}>
                          RE — {r}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </Card>

              <Card title="✨ Servicio Extra">
                <div className="flex flex-col h-full">
                  <MultiSelect
                    selected={form.servicioExtra.split(",").map(v => v.trim()).filter(Boolean)}
                    onChange={(vals) => {
                      const extra = vals.map((v) => v.toUpperCase().trim()).join(", ");
                      setForm((p) => ({ ...p, servicioExtra: extra }));
                    }}
                    options={SERVICIOS_EXTRA}
                    label="Servicios adicionales"
                    catalogType="servicio_extra"
                    socket={socket}
                    userRole={user.role}
                    className={inputCls}
                  />
                </div>
              </Card>
            </div>

            {/* 4. COMPONENTES Y OBSERVACIONES (50/50 Grid estirado) */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-6 items-stretch">
              <Card title="🔩 Componentes Instalados">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-x-6 lg:gap-x-10 gap-y-3 w-full">
                  {COMP_KEYS.map((k) => (
                    <div key={k} className="flex items-center w-full min-w-0 gap-3 py-2 border-b border-zinc-100 sm:border-0 md:border-b lg:border-0">
                      <span className="text-sm font-bold text-zinc-700 flex-1 truncate">
                        {COMP_LABELS[k]}
                      </span>
                      <SiNo value={form[k]} onChange={(v) => setForm((p) => ({ ...p, [k]: v }))} />
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="📝 Observaciones">
                <div className="flex flex-col gap-3 h-full">

                  {/* NUEVO: Contenedor de Badges dinámicos */}
                  {(form.motivoBaja || form.servicioExtra) && (
                    <div className="flex flex-col gap-1.5 p-3 bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Se adjuntará al reporte final:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {form.motivoBaja.split(", ").filter(Boolean).map(m => (
                          <span key={m} className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-md">⚠️ {m}</span>
                        ))}
                        {form.servicioExtra.split(", ").filter(Boolean).map(s => (
                          <span key={s} className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-md">✨ {s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Textarea exclusivo para notas manuales */}
                  <textarea
                    className={`${inputCls} resize-none flex-1 w-full min-h-30`}
                    value={form.observaciones}
                    onChange={setF("observaciones")}
                    placeholder="Escribe aquí notas adicionales o detalles específicos..."
                  />
                </div>
              </Card>
            </div>

            {/* 5. BOTONES DE ACCIÓN */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 pb-8 border-t border-zinc-200 mt-2">
              <button onClick={() => { setView("lista"); setEditingRow(null); }} className="order-2 sm:order-1 flex-1 py-4 md:py-5 rounded-2xl border-2 border-zinc-300 text-zinc-600 font-black text-sm md:text-base hover:bg-zinc-100 hover:border-zinc-400 transition-colors active:scale-95">
                Cancelar
              </button>
              <button onClick={handleExtintorSave} disabled={saving || !connected} className="order-1 sm:order-2 flex-2 py-4 md:py-5 rounded-2xl bg-red-700 text-white font-black text-sm md:text-base disabled:opacity-50 hover:bg-red-600 shadow-xl shadow-red-900/20 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2">
                {saving ? "⏳ Guardando datos..." : editingRow !== null ? "💾 Actualizar Extintor" : "✅ Guardar Extintor"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}