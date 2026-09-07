import { useEffect, useMemo, useState } from "react";
import { useEmpresaScope } from "../../context/EmpresaScopeContext";
import { useCertificados, useCertificado, useServicios } from "../../hooks/dashboard";
import { VerCertificadoModal, CertificadoModal } from "../../components/modals";
import { MESES } from "../../constants";
import { normalizarHojasGuardadas } from "../../utils/certificadoHojas";

const labelMes = (mesEtiqueta: string): string => {
  if (!mesEtiqueta) return "Sin fecha";
  const [anio, mes] = mesEtiqueta.split("-");
  const nombreMes = MESES.find((m) => m.value === String(Number(mes)))?.label || mes;
  return `${nombreMes} ${anio}`;
};

export default function CertificadosEmpresaView() {
  const scope = useEmpresaScope() as any;
  const { socket, selectedEmpresa, activeSede, sedes, extintores, catalogLists } = scope;
  const sedeId: string | null = activeSede ? activeSede.id : null;
  const hasSedes = (sedes?.sedes?.length || 0) > 0;

  const { certificados, loading, eliminar } = useCertificados(socket, selectedEmpresa?.id, sedeId);
  const { servicios } = useServicios(socket, selectedEmpresa?.id, sedeId);
  const [viendo, setViendo] = useState<any | null>(null);
  const [editandoServicio, setEditandoServicio] = useState<any | null>(null);
  const [certificadoParaCargar, setCertificadoParaCargar] = useState<any | null>(null);
  const [mesAbierto, setMesAbierto] = useState<string | null>(null);

  const extintoresDelServicio = useMemo(() => {
    if (!editandoServicio) return [];
    return (extintores || [])
      .filter((e: any) => (editandoServicio.extintorUids || []).includes(e.uid))
      .map((e: any) => {
        const snap = editandoServicio.extintorEstados?.[e.uid];
        return snap ? { ...e, ...snap } : e;
      });
  }, [editandoServicio, extintores]);

  const certificado = useCertificado(socket, selectedEmpresa, activeSede, editandoServicio, extintoresDelServicio);

  useEffect(() => {
    if (certificadoParaCargar && editandoServicio) {
      certificado.cargarCertificadoGenerado(certificadoParaCargar);
      setCertificadoParaCargar(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificadoParaCargar, editandoServicio, extintoresDelServicio]);

  const gruposPorMes = useMemo(() => {
    const mapa = new Map<string, any[]>();
    certificados.forEach((c: any) => {
      const clave = c.mesEtiqueta || "sin-fecha";
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(c);
    });
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([clave, lista]) => ({
        clave,
        etiqueta: clave === "sin-fecha" ? "Sin fecha" : labelMes(clave),
        certificados: lista.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || "")),
      }));
  }, [certificados]);

  useEffect(() => {
    if (mesAbierto === null && gruposPorMes.length > 0) {
      setMesAbierto(gruposPorMes[gruposPorMes.length - 1].clave);
    }
  }, [gruposPorMes, mesAbierto]);

  const handleEliminar = (id: string) => {
    if (!confirm("¿Eliminar este certificado del historial? Esta acción no se puede deshacer.")) return;
    eliminar(id);
  };

  const abrirVista = (c: any) => {
    const hojasGuardadas = normalizarHojasGuardadas(c.datos);
    if (hojasGuardadas.length === 0) {
      alert("No se pudo leer el certificado guardado");
      return;
    }
    setViendo({ ...c, hojasGuardadas });
  };

  const handleEditar = (c: any) => {
    const servicio = servicios.find((s: any) => s.id === c.servicioId);
    if (!servicio) {
      alert("El servicio original de este certificado ya no existe, no se puede editar.");
      return;
    }
    setEditandoServicio(servicio);
    setCertificadoParaCargar(c);
  };

  const handleCerrarEditor = () => {
    certificado.setModal(false);
    setEditandoServicio(null);
    setCertificadoParaCargar(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl">
        <div>
          <h3 className="text-xl font-black text-white">📄 Certificados</h3>
          <p className="text-sm text-zinc-400 mt-1">
            {selectedEmpresa?.razonSocial}{activeSede && ` · ${activeSede.nombre}`}
            {hasSedes && !activeSede && " · Historial previo a sedes / sin sede asignada"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : gruposPorMes.length === 0 ? (
        <div className="text-center py-20 text-zinc-600 bg-zinc-950/20 rounded-2xl border border-dashed border-zinc-800/60">
          <p className="text-5xl mb-3 opacity-80">📄</p>
          <p className="text-sm font-medium">Aún no hay certificados guardados{activeSede ? " para esta sede" : ""}.</p>
          <p className="text-xs text-zinc-700 mt-1">Se guardan automáticamente cada vez que generas o imprimes un certificado desde un Servicio.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {gruposPorMes.map((grupo) => {
            const abierto = mesAbierto === grupo.clave;
            return (
              <div key={grupo.clave} className="rounded-2xl border border-zinc-800/60 overflow-hidden">
                <button
                  onClick={() => setMesAbierto(abierto ? null : grupo.clave)}
                  className={`w-full flex items-center justify-between px-5 py-4 text-left transition-colors ${abierto ? "bg-zinc-800/40" : "bg-zinc-900/60 hover:bg-zinc-800/60"}`}
                >
                  <span className="text-sm font-black text-zinc-100">🗓️ {grupo.etiqueta}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-zinc-500">{grupo.certificados.length} certificado{grupo.certificados.length === 1 ? "" : "s"}</span>
                    <span className={`text-zinc-500 transition-transform ${abierto ? "rotate-180" : ""}`}>▾</span>
                  </span>
                </button>
                {abierto && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-zinc-900/40 border-y border-zinc-800/60">
                          <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Nombre</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Tipo</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-zinc-500">Generado</th>
                          <th className="px-4 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.certificados.map((c: any) => (
                          <tr key={c.id} className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-900/30">
                            <td className="px-4 py-3 text-xs text-zinc-300">{c.nombre || "—"}</td>
                            <td className="px-4 py-3 text-xs text-zinc-400">{c.tipoCertificado === "ph" ? "Prueba Hidrostática" : "Garantía y Operatividad"}</td>
                            <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">{c.createdAt ? new Date(c.createdAt).toLocaleDateString("es-PE") : "—"}</td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button onClick={() => abrirVista(c)} className="text-xs font-bold text-sky-400 hover:text-sky-300 px-3 py-1.5 rounded-lg bg-sky-950/30 hover:bg-sky-900/40 border border-sky-900/40 mr-1.5">👁️ Ver</button>
                              <button onClick={() => handleEditar(c)} className="text-xs font-bold text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-lg bg-amber-950/30 hover:bg-amber-900/40 border border-amber-900/40 mr-1.5">✏️ Editar</button>
                              <button onClick={() => handleEliminar(c.id)} className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 border border-red-900/40">🗑️</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <VerCertificadoModal
        isOpen={!!viendo}
        onClose={() => setViendo(null)}
        hojasGuardadas={viendo?.hojasGuardadas || []}
        nombreArchivo={`Certificado_${selectedEmpresa?.slug || "fama"}_${viendo?.mesEtiqueta || "historico"}.pdf`}
      />

      <CertificadoModal
        isOpen={certificado.modal}
        onClose={handleCerrarEditor}
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