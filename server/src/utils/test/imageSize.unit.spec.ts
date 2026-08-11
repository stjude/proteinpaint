import tape from 'tape'
import { Canvas } from 'skia-canvas'
import { imageSize } from '#src/utils/imageSize.ts'

/*
test sections:

png: dimensions from IHDR, fried (CgBI) variant, rejects a bad first chunk
jpeg: baseline and progressive frame headers, fill bytes, tables before the frame header
jpeg exif: orientation 5-8 transposes the stored dimensions, 1-4 and absent do not
gif: dimensions from the logical screen descriptor
unsupported and truncated input throws
real skia-canvas renders: png and jpg round-trip to the requested dimensions
*/

/** Unit tests for imageSize, our in-house replacement for the `image-size`
 * package. The fixtures are assembled byte by byte so a test can state exactly
 * which header field it exercises (fried png, progressive jpeg, exif
 * orientation) without checking binary files into the repo; the last section
 * then checks real encoder output from skia-canvas. */

/*** fixture builders ***/

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** A png header: signature + IHDR chunk (the image data is irrelevant here).
 * With `fried`, a 4-byte CgBI chunk is inserted first, as Xcode's png
 * optimizer does, which shifts IHDR 16 bytes later. */
function png(width: number, height: number, { fried = false, chunkName = 'IHDR' } = {}): Buffer {
	const chunks = [pngSignature]
	if (fried) {
		const cgbi = Buffer.alloc(16) // length(4), name(4), data(4), crc(4)
		cgbi.writeUInt32BE(4, 0)
		cgbi.write('CgBI', 4, 'latin1')
		chunks.push(cgbi)
	}
	const ihdr = Buffer.alloc(25) // length(4), name(4), data(13), crc(4)
	ihdr.writeUInt32BE(13, 0)
	ihdr.write(chunkName, 4, 'latin1')
	ihdr.writeUInt32BE(width, 8)
	ihdr.writeUInt32BE(height, 12)
	chunks.push(ihdr)
	return Buffer.concat(chunks)
}

type JpegSegment = {
	marker: number
	payload?: Buffer
	/** emitted without a length prefix or payload, like the SOI/RSTn markers */
	standalone?: boolean
	/** extra 0xff fill bytes emitted before the marker, as encoders may pad with */
	fill?: number
}

/** A jpeg: SOI followed by the given segments, each with its length prefix
 * computed here. */
function jpeg(...segments: JpegSegment[]): Buffer {
	const parts = [Buffer.from([0xff, 0xd8])]
	for (const s of segments) {
		if (s.fill) parts.push(Buffer.alloc(s.fill, 0xff))
		parts.push(Buffer.from([0xff, s.marker]))
		if (s.standalone) continue
		const payload = s.payload || Buffer.alloc(0)
		const length = Buffer.alloc(2)
		length.writeUInt16BE(payload.length + 2)
		parts.push(length, payload)
	}
	return parts.length ? Buffer.concat(parts) : Buffer.alloc(0)
}

/** Frame header payload: precision(1), height(2), width(2), component count(1) */
function sof(width: number, height: number): Buffer {
	const b = Buffer.alloc(6)
	b.writeUInt8(8, 0)
	b.writeUInt16BE(height, 1)
	b.writeUInt16BE(width, 3)
	b.writeUInt8(3, 5)
	return b
}

/** APP1 payload: the EXIF header plus a TIFF block whose IFD0 holds a single
 * orientation entry. */
function exif(orientation: number, { little = true } = {}): Buffer {
	const tiff = Buffer.alloc(26) // header(8), entry count(2), one entry(12), next-IFD offset(4)
	const u16 = (value: number, at: number) => (little ? tiff.writeUInt16LE(value, at) : tiff.writeUInt16BE(value, at))
	const u32 = (value: number, at: number) => (little ? tiff.writeUInt32LE(value, at) : tiff.writeUInt32BE(value, at))
	tiff.write(little ? 'II' : 'MM', 0, 'latin1')
	u16(42, 2) // TIFF magic number
	u32(8, 4) // IFD0 starts right after this header
	u16(1, 8) // entry count
	u16(0x0112, 10) // orientation tag
	u16(3, 12) // type SHORT
	u32(1, 14) // value count
	u16(orientation, 18) // left-aligned in the 4-byte value field
	return Buffer.concat([Buffer.from('Exif\u0000\u0000', 'latin1'), tiff])
}

/** Header + logical screen descriptor, which is all a gif needs to be measured */
function gif(width: number, height: number, version = 'GIF89a'): Buffer {
	const b = Buffer.alloc(13)
	b.write(version, 0, 'latin1')
	b.writeUInt16LE(width, 6)
	b.writeUInt16LE(height, 8)
	return b
}

/*** png ***/

tape('png: dimensions from IHDR', test => {
	test.deepEqual(imageSize(png(640, 480)), { width: 640, height: 480, type: 'png' }, 'reads width and height')
	test.deepEqual(imageSize(png(1, 1)).width, 1, 'handles a 1x1 image')
	test.deepEqual(imageSize(png(70000, 3)).width, 70000, 'handles a width beyond 16 bits')
	test.end()
})

tape('png: fried (CgBI) variant', test => {
	test.deepEqual(
		imageSize(png(120, 60, { fried: true })),
		{ width: 120, height: 60, type: 'png' },
		'reads past the CgBI chunk'
	)
	test.end()
})

tape('png: invalid first chunk', test => {
	test.throws(
		() => imageSize(png(10, 10, { chunkName: 'IDAT' })),
		/first chunk is not IHDR/,
		'a png that does not start with IHDR is rejected'
	)
	test.end()
})

/*** jpeg ***/

tape('jpeg: frame header variants', test => {
	test.deepEqual(
		imageSize(jpeg({ marker: 0xc0, payload: sof(800, 600) })),
		{ width: 800, height: 600, type: 'jpg' },
		'baseline (SOF0)'
	)
	test.deepEqual(
		imageSize(jpeg({ marker: 0xc2, payload: sof(320, 200) })),
		{ width: 320, height: 200, type: 'jpg' },
		'progressive (SOF2)'
	)
	test.deepEqual(
		imageSize(jpeg({ marker: 0xc9, payload: sof(64, 32) })),
		{ width: 64, height: 32, type: 'jpg' },
		'arithmetic-coded (SOF9)'
	)
	test.end()
})

tape('jpeg: segments preceding the frame header', test => {
	const withTables = jpeg(
		{ marker: 0xe0, payload: Buffer.alloc(14) }, // APP0
		{ marker: 0xdb, payload: Buffer.alloc(65) }, // DQT
		{ marker: 0xc4, payload: Buffer.alloc(30) }, // DHT: inside 0xc0-0xcf but not a frame header
		{ marker: 0xd0, standalone: true }, // RSTn: no length prefix
		{ marker: 0xc1, payload: sof(240, 135), fill: 3 }
	)
	test.deepEqual(
		imageSize(withTables),
		{ width: 240, height: 135, type: 'jpg' },
		'skips tables and standalone markers, tolerates 0xff fill bytes'
	)
	test.end()
})

tape('jpeg: no frame header', test => {
	test.throws(
		() => imageSize(jpeg({ marker: 0xdb, payload: Buffer.alloc(65) }, { marker: 0xda, payload: Buffer.alloc(10) })),
		/no frame header found/,
		'scan data reached without a frame header'
	)
	test.end()
})

tape('jpeg: exif orientation', test => {
	const oriented = (orientation: number, opts = {}) =>
		imageSize(jpeg({ marker: 0xe1, payload: exif(orientation, opts) }, { marker: 0xc0, payload: sof(400, 300) }))

	test.deepEqual(oriented(1), { width: 400, height: 300, type: 'jpg' }, 'orientation 1 keeps the stored dimensions')
	test.deepEqual(oriented(4), { width: 400, height: 300, type: 'jpg' }, 'orientation 4 (a flip) keeps them too')
	test.deepEqual(oriented(6), { width: 300, height: 400, type: 'jpg' }, 'orientation 6 (a quarter turn) transposes')
	test.deepEqual(oriented(8), { width: 300, height: 400, type: 'jpg' }, 'orientation 8 transposes')
	test.deepEqual(
		oriented(6, { little: false }),
		{ width: 300, height: 400, type: 'jpg' },
		'big-endian (MM) exif is read the same way'
	)
	test.deepEqual(
		imageSize(
			jpeg(
				{ marker: 0xe1, payload: Buffer.from('http://ns.adobe.com/xap/1.0/') },
				{ marker: 0xc0, payload: sof(400, 300) }
			)
		),
		{ width: 400, height: 300, type: 'jpg' },
		'a non-exif APP1 segment is ignored'
	)
	test.deepEqual(
		imageSize(
			jpeg(
				// EXIF orientation first, then an XMP APP1 (as Photoshop/Lightroom write)
				{ marker: 0xe1, payload: exif(6) },
				{ marker: 0xe1, payload: Buffer.from('http://ns.adobe.com/xap/1.0/') },
				{ marker: 0xc0, payload: sof(400, 300) }
			)
		),
		{ width: 300, height: 400, type: 'jpg' },
		'a later non-exif APP1 (eg. xmp) does not clear an orientation already found'
	)
	test.end()
})

/*** gif ***/

tape('gif: dimensions from the logical screen descriptor', test => {
	test.deepEqual(imageSize(gif(48, 24)), { width: 48, height: 24, type: 'gif' }, 'GIF89a')
	test.deepEqual(imageSize(gif(48, 24, 'GIF87a')), { width: 48, height: 24, type: 'gif' }, 'GIF87a')
	test.end()
})

/*** svg ***/

tape('svg: dimensions from the root tag', test => {
	const svg = (attributes: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" ${attributes}></svg>`)

	test.deepEqual(imageSize(svg('width="300" height="150"')), { width: 300, height: 150, type: 'svg' }, 'unitless')
	test.deepEqual(imageSize(svg("width='40px' height='20px'")), { width: 40, height: 20, type: 'svg' }, 'px, quoted')
	test.deepEqual(imageSize(svg('width="1in" height="72pt"')), { width: 96, height: 96, type: 'svg' }, 'absolute units')
	test.deepEqual(
		imageSize(svg('viewBox="0 0 200 100"')),
		{ width: 200, height: 100, type: 'svg' },
		'no width/height: the viewBox is the size'
	)
	test.deepEqual(
		imageSize(svg('width="400" viewBox="0 0 200 100"')),
		{ width: 400, height: 200, type: 'svg' },
		'one side given: the other follows the viewBox ratio'
	)
	test.deepEqual(
		imageSize(svg('width="100%" height="100%" viewBox="0, 0, 50, 25"')),
		{ width: 50, height: 25, type: 'svg' },
		'percentages cannot be resolved, so the comma-separated viewBox is used'
	)
	test.deepEqual(
		imageSize(
			Buffer.from(
				`<?xml version="1.0" encoding="UTF-8"?>\n<!-- drawn by hand -->\n<svg\n\twidth="64"\n\theight="32"\n\txmlns="http://www.w3.org/2000/svg"/>`
			)
		),
		{ width: 64, height: 32, type: 'svg' },
		'an xml declaration, a comment, and newlines inside the root tag'
	)
	test.throws(
		() => imageSize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')),
		/cannot determine its dimensions/,
		'neither width/height nor viewBox'
	)
	test.end()
})

/*** rejected input ***/

tape('unsupported and malformed input', test => {
	test.throws(() => imageSize(Buffer.from('id\tvalue\n1\t2\n')), /unsupported image format/, 'a text file')
	test.throws(() => imageSize(Buffer.from('<html><body><svg width="10"/>')), /unsupported image format/, 'html')
	test.throws(() => imageSize(Buffer.alloc(0)), /unsupported image format/, 'an empty buffer')
	test.throws(() => imageSize('/path/to/file.png' as any), /must be a Buffer/, 'a file path instead of its contents')
	test.throws(() => imageSize(png(10, 10).subarray(0, 18)), /file ends before its header does/, 'a truncated png')
	test.throws(
		() => imageSize(jpeg({ marker: 0xc0, payload: sof(10, 10) }).subarray(0, 7)),
		/file ends before its header does/,
		'a truncated jpeg'
	)
	test.end()
})

/*** real encoder output ***/

tape('real png and jpg renders', async test => {
	const canvas = new Canvas(137, 59)
	const ctx = canvas.getContext('2d')
	ctx.fillStyle = '#3b7dd8'
	ctx.fillRect(10, 10, 60, 20)

	test.deepEqual(
		imageSize(await canvas.toBuffer('png')),
		{ width: 137, height: 59, type: 'png' },
		'a skia-canvas png measures at the canvas dimensions'
	)
	test.deepEqual(
		imageSize(await canvas.toBuffer('jpg')),
		{ width: 137, height: 59, type: 'jpg' },
		'a skia-canvas jpg measures at the canvas dimensions'
	)
	test.end()
})
