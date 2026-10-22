import tape from 'tape'
import { makeCanvas, canvasToURL, maxCanvasSide, maxCanvasPixels } from '#src/canvas.ts'
import { imageSize } from '#src/utils/imageSize.ts'

/*
test sections:

makeCanvas: a canvas at the device pixel size, with the context scaled to css pixels
makeCanvas: lowers the devicePixelRatio of an image over the size limits
makeCanvas: rejects a size or devicePixelRatio that is not a finite number
canvasToURL: a png data url, or an empty one for a side under 1 pixel
*/

function pngOf(src: string) {
	return imageSize(Buffer.from(src.replace(/^data:image\/png;base64,/, ''), 'base64'))
}

tape('\n', test => {
	test.pass('-***- canvas specs -***-')
	test.end()
})

tape('makeCanvas: device pixel size and scaled context', async test => {
	{
		const { canvas, ctx, devicePixelRatio } = makeCanvas(100, 50, 2)
		test.equal(devicePixelRatio, 2, 'keeps a devicePixelRatio within the limits')
		test.deepEqual([canvas.width, canvas.height], [200, 100], 'sizes the canvas in device pixels')
		ctx.fillStyle = '#ff0000'
		ctx.fillRect(0, 0, 1, 1)
		test.deepEqual(
			[...ctx.getImageData(1, 1, 1, 1).data],
			[255, 0, 0, 255],
			'scales the context, so 1 css pixel covers 2 device pixels'
		)
		test.deepEqual([...ctx.getImageData(2, 2, 1, 1).data], [0, 0, 0, 0], 'does not draw past the scaled css pixel')
	}
	{
		const { canvas, devicePixelRatio } = makeCanvas(100, 50)
		test.equal(devicePixelRatio, 1, 'defaults to a devicePixelRatio of 1')
		test.deepEqual([canvas.width, canvas.height], [100, 50], 'sizes the canvas in css pixels at a ratio of 1')
	}
	test.end()
})

tape('makeCanvas: size limits', async test => {
	{
		const { canvas, devicePixelRatio } = makeCanvas(20000, 10, 2)
		test.equal(devicePixelRatio, maxCanvasSide / 20000, 'lowers the devicePixelRatio to fit the side limit')
		test.deepEqual(
			pngOf(await canvasToURL(canvas)),
			{ width: maxCanvasSide, height: 8, type: 'png' },
			'renders a side over the limit at the limit'
		)
	}
	{
		const { canvas, devicePixelRatio } = makeCanvas(10, 20000, 2)
		test.equal(
			devicePixelRatio,
			maxCanvasSide / 20000,
			'lowers the devicePixelRatio to fit the side limit for a height'
		)
		test.ok(canvas.height <= maxCanvasSide, 'fits the height within the side limit')
	}
	{
		const { canvas, devicePixelRatio } = makeCanvas(8000, 8000, 2)
		test.ok(devicePixelRatio < 1, `lowers the devicePixelRatio to fit the area limit (to ${devicePixelRatio})`)
		test.ok(canvas.width * canvas.height <= maxCanvasPixels, 'fits the area within the limit')
	}
	test.end()
})

tape('makeCanvas: invalid input', test => {
	for (const v of [NaN, Infinity, -1, '100' as any, undefined as any]) {
		test.throws(() => makeCanvas(v, 10), /invalid canvas width/, `rejects a width of ${v}`)
		test.throws(() => makeCanvas(10, v), /invalid canvas height/, `rejects a height of ${v}`)
	}
	for (const v of [NaN, Infinity, 0, -1, '2' as any, null as any]) {
		test.throws(() => makeCanvas(10, 10, v), /invalid devicePixelRatio/, `rejects a devicePixelRatio of ${v}`)
	}
	test.end()
})

tape('canvasToURL', async test => {
	{
		const { canvas, ctx } = makeCanvas(137, 59)
		ctx.fillStyle = '#3b7dd8'
		ctx.fillRect(10, 10, 60, 20)
		const src = await canvasToURL(canvas)
		test.ok(src.startsWith('data:image/png;base64,'), 'returns a png data url')
		test.deepEqual(pngOf(src), { width: 137, height: 59, type: 'png' }, 'encodes the png at the canvas dimensions')
	}
	for (const [width, height] of [
		[0, 0],
		[0, 50],
		[100, 0],
		[0.4, 10]
	]) {
		test.equal(
			await canvasToURL(makeCanvas(width, height).canvas),
			'data:,',
			`returns an empty data url for ${width}x${height}`
		)
	}
	test.end()
})
