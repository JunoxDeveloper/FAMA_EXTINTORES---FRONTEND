import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "./hooks/useSocket";

type UserData = { id: string; username: string; role: "worker" | "admin" | "boss"; displayName: string };

export default function ScanGatewayPage({ user }: { user: UserData }) {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [extintor, setExtintor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!socket || !uid) return;
    socket.emit("extintor:porUid", { uid }, (res: any) => {
      setExtintor(res?.success ? res.extintor : null);
      setLoading(false);
    });
  }, [socket, uid]);

  if (loading) {
    return <div className="min-h-dvh flex items-center justify-center text-zinc-400">Cargando extintor...</div>;
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 p-6 bg-zinc-50">
      <div className="text-center">
        <h1 className="text-xl font-black text-zinc-800">🧯 Extintor escaneado</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {extintor ? `${extintor.marca || "Sin marca"} · ${extintor.nSerie || "S/N"}` : "Sticker no registrado aún"}
        </p>
        <p className="text-xs text-zinc-400 mt-1">UID: {uid}</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => navigate(`/scan/${uid}/registrar`)}
          className="px-5 py-4 rounded-2xl bg-red-700 hover:bg-red-600 text-white font-bold shadow-md active:scale-95 transition-all"
        >
          📋 Registrar Extintor
        </button>
        <button
          onClick={() => navigate(`/scan/${uid}/inspeccion`)}
          disabled={!extintor}
          className="px-5 py-4 rounded-2xl bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white font-bold shadow-md active:scale-95 transition-all"
        >
          🔍 Inspección
        </button>
      </div>

      <p className="text-xs text-zinc-400">Sesión: {user.displayName} ({user.role})</p>
    </div>
  );
}