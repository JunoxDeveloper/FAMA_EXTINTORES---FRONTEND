import { useState, useMemo, useEffect } from "react";
import type { EmpresaData, Extintor } from "../../types";

const MESES = ["","Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

type CertConfig = {
  certType: "garantia" | "hidrostatica";
  columns: Record<string, boolean>;
  certDate: string;
  includeNfpa: boolean;
  customParagraph: string;
  psiValues: Record<string, string>;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  empresa: EmpresaData;
  extintores: Extintor[];
  exporting: boolean;
  onExport: (config: CertConfig, format: "docx" | "pdf") => void;
};

export default function CertificadoModal({ isOpen, onClose, empresa, extintores, exporting, onExport }: Props) {
  const [certType, setCertType] = useState<"garantia" | "hidrostatica">("garantia");
  const [format, setFormat] = useState<"docx" | "pdf">("docx");
  const [includeNfpa, setIncludeNfpa] = useState(false);
  const [customParagraph, setCustomParagraph] = useState("");
  const [useCustomParagraph, setUseCustomParagraph] = useState(false);

  // Columnas opcionales
  const [showNInterno, setShowNInterno] = useState(false);
  const [showMarca, setShowMarca] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [showPsi, setShowPsi] = useState(false);
  const [psiPQS, setPsiPQS] = useState("(600)");
  const [psiCO2, setPsiCO2] = useState("(3000)");

  // Fecha del certificado
  const defaultDate = useMemo(() => {
    if (!empresa.fechaEntrega) return "";
    const parts = empresa.fechaEntrega.split("-");
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const mes = MESES[parseInt(m)] || m;
      return `Lima ${parseInt(d)} de ${mes.toLowerCase()} del ${y}`;
    }
    return "";
  }, [empresa.fechaEntrega]);

  const [certDate, setCertDate] = useState(defaultDate);

  // Reset date when empresa changes
  useEffect(() => { setCertDate(defaultDate); }, [defaultDate]);

  // Preview de extintores filtrados
  const filtered = useMemo(() => {
    if (certType === "garantia") {
      return extintores.filter(e => e.estadoExtintor !== "De Baja");
    }
    return extintores.filter(e => e.ph === "SI" && e.estadoExtintor !== "De Baja");
  }, [extintores, certType]);

  const handleExport = () => {
    const config: CertConfig = {
      certType,
      columns: {
        nInterno: showNInterno,
        marca: showMarca,
        rating: showRating,
        psi: showPsi && certType === "hidrostatica",
      },
      certDate,
      includeNfpa,
      customParagraph: useCustomParagraph ? customParagraph : "",
      psiValues: { PQS: psiPQS, CO2: psiCO2 },
    };
    onExport(config, format);
  };

  if (!isOpen) return null;

  const labelCls = "text-[10px] font-bold text-zinc-400 uppercase tracking-wider";
  const toggleCls = (active: boolean) =>
    `relative w-9 h-5 rounded-full transition-colors cursor-pointer ${active ? "bg-blue-600" : "bg-zinc-700"}`;
  const dotCls = (active: boolean) =>
    `absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${active ? "translate-x-4" : ""}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h3 className="text-lg font-bold text-white">📜 Exportar Certificado</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto">

          {/* Tipo de certificado */}
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Tipo de certificado</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setCertType("garantia")}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  certType === "garantia"
                    ? "bg-teal-900/40 border-teal-500 text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.15)]"
                    : "bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                }`}>
                <span className="text-lg">🔧</span>
                <span>Garantía</span>
                <span className="text-[10px] font-normal text-zinc-500">Recarga / Mantenimiento</span>
              </button>
              <button type="button" onClick={() => setCertType("hidrostatica")}
                className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  certType === "hidrostatica"
                    ? "bg-orange-900/40 border-orange-500 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.15)]"
                    : "bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                }`}>
                <span className="text-lg">🔬</span>
                <span>Hidrostática</span>
                <span className="text-[10px] font-normal text-zinc-500">Prueba de presión</span>
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {filtered.length === 0
                ? "⚠️ No hay extintores para este tipo de certificado"
                : `✓ ${filtered.length} extintor${filtered.length > 1 ? "es" : ""} incluido${filtered.length > 1 ? "s" : ""}`
              }
            </p>
          </div>

          {/* Columnas opcionales */}
          <div className="flex flex-col gap-3">
            <label className={labelCls}>Columnas opcionales</label>
            <div className="grid grid-cols-1 gap-2.5 bg-zinc-950/40 rounded-xl p-4 border border-zinc-800/50">
              {/* N° Interno */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">N° Interno</span>
                <div className={toggleCls(showNInterno)} onClick={() => setShowNInterno(!showNInterno)}>
                  <div className={dotCls(showNInterno)} />
                </div>
              </div>
              {/* Marca */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Marca / Procedencia</span>
                <div className={toggleCls(showMarca)} onClick={() => setShowMarca(!showMarca)}>
                  <div className={dotCls(showMarca)} />
                </div>
              </div>
              {/* Rating */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-300">Rating (ej: 20A-80BC)</span>
                <div className={toggleCls(showRating)} onClick={() => setShowRating(!showRating)}>
                  <div className={dotCls(showRating)} />
                </div>
              </div>
              {/* PSI - solo Tipo B */}
              {certType === "hidrostatica" && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-300">Presión (PSI)</span>
                    <div className={toggleCls(showPsi)} onClick={() => setShowPsi(!showPsi)}>
                      <div className={dotCls(showPsi)} />
                    </div>
                  </div>
                  {showPsi && (
                    <div className="flex gap-3 ml-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">PQS:</span>
                        <input type="text" value={psiPQS} onChange={e => setPsiPQS(e.target.value)}
                          className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 text-center" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">CO2:</span>
                        <input type="text" value={psiCO2} onChange={e => setPsiCO2(e.target.value)}
                          className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 text-center" />
                      </div>
                    </div>
                  )}
                </>
              )}
              {/* NFPA */}
              <div className="flex items-center justify-between border-t border-zinc-800/50 pt-2.5 mt-1">
                <span className="text-sm text-zinc-300">Incluir NFPA 10 – USA</span>
                <div className={toggleCls(includeNfpa)} onClick={() => setIncludeNfpa(!includeNfpa)}>
                  <div className={dotCls(includeNfpa)} />
                </div>
              </div>
            </div>
          </div>

          {/* Fecha del certificado */}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Fecha del certificado</label>
            <input type="text" value={certDate} onChange={e => setCertDate(e.target.value)}
              placeholder="Lima 30 de abril del 2026"
              className="w-full bg-zinc-950/50 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
          </div>

          {/* Párrafo personalizado */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Párrafo descriptivo</label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500">{useCustomParagraph ? "Manual" : "Auto"}</span>
                <div className={toggleCls(useCustomParagraph)} onClick={() => setUseCustomParagraph(!useCustomParagraph)}>
                  <div className={dotCls(useCustomParagraph)} />
                </div>
              </div>
            </div>
            {useCustomParagraph ? (
              <textarea value={customParagraph} onChange={e => setCustomParagraph(e.target.value)}
                rows={4}
                placeholder="se ha efectuado la recarga y/o mantenimiento de los extintores portátiles..."
                className="w-full bg-zinc-950/50 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none" />
            ) : (
              <p className="text-xs text-zinc-500 bg-zinc-950/30 rounded-lg px-3 py-2 border border-zinc-800/50">
                El párrafo se generará automáticamente según los agentes y servicios detectados en los extintores filtrados.
              </p>
            )}
          </div>

          {/* Formato de salida */}
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Formato de exportación</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setFormat("docx")}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  format === "docx"
                    ? "bg-blue-900/40 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                    : "bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                }`}>
                <span className="text-lg">📝</span> Word
              </button>
              <button type="button" onClick={() => setFormat("pdf")}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                  format === "pdf"
                    ? "bg-red-900/40 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                    : "bg-zinc-950/50 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
                }`}>
                <span className="text-lg">📄</span> PDF
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 flex gap-3 justify-end shrink-0 bg-zinc-900/50">
          <button onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-zinc-700 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
            Cancelar
          </button>
          <button onClick={handleExport}
            disabled={exporting || filtered.length === 0}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white shadow-lg shadow-blue-900/20 disabled:opacity-50 transition-all hover:-translate-y-0.5 flex items-center gap-2">
            {exporting ? "⏳ Generando..." : `📜 Exportar ${format === "pdf" ? "PDF" : "Word"}`}
          </button>
        </div>
      </div>
    </div>
  );
}