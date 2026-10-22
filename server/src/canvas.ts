import { Canvas, type CanvasRenderingContext2D } from 'skia-canvas'

/**
 * The one place where the server creates and encodes a canvas for a rendered image.
 * Each renderer validates its own request fields; this module checks the canvas size,
 * which skia-canvas does not: it silently replaces a size that is not a finite positive
 * number with its default, and fails to allocate a side over 16384 pixels.
 */

/** the largest canvas side, in device pixels, that skia-canvas can allocate */
export const maxCanvasSide = 16384
/** the largest canvas area, in device pixels, about 200 MB as an rgba bitmap */
export const maxCanvasPixels = 50_000_000

export type MadeCanvas = {
	canvas: Canvas
	/** scaled to css pixels, so a renderer draws in css pixels at any devicePixelRatio */
	ctx: CanvasRenderingContext2D
	/** the devicePixelRatio of the canvas, which is lowered from the requested one
	 * as needed to fit maxCanvasSide and maxCanvasPixels */
	devicePixelRatio: number
}

/**
 * Create a canvas for an image of width x height css pixels, at the devicePixelRatio.
 * The client shows the image at its css size, so a size over the limits is rendered
 * at a lower devicePixelRatio, as a less sharp image, instead of failing.
 * A zero width or height is allowed, and canvasToURL() returns an empty image for it.
 */
export function makeCanvas(width: number, height: number, devicePixelRatio = 1): MadeCanvas {
	if (!Number.isFinite(width) || width < 0) throw new Error(`invalid canvas width: ${width}`)
	if (!Number.isFinite(height) || height < 0) throw new Error(`invalid canvas height: ${height}`)
	if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0)
		throw new Error(`invalid devicePixelRatio: ${devicePixelRatio}`)

	let dpr = devicePixelRatio
	if (width > 0) dpr = Math.min(dpr, maxCanvasSide / width)
	if (height > 0) dpr = Math.min(dpr, maxCanvasSide / height)
	if (width * height > 0) dpr = Math.min(dpr, Math.sqrt(maxCanvasPixels / (width * height)))

	// skia-canvas truncates a fractional size, floor it here so canvas.width and .height are the bitmap size
	const canvas = new Canvas(Math.floor(width * dpr), Math.floor(height * dpr))
	const ctx = canvas.getContext('2d')
	if (dpr != 1) ctx.scale(dpr, dpr)
	return { canvas, ctx, devicePixelRatio: dpr }
}

/**
 * Encode a canvas as a png data URL.
 *
 * `await canvas.toURL('png')` rasterizes and encodes on skia's own thread pool, so
 * the event loop stays free while a large image is encoded; the synchronous
 * `canvas.toDataURL()` would block it for the whole encode, as node-canvas did.
 *
 * skia-canvas throws on a canvas with a side under 1 pixel, for which node-canvas
 * returned an empty data URL. Return that same empty URL, so that a zero width or
 * height still gets an empty image instead of an error.
 */
export async function canvasToURL(canvas: Canvas): Promise<string> {
	if (canvas.width < 1 || canvas.height < 1) return 'data:,'
	return await canvas.toURL('png')
}
