import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "./hooks/useSocket";
import { compressImage } from "./utils/helpers";

type UserData = { id: string; username: string; role: string; displayName: string };

export default function InspeccionPage({ user }: { user: UserData }) {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [data, setData] = useState<any>(null);
  const [observaciones, setObservaciones] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<"ok" | null>(null);

  useEffect(() => {
    if (!socket || !uid) return;
    socket.emit("inspeccion:extintorPorUid", { uid }, (res: any) => setData(res));
  }, [socket, uid]);

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setFotos((prev) => [...prev, compressed]);
    e.target.value = "";
  };

  const registrar = (estado: "ok" | "problema") => {
    if (!socket || !uid || !data?.extintor) return;
    setEnviando(true);
    socket.emit("inspeccion:registrar", {
      extintorUid: uid,
      sedeId: data.extintor.sedeId,
      empresaId: data.extintor.empresaId,
      workerId: user.id,
      workerNombre: user.displayName,
      estado,
      observaciones,
      evidencia: JSON.stringify(fotos),
    }, (res: any) => {
      setEnviando(false);
      if (res?.success) setResultado("ok");
      else alert(res?.error || "No se pudo registrar la inspección");
    });
  };

  if (!data) return <div className="min-h-dvh flex items-center justify-center text-zinc-400">Cargando...</div>;
  if (!data.success) return <div className="min-h-dvh flex items-center justify-center text-zinc-500">Extintor no encontrado.</div>;
  if (!data.sedeHabilitada) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-2 p-6 text-center">
        <span className="text-4xl">🚫</span>
        <p className="text-zinc-600 font-bold">Esta sede no está habilitada para inspección.</p>
        <p className="text-xs text-zinc-400">Pídele al Administrador que la habilite desde el Dashboard.</p>
      </div>
    );
  }

  if (resultado === "ok") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="text-5xl">✅</span>
        <p className="font-bold text-zinc-700">Inspección registrada.</p>
        <button onClick={() => navigate("/app")} className="text-sm text-blue-600 font-bold underline">Ir a Workers</button>
      </div>
    );
  }

  const ext = data.extintor;

  return (
    <div className="min-h-dvh flex flex-col gap-5 p-6 max-w-md mx-auto">
      <h1 className="text-lg font-black text-zinc-800">🔍 Inspección</h1>

      <div className="bg-white border border-zinc-200 rounded-2xl p-4 flex flex-col gap-1 text-sm">
        <p><b>Serie:</b> {ext.nSerie || "S/N"}</p>
        <p><b>Marca:</b> {ext.marca || "—"}</p>
        <p><b>Agente:</b> {ext.agenteExtintor || "—"}</p>
        <p><b>Peso:</b> {ext.peso ? `${ext.peso} ${ext.unidadPeso}` : "—"}</p>
        <p><b>Estado:</b> {ext.estadoExtintor || "—"}</p>
        <p><b>Sede:</b> {data.sede?.nombre}</p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-zinc-500">Observaciones</label>
        <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} className="border-2 border-zinc-200 rounded-xl px-3 py-2 text-sm" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold text-zinc-500">Fotografías ({fotos.length})</label>
        <input type="file" accept="image/*" onChange={handleFoto} />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <button onClick={() => registrar("ok")} disabled={enviando} className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50">
          ✅ Inspeccionado OK
        </button>
        <button onClick={() => registrar("problema")} disabled={enviando} className="py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold disabled:opacity-50">
          ⚠️ Problema / Taller
        </button>
      </div>
    </div>
  );
}