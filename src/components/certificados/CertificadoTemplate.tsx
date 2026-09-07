import { MESES } from "../../constants";

export type TipoCertificado = "garantia" | "ph";
export type TipoIdentificacion = "ruc" | "dni" | "placa";
export type Denominacion = "portatiles_rodantes" | "portatiles" | "rodantes" | "extintores";

export interface CertificadoItem {
  uid: string;
  item: string;
  serie: string;
  nInterno: string;
  marca: string;
  tipo: string;
  capacidad: string;
  tipoServicio: string;
  estanqueidad: string;
  vencimientoRecarga: string;
  anioFabricacion: string;
  realizadoPH: string;
  vencimientoPH: string;
  presionPSI: string;
  rating: string;
  condicion: string;
}

export interface CertificadoColumnas {
  item: boolean;
  nInterno: boolean;
  marca: boolean;
  tipoServicio: boolean;
  rating: boolean;
}

export interface CertificadoDatos {
  tipoCertificado: TipoCertificado;
  denominacion: Denominacion;
  tipoIdentificacion: TipoIdentificacion;
  nombre: string;
  numeroIdentificacion: string;
  dniAdicional: string;
  ubicacion: string;
  distrito: string;
  diaFecha: string;
  mesFecha: string;
  anioFecha: string;
  agentesTexto: string;
  agentesTextoCorto: string;
  items: CertificadoItem[];
  columnas: CertificadoColumnas;
  accionesTrabajo: { venta: boolean; recarga: boolean; mantenimiento: boolean };
  textoAccion: string;
  etiquetasAdicionales: string[];
  parrafoPersonalizado?: string;
  segmentosSincronizados?: Record<string, string>;
  parrafosPorTipo?: Partial<Record<TipoCertificado, { texto: string; segmentos: Record<string, string> }>>;
}

interface Props {
  datos: CertificadoDatos;
  id?: string;
}

const DENOMINACION_TITULO: Record<Denominacion, string> = {
  portatiles_rodantes: "EXTINTORES PORTATILES Y RODANTES",
  portatiles: "EXTINTORES PORTATILES",
  rodantes: "EXTINTORES RODANTES",
  extintores: "EXTINTORES",
};

const DENOMINACION_PARRAFO: Record<Denominacion, string> = {
  portatiles_rodantes: "extintores portátiles y rodantes",
  portatiles: "extintores portátiles",
  rodantes: "extintores rodantes",
  extintores: "extintores",
};

const DENOMINACION_PARRAFO_SINGULAR: Record<Denominacion, string> = {
  portatiles_rodantes: "extintor portátil o rodante",
  portatiles: "extintor portátil",
  rodantes: "extintor rodante",
  extintores: "extintor",
};

const FILAS_POR_PAGINA = 14;

const tituloCertificado = (tipo: TipoCertificado, denominacion: Denominacion): string => {
  const nombreExtintores = DENOMINACION_TITULO[denominacion];
  return tipo === "ph"
    ? `CERTIFICADO DE PRUEBA HIDROSTATICA DE ${nombreExtintores}`
    : `CERTIFICADO DE GARANTIA Y OPERATIVIDAD DE ${nombreExtintores} DE LUCHA CONTRA INCENDIOS Y VIGENCIA DE PRUEBA HIDROSTATICA`;
};

const construirDenominacionTexto = (datos: CertificadoDatos, esSingular: boolean): string =>
  esSingular ? DENOMINACION_PARRAFO_SINGULAR[datos.denominacion] : DENOMINACION_PARRAFO[datos.denominacion];

const construirPaginasItems = (items: CertificadoItem[]): CertificadoItem[][] => {
  if (items.length === 0) return [[]];
  const paginas: CertificadoItem[][] = [];
  for (let i = 0; i < items.length; i += FILAS_POR_PAGINA) {
    paginas.push(items.slice(i, i + FILAS_POR_PAGINA));
  }
  return paginas;
};

const ORDEN_CAMPOS_PARRAFO = ["cliente", "ubicacion", "trabajo", "denominacion", "agentes", "maquina", "normas"];

export const sanitizarHtmlBold = (html: string): string => {
  const contenedor = document.createElement("div");
  contenedor.innerHTML = html || "";
  const limpiar = (nodo: Node): string => {
    let resultado = "";
    nodo.childNodes.forEach((hijo) => {
      if (hijo.nodeType === Node.TEXT_NODE) {
        resultado += (hijo.textContent || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      } else if (hijo.nodeType === Node.ELEMENT_NODE) {
        const el = hijo as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const campo = el.getAttribute("data-campo");
        if (tag === "span" && campo) {
          resultado += `<span data-campo="${campo}" contenteditable="false">${limpiar(el)}</span>`;
        } else if (tag === "strong" || tag === "b") {
          resultado += `<strong>${limpiar(el)}</strong>`;
        } else if (tag === "br") {
          resultado += "<br>";
        } else if (tag === "div" || tag === "p") {
          resultado += `${limpiar(el)}<br>`;
        } else {
          resultado += limpiar(el);
        }
      }
    });
    return resultado;
  };
  const limpio = limpiar(contenedor).replace(/(<br>)+$/, "");
  const soloTexto = document.createElement("div");
  soloTexto.innerHTML = limpio;
  return (soloTexto.textContent || "").trim() === "" ? "" : limpio;
};

const construirSegmentosParrafo = (datos: CertificadoDatos): Record<string, string> => {
  const esPH = datos.tipoCertificado === "ph";
  const esPlaca = datos.tipoIdentificacion === "placa";
  const soloUnidadPlaca = esPlaca && !datos.dniAdicional && !datos.nombre.trim();
  const esSingular = datos.items.length === 1;
  const labelIdentificacion = datos.tipoIdentificacion === "ruc" ? "RUC N°" : datos.tipoIdentificacion === "dni" ? "DNI N°" : "Placa N°";
  const ubicacionCompleta = `${datos.ubicacion || "—"}${datos.distrito ? ` - ${datos.distrito}` : ""} - Lima`;
  const etiquetasTexto = ["NTP 350.043.1", "833.030", ...datos.etiquetasAdicionales].join("; ");

  const cliente = soloUnidadPlaca
    ? `<strong>UNIDAD PLACA ${datos.numeroIdentificacion || "—"}</strong>`
    : `<strong>${datos.nombre || "—"}</strong> con <strong>${labelIdentificacion} ${datos.numeroIdentificacion || "—"}${esPlaca && datos.dniAdicional ? ` y DNI N° ${datos.dniAdicional}` : ""}</strong>`;

  return {
    cliente,
    ubicacion: `<strong>${ubicacionCompleta}</strong>`,
    trabajo: datos.textoAccion,
    denominacion: construirDenominacionTexto(datos, esSingular),
    agentes: esPH ? (datos.agentesTextoCorto || "") : datos.agentesTexto,
    maquina: `<strong>MARCA KAMEX MAQUINARIAS EIRL</strong>, modelo <strong>KPH-02</strong>`,
    normas: `<strong>${etiquetasTexto} según detalle:</strong>`,
  };
};

export const construirParrafoAutomatico = (datos: CertificadoDatos): string => {
  const esPH = datos.tipoCertificado === "ph";
  const esPlaca = datos.tipoIdentificacion === "placa";
  const esSingular = datos.items.length === 1;
  const seg = construirSegmentosParrafo(datos);

  const sujeto = `<span data-campo="cliente" contenteditable="false">${seg.cliente}</span>`;
  const ubicacionParte = esPlaca ? "" : ` ubicado en <span data-campo="ubicacion" contenteditable="false">${seg.ubicacion}</span>`;

  if (esPH) {
    return `${sujeto}${ubicacionParte}, se ha efectuado la Prueba Hidrostática ${esSingular ? "al" : "a los"} <span data-campo="denominacion" contenteditable="false">${seg.denominacion}</span>${datos.agentesTextoCorto ? ` <span data-campo="agentes" contenteditable="false">${seg.agentes}</span>` : ""}, utilizando la máquina <span data-campo="maquina" contenteditable="false">${seg.maquina}</span>, dicho trabajo se ha realizado conforme lo establece la <span data-campo="normas" contenteditable="false">${seg.normas}</span>`;
  }
  return `${sujeto}${ubicacionParte}, se ha efectuado <span data-campo="trabajo" contenteditable="false">${seg.trabajo}</span> ${esSingular ? "del" : "de los"} <span data-campo="denominacion" contenteditable="false">${seg.denominacion}</span> de <span data-campo="agentes" contenteditable="false">${seg.agentes}</span>, dicho trabajo se ha realizado conforme lo establece la <span data-campo="normas" contenteditable="false">${seg.normas}</span>`;
};

const sincronizarCampoParrafo = (contenedor: HTMLElement, campo: string, contenido: string, forzarActualizacion: boolean) => {
  const existente = contenedor.querySelector(`[data-campo="${campo}"]`);
  if (existente) {
    if (forzarActualizacion) existente.innerHTML = contenido;
    return;
  }
  if (!contenido) return;
  const idx = ORDEN_CAMPOS_PARRAFO.indexOf(campo);
  let referenciaPrevia: Element | null = null;
  for (let i = idx - 1; i >= 0 && !referenciaPrevia; i--) {
    referenciaPrevia = contenedor.querySelector(`[data-campo="${ORDEN_CAMPOS_PARRAFO[i]}"]`);
  }
  const nuevo = document.createElement("span");
  nuevo.setAttribute("data-campo", campo);
  nuevo.setAttribute("contenteditable", "false");
  nuevo.innerHTML = contenido;
  if (referenciaPrevia) {
    referenciaPrevia.after(document.createTextNode(" "), nuevo);
  } else if (contenedor.firstChild) {
    contenedor.prepend(nuevo, document.createTextNode(" "));
  } else {
    contenedor.appendChild(nuevo);
  }
};

export const sincronizarCamposParrafo = (
  html: string,
  datos: CertificadoDatos,
  anteriores: Record<string, string> = {},
): { html: string; segmentos: Record<string, string> } => {
  const esPH = datos.tipoCertificado === "ph";
  const seg = construirSegmentosParrafo(datos);
  const campos = esPH
    ? ["cliente", "ubicacion", "denominacion", "agentes", "maquina", "normas"]
    : ["cliente", "ubicacion", "trabajo", "denominacion", "agentes", "normas"];
  const contenedor = document.createElement("div");
  contenedor.innerHTML = html || "";
  const segmentos: Record<string, string> = {};
  campos.forEach((campo) => {
    const valorNuevo = seg[campo];
    const cambio = anteriores[campo] === undefined || anteriores[campo] !== valorNuevo;
    sincronizarCampoParrafo(contenedor, campo, valorNuevo, cambio);
    segmentos[campo] = valorNuevo;
  });
  return { html: contenedor.innerHTML, segmentos };
};

export default function CertificadoTemplate({ datos, id }: Props) {
  const esPH = datos.tipoCertificado === "ph";
  const esPlaca = datos.tipoIdentificacion === "placa";
  const soloUnidadPlaca = esPlaca && !datos.dniAdicional && !datos.nombre.trim();
  const esSingular = datos.items.length === 1;
  const labelIdentificacion = datos.tipoIdentificacion === "ruc" ? "RUC N°" : datos.tipoIdentificacion === "dni" ? "DNI N°" : "Placa N°";
  const mesLabel = MESES.find((m) => m.value === datos.mesFecha)?.label.toLowerCase() || "";
  const denominacionTexto = construirDenominacionTexto(datos, esSingular);
  const marcaVisible = datos.columnas.marca || esPH;
  const ubicacionCompleta = `${datos.ubicacion || "—"}${datos.distrito ? ` - ${datos.distrito}` : ""} - Lima`;
  const etiquetasTexto = ["NTP 350.043.1", "833.030", ...datos.etiquetasAdicionales].join("; ");
  const colSpanVacio = 8
    + (datos.columnas.item ? 1 : 0)
    + (datos.columnas.nInterno ? 1 : 0)
    + (marcaVisible ? 1 : 0)
    + (datos.columnas.rating ? 1 : 0)
    + (datos.columnas.tipoServicio ? 1 : 0);

  const paginasItems = construirPaginasItems(datos.items);

  return (
    <>
      {paginasItems.map((itemsPagina, pageIdx) => (
        <div key={pageIdx} style={{ fontFamily: "Arial, Helvetica, sans-serif" }} className="bg-white text-black certificado-print-page mb-6 print:mb-0">
          <div id={pageIdx === 0 ? id : undefined} className="w-[210mm] min-h-[297mm] px-10 py-15 relative text-[14px]">
            <header className="grid grid-cols-[110px_1fr_110px] items-center gap-4 mb-6">
              <div className="h-28 flex items-center justify-center">
                <img src="/images/logo-extintor.png" alt="Extintor" className="max-h-full max-w-full object-contain" />
              </div>

              <div className="text-center leading-tight px-2">
                <h1 className="text-red-600 font-bold text-[22px] mb-1">LA FAMA DEL EXTINGUIDOR E.I.R.L</h1>
                <h2 className="font-bold text-[14px] mb-1">
                  VENTA, SERVICIO DE TODO TIPO DE EXTINGUIDORES Y MATERIAL CONTRA INCENDIO
                </h2>
                <p className="text-[14px]">Jr. M. Aranguri 924 – Urb. Santa Luzmila - Lima 7</p>
                <p className="text-red-600 font-bold text-[15px]">Teléfono 536 – 4958 / Celular 999916061 – 941982970</p>
                <p className="text-red-600 font-bold text-[15px]">R.U.C N° 20213431022</p>
                <a href="http://www.extintoresfama.com" className="text-blue-700 font-bold text-[15px] underline tracking-wide">
                  www.extintoresfama.com
                </a>
              </div>

              <div className="h-28 flex items-center justify-center">
                <img src="/images/logo-sgs.png" alt="SGS" className="max-h-full max-w-full object-contain" />
              </div>
            </header>

            <main className="flex gap-4 mt-2">
              <aside className="w-7.5 flex flex-col items-center justify-start pt-2 font-bold text-[17px] leading-[1.1] select-none">
                <div className="text-blue-600 flex flex-col items-center mb-8">
                  {"HONRADEZ".split("").map((c, i) => <span key={i}>{c}</span>)}
                </div>
                <div className="text-red-600 flex flex-col items-center mb-8">
                  {"GARANTIA".split("").map((c, i) => <span key={i}>{c}</span>)}
                </div>
                <div className="text-blue-600 flex flex-col items-center">
                  {"CUMPLIMIENTO".split("").map((c, i) => <span key={i}>{c}</span>)}
                </div>
              </aside>

              <section className="flex-1 flex flex-col pl-2">
                <h3 className="text-red-600 font-bold text-center text-[16px] mb-5 leading-tight px-6">
                  {tituloCertificado(datos.tipoCertificado, datos.denominacion)}
                </h3>

                <p className="text-justify mb-5 leading-[1.6] whitespace-pre-line">
                  {datos.parrafoPersonalizado ? (
                    <span dangerouslySetInnerHTML={{ __html: sanitizarHtmlBold(datos.parrafoPersonalizado) }} />
                  ) : (
                    <>
                      {soloUnidadPlaca ? (
                        <span className="font-bold">UNIDAD PLACA {datos.numeroIdentificacion || "—"}</span>
                      ) : (
                        <>
                          <span className="font-bold">{datos.nombre || "—"}</span> con{" "}
                          <span className="font-bold">
                            {labelIdentificacion} {datos.numeroIdentificacion || "—"}
                            {esPlaca && datos.dniAdicional && <> y DNI N° {datos.dniAdicional}</>}
                          </span>
                        </>
                      )}
                      {!esPlaca && (
                        <>
                          {" "}ubicado en <span className="font-bold">{ubicacionCompleta}</span>
                        </>
                      )}
                      ,{" "}
                      {esPH ? (
                        <>
                          se ha efectuado la Prueba Hidrostática {esSingular ? "al" : "a los"} {denominacionTexto}
                          {datos.agentesTextoCorto ? <> {datos.agentesTextoCorto}</> : null},
                          utilizando la máquina <span className="font-bold"> MARCA KAMEX MAQUINARIAS EIRL</span>, modelo{" "}
                          <span className="font-bold">KPH-02</span>, dicho trabajo se ha realizado conforme lo establece la{" "}
                          <span className="font-bold">{etiquetasTexto} según detalle:</span>
                        </>
                      ) : (
                        <>
                          se ha efectuado {datos.textoAccion} {esSingular ? "del" : "de los"} {denominacionTexto} de {datos.agentesTexto}, dicho trabajo se
                          ha realizado conforme lo establece la{" "}
                          <span className="font-bold">{etiquetasTexto} según detalle:</span>
                        </>
                      )}
                    </>
                  )}
                </p>

                <table className="w-full border-collapse border border-black text-[11px] mb-6 text-center">
                  <thead className="font-bold">
                    <tr>
                      {datos.columnas.item && <th className="border border-black p-1 w-10">Ítem</th>}
                      <th className="border border-black p-1 w-12.5">Serie</th>
                      {datos.columnas.nInterno && <th className="border border-black p-1 leading-tight">N°<br />Interno</th>}
                      {marcaVisible && <th className="border border-black p-1">Marca</th>}
                      <th className="border border-black p-1 leading-tight">Tipo<br />Extintor</th>
                      <th className="border border-black p-1">Cap.</th>
                      {datos.columnas.rating && <th className="border border-black p-1">Rating</th>}
                      {!esPH && <th className="border border-black p-1 leading-tight">Prueba de<br />Estanqueidad<br />y Fuga</th>}
                      {!esPH && <th className="border border-black p-1 leading-tight">Vencimiento<br />Recarga</th>}
                      <th className="border border-black p-1 leading-tight">Año de<br />Fabr.</th>
                      {esPH && <th className="border border-black p-1 leading-tight">Realizado<br />P.H</th>}
                      <th className="border border-black p-1 leading-tight">Vencimiento<br />Prueba<br />Hidrostática</th>
                      {esPH && <th className="border border-black p-1 leading-tight">Presión<br />PSI</th>}
                      {datos.columnas.tipoServicio && <th className="border border-black p-1 leading-tight">Tipo de<br />Servicio</th>}
                      <th className="border border-black p-1 leading-tight">Condición<br />Extintor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsPagina.length === 0 ? (
                      <tr>
                        <td colSpan={colSpanVacio} className="border border-black p-3 text-gray-500">
                          {esPH ? "Ningún extintor de este servicio tiene Prueba Hidrostática registrada" : "Este servicio no tiene extintores asociados"}
                        </td>
                      </tr>
                    ) : (
                      itemsPagina.map((it, i) => (
                        <tr key={i}>
                          {datos.columnas.item && <td className="border border-black p-1 py-2">{it.item}</td>}
                          <td className="border border-black p-1 py-2">{it.serie}</td>
                          {datos.columnas.nInterno && <td className="border border-black p-1 py-2">{it.nInterno}</td>}
                          {marcaVisible && <td className="border border-black p-1 py-2">{it.marca}</td>}
                          <td className="border border-black p-1 py-2">{it.tipo}</td>
                          <td className="border border-black p-1 py-2">{it.capacidad}</td>
                          {datos.columnas.rating && <td className="border border-black p-1 py-2">{it.rating || "—"}</td>}
                          {!esPH && <td className="border border-black p-1 py-2">{it.estanqueidad}</td>}
                          {!esPH && <td className="border border-black p-1 py-2">{it.vencimientoRecarga}</td>}
                          <td className="border border-black p-1 py-2">{it.anioFabricacion}</td>
                          {esPH && <td className="border border-black p-1 py-2">{it.realizadoPH}</td>}
                          <td className="border border-black p-1 py-2">{it.vencimientoPH}</td>
                          {esPH && <td className="border border-black p-1 py-2">{it.presionPSI || "—"}</td>}
                          {datos.columnas.tipoServicio && <td className="border border-black p-1 py-2">{it.tipoServicio}</td>}
                          <td className="border border-black p-1 py-2">{it.condicion}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <p className="text-justify mb-5 leading-[1.6]">
                  <span className="font-bold">{esSingular ? "EL EXTINTOR ES ENTREGADO EN CALIDAD DE APROBADO" : "LOS EXTINTORES SON ENTREGADOS EN CALIDAD DE APROBADOS"}</span>, cualquier evento
                  o falla posterior por la mala manipulación, el mal uso (golpes, abolladuras, exposición al calor,
                  soldaduras y/o modificaciones, intemperie, oxido, corrosión, etc.) o uso distinto para el que está
                  destinado es de responsabilidad del cliente, después de haber sido entregado, 1 año de garantía del
                  servicio.
                </p>

                <p className="text-justify mb-8 leading-[1.6]">
                  De acuerdo a la <span className="font-bold">NORMA TECNICA PERUANA 350.043</span> el Propietario debe
                  inspeccionar su extintor una vez al mes por si exista la posibilidad de que lo hayan utilizado.
                </p>

                <p className="mb-8">Lima, {datos.diaFecha} de {mesLabel} del {datos.anioFecha}</p>

                <div className="flex justify-center w-full mt-6">
                  <div className="relative w-80 flex flex-col items-center">
                    <img src="/images/firma.jpg" alt="Firma" className="w-72 h-44 object-contain -mb-3" />
                  </div>
                </div>
              </section>
            </main>
          </div>
        </div>
      ))}
    </>
  );
}