import { useState, useMemo } from "react";
import { ESTADOS } from "../../constants/extintores";
import { MESES } from "../../constants";
import type { Extintor, EmpresaData } from "../../types";
import { generateStickersZip } from "../../utils/stickers";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  extintores: Extintor[];
  empresa: EmpresaData;
}

export default function StickersModal({ isOpen, onClose, extintores, empresa }: Props) {
  const now = new Date();
  const [mes, setMes] = useState(String(now.getMonth() + 1));
  const [anio, setAnio] = useState(now.getFullYear());
  const [generando, setGenerando] = useState(false);
  const [progreso, setProgreso] = useState({ done: 0, total: 0 });

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    ESTADOS.forEach((e) => { map[e] = 0; });
    extintores.forEach((ext) => {
      const estado = ext.estadoExtintor || "Sin definir";
      map[estado] = (map[estado] || 0) + 1;
    });
    return map;
  }, [extintores]);

  // Por defecto: Aprobado/Nuevo/Garantía marcados SOLO si tienen extintores.
  // "De Baja" siempre desmarcado por defecto, sin importar su cantidad.
  // Se calcula una única vez al abrir el modal; el usuario puede cambiarlo manualmente después.
  const [estadosSel, setEstadosSel] = useState<string[]>(() =>
    ESTADOS.filter((e) => e !== "De Baja" && counts[e] > 0)
  );

  const seleccionados = useMemo(
    () => extintores.filter((ext) => estadosSel.includes(ext.estadoExtintor || "")),
    [extintores, estadosSel]
  );

  if (!isOpen) return null;

  const toggleEstado = (estado: string) => {
    setEstadosSel((prev) => (prev.includes(estado) ? prev.filter((e) => e !== estado) : [...prev, estado]));
  };

  const handleGenerar = async () => {
    if (seleccionados.length === 0) return;
    setGenerando(true);
    setProgreso({ done: 0, total: seleccionados.length });
    try {
      const nombreMes = MESES.find((m) => m.value === mes)?.label || mes;
      const fechaVenc = `${nombreMes} ${anio}`;
      await generateStickersZip(seleccionados, empresa, fechaVenc, (done, total) => setProgreso({ done, total }));
      onClose();
    } catch (e) {
      alert("Ocurrió un error generando los stickers: " + (e as Error).message);
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md p-6 flex flex-col gap-5">
        <h2 className="text-lg font-bold text-white">🏷️ Descargar Stickers</h2>

        <div className="flex gap-3">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-bold text-zinc-400">Mes de vencimiento</label>
            <select value={mes} onChange={(e) => setMes(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
              {MESES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="w-28 flex flex-col gap-1">
            <label className="text-xs font-bold text-zinc-400">Año</label>
            <input type="number" value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-zinc-400">Estados a incluir</label>
          {ESTADOS.map((estado) => (
            <label key={estado} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 cursor-pointer">
              <span className="flex items-center gap-2 text-sm text-white">
                <input type="checkbox" checked={estadosSel.includes(estado)} onChange={() => toggleEstado(estado)} />
                {estado}
              </span>
              <span className="text-xs font-bold text-zinc-400">{counts[estado] || 0}</span>
            </label>
          ))}
        </div>

        <div className="text-xs text-zinc-400">
          Se generará <b className="text-white">{seleccionados.length}</b> sticker(s).
        </div>

        {generando && (
          <div className="text-xs text-zinc-400">Generando {progreso.done}/{progreso.total}...</div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={generando} className="px-4 py-2 rounded-lg text-sm font-bold text-zinc-400 hover:text-white">Cancelar</button>
          <button onClick={handleGenerar} disabled={generando || seleccionados.length === 0} className="px-5 py-2 rounded-lg text-sm font-bold bg-red-700 hover:bg-red-600 text-white disabled:opacity-50">
            {generando ? "Generando..." : "Descargar ZIP"}
          </button>
        </div>
      </div>
    </div>
  );
}