/**
 * Normalizes state names by removing accents and converting to lowercase.
 * This prevents duplicates like "Táchira" and "Tachira".
 */
export const normalizeStateName = (name: string): string => {
  if (!name) return "desconocido";

  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};
