import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "./hooks/useSocket";

type UserData = { id: string; username: string; role: string; displayName: string };
const SESSION_KEY = "fama_registro_empresa_copia";

export default function RegistrarExtintorPage({ user }: { user: UserData }) {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [empresas, setEmpresas] = useState<{ id: string; razonSocial: string }[]>([]);
  const [empresaOrigenId, setEmpresaOrigenId] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<"ok" | "error" | null>(null);

  const sesionActiva = sessionStorage.getItem(SESSION_KEY); // { empresaCopiaId, workerId }

  useEffect(() => {
    if (!socket) return;
    socket.emit("empresa:list", { role: user.role });
    socket.on("empresa:list", setEmpresas);
    return () => { socket.off("empresa:list"); };
  }, [socket, user.role]);

  const registrarEnEmpresa = (empresaId: string) => {
    if (!socket || !uid) return;
    setProcesando(true);
    socket.emit("extintor:registrarPorUid", { uid, empresaId }, (res: any) => {
      setProcesando(false);
      setResultado(res?.success ? "ok" : "error");
    });
  };

  const handleConfirmar = () => {
    if (sesionActiva) {
      // Ya existe una empresa-copia activa en esta sesión de escaneo: se reutiliza
      const { empresaCopiaId } = JSON.parse(sesionActiva);
      registrarEnEmpresa(empresaCopiaId);
      return;
    }
    if (!empresaOrigenId || !socket) return;
    setProcesando(true);
    // Primer extintor de la sesión: se identifica la empresa y se crea UNA copia,
    // que quedará guardada para que los siguientes escaneos se asocien ahí solos.
    socket.emit("empresa:duplicate", { id: empresaOrigenId, includeExtintores: false }, (res: any) => {
      if (!res?.success) { setProcesando(false); setResultado("error"); return; }
      const empresaCopiaId = res.copy?.id || res.empresa?.id;
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ empresaCopiaId, workerId: user.id }));
      registrarEnEmpresa(empresaCopiaId);
    });
  };

  if (resultado === "ok") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="text-5xl">✅</span>
        <p className="font-bold text-zinc-700">Extintor registrado correctamente.</p>
        <button onClick={() => navigate("/app")} className="text-sm text-red-600 font-bold underline">Ir a Workers</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-lg font-black text-zinc-800">📋 Registrar Extintor</h1>

      {sesionActiva ? (
        <p className="text-sm text-zinc-500 text-center max-w-xs">
          Este extintor se asociará automáticamente a la empresa que ya estás usando en esta sesión de registro.
        </p>
      ) : (
        <div className="w-full max-w-xs flex flex-col gap-2">
          <label className="text-xs font-bold text-zinc-500">¿A qué empresa pertenece?</label>
          <select value={empresaOrigenId} onChange={(e) => setEmpresaOrigenId(e.target.value)} className="border-2 border-zinc-200 rounded-xl px-3 py-2 text-sm">
            <option value="">Seleccionar...</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial}</option>)}
          </select>
          <p className="text-xs text-zinc-400">Se creará una copia de esta empresa para agrupar todo lo que registres en esta sesión.</p>
        </div>
      )}

      {resultado === "error" && <p className="text-sm text-red-600 font-bold">Ocurrió un error. Intenta de nuevo.</p>}

      <button
        onClick={handleConfirmar}
        disabled={procesando || (!sesionActiva && !empresaOrigenId)}
        className="px-6 py-3 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white font-bold"
      >
        {procesando ? "Registrando..." : "Confirmar registro"}
      </button>
    </div>
  );
}