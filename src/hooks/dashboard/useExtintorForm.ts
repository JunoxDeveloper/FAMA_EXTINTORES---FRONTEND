import { useState } from "react";
import type { Socket } from "socket.io-client";
import type { EmpresaData, Extintor } from "../../types";
import { emptyExtintor, estadoBloqueaServicio, estadoBloqueaServicioExtra, estadoBloqueaComponentes } from "../../utils/helpers";


export function useExtintorForm(
  socket: Socket | null,
  role: string,
  selectedEmpresa: EmpresaData | null,
  saving: boolean,
  setSaving: (v: boolean) => void
) {
  const [extintorModal, setExtintorModal] = useState(false);
  const [extintorForm, setExtintorForm] = useState<Partial<Extintor>>(emptyExtintor());
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [coincidencias, setCoincidencias] = useState<{ uid: string; rowIndex: number; nSerie: string; nInterno: string; marca: string; agenteExtintor: string; peso: string; unidadPeso: string; fechaFabricacion: string; mesRealizadoPH: string; realizadoPH: string; sedeId: string | null; estadoExtintor: string; nivel: "fuerte" | "sospechosa"; camposCoincidentes: string[] }[] | null>(null);

  const [lastSavedExtintor, setLastSavedExtintor] = useState<{ uid: string; isNew: boolean; estado: Record<string, any> } | null>(null);
  const clearLastSavedExtintor = () => setLastSavedExtintor(null);

  const openAddExtintor = () => {
    setExtintorForm(emptyExtintor());
    setEditingRowIndex(null);
    setCoincidencias(null);
    setExtintorModal(true);
  };

  const openEditExtintor = (ext: Extintor) => {
    setExtintorForm({ ...ext });
    setEditingRowIndex(ext.rowIndex);
    setCoincidencias(null);
    setExtintorModal(true);
  };

  const construirPayload = () => {
    const { evidencia, evidenciaCount, evidenciaFotos, deletedAt, ...formSinFlags } = extintorForm as any;
    const bloqueado = estadoBloqueaServicio(extintorForm.estadoExtintor || "");
    const componentesBloqueados = estadoBloqueaComponentes(extintorForm.estadoExtintor || "");

    return {
      ...formSinFlags,
      id: selectedEmpresa?.id,
      nSerie: !extintorForm.nSerie || extintorForm.nSerie.trim() === "" ? "S/N" : extintorForm.nSerie.trim().toUpperCase(),
      nInterno: !extintorForm.nInterno || extintorForm.nInterno.trim() === "" ? "S/TAG" : extintorForm.nInterno.trim().toUpperCase(),
      ma: bloqueado ? "" : extintorForm.ma,
      ph: bloqueado ? "" : extintorForm.ph,
      recarga: bloqueado ? "" : extintorForm.recarga,
      servicioExtra: estadoBloqueaServicioExtra(extintorForm.estadoExtintor || "") ? "" : extintorForm.servicioExtra,
      valvula: componentesBloqueados ? "" : extintorForm.valvula,
      manguera: componentesBloqueados ? "" : extintorForm.manguera,
      manometro: componentesBloqueados ? "" : extintorForm.manometro,
      tobera: componentesBloqueados ? "" : extintorForm.tobera,
    };
  };

  const ejecutarGuardado = (confirmarDuplicado: boolean) => {
    if (!socket || !selectedEmpresa?.id) return;
    setSaving(true);

    const payload = construirPayload();

    const estadoSnapshot = {
      estadoExtintor: payload.estadoExtintor,
      realizadoPH: payload.realizadoPH,
      mesRealizadoPH: payload.mesRealizadoPH,
      vencimPH: payload.vencimPH,
      ma: payload.ma,
      ph: payload.ph,
      recarga: payload.recarga,
      valvula: payload.valvula,
      manguera: payload.manguera,
      manometro: payload.manometro,
      tobera: payload.tobera,
      observaciones: payload.observaciones,
      servicioExtra: payload.servicioExtra,
      motivoBaja: payload.motivoBaja,
    };

    if (editingRowIndex !== null) {
      socket.emit("extintor:update", { ...payload, rowIndex: editingRowIndex }, (res: any) => {
        setSaving(false);
        if (res?.success) {
          setExtintorModal(false);
          if (extintorForm.uid) setLastSavedExtintor({ uid: extintorForm.uid, isNew: false, estado: estadoSnapshot });
        }
        else alert(res?.error || "No se pudo actualizar el extintor");
      });
    } else {
      socket.emit("extintor:add", { ...payload, confirmarDuplicado }, (res: any) => {
        setSaving(false);
        if (res?.success) {
          setExtintorModal(false);
          setCoincidencias(null);
          if (res.uid) setLastSavedExtintor({ uid: res.uid, isNew: true, estado: estadoSnapshot });
        }
        else if (res?.coincidencias) setCoincidencias(res.coincidencias);
        else alert(res?.error || "No se pudo guardar el extintor");
      });
    }
  };

  const saveExtintor = () => ejecutarGuardado(false);

  const usarExtintorExistente = (ext: Extintor) => {
    openEditExtintor(ext);
  };

  const cerrarAvisoDuplicado = () => setCoincidencias(null);

  const confirmarYGuardar = () => ejecutarGuardado(true);

  const deleteExtintor = (rowIndex: number) => {
    if (!socket || !selectedEmpresa?.id || !confirm("¿Eliminar este extintor?")) return;
    socket.emit("extintor:delete", { id: selectedEmpresa.id, rowIndex, role });
  };

  const restoreEstado = (rowIndex: number, estado: Record<string, any>) => {
    if (!socket) return;
    socket.emit("extintor:update", { ...estado, rowIndex });
  };

  return {
    extintorModal,
    setExtintorModal,
    extintorForm,
    setExtintorForm,
    editingRowIndex,
    saving,
    coincidencias,
    usarExtintorExistente,
    cerrarAvisoDuplicado,
    confirmarYGuardar,
    lastSavedExtintor,
    clearLastSavedExtintor,
    openAddExtintor,
    openEditExtintor,
    saveExtintor,
    deleteExtintor,
    restoreEstado,
  };
}