import assert from 'node:assert/strict'
import { imageError, imageMarkdown, isAttachmentFolder, isServableImage, nextImageNumber, resolveImageSrc, sniffImage, MAX_IMAGE_BYTES } from './attachments.ts'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
const gif = new TextEncoder().encode('GIF89a...')
const webp = new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>')

assert.equal(sniffImage(png), 'png')
assert.equal(sniffImage(jpg), 'jpg')
assert.equal(sniffImage(gif), 'gif')
assert.equal(sniffImage(webp), 'webp')
assert.equal(sniffImage(svg), null)
assert.equal(imageError(png), null)
assert.match(imageError(svg) ?? '', /Only PNG/)
const big = new Uint8Array(MAX_IMAGE_BYTES + 1); big.set(png)
assert.match(imageError(big) ?? '', /too large/)

assert.ok(isAttachmentFolder('T512'))
assert.ok(isAttachmentFolder('draft-k3j2h1'))
assert.ok(!isAttachmentFolder('../T1'))
assert.ok(!isAttachmentFolder('draft-'))
assert.ok(!isAttachmentFolder('notes'))

assert.equal(nextImageNumber([]), 1)
assert.equal(nextImageNumber(['1.png', '2.jpg', 'x.txt']), 3)
assert.equal(imageMarkdown(['assets/T1/1.png', 'assets/T1/2.gif']), '![](assets/T1/1.png)\n![](assets/T1/2.gif)')

assert.ok(isServableImage('plans/tasks/assets/T1/1.png'))
assert.ok(!isServableImage('../secret.png'))
assert.ok(!isServableImage('/etc/x.png'))
assert.ok(!isServableImage('a/../../x.png'))
assert.ok(!isServableImage('.git/x.png'))
assert.ok(!isServableImage('node_modules/x/a.png'))
assert.ok(!isServableImage('docs/logo.svg'))
assert.ok(!isServableImage('docs/notes.md'))

assert.equal(resolveImageSrc('assets/T1/1.png', 'plans/tasks/T1-x.md'), 'plans/tasks/assets/T1/1.png')
assert.equal(resolveImageSrc('./img/a b.png', 'docs/guide.md'), 'docs/img/a b.png')
assert.equal(resolveImageSrc('../shot.png', 'docs/a/b.md'), 'docs/shot.png')
assert.equal(resolveImageSrc('../../x.png', 'docs/a.md'), null)
assert.equal(resolveImageSrc('https://x.dev/a.png', 'docs/a.md'), null)
assert.equal(resolveImageSrc('data:image/png;base64,xx', 'docs/a.md'), null)
assert.equal(resolveImageSrc('/abs.png', 'docs/a.md'), null)
assert.equal(resolveImageSrc('a.png', 'README.md'), 'a.png')

console.log('attachments.check: ok')
