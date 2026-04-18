import { useState, useEffect } from "react";
import { COMP_LABELS, MESES } from "./constants";
import type { EmpresaItem, EmpresaData, Extintor, DashView } from "./types";
import { emptyExtintor, estadoColor, serviceBadge, downloadBase64, downloadEvidenciaAsPng } from "./utils/helpers";
import { useSocket } from "./hooks/useSocket";
import {
  EmpresaModal, ExtintorModal, ArchivedModal, UsersModal,
  WhatsappModal, ArchiveModal, DuplicateModal, ObservationModal, WeightSortModal
} from "./components/modals";
import { InfoSection, InfoRow, FilterSelect, MetricPanel, ComponentDots } from "./components/ui/DashboardUI";

/* ══════════════════════════════════════════
   FUNCIONES AUXILIARES
   ══════════════════════════════════════════ */
const getWeightInKg = (weightStr: string) => {
  if (!weightStr || weightStr === "Sin definir") return 999999; // Los vacíos van al final
  const match = weightStr.match(/([\d.]+)\s*(KG|LBS?|LT|GAL)/i);
  if (!match) return 999999;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  // 1 Libra = 0.453592 Kilogramos, 1 Galón ≈ 3.785 Litros
  if (unit.startsWith("LB")) return val * 0.453592;
  if (unit === "GAL") return val * 3.785;
  return val;
};

/* ══════════════════════════════════════════
   NUEVO COMPONENTE: GESTIÓN DE CATÁLOGOS
   ══════════════════════════════════════════ */
function CatalogModal({ isOpen, onClose, catalogs, socket, userRole }: any) {
  const [activeTab, setActiveTab] = useState("marca");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedItems, setArchivedItems] = useState<any[]>([]);

  useEffect(() => {
  if (isOpen && socket) {
    socket.emit("catalog:deleted:list", { role: userRole }, (res: any) => {
      if (res?.success) setArchivedItems(res.list);
    });
  }
}, [isOpen, catalogs, socket, userRole]); // Eliminamos showArchived como disparador

  if (!isOpen) return null;

  // 1. ELIMINADO: Se quitó el objeto de 'recarga' de los TABS
  const TABS = [
    { id: "marca", label: "Marcas" },
    { id: "agente", label: "Agentes" },
    { id: "motivo_baja", label: "Motivos Baja" },
    { id: "servicio_extra", label: "Servicios Extra" },
  ];

  const getList = () => {
    let items = [];
    if (showArchived) {
      items = archivedItems.filter(i => i.type === activeTab);
    } else {
      if (activeTab === "marca") items = catalogs.marcas || [];
      else if (activeTab === "agente") items = catalogs.agentes || [];
      // 2. ELIMINADO: Se quitó la lógica de catalogs.recargas
      else if (activeTab === "motivo_baja") items = catalogs.motivosBaja || [];
      else if (activeTab === "servicio_extra") items = catalogs.serviciosExtra || [];
    }
    
    return [...items].sort((a, b) => (a.value || "").localeCompare(b.value || "", "es"));
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
            {/* CAMBIO: Solo se muestra si existen archivados para la categoría activa */}
{archivedItems.some(i => i.type === activeTab) && (
  <button 
    onClick={() => setShowArchived(!showArchived)} 
    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${showArchived ? "bg-red-950/50 border-red-900/50 text-red-400" : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white"}`}
  >
    {showArchived ? "Ocultar Archivados" : "Ver Archivados"}
  </button>
)}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">✕</button>
        </div>

        <div className="flex overflow-x-auto p-4 gap-2 bg-zinc-900/20 border-b border-zinc-800 shrink-0 scrollbar-hide">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setEditingId(null); setShowArchived(false); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${activeTab === t.id ? "bg-red-600 text-white shadow-md" : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
          {/* getList() ya devuelve la información ordenada alfabéticamente */}
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

/* ══════════════════════════════════════════
   COMPONENTE PRINCIPAL
   ══════════════════════════════════════════ */
export default function DashboardPage({ user, onLogout }: { user: { id: string; username: string; role: string; displayName: string }; onLogout: () => void }) {
  const { socket, connected, catalogs } = useSocket(user.id, onLogout);
  const MARCAS = catalogs.marcas.map((c) => c.value).sort((a, b) => a.localeCompare(b, "es"));
  const AGENTES = catalogs.agentes.map((c) => c.value).sort((a, b) => a.localeCompare(b, "es"));
  const RECARGAS = catalogs.recargas.map((c) => c.value);
  const MOTIVOS_BAJA = catalogs.motivosBaja.map((c) => c.value);
  const SERVICIOS_EXTRA = catalogs.serviciosExtra.map((c) => c.value);

  const [empresas, setEmpresas] = useState<EmpresaItem[]>([]);
  const [view, setView] = useState<DashView>("list");

  // Detalle
  const [selectedEmpresa, setSelectedEmpresa] = useState<EmpresaData | null>(null);
  const [extintores, setExtintores] = useState<Extintor[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Duplicar empresa
  const [duplicateModal, setDuplicateModal] = useState(false);
  const [duplicateWithExt, setDuplicateWithExt] = useState(false);

  // Search
  const [search, setSearch] = useState("");
  const [fMonth, setFMonth] = useState("");
  const [fYear, setFYear] = useState("");

  // Modal editar empresa
  const [editingEmpresa, setEditingEmpresa] = useState(false);
  const [empresaForm, setEmpresaForm] = useState<EmpresaData | null>(null);

  // Modal editar/agregar extintor
  const [extintorModal, setExtintorModal] = useState(false);
  const [extintorForm, setExtintorForm] = useState<Partial<Extintor>>(emptyExtintor());
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);

// Modal evidencia fotográfica (múltiples)
  const [evidenciaModal, setEvidenciaModal] = useState(false);
  const [evidenciaList, setEvidenciaList] = useState<string[]>([]);
  const [evidenciaLoading, setEvidenciaLoading] = useState(false);
  const [evidenciaExtInfo, setEvidenciaExtInfo] = useState<string>("");
  const [evidenciaActiveIdx, setEvidenciaActiveIdx] = useState(0);

  // Filtros tabla
  const [fMarca, setFMarca] = useState("");
  const [fAgente, setFAgente] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fServicio, setFServicio] = useState("");
  const [fComponente, setFComponente] = useState("");
  const [fPeso, setFPeso] = useState("");
  const [weightOrderModal, setWeightOrderModal] = useState(false);
  const [customWeightOrder, setCustomWeightOrder] = useState<string[]>([]);

  // NUEVOS ESTADOS:
  const [estadoOrderModal, setEstadoOrderModal] = useState(false);
  const [customEstadoOrder, setCustomEstadoOrder] = useState<string[]>([]);

  const [agenteOrderModal, setAgenteOrderModal] = useState(false);
  const [customAgenteOrder, setCustomAgenteOrder] = useState<string[]>([]);



  const [deleteModal, setDeleteModal] = useState(false);
  const [_, setDeleteConfirmText] = useState("");

  const [exporting, setExporting] = useState(false);

  const [whatsappModal, setWhatsappModal] = useState(false);
  const [whatsappFormat, setWhatsappFormat] = useState<"excel" | "pdf">("excel");
  const [whatsappMsg, setWhatsappMsg] = useState("");

  const [obsModal, setObsModal] = useState<string | null>(null);

  const [createEmpresaModal, setCreateEmpresaModal] = useState(false);

  // Gestión usuarios (solo boss)
  const [usersModal, setUsersModal] = useState(false);
  const [catalogModal, setCatalogModal] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [userForm, setUserForm] = useState({ username: "", password: "", displayName: "", role: "worker" as string });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userError, setUserError] = useState("");

  // Archivados (solo boss)
  const [archivedView, setArchivedView] = useState(false);
  const [archivedEmpresas, setArchivedEmpresas] = useState<any[]>([]);
  const [archivedExtintores, setArchivedExtintores] = useState<any[]>([]);
  const [archivedTab, setArchivedTab] = useState<"empresas" | "extintores">("empresas");
  const [loadingArchived, setLoadingArchived] = useState(false);

  const [expandedArchived, setExpandedArchived] = useState<Record<string, boolean>>({});

  /* ── Socket setup ── */
  useEffect(() => {
    if (!socket) return;

    socket.on("empresa:list", (list: EmpresaItem[]) => setEmpresas(list));

    socket.on("empresa:data", (data: EmpresaData) => {
      setSelectedEmpresa(data);
      setLoadingDetail(false);
    });

    socket.on("empresa:data:updated", (data: EmpresaData) => {
      setSelectedEmpresa((prev) => prev && prev.id === data.id ? { ...prev, ...data } : prev);
    });

    socket.on("extintor:updated", ({ rows }: { id: string; rows: Extintor[] }) => {
      setExtintores(rows);
    });

    return () => {
      socket.off("empresa:list");
      socket.off("empresa:data");
      socket.off("empresa:data:updated");
      socket.off("extintor:updated");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const handleArchivedChange = () => {
      if (archivedView) {
        socket.emit("empresa:deleted:list", { role: user.role }, (res: any) => {
          if (res?.success) setArchivedEmpresas(res.list);
        });
        socket.emit("extintor:deleted:list", { role: user.role }, (res: any) => {
          if (res?.success) setArchivedExtintores(res.rows);
        });
      }
    };
    socket.on("extintor:archived:changed", handleArchivedChange);
    return () => {
      socket.off("extintor:archived:changed", handleArchivedChange);
    };
  }, [socket, archivedView, user.role]);

  /* ── Seleccionar empresa ── */
  const openEmpresa = (emp: EmpresaItem) => {
    if (!socket) return;
    setLoadingDetail(true);
    setExtintores([]);
    setSelectedEmpresa(null);
    socket.emit("empresa:get", { id: emp.id });
    socket.emit("extintor:list", { id: emp.id });
    setView("detail");
  };

  const goBack = () => {
    setView("list");
    setSelectedEmpresa(null);
    setExtintores([]);
  };

  // Lógica para detectar duplicados de Serie e Interno
  const serieCounts: Record<string, number> = {};
  const internoCounts: Record<string, number> = {};

  extintores.forEach((e) => {
    const sOrig = e.nSerie?.trim() || "";
    const iOrig = e.nInterno?.trim() || "";
    const sUpper = sOrig.toUpperCase();
    const iUpper = iOrig.toUpperCase();

    // Excluimos S/N y vacíos
    if (sOrig && sUpper !== "S/N" && sUpper !== "—") {
      serieCounts[sOrig] = (serieCounts[sOrig] || 0) + 1;
    }
    // Excluimos S/TAG, S/N y vacíos
    if (iOrig && iUpper !== "S/TAG" && iUpper !== "S/N" && iUpper !== "—") {
      internoCounts[iOrig] = (internoCounts[iOrig] || 0) + 1;
    }
  });

  // Creamos Sets para una búsqueda ultra rápida al renderizar la tabla
  const duplicateSeries = new Set(Object.keys(serieCounts).filter(k => serieCounts[k] > 1));
  const duplicateInternos = new Set(Object.keys(internoCounts).filter(k => internoCounts[k] > 1));

  const openArchivedView = () => {
    if (!socket || (user.role !== "boss" && user.role !== "admin")) return;
    setLoadingArchived(true);
    setArchivedTab("empresas");

    socket.emit("empresa:deleted:list", { role: user.role }, (res: any) => {
      if (res?.success) setArchivedEmpresas(res.list);
    });
    socket.emit("extintor:deleted:list", { role: user.role }, (res: any) => {
      setLoadingArchived(false);
      if (res?.success) setArchivedExtintores(res.rows);
    });
    setArchivedView(true);
  };

  const refreshArchived = () => {
    if (!socket) return;
    socket.emit("empresa:deleted:list", { role: user.role }, (res: any) => {
      if (res?.success) setArchivedEmpresas(res.list);
    });
    socket.emit("extintor:deleted:list", { role: user.role }, (res: any) => {
      if (res?.success) setArchivedExtintores(res.rows);
    });
  };

  const restoreEmpresa = (id: string) => {
    if (!socket) return;
    socket.emit("empresa:restore", { id, role: user.role }, (res: any) => {
      if (res?.success) refreshArchived();
    });
  };

  const hardDeleteEmpresa = (id: string) => {
    if (!socket || !confirm("⚠️ ELIMINAR PERMANENTEMENTE esta empresa y todos sus extintores? Esta acción NO se puede deshacer.")) return;
    socket.emit("empresa:hardDelete", { id, role: user.role }, (res: any) => {
      if (res?.success) refreshArchived();
    });
  };

  const restoreExtintor = (rowIndex: number, empresaId: string) => {
    if (!socket) return;
    socket.emit("extintor:restore", { rowIndex, id: empresaId, role: user.role }, (res: any) => {
      if (res?.success) refreshArchived();
    });
  };

  const hardDeleteExtintor = (rowIndex: number) => {
    if (user.role !== "boss") return alert("Solo el Boss puede eliminar permanentemente");
    if (!socket || !confirm("⚠️ ¿ELIMINAR PERMANENTEMENTE?")) return;
    socket.emit("extintor:hardDelete", { rowIndex, role: user.role }, (res: any) => {
      if (res?.success) refreshArchived();
    });
  };

  const duplicateEmpresa = () => {
    if (!socket || !selectedEmpresa?.id) return;
    setSaving(true);
    socket.emit("empresa:duplicate", {
      id: selectedEmpresa.id,
      includeExtintores: duplicateWithExt,
    }, (res: any) => {
      setSaving(false);
      setDuplicateModal(false);
      if (res?.success) {
        goBack();
        socket.emit("empresa:list");
      }
    });
  };

  const handleDeleteEmpresa = () => {
    if (!socket || !selectedEmpresa?.id) return;
    setSaving(true);
    socket.emit("empresa:delete", { id: selectedEmpresa.id, role: user.role }, (res: any) => {
      setSaving(false);
      setDeleteModal(false);
      setDeleteConfirmText("");
      if (res?.success) {
        goBack();
        socket.emit("empresa:list");
      }
    });
  };

  const exportExcel = () => {
    if (!socket || !selectedEmpresa?.id) return;
    setExporting(true);
    socket.emit("export:excel", {
      id: selectedEmpresa.id,
      weightOrder: customWeightOrder,
      estadoOrder: customEstadoOrder,
      agenteOrder: customAgenteOrder
    }, (res: any) => {
      setExporting(false);
      if (res?.success && res.data) {
        downloadBase64(res.data, res.fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      }
    });
  };

  const executeWhatsapp = () => {
    if (!socket || !selectedEmpresa?.id) return;
    setExporting(true);

    if (whatsappFormat === "excel") {
      // AÑADIDO: Pasamos weightOrder
      socket.emit("export:excel", {
        id: selectedEmpresa.id,
        weightOrder: customWeightOrder,
        estadoOrder: customEstadoOrder,
        agenteOrder: customAgenteOrder
      }, (res: any) => {
        setExporting(false);
        if (res?.success && res.data) {
          downloadBase64(res.data, res.fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          openWhatsappLink();
        }
      });
    } else {
      // AÑADIDO: Pasamos weightOrder
      socket.emit("export:pdf", {
        id: selectedEmpresa.id,
        weightOrder: customWeightOrder,
        estadoOrder: customEstadoOrder,
        agenteOrder: customAgenteOrder
      }, (res: any) => {
        setExporting(false);
        if (!res?.success) {
          alert(res?.error || "Error al generar PDF");
          return;
        }
        if (res.data) {
          const fileName = `${selectedEmpresa.razonSocial.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, "")}_Extintores.pdf`;
          downloadBase64(res.data, fileName, "application/pdf");
          openWhatsappLink();
        }
      });
    }
  };

  const openWhatsappModal = () => {
    if (!selectedEmpresa) return;
    setWhatsappMsg(
      `Hola ${selectedEmpresa.nombresApellidos || ""},\n` +
      `Le envío el detalle de servicio de extintores de *${selectedEmpresa.razonSocial}*.\n` +
      `Adjunto el archivo con el inventario completo.`
    );
    setWhatsappFormat("excel");
    setWhatsappModal(true);
  };


  const openWhatsappLink = () => {
    if (!selectedEmpresa?.celular) return;
    let num = selectedEmpresa.celular.replace(/\D/g, "");
    if (num.length === 9 && num.startsWith("9")) num = "51" + num;
    const msg = encodeURIComponent(whatsappMsg);
    setTimeout(() => {
      window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
      setWhatsappModal(false);
    }, 1000);
  };

  const openCreateEmpresa = () => {
    setEmpresaForm({
      razonSocial: "", direccion: "", distrito: "", ruc: "",
      nombresApellidos: "", celular: "", nOrdenTrabajo: "",
      fechaRetiro: "", fechaEntrega: "",
    });
    setCreateEmpresaModal(true);
  };

  const saveNewEmpresa = () => {
    if (!socket || !empresaForm) return;
    setSaving(true);
    socket.emit("empresa:save", empresaForm, (res: any) => {
      setSaving(false);
      if (res?.success) {
        setCreateEmpresaModal(false);
        socket.emit("empresa:list");
      }
    });
  };

  const openEditEmpresa = () => {
    if (!selectedEmpresa) return;
    setEmpresaForm({ ...selectedEmpresa });
    setEditingEmpresa(true);
  };

  const saveEmpresa = () => {
    if (!socket || !empresaForm) return;
    setSaving(true);
    socket.emit("empresa:save", empresaForm, (res: any) => {
      setSaving(false);
      if (res?.success) {
        setEditingEmpresa(false);
        socket.emit("empresa:get", { id: empresaForm.id });
        socket.emit("empresa:list");
      }
    });
  };

  const openAddExtintor = () => {
    setExtintorForm(emptyExtintor());
    setEditingRowIndex(null);
    setExtintorModal(true);
  };

  const openEditExtintor = (ext: Extintor) => {
    setExtintorForm({ ...ext });
    setEditingRowIndex(ext.rowIndex);
    setExtintorModal(true);
  };

  const saveExtintor = () => {
    if (!socket || !selectedEmpresa?.id) return;
    setSaving(true);

    const payload = {
      ...extintorForm,
      id: selectedEmpresa.id,
      nSerie: !extintorForm.nSerie || extintorForm.nSerie.trim() === "" ? "S/N" : extintorForm.nSerie.trim(),
      nInterno: !extintorForm.nInterno || extintorForm.nInterno.trim() === "" ? "S/TAG" : extintorForm.nInterno.trim()
    };

    if (editingRowIndex !== null) {
      socket.emit("extintor:update", { ...payload, rowIndex: editingRowIndex }, (res: any) => {
        setSaving(false);
        if (res?.success) setExtintorModal(false);
      });
    } else {
      socket.emit("extintor:add", payload, (res: any) => {
        setSaving(false);
        if (res?.success) setExtintorModal(false);
      });
    }
  };

  const openUsersModal = () => {
    if (!socket || user.role !== "boss") return;
    socket.emit("auth:users:list", { role: user.role }, (res: any) => {
      if (res?.success) setUsersList(res.users);
    });
    setUserForm({ username: "", password: "", displayName: "", role: "worker" });
    setEditingUserId(null);
    setUserError("");
    setUsersModal(true);
  };

  const saveUser = () => {
    if (!socket) return;
    setSavingUser(true);
    setUserError("");

    if (editingUserId) {
      socket.emit("auth:users:update", {
        role: user.role,
        userId: editingUserId,
        username: userForm.username || undefined,
        password: userForm.password || undefined,
        displayName: userForm.displayName || undefined,
        newRole: userForm.role as any,
      }, (res: any) => {
        setSavingUser(false);
        if (res?.success) {
          setEditingUserId(null);
          setUserForm({ username: "", password: "", displayName: "", role: "worker" });
          socket!.emit("auth:users:list", { role: user.role }, (r: any) => {
            if (r?.success) setUsersList(r.users);
          });
        } else setUserError(res?.error || "Error");
      });
    } else {
      if (!userForm.username || !userForm.password) { setSavingUser(false); setUserError("Usuario y contraseña requeridos"); return; }
      socket.emit("auth:users:create", {
        role: user.role,
        username: userForm.username,
        password: userForm.password,
        displayName: userForm.displayName,
        newRole: userForm.role as any,
      }, (res: any) => {
        setSavingUser(false);
        if (res?.success) {
          setUserForm({ username: "", password: "", displayName: "", role: "worker" });
          socket!.emit("auth:users:list", { role: user.role }, (r: any) => {
            if (r?.success) setUsersList(r.users);
          });
        } else setUserError(res?.error || "Error");
      });
    }
  };

  const deleteUser = (userId: string) => {
    if (!socket || !confirm("¿Eliminar este usuario?")) return;
    socket.emit("auth:users:delete", { role: user.role, userId }, (res: any) => {
      if (res?.success) {
        socket!.emit("auth:users:list", { role: user.role }, (r: any) => {
          if (r?.success) setUsersList(r.users);
        });
      }
    });
  };

  const deleteExtintor = (rowIndex: number) => {
    if (!socket || !selectedEmpresa?.id || !confirm("¿Eliminar este extintor?")) return;
    socket.emit("extintor:delete", { id: selectedEmpresa.id, rowIndex, role: user.role });
  };

  const openEvidencia = (ext: Extintor) => {
    if (!socket || ext.evidencia !== "__HAS_EVIDENCIA__") return;
    setEvidenciaLoading(true);
    setEvidenciaList([]);
    setEvidenciaActiveIdx(0);
    setEvidenciaExtInfo(`${ext.nSerie || "S-N"}_${ext.marca || ""}`);
    setEvidenciaModal(true);
    socket.emit("extintor:evidencia:get", { rowIndex: ext.rowIndex }, (res: any) => {
      setEvidenciaLoading(false);
      if (res?.success && res.evidencia) {
        try {
          const arr = JSON.parse(res.evidencia);
          setEvidenciaList(Array.isArray(arr) ? arr : []);
        } catch {
          // Compatibilidad: si es un base64 suelto (dato antiguo), lo metemos en array
          if (res.evidencia && res.evidencia !== "[]") {
            setEvidenciaList([res.evidencia]);
          }
        }
      }
    });
  };

  /* ── Filtro empresas ── */
  const availableYears = [...new Set(
    empresas
      .filter((e) => e.fechaEntrega)
      .map((e) => {
        const [y] = (e.fechaEntrega ?? "").split("-");
        return parseInt(y);
      })
      .filter((y) => !isNaN(y))
  )].sort((a, b) => b - a);

  const filtered = empresas.filter((e) => {
    if (search && !e.razonSocial.toLowerCase().includes(search.toLowerCase())) return false;
    if (fYear || fMonth) {
      if (!e.fechaEntrega) return false;
      const [y, m] = e.fechaEntrega.split("-");
      if (fYear && parseInt(y) !== parseInt(fYear)) return false;
      if (fMonth && parseInt(m) !== parseInt(fMonth)) return false;
    }
    return true;
  });

  /* ── Contadores y métricas ── */
  const count = (arr: Extintor[], key: keyof Extintor) => {
    const map: Record<string, number> = {};
    arr.forEach((e) => {
      const v = (e[key] as string) || "Sin definir";
      map[v] = (map[v] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const estadoCounts = count(extintores, "estadoExtintor");
  const marcaCounts = count(extintores, "marca");
  const agenteCounts = count(extintores, "agenteExtintor");

  const pesoCounts: Record<string, number> = {};
  const pesoAgentBreakdown: Record<string, Record<string, number>> = {};
  const marcaPesoCounts: Record<string, number> = {}; // <--- NUEVO

  extintores.forEach((e) => {
    const v = e.peso ? `${e.peso} ${e.unidadPeso}` : "Sin definir";
    const agente = e.agenteExtintor || "Sin definir";
    const marca = e.marca || "Sin definir"; // <--- NUEVO

    // Cuenta total por peso
    pesoCounts[v] = (pesoCounts[v] || 0) + 1;

    // Cuenta desglosada por agente
    if (!pesoAgentBreakdown[v]) pesoAgentBreakdown[v] = {};
    pesoAgentBreakdown[v][agente] = (pesoAgentBreakdown[v][agente] || 0) + 1;

    // Cuenta por peso y marca (NUEVO)
    const mpKey = `${v}|${marca}`;
    marcaPesoCounts[mpKey] = (marcaPesoCounts[mpKey] || 0) + 1;
  });

  // NUEVO: Efecto que pre-ordena los pesos de menor a mayor automáticamente
  useEffect(() => {
    const availableWeights = Object.keys(pesoCounts);

    if (availableWeights.length > 0) {
      setCustomWeightOrder((prev) => {
        // Detectar si hay pesos nuevos que no estén en nuestro orden actual
        const missing = availableWeights.filter(w => !prev.includes(w));

        // Si no hay pesos nuevos, dejamos el estado como está (respeta el orden del usuario)
        if (missing.length === 0) return prev;

        // Si hay pesos nuevos (o es la primera carga), ordenamos todo combinando ambos
        return [...prev, ...missing].sort((a, b) => getWeightInKg(a) - getWeightInKg(b));
      });
    }
  }, [extintores]); // Se ejecuta cada vez que cambia el inventario de extintores

  // Generamos las entradas con el texto detallado para las métricas
  const pesoEntriesWithAgents = Object.entries(pesoCounts)
    .sort((a, b) => {
      // Si no hay orden personalizado, ordenar por cantidad (descendente) como antes
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

  const filteredExt = extintores.filter((e) => {
    if (fMarca && (e.marca || "Sin definir") !== fMarca) return false;
    if (fAgente && (e.agenteExtintor || "Sin definir") !== fAgente) return false;
    if (fEstado && (e.estadoExtintor || "Sin definir") !== fEstado) return false;
    if (fPeso && (e.peso ? `${e.peso} ${e.unidadPeso}` : "Sin definir") !== fPeso) return false;
    if (fServicio === "Mantenimiento" && e.ma !== "SI") return false;
    if (fServicio === "Prueba Hidrostatica" && e.ph !== "SI") return false;
    if (fServicio === "Recarga" && !e.recarga) return false;
    if (fComponente && (e as any)[fComponente] !== "SI") return false;
    return true;
  });

  // Lógica de ordenamiento personalizado por peso
  // Lógica de ordenamiento múltiple (Estado > Agente > Peso)
  const sortedExt = [...filteredExt].sort((a, b) => {
    // 1. Condición (Estado)
    if (customEstadoOrder.length > 0) {
      const valA = a.estadoExtintor || "Sin definir";
      const valB = b.estadoExtintor || "Sin definir";
      const idxA = customEstadoOrder.indexOf(valA);
      const idxB = customEstadoOrder.indexOf(valB);

      // Si ambos están en la lista pero son DIFERENTES, ordenamos por estado
      if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
      if (idxA !== -1 && idxB === -1) return -1;
      if (idxB !== -1 && idxA === -1) return 1;
      // Si son iguales (idxA === idxB), dejamos que pase al siguiente criterio (Agente)
    }

    // 2. Tipo (Agente Extintor)
    if (customAgenteOrder.length > 0) {
      const valA = a.agenteExtintor || "Sin definir";
      const valB = b.agenteExtintor || "Sin definir";
      const idxA = customAgenteOrder.indexOf(valA);
      const idxB = customAgenteOrder.indexOf(valB);

      if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
      if (idxA !== -1 && idxB === -1) return -1;
      if (idxB !== -1 && idxA === -1) return 1;
    }

    // 3. Capacidad (Peso)
    if (customWeightOrder.length > 0) {
      const valA = a.peso ? `${a.peso} ${a.unidadPeso}` : "Sin definir";
      const valB = b.peso ? `${b.peso} ${b.unidadPeso}` : "Sin definir";
      const idxA = customWeightOrder.indexOf(valA);
      const idxB = customWeightOrder.indexOf(valB);

      if (idxA !== -1 && idxB !== -1 && idxA !== idxB) return idxA - idxB;
      if (idxA !== -1 && idxB === -1) return -1;
      if (idxB !== -1 && idxA === -1) return 1;
    }

    // 4. Marca (Agrupado por cantidad dentro del mismo peso, de menor a mayor)
    const pA = a.peso ? `${a.peso} ${a.unidadPeso}` : "Sin definir";
    const mA = a.marca || "Sin definir";
    const pB = b.peso ? `${b.peso} ${b.unidadPeso}` : "Sin definir";
    const mB = b.marca || "Sin definir";

    const countA = marcaPesoCounts[`${pA}|${mA}`] || 0;
    const countB = marcaPesoCounts[`${pB}|${mB}`] || 0;

    // Ordenar por cantidad (ascendente: los de menor cantidad primero)
    if (countA !== countB) return countA - countB;

    // Desempate: Si tienen exactamente la misma cantidad, ordenar alfabéticamente por marca
    if (mA !== mB) return mA.localeCompare(mB, "es");

    // 5. Último criterio: Alfabetización ascendente por N° Serie
    const serieA = (a.nSerie || "").trim().toUpperCase();
    const serieB = (b.nSerie || "").trim().toUpperCase();
    if (serieA !== serieB) return serieA.localeCompare(serieB, "es");

    // 6. Si la serie es igual, desempatar por N° Interno
    const internoA = (a.nInterno || "").trim().toUpperCase();
    const internoB = (b.nInterno || "").trim().toUpperCase();
    if (internoA !== internoB) return internoA.localeCompare(internoB, "es");

    return 0;
  });

  const totalExtintores = extintores.length;
  const hasFilters = !!(fMarca || fAgente || fEstado || fServicio || fComponente);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-red-500/30"
      style={{ fontFamily: "'Instrument Sans', 'SF Pro Display', system-ui, sans-serif" }}>

      {/* ════ HEADER GLOBAL ════ */}
      <header className="sticky top-0 z-30 backdrop-blur-2xl bg-zinc-950/80 border-b border-zinc-800/60 shadow-sm">
        <div className="max-w-480 mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Izquierda: Logo + Back */}
          <div className="flex items-center gap-4">
            {view === "detail" && (
              <button onClick={goBack}
                className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 flex items-center justify-center transition-all text-zinc-400 hover:text-white shadow-sm hover:shadow-md active:scale-95"
                title="Volver al directorio">
                ‹
              </button>
            )}
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-[3px] text-white leading-none">FAMA</h1>
                <p className="text-[9px] font-bold tracking-[4px] uppercase text-red-500 mt-0.5">Dashboard</p>
              </div>
              <div className="h-7 w-px bg-zinc-800 mx-1 sm:mx-2 hidden sm:block" />
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
                <span className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-zinc-600"}`} />
                <span className="text-[11px] text-zinc-400 font-semibold tracking-wide">
                  {connected ? "En línea" : "Desconectado"}
                </span>
              </div>
            </div>
          </div>

          {/* Derecha: Usuario + Navegación */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-2 mr-2">
              {user.role === "boss" && (
                <button onClick={openUsersModal}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-2">
                  👥 Usuarios
                </button>
              )}

              {/* NUEVO BOTÓN: Catálogos */}
              {(user.role === "boss" || user.role === "admin") && (
                <button onClick={() => setCatalogModal(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-2">
                  📖 Catálogos
                </button>
              )}

              {(user.role === "boss" || user.role === "admin") && (
                <button onClick={openArchivedView}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all flex items-center gap-2">
                  🗂️ Archivados
                </button>
              )}
              <a href="/app"
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-white bg-red-950/20 hover:bg-red-900/40 border border-red-900/30 hover:border-red-800/50 transition-all flex items-center gap-2">
                🧯 Ir a App Móvil
              </a>
            </div>

            <div className="h-7 w-px bg-zinc-800 mx-1 hidden sm:block" />

            <div className="flex items-center gap-3 pl-1 sm:pl-0">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-zinc-200 leading-none">{user.displayName}</p>
                <p className="text-[10px] font-black uppercase tracking-widest mt-1 leading-none" style={{
                  color: user.role === "boss" ? "#f87171" : "#fbbf24"
                }}>{user.role}</p>
              </div>
              <button onClick={onLogout}
                className="w-9 h-9 rounded-xl bg-zinc-900 hover:bg-red-950/50 border border-zinc-800 hover:border-red-900/50 flex items-center justify-center text-zinc-400 hover:text-red-400 transition-all text-sm active:scale-95 shadow-sm"
                title="Cerrar sesión">
                ⏻
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-480 mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ══════════════════════════════════
            VISTA: LISTA DE EMPRESAS
            ══════════════════════════════════ */}
        {view === "list" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Cabecera y Filtros */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800/50">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
                <div className="relative flex-1 min-w-60 max-w-md">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">🔍</span>
                  <input
                    type="text"
                    placeholder="Buscar empresa por nombre..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/20 transition-all shadow-inner"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={fMonth}
                    onChange={(e) => setFMonth(e.target.value)}
                    className={`flex-1 sm:flex-none rounded-xl px-3.5 py-2.5 text-sm font-bold border transition-all bg-zinc-950 focus:outline-none focus:ring-2 cursor-pointer ${fMonth ? "border-red-600 text-red-400 focus:ring-red-600/20" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                  >
                    <option value="">Mes: Todos</option>
                    {MESES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                  <select
                    value={fYear}
                    onChange={(e) => setFYear(e.target.value)}
                    className={`flex-1 sm:flex-none rounded-xl px-3.5 py-2.5 text-sm font-bold border transition-all bg-zinc-950 focus:outline-none focus:ring-2 cursor-pointer ${fYear ? "border-red-600 text-red-400 focus:ring-red-600/20" : "border-zinc-800 text-zinc-400 hover:border-zinc-600"}`}
                  >
                    <option value="">Año: Todos</option>
                    {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>

                {(search || fMonth || fYear) && (
                  <button
                    onClick={() => { setSearch(""); setFMonth(""); setFYear(""); }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/30 border border-red-900/50 hover:bg-red-900/50 transition-all"
                  >
                    Limpiar Filtros
                  </button>
                )}
              </div>

              <button
                onClick={openCreateEmpresa}
                className="w-full md:w-auto px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white shadow-[0_0_20px_rgba(220,38,38,0.2)] transition-all hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(220,38,38,0.3)] active:scale-95 shrink-0 flex items-center justify-center gap-2"
              >
                <span className="text-lg leading-none">+</span> Nueva Empresa
              </button>
            </div>

            {/* Grid de Empresas */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-24 text-zinc-500 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800 mt-4">
                <span className="text-6xl drop-shadow-md">🏢</span>
                <p className="text-base font-medium">
                  {search ? "No se encontraron resultados para tu búsqueda." : "Aún no hay empresas registradas en el sistema."}
                </p>
                {!search && (
                  <button onClick={openCreateEmpresa} className="mt-2 text-sm font-bold text-red-400 hover:text-red-300 underline decoration-dotted underline-offset-4 transition-colors">
                    Comenzar creando la primera
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="text-sm font-bold text-zinc-500 mb-4 px-1">{filtered.length} Empresas encontradas</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  {filtered.map((emp) => (
                    <button
                      key={emp.id}
                      onClick={() => openEmpresa(emp)}
                      className="group flex flex-col text-left bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-800/60 hover:border-zinc-600 rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-red-950/50 flex items-center justify-center text-lg shrink-0 transition-colors">
                            🏢
                          </div>
                          <p className="font-black text-zinc-200 text-base truncate group-hover:text-white transition-colors">
                            {emp.razonSocial}
                          </p>
                        </div>
                        <span className="text-zinc-600 group-hover:text-red-400 text-xl transition-all transform group-hover:translate-x-1 shrink-0">→</span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs w-full bg-zinc-950/30 p-3 rounded-xl border border-zinc-800/30">
                        <span className="text-zinc-500 font-medium">RUC</span>
                        <span className="text-zinc-300 font-semibold text-right truncate">{emp.ruc || "—"}</span>
                        <span className="text-zinc-500 font-medium">Distrito</span>
                        <span className="text-zinc-300 font-semibold text-right truncate">{emp.distrito || "—"}</span>
                        <span className="text-zinc-500 font-medium">Solicitante</span>
                        <span className="text-zinc-300 font-semibold text-right truncate">{emp.nombresApellidos || "—"}</span>
                      </div>

                      <div className="flex items-center gap-3 mt-4 pt-3 border-t border-zinc-800/60 text-[11px] font-medium w-full">
                        <div className="flex-1 bg-emerald-950/20 text-emerald-400/80 px-2.5 py-1.5 rounded-lg border border-emerald-900/20">
                          <span className="text-emerald-500/50 mr-1">R:</span>
                          {emp.fechaRetiro ? emp.fechaRetiro.split("-").reverse().join("/") : "—"}
                        </div>
                        <div className="flex-1 text-right bg-blue-950/20 text-blue-400/80 px-2.5 py-1.5 rounded-lg border border-blue-900/20">
                          <span className="text-blue-500/50 mr-1">E:</span>
                          {emp.fechaEntrega ? emp.fechaEntrega.split("-").reverse().join("/") : "—"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════
            VISTA: DETALLE DE EMPRESA
            ══════════════════════════════════ */}
        {view === "detail" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {loadingDetail || !selectedEmpresa ? (
              <div className="flex flex-col items-center justify-center gap-4 py-32 text-zinc-500">
                <div className="w-10 h-10 border-4 border-zinc-800 border-t-red-500 rounded-full animate-spin" />
                <p className="text-sm font-semibold">Cargando información del cliente...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {/* ── Info de la empresa ── */}
                <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl overflow-hidden shadow-lg">
                  {/* Encabezado */}
                  <div className="px-6 py-6 border-b border-zinc-800/60 flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-linear-to-r from-zinc-900/80 to-transparent">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                        {selectedEmpresa.razonSocial}
                      </h2>
                      <p className="text-sm text-zinc-400 font-medium mt-1">Directorio de Clientes · FAMA Extintores</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-1.5 p-1.5 bg-zinc-950/50 rounded-xl border border-zinc-800/50 shadow-inner">
                        <button onClick={openEditEmpresa} className="px-3.5 py-2 rounded-lg hover:bg-zinc-800 text-sm font-bold text-zinc-400 hover:text-white transition-all" title="Editar datos">
                          ✏️ Editar
                        </button>
                        <button onClick={() => { setDuplicateWithExt(false); setDuplicateModal(true); }} className="px-3.5 py-2 rounded-lg hover:bg-zinc-800 text-sm font-bold text-zinc-400 hover:text-white transition-all" title="Crear una copia">
                          📋 Duplicar
                        </button>
                        {(user.role === "admin" || user.role === "boss") && (
                          <button onClick={() => { setDeleteConfirmText(""); setDeleteModal(true); }} className="px-3.5 py-2 rounded-lg hover:bg-red-950/60 text-sm font-bold text-zinc-400 hover:text-red-400 transition-all" title="Mover a archivados">
                            🗑️ Archivar
                          </button>
                        )}
                      </div>

                      <div className="hidden sm:block w-px h-8 bg-zinc-800/80 mx-1" />

                      <button onClick={exportExcel} disabled={exporting} className="px-4 py-2.5 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/40 text-sm font-bold text-emerald-400 border border-emerald-800/50 transition-all flex items-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-900/20 active:scale-95">
                        {exporting ? "⏳ Generando..." : "📥 Exportar Excel"}
                      </button>

                      {selectedEmpresa.celular && (
                        <button onClick={openWhatsappModal} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(52,211,153,0.2)] hover:shadow-[0_0_20px_rgba(52,211,153,0.3)] hover:-translate-y-0.5 active:scale-95">
                          📲 Enviar por WhatsApp
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Datos en grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-800/60 bg-zinc-900/20">
                    <InfoSection title="🏢 Empresa">
                      <InfoRow label="Dirección" value={selectedEmpresa.direccion} />
                      <InfoRow label="Distrito" value={selectedEmpresa.distrito} />
                      <InfoRow label="RUC" value={selectedEmpresa.ruc} />
                    </InfoSection>
                    <InfoSection title="👤 Solicitante">
                      <InfoRow label="Nombre" value={selectedEmpresa.nombresApellidos} />
                      <InfoRow label="Celular" value={selectedEmpresa.celular} />
                      <InfoRow label="Orden de Trabajo" value={selectedEmpresa.nOrdenTrabajo} />
                    </InfoSection>
                    <InfoSection title="📅 Fechas de Servicio">
                      <InfoRow label="Retiro de Extintores" value={selectedEmpresa.fechaRetiro ? selectedEmpresa.fechaRetiro.split("-").reverse().join("/") : ""} />
                      <InfoRow label="Entrega Programada" value={selectedEmpresa.fechaEntrega ? selectedEmpresa.fechaEntrega.split("-").reverse().join("/") : ""} />
                    </InfoSection>
                  </div>
                </div>

                {/* ── Métricas ── */}
                <div className="flex flex-col gap-4 bg-zinc-900/20 p-5 rounded-3xl border border-zinc-800/40">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      📊 Panel de Métricas
                    </h3>
                    <button
                      onClick={() => setShowMetrics((p) => !p)}
                      className="px-4 py-1.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center gap-1.5"
                    >
                      {showMetrics ? "Ocultar" : "Mostrar Detalles"} <span className="text-[10px]">{showMetrics ? "▲" : "▼"}</span>
                    </button>
                  </div>

                  {showMetrics && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <MetricPanel title="Estado de Extintores" data={estadoCounts} total={totalExtintores} accent />
                        <MetricPanel title="Inventario por Marca" data={marcaCounts} total={totalExtintores} />
                        <MetricPanel title="Tipo de Agente" data={agenteCounts} total={totalExtintores} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <MetricPanel title="Capacidad / Peso" data={pesoEntriesWithAgents} total={totalExtintores} />
                        <MetricPanel title="Servicios Aplicados" data={Object.entries(serviceCounts)} total={totalExtintores} />
                        <MetricPanel title="Componentes Reemplazados" data={Object.entries(compCounts).map(([k, v]) => [COMP_LABELS[k] || k, v] as [string, number])} total={totalExtintores} />
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Tabla de extintores ── */}
                <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl overflow-hidden shadow-xl">
                  <div className="px-6 py-5 border-b border-zinc-800/60 bg-zinc-950/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                      <h3 className="text-xl font-black text-white flex items-center gap-3">
                        🧯 Extintores Registrados
                        <span className="px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300">
                          {hasFilters ? `${filteredExt.length} filtrados de ${totalExtintores}` : `Total: ${totalExtintores}`}
                        </span>
                      </h3>
                      <button
                        onClick={openAddExtintor}
                        className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-sm font-bold text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.2)] hover:shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                      >
                        <span className="text-lg leading-none">+</span> Agregar Extintor
                      </button>
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-3 items-center bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800/50">
                      <span className="text-xs font-bold text-zinc-500 ml-1 mr-2 uppercase tracking-wider hidden lg:block">Filtros:</span>
                      <FilterSelect label="Marca" value={fMarca} onChange={setFMarca} options={marcaCounts.map(([v]) => v)} />
                      <FilterSelect label="Agente" value={fAgente} onChange={setFAgente} options={agenteCounts.map(([v]) => v)} />
                      <FilterSelect label="Estado" value={fEstado} onChange={setFEstado} options={estadoCounts.map(([v]) => v)} />
                      <FilterSelect
                        label="Peso"
                        value={fPeso}
                        onChange={setFPeso}
                        options={Object.keys(pesoCounts)}
                      />
                      <FilterSelect label="Servicio" value={fServicio} onChange={setFServicio} options={["Mantenimiento", "Recarga", "Prueba Hidrostatica"]} />
                      <FilterSelect label="Comp. Nuevo" value={fComponente} onChange={setFComponente}
                        options={[
                          { value: "valvula", label: "Válvula" },
                          { value: "manguera", label: "Manguera" },
                          { value: "manometro", label: "Manómetro" },
                          { value: "tobera", label: "Tobera" },
                        ]} />
                      {hasFilters && (
                        <button
                          onClick={() => {
                            setFMarca(""); setFAgente(""); setFEstado("");
                            setFServicio(""); setFComponente(""); setFPeso("");
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-red-300 bg-red-950/20 border border-red-900/30 hover:bg-red-900/40 transition-all ml-auto sm:ml-0"
                        >
                          Limpiar
                        </button>
                      )}
                      <div className="flex gap-2 ml-auto sm:ml-0 flex-wrap">
                        <button
                          onClick={() => setEstadoOrderModal(true)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                        >
                          <span className="text-sm">📌</span>
                          {customEstadoOrder.length > 0 ? `Estado (${customEstadoOrder.length})` : "Ord. Estado"}
                        </button>
                        <button
                          onClick={() => setAgenteOrderModal(true)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                        >
                          <span className="text-sm">🧯</span>
                          {customAgenteOrder.length > 0 ? `Tipo (${customAgenteOrder.length})` : "Ord. Tipo"}
                        </button>
                        <button
                          onClick={() => setWeightOrderModal(true)}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 transition-all flex items-center gap-1.5"
                        >
                          <span className="text-sm">⚖️</span>
                          {customWeightOrder.length > 0 ? `Peso (${customWeightOrder.length})` : "Ord. Pesos"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {filteredExt.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 py-20 text-zinc-500 bg-zinc-950/20">
                      <span className="text-6xl drop-shadow-md opacity-80">🧯</span>
                      <p className="text-base font-medium">{hasFilters ? "No hay extintores que coincidan con los filtros aplicados." : "Aún no se han registrado extintores para esta empresa."}</p>
                      {!hasFilters && (
                        <button onClick={openAddExtintor} className="mt-2 text-sm font-bold text-red-400 hover:text-red-300 underline decoration-dotted underline-offset-4 transition-colors">
                          Registrar el primero
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[65vh] relative scroll-smooth rounded-b-3xl">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-zinc-400 bg-zinc-950 backdrop-blur-md">
                            <th className="px-5 py-4 border-b border-zinc-800">#</th>
                            <th className="px-5 py-4 border-b border-zinc-800">N° Serie</th>
                            <th className="px-5 py-4 border-b border-zinc-800">N° Interno</th>
                            <th className="px-5 py-4 border-b border-zinc-800">Marca</th>
                            <th className="px-5 py-4 border-b border-zinc-800">Agente</th>
                            <th className="px-5 py-4 border-b border-zinc-800">Peso</th>
                            <th className="px-5 py-4 border-b border-zinc-800">Estado</th>
                            <th className="px-5 py-4 border-b border-zinc-800">Fab.</th>
                            <th className="px-5 py-4 border-b border-zinc-800" title="Prueba Hidrostática Realizada">PH Realiz.</th>
                            <th className="px-5 py-4 border-b border-zinc-800" title="Prueba Hidrostática Vencimiento">PH Venc.</th>
                            <th className="px-5 py-4 border-b border-zinc-800">Servicio</th>
                            <th className="px-5 py-4 border-b border-zinc-800 min-w-35">Comp. Nuevos</th>
                            <th className="px-5 py-4 border-b border-zinc-800">Serv. Extra</th>
                            <th className="px-5 py-4 border-b border-zinc-800">Motivo Baja</th>
                            <th className="px-5 py-4 border-b border-zinc-800 max-w-50">Observaciones</th>
                            <th className="px-5 py-4 border-b border-zinc-800 text-center sticky right-0 bg-zinc-950 backdrop-blur-md">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/40">
                          {sortedExt.map((ext, i) => {
                            const badges = serviceBadge(ext.ma, ext.recarga, ext.ph);
                            return (
                              <tr
                                key={ext.rowIndex}
                                className={`hover:bg-zinc-800/40 transition-colors group ${i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/20"}`}
                              >
                                <td className="px-5 py-3.5 text-red-500 font-black">
                                  {i + 1}
                                </td>
                                <td className={`px-5 py-3.5 transition-colors ${ext.nSerie && duplicateSeries.has(ext.nSerie.trim()) ? "bg-yellow-500/20" : ""}`}>
                                  <span className={`font-bold ${ext.nSerie && duplicateSeries.has(ext.nSerie.trim()) ? "text-yellow-400" : "text-zinc-100"}`} title={ext.nSerie && duplicateSeries.has(ext.nSerie.trim()) ? "⚠️ Número de Serie duplicado en el inventario" : ""}>
                                    {ext.nSerie || "—"}
                                  </span>
                                </td>
                                <td className={`px-5 py-3.5 transition-colors ${ext.nInterno && duplicateInternos.has(ext.nInterno.trim()) ? "bg-yellow-500/20" : ""}`}>
                                  <span className={`font-medium ${ext.nInterno && duplicateInternos.has(ext.nInterno.trim()) ? "text-yellow-400" : "text-zinc-400"}`} title={ext.nInterno && duplicateInternos.has(ext.nInterno.trim()) ? "⚠️ Número Interno duplicado en el inventario" : ""}>
                                    {ext.nInterno || "—"}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 font-medium text-zinc-300">
                                  {ext.marca || "—"}
                                </td>
                                <td className="px-5 py-3.5 font-medium text-zinc-300">
                                  {ext.agenteExtintor || "—"}
                                </td>
                                <td className="px-5 py-3.5 font-bold text-zinc-300 whitespace-nowrap">
                                  {ext.peso ? `${ext.peso} ${ext.unidadPeso}` : "—"}
                                </td>
                                <td className="px-5 py-3.5">
                                  <span
                                    className={`inline-block px-3 py-1 rounded-lg text-[11px] font-bold border shadow-sm ${estadoColor[ext.estadoExtintor] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                                  >
                                    {ext.estadoExtintor || "—"}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 font-medium text-zinc-400 text-xs">
                                  {ext.fechaFabricacion || "—"}
                                </td>
                                <td className="px-5 py-3.5 font-medium text-zinc-400 text-xs">
                                  {ext.realizadoPH || "—"}
                                </td>
                                <td className="px-5 py-3.5 font-bold text-zinc-300 text-xs">
                                  {ext.vencimPH || "—"}
                                </td>
                                <td className="px-5 py-3.5">
                                  <div className="flex gap-1.5 flex-wrap">
                                    {badges.length > 0
                                      ? badges.map((b) => (
                                        <span
                                          key={b.label}
                                          className={`px-2.5 py-1 rounded-md text-[10px] font-black border shadow-sm ${b.cls}`}
                                        >
                                          {b.label}
                                        </span>
                                      ))
                                      : <span className="text-zinc-600 font-medium">—</span>}
                                  </div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <ComponentDots ext={ext} />
                                </td>
                                <td className="px-5 py-3.5">
                                  {ext.servicioExtra ? (
                                    <div className="flex flex-wrap gap-1">
                                      {ext.servicioExtra.split(",").map(s => s.trim()).filter(Boolean).map(s => (
                                        <span key={s} className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-900/40 text-amber-400 border border-amber-800 shadow-sm whitespace-nowrap">
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-zinc-600 font-medium">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5">
                                  {ext.motivoBaja ? (
                                    <div className="flex flex-wrap gap-1">
                                      {ext.motivoBaja.split(",").map(m => m.trim()).filter(Boolean).map(m => (
                                        <span key={m} className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-900/40 text-red-400 border border-red-800 shadow-sm whitespace-nowrap">
                                          {m}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-zinc-600 font-medium">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-xs max-w-50">
                                  {ext.observaciones ? (
                                    <button
                                      onClick={() => setObsModal(ext.observaciones)}
                                      className="text-left truncate block text-zinc-400 hover:text-zinc-100 transition-colors underline decoration-dotted underline-offset-4 cursor-pointer w-full font-medium"
                                      title="Ver observación completa"
                                    >
                                      {ext.observaciones}
                                    </button>
                                  ) : (
                                    <span className="text-zinc-600 font-medium">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 sticky right-0 bg-zinc-950/80 backdrop-blur-md group-hover:bg-zinc-800/90 transition-colors border-l border-zinc-800/40">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {ext.evidencia === "__HAS_EVIDENCIA__" && (
                                      <button
                                        onClick={() => openEvidencia(ext)}
                                        className="w-8 h-8 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/80 text-sm flex items-center justify-center border border-emerald-800/50 hover:border-emerald-600 transition-all hover:shadow-md hover:shadow-emerald-900/20 relative"
                                        title={`Ver ${ext.evidenciaCount || 1} foto(s)`}
                                      >
                                        📷
                                        {(ext.evidenciaCount || 0) > 1 && (
                                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center">{ext.evidenciaCount}</span>
                                        )}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => openEditExtintor(ext)}
                                      className="w-8 h-8 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-sm flex items-center justify-center border border-zinc-700 transition-all hover:shadow-md"
                                      title="Editar Extintor"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => deleteExtintor(ext.rowIndex)}
                                      className="w-8 h-8 rounded-xl bg-zinc-800/80 hover:bg-red-900/80 text-sm flex items-center justify-center border border-zinc-700 hover:border-red-700/80 transition-all hover:shadow-md"
                                      title="Eliminar Extintor"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="h-12" />
              </div>
            )}
          </div>
        )}

        {/* ════ MODALES EXTRAÍDOS ════ */}
        {editingEmpresa && empresaForm && (
          <EmpresaModal title="✏️ Editar Empresa" form={empresaForm} setForm={setEmpresaForm} onClose={() => setEditingEmpresa(false)} onSave={saveEmpresa} saving={saving} />
        )}
        {createEmpresaModal && empresaForm && (
          <EmpresaModal title="🏢 Nueva Empresa" form={empresaForm} setForm={setEmpresaForm} onClose={() => setCreateEmpresaModal(false)} onSave={saveNewEmpresa} saving={saving} />
        )}
        {extintorModal && (
          <ExtintorModal form={extintorForm} setForm={setExtintorForm} isEditing={editingRowIndex !== null} onClose={() => setExtintorModal(false)} onSave={saveExtintor} saving={saving} marcas={MARCAS} agentes={AGENTES} recargas={RECARGAS} motivosBaja={MOTIVOS_BAJA} serviciosExtra={SERVICIOS_EXTRA} socket={socket} userRole={user.role} />
        )}
        <UsersModal isOpen={usersModal} onClose={() => setUsersModal(false)} usersList={usersList} userForm={userForm} setUserForm={setUserForm} editingUserId={editingUserId} setEditingUserId={setEditingUserId} savingUser={savingUser} userError={userError} onSave={saveUser} onDelete={deleteUser} />
        <ArchivedModal isOpen={archivedView} onClose={() => setArchivedView(false)} tab={archivedTab} setTab={setArchivedTab} empresas={archivedEmpresas} extintores={archivedExtintores} loading={loadingArchived} expanded={expandedArchived} setExpanded={setExpandedArchived} onRestoreEmpresa={restoreEmpresa} onHardDeleteEmpresa={hardDeleteEmpresa} onRestoreExtintor={restoreExtintor} onHardDeleteExtintor={hardDeleteExtintor} userRole={user.role} />

        {selectedEmpresa && (
          <WhatsappModal isOpen={whatsappModal} onClose={() => setWhatsappModal(false)} empresa={selectedEmpresa} format={whatsappFormat} setFormat={setWhatsappFormat} msg={whatsappMsg} setMsg={setWhatsappMsg} exporting={exporting} onExecute={executeWhatsapp} />
        )}
        {selectedEmpresa && (
          <DuplicateModal isOpen={duplicateModal} onClose={() => setDuplicateModal(false)} empresaName={selectedEmpresa.razonSocial} duplicateWithExt={duplicateWithExt} setDuplicateWithExt={setDuplicateWithExt} onDuplicate={duplicateEmpresa} saving={saving} />
        )}
        <ArchiveModal isOpen={deleteModal} onClose={() => setDeleteModal(false)} onArchive={handleDeleteEmpresa} saving={saving} />
        <ObservationModal observation={obsModal} onClose={() => setObsModal(null)} />
        <CatalogModal
          isOpen={catalogModal}
          onClose={() => setCatalogModal(false)}
          catalogs={catalogs}
          socket={socket}
          userRole={user.role}
        />
        <WeightSortModal
          isOpen={estadoOrderModal}
          onClose={() => setEstadoOrderModal(false)}
          availableWeights={estadoCounts.map(([v]) => v)} // Usamos estadoCounts
          currentOrder={customEstadoOrder}
          onSave={(newOrder) => { setCustomEstadoOrder(newOrder); setEstadoOrderModal(false); }}
        />
        <WeightSortModal
          isOpen={agenteOrderModal}
          onClose={() => setAgenteOrderModal(false)}
          availableWeights={agenteCounts.map(([v]) => v)} // Usamos agenteCounts
          currentOrder={customAgenteOrder}
          onSave={(newOrder) => { setCustomAgenteOrder(newOrder); setAgenteOrderModal(false); }}
        />
        <WeightSortModal
          isOpen={weightOrderModal}
          onClose={() => setWeightOrderModal(false)}
          availableWeights={Object.keys(pesoCounts)}
          currentOrder={customWeightOrder}
          onSave={(newOrder) => { setCustomWeightOrder(newOrder); setWeightOrderModal(false); }}
        />

        {/* ════ MODAL: EVIDENCIA FOTOGRÁFICA (MÚLTIPLE) ════ */}
        {evidenciaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/50">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  📷 Evidencia Fotográfica
                  {evidenciaList.length > 1 && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300">
                      {evidenciaActiveIdx + 1} / {evidenciaList.length}
                    </span>
                  )}
                </h3>
                <button onClick={() => { setEvidenciaModal(false); setEvidenciaList([]); }} className="w-8 h-8 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-4 min-h-0">
                {evidenciaLoading ? (
                  <div className="flex flex-col items-center justify-center gap-4 py-16 text-zinc-500">
                    <div className="w-10 h-10 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-sm font-semibold">Cargando imágenes...</p>
                  </div>
                ) : evidenciaList.length > 0 ? (
                  <>
                    {/* Imagen principal */}
                    <div className="rounded-2xl overflow-hidden border border-zinc-700 bg-zinc-950/50 shadow-lg w-full relative">
                      <img
                        src={`data:image/jpeg;base64,${evidenciaList[evidenciaActiveIdx]}`}
                        alt={`Evidencia ${evidenciaActiveIdx + 1}`}
                        className="w-full object-contain max-h-[50vh]"
                      />
                      {/* Flechas de navegación */}
                      {evidenciaList.length > 1 && (
                        <>
                          <button
                            onClick={() => setEvidenciaActiveIdx(i => Math.max(0, i - 1))}
                            disabled={evidenciaActiveIdx === 0}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white text-lg flex items-center justify-center disabled:opacity-30 transition-all active:scale-95"
                          >
                            ‹
                          </button>
                          <button
                            onClick={() => setEvidenciaActiveIdx(i => Math.min(evidenciaList.length - 1, i + 1))}
                            disabled={evidenciaActiveIdx === evidenciaList.length - 1}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white text-lg flex items-center justify-center disabled:opacity-30 transition-all active:scale-95"
                          >
                            ›
                          </button>
                        </>
                      )}
                    </div>

                    {/* Thumbnails (si hay más de 1) */}
                    {evidenciaList.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto w-full py-1 scrollbar-hide">
                        {evidenciaList.map((b64, idx) => (
                          <button
                            key={idx}
                            onClick={() => setEvidenciaActiveIdx(idx)}
                            className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all active:scale-95 ${idx === evidenciaActiveIdx ? "border-emerald-500 shadow-lg shadow-emerald-900/30 ring-2 ring-emerald-500/30" : "border-zinc-700 hover:border-zinc-500 opacity-60 hover:opacity-100"}`}
                          >
                            <img src={`data:image/jpeg;base64,${b64}`} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Botones de descarga */}
                    <div className="flex gap-3 w-full">
                      <button
                        onClick={() => downloadEvidenciaAsPng(evidenciaList[evidenciaActiveIdx], `Evidencia_${evidenciaExtInfo}_${evidenciaActiveIdx + 1}`)}
                        className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 hover:-translate-y-0.5 active:scale-95"
                      >
                        📥 Descargar esta foto (PNG)
                      </button>
                      {evidenciaList.length > 1 && (
                        <button
                          onClick={() => evidenciaList.forEach((b64, i) => setTimeout(() => downloadEvidenciaAsPng(b64, `Evidencia_${evidenciaExtInfo}_${i + 1}`), i * 500))}
                          className="py-3 px-5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-bold text-zinc-300 hover:text-white border border-zinc-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          📦 Todas ({evidenciaList.length})
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500">
                    <span className="text-5xl">🚫</span>
                    <p className="text-sm font-semibold">No se pudo cargar las imágenes</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}