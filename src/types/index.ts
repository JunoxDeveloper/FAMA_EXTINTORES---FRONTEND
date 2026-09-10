export type EmpresaItem = {
  id: string;
  razonSocial: string;
  ruc?: string;
  distrito?: string;
  nombresApellidos?: string;
  celular?: string;
  fechaRetiro?: string;
  fechaEntrega?: string;
  slug: string;
  sedes?: Sede[];
  tipoCliente?: string | null;
};

export type Sede = {
  id: string;
  empresaId: string;
  nombre: string;
  slug: string;
  direccion?: string;
  distrito?: string;
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
  weightOrder?: string[];
  estadoOrder?: string[];
  agenteOrder?: string[];
  servicioWeightOrder?: string[];
  servicioEstadoOrder?: string[];
  servicioAgenteOrder?: string[];
  sedeOrder?: string[];
  servicioSedeOrder?: string[];
  slug?: string;
  sedes?: Sede[];
  tipoCliente?: string | null;
};

export type Extintor = {
  rowIndex: number;
  n?: string;
  nSerie: string;
  nInterno: string;
  marca: string;
  fechaFabricacion: string;
  realizadoPH: string;
  mesRealizadoPH: string;
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
  evidencia?: string; 
  evidenciaCount?: number;
  evidenciaFotos?: string[];
  uid: string;
  sedeId: string | null;
};

export type FormData = {
  nSerie: string;
  nInterno: string;
  marca: string;
  fechaFabricacion: string;
  realizadoPH: string;
  mesRealizadoPH: string;
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
  evidencias: string[];
  sedeId?: string | null;
  uid?: string;
};

export type WorkerView = "home" | "empresa" | "todos" | "form" | "sedes" | "historial" | "historialMes" | "servicio";
export type DashView = "list" | "detail";

export type Servicio = {
  id: string;
  empresaId: string;
  sedeId: string | null;
  fechaRetiro: string;
  fechaEntrega: string;
  extintorUids: string[];
  extintorEstados?: Record<string, Partial<Extintor>>;
  notas?: string;
  secuencia?: number;
  createdAt?: string;
};

export type CotizacionItem = {
  codigo: string;
  descripcion: string;
  detalle: string;
  um: string;
  cantidad: number;
  precioUnit: number;
};

export type Cotizacion = {
  id: string;
  numero: string;
  fecha: string;
  cliente: string;
  tipoDestinatario?: "empresa" | "persona";
  ruc: string;
  tipoDocumento?: "ruc" | "dni";
  direccion: string;
  sede?: string;
  guia?: string;
  atencion: string;
  observacionesMes?: string;
  formaPago?: "contado" | "credito";
  diasCredito?: string;
  items: CotizacionItem[];
  createdAt?: string;
};

export type InventarioItem = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  operacion?: string | null;
  precioTotal: number;
  stock: number;
  estado: string;
  marca?: string | null;
  capacidad?: string | null;
  agente?: string | null;
  peso?: string | null;
  createdAt?: string;
};

export type TrasladoSede = {
  id: string;
  extintorUid: string;
  empresaId: string;
  sedeOrigenId: string | null;
  sedeDestinoId: string | null;
  fecha: string;
  motivo?: string;
  secuencia?: number;
  createdAt?: string;
};