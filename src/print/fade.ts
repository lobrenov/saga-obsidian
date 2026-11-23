/** The widest faded banner, in pixels. */
const MAX_WIDTH = 2000

/** The banner image cropped to `ratio` (width / height) at `y` percent, as `object-fit: cover` does, and faded to transparent over its lower part, as the screen's mask does; a PNG data URL. */
export async function fadedBanner(data: ArrayBuffer, ratio: number, y: number): Promise<string> {
  const bitmap = await createImageBitmap(new Blob([data]))
  const cropWidth = Math.min(bitmap.width, bitmap.height * ratio)
  const cropHeight = cropWidth / ratio
  const width = Math.round(Math.min(cropWidth, MAX_WIDTH))
  const height = Math.round(width / ratio)
  const canvas = createEl('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No 2D canvas context')
  context.drawImage(bitmap, (bitmap.width - cropWidth) / 2, ((bitmap.height - cropHeight) * y) / 100, cropWidth, cropHeight, 0, 0, width, height)
  bitmap.close()
  const fade = context.createLinearGradient(0, 0, 0, height)
  fade.addColorStop(0.45, '#000')
  fade.addColorStop(1, 'transparent')
  context.globalCompositeOperation = 'destination-in'
  context.fillStyle = fade
  context.fillRect(0, 0, width, height)
  return canvas.toDataURL('image/png')
}
