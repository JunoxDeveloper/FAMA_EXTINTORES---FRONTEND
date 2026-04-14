import { useEffect, useState } from "react";

export default function CatalogModal({ isOpen, onClose, catalogs, socket, userRole }: any) {
    const [activeTab, setActiveTab] = useState("marca");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");
    const [showArchived, setShowArchived] = useState(false);
    const [archivedItems, setArchivedItems] = useState<any[]>([]);

    useEffect(() => {
        if (showArchived && isOpen && socket) {
            socket.emit("catalog:deleted:list", { role: userRole }, (res: any) => {
                if (res?.success) setArchivedItems(res.list);
            });
        }
    }, [showArchived, isOpen, catalogs, socket, userRole]);

    if (!isOpen) return null;

    const TABS = [
        { id: "marca", label: "Marcas" },
        { id: "agente", label: "Agentes" },
        { id: "recarga", label: "Recargas" },
        { id: "motivo_baja", label: "Motivos Baja" },
        { id: "servicio_extra", label: "Servicios Extra" },
    ];

    const getList = () => {
        if (showArchived) return archivedItems.filter(i => i.type === activeTab);
        if (activeTab === "marca") return catalogs.marcas || [];
        if (activeTab === "agente") return catalogs.agentes || [];
        if (activeTab === "recarga") return catalogs.recargas || [];
        if (activeTab === "motivo_baja") return catalogs.motivosBaja || [];
        if (activeTab === "servicio_extra") return catalogs.serviciosExtra || [];
        return [];
    };

    const handleSave = (id: number) => {
        if (!editValue.trim()) return;
        socket.emit("catalog:update", { role: userRole, id, value: editValue.trim() });
        setEditingId(null);
    };

    const handleSoftDelete = (id: number) => {
        if (confirm("¿Archivar este elemento? Ya no aparecerá en las opciones del formulario.")) {
            socket.emit("catalog:softDelete", { role: userRole, id });
        }
    };

    const handleRestore = (id: number) => {
        socket.emit("catalog:restore", { role: userRole, id }, () => {
            socket.emit("catalog:deleted:list", { role: userRole }, (res: any) => {
                if (res?.success) setArchivedItems(res.list);
            });
        });
    };

    const handleHardDelete = (id: number) => {
        if (confirm("⚠️ ¿ELIMINAR PERMANENTEMENTE? Esta acción destruirá el registro de la base de datos.")) {
            socket.emit("catalog:hardDelete", { role: userRole, id }, () => {
                if (showArchived) {
                    socket.emit("catalog:deleted:list", { role: userRole }, (res: any) => {
                        if (res?.success) setArchivedItems(res.list);
                    });
                }
            });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 shrink-0">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-black text-white flex items-center gap-2">📖 Gestión de Catálogos</h3>
                        <button onClick={() => setShowArchived(!showArchived)} className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${showArchived ? "bg-red-950/50 border-red-900/50 text-red-400" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white"}`}>
                            {showArchived ? "Ocultar Archivados" : "Ver Archivados"}
                        </button>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">✕</button>
                </div>

                <div className="flex overflow-x-auto p-4 gap-2 bg-zinc-900/20 border-b border-zinc-800 shrink-0 scrollbar-hide">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => { setActiveTab(t.id); setEditingId(null); }}
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === t.id ? "bg-red-600 text-white shadow-md" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                    {getList().map((item: any) => (
                        <div key={item.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${showArchived ? "bg-red-950/10 border-red-900/30" : "bg-zinc-900/40 border-zinc-800/60 hover:bg-zinc-900"}`}>
                            {editingId === item.id && !showArchived ? (
                                <input autoFocus className="flex-1 bg-zinc-950 border border-red-500/50 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave(item.id)} />
                            ) : (
                                <span className={`flex-1 text-sm font-bold truncate ${showArchived ? "text-zinc-500 line-through" : "text-zinc-200"}`}>{item.value}</span>
                            )}

                            <div className="flex items-center gap-1.5 shrink-0">
                                {editingId === item.id && !showArchived ? (
                                    <>
                                        <button onClick={() => handleSave(item.id)} className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all text-sm">✓</button>
                                        <button onClick={() => setEditingId(null)} className="w-8 h-8 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white flex items-center justify-center transition-all text-sm">✕</button>
                                    </>
                                ) : showArchived ? (
                                    <>
                                        <button onClick={() => handleRestore(item.id)} className="px-3 py-1.5 rounded-lg bg-emerald-950/30 text-emerald-500 hover:bg-emerald-900/50 text-xs font-bold transition-all">Restaurar</button>
                                        {userRole === "boss" && <button onClick={() => handleHardDelete(item.id)} className="w-8 h-8 rounded-lg border border-red-900/50 text-red-500 hover:bg-red-900 hover:text-white flex items-center justify-center transition-all text-xs" title="Eliminar Permanente">🗑️</button>}
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => { setEditingId(item.id); setEditValue(item.value); }} className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white text-xs font-bold transition-all">Editar</button>
                                        <button onClick={() => handleSoftDelete(item.id)} className="px-3 py-1.5 rounded-lg bg-red-950/30 text-red-400 hover:bg-red-900/50 hover:text-red-300 text-xs font-bold transition-all">Archivar</button>
                                        {userRole === "boss" && <button onClick={() => handleHardDelete(item.id)} className="w-8 h-8 rounded-lg border border-red-900/50 text-red-500 hover:bg-red-900 hover:text-white flex items-center justify-center transition-all text-xs" title="Eliminar Permanente">🗑️</button>}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                    {getList().length === 0 && (
                        <div className="text-center py-10 text-zinc-500 text-sm font-medium">No hay elementos {showArchived ? "archivados" : "activos"} en esta categoría.</div>
                    )}
                </div>
            </div>
        </div>
    );
}