/** Pure data + rules for the exploded transformer. No React, no three.js. */
export type Vec3 = [number, number, number];

export const groups = [
  { title: "Core", focus: 1 },
  { title: "Windings", focus: 0.9 },
  { title: "Active part", focus: 0.72 },
  { title: "Tank & cooling", focus: 0.48 },
  { title: "Terminals", focus: 0.3 },
] as const;

export type PartMeta = {
  id: string;
  group: number;
  name: string;
  meta: string;
  note: string;
  /** explode progress at which this part starts moving */
  start: number;
  /** default exploded offset (instances may override) */
  offset: Vec3;
};

/** Length of each part's motion window in explode progress. */
export const WINDOW = 0.4;

export const parts: PartMeta[] = [
  { id: "limbs", group: 0, name: "Limb laminations", meta: "CORE · 01", start: 1, offset: [0, 0, 0],
    note: "Three stepped limbs of grain-oriented steel, stacked in thin sheets to choke eddy currents." },
  { id: "lowerYoke", group: 0, name: "Lower yoke", meta: "CORE · 02", start: 1, offset: [0, 0, 0],
    note: "Joins the limbs at the base and closes the bottom of the magnetic path." },
  { id: "feet", group: 0, name: "Core feet", meta: "CORE · 03", start: 0.6, offset: [0, -0.02, 0],
    note: "Steel feet carry the active part's weight to the tank floor." },
  { id: "lv", group: 1, name: "LV winding", meta: "WINDINGS · 01", start: 0.56, offset: [0, 0.45, 0],
    note: "The low-voltage coil sits closest to the limb, wound from heavy copper strip." },
  { id: "hv", group: 1, name: "HV winding", meta: "WINDINGS · 02", start: 0.5, offset: [0, 0.95, 0],
    note: "Many turns of fine copper wire wrap concentrically around the LV coil." },
  { id: "spacers", group: 1, name: "Spacers & end rings", meta: "WINDINGS · 03", start: 0.53, offset: [0, 0.7, 0],
    note: "Pressboard sticks and rings hold the coils apart and let oil flow between them." },
  { id: "upperYoke", group: 2, name: "Upper yoke", meta: "ACTIVE PART · 01", start: 0.38, offset: [0, 1.45, 0],
    note: "Interleaved back onto the limbs after the coils are in place, closing the magnetic circuit." },
  { id: "clamps", group: 2, name: "Clamp frames", meta: "ACTIVE PART · 02", start: 0.42, offset: [0, 0, 0.9],
    note: "Steel channels press core and coils together against short-circuit forces." },
  { id: "lugs", group: 2, name: "Lifting lugs", meta: "ACTIVE PART · 03", start: 0.35, offset: [0, 1.75, 0],
    note: "Lifting eyes used to lower the active part into the tank." },
  { id: "tank", group: 3, name: "Tank", meta: "TANK & COOLING · 01", start: 0.2, offset: [0, 0, 1.2],
    note: "A welded steel vessel that holds the active part under insulating oil." },
  { id: "radiators", group: 3, name: "Radiator banks", meta: "TANK & COOLING · 02", start: 0.12, offset: [0, 0, 1.9],
    note: "Pressed-steel fin panels shed heat by natural oil convection (ONAN)." },
  { id: "oil", group: 3, name: "Insulating oil", meta: "TANK & COOLING · 03", start: 0.2, offset: [0, 0, 0],
    note: "Mineral oil insulates the windings and carries heat out to the radiators." },
  { id: "cover", group: 4, name: "Cover", meta: "TERMINALS · 01", start: 0, offset: [0, 1.5, 0],
    note: "A bolted, gasketed lid seals the tank and carries the bushings." },
  { id: "hvBushings", group: 4, name: "HV bushings", meta: "TERMINALS · 02", start: 0.02, offset: [0, 2.05, 0],
    note: "Tall glazed-porcelain bushings bring each high-voltage phase out through the cover." },
  { id: "lvBushings", group: 4, name: "LV bushings", meta: "TERMINALS · 03", start: 0.04, offset: [0, 1.85, 0],
    note: "Shorter bushings carry the low-voltage phases to the external circuit." },
];

export const partById: Record<string, PartMeta> = Object.fromEntries(parts.map((p) => [p.id, p]));

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Smoothstepped 0..1 motion of a part that starts at `start` for a given explode value. */
export function partProgress(start: number, explode: number) {
  const t = clamp01((explode - start) / WINDOW);
  return t * t * (3 - 2 * t);
}

/** Label for the HUD: what is moving at this explode value. */
export function stageLabel(explode: number) {
  if (explode <= 0.005) return "Assembled";
  if (explode >= 0.995) return "Exploded";
  if (explode < 0.12) return groups[4].title;
  if (explode < 0.35) return groups[3].title;
  if (explode < 0.5) return groups[2].title;
  return groups[1].title;
}

/** Ping-pong autoplay step. Returns the new explode value and direction. */
export function autoplayStep(explode: number, dir: 1 | -1, dt: number, period = 6) {
  const next = explode + (dir * dt) / period;
  if (next >= 1) return { explode: 1, dir: -1 as const, turned: true };
  if (next <= 0) return { explode: 0, dir: 1 as const, turned: true };
  return { explode: next, dir, turned: false };
}
