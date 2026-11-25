export const RENDERER_IDS = ['character', 'location', 'faction', 'item', 'map', 'calendar', 'lore', 'document'] as const
export type RendererId = (typeof RENDERER_IDS)[number]
