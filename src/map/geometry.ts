/** Clamps an image point to the image's bounds. */
export const clampToImage = (x: number, y: number, width: number, height: number): { x: number; y: number } => ({
  x: Math.min(width, Math.max(0, x)),
  y: Math.min(height, Math.max(0, y))
})
