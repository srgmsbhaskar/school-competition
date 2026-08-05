export const HOUSES = [
  'Mythreyan',
  'Nachiketas',
  'Upakosalan',
  'Vysampayanan',
  'Sathyakaman',
] as const;

export type House = (typeof HOUSES)[number];

const SECTION_TO_HOUSE: Record<string, House> = {
  M: 'Mythreyan',
  N: 'Nachiketas',
  U: 'Upakosalan',
  V: 'Vysampayanan',
  S: 'Sathyakaman',
};

/** Classes 1-6 derive their house from the section letter; class VII and above choose it. */
export const HOUSE_AUTO_MAX_CLASS = 6;

export const houseFromSection = (section?: string | null): House | null => {
  if (!section) return null;
  const letter = section.trim().charAt(0).toUpperCase();
  return SECTION_TO_HOUSE[letter] ?? null;
};

/** Classes 8-12 must pick a house from a dropdown. */
export const requiresHouseSelection = (studentClass: number) =>
  studentClass > HOUSE_AUTO_MAX_CLASS;

/** House derived automatically, or null when it must be selected manually. */
export const autoHouse = (studentClass: number, section?: string | null): House | null =>
  requiresHouseSelection(studentClass) ? null : houseFromSection(section);

/** Resolved house for a participation: stored value wins, else the derived one. */
export const resolveHouse = (
  stored: string | null | undefined,
  studentClass: number,
  section?: string | null,
): string | null => stored || autoHouse(studentClass, section);
