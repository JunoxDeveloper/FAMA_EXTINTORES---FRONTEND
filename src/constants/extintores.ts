export const MARCAS = ["Nacional", "Amerex", "Kidde", "Chubb", "Pyro-Chem"];

export const AGENTES = ["PQS", "CO2", "AFFF", "Agua", "Halotron", "Clase K"];

export const ESTADOS = ["Nuevo", "Aprobado", "Inoperativo"];

export const RECARGAS = ["90% NACIONAL", "90% UL"];

export const PESOS_KG = ["1", "2", "4", "6", "9", "12", "25", "50", "75", "100"] as const;
export const PESOS_LB = ["5", "10", "20", "25", "30", "125", "145"] as const;

export const COMP_KEYS = ["valvula", "manguera", "manometro", "tobera"] as const;

export const COMP_LABELS: Record<string, string> = {
  valvula: "Válvula",
  manguera: "Manguera",
  manometro: "Manómetro",
  tobera: "Tobera",
};