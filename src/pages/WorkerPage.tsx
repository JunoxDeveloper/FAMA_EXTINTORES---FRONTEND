import { useEffect, useState } from "react";
import type { Extintor, Servicio, WorkerView as View } from "../types";
import { anioFromFecha, emptyEmpresa, mesFromFecha } from "../utils/helpers";
import { useSocket, useCatalogLists } from "../hooks";
import {
  EmpresaFormView, ExtintoresListaView, ExtintorFormView, HomeView,
  SedesView, HistorialMesesView, HistorialMesView, ServicioDetailView, EscanearQRModal,
} from "../components/worker";
import { useEmpresaWorkerData, useExtintorFilters, useExtintorForm, useFormBackup, usePhotoCapture } from "../hooks/worker";
import { useSedes, useServicios, useTraslados } from "../hooks/dashboard";
import { TrasladoSedeModal } from "../components/modals";

export default function WorkerPage({ user, onLogout }: { user: { id: string; username: string; role: string; displayName: string }; onLogout: () => void }) {
  const { socket, connected, catalogs } = useSocket(user.id, onLogout);
  const { MARCAS, AGENTES, RECARGAS, MOTIVOS_BAJA, SERVICIOS_EXTRA, ETIQUETAS_CERTIFICADO } = useCatalogLists(catalogs);

  const [view, setView] = useState<View>("home");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const empresaData = useEmpresaWorkerData(socket, setView, showToast, setSaving);
  const {
    empresas, activeId, activeIdRef, empresa, setEmpresa, extintores, extintoresGlobal,
    activeSedeId, changeActiveSede, changeActiveId, selectEmpresa, handleEmpresaSave,
  } = empresaData;

  const extintorForm = useExtintorForm(
    socket,
    user.role,
    activeId,
    setView,
    showToast,
    setSaving,
    () => formBackup.clearFormBackup(),
    activeSedeId
  );
  const {
    form, setForm, editingRow, setEditingRow, returnView,
    lastSavedExtintor, clearLastSavedExtintor,
    handleRealizadoPH, handleMesRealizadoPH, handleExtintorSave, handleEdit, openCrearExtintor, handleDelete, deleteExtintorSilent, setF,
    coincidencias, cerrarAvisoDuplicado, confirmarYGuardar,
  } = extintorForm;

  const formBackup = useFormBackup(
    socket, form, editingRow, activeIdRef, view, empresa.razonSocial,
    changeActiveId, setForm, setEditingRow, setView, showToast
  );
  const { persistFormState, clearFormBackup } = formBackup;

  const photoCapture = usePhotoCapture(setForm, showToast);
  const {
    cameraInputRef, galleryInputRef, compressingPhoto,
    handleCameraCapture, removeEvidencia, MAX_EVIDENCIAS,
  } = photoCapture;

  const filters = useExtintorFilters(extintores, empresa);
  const {
    search, setSearch, fMarca, setFMarca, fAgente, setFAgente,
    fPeso, setFPeso, fEstado, setFEstado, soloIncompletos, setSoloIncompletos,
    incompletosCount, marcasDisponibles, agentesDisponibles,
    pesosDisponibles, estadosDisponibles, extintoresOrdenados,
  } = filters;

  const sedesHook = useSedes(socket, activeId);
  const { sedes, sedeModal, setSedeModal, editingSede, setEditingSede, savingSede, openCreateSede, openEditSede, saveSede } = sedesHook;
  const hasSedes = sedes.length > 0;
  const sedeNameById = Object.fromEntries(sedes.map((s) => [s.id, s.nombre]));

  const serviciosHook = useServicios(socket, activeId, activeSedeId ?? null);
  const { servicios, saveServicio, deleteServicio, updateServicioDatos, addExtintorToServicio, removeExtintorDeServicio, setExtintorEstado } = serviciosHook;
  const serviciosGlobalHook = useServicios(socket, activeId, undefined);
  const { servicios: serviciosGlobal } = serviciosGlobalHook;

  const [activeAnio, setActiveAnio] = useState(2026);
  const [activeMes, setActiveMes] = useState<number | null>(null);
  const [activeServicioId, setActiveServicioId] = useState<string | null>(null);
  const activeServicio = servicios.find((s) => s.id === activeServicioId) || null;

  const [trasladoExtintor, setTrasladoExtintor] = useState<Extintor | null>(null);
  const trasladosHook = useTraslados(socket, trasladoExtintor?.uid);

  const [qrModal, setQrModal] = useState(false);
  const [scanUidParaAsociar, setScanUidParaAsociar] = useState<string | null>(null);
  const [pendingScan, setPendingScan] = useState<{ empresaId: string; sedeId: string | null; uid: string; action: "asociar" | "crear" | "servicio"; servicioId?: string } | null>(null);

  useEffect(() => {
    const saved = lastSavedExtintor;
    if (!saved || !activeServicio || returnView !== "servicio") return;
    if (saved.isNew && !activeServicio.extintorUids.includes(saved.uid)) {
      addExtintorToServicio(activeServicio.id, saved.uid);
    }
    setExtintorEstado(activeServicio.id, saved.uid, saved.estado);
    clearLastSavedExtintor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSavedExtintor, activeServicio?.id, returnView]);

  const onSelectMes = (anio: number, mes: number) => {
    setActiveAnio(anio);
    setActiveMes(mes);
    setView("historialMes");
  };

  const onCrearServicio = (fechaRetiro: string, fechaEntrega: string) => {
    saveServicio({ fechaRetiro, fechaEntrega, extintorUids: [] }, (ok, id) => {
      if (ok && id) {
        setActiveServicioId(id);
        setView("servicio");
      }
    });
  };

  const iniciarFlujoQR = (r: { extintor: Extintor; empresa: { id: string; razonSocial: string }; sede: { id: string; nombre: string } | null }, accion: "asociar" | "crear") => {
    setQrModal(false);
    selectEmpresa(r.empresa.id);
    changeActiveSede(r.sede?.id ?? null);
    setPendingScan({ empresaId: r.empresa.id, sedeId: r.sede?.id ?? null, uid: r.extintor.uid, action: accion });
  };

  const irAlServicioDesdeQR = (r: { empresa: { id: string; razonSocial: string }; sede: { id: string; nombre: string } | null }, servicioId: string) => {
    setQrModal(false);
    selectEmpresa(r.empresa.id);
    changeActiveSede(r.sede?.id ?? null);
    setPendingScan({ empresaId: r.empresa.id, sedeId: r.sede?.id ?? null, uid: "", action: "servicio", servicioId });
  };

  useEffect(() => {
    if (!pendingScan) return;
    if (activeId !== pendingScan.empresaId || activeSedeId !== pendingScan.sedeId) return;
    setScanUidParaAsociar(pendingScan.uid);
    if (pendingScan.action === "servicio" && pendingScan.servicioId) {
      setActiveServicioId(pendingScan.servicioId);
      setView("servicio");
    } else {
      setView("historial");
    }
    setPendingScan(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingScan, activeId, activeSedeId]);

  const irAlServicioDesdeHistorial = (s: Servicio) => {
    const anio = anioFromFecha(s.fechaRetiro);
    const mes = mesFromFecha(s.fechaRetiro);
    if (anio === null || mes === null) return;
    if (s.sedeId !== activeSedeId) changeActiveSede(s.sedeId);
    setActiveAnio(anio);
    setActiveMes(mes);
    setActiveServicioId(s.id);
    setView("servicio");
  };

  const goBack = () => {
    if (view === "form") { setView(returnView); return; }
    if (view === "servicio") { setView("historialMes"); return; }
    if (view === "historialMes") { setView("historial"); return; }
    if (view === "historial" && activeSedeId) { changeActiveSede(null); setView("todos"); return; }
    setView("home");
  };

  const mostrarTabs = activeId && view !== "home" && !["historialMes", "servicio", "form"].includes(view);

  return (
    <div className="app-workers flex flex-col h-dvh w-full bg-zinc-50/50 shadow-2xl relative" style={{ fontFamily: "'Instrument Sans', 'SF Pro Display', system-ui, sans-serif" }}>

      <header className="relative flex items-center justify-between px-5 md:px-8 bg-linear-to-r from-red-800 to-red-700 shrink-0 h-16 md:h-20 shadow-md z-20">
        <div className="flex items-center justify-start gap-4 z-10 w-1/3">
          {view !== "home" && (
            <button
              onClick={goBack}
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

      {activeId && view !== "home" && (
        <div className="px-4 md:px-8 pt-3 flex items-center gap-1.5 text-xs font-bold text-zinc-500 flex-wrap">
          <button onClick={() => { changeActiveSede(null); setView("todos"); }} className="text-zinc-700 hover:text-red-600 transition-colors">
            {empresa.razonSocial || activeId}
          </button>
          {activeSedeId && <><span className="text-zinc-300">›</span><button onClick={() => setView("sedes")} className="text-red-600 hover:text-red-700 transition-colors">{sedeNameById[activeSedeId] || "Sede"}</button></>}
          {(view === "historial" || view === "historialMes" || view === "servicio") && <><span className="text-zinc-300">›</span><span className="text-red-600">Historial</span></>}
          {(view === "historialMes" || view === "servicio") && <><span className="text-zinc-300">›</span><span className="text-red-600">{activeAnio}/{activeMes}</span></>}
          {view === "servicio" && <><span className="text-zinc-300">›</span><span className="text-red-600">Servicio</span></>}
        </div>
      )}

      {mostrarTabs && (
        <nav className="flex items-center gap-2 p-3 md:p-4 bg-white border-b border-zinc-200 shrink-0 shadow-sm z-10 overflow-x-auto scrollbar-hide">
          {(activeSedeId
            ? (["todos", "historial"] as const)
            : (["empresa", "todos", "historial", "sedes"] as const)
          ).map((v) => {
            const labels = {
              empresa: "🏢 Datos",
              todos: `🧯 Todos los Extintores${extintores.length ? ` (${extintores.length})` : ""}`,
              historial: hasSedes && !activeSedeId ? "📁 Historial previo a sedes" : "📜 Historial",
              sedes: "🏬 Sedes",
            } as Record<string, string>;
            const isActive = view === v;
            return (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 min-w-fit px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all active:scale-95 ${isActive ? "bg-red-700 text-white shadow-md shadow-red-900/20" : "bg-zinc-100/80 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800"}`}
              >
                {labels[v]}
              </button>
            );
          })}
        </nav>
      )}

      {toast && (
        <div
          className={`toast-anim fixed top-24 left-1/2 z-50 px-6 py-3.5 rounded-full text-sm font-bold text-white shadow-2xl whitespace-nowrap flex items-center gap-2 ${toast.type === "ok" ? "bg-emerald-600 shadow-emerald-900/30" : "bg-red-600 shadow-red-900/30"}`}
          style={{ transform: "translateX(-50%)" }}
        >
          {toast.type === "ok" ? "✅" : "⚠️"} {toast.msg}
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCameraCapture}
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCameraCapture}
      />

      <main className="flex-1 overflow-hidden relative bg-zinc-50/50">

        {view === "home" && (
          <HomeView
            empresas={empresas}
            connected={connected}
            selectEmpresa={selectEmpresa}
            onCreateNew={() => { setEmpresa(emptyEmpresa()); changeActiveId(""); setView("empresa"); }}
            onEscanearQR={() => setQrModal(true)}
          />
        )}

        {view === "empresa" && (
          <EmpresaFormView
            empresa={empresa}
            setEmpresa={setEmpresa}
            handleEmpresaSave={handleEmpresaSave}
            saving={saving}
            connected={connected}
          />
        )}

        {view === "sedes" && (
          <SedesView
            sedes={sedes}
            sedeModal={sedeModal}
            setSedeModal={setSedeModal}
            editingSede={editingSede}
            setEditingSede={setEditingSede}
            savingSede={savingSede}
            openCreateSede={openCreateSede}
            openEditSede={openEditSede}
            saveSede={saveSede}
            activeSedeId={activeSedeId}
            changeActiveSede={changeActiveSede}
            setView={setView}
          />
        )}

        {view === "historial" && (
          <HistorialMesesView servicios={servicios} onSelectMes={onSelectMes} esHistorialPrevioASedes={hasSedes && !activeSedeId} />
        )}

        {view === "historialMes" && activeMes !== null && (
          <HistorialMesView
            anio={activeAnio}
            mes={activeMes}
            servicios={servicios}
            savingServicio={serviciosHook.savingServicio}
            onCrear={onCrearServicio}
            onSelectServicio={(id) => { setActiveServicioId(id); setView("servicio"); }}
            sedeNameById={hasSedes && !activeSedeId ? sedeNameById : undefined}
          />
        )}

        {view === "servicio" && activeServicio && (
          <ServicioDetailView
            servicio={activeServicio}
            extintores={extintoresGlobal}
            servicios={servicios}
            empresa={empresa}
            activeId={activeId}
            socket={socket}
            hasSedes={hasSedes}
            sedeNameById={sedeNameById}
            onDelete={() => { deleteServicio(activeServicio.id); setView("historialMes"); }}
            onGuardarFechas={(fechaRetiro, fechaEntrega, notas) => updateServicioDatos(activeServicio.id, fechaRetiro, fechaEntrega, notas)}
            addExtintorToServicio={addExtintorToServicio}
            removeExtintorDeServicio={removeExtintorDeServicio}
            setExtintorEstado={setExtintorEstado}
            onNuevoExtintor={() => openCrearExtintor("servicio")}
            onEditarExtintor={(ext) => handleEdit(ext, "servicio")}
            deleteExtintorSilent={deleteExtintorSilent}
            autoAsociarUid={scanUidParaAsociar}
            onAutoAsociarConsumido={() => setScanUidParaAsociar(null)}
            etiquetasDisponibles={ETIQUETAS_CERTIFICADO}
          />
        )}

        {view === "todos" && (
          <ExtintoresListaView
            empresa={empresa}
            activeId={activeId}
            setView={setView}
            extintores={extintores}
            servicios={serviciosGlobal}
            socket={socket}
            search={search}
            setSearch={setSearch}
            fMarca={fMarca}
            setFMarca={setFMarca}
            fAgente={fAgente}
            setFAgente={setFAgente}
            fPeso={fPeso}
            setFPeso={setFPeso}
            fEstado={fEstado}
            setFEstado={setFEstado}
            soloIncompletos={soloIncompletos}
            setSoloIncompletos={setSoloIncompletos}
            incompletosCount={incompletosCount}
            marcasDisponibles={marcasDisponibles}
            agentesDisponibles={agentesDisponibles}
            pesosDisponibles={pesosDisponibles}
            estadosDisponibles={estadosDisponibles}
            extintoresOrdenados={extintoresOrdenados}
            handleDelete={handleDelete}
            hasSedes={hasSedes}
            activeSedeId={activeSedeId}
            sedeNameById={sedeNameById}
            onTrasladar={setTrasladoExtintor}
            onIrAlServicio={irAlServicioDesdeHistorial}
          />
        )}

        {view === "form" && (
          <ExtintorFormView
            editingRow={editingRow}
            form={form}
            setForm={setForm}
            setF={setF}
            handleRealizadoPH={handleRealizadoPH}
            handleMesRealizadoPH={handleMesRealizadoPH}
            handleExtintorSave={handleExtintorSave}
            socket={socket}
            userRole={user.role}
            MARCAS={MARCAS}
            AGENTES={AGENTES}
            RECARGAS={RECARGAS}
            MOTIVOS_BAJA={MOTIVOS_BAJA}
            SERVICIOS_EXTRA={SERVICIOS_EXTRA}
            saving={saving}
            connected={connected}
            setView={setView}
            setEditingRow={setEditingRow}
            clearFormBackup={clearFormBackup}
            onCancel={() => setView(returnView)}
            MAX_EVIDENCIAS={MAX_EVIDENCIAS}
            removeEvidencia={removeEvidencia}
            persistFormState={persistFormState}
            cameraInputRef={cameraInputRef}
            galleryInputRef={galleryInputRef}
            compressingPhoto={compressingPhoto}
            coincidencias={coincidencias}
            onUsarExistente={(rowIndex) => {
              const ext = extintoresGlobal.find((e) => e.rowIndex === rowIndex) || extintores.find((e) => e.rowIndex === rowIndex);
              if (ext) handleEdit(ext, returnView);
              else cerrarAvisoDuplicado();
            }}
            onCerrarAvisoDuplicado={cerrarAvisoDuplicado}
            onConfirmarYGuardar={confirmarYGuardar}
          />
        )}
      </main>

      <TrasladoSedeModal
        isOpen={!!trasladoExtintor}
        extintorNombre={trasladoExtintor?.nSerie || "S/N"}
        sedeOrigenNombre={trasladoExtintor?.sedeId ? (sedeNameById[trasladoExtintor.sedeId] || "—") : "Sin sede"}
        sedesDisponibles={sedes.filter((s) => s.id !== trasladoExtintor?.sedeId)}
        onClose={() => setTrasladoExtintor(null)}
        saving={trasladosHook.savingTraslado}
        onConfirm={(data) => {
          if (!trasladoExtintor || !activeId) return;
          trasladosHook.trasladarExtintor({
            extintorUid: trasladoExtintor.uid,
            rowIndex: trasladoExtintor.rowIndex,
            empresaId: activeId,
            sedeOrigenId: trasladoExtintor.sedeId,
            sedeDestinoId: data.sedeDestinoId,
            fecha: data.fecha,
            motivo: data.motivo,
          }, (ok, error) => {
            if (ok) setTrasladoExtintor(null);
            else if (error) showToast(error, "err");
          });
        }}
      />

      <EscanearQRModal
        isOpen={qrModal}
        socket={socket}
        onClose={() => setQrModal(false)}
        onAsociar={(r) => iniciarFlujoQR(r, "asociar")}
        onCrearServicio={(r) => iniciarFlujoQR(r, "crear")}
        onIrAlServicio={(r, s) => irAlServicioDesdeQR(r, s.id)}
      />
    </div>
  );
}