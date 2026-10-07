// T512: image attachments of tasks (pure: no fs, no React). Files live in `plans/tasks/assets/<folder>/<n>.<ext>`,
// linked from the task body as `![](assets/<folder>/<n>.<ext>)` (relative to the task file).

export const ATTACHMENTS_DIR = 'plans/tasks/assets'
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif',
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v)

/** The image type from the file's first bytes (never its name or the client's MIME); null = not an image we take. SVG is never one. */
export function sniffImage(bytes: Uint8Array): 'png' | 'jpg' | 'gif' | 'webp' | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg'
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif'
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp'
  return null
}

/** Why an upload is refused, or null. Size first, so a huge file gets the size message whatever it is. */
export function imageError(bytes: Uint8Array): string | null {
  if (bytes.length > MAX_IMAGE_BYTES) return `Image is too large (${(bytes.length / 1024 / 1024).toFixed(1)} MB, max ${MAX_IMAGE_BYTES / 1024 / 1024} MB)`
  if (!sniffImage(bytes)) return 'Only PNG, JPEG, WebP or GIF images can be attached'
  return null
}

/** Folders under assets/: a task id, or `draft-<stamp>` for images handed to the agent before the task exists. */
export function isAttachmentFolder(name: string): boolean {
  return /^(T\d+|draft-[a-z0-9]{4,32})$/.test(name)
}

/** Next free `<n>` given the files already in the folder (`1.png`, `2.jpg` → 3). */
export function nextImageNumber(existing: string[]): number {
  const nums = existing.map(f => parseInt(f, 10)).filter(n => !isNaN(n))
  return nums.length ? Math.max(...nums) + 1 : 1
}

/** Markdown lines linking the images from a task file. */
export function imageMarkdown(links: string[]): string {
  return links.map(l => `![](${l})`).join('\n')
}

/** A project-relative path the image route may serve: no absolute path, `..`, dot-folders or node_modules; image extension only. */
export function isServableImage(rel: string): boolean {
  const segs = rel.split('/')
  if (rel.startsWith('/') || /^[a-z]:/i.test(rel) || rel.includes('\\')) return false
  if (segs.some(s => !s || s === '.' || s === '..' || s.startsWith('.') || s === 'node_modules')) return false
  return imageMimeOf(rel) !== null
}

export function imageMimeOf(rel: string): string | null {
  return IMAGE_MIME[rel.split('.').pop()?.toLowerCase() ?? ''] ?? null
}

/**
 * The project-relative path of an `<img src>` written in the file at `baseFile` (project-relative), or null when
 * the src isn't a relative path (http:, data:, /abs, #) or climbs out of the project.
 */
export function resolveImageSrc(src: string, baseFile: string): string | null {
  if (!src || /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(src)) return null
  let decoded = src
  try { decoded = decodeURI(src) } catch {}
  const out = baseFile.split('/').slice(0, -1)
  for (const seg of decoded.split(/[?#]/)[0].split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') { if (!out.length) return null; out.pop() } else out.push(seg)
  }
  return out.length ? out.join('/') : null
}
