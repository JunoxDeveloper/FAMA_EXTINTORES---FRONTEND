import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { EmpresaData, Extintor, Servicio } from "../../types";
import { getSnapshotHastaFecha, mesAnioLabel, ordinalServicio, parseEvidencias, sortExtintoresPersonalizado } from "../../utils/helpers";
import { useExtintorFilters } from "../../hooks/worker";
import { useCertificado } from "../../hooks/dashboard";
import { AsociarExtintorModal, CertificadoModal } from "../modals";
import ExtintorFiltrosBar from "./ExtintorFiltrosBar";
import ExtintorCard from "./ExtintorCard";
import EscanearQRModal from "./EscanearQRModal";

interface ServicioDetailViewProps {
    servicio: Servicio;
    extintores: Extintor[];
    servicios: Servicio[];
    empresa: EmpresaData;
    activeId: string;
    socket: Socket | null;
    hasSedes: boolean;
    sedeNameById: Record<string, string>;
    onDelete: () => void;
    onGuardarFechas: (fechaRetiro: string, fechaEntrega: string, notas: string) => void;
    addExtintorToServicio: (servicioId: string, uid: string, onDone?: (ok: boolean, error?: string) => void) => void;
    removeExtintorDeServicio: (servicioId: string, uid: string) => void;
    setExtintorEstado: (servicioId: string, uid: string, estado: Record<string, any>) => void;
    onNuevoExtintor: () => void;
    onEditarExtintor: (ext: Extintor) => void;
    deleteExtintorSilent: (rowIndex: number) => void;
    autoAsociarUid?: string | null;
    onAutoAsociarConsumido?: () => void;
    etiquetasDisponibles: string[];
}

export default function ServicioDetailView({
    servicio, extintores, servicios, empresa, activeId, socket, hasSedes, sedeNameById, onDelete, onGuardarFechas,
    addExtintorToServicio, removeExtintorDeServicio, setExtintorEstado, onNuevoExtintor, onEditarExtintor, deleteExtintorSilent,
    autoAsociarUid, onAutoAsociarConsumido, etiquetasDisponibles,
}: ServicioDetailViewProps) {
    const [asociarModal, setAsociarModal] = useState(false);
    const [qrModal, setQrModal] = useState(false);
    const [editando, setEditando] = useState(false);
    const [fechaRetiro, setFechaRetiro] = useState(servicio.fechaRetiro);
    const [fechaEntrega, setFechaEntrega] = useState(servicio.fechaEntrega);
    const [notas, setNotas] = useState(servicio.notas || "");

    const registrosDelMes = servicios
        .filter((s) => (s.fechaRetiro || "").slice(0, 7) === (servicio.fechaRetiro || "").slice(0, 7))
        .sort((a, b) => (a.secuencia ?? 0) - (b.secuencia ?? 0));
    const posicionServicio = registrosDelMes.findIndex((s) => s.id === servicio.id) + 1;
    const etiquetaServicio = servicio.fechaRetiro
        ? `${ordinalServicio(posicionServicio)} Servicio de ${mesAnioLabel(servicio.fechaRetiro)}`
        : "Servicio";

    const extintoresDelServicio = extintores
        .filter((e) => servicio.extintorUids.includes(e.uid))
        .map((e) => {
            const snap = servicio.extintorEstados?.[e.uid];
            if (!snap) return e;
            const merged = { ...e, ...snap };
            if (typeof snap.evidencia === "string") {
                const fotos = parseEvidencias(snap.evidencia);
                merged.evidencia = fotos.length > 0 ? "__HAS_EVIDENCIA__" : "";
                merged.evidenciaCount = fotos.length;
            }
            return merged;
        });

    const extintoresDisponibles = extintores
        .filter((e) => !servicio.extintorUids.includes(e.uid))
        .filter((e) => (e.sedeId || null) === (servicio.sedeId || null))
        .map((e) => {
            const snap = getSnapshotHastaFecha(servicios, e.uid, servicio.fechaRetiro);
            return snap ? { ...e, ...snap } : e;
        })
        .filter((e) => e.estadoExtintor !== "De Baja");

    const CAMPOS_RESET_SERVICIO = {
        estadoExtintor: "", ma: "", ph: "", recarga: "",
        valvula: "", manguera: "", manometro: "", tobera: "",
        servicioExtra: "", observaciones: "", evidencia: "[]",
    };

    const handleAsociar = (uid: string) => {
        addExtintorToServicio(servicio.id, uid, (ok, error) => {
            if (!ok) {
                alert(error || "No se pudo asociar el extintor");
                return;
            }
            setExtintorEstado(servicio.id, uid, CAMPOS_RESET_SERVICIO);
            const ext = extintores.find((e) => e.uid === uid);
            if (ext) {
                onEditarExtintor({
                    ...ext,
                    estadoExtintor: "", ma: "", ph: "", recarga: "",
                    valvula: "", manguera: "", manometro: "", tobera: "",
                    servicioExtra: "", observaciones: "",
                    evidencia: "", evidenciaCount: 0,
                });
            }
        });
        setAsociarModal(false);
    };

    const handleQuitar = (ext: Extintor) => {
        const enOtroServicio = servicios.some((s) => s.id !== servicio.id && s.extintorUids.includes(ext.uid));
        const mensaje = enOtroServicio
            ? `¿Quitar "${ext.nSerie || "S/N"}" de este servicio? El extintor y su historial anterior se conservarán.`
            : `¿Quitar "${ext.nSerie || "S/N"}" de este servicio? Al no tener historial previo, se eliminará por completo.`;
        if (!confirm(mensaje)) return;
        if (!enOtroServicio) deleteExtintorSilent(ext.rowIndex);
        removeExtintorDeServicio(servicio.id, ext.uid);
    };

    useEffect(() => {
        if (!autoAsociarUid) return;
        if (!servicio.extintorUids.includes(autoAsociarUid)) {
            handleAsociar(autoAsociarUid);
        }
        onAutoAsociarConsumido?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoAsociarUid, servicio.id]);

    const filtros = useExtintorFilters(extintoresDelServicio, empresa, "servicio");
    const {
        search, setSearch, fMarca, setFMarca, fAgente, setFAgente,
        fPeso, setFPeso, fEstado, setFEstado, soloIncompletos, setSoloIncompletos,
        incompletosCount, marcasDisponibles, agentesDisponibles,
        pesosDisponibles, estadosDisponibles, extintoresOrdenados,
    } = filtros;

    const activeSedeInfo = servicio.sedeId ? { nombre: sedeNameById[servicio.sedeId] } : null;
    const extintoresDelServicioOrdenados = sortExtintoresPersonalizado(
        extintoresDelServicio,
        empresa.servicioWeightOrder,
        empresa.servicioEstadoOrder,
        empresa.servicioAgenteOrder,
        extintores
    );
    const certificado = useCertificado(socket, empresa, activeSedeInfo, servicio, extintoresDelServicioOrdenados);

    return (
        <div className="scroll-area h-full overflow-y-auto p-4 md:p-8 flex flex-col gap-5 max-w-7xl mx-auto w-full">
            <div className="p-4 bg-white border border-zinc-200 rounded-2xl flex flex-col gap-3">
                {editando ? (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-zinc-500 uppercase">Fecha Retiro</label>
                                <input type="date" value={fechaRetiro} onChange={(e) => setFechaRetiro(e.target.value)} className="border-2 border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-zinc-500 uppercase">Fecha Entrega</label>
                                <input type="date" value={fechaEntrega} onChange={(e) => setFechaEntrega(e.target.value)} className="border-2 border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold" />
                            </div>
                        </div>
                        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas" className="border-2 border-zinc-200 rounded-xl px-3 py-2 text-sm resize-none min-h-16" />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditando(false)} className="px-4 py-2 rounded-xl border-2 border-zinc-200 text-sm font-bold text-zinc-500">Cancelar</button>
                            <button onClick={() => { onGuardarFechas(fechaRetiro, fechaEntrega, notas); setEditando(false); }} className="px-4 py-2 rounded-xl bg-red-700 text-white text-sm font-bold">Guardar</button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-black text-zinc-800">📜 {etiquetaServicio}</h2>
                                {servicio.notas && <p className="text-xs text-zinc-400 italic mt-1">{servicio.notas}</p>}
                            </div>
                            <button onClick={() => setEditando(true)} className="w-9 h-9 rounded-xl bg-zinc-100 text-sm flex items-center justify-center">✏️</button>
                        </div>
                        <button onClick={onDelete} className="self-start text-xs font-bold text-red-600">🗑️ Eliminar servicio</button>
                    </>
                )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setAsociarModal(true)} className="px-4 py-2.5 rounded-xl bg-zinc-800 text-white font-bold text-sm active:scale-95 transition-all">
                    🔗 Asociar Extintor Existente
                </button>
                <button onClick={onNuevoExtintor} className="px-4 py-2.5 rounded-xl bg-red-700 text-white font-bold text-sm active:scale-95 transition-all">
                    + Nuevo Extintor
                </button>
                <button onClick={() => setQrModal(true)} className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white font-bold text-sm active:scale-95 transition-all">
                    📷 Escanear QR
                </button>
                <button onClick={certificado.abrir} className="px-4 py-2.5 rounded-xl bg-sky-700 text-white font-bold text-sm active:scale-95 transition-all">
                    📄 Generar Certificado
                </button>
            </div>

            <div className="flex flex-col gap-2.5">
                <h3 className="text-sm font-black text-zinc-600 uppercase tracking-wide">Extintores Asociados ({extintoresDelServicio.length})</h3>
                {extintoresDelServicio.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-10 text-zinc-400 bg-white/60 border-2 border-dashed border-zinc-200 rounded-2xl">
                        <span className="text-4xl opacity-80">🧯</span>
                        <p className="text-xs font-bold text-zinc-500">Sin extintores asociados todavía</p>
                    </div>
                ) : (
                    <>
                        <ExtintorFiltrosBar
                            search={search} setSearch={setSearch}
                            fMarca={fMarca} setFMarca={setFMarca}
                            fAgente={fAgente} setFAgente={setFAgente}
                            fPeso={fPeso} setFPeso={setFPeso}
                            fEstado={fEstado} setFEstado={setFEstado}
                            soloIncompletos={soloIncompletos} setSoloIncompletos={setSoloIncompletos}
                            incompletosCount={incompletosCount}
                            marcasDisponibles={marcasDisponibles}
                            agentesDisponibles={agentesDisponibles}
                            pesosDisponibles={pesosDisponibles}
                            estadosDisponibles={estadosDisponibles}
                        />

                        {extintoresOrdenados.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-12 text-zinc-400 bg-white/60 border-2 border-dashed border-zinc-200 rounded-2xl">
                                <span className="text-4xl drop-shadow-sm opacity-80">🔍</span>
                                <p className="text-sm font-bold text-zinc-500">Ningún extintor coincide con los filtros aplicados</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 md:gap-6">
                                {extintoresOrdenados.map((ext, index) => (
                                    <ExtintorCard
                                        key={ext.uid}
                                        ext={ext}
                                        index={index}
                                        context="historial"
                                        hasSedes={hasSedes}
                                        sedeNameById={sedeNameById}
                                        onEditar={onEditarExtintor}
                                        onEliminar={handleQuitar}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            <AsociarExtintorModal
                isOpen={asociarModal}
                disponibles={extintoresDisponibles}
                onClose={() => setAsociarModal(false)}
                onConfirm={handleAsociar}
            />

            <EscanearQRModal
                isOpen={qrModal}
                socket={socket}
                onClose={() => setQrModal(false)}
                scopeEmpresaId={activeId}
                scopeSedeId={servicio.sedeId}
                onAsociarDirecto={(r) => handleAsociar(r.extintor.uid)}
            />

            <CertificadoModal
                isOpen={certificado.modal}
                onClose={() => certificado.setModal(false)}
                datos={certificado.datos}
                onChange={certificado.actualizar}
                filtroAgente={certificado.filtroAgente}
                onCambiarFiltroAgente={certificado.cambiarFiltroAgente}
                filtroEstado={certificado.filtroEstado}
                onCambiarFiltroEstado={certificado.cambiarFiltroEstado}
                estadosDisponibles={certificado.estadosDisponibles}
                onCambiarTipoCertificado={certificado.cambiarTipoCertificado}
                onCambiarTipoIdentificacion={certificado.cambiarTipoIdentificacion}
                onCambiarDenominacion={certificado.cambiarDenominacion}
                onActualizarRating={certificado.actualizarRating}
                onCambiarColumna={certificado.cambiarColumna}
                onCambiarAccionTrabajo={certificado.cambiarAccionTrabajo}
                familiasDisponibles={certificado.familiasDisponibles}
                hayPqs={certificado.hayPqs}
                pqsVariante={certificado.pqsVariante}
                onCambiarPqsVariante={certificado.cambiarPqsVariante}
                plantillas={certificado.plantillas}
                onCargarPlantilla={certificado.cargarPlantilla}
                onGuardarPlantilla={certificado.guardarComoPlantilla}
                guardandoPlantilla={certificado.guardandoPlantilla}
                hojas={certificado.hojas}
                hojasMeta={certificado.hojasMeta}
                hojaActivaIdx={certificado.hojaActivaIdx}
                onSetHojaActivaIdx={certificado.setHojaActivaIdx}
                onAgregarHoja={certificado.agregarHoja}
                onDuplicarHoja={certificado.duplicarHojaActual}
                onEliminarHoja={certificado.eliminarHoja}
                plantillaActivaId={certificado.plantillaActivaId}
                plantillaActivaNombre={certificado.plantillaActivaNombre}
                onActualizarPlantilla={certificado.actualizarPlantilla}
                certificadoGuardadoId={certificado.certificadoGuardadoId}
                guardandoCertificado={certificado.guardandoCertificado}
                hayCambiosPendientes={certificado.hayCambiosPendientes}
                onGuardarCertificado={certificado.guardarCertificado}
                modoEdicion={certificado.modoEdicion}
                etiquetasDisponibles={etiquetasDisponibles}
                onCrearEtiqueta={certificado.crearEtiquetaCertificado}
                onUsarModoEstandar={certificado.usarModoEstandar}
            />
        </div>
    );
}