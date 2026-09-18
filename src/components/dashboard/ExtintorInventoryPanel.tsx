import { useState } from "react";
import { COMP_LABELS } from "../../constants";
import { estadoColor, serviceBadge, formatRealizadoPH, formatVencimPH } from "../../utils/helpers";
import { computeBaseMetrics, getDuplicateSets, getPesoEntriesWithAgents } from "../../utils/dashboardMetrics";
import { FilterSelect, MetricPanel, ComponentDots } from "../ui/DashboardUI";
import { ExtintorModal, ObservationModal, EvidenciaModal, WeightSortModal, HistorialExtintorModal, TrasladoSedeModal, StickersModal } from "../modals";
import { useEmpresaScope } from "../../context/EmpresaScopeContext";
import { useDashboardFilters, useServiciosExtintor, useTraslados } from "../../hooks/dashboard";
import type { Extintor } from "../../types";

interface ExtintorInventoryPanelProps {
    variant: "resumen" | "historial";
    onExportExcel?: () => void;
    exporting?: boolean;
    onWhatsapp?: () => void;
    hasWhatsapp?: boolean;
    extintoresOverride?: Extintor[];
}

export default function ExtintorInventoryPanel({ variant, onExportExcel, exporting, extintoresOverride }: ExtintorInventoryPanelProps) {
    const scope = useEmpresaScope();
    const {
        showMetrics, setShowMetrics, obsModal, setObsModal, evidencia,
        activeSede, extintores: scopeExtintores,
    } = scope as any;

    const baseExtintoresRaw: Extintor[] = extintoresOverride ?? scopeExtintores;

    const baseExtintores: Extintor[] = Array.from(
        new Map(baseExtintoresRaw.map((e) => [e.uid, e])).values()
    );

    const [historialExtintor, setHistorialExtintor] = useState<Extintor | null>(null);
    const [trasladoExtintor, setTrasladoExtintor] = useState<Extintor | null>(null);
    const [stickersModal, setStickersModal] = useState(false);
    const rutaBase = activeSede ? `/dashboard/${scope.selectedEmpresa?.slug}/sedes/${activeSede.slug}` : `/dashboard/${scope.selectedEmpresa?.slug}`;
    const { servicios: historialCompletoExtintor } = useServiciosExtintor(scope.socket, scope.selectedEmpresa?.id, historialExtintor?.uid);
    const traslados = useTraslados(scope.socket, historialExtintor?.uid);
    const trasladoDestino = useTraslados(scope.socket, trasladoExtintor?.uid);

    const {
        estadoCounts, marcaCounts, agenteCounts, pesoCounts, pesoAgentBreakdown, serviceCounts, compCounts,
    } = computeBaseMetrics(baseExtintores);
    const { duplicateSeries, duplicateInternos } = getDuplicateSets(baseExtintores);

    const sedesList = scope.sedes.sedes as any[];
    const hasSedes = sedesList.length > 0;

    const showSedeExtras = variant === "resumen" && !activeSede && hasSedes;
    const sedeNameById: Record<string, string> = Object.fromEntries(sedesList.map((s) => [s.id, s.nombre]));

    const isScopedToRegistro = !!extintoresOverride;
    const {
        customWeightOrder, customEstadoOrder, customAgenteOrder, customSedeOrder,
        setCustomWeightOrder, setCustomEstadoOrder, setCustomAgenteOrder, setCustomSedeOrder,
        weightOrderModal, setWeightOrderModal, estadoOrderModal, setEstadoOrderModal, agenteOrderModal, setAgenteOrderModal, sedeOrderModal, setSedeOrderModal, persistOrders,
    } = isScopedToRegistro ? scope.customOrdersServicio : scope.customOrders;

    const pesoEntriesWithAgents = getPesoEntriesWithAgents(pesoCounts, pesoAgentBreakdown, customWeightOrder);

    const filters = useDashboardFilters([], baseExtintores, customWeightOrder, customEstadoOrder, customAgenteOrder, customSedeOrder, sedeNameById);
    const {
        fMarca, setFMarca, fAgente, setFAgente, fEstado, setFEstado, fPeso, setFPeso,
        fServicio, setFServicio, fComponente, setFComponente, fSede, setFSede,
        filteredExt, sortedExt, totalExtintores, hasFilters,
    } = filters;

    const {
        extintorModal, setExtintorModal, extintorForm, setExtintorForm, editingRowIndex, saving,
        openAddExtintor, openEditExtintor, saveExtintor, deleteExtintor,
        coincidencias, usarExtintorExistente, cerrarAvisoDuplicado, confirmarYGuardar,
    } = scope.extintorForm;
    const { MARCAS, AGENTES, RECARGAS, MOTIVOS_BAJA, SERVICIOS_EXTRA } = scope.catalogLists;

    const handleOpenAddExtintor = () => {
        openAddExtintor();
        if (activeSede) setExtintorForm((p: any) => ({ ...p, sedeId: activeSede.id }));
    };

    const handleUsarExtintorExistente = (rowIndex: number) => {
        const ext = baseExtintores.find((e) => e.rowIndex === rowIndex);
        if (ext) usarExtintorExistente(ext);
        else cerrarAvisoDuplicado();
    };

    const sinSedeCount = scopeExtintores.filter((e: any) => !e.sedeId).length;
    const sedeDistribution: [string, number][] = showSedeExtras
        ? [
            ...sedesList.map((s) => [s.nombre, scopeExtintores.filter((e: any) => e.sedeId === s.id).length] as [string, number]),
            ...(sinSedeCount > 0 ? [["Sin sede", sinSedeCount] as [string, number]] : []),
        ]
        : [];

    return (
        <div className="flex flex-col gap-8">
            {/* ── Métricas ── */}
            <div className="flex flex-col gap-4 bg-zinc-900/20 p-5 rounded-3xl border border-zinc-800/40">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                        📊 Panel de Métricas
                    </h3>
                    <button
                        onClick={() => setShowMetrics((p: any) => !p)}
                        className="px-4 py-1.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5"
                    >
                        {showMetrics ? "Ocultar" : "Mostrar Detalles"} <span className="text-[10px]">{showMetrics ? "▲" : "▼"}</span>
                    </button>
                </div>

                {showMetrics && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            <MetricPanel title="Estado de Extintores" data={estadoCounts} total={totalExtintores} accent />
                            <MetricPanel title="Inventario por Marca" data={marcaCounts} total={totalExtintores} />
                            <MetricPanel title="Tipo de Agente" data={agenteCounts} total={totalExtintores} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <MetricPanel title="Capacidad / Peso" data={pesoEntriesWithAgents} total={totalExtintores} />
                            {variant === "historial" && (
                                <>
                                    <MetricPanel title="Servicios Aplicados" data={Object.entries(serviceCounts)} total={totalExtintores} />
                                    <MetricPanel title="Componentes Reemplazados" data={Object.entries(compCounts).map(([k, v]) => [COMP_LABELS[k] || k, v] as [string, number])} total={totalExtintores} />
                                </>
                            )}
                            {showSedeExtras && (
                                <MetricPanel title="Distribución por Sede" data={sedeDistribution} total={totalExtintores} />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Tabla de extintores ── */}
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl overflow-hidden shadow-xl">
                <div className="px-6 py-5 border-b border-zinc-800/60 bg-zinc-950/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                        <h3 className="text-xl font-black text-white flex items-center gap-3">
                            🧯 Extintores Registrados
                            <span className="px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300">
                                {hasFilters ? `${filteredExt.length} filtrados de ${totalExtintores}` : `Total: ${totalExtintores}`}
                            </span>
                        </h3>
                        {variant === "historial" && (
                            <button
                                onClick={handleOpenAddExtintor}
                                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] hover:shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                            >
                                <span className="text-lg leading-none">+</span> Agregar Extintor
                            </button>
                        )}
                        <div className="flex items-center gap-2 self-start sm:self-auto sm:ml-auto">
                            {variant === "resumen" && onExportExcel && (
                                <button
                                    onClick={onExportExcel}
                                    disabled={exporting}
                                    className="px-4 py-2.5 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/40 text-sm font-bold text-emerald-400 border border-emerald-800/50 transition-all flex items-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-900/20 active:scale-95"
                                >
                                    {exporting ? "⏳ Generando..." : "📥 Exportar Excel"}
                                </button>
                            )}
                            <button
                                onClick={() => setStickersModal(true)}
                                className="px-4 py-2.5 rounded-xl bg-zinc-950/30 hover:bg-zinc-800/60 text-sm font-bold text-zinc-300 border border-zinc-700/60 transition-all flex items-center gap-2 hover:shadow-lg active:scale-95"
                            >
                                🏷️ Generar Stickers
                            </button>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-3 items-center bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800/50">
                        <span className="text-xs font-bold text-zinc-500 ml-1 mr-2 uppercase tracking-wider hidden lg:block">Filtros:</span>
                        <FilterSelect label="Marca" value={fMarca} onChange={setFMarca} options={marcaCounts.map(([v]) => v)} />
                        <FilterSelect label="Agente" value={fAgente} onChange={setFAgente} options={agenteCounts.map(([v]) => v)} />
                        <FilterSelect label="Estado" value={fEstado} onChange={setFEstado} options={estadoCounts.map(([v]) => v)} />
                        <FilterSelect
                            label="Peso"
                            value={fPeso}
                            onChange={setFPeso}
                            options={Object.keys(pesoCounts)}
                        />
                        {showSedeExtras && (
                            <FilterSelect
                                label="Sede"
                                value={fSede}
                                onChange={setFSede}
                                options={[
                                    ...sedesList.map((s) => ({ value: s.id, label: s.nombre })),
                                    { value: "__SIN_SEDE__", label: "Sin sede" },
                                ]}
                            />
                        )}
                        {variant === "historial" && (
                            <FilterSelect label="Servicio" value={fServicio} onChange={setFServicio} options={["Mantenimiento", "Recarga", "Prueba Hidrostatica"]} />
                        )}
                        {variant === "historial" && (
                            <FilterSelect label="Comp. Nuevo" value={fComponente} onChange={setFComponente}
                                options={[
                                    { value: "valvula", label: "Válvula" },
                                    { value: "manguera", label: "Manguera" },
                                    { value: "manometro", label: "Manómetro" },
                                    { value: "tobera", label: "Tobera" },
                                ]} />
                        )}
                        {hasFilters && (
                            <button
                                onClick={() => {
                                    setFMarca(""); setFAgente(""); setFEstado(""); setFSede("");
                                    setFServicio(""); setFComponente(""); setFPeso("");
                                }}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/20 border border-red-900/30 hover:bg-red-900/40 transition-all ml-auto sm:ml-0"
                            >
                                Limpiar
                            </button>
                        )}
                        <div className="flex gap-2 ml-auto sm:ml-0 flex-wrap">
                            {showSedeExtras && (
                                <button
                                    onClick={() => setSedeOrderModal(true)}
                                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                                >
                                    <span className="text-sm">🏬</span>
                                    {customSedeOrder.length > 0 ? `Sede (${customSedeOrder.length})` : "Ord. Sede"}
                                </button>
                            )}
                            <button
                                onClick={() => setEstadoOrderModal(true)}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                            >
                                <span className="text-sm">📌</span>
                                {customEstadoOrder.length > 0 ? `Estado (${customEstadoOrder.length})` : "Ord. Estado"}
                            </button>
                            <button
                                onClick={() => setAgenteOrderModal(true)}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                            >
                                <span className="text-sm">🧯</span>
                                {customAgenteOrder.length > 0 ? `Tipo (${customAgenteOrder.length})` : "Ord. Tipo"}
                            </button>
                            <button
                                onClick={() => setWeightOrderModal(true)}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                            >
                                <span className="text-sm">⚖️</span>
                                {customWeightOrder.length > 0 ? `Peso (${customWeightOrder.length})` : "Ord. Pesos"}
                            </button>
                        </div>
                    </div>
                </div>

                {filteredExt.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-20 text-zinc-500 bg-zinc-950/20">
                        <span className="text-6xl drop-shadow-md opacity-80">🧯</span>
                        <p className="text-base font-medium">{hasFilters ? "No hay extintores que coincidan con los filtros aplicados." : "Aún no se han registrado extintores para esta empresa."}</p>
                        {!hasFilters && variant === "historial" && (
                            <button onClick={handleOpenAddExtintor} className="mt-2 text-sm font-bold text-red-400 hover:text-red-300 underline decoration-dotted underline-offset-4 transition-colors">
                                Registrar el primero
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto max-h-[65vh] relative scroll-smooth rounded-b-3xl">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-20 shadow-md">
                                <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-zinc-400 bg-zinc-950 backdrop-blur-md">
                                    <th className="px-5 py-4 border-b border-zinc-800">#</th>
                                    <th className="px-5 py-4 border-b border-zinc-800">N° Serie</th>
                                    <th className="px-5 py-4 border-b border-zinc-800">N° Interno</th>
                                    <th className="px-5 py-4 border-b border-zinc-800">Marca</th>
                                    <th className="px-5 py-4 border-b border-zinc-800">Agente</th>
                                    <th className="px-5 py-4 border-b border-zinc-800">Peso</th>
                                    <th className="px-5 py-4 border-b border-zinc-800">Estado</th>
                                    {showSedeExtras && <th className="px-5 py-4 border-b border-zinc-800">Sede</th>}
                                    <th className="px-5 py-4 border-b border-zinc-800">Fab.</th>
                                    <th className="px-5 py-4 border-b border-zinc-800" title="Prueba Hidrostática Realizada">PH Realiz.</th>
                                    <th className="px-5 py-4 border-b border-zinc-800" title="Prueba Hidrostática Vencimiento">PH Venc.</th>
                                    {variant === "historial" && <th className="px-5 py-4 border-b border-zinc-800">Servicio</th>}
                                    {variant === "historial" && <th className="px-5 py-4 border-b border-zinc-800 min-w-35">Comp. Nuevos</th>}
                                    {variant === "historial" && <th className="px-5 py-4 border-b border-zinc-800">Serv. Extra</th>}
                                    <th className="px-5 py-4 border-b border-zinc-800">Motivo Baja</th>
                                    <th className="px-5 py-4 border-b border-zinc-800 max-w-50">Observaciones</th>
                                    {variant === "resumen" && <th className="px-5 py-4 border-b border-zinc-800 text-center">Historial</th>}
                                    <th className="px-5 py-4 border-b border-zinc-800 text-center sticky right-0 bg-zinc-950 backdrop-blur-md">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40">
                                {sortedExt.map((ext, i) => {
                                    const badges = serviceBadge(ext.ma, ext.recarga, ext.ph);
                                    const claveSedeExt = ext.sedeId || "__sin_sede__";
                                    const esSerieDuplicada = ext.nSerie && duplicateSeries.has(`${claveSedeExt}|${ext.nSerie.trim()}`);
                                    const esInternoDuplicado = ext.nInterno && duplicateInternos.has(`${claveSedeExt}|${ext.nInterno.trim()}`);
                                    return (
                                        <tr
                                            key={ext.rowIndex}
                                            className={`hover:bg-zinc-800/40 transition-colors group ${i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/20"}`}
                                        >
                                            <td className="px-5 py-3.5 text-red-500 font-black">
                                                {i + 1}
                                            </td>
                                            <td className={`px-5 py-3.5 transition-colors ${esSerieDuplicada ? "bg-yellow-500/20" : ""}`}>
                                                <span className={`font-bold ${esSerieDuplicada ? "text-yellow-400" : "text-zinc-100"}`} title={esSerieDuplicada ? "⚠️ Número de Serie duplicado en esta sede" : ""}>
                                                    {ext.nSerie || "—"}
                                                </span>
                                            </td>
                                            <td className={`px-5 py-3.5 transition-colors ${esInternoDuplicado ? "bg-yellow-500/20" : ""}`}>
                                                <span className={`font-medium ${esInternoDuplicado ? "text-yellow-400" : "text-zinc-400"}`} title={esInternoDuplicado ? "⚠️ Número Interno duplicado en esta sede" : ""}>
                                                    {ext.nInterno || "—"}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 font-medium text-zinc-300">
                                                {ext.marca || "—"}
                                            </td>
                                            <td className="px-5 py-3.5 font-medium text-zinc-300">
                                                {ext.agenteExtintor || "—"}
                                            </td>
                                            <td className="px-5 py-3.5 font-bold text-zinc-300 whitespace-nowrap">
                                                {ext.peso ? `${ext.peso} ${ext.unidadPeso}` : "—"}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span
                                                    className={`inline-block px-3 py-1 rounded-lg text-[11px] font-bold border shadow-sm ${estadoColor[ext.estadoExtintor] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                                                >
                                                    {ext.estadoExtintor || "—"}
                                                </span>
                                            </td>
                                            {showSedeExtras && (
                                                <td className="px-5 py-3.5">
                                                    <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${ext.sedeId ? "bg-zinc-800 text-zinc-300 border border-zinc-700" : "bg-zinc-900 text-zinc-500 border border-dashed border-zinc-700"}`}>
                                                        {ext.sedeId ? (sedeNameById[ext.sedeId] || "—") : "Sin sede"}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-5 py-3.5 font-medium text-zinc-400 text-xs">
                                                {ext.fechaFabricacion || "—"}
                                            </td>
                                            <td className="px-5 py-3.5 font-medium text-zinc-400 text-xs">
                                                {formatRealizadoPH(ext.mesRealizadoPH, ext.realizadoPH) || "—"}
                                            </td>
                                            <td className="px-5 py-3.5 font-bold text-zinc-300 text-xs">
                                                {formatVencimPH(ext.vencimPH) || "—"}
                                            </td>
                                            {variant === "historial" && (
                                                <td className="px-5 py-3.5">
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {badges.length > 0
                                                            ? badges.map((b) => (
                                                                <span
                                                                    key={b.label}
                                                                    className={`px-2.5 py-1 rounded-md text-[10px] font-black border shadow-sm ${b.cls}`}
                                                                >
                                                                    {b.label}
                                                                </span>
                                                            ))
                                                            : <span className="text-zinc-600 font-medium">—</span>}
                                                    </div>
                                                </td>
                                            )}
                                            {variant === "historial" && (
                                                <td className="px-5 py-3.5">
                                                    <ComponentDots ext={ext} />
                                                </td>
                                            )}
                                            {variant === "historial" && (
                                                <td className="px-5 py-3.5">
                                                    {ext.servicioExtra ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {ext.servicioExtra.split(",").map(s => s.trim()).filter(Boolean).map(s => (
                                                                <span key={s} className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-900/40 text-amber-400 border border-amber-800 shadow-sm whitespace-nowrap">
                                                                    {s}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-600 font-medium">—</span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-5 py-3.5">
                                                {ext.motivoBaja ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {ext.motivoBaja.split(",").map(m => m.trim()).filter(Boolean).map(m => (
                                                            <span key={m} className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-900/40 text-red-400 border border-red-800 shadow-sm whitespace-nowrap">
                                                                {m}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-zinc-600 font-medium">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-xs max-w-50">
                                                {ext.observaciones ? (
                                                    <button
                                                        onClick={() => setObsModal(ext.observaciones)}
                                                        className="text-left truncate block text-zinc-400 hover:text-zinc-100 transition-colors underline decoration-dotted underline-offset-4 cursor-pointer w-full font-medium"
                                                        title="Ver observación completa"
                                                    >
                                                        {ext.observaciones}
                                                    </button>
                                                ) : (
                                                    <span className="text-zinc-600 font-medium">—</span>
                                                )}
                                            </td>
                                            {variant === "resumen" && (
                                                <td className="px-5 py-3.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => setHistorialExtintor(ext)}
                                                            className="w-8 h-8 rounded-xl bg-zinc-800/80 hover:bg-red-900/60 text-sm flex items-center justify-center border border-zinc-700 hover:border-red-700/60 transition-all"
                                                            title="Ver historial de servicios"
                                                        >
                                                            📜
                                                        </button>
                                                        {hasSedes && (
                                                            <button
                                                                onClick={() => setTrasladoExtintor(ext)}
                                                                className="w-8 h-8 rounded-xl bg-zinc-800/80 hover:bg-amber-900/60 text-sm flex items-center justify-center border border-zinc-700 hover:border-amber-700/60 transition-all"
                                                                title="Trasladar de Sede"
                                                            >
                                                                🔀
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                            <td className="px-5 py-3.5 sticky right-0 bg-zinc-950/80 backdrop-blur-md group-hover:bg-zinc-800/90 transition-colors border-l border-zinc-800/40">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {ext.evidencia === "__HAS_EVIDENCIA__" && (variant === "historial" || ext.estadoExtintor === "De Baja") && (
                                                        <button
                                                            onClick={() => evidencia.open(ext, ext.evidenciaFotos)}
                                                            className="w-8 h-8 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/80 text-sm flex items-center justify-center border border-emerald-800/50 hover:border-emerald-600 transition-all hover:shadow-md hover:shadow-emerald-900/20 relative"
                                                            title={`Ver ${ext.evidenciaCount || 1} foto(s)`}
                                                        >
                                                            📷
                                                            {(ext.evidenciaCount || 0) > 1 && (
                                                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center">{ext.evidenciaCount}</span>
                                                            )}
                                                        </button>
                                                    )}
                                                    {/* Punto 3: se oculta visualmente en "Todos los Extintores" (edición
                                se hace desde Historial), pero se mantiene la funcionalidad y el
                                botón intacto para variant="historial". */}
                                                    {variant === "historial" && (
                                                        <button
                                                            onClick={() => openEditExtintor(ext)}
                                                            className="w-8 h-8 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-sm flex items-center justify-center border border-zinc-700 transition-all hover:shadow-md"
                                                            title="Editar Extintor"
                                                        >
                                                            ✏️
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => deleteExtintor(ext.rowIndex)}
                                                        className="w-8 h-8 rounded-xl bg-zinc-800/80 hover:bg-red-900/80 text-sm flex items-center justify-center border border-zinc-700 hover:border-red-700/80 transition-all hover:shadow-md"
                                                        title="Eliminar Extintor"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ════ MODALES DEL INVENTARIO ════ */}
            {extintorModal && (
                <ExtintorModal form={extintorForm} setForm={setExtintorForm} isEditing={editingRowIndex !== null} onClose={() => setExtintorModal(false)} onSave={saveExtintor} saving={saving} marcas={MARCAS} agentes={AGENTES} recargas={RECARGAS} motivosBaja={MOTIVOS_BAJA} serviciosExtra={SERVICIOS_EXTRA} socket={scope.socket} userRole={scope.role} coincidencias={coincidencias} onUsarExistente={handleUsarExtintorExistente} onCerrarAvisoDuplicado={cerrarAvisoDuplicado} onConfirmarYGuardar={confirmarYGuardar} />
            )}
            <ObservationModal observation={obsModal} onClose={() => setObsModal(null)} />
            <EvidenciaModal
                isOpen={evidencia.isOpen}
                loading={evidencia.loading}
                list={evidencia.list}
                extInfo={evidencia.extInfo}
                activeIdx={evidencia.activeIdx}
                setActiveIdx={evidencia.setActiveIdx}
                onClose={evidencia.close}
            />
            <WeightSortModal
                isOpen={estadoOrderModal}
                onClose={() => setEstadoOrderModal(false)}
                availableWeights={estadoCounts.map(([v]: [string, number]) => v)}
                currentOrder={customEstadoOrder}
                title="🔥 Ordenar por Estado"
                label="Estados Disponibles"
                onSave={(newOrder: string[]) => { setCustomEstadoOrder(newOrder); setEstadoOrderModal(false); persistOrders({ estadoOrder: newOrder }); }}
            />
            <WeightSortModal
                isOpen={agenteOrderModal}
                onClose={() => setAgenteOrderModal(false)}
                availableWeights={agenteCounts.map(([v]: [string, number]) => v)}
                currentOrder={customAgenteOrder}
                title="🧯 Ordenar por Tipo"
                label="Tipos Disponibles"
                onSave={(newOrder: string[]) => { setCustomAgenteOrder(newOrder); setAgenteOrderModal(false); persistOrders({ agenteOrder: newOrder }); }}
            />
            <WeightSortModal
                isOpen={weightOrderModal}
                onClose={() => setWeightOrderModal(false)}
                availableWeights={Object.keys(pesoCounts)}
                currentOrder={customWeightOrder}
                title="⚖️ Ordenar por Peso"
                label="Pesos Disponibles"
                onSave={(newOrder: string[]) => { setCustomWeightOrder(newOrder); setWeightOrderModal(false); persistOrders({ weightOrder: newOrder }); }}
            />
            {showSedeExtras && (
                <WeightSortModal
                    isOpen={sedeOrderModal}
                    onClose={() => setSedeOrderModal(false)}
                    availableWeights={[...sedesList.map((s) => s.nombre), "Sin sede"]}
                    currentOrder={customSedeOrder}
                    title="🏬 Ordenar por Sede"
                    label="Sedes Disponibles"
                    onSave={(newOrder: string[]) => { setCustomSedeOrder(newOrder); setSedeOrderModal(false); persistOrders({ sedeOrder: newOrder }); }}
                />
            )}
            <HistorialExtintorModal
                isOpen={!!historialExtintor}
                extintor={historialExtintor}
                servicios={historialCompletoExtintor}
                traslados={traslados.traslados}
                sedeNameById={sedeNameById}
                rutaBase={rutaBase}
                onClose={() => setHistorialExtintor(null)}
            />
            <TrasladoSedeModal
                isOpen={!!trasladoExtintor}
                extintorNombre={trasladoExtintor?.nSerie || "S/N"}
                sedeOrigenNombre={trasladoExtintor?.sedeId ? (sedeNameById[trasladoExtintor.sedeId] || "—") : "Sin sede"}
                sedesDisponibles={sedesList.filter((s) => s.id !== trasladoExtintor?.sedeId)}
                onClose={() => setTrasladoExtintor(null)}
                saving={trasladoDestino.savingTraslado}
                onConfirm={(data: any) => {
                    if (!trasladoExtintor || !scope.selectedEmpresa?.id) return;
                    trasladoDestino.trasladarExtintor({
                        extintorUid: trasladoExtintor.uid,
                        rowIndex: trasladoExtintor.rowIndex,
                        empresaId: scope.selectedEmpresa.id,
                        sedeOrigenId: trasladoExtintor.sedeId,
                        sedeDestinoId: data.sedeDestinoId,
                        fecha: data.fecha,
                        motivo: data.motivo,
                    }, (ok, error) => {
                        if (ok) setTrasladoExtintor(null);
                        else if (error) alert(error);
                    });
                }}
            />
            <StickersModal
                isOpen={stickersModal}
                extintores={sortedExt}
                empresaNombre={scope.selectedEmpresa?.razonSocial}
                sedeNombreById={sedeNameById}
                onClose={() => setStickersModal(false)}
            />
        </div>
    );
}