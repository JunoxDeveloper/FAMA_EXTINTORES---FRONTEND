// src/types/index.ts

export type EmpresaItem = {
  id: string;
  razonSocial: string;
  // Campos opcionales usados en el Dashboard
  ruc?: string;
  distrito?: string;
  nombresApellidos?: string;
  celular?: string;
  fechaRetiro?: string;
  fechaEntrega?: string;
};

export type EmpresaData = {
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

export type Extintor = {
  rowIndex: number;
  n?: string; // Usado en Worker
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
  servicioExtra: string;
  motivoBaja: string;
  evidencia?: string; // JSON array de base64 strings, o flag "__HAS_EVIDENCIA__"
  evidenciaCount?: number; // Cantidad de fotos (enviado por el backend en listados)
};

export type FormData = {
  nSerie: string;
  nInterno: string;
  marca: string;
  fechaFabricacion: string;
  realizadoPH: string;
  vencimPH: string;
  estadoExtintor: string;
  agenteExtintor: string;
  peso: string;
  unidadPeso: "KG" | "LB" | "LT" | "GAL";
  ma: boolean;
  recarga: string;
  ph: boolean;
  valvula: string;
  manguera: string;
  manometro: string;
  tobera: string;
  observaciones: string;
  servicioExtra: string;
  motivoBaja: string;
  evidencias: string[]; // Array de base64 JPEG comprimidos
};

// Tipos específicos para las vistas
export type WorkerView = "home" | "empresa" | "lista" | "form";
export type DashView = "list" | "detail";