/**
 * Read an image's pixel dimensions out of its header bytes, replacing the
 * `image-size` npm package (dropped for its published vulnerability).
 *
 * Only the formats this server actually serves are decoded: PNG (the R spline
 * plots and most dataset legend/thumbnail files), JPEG, GIF, and SVG -- the
 * img route hands back whatever image file a dataset points it at, so the two
 * vector-free formats are not enough. Anything else throws, as image-size did
 * for a file it could not recognize.
 *
 * The input is the file contents, not a path: both call sites already hold the
 * file as a Buffer, so passing it in avoids the extra synchronous re-read that
 * image-size did when handed a path.
 *
 * Only the leading header is inspected, so callers that just need dimensions
 * may pass a prefix of the file (a few hundred bytes covers PNG and GIF; JPEG
 * needs everything up to its frame header).
 */
export type ImageSize = {
	/** width in pixels */
	width: number
	/** height in pixels */
	height: number
	/** format detected from the file contents, not from the file extension */
	type: 'png' | 'jpg' | 'gif' | 'svg'
}

export function imageSize(buffer: Buffer): ImageSize {
	if (!Buffer.isBuffer(buffer)) throw new Error('image data must be a Buffer')
	if (isPng(buffer)) return pngSize(buffer)
	if (isJpg(buffer)) return jpgSize(buffer)
	if (isGif(buffer)) return gifSize(buffer)
	const svg = svgSize(buffer)
	if (svg) return svg
	throw new Error('unsupported image format, expecting png, jpeg, gif, or svg')
}

/** Throw when the header is truncated, instead of letting a read past the end
 * of the buffer surface as a confusing RangeError from Buffer. */
function requireBytes(buffer: Buffer, count: number, format: string) {
	if (buffer.length < count) throw new Error(`invalid ${format}, file ends before its header does`)
}

/*** PNG ***/

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function isPng(buffer: Buffer) {
	return buffer.length >= 8 && buffer.subarray(0, 8).equals(pngSignature)
}

function pngSize(buffer: Buffer): ImageSize {
	// after the 8-byte signature comes the first chunk: length(4), name(4), data
	requireBytes(buffer, 24, 'PNG')
	const firstChunk = buffer.subarray(12, 16).toString('latin1')
	if (firstChunk == 'CgBI') {
		// an Apple-"fried" png: Xcode prepends its own CgBI chunk, pushing IHDR
		// (and so the dimensions) 16 bytes further in
		requireBytes(buffer, 40, 'PNG')
		return { width: buffer.readUInt32BE(32), height: buffer.readUInt32BE(36), type: 'png' }
	}
	if (firstChunk != 'IHDR') throw new Error('invalid PNG, first chunk is not IHDR')
	// IHDR data starts at byte 16: width(4), height(4), both big-endian
	return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), type: 'png' }
}

/*** JPEG ***/

function isJpg(buffer: Buffer) {
	// SOI marker
	return buffer.length >= 3 && buffer[0] == 0xff && buffer[1] == 0xd8 && buffer[2] == 0xff
}

/** Markers 0xc0-0xcf are frame headers (SOF0 baseline, SOF2 progressive, and
 * friends) and carry the dimensions -- except these three, which reuse the
 * range for unrelated tables. */
const notSofMarkers = new Set([0xc4 /* DHT */, 0xc8 /* JPG */, 0xcc /* DAC */])

function jpgSize(buffer: Buffer): ImageSize {
	// EXIF (APP1) precedes the frame header, so an orientation seen along the
	// way is known by the time the dimensions are read
	let orientation = 0
	let offset = 2 // past the SOI marker
	while (offset < buffer.length) {
		if (buffer[offset] != 0xff) throw new Error('invalid JPEG, expecting a segment marker')
		// a marker may be preceded by any number of 0xff fill bytes
		while (offset < buffer.length && buffer[offset] == 0xff) offset++
		requireBytes(buffer, offset + 1, 'JPEG')
		const marker = buffer[offset++]
		// standalone markers: no length or payload follows
		if (marker == 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue
		// end of image, or the start of entropy-coded scan data that is no longer
		// laid out as length-prefixed segments -- either way, no frame header left
		if (marker == 0xd9 || marker == 0xda) break
		requireBytes(buffer, offset + 2, 'JPEG')
		const segmentLength = buffer.readUInt16BE(offset) // includes these 2 length bytes
		if (segmentLength < 2) throw new Error('invalid JPEG, segment length is too short')
		const payload = offset + 2
		if (marker >= 0xc0 && marker <= 0xcf && !notSofMarkers.has(marker)) {
			// frame header payload: precision(1), height(2), width(2)
			requireBytes(buffer, payload + 5, 'JPEG')
			const height = buffer.readUInt16BE(payload + 1)
			const width = buffer.readUInt16BE(payload + 3)
			// orientations 5-8 rotate by a quarter turn, so the stored dimensions
			// are transposed relative to how the image is meant to be displayed
			return orientation >= 5 ? { width: height, height: width, type: 'jpg' } : { width, height, type: 'jpg' }
		}
		if (marker == 0xe1) {
			// a later non-EXIF APP1 (eg. XMP) returns 0 and must not clear an
			// orientation already found in an earlier EXIF segment
			const foundOrientation = exifOrientation(buffer.subarray(payload, offset + segmentLength))
			if (foundOrientation) orientation = foundOrientation
		}
		offset += segmentLength
	}
	throw new Error('invalid JPEG, no frame header found')
}

/** Pull the orientation tag out of an APP1 segment payload. Returns 0 when the
 * segment is not EXIF, is malformed, or has no orientation -- a missing tag is
 * not an error, it just means the stored dimensions are used as-is. */
function exifOrientation(payload: Buffer): number {
	if (payload.subarray(0, 6).toString('latin1') != 'Exif\u0000\u0000') return 0
	// the EXIF header is followed by a TIFF block, whose offsets are relative to
	// the start of that block
	const tiff = payload.subarray(6)
	if (tiff.length < 8) return 0
	const byteOrder = tiff.subarray(0, 2).toString('latin1')
	if (byteOrder != 'II' && byteOrder != 'MM') return 0
	const little = byteOrder == 'II'
	const readU16 = (i: number) => (little ? tiff.readUInt16LE(i) : tiff.readUInt16BE(i))
	const readU32 = (i: number) => (little ? tiff.readUInt32LE(i) : tiff.readUInt32BE(i))
	if (readU16(2) != 42) return 0 // the TIFF magic number
	const ifd0 = readU32(4)
	if (ifd0 + 2 > tiff.length) return 0
	const entryCount = readU16(ifd0)
	for (let i = 0; i < entryCount; i++) {
		// each entry: tag(2), type(2), count(4), value(4)
		const entry = ifd0 + 2 + i * 12
		if (entry + 12 > tiff.length) return 0
		if (readU16(entry) != 0x0112) continue // orientation tag
		// a SHORT value is stored left-aligned in the 4-byte value field
		const value = readU16(entry + 8)
		return value >= 1 && value <= 8 ? value : 0
	}
	return 0
}

/*** GIF ***/

function isGif(buffer: Buffer) {
	if (buffer.length < 10) return false
	const header = buffer.subarray(0, 6).toString('latin1')
	return header == 'GIF87a' || header == 'GIF89a'
}

function gifSize(buffer: Buffer): ImageSize {
	// logical screen descriptor: width(2), height(2), both little-endian
	return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8), type: 'gif' }
}

/*** SVG ***/

/** Only the root tag matters, and it is preceded at most by an xml
 * declaration, a doctype, and comments -- so a prefix is enough to find it. */
const svgHeadLength = 8192
const svgAttribute = (name: string) => new RegExp(`\\b${name}\\s*=\\s*(['"])\\s*([^'"]+?)\\s*\\1`, 'i')

/** The `<svg …>` root tag, or undefined when the text does not open with one.
 * Requiring it to be the document's first element keeps, say, an html page
 * with an inline chart from being measured as if it were the chart. */
function svgRootTag(head: string): string | undefined {
	let rest = head.replace(/^\uFEFF/, '').trimStart()
	// the prolog may hold an xml declaration, comments, and a doctype, in any
	// number and in any order
	for (let prolog = ''; prolog != rest; ) {
		prolog = rest
		rest = rest
			.replace(/^<\?[\s\S]*?\?>/, '')
			.replace(/^<!--[\s\S]*?-->/, '')
			.replace(/^<!DOCTYPE[^>]*>/i, '')
			.trimStart()
	}
	return rest.match(/^<svg(\s[^>]*)?>/i)?.[0]
}

/** Lengths carry units. Only absolute ones can be resolved without laying the
 * document out, and image-size likewise only handled these; a percentage or a
 * font-relative unit falls back to the viewBox. */
const svgUnitsInPx: { [unit: string]: number } = {
	'': 1,
	px: 1,
	pt: 96 / 72,
	pc: 16,
	in: 96,
	cm: 96 / 2.54,
	mm: 96 / 25.4
}

function svgLength(value: string | undefined): number | undefined {
	if (!value) return undefined
	const parts = value.match(/^([\d.]+)\s*([a-z]*)$/i)
	if (!parts) return undefined
	const scale = svgUnitsInPx[parts[2].toLowerCase()]
	const length = Number(parts[1]) * scale
	return scale && length > 0 ? length : undefined
}

/** Returns undefined -- rather than throwing -- when the buffer is not an svg,
 * so the caller can fall through to its own "unsupported format" error. */
function svgSize(buffer: Buffer): ImageSize | undefined {
	const root = svgRootTag(buffer.subarray(0, svgHeadLength).toString('utf8'))
	if (!root) return undefined
	const attribute = (name: string) => root.match(svgAttribute(name))?.[2]
	let width = svgLength(attribute('width'))
	let height = svgLength(attribute('height'))
	// a missing side is taken from the viewBox, which also supplies the aspect
	// ratio needed to scale the other side
	if (!width || !height) {
		// viewBox: min-x, min-y, width, height
		const box = (attribute('viewBox') || '')
			.trim()
			.split(/[\s,]+/)
			.map(Number)
		const boxWidth = box.length == 4 ? box[2] : 0
		const boxHeight = box.length == 4 ? box[3] : 0
		if (boxWidth > 0 && boxHeight > 0) {
			width = width || (height ? (height * boxWidth) / boxHeight : boxWidth)
			height = height || (width * boxHeight) / boxWidth
		}
	}
	if (!width || !height) throw new Error('invalid SVG, cannot determine its dimensions')
	return { width: Math.round(width), height: Math.round(height), type: 'svg' }
}
