import { useState } from "react";
import type { Socket } from "socket.io-client";

type CatalogType = "motivo_baja" | "servicio_extra";

export function MultiSelect({
    selected,
    onChange,
    options,
    catalogType,
    socket,
    userRole,
    className, // 👈 ¡Faltaba agregar esto aquí!
}: {
    selected: string[];
    onChange: (values: string[]) => void;
    options: string[];
    label: string;
    catalogType: CatalogType;
    socket: Socket | null;
    userRole: string;
    className?: string;
}) {
    const [adding, setAdding] = useState(false);
    const [newValue, setNewValue] = useState("");

    const toggle = (val: string) => {
        const upper = val.toUpperCase();
        if (selected.some((s) => s.toUpperCase() === upper)) {
            onChange(selected.filter((s) => s.toUpperCase() !== upper));
        } else {
            onChange([...selected, val]);
        }
    };

    const handleAdd = () => {
        if (!socket || !newValue.trim()) return;
        socket.emit("catalog:create", {
            role: userRole,
            type: catalogType,
            value: newValue.trim(),
        }, (res: any) => {
            if (res?.success) {
                onChange([...selected, newValue.trim()]);
                setNewValue("");
                setAdding(false);
            }
        });
    };

    const isDark = className?.includes("bg-zinc-800") || className?.includes("bg-zinc-900") || className?.includes("bg-zinc-950");

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                    const active = selected.some((s) => s.toUpperCase() === opt.toUpperCase());
                    return (
                        <button key={opt} type="button" onClick={() => toggle(opt)}
                            className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${active
                                ? "bg-red-600 border-red-600 text-white shadow-md"
                                : isDark
                                    ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-red-500 hover:text-red-400 hover:bg-red-950/40" // 🌙 Modo Oscuro
                                    : "bg-white border-zinc-200 text-zinc-500 hover:border-red-300 hover:text-red-700 hover:bg-red-50/50" // ☀️ Modo Claro
                                }`}>
                            {opt}
                        </button>
                    );
                })}
                {!adding && (
                    <button type="button" onClick={() => setAdding(true)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold border-2 border-dashed transition-all ${isDark
                            ? "border-zinc-700 bg-zinc-900/50 text-zinc-500 hover:border-red-500/50 hover:text-red-400 hover:bg-red-950/40" // 🌙 Modo Oscuro
                            : "border-zinc-300 bg-zinc-50 text-zinc-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50" // ☀️ Modo Claro
                            }`}>
                        + Nuevo
                    </button>
                )}
            </div>

            {adding && (
                <div className="flex gap-2">
                    <input
                        className={`flex-1 min-w-0 border-2 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all ${isDark
                            ? "border-zinc-700 bg-zinc-800 text-zinc-200 placeholder-zinc-500" // 🌙 Modo Oscuro
                            : "border-zinc-200 bg-white text-zinc-800 placeholder-zinc-400" // ☀️ Modo Claro
                            }`}
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder="Escribe y presiona Enter..."
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    />
                    <button type="button" onClick={handleAdd}
                        className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-all active:scale-95 text-sm font-bold">
                        ✓
                    </button>
                    <button type="button" onClick={() => { setAdding(false); setNewValue(""); }}
                        className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-xl border-2 shadow-sm transition-all active:scale-95 text-sm font-bold ${isDark
                            ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-900 hover:bg-red-950/50" // 🌙 Modo Oscuro
                            : "bg-white border-zinc-200 text-zinc-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50" // ☀️ Modo Claro
                            }`}>
                        ✕
                    </button>
                </div>
            )}

            {selected.length > 0 && (
                <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                    Seleccionados: {selected.join(", ")}
                </p>
            )}
        </div>
    );
}