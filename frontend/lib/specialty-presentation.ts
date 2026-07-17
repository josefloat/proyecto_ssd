export type SpecialtyVisual = Readonly<{
  icon: "briefcase" | "heart" | "baby" | "bone" | "venus" | "hand" | "neutral";
  tone: "amber" | "rose" | "cyan" | "violet" | "blue" | "orange" | "neutral";
}>;

const PRESENTACIONES: Readonly<Record<string, SpecialtyVisual>> = {
  "Medicina General": { icon: "briefcase", tone: "amber" },
  Cardiología: { icon: "heart", tone: "rose" },
  Pediatría: { icon: "baby", tone: "cyan" },
  Traumatología: { icon: "bone", tone: "violet" },
  Ginecología: { icon: "venus", tone: "blue" },
  Dermatología: { icon: "hand", tone: "orange" },
};

export function presentacionEspecialidad(nombre: string): SpecialtyVisual {
  return PRESENTACIONES[nombre] ?? { icon: "neutral", tone: "neutral" };
}
