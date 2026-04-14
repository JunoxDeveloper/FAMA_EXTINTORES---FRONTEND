import { useState } from "react";
import type { Socket } from "socket.io-client";

type CatalogType = "marca" | "agente" | "recarga";

export function CreatableSelect({
  value,
  onChange,
  options,
  placeholder,
  catalogType,
  socket,
  userRole,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  catalogType: CatalogType;
  socket: Socket | null;
  userRole: string;
  className?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");

  const handleAdd = () => {
    if (!socket || !newValue.trim()) return;
    socket.emit("catalog:create", {
      role: userRole,
      type: catalogType,
      value: newValue.trim(),
    }, (res: any) => {
      if (res?.success) {
        onChange(newValue.trim());
        setNewValue("");
        setAdding(false);
      }
    });
  };

  const isDark = className?.includes("bg-zinc-800") || className?.includes("bg-zinc-900") || className?.includes("bg-zinc-950");

if (adding) {
    return (
      // CAMBIO: Volvemos a items-center para no forzar estiramientos raros
      <div className="flex gap-2 items-center">
        <input
          className={`${className} flex-1 min-w-0`}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Nuevo valor..."
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        {/* CAMBIO: Tamaño fijo exacto w-10.5 h-10.5 para hacer juego con el input */}
        <button type="button" onClick={handleAdd}
          className="w-10.5 h-10.5 shrink-0 flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all active:scale-95 text-sm font-bold">
          ✓
        </button>
        <button type="button" onClick={() => { setAdding(false); setNewValue(""); }}
          className={`w-10.5 h-10.5 shrink-0 flex items-center justify-center rounded-xl border-2 shadow-sm transition-all active:scale-95 text-sm font-bold ${isDark
              ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-900 hover:bg-red-950/50" 
              : "bg-white border-zinc-200 text-zinc-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50" 
            }`}>
          ✕
        </button>
      </div>
    );
  }

  return (
    // CAMBIO: items-center asegura que la alineación vertical sea perfecta sin deformar
    <div className="flex gap-2 items-center">
      <select className={`${className} flex-1 min-w-0`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder || "Seleccionar..."}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {/* CAMBIO: Tamaño fijo w-10.5 h-10.5 con el ícono bien centrado */}
      <button type="button" onClick={() => setAdding(true)}
        className={`w-10.5 h-10.5 shrink-0 flex items-center justify-center rounded-xl border-2 border-dashed shadow-sm transition-all active:scale-95 text-xl font-light leading-none ${isDark
            ? "border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:border-zinc-500 hover:text-white" 
            : "border-zinc-300 bg-zinc-50 text-zinc-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50" 
          }`}
        title="Agregar nuevo">
        +
      </button>
    </div>
  );
}