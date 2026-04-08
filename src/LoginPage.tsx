import { useState } from "react";
import { io } from "socket.io-client";

const BACKEND = import.meta.env.VITE_BACKEND_URL
  || (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : "");

type UserRole = "worker" | "admin" | "boss";
type UserData = { id: string; username: string; role: UserRole; displayName: string };

export default function LoginPage({ onLogin }: { onLogin: (user: UserData) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    if (!username || !password) return;
    setLoading(true);
    setError("");

    const s = io(BACKEND);
    s.on("connect", () => {
      s.emit("auth:login", { username, password }, (res: any) => {
        setLoading(false);
        s.disconnect();
        if (res?.success) {
          localStorage.setItem("fama_user", JSON.stringify(res.user));
          onLogin(res.user);
        } else {
          setError(res?.error || "Error de autenticación");
        }
      });
    });
    s.on("connect_error", () => {
      setLoading(false);
      setError("No se pudo conectar al servidor");
      s.disconnect();
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-[5px] text-white">FAMA</h1>
          <p className="text-red-500 text-[10px] font-semibold tracking-[6px] uppercase mt-1">Extintores</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Usuario</label>
            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-red-600 transition-colors"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresa tu usuario"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Contraseña</label>
            <input
              type="password"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-red-600 transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs font-semibold bg-red-950/40 border border-red-900/60 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !username || !password}
            className="w-full py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-sm disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? "Verificando..." : "Ingresar"}
          </button>
        </div>
      </div>
    </div>
  );
}