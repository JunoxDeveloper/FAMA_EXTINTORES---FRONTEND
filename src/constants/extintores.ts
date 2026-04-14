export const ESTADOS = ["Nuevo", "Aprobado", "De Baja"];

export const PESOS_KG = ["1", "2", "4", "6", "9", "12", "25", "50", "75", "100"] as const;
export const PESOS_LB = ["5", "10", "15", "20", "25", "30", "125", "145"] as const;
export const PESOS_LT = ["1", "2", "2.5", "3", "4", "6", "9", "10", "12", "25", "50"] as const;

export const COMP_KEYS = ["valvula", "manguera", "manometro", "tobera"] as const;

export const COMP_LABELS: Record<string, string> = {
  valvula: "Válvula",
  manguera: "Manguera",
  manometro: "Manómetro",
  tobera: "Tobera",
};