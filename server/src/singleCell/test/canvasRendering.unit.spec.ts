import tape from 'tape'
import { loadImage, Canvas } from 'skia-canvas'
import { xAxisOffSet, yAxisOffSet } from '#shared'
import { renderCellsImage } from '../canvasRendering.ts'
import { imageSize } from '#src/utils/imageSize.ts'

/** the rgba of one css pixel of a png data url, drawn at the given devicePixelRatio */
async function pixelAt(src: string, x: number, y: number, devicePixelRatio: number) {
	const img = await loadImage(src)
	const canvas = new Canvas(img.width, img.height)
	const ctx = canvas.getContext('2d')
	ctx.drawImage(img, 0, 0)
	return [...ctx.getImageData(x * devicePixelRatio, y * devicePixelRatio, 1, 1).data]
}

// a fixed axis scale has no extra padding, so a cell at 0,0 is drawn in the middle of the plot area
const settings = {
	width: 100,
	height: 100,
	radius: 5,
	opacity: 1,
	devicePixelRatio: 2,
	minXScale: -10,
	maxXScale: 10,
	minYScale: -10,
	maxYScale: 10
}
const range = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 } as any
const colorMap = { A: { color: '#ff0000' } } as any
const cells = [{ x: 0, y: 0, category: 'A' }] as any
const center = [xAxisOffSet + settings.width / 2, yAxisOffSet + settings.height / 2]

tape('renderCellsImage: renders cells as a png at the device pixel size', async test => {
	const result = await renderCellsImage({ canvasSettings: settings }, cells, colorMap, range, '')
	test.equal(result.canvasWidth, settings.width + xAxisOffSet + 20, 'adds the axis offset and margin to the width')
	test.equal(result.canvasHeight, settings.height + yAxisOffSet + 20, 'adds the axis offset and margin to the height')
	test.deepEqual(
		imageSize(Buffer.from(result.src.replace(/^data:image\/png;base64,/, ''), 'base64')),
		{ width: result.canvasWidth * 2, height: result.canvasHeight * 2, type: 'png' },
		'renders a png at the device pixel size'
	)
	test.deepEqual(
		await pixelAt(result.src, center[0], center[1], 2),
		[255, 0, 0, 255],
		'draws a cell in its category color'
	)
	test.deepEqual(await pixelAt(result.src, 5, 5, 2), [0, 0, 0, 0], 'leaves the area without cells blank')
	test.end()
})

tape('renderCellsImage: applies the cell opacity', async test => {
	const result = await renderCellsImage({ canvasSettings: { ...settings, opacity: 0.5 } }, cells, colorMap, range, '')
	const [r, g, b, a] = await pixelAt(result.src, center[0], center[1], 2)
	test.deepEqual([r, g, b], [255, 0, 0], 'keeps the category color')
	test.ok(Math.abs(a - 128) <= 1, `draws the cell half transparent (alpha ${a})`)
	test.end()
})
