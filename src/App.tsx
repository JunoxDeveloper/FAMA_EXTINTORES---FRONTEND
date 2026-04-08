import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { MARCAS, AGENTES, ESTADOS, RECARGAS, PESOS_KG, PESOS_LB, COMP_KEYS, COMP_LABELS, DISTRITOS_LIMA } from "./constants";


// ── IMPORTANTE: Para acceder desde celular, cambia localhost
// por la IP local de tu PC (ej: 192.168.1.5)
// Puedes encontrarla ejecutando "ipconfig" en Windows
// const BACKEND_HOST = window.location.hostname; // auto-detecta IP si accedes por IP
const BACKEND = import.meta.env.VITE_BACKEND_URL
  || (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : "");

type EmpresaItem = { id: string; razonSocial: string };
type EmpresaData = {
  id?: string;
  razonSocial: string;
  direccion: string;
  distrito: string;
  ruc: string;
  nombresApellidos: string;
  celular: string;
  nOrdenTrabajo: string;
  fechaRetiro: string;
  fechaEntrega: string;
};
type Extintor = {
  rowIndex: number;
  n: string;
  nSerie: string;
  nInterno: string;
  marca: string;
  fechaFabricacion: string;
  realizadoPH: string;
  vencimPH: string;
  estadoExtintor: string;
  agenteExtintor: string;
  peso: string;
  unidadPeso: string;
  ma: string;
  recarga: string;
  ph: string;
  valvula: string;
  manguera: string;
  manometro: string;
  tobera: string;
  observaciones: string;
};
type FormData = {
  nSerie: string;
  nInterno: string;
  marca: string;
  fechaFabricacion: string;
  realizadoPH: string;
  vencimPH: string;
  estadoExtintor: string;
  agenteExtintor: string;
  peso: string;
  unidadPeso: "KG" | "LB";
  ma: boolean;
  recarga: string;
  ph: boolean;
  valvula: string;
  manguera: string;
  manometro: string;
  tobera: string;
  observaciones: string;
};

const emptyForm = (): FormData => ({
  nSerie: "",
  nInterno: "",
  marca: "",
  fechaFabricacion: "",
  realizadoPH: "",
  vencimPH: "",
  estadoExtintor: "",
  agenteExtintor: "",
  peso: "",
  unidadPeso: "KG",
  ma: false,
  recarga: "",
  ph: false,
  valvula: "",
  manguera: "",
  manometro: "",
  tobera: "",
  observaciones: "",
});
const emptyEmpresa = (): EmpresaData => ({
  razonSocial: "",
  direccion: "",
  distrito: "",
  ruc: "",
  nombresApellidos: "",
  celular: "",
  nOrdenTrabajo: "",
  fechaRetiro: "",
  fechaEntrega: "",
});

type View = "home" | "empresa" | "lista" | "form";

const inputCls =
  "w-full border-2 border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-800 bg-zinc-50 focus:outline-none focus:border-red-600 focus:bg-white transition-colors";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-[11px] font-bold text-red-700 uppercase tracking-widest pb-2 border-b border-zinc-100">
        {title}
      </p>
      {children}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${checked ? "bg-red-600 border-red-600 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-600"}`}
    >
      <span
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs font-bold shrink-0 ${checked ? "bg-white border-white text-red-600" : "border-zinc-300"}`}
      >
        {checked ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}
function SiNo({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const checked = value === "SI";
  return (
    <button
      type="button"
      onClick={() => onChange(checked ? "" : "SI")}
      className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all active:scale-90 ${checked
        ? "bg-emerald-600 border-emerald-600 text-white"
        : "bg-zinc-100 border-zinc-300 text-zinc-300"
        }`}
    >
      {checked ? "✓" : ""}
    </button>
  );
}

export default function App({ user, onLogout }: { user: { id: string; username: string; role: string; displayName: string }; onLogout: () => void }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [view, setView] = useState<View>("home");

  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [activeId, setActiveId] = useState("");
  const activeIdRef = useRef("");
  const [empresa, setEmpresa] = useState<EmpresaData>(emptyEmpresa());

  const [extintores, setExtintores] = useState<Extintor[]>([]);
  const [form, setForm] = useState<FormData>(emptyForm());
  const [editingRow, setEditingRow] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);

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
    const s = io(BACKEND);
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      s.emit("empresa:list");

      // Validar si el usuario sigue existiendo al refrescar la página
      s.emit("auth:verify", { id: user.id }, (res: any) => {
        if (res && res.valid === false) onLogout();
      });
    });

    // Escuchar evento de expulsión en tiempo real
    s.on("auth:force_logout", (data: { userId: string }) => {
      if (data.userId === user.id) onLogout();
    });

    // Lista de empresas actualizada
    s.on("empresa:list", (list: EmpresaItem[]) => {
      setEmpresas(list);
      // Si la hoja activa fue eliminada → volver al home
      if (activeIdRef.current) {
        const stillExists = list.some(
          (e) => e.id === activeIdRef.current,
        );
        if (!stillExists) {
          changeActiveId("");
          setView("home");
          showToast("La empresa activa fue eliminada", "err");
        }
      }
    });

    // Datos de empresa actualizados
    s.on("empresa:data:updated", (data: EmpresaData) => {
      if (data.id === activeIdRef.current) {
        setEmpresa((p) => ({ ...p, ...data }));
      }
    });

    s.on("empresa:data", (data: EmpresaData) => {
      if (data.id === activeIdRef.current) {
        setEmpresa({ ...emptyEmpresa(), ...data });
      }
    });

    // También actualiza el nombre en la lista si cambió Razón Social
    s.on("empresa:data:updated", (data: EmpresaData) => {
      setEmpresas((prev) =>
        prev.map((e) =>
          e.id === data.id
            ? { ...e, razonSocial: data.razonSocial || e.razonSocial }
            : e,
        ),
      );
    });

    // Extintores actualizados
    s.on(
      "extintor:updated",
      ({ id, rows }: { id: string; rows: Extintor[] }) => {
        if (id === activeIdRef.current) setExtintores(rows);
      },
    );

    return () => {
      s.disconnect();
    };
  }, []); // eslint-disable-line

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

    const payload = {
      ...empresa,
      ...(activeIdRef.current ? { id: activeIdRef.current } : {}),
    };

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
      ...form,
      id: activeId,
      nSerie: form.nSerie.trim() === "" ? "S/N" : form.nSerie.trim(),
      ma: form.ma ? "SI" : "",
      ph: form.ph ? "SI" : "",
    };
    if (editingRow !== null) {
      socket.emit(
        "extintor:update",
        { ...payload, rowIndex: editingRow },
        (res: any) => {
          setSaving(false);
          if (res?.success) {
            showToast("Actualizado ✓");
            setView("lista");
            setEditingRow(null);
            setForm(emptyForm());
          } else showToast(res?.error || "Error", "err");
        },
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
      nSerie: ext.nSerie,
      nInterno: ext.nInterno,
      marca: ext.marca,
      fechaFabricacion: ext.fechaFabricacion,
      realizadoPH: ext.realizadoPH,
      vencimPH: ext.vencimPH,
      estadoExtintor: ext.estadoExtintor,
      agenteExtintor: ext.agenteExtintor,
      peso: ext.peso,
      unidadPeso: (ext.unidadPeso as "KG" | "LB") || "KG",
      ma: ext.ma === "SI",
      recarga: ext.recarga,
      ph: ext.ph === "SI",
      valvula: ext.valvula,
      manguera: ext.manguera,
      manometro: ext.manometro,
      tobera: ext.tobera,
      observaciones: ext.observaciones,
    });
    setEditingRow(ext.rowIndex);
    setView("form");
  };

  const handleDelete = (rowIndex: number) => {
    if (!socket || !confirm("¿Eliminar este extintor?")) return;
    // Se agrega el campo 'role' al payload
    socket.emit(
      "extintor:delete",
      { id: activeId, rowIndex, role: user.role },
      (res: any) => {
        if (res?.success) showToast("Eliminado");
        else showToast("Error al eliminar", "err");
      },
    );
  };

  const setF =
    (k: keyof FormData) =>
      (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >,
      ) =>
        setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div className="app-workers flex flex-col h-dvh max-w-120 mx-auto bg-white shadow-2xl">
      {/* HEADER */}
      <header
        className="relative flex items-center justify-between px-4 bg-red-800 shrink-0"
        style={{ height: 60 }}
      >
        {/* IZQUIERDA: Botón Back + En Línea */}
        <div className="flex items-center justify-start gap-2 z-10 w-1/3">
          {view !== "home" && (
            <button
              onClick={() => setView(view === "form" ? "lista" : "home")}
              className="text-white/70 text-3xl leading-none active:text-white pb-1 mr-1"
            >
              ‹
            </button>
          )}
          <span className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-emerald-400 dot-pulse" : "bg-zinc-400"}`} />
          <span className="text-[11px] text-white/80 font-medium hidden sm:inline-block">
            {connected ? "En línea" : "Desconectado"} 
          </span>
        </div>

        {/* CENTRO: Logo (Posicionamiento absoluto para centrado matemático perfecto) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
          <div className="text-white font-black text-2xl tracking-[3px] leading-none">
            FAMA
          </div>
          <div className="text-red-200 text-[9px] font-semibold tracking-[4px] uppercase mt-0.5">
            Extintores
          </div>
        </div>

        {/* DERECHA: Usuario + Dashboard + Logout */}
        <div className="flex items-center justify-end gap-2 z-10 w-1/3">
          <div className="flex flex-col items-end text-right">
            <span className="text-[10px] text-white/80 font-medium leading-none truncate max-w-20">
              {user.displayName.split(" ")[0]} {/* Muestra solo el primer nombre para ahorrar espacio */}
            </span>
            {(user.role === "admin" || user.role === "boss") && (
              <a href="/dashboard"
                className="text-[8px] text-red-300 font-semibold bg-red-900/50 px-1.5 py-0.5 rounded-full mt-1">
                Dashboard
              </a>
            )}
          </div>
          <div className="w-px h-5 bg-white/20 mx-0.5" />
          <button onClick={onLogout}
            className="text-sm text-white/60 hover:text-white text-[10px] font-medium active:scale-90 transition-transform p-1">
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* TABS */}
      {activeId && view !== "home" && (
        <nav className="flex border-b-2 border-zinc-200 bg-white shrink-0">
          {(["empresa", "lista", "form"] as const).map((v) => {
            const labels = {
              empresa: "🏢 Empresa",
              lista: `📋 Lista${extintores.length ? ` (${extintores.length})` : ""}`,
              form: "➕ Nuevo",
            };
            return (
              <button
                key={v}
                onClick={() => {
                  if (v === "form") {
                    setForm(emptyForm());
                    setEditingRow(null);
                  }
                  setView(v);
                }}
                className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 -mb-0.5 ${view === v ? "text-red-600 border-red-600" : "text-zinc-500 border-transparent"}`}
              >
                {labels[v]}
              </button>
            );
          })}
        </nav>
      )}

      {/* TOAST */}
      {toast && (
        <div
          className={`toast-anim fixed top-24 left-1/2 z-50 px-5 py-2.5 rounded-full text-[13px] font-semibold text-white shadow-xl whitespace-nowrap ${toast.type === "ok" ? "bg-emerald-600" : "bg-red-600"}`}
          style={{ transform: "translateX(-50%)" }}
        >
          {toast.msg}
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        {/* ══ HOME ══ */}
        {view === "home" && (
          <div className="scroll-area h-full overflow-y-auto p-4 flex flex-col gap-3">
            <div className="text-center pt-4 pb-2">
              <p className="text-2xl font-black text-zinc-800">
                Selecciona empresa
              </p>
              <p className="text-sm text-zinc-400 mt-1">o crea una nueva</p>
            </div>

            {empresas.length === 0 && connected && (
              <div className="flex flex-col items-center gap-2 py-8 text-zinc-400">
                <span className="text-5xl">📋</span>
                <p className="text-sm">No hay empresas registradas aún</p>
              </div>
            )}

            {!connected && (
              <div className="flex flex-col items-center gap-2 py-8 text-zinc-400">
                <span className="text-5xl">⚡</span>
                <p className="text-sm font-medium">Conectando al servidor...</p>
                <p className="text-xs text-center text-zinc-400">
                  Asegúrate que el backend esté corriendo en el puerto 3001
                </p>
              </div>
            )}

            {empresas.map((emp) => (
              <button
                key={emp.id}
                onClick={() => selectEmpresa(emp.id)}
                className="w-full flex items-center gap-3 px-4 py-4 bg-white border-2 border-zinc-200 rounded-2xl text-left active:border-red-400 active:bg-red-50 transition-all"
              >
                <span className="text-2xl">🏢</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-zinc-800 text-sm truncate">
                    {emp.razonSocial}
                  </p>
                </div>
                <span className="text-zinc-300 text-xl shrink-0">›</span>
              </button>
            ))}

            <button
              onClick={() => {
                setEmpresa(emptyEmpresa());
                changeActiveId("");
                setView("empresa");
              }}
              className="w-full py-3.5 rounded-2xl bg-red-700 text-white font-bold text-sm active:bg-red-800 mt-2"
            >
              + Nueva Empresa
            </button>
            <div className="h-4" />
          </div>
        )}

        {/* ══ EMPRESA ══ */}
        {view === "empresa" && (
          <div className="scroll-area h-full overflow-y-auto p-3 flex flex-col gap-3">
            <Card title="🏢 Datos de la Empresa">
              <Field label="Razón Social">
                <input
                  className={inputCls}
                  value={empresa.razonSocial}
                  onChange={(e) =>
                    setEmpresa((p) => ({ ...p, razonSocial: e.target.value }))
                  }
                  placeholder="Nombre de la empresa"
                />
              </Field>
              <Field label="Dirección">
                <input
                  className={inputCls}
                  value={empresa.direccion}
                  onChange={(e) =>
                    setEmpresa((p) => ({ ...p, direccion: e.target.value }))
                  }
                  placeholder="Dirección completa"
                />
              </Field>
              <Field label="Distrito">
                <select
                  className={inputCls}
                  value={empresa.distrito}
                  onChange={(e) =>
                    setEmpresa((p) => ({ ...p, distrito: e.target.value }))
                  }
                >
                  <option value="">Seleccionar distrito...</option>
                  {DISTRITOS_LIMA.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label="RUC">
                <input
                  className={inputCls}
                  value={empresa.ruc}
                  onChange={(e) => {
                    if (e.target.value.length <= 11)
                      setEmpresa((p) => ({ ...p, ruc: e.target.value }));
                  }}
                  placeholder="20xxxxxxxxx"
                  inputMode="numeric"
                  maxLength={11}
                />
                <span className="text-[10px] text-zinc-400 text-right">
                  {empresa.ruc.length}/11
                </span>
              </Field>
            </Card>

            <Card title="👤 Datos del Solicitante">
              <Field label="Nombres y Apellidos">
                <input
                  className={inputCls}
                  value={empresa.nombresApellidos}
                  onChange={(e) =>
                    setEmpresa((p) => ({
                      ...p,
                      nombresApellidos: e.target.value,
                    }))
                  }
                  placeholder="Nombre completo"
                />
              </Field>
              <Field label="Celular">
                <input
                  className={inputCls}
                  value={empresa.celular}
                  onChange={(e) =>
                    setEmpresa((p) => ({ ...p, celular: e.target.value }))
                  }
                  placeholder="9xx xxx xxx"
                  inputMode="tel"
                />
              </Field>
              <Field label="N° Orden de Trabajo">
                <input
                  className={inputCls}
                  value={empresa.nOrdenTrabajo}
                  onChange={(e) =>
                    setEmpresa((p) => ({ ...p, nOrdenTrabajo: e.target.value }))
                  }
                  placeholder="OT-0001"
                />
              </Field>
            </Card>

            <Card title="📅 Fechas">
              <Field label="Fecha de Retiro">
                <input
                  className={inputCls}
                  type="date"
                  value={empresa.fechaRetiro}
                  onChange={(e) =>
                    setEmpresa((p) => ({ ...p, fechaRetiro: e.target.value }))
                  }
                />
              </Field>
              <Field label="Fecha de Entrega">
                <input
                  className={inputCls}
                  type="date"
                  value={empresa.fechaEntrega}
                  onChange={(e) =>
                    setEmpresa((p) => ({ ...p, fechaEntrega: e.target.value }))
                  }
                />
              </Field>
            </Card>

            <button
              onClick={handleEmpresaSave}
              disabled={saving || !connected || !empresa.razonSocial}
              className="w-full py-3.5 rounded-2xl bg-red-700 text-white font-bold text-sm disabled:opacity-50 active:bg-red-800"
            >
              {saving ? "⏳ Guardando..." : "💾 Guardar Empresa"}
            </button>
            <div className="h-4" />
          </div>
        )}

        {/* ══ LISTA ══ */}
        {view === "lista" && (
          <div className="scroll-area h-full overflow-y-auto p-3 flex flex-col gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
              <span className="text-sm">🏢</span>
              <span className="text-xs font-bold text-red-700 truncate flex-1">
                {empresa.razonSocial || activeId}
              </span>
              <button
                onClick={() => setView("home")}
                className="text-[10px] text-red-500 font-semibold underline shrink-0"
              >
                cambiar
              </button>
            </div>

            {extintores.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-zinc-400">
                <span className="text-6xl">🧯</span>
                <p className="text-sm font-medium">
                  Sin extintores registrados
                </p>
                <button
                  onClick={() => setView("form")}
                  className="px-6 py-3 bg-red-700 text-white font-bold rounded-2xl text-sm"
                >
                  Agregar primer extintor
                </button>
              </div>
            ) : (
              extintores.map((ext, index) => (
                <div
                  key={ext.rowIndex}
                  className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shrink-0 shadow-sm"
                >
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200">
                    <span className="text-red-700 font-black text-lg min-w-7">
                      Extintor {index + 1}
                    </span>
                    <span className="flex-1 text-sm font-semibold text-zinc-700 truncate">
                      {ext.nSerie || "Sin N° serie"}
                    </span>
                    <button
                      onClick={() => handleEdit(ext)}
                      className="w-8 h-8 rounded-lg bg-white border border-zinc-200 text-sm active:bg-zinc-100"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(ext.rowIndex)}
                      className="w-8 h-8 rounded-lg bg-white border border-zinc-200 text-sm active:bg-zinc-100"
                    >
                      🗑️
                    </button>
                  </div>
                  <div className="px-4 py-3 flex flex-col gap-1.5">
                    {(
                      [
                        ["Marca", ext.marca],
                        ["Agente", ext.agenteExtintor],
                        [
                          "Peso",
                          ext.peso ? `${ext.peso} ${ext.unidadPeso}` : "",
                        ],
                        ["Estado", ext.estadoExtintor],
                      ] as [string, string][]
                    ).map(([l, v]) => (
                      <div key={l} className="flex justify-between text-xs">
                        <span className="text-zinc-500">{l}</span>
                        <span className="font-semibold text-zinc-800">
                          {v || "—"}
                        </span>
                      </div>
                    ))}
                    <div className="flex gap-1.5 flex-wrap mt-1">
                      {ext.ma === "SI" && (
                        <span className="bg-red-50 text-red-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          MA
                        </span>
                      )}
                      {ext.recarga && (
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          RE: {ext.recarga}
                        </span>
                      )}
                      {ext.ph === "SI" && (
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          PH
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="h-20" />
            <button
              onClick={() => {
                setForm(emptyForm());
                setEditingRow(null);
                setView("form");
              }}
              className="fixed bottom-5 w-14 h-14 rounded-full bg-red-700 text-white text-3xl font-light shadow-lg shadow-red-700/40 flex items-center justify-center active:scale-90 transition-transform z-40"
              style={{ right: "max(20px, calc(50% - 220px))" }}
            >
              +
            </button>
            <div className="min-h-20 w-full" />
          </div>
        )}

        {/* ══ FORM ══ */}
        {view === "form" && (
          <div className="scroll-area h-full overflow-y-auto p-3 flex flex-col gap-3">
            <Card
              title={`🧯 ${editingRow ? "Editar Extintor" : "Nuevo Extintor"}`}
            >
              <Field label="N° Serie">
                <input
                  className={inputCls}
                  value={form.nSerie}
                  onChange={setF("nSerie")}
                  placeholder="Serie del extintor"
                />
              </Field>
              <Field label="N° Interno">
                <input
                  className={inputCls}
                  value={form.nInterno}
                  onChange={setF("nInterno")}
                  placeholder="Número interno"
                />
              </Field>
              <Field label="Marca">
                <select
                  className={inputCls}
                  value={form.marca}
                  onChange={setF("marca")}
                >
                  <option value="">Seleccionar...</option>
                  {MARCAS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Field>
              <Field label="Año de Fabricación">
                <input
                  className={inputCls}
                  value={form.fechaFabricacion}
                  onChange={setF("fechaFabricacion")}
                  placeholder="Ej: 2020"
                  inputMode="numeric"
                  maxLength={4}
                />
              </Field>
            </Card>

            <Card title="🔬 Prueba Hidrostática">
              <Field label="Año Realizado PH">
                <input
                  className={inputCls}
                  value={form.realizadoPH}
                  onChange={(e) => handleRealizadoPH(e.target.value)}
                  placeholder="Ej: 2024"
                  inputMode="numeric"
                  maxLength={4}
                />
              </Field>
              <Field label="Año Vencimiento PH (auto +5 años)">
                <input
                  className={`${inputCls} bg-zinc-100`}
                  value={form.vencimPH}
                  onChange={setF("vencimPH")}
                  placeholder="Calculado automáticamente"
                  inputMode="numeric"
                  maxLength={4}
                />
              </Field>
            </Card>

            <Card title="⚗️ Características">
              <Field label="Estado del Extintor">
                <select
                  className={inputCls}
                  value={form.estadoExtintor}
                  onChange={setF("estadoExtintor")}
                >
                  <option value="">Seleccionar...</option>
                  {ESTADOS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Agente Extintor (Tipo)">
                <select
                  className={inputCls}
                  value={form.agenteExtintor}
                  onChange={setF("agenteExtintor")}
                >
                  <option value="">Seleccionar...</option>
                  {AGENTES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Peso">
                <div className="flex gap-2">
                  <div className="flex rounded-xl overflow-hidden border-2 border-zinc-200 shrink-0">
                    {(["KG", "LB"] as const).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, unidadPeso: u, peso: "" }))}
                        className={`px-4 text-sm font-bold transition-colors ${form.unidadPeso === u ? "bg-red-600 text-white" : "bg-zinc-50 text-zinc-600"}`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                  <select
                    className={`${inputCls} flex-1`}
                    value={form.peso}
                    onChange={setF("peso")}
                  >
                    <option value="">Seleccionar...</option>
                    {(form.unidadPeso === "LB" ? PESOS_LB : PESOS_KG).map((p) => (
                      <option key={p} value={p}>{p} {form.unidadPeso}</option>
                    ))}
                  </select>
                </div>
              </Field>
            </Card>

            <Card title="🔧 Servicio Realizado">
              <Toggle
                checked={form.ma}
                label="MA — Mantenimiento"
                onChange={() => setForm((p) => ({ ...p, ma: !p.ma }))}
              />
              <Field label="Recarga (elige una)">
                <div className="flex flex-col gap-1.5">
                  {RECARGAS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          recarga: p.recarga === r ? "" : r,
                        }))
                      }
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all active:scale-95 ${form.recarga === r ? "bg-amber-500 border-amber-500 text-white" : "bg-zinc-50 border-zinc-200 text-zinc-600"}`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-black shrink-0 ${form.recarga === r ? "bg-white border-white text-amber-600" : "border-zinc-300"}`}
                      >
                        {form.recarga === r ? "●" : ""}
                      </span>
                      RE — {r}
                    </button>
                  ))}
                </div>
              </Field>
              <Toggle
                checked={form.ph}
                label="PH — Prueba Hidrostática"
                onChange={() => setForm((p) => ({ ...p, ph: !p.ph }))}
              />
            </Card>

            <Card title="🔩 Componentes Nuevos">
              <div className="flex flex-col gap-3">
                {COMP_KEYS.map((k) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm font-semibold text-zinc-700 flex-1">
                      {COMP_LABELS[k]}
                    </span>
                    <SiNo
                      value={form[k]}
                      onChange={(v) => setForm((p) => ({ ...p, [k]: v }))}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card title="📝 Observaciones">
              <textarea
                className={`${inputCls} resize-none`}
                value={form.observaciones}
                onChange={setF("observaciones")}
                placeholder="Notas adicionales..."
                rows={3}
              />
            </Card>

            <div className="grid grid-cols-5 gap-2">
              <button
                onClick={() => {
                  setView("lista");
                  setEditingRow(null);
                }}
                className="col-span-2 py-3.5 rounded-2xl border-2 border-red-700 text-red-700 font-bold text-sm active:bg-red-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleExtintorSave}
                disabled={saving || !connected}
                className="col-span-3 py-3.5 rounded-2xl bg-red-700 text-white font-bold text-sm disabled:opacity-50 active:bg-red-800"
              >
                {saving ? "⏳..." : editingRow ? "💾 Actualizar" : "✅ Guardar"}
              </button>
            </div>
            <div className="h-6" />
          </div>
        )}
      </main>
    </div>
  );
}
