import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useEmpresaScope } from "../../context/EmpresaScopeContext";
import { useExportActions, useServicios, useCertificado } from "../../hooks/dashboard";
import { WhatsappModal, AsociarExtintorModal, CertificadoModal } from "../../components/modals";
import ExtintorInventoryPanel from "../../components/dashboard/ExtintorInventoryPanel";
import { getSnapshotHastaFecha, mesAnioLabel, ordinalServicio, parseEvidencias, sortExtintoresPersonalizado } from "../../utils/helpers";

export default function HistorialRegistroView() {
  const { mes, registroId } = useParams<{ mes: string; registroId: string }>();
  const navigate = useNavigate();
  const scope = useEmpresaScope() as any;
  const { selectedEmpresa, customOrders, activeSede, socket, extintores, extintorForm, catalogLists } = scope;

  const { servicios, deleteServicio, addExtintorToServicio, setExtintorEstado } =
    useServicios(socket, selectedEmpresa?.id, activeSede?.id ?? null);
  const servicio = servicios.find((s: any) => s.id === registroId);

  const [asociarModal, setAsociarModal] = useState(false);

  const sincronizarEstadoActual = (uid: string, actual: { servicioId: string; fecha: string; estado: Record<string, any> }) => {
    const rowIndex = extintores.find((e: any) => e.uid === uid)?.rowIndex;
    if (rowIndex === undefined) return;

    let mejor = { fecha: actual.fecha || "", estado: actual.estado };
    servicios.forEach((s: any) => {
      if (s.id === actual.servicioId) return; // ya está representado por "actual"
      const snap = s.extintorEstados?.[uid];
      if (snap && s.extintorUids.includes(uid) && (s.fechaRetiro || "") > mejor.fecha) {
        mejor = { fecha: s.fechaRetiro || "", estado: snap };
      }
    });
    extintorForm.restoreEstado(rowIndex, mejor.estado);
  };

  useEffect(() => {
    const saved = extintorForm?.lastSavedExtintor;
    if (!saved || !servicio) return;
    if (saved.isNew && !servicio.extintorUids.includes(saved.uid)) {
      addExtintorToServicio(servicio.id, saved.uid);
    }
    // La evidencia de este Servicio no se edita desde el Dashboard; se
    // conserva la que ya tenía el snapshot para no perderla al guardar
    // otros campos del extintor.
    const snapPrevio = servicio.extintorEstados?.[saved.uid];
    const estadoAGuardar = { ...saved.estado, evidencia: snapPrevio?.evidencia ?? saved.estado.evidencia ?? "[]" };
    setExtintorEstado(servicio.id, saved.uid, estadoAGuardar);

    sincronizarEstadoActual(saved.uid, { servicioId: servicio.id, fecha: servicio.fechaRetiro, estado: estadoAGuardar });
    extintorForm.clearLastSavedExtintor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extintorForm?.lastSavedExtintor, servicio?.id]);

  const exportActions = useExportActions(
    socket,
    selectedEmpresa,
    customOrders.customWeightOrder,
    customOrders.customEstadoOrder,
    customOrders.customAgenteOrder,
    activeSede?.id ?? null,
    "historial",
    servicio?.extintorUids ?? [],
    servicio?.id
  );
  const {
    exporting, whatsappModal, setWhatsappModal, whatsappFormat, setWhatsappFormat,
    whatsappMsg, setWhatsappMsg, exportExcel, executeWhatsapp, openWhatsappModal,
  } = exportActions;

  const extintoresDelRegistro = sortExtintoresPersonalizado(
    extintores
      .filter((e: any) => (servicio?.extintorUids ?? []).includes(e.uid))
      .map((e: any) => {
        const snap = servicio?.extintorEstados?.[e.uid];
        if (!snap) return e;
        const merged = { ...e, ...snap };
        // La evidencia de este Servicio vive únicamente en el snapshot
        // (extintorEstados[uid].evidencia). No se usa la evidencia global
        // del extintor para no mezclar fotos entre Servicios.
        if (typeof snap.evidencia === "string") {
          const fotos = parseEvidencias(snap.evidencia);
          merged.evidencia = fotos.length > 0 ? "__HAS_EVIDENCIA__" : "";
          merged.evidenciaCount = fotos.length;
          merged.evidenciaFotos = fotos;
        } else {
          merged.evidencia = "";
          merged.evidenciaCount = 0;
          merged.evidenciaFotos = [];
        }
        return merged;
      }),
    selectedEmpresa?.servicioWeightOrder,
    selectedEmpresa?.servicioEstadoOrder,
    selectedEmpresa?.servicioAgenteOrder,
    extintores
  );

  const certificado = useCertificado(socket, selectedEmpresa, activeSede, servicio, extintoresDelRegistro);

  if (!servicio) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-zinc-500 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800">
        <span className="text-6xl drop-shadow-md opacity-80">🔍</span>
        <p className="text-base font-medium">Este registro no existe o fue eliminado.</p>
        <Link to={`../../${mes}`} relative="path" className="text-sm font-bold text-red-400 hover:text-red-300 underline decoration-dotted underline-offset-4">
          Volver al mes
        </Link>
      </div>
    );
  }

  const extintoresDisponibles = extintores
    .filter((e: any) => !servicio.extintorUids.includes(e.uid))
    .filter((e: any) => (e.sedeId || null) === (servicio.sedeId || null))
    .map((e: any) => {
      const snap = getSnapshotHastaFecha(servicios, e.uid, servicio.fechaRetiro);
      return snap ? { ...e, ...snap } : e;
    });

  const registrosDelMes = servicios
    .filter((s: any) => (s.fechaRetiro || "").slice(0, 7) === (servicio.fechaRetiro || "").slice(0, 7))
    .sort((a: any, b: any) => (a.secuencia ?? 0) - (b.secuencia ?? 0));
  const posicionServicio = registrosDelMes.findIndex((s: any) => s.id === servicio.id) + 1;
  const etiquetaServicio = servicio.fechaRetiro
    ? `${ordinalServicio(posicionServicio)} Servicio de ${mesAnioLabel(servicio.fechaRetiro)}`
    : "Servicio";

  const handleDelete = () => {
    deleteServicio(servicio.id);
    navigate(`../../${mes}`, { relative: "path" });
  };

  const handleAsociarExtintor = (uid: string) => {
    const snap = getSnapshotHastaFecha(servicios, uid, servicio.fechaRetiro);
    const ext = extintores.find((e: any) => e.uid === uid);
    const estadoHistorico = snap || (ext ? {
      estadoExtintor: ext.estadoExtintor,
      realizadoPH: ext.realizadoPH,
      vencimPH: ext.vencimPH,
      motivoBaja: ext.motivoBaja,
    } : null);
    if (estadoHistorico?.estadoExtintor === "De Baja") return;

    addExtintorToServicio(servicio.id, uid);
    const estado = estadoHistorico ? {
      estadoExtintor: estadoHistorico.estadoExtintor,
      realizadoPH: estadoHistorico.realizadoPH,
      vencimPH: estadoHistorico.vencimPH,
      motivoBaja: estadoHistorico.motivoBaja,
    } : {};
    setExtintorEstado(servicio.id, uid, estado);
    sincronizarEstadoActual(uid, { servicioId: servicio.id, fecha: servicio.fechaRetiro, estado });
    setAsociarModal(false);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl">
        <div>
          <h3 className="text-xl font-black text-white">📜 {etiquetaServicio}</h3>
          {servicio.notas && <p className="text-sm text-zinc-400 mt-1">{servicio.notas}</p>}
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button onClick={exportExcel} disabled={exporting} className="px-4 py-2 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/40 text-sm font-bold text-emerald-400 border border-emerald-800/50 transition-all disabled:opacity-50">
            {exporting ? "⏳ Generando..." : "📥 Exportar Excel"}
          </button>
          <button onClick={certificado.abrir} className="px-4 py-2 rounded-xl bg-sky-950/30 hover:bg-sky-900/40 text-sm font-bold text-sky-400 border border-sky-800/50 transition-all">
            📄 Generar certificados
          </button>
          <button onClick={() => setAsociarModal(true)} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-zinc-300 border border-zinc-700 transition-all">
            🔗 Asociar Extintor Existente
          </button>
          <button onClick={handleDelete} className="px-4 py-2 rounded-xl bg-red-950/30 hover:bg-red-900/40 text-sm font-bold text-red-400 border border-red-900/40 transition-all">
            🗑️ Eliminar registro
          </button>
        </div>
      </div>

      <ExtintorInventoryPanel
        variant="historial"
        extintoresOverride={extintoresDelRegistro}
        onWhatsapp={openWhatsappModal}
        hasWhatsapp={!!selectedEmpresa?.celular}
      />

      {selectedEmpresa && (
        <WhatsappModal
          isOpen={whatsappModal}
          onClose={() => setWhatsappModal(false)}
          empresa={selectedEmpresa}
          format={whatsappFormat}
          setFormat={setWhatsappFormat}
          msg={whatsappMsg}
          setMsg={setWhatsappMsg}
          exporting={exporting}
          onExecute={executeWhatsapp}
        />
      )}

      <AsociarExtintorModal
        isOpen={asociarModal}
        disponibles={extintoresDisponibles}
        onClose={() => setAsociarModal(false)}
        onConfirm={handleAsociarExtintor}
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
        etiquetasDisponibles={catalogLists.ETIQUETAS_CERTIFICADO}
        onCrearEtiqueta={certificado.crearEtiquetaCertificado}
        onUsarModoEstandar={certificado.usarModoEstandar}
      />
    </div>
  );
}