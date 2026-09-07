import { useState, type Dispatch, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";
import { COMP_KEYS, COMP_LABELS, ESTADOS, MESES, PESOS_GAL, PESOS_KG, PESOS_LB, PESOS_LT } from "../../constants";
import type { FormData, WorkerView as View } from "../../types";
import {
    calcularVencimientoPH,
    confirmarCambioPH,
    estadoBloqueaComponentes,
    estadoBloqueaServicio,
    estadoBloqueaServicioExtra,
    estadoRequiereDatosPH,
    estadoSoloPermiteRecarga,
    formatVencimPH,
    getRecargasPermitidas,
    phVenceEsteAnio,
    phVencida,
} from "../../utils/helpers";import { Card, Field, SiNo, Toggle, inputCls } from "../ui/WorkerUI";
import { CreatableSelect } from "../ui/CreatableSelect";
import { MultiSelect } from "../ui/MultiSelect";
import VoiceExtintorModal from "./VoiceExtintorModal";
import DuplicadoComparacionModal from "../modals/DuplicadoComparacionModal";
interface ExtintorFormViewProps {
    editingRow: number | null;
    form: FormData;
    setForm: Dispatch<SetStateAction<FormData>>;
    setF: (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    handleRealizadoPH: (val: string) => void;
    handleMesRealizadoPH: (val: string) => void;
    handleExtintorSave: () => void;

    socket: Socket | null;
    userRole: string;
    MARCAS: string[];
    AGENTES: string[];
    RECARGAS: string[];
    MOTIVOS_BAJA: string[];
    SERVICIOS_EXTRA: string[];

    saving: boolean;
    connected: boolean;

    setView: (v: View) => void;
    setEditingRow: (r: number | null) => void;
    clearFormBackup: () => void;
    onCancel: () => void;

    MAX_EVIDENCIAS: number;
    removeEvidencia: (index: number) => void;
    persistFormState: () => void;
    cameraInputRef: React.RefObject<HTMLInputElement | null>;
    galleryInputRef: React.RefObject<HTMLInputElement | null>;
    compressingPhoto: boolean;
    coincidencias?: { uid: string; rowIndex: number; nSerie: string; nInterno: string; marca: string; agenteExtintor: string; peso: string; unidadPeso: string; fechaFabricacion: string; mesRealizadoPH: string; realizadoPH: string; sedeId: string | null; estadoExtintor: string; nivel: "fuerte" | "sospechosa"; camposCoincidentes: string[] }[] | null;
    onUsarExistente?: (rowIndex: number) => void;
    onCerrarAvisoDuplicado?: () => void;
    onConfirmarYGuardar?: () => void;
}

export default function ExtintorFormView({
    editingRow,
    form,
    setForm,
    setF,
    handleRealizadoPH,
    handleMesRealizadoPH,
    handleExtintorSave,
    socket,
    userRole,
    MARCAS,
    AGENTES,
    RECARGAS,
    MOTIVOS_BAJA,
    SERVICIOS_EXTRA,
    saving,
    connected,
    setEditingRow,
    clearFormBackup,
    onCancel,
    MAX_EVIDENCIAS,
    removeEvidencia,
    persistFormState,
    cameraInputRef,
    galleryInputRef,
    compressingPhoto,
    coincidencias,
    onUsarExistente,
    onCerrarAvisoDuplicado,
    onConfirmarYGuardar,
}: ExtintorFormViewProps) {
    const recargasPermitidas = getRecargasPermitidas(form.agenteExtintor, RECARGAS);
    const soloRecarga = estadoSoloPermiteRecarga(form.estadoExtintor);
    const servicioBloqueado = estadoBloqueaServicio(form.estadoExtintor) && !soloRecarga;
    const servicioExtraBloqueado = estadoBloqueaServicioExtra(form.estadoExtintor);
    const componentesBloqueados = estadoBloqueaComponentes(form.estadoExtintor);
    const phVencidaAlerta = phVencida(form as any);
    const phProximaAlerta = !phVencidaAlerta && phVenceEsteAnio(form as any);
    const coincidencia = coincidencias && coincidencias.length > 0 ? coincidencias[0] : null;
    const [voiceModalOpen, setVoiceModalOpen] = useState(false);

    const aplicarDictado = (campos: Partial<FormData>) => {
        setForm((p) => {
            const next = { ...p, ...campos };
            if (campos.mesRealizadoPH !== undefined || campos.realizadoPH !== undefined) {
                next.vencimPH = calcularVencimientoPH(next.mesRealizadoPH, next.realizadoPH);
            }
            return next;
        });
    };

    return (
        <div className="scroll-area h-full overflow-y-auto p-4 md:p-8 flex flex-col gap-6 max-w-5xl mx-auto w-full">
            {coincidencia && onUsarExistente && onConfirmarYGuardar && onCerrarAvisoDuplicado && (
                <DuplicadoComparacionModal
                    coincidencia={coincidencia}
                    nuevo={form}
                    saving={saving}
                    onUsarExistente={() => onUsarExistente(coincidencia.rowIndex)}
                    onConfirmarNuevo={onConfirmarYGuardar}
                    onSeguirEditando={onCerrarAvisoDuplicado}
                />
            )}

            {/* <button
                type="button"
                onClick={() => setVoiceModalOpen(true)}
                className="self-start flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-black shadow-md active:scale-95 transition-all"
            >
                🎤 Registrar por Voz
            </button> */}

            <Card title={`🧯 ${editingRow !== null ? "Editar Extintor" : "Nuevo Extintor"}`}>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-4 md:gap-6">
                    <Field label="N° Serie">
                        <input className={inputCls} value={form.nSerie} onChange={(e) => setForm((p) => ({ ...p, nSerie: e.target.value.toUpperCase() }))} placeholder="Ej: ABC-12345" />
                    </Field>
                    <Field label="N° Interno">
                        <input className={inputCls} value={form.nInterno} onChange={(e) => setForm((p) => ({ ...p, nInterno: e.target.value.toUpperCase() }))} placeholder="Identificador interno" />
                    </Field>
                    <Field label="Marca">
                        <CreatableSelect
                            value={form.marca}
                            onChange={(v) => setForm((p) => ({ ...p, marca: v }))}
                            options={MARCAS}
                            placeholder="Seleccionar marca..."
                            catalogType="marca"
                            socket={socket}
                            userRole={userRole}
                            className={inputCls}
                        />
                    </Field>
                    <Field label="Año de Fabricación">
                        <input className={inputCls} value={form.fechaFabricacion} onChange={setF("fechaFabricacion")} placeholder="Ej: 2020" inputMode="numeric" maxLength={4} />
                    </Field>
                </div>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-2 gap-6 items-start">
                <Card title="🔬 Prueba Hidrostática">
                    <div className="flex flex-col gap-5">
                        <Field label="Mes Realizado PH">
                            <select className={`${inputCls} ${form.ph ? "opacity-60 cursor-not-allowed" : ""}`} value={form.mesRealizadoPH} disabled={!!form.ph} onChange={(e) => handleMesRealizadoPH(e.target.value)}>
                                <option value="">Seleccionar...</option>
                                {MESES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </Field>
                        <Field label="Año Realizado PH">
                            <input className={`${inputCls} ${form.ph ? "opacity-60 cursor-not-allowed" : ""}`} value={form.realizadoPH} disabled={!!form.ph} onChange={(e) => handleRealizadoPH(e.target.value)} placeholder="Ej: 2024" inputMode="numeric" maxLength={4} />
                        </Field>
                        <Field label="Vencimiento PH (Automático +5)">
                            <input className={`${inputCls} bg-zinc-100 text-zinc-500 border-dashed cursor-not-allowed`} value={formatVencimPH(form.vencimPH)} readOnly placeholder="Se calcula solo" />
                        </Field>
                        {form.ph && (
                            <p className="text-[11px] font-bold text-zinc-500">🔒 Desactiva "PH — Prueba Hidrostática" para modificar el mes/año</p>
                        )}
                        {estadoRequiereDatosPH(form.estadoExtintor) && phVencidaAlerta ? (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
                                <span className="shrink-0">🔴</span>
                                <span className="leading-snug">Prueba hidrostática vencida — realizar urgentemente</span>
                            </div>
                        ) : estadoRequiereDatosPH(form.estadoExtintor) && phProximaAlerta && (
                            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                                <span className="shrink-0">⚠️</span>
                                <span className="leading-snug">Debe realizarse la prueba hidrostática este mes</span>
                            </div>
                        )}
                    </div>
                </Card>

                <div className="flex flex-col gap-6">
                    <Card title="⚗️ Características del Extintor">
                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-4">
                                <Field label="Estado">
                                    <select className={inputCls} value={form.estadoExtintor} onChange={(e) => setForm((p) => {
                                        const nuevoEstado = e.target.value;
                                        const next = { ...p, estadoExtintor: nuevoEstado };
                                        if (estadoSoloPermiteRecarga(nuevoEstado)) {
                                            next.ma = false; next.ph = false;
                                        } else if (estadoBloqueaServicio(nuevoEstado)) {
                                            next.ma = false; next.ph = false; next.recarga = "";
                                        }
                                        if (estadoBloqueaServicioExtra(nuevoEstado)) {
                                            next.servicioExtra = "";
                                        }
                                        if (p.estadoExtintor === "De Baja" && nuevoEstado !== "De Baja") {
                                            next.motivoBaja = "";
                                        }
                                        return next;
                                    })}>
                                        <option value="">Seleccionar...</option>
                                        {ESTADOS.map((o) => <option key={o}>{o}</option>)}
                                    </select>
                                </Field>
                                <Field label="Agente">
                                    <CreatableSelect
                                        value={form.agenteExtintor}
                                        onChange={(v) => setForm((p) => {
                                            const permitidas = getRecargasPermitidas(v, RECARGAS);
                                            return { ...p, agenteExtintor: v, recarga: permitidas.includes(p.recarga) ? p.recarga : "" };
                                        })}
                                        options={AGENTES}
                                        placeholder="Seleccionar..."
                                        catalogType="agente"
                                        socket={socket}
                                        userRole={userRole}
                                        className={inputCls}
                                    />
                                </Field>
                            </div>
                            <Field label="Peso y Unidad">
                                <div className="flex flex-col xl:flex-row gap-3">
                                    <div className="flex w-full rounded-xl overflow-hidden border-2 border-zinc-200 shrink-0 bg-zinc-50 shadow-sm p-1 gap-1">
                                        {(["KG", "LB", "LT", "GAL"] as const).map((u) => (
                                            <button key={u} type="button" onClick={() => setForm((p) => ({ ...p, unidadPeso: u, peso: "" }))} className={`flex-1 py-1.5 rounded-lg text-sm font-black transition-all text-center ${form.unidadPeso === u ? "bg-red-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-800 hover:bg-zinc-200/50"}`}>
                                                {u}
                                            </button>
                                        ))}
                                    </div>
                                    <select className={`${inputCls} flex-1`} value={form.peso} onChange={setF("peso")}>
                                        <option value="">Seleccionar peso...</option>
                                        {(form.unidadPeso === "LB" ? PESOS_LB : form.unidadPeso === "LT" ? PESOS_LT : form.unidadPeso === "GAL" ? PESOS_GAL : PESOS_KG).map((p) => (
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
                                selected={form.motivoBaja.split(",").map(v => v.trim()).filter(Boolean)}
                                onChange={(vals) => {
                                    const motivo = vals.map((v) => v.toUpperCase().trim()).join(", ");
                                    setForm((p) => ({ ...p, motivoBaja: motivo }));
                                }}
                                options={MOTIVOS_BAJA}
                                label="Seleccionar Motivos"
                                catalogType="motivo_baja"
                                socket={socket}
                                userRole={userRole}
                                className={inputCls}
                            />
                        </Card>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 gap-6 items-stretch">
                <Card title="🔧 Servicio Realizado">
                    <div className="flex flex-col gap-4 h-full">
                        {servicioBloqueado ? (
                            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-100 border-2 border-zinc-200 text-zinc-500 text-sm font-bold">
                                🚫 El estado "{form.estadoExtintor}" no permite registrar servicios
                            </div>
                        ) : (
                            <>
                                {soloRecarga ? (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold">
                                        ℹ️ El estado "{form.estadoExtintor}" solo permite registrar Recarga
                                    </div>
                                ) : (
                                    <>
                                        <Toggle checked={form.ma} label="MA — Mantenimiento" onChange={() => setForm((p) => {
                                            const next = !p.ma;
                                            return next ? { ...p, ma: true, ph: false, recarga: "" } : { ...p, ma: false };
                                        })} />
                                        <Toggle checked={form.ph} label="PH — Prueba Hidrostática" onChange={() => {
                                            if (form.ph) {
                                                setForm((p) => ({ ...p, ph: false }));
                                                return;
                                            }
                                            const hoy = new Date();
                                            const mesActual = String(hoy.getMonth() + 1);
                                            const anioActual = String(hoy.getFullYear());
                                            if (!confirmarCambioPH(form.mesRealizadoPH, form.realizadoPH, mesActual, anioActual)) return;
                                            setForm((p) => ({
                                                ...p, ph: true, ma: false,
                                                mesRealizadoPH: mesActual,
                                                realizadoPH: anioActual,
                                                vencimPH: calcularVencimientoPH(mesActual, anioActual),
                                            }));
                                        }} />
                                    </>
                                )}

                                <Field label="Recarga (Seleccione una opción)" className="mt-auto pt-2">
                                    <div className="flex flex-col gap-2">
                                        {recargasPermitidas.map((r) => (
                                            <button key={r} type="button" onClick={() => setForm((p) => {
                                                const nextRecarga = p.recarga === r ? "" : r;
                                                return nextRecarga ? { ...p, recarga: nextRecarga, ma: false } : { ...p, recarga: "" };
                                            })} className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-bold transition-all ${form.recarga === r ? "bg-amber-500 border-amber-400 text-white shadow-md" : "bg-white border-zinc-200 text-zinc-500 hover:border-amber-300"}`}>
                                                RE — {r}
                                            </button>
                                        ))}
                                    </div>
                                </Field>
                            </>
                        )}
                    </div>
                </Card>

                <Card title="✨ Servicio Extra">
                    <div className="flex flex-col h-full">
                        {servicioExtraBloqueado ? (
                            <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-zinc-100 border-2 border-zinc-200 text-zinc-500 text-sm font-bold">
                                🚫 El estado "{form.estadoExtintor}" no permite registrar servicios
                            </div>
                        ) : (
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
                                userRole={userRole}
                                className={inputCls}
                            />
                        )}
                    </div>
                </Card>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 gap-6 items-stretch">
                <Card title="🔩 Componentes Instalados">
                    {componentesBloqueados ? (
                        <div className="px-3 py-2.5 rounded-xl bg-zinc-50 border-2 border-dashed border-zinc-200 text-zinc-500 text-sm font-bold">
                            🚫 El estado "{form.estadoExtintor}" no permite registrar componentes instalados
                        </div>
                    ) : (
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
                    )}
                </Card>

                <Card title="📝 Observaciones">
                    <div className="flex flex-col gap-3 h-full">
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

                        <textarea
                            className={`${inputCls} resize-none flex-1 w-full min-h-30`}
                            value={form.observaciones}
                            onChange={setF("observaciones")}
                            placeholder="Escribe aquí notas adicionales o detalles específicos..."
                        />
                    </div>
                </Card>
            </div>

            <Card title={`📷 Evidencia Fotográfica (${form.evidencias.length}/${MAX_EVIDENCIAS})`}>
                <div className="flex flex-col gap-4">
                    {form.evidencias.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {form.evidencias.map((b64, idx) => (
                                <div key={idx} className="relative rounded-xl overflow-hidden border-2 border-emerald-200 bg-emerald-50/30 shadow-sm group">
                                    <img
                                        src={`data:image/jpeg;base64,${b64}`}
                                        alt={`Evidencia ${idx + 1}`}
                                        className="w-full h-32 object-cover"
                                    />
                                    <div className="absolute top-1.5 left-1.5">
                                        <span className="w-6 h-6 rounded-lg bg-black/60 text-white text-[10px] font-black flex items-center justify-center">{idx + 1}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeEvidencia(idx)}
                                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-lg flex items-center justify-center text-xs active:scale-95 transition-all"
                                        title="Eliminar esta foto"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {form.evidencias.length < MAX_EVIDENCIAS && (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => { persistFormState(); cameraInputRef.current?.click(); }}
                                disabled={compressingPhoto}
                                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl transition-all active:scale-95 cursor-pointer group ${form.evidencias.length > 0 ? "py-5 border-zinc-200 bg-zinc-50/30 hover:bg-emerald-50/30 hover:border-emerald-300" : "py-8 border-zinc-300 bg-zinc-50/50 hover:bg-red-50/50 hover:border-red-300"}`}
                            >
                                {compressingPhoto ? (
                                    <div className="w-8 h-8 border-4 border-zinc-200 border-t-red-500 rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="text-3xl group-hover:scale-110 transition-transform">📸</span>
                                        <span className="text-sm font-bold text-zinc-600 group-hover:text-red-600 transition-colors">Cámara</span>
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => { persistFormState(); galleryInputRef.current?.click(); }}
                                disabled={compressingPhoto}
                                className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl transition-all active:scale-95 cursor-pointer group ${form.evidencias.length > 0 ? "py-5 border-zinc-200 bg-zinc-50/30 hover:bg-emerald-50/30 hover:border-emerald-300" : "py-8 border-zinc-300 bg-zinc-50/50 hover:bg-red-50/50 hover:border-red-300"}`}
                            >
                                {compressingPhoto ? (
                                    <div className="w-8 h-8 border-4 border-zinc-200 border-t-red-500 rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="text-3xl group-hover:scale-110 transition-transform">🖼️</span>
                                        <span className="text-sm font-bold text-zinc-600 group-hover:text-red-600 transition-colors">Galería</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}

                    {form.evidencias.length >= MAX_EVIDENCIAS && (
                        <p className="text-xs text-amber-600 font-bold text-center">Se alcanzó el límite de {MAX_EVIDENCIAS} fotos</p>
                    )}
                </div>
            </Card>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 pb-8 border-t border-zinc-200 mt-2">
                <button onClick={() => { onCancel(); setEditingRow(null); clearFormBackup(); }} className="order-2 sm:order-1 flex-1 py-4 md:py-5 rounded-2xl border-2 border-zinc-300 text-zinc-600 font-black text-sm md:text-base hover:bg-zinc-100 hover:border-zinc-400 transition-colors active:scale-95">
                    Cancelar
                </button>
                <button onClick={handleExtintorSave} disabled={saving || !connected} className="order-1 sm:order-2 flex-2 py-4 md:py-5 rounded-2xl bg-red-700 text-white font-black text-sm md:text-base disabled:opacity-50 hover:bg-red-600 shadow-xl shadow-red-900/20 transition-all hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2">
                    {saving ? "⏳ Guardando datos..." : editingRow !== null ? "💾 Actualizar Extintor" : "✅ Guardar Extintor"}
                </button>
            </div>

            <VoiceExtintorModal
                open={voiceModalOpen}
                onClose={() => setVoiceModalOpen(false)}
                onAplicar={aplicarDictado}
                marcas={MARCAS}
                agentes={AGENTES}
                recargas={RECARGAS}
                serviciosExtra={SERVICIOS_EXTRA}
                unidadActual={form.unidadPeso}
                socket={socket}
            />
        </div>
    );
}