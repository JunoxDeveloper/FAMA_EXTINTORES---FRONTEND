import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";

const BACKEND = import.meta.env.VITE_BACKEND_URL
    || (import.meta.env.DEV ? `http://${window.location.hostname}:3001` : "");

export type Catalogs = {
    marcas: { id: number; type: string; value: string }[];
    agentes: { id: number; type: string; value: string }[];
    recargas: { id: number; type: string; value: string }[];
    motivosBaja: { id: number; type: string; value: string }[];
    serviciosExtra: { id: number; type: string; value: string }[];
};

export function useSocket(userId: string, onLogout: () => void) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [catalogs, setCatalogs] = useState<Catalogs>({ marcas: [], agentes: [], recargas: [], motivosBaja: [], serviciosExtra: [] });

    useEffect(() => {
        const s = io(BACKEND);
        setSocket(s);

        s.on("connect", () => {
            setConnected(true);
            s.emit("empresa:list");
            s.emit("catalog:list", {}, (res: any) => {
                if (res?.success) setCatalogs({ marcas: res.marcas, agentes: res.agentes, recargas: res.recargas, motivosBaja: res.motivosBaja, serviciosExtra: res.serviciosExtra });
            });
            s.emit("auth:verify", { id: userId }, (res: any) => {
                if (res && res.valid === false) onLogout();
            });
        });

        s.on("disconnect", () => setConnected(false));

        s.on("auth:force_logout", (data: { userId: string }) => {
            if (data.userId === userId) onLogout();
        });

        // Actualización en tiempo real de catálogos
        s.on("catalog:updated", (data: Catalogs) => {
            setCatalogs(data);
        });

        return () => { s.disconnect(); };
    }, [userId, onLogout]);

    return { socket, connected, catalogs };
}