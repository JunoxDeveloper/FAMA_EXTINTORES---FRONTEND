export const MARCAS = ["Nacional", "Amerex", "Kidde", "Chubb", "Pyro-Chem"];

export const AGENTES = ["PQS", "CO2", "AFFF", "Agua", "Halotron", "Clase K"];

export const ESTADOS = ["Bueno", "Regular", "Malo", "Inoperativo"];

export const RECARGAS = ["90% NACIONAL", "90% UL"];

export const PESOS_KG = ["1", "2", "4", "6", "9", "10", "12", "25", "50"] as const;
export const PESOS_LB = ["2.5", "5", "10", "15", "20", "30", "50", "100", "125"] as const;

export const COMP_KEYS = ["valvula", "manguera", "manometro", "tobera"] as const;

export const COMP_LABELS: Record<string, string> = {
  valvula: "Válvula",
  manguera: "Manguera",
  manometro: "Manómetro",
  tobera: "Tobera",
};