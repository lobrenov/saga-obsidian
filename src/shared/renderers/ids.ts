export const RENDERER_IDS = ['character', 'location', 'faction', 'item', 'map', 'calendar', 'document'] as const
export type RendererId = (typeof RENDERER_IDS)[number]
