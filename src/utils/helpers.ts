import type { FormData, EmpresaData, Extintor } from "../types";

export const emptyForm = (): FormData => ({
    nSerie: "", nInterno: "", marca: "", fechaFabricacion: "", realizadoPH: "",
    vencimPH: "", estadoExtintor: "", agenteExtintor: "", peso: "", unidadPeso: "KG",
    ma: false, recarga: "", ph: false, valvula: "", manguera: "", manometro: "",
    tobera: "", observaciones: "", servicioExtra: "", motivoBaja: "", evidencias: [],
});

export const emptyEmpresa = (): EmpresaData => ({
    razonSocial: "", direccion: "", distrito: "", ruc: "", nombresApellidos: "",
    celular: "", nOrdenTrabajo: "", fechaRetiro: "", fechaEntrega: "",
});

export const emptyExtintor = (): Partial<Extintor> => ({
    nSerie: "", nInterno: "", marca: "", fechaFabricacion: "",
    realizadoPH: "", vencimPH: "", estadoExtintor: "", agenteExtintor: "",
    peso: "", unidadPeso: "KG", ma: "", recarga: "", ph: "",
    valvula: "", manguera: "", manometro: "", tobera: "", observaciones: "", servicioExtra: "", motivoBaja: "", 
    evidencia: "[]"
});

export const estadoColor: Record<string, string> = {
    Bueno: "bg-emerald-900/40 text-emerald-400 border-emerald-800",
    Regular: "bg-amber-900/40 text-amber-400 border-amber-800",
    Malo: "bg-red-900/40 text-red-400 border-red-800",
    Inoperativo: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

export const serviceBadge = (ma: string, recarga: string, ph: string) => {
    const badges: { label: string; cls: string }[] = [];
    if (ma === "SI") badges.push({ label: "MA", cls: "bg-red-900/40 text-red-400 border-red-800" });
    if (recarga) badges.push({ label: `RE: ${recarga}`, cls: "bg-amber-900/40 text-amber-400 border-amber-800" });
    if (ph === "SI") badges.push({ label: "PH", cls: "bg-blue-900/40 text-blue-400 border-blue-800" });
    return badges;
};

export const downloadBase64 = (b64: string, fileName: string, mimeType: string) => {
    const byteChars = atob(b64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * Comprime una imagen capturada de la cámara a JPEG de baja calidad/tamaño.
 * Devuelve un base64 string (sin el prefijo data:image/...).
 * maxWidth controla la resolución máxima. quality controla la calidad JPEG (0-1).
 */
export const compressImage = (
    file: File | Blob,
    maxWidth = 800,
    quality = 0.5
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let w = img.width;
                let h = img.height;

                if (w > maxWidth) {
                    h = Math.round((h * maxWidth) / w);
                    w = maxWidth;
                }

                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                if (!ctx) return reject(new Error("No canvas context"));
                ctx.drawImage(img, 0, 0, w, h);

                // Obtener JPEG comprimido como base64
                const dataUrl = canvas.toDataURL("image/jpeg", quality);
                // Quitar el prefijo "data:image/jpeg;base64,"
                const b64 = dataUrl.split(",")[1];
                resolve(b64);
            };
            img.onerror = () => reject(new Error("Error cargando imagen"));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error("Error leyendo archivo"));
        reader.readAsDataURL(file);
    });
};

/**
 * Convierte un base64 JPEG comprimido a PNG para descarga de alta calidad.
 */
export const downloadEvidenciaAsPng = (b64Jpeg: string, fileName: string) => {
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName.endsWith(".png") ? fileName : `${fileName}.png`;
            a.click();
            URL.revokeObjectURL(url);
        }, "image/png");
    };
    img.src = `data:image/jpeg;base64,${b64Jpeg}`;
};