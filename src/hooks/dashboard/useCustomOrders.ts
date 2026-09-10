import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { EmpresaData, Extintor } from "../../types";
import { getEstadoPrioridad, getWeightInKg } from "../../utils/helpers";

export function useCustomOrders(
  socket: Socket | null,
  selectedEmpresa: EmpresaData | null,
  extintores: Extintor[],
  pesoCounts: Record<string, number>,
  estadoCounts: [string, number][],
  variant: "todos" | "servicio" = "todos"
) {
  const campoWeight = variant === "servicio" ? "servicioWeightOrder" : "weightOrder";
  const campoEstado = variant === "servicio" ? "servicioEstadoOrder" : "estadoOrder";
  const campoAgente = variant === "servicio" ? "servicioAgenteOrder" : "agenteOrder";
  const campoSede = variant === "servicio" ? "servicioSedeOrder" : "sedeOrder";

  const [weightOrderModal, setWeightOrderModal] = useState(false);
  const [customWeightOrder, setCustomWeightOrder] = useState<string[]>([]);

  const [estadoOrderModal, setEstadoOrderModal] = useState(false);
  const [customEstadoOrder, setCustomEstadoOrder] = useState<string[]>([]);

  const [agenteOrderModal, setAgenteOrderModal] = useState(false);
  const [customAgenteOrder, setCustomAgenteOrder] = useState<string[]>([]);

  const [sedeOrderModal, setSedeOrderModal] = useState(false);
  const [customSedeOrder, setCustomSedeOrder] = useState<string[]>([]);

  const setFromEmpresaData = (data: EmpresaData) => {
    setCustomWeightOrder((data as any)[campoWeight] || []);
    setCustomEstadoOrder((data as any)[campoEstado] || []);
    setCustomAgenteOrder((data as any)[campoAgente] || []);
    setCustomSedeOrder((data as any)[campoSede] || []);
  };

  const persistOrders = (overrides: Partial<{ weightOrder: string[]; estadoOrder: string[]; agenteOrder: string[]; sedeOrder: string[] }>) => {
    if (!socket || !selectedEmpresa?.id) return;
    socket.emit("empresa:save", {
      id: selectedEmpresa.id,
      [campoWeight]: overrides.weightOrder ?? customWeightOrder,
      [campoEstado]: overrides.estadoOrder ?? customEstadoOrder,
      [campoAgente]: overrides.agenteOrder ?? customAgenteOrder,
      [campoSede]: overrides.sedeOrder ?? customSedeOrder,
    });
  };

  useEffect(() => {
    const availableWeights = Object.keys(pesoCounts);

    if (availableWeights.length > 0) {
      setCustomWeightOrder((prev) => {
        const missing = availableWeights.filter(w => !prev.includes(w));

        if (missing.length === 0) return prev;

        return [...prev, ...missing].sort((a, b) => getWeightInKg(a) - getWeightInKg(b));
      });
    }
  }, [extintores]);


  useEffect(() => {
    const availableEstados = estadoCounts.map(([v]) => v);

    if (availableEstados.length > 0) {
      setCustomEstadoOrder((prev) => {
        const missing = availableEstados.filter(es => !prev.includes(es));
        if (missing.length === 0) return prev;
        return [...prev, ...missing].sort((a, b) => getEstadoPrioridad(a) - getEstadoPrioridad(b));
      });
    }
  }, [extintores]);

  return {
    weightOrderModal,
    setWeightOrderModal,
    customWeightOrder,
    setCustomWeightOrder,
    estadoOrderModal,
    setEstadoOrderModal,
    customEstadoOrder,
    setCustomEstadoOrder,
    agenteOrderModal,
    setAgenteOrderModal,
    customAgenteOrder,
    setCustomAgenteOrder,
    sedeOrderModal,
    setSedeOrderModal,
    customSedeOrder,
    setCustomSedeOrder,
    setFromEmpresaData,
    persistOrders,
  };
}