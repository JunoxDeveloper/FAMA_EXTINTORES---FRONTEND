import type { EmpresaItem, Extintor } from "../types";

export function getAvailableYears(empresas: EmpresaItem[]): number[] {
  return [...new Set(
    empresas
      .filter((e) => e.fechaEntrega)
      .map((e) => {
        const [y] = (e.fechaEntrega ?? "").split("-");
        return parseInt(y);
      })
      .filter((y) => !isNaN(y))
  )].sort((a, b) => b - a);
}

export function filterEmpresas(
  empresas: EmpresaItem[],
  search: string,
  fMonth: string,
  fYear: string
): EmpresaItem[] {
  return empresas.filter((e) => {
    if (search) {
      const q = search.toLowerCase();
      const coincide =
        e.razonSocial.toLowerCase().includes(q) ||
        (e.ruc || "").toLowerCase().includes(q) ||
        (e.nombresApellidos || "").toLowerCase().includes(q);
      if (!coincide) return false;
    }
    if (fYear || fMonth) {
      if (!e.fechaEntrega) return false;
      const [y, m] = e.fechaEntrega.split("-");
      if (fYear && parseInt(y) !== parseInt(fYear)) return false;
      if (fMonth && parseInt(m) !== parseInt(fMonth)) return false;
    }
    return true;
  });
}

export function getDuplicateSets(extintores: Extintor[]) {
  const claveSede = (e: Extintor) => e.sedeId || "__sin_sede__";
  const serieCounts: Record<string, number> = {};
  const internoCounts: Record<string, number> = {};

  extintores
    .filter((e) => e.estadoExtintor !== "De Baja")
    .forEach((e) => {
      const sOrig = e.nSerie?.trim() || "";
      const iOrig = e.nInterno?.trim() || "";
      const sUpper = sOrig.toUpperCase();
      const iUpper = iOrig.toUpperCase();

      if (sOrig && sUpper !== "S/N" && sUpper !== "—") {
        const clave = `${claveSede(e)}|${sOrig}`;
        serieCounts[clave] = (serieCounts[clave] || 0) + 1;
      }

      if (iOrig && iUpper !== "S/TAG" && iUpper !== "S/N" && iUpper !== "—") {
        const clave = `${claveSede(e)}|${iOrig}`;
        internoCounts[clave] = (internoCounts[clave] || 0) + 1;
      }
    });

  const duplicateSeries = new Set(Object.keys(serieCounts).filter(k => serieCounts[k] > 1));
  const duplicateInternos = new Set(Object.keys(internoCounts).filter(k => internoCounts[k] > 1));

  return { duplicateSeries, duplicateInternos };
}

export function countBy(arr: Extintor[], key: keyof Extintor): [string, number][] {
  const map: Record<string, number> = {};
  arr.forEach((e) => {
    const v = (e[key] as string) || "Sin definir";
    map[v] = (map[v] || 0) + 1;
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

export function computeBaseMetrics(extintores: Extintor[]) {
  const estadoCounts = countBy(extintores, "estadoExtintor");
  const marcaCounts = countBy(extintores, "marca");
  const agenteCounts = countBy(extintores, "agenteExtintor");

  const pesoCounts: Record<string, number> = {};
  const pesoAgentBreakdown: Record<string, Record<string, number>> = {};
  const marcaPesoCounts: Record<string, number> = {};

  extintores.forEach((e) => {
    const v = e.peso ? `${e.peso} ${e.unidadPeso}` : "Sin definir";
    const agente = e.agenteExtintor || "Sin definir";
    const marca = e.marca || "Sin definir";

    pesoCounts[v] = (pesoCounts[v] || 0) + 1;

    if (!pesoAgentBreakdown[v]) pesoAgentBreakdown[v] = {};
    pesoAgentBreakdown[v][agente] = (pesoAgentBreakdown[v][agente] || 0) + 1;

    const mpKey = `${v}|${marca}`;
    marcaPesoCounts[mpKey] = (marcaPesoCounts[mpKey] || 0) + 1;
  });

  const serviceCounts = { Mantenimiento: 0, Recarga: 0, "Prueba Hidrostatica": 0 };
  extintores.forEach((e) => {
    if (e.ma === "SI") serviceCounts.Mantenimiento++;
    if (e.recarga) serviceCounts.Recarga++;
    if (e.ph === "SI") serviceCounts["Prueba Hidrostatica"]++;
  });

  const compCounts = { valvula: 0, manguera: 0, manometro: 0, tobera: 0 };
  extintores.forEach((e) => {
    if (e.valvula === "SI") compCounts.valvula++;
    if (e.manguera === "SI") compCounts.manguera++;
    if (e.manometro === "SI") compCounts.manometro++;
    if (e.tobera === "SI") compCounts.tobera++;
  });

  return {
    estadoCounts,
    marcaCounts,
    agenteCounts,
    pesoCounts,
    pesoAgentBreakdown,
    marcaPesoCounts,
    serviceCounts,
    compCounts,
  };
}

export function getPesoEntriesWithAgents(
  pesoCounts: Record<string, number>,
  pesoAgentBreakdown: Record<string, Record<string, number>>,
  customWeightOrder: string[]
): [string, number][] {
  return Object.entries(pesoCounts)
    .sort((a, b) => {
      if (customWeightOrder.length === 0) return b[1] - a[1];

      const idxA = customWeightOrder.indexOf(a[0]);
      const idxB = customWeightOrder.indexOf(b[0]);

      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return b[1] - a[1];
    })
    .map(([pesoKey, total]) => {
      const breakdown = pesoAgentBreakdown[pesoKey];
      const detailStr = Object.entries(breakdown)
        .map(([ag, count]) => `${count} ${ag}`)
        .join(", ");
      return [`${pesoKey} (${detailStr})`, total] as [string, number];
    });
}

export function filterExtintores(
  extintores: Extintor[],
  fMarca: string,
  fAgente: string,
  fEstado: string,
  fPeso: string,
  fServicio: string,
  fComponente: string,
  fSede?: string
): Extintor[] {
  return extintores.filter((e) => {
    if (fMarca && (e.marca || "Sin definir") !== fMarca) return false;
    if (fAgente && (e.agenteExtintor || "Sin definir") !== fAgente) return false;
    if (fEstado && (e.estadoExtintor || "Sin definir") !== fEstado) return false;
    if (fPeso && (e.peso ? `${e.peso} ${e.unidadPeso}` : "Sin definir") !== fPeso) return false;
    if (fSede && fSede === "__SIN_SEDE__" && e.sedeId) return false;
    if (fSede && fSede !== "__SIN_SEDE__" && e.sedeId !== fSede) return false;
    if (fServicio === "Mantenimiento" && e.ma !== "SI") return false;
    if (fServicio === "Prueba Hidrostatica" && e.ph !== "SI") return false;
    if (fServicio === "Recarga" && !e.recarga) return false;
    if (fComponente && (e as any)[fComponente] !== "SI") return false;
    return true;
  });
}