import type { Catalogs } from "./useSocket";

export function useCatalogLists(catalogs: Catalogs) {
  const MARCAS = catalogs.marcas.map((c) => c.value).sort((a, b) => a.localeCompare(b, "es"));
  const AGENTES = catalogs.agentes.map((c) => c.value).sort((a, b) => a.localeCompare(b, "es"));
  const RECARGAS = catalogs.recargas.map((c) => c.value);
  const MOTIVOS_BAJA = catalogs.motivosBaja.map((c) => c.value);
  const SERVICIOS_EXTRA = catalogs.serviciosExtra.map((c) => c.value);
  const CATEGORIAS_INVENTARIO = catalogs.categoriasInventario.map((c) => c.value);
  const CAPACIDADES = catalogs.capacidades.map((c) => c.value);
  const ETIQUETAS_CERTIFICADO = catalogs.etiquetasCertificado.map((c) => c.value);

  return { MARCAS, AGENTES, RECARGAS, MOTIVOS_BAJA, SERVICIOS_EXTRA, CATEGORIAS_INVENTARIO, CAPACIDADES, ETIQUETAS_CERTIFICADO };
}