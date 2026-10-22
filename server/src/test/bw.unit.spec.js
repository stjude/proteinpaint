import tape from 'tape'
import { loadImage, Canvas } from 'skia-canvas'
import { validateCanvasSize, validateBinTotal, plotWiggle } from '../bw.js'
import { imageSize } from '#src/utils/imageSize.ts'

/** the rgba of one css pixel of a png data url, drawn at the given devicePixelRatio */
async function pixelAt(src, x, y, devicePixelRatio) {
	const img = await loadImage(src)
	const canvas = new Canvas(img.width, img.height)
	const ctx = canvas.getContext('2d')
	ctx.drawImage(img, 0, 0)
	return [...ctx.getImageData(x * devicePixelRatio, y * devicePixelRatio, 1, 1).data]
}

function pngOf(src) {
	return imageSize(Buffer.from(src.replace(/^data:image\/png;base64,/, ''), 'base64'))
}

tape('\n', test => {
	test.pass('-***- bw specs -***-')
	test.end()
})

tape('validateCanvasSize()', test => {
	const ok = { width: 800, barheight: 50, devicePixelRatio: 2 }
	test.doesNotThrow(() => validateCanvasSize(ok), 'accepts a normal size')
	{
		const q = { width: 800, barheight: 50 }
		test.doesNotThrow(() => validateCanvasSize(q), 'accepts a missing devicePixelRatio')
		test.equal(q.devicePixelRatio, 1, 'sets a missing devicePixelRatio to 1')
	}
	test.doesNotThrow(
		() => validateCanvasSize({ width: 6000, barheight: 2000, devicePixelRatio: 5 }),
		'accepts a size that is within each limit but large in area, which makeCanvas() renders at a lower pixel ratio'
	)
	test.throws(() => validateCanvasSize({ ...ok, width: 'a' }), /invalid width/, 'rejects a width that is not a number')
	test.throws(() => validateCanvasSize({ ...ok, width: 20001 }), /width out of bound/, 'rejects a width over the limit')
	test.throws(() => validateCanvasSize({ ...ok, width: -1 }), /width out of bound/, 'rejects a negative width')
	test.throws(
		() => validateCanvasSize({ ...ok, barheight: 2001 }),
		/barheight out of bound/,
		'rejects a barheight over the limit'
	)
	test.throws(
		() => validateCanvasSize({ ...ok, barheight: 'a' }),
		/invalid barheight/,
		'rejects a barheight that is not a number'
	)
	test.throws(
		() => validateCanvasSize({ ...ok, devicePixelRatio: 6 }),
		/devicePixelRatio out of bound/,
		'rejects a devicePixelRatio over the limit'
	)
	test.throws(
		() => validateCanvasSize({ ...ok, devicePixelRatio: 0 }),
		/devicePixelRatio out of bound/,
		'rejects a devicePixelRatio of 0'
	)
	test.throws(
		() => validateCanvasSize({ ...ok, devicePixelRatio: 'a' }),
		/invalid devicePixelRatio/,
		'rejects a devicePixelRatio that is not a number'
	)
	test.end()
})

tape('validateBinTotal()', test => {
	const region = { start: 0, stop: 1000000, width: 1000 }
	test.doesNotThrow(() => validateBinTotal({ rglst: [region], dotplotfactor: 20 }), 'accepts a normal request')
	test.doesNotThrow(() => validateBinTotal({ rglst: [region] }), 'accepts a missing dotplotfactor')
	test.throws(
		() => validateBinTotal({ rglst: [{ start: 0, stop: 1000 }] }),
		/invalid number of bins for a region/,
		'rejects a region with no width'
	)
	test.throws(
		() => validateBinTotal({ rglst: [{ start: 0, stop: 1000, width: 0 }] }),
		/invalid number of bins for a region/,
		'rejects a region with a width of 0'
	)
	test.throws(
		() => validateBinTotal({ rglst: [region, { ...region, width: 'a' }] }),
		/invalid number of bins for a region/,
		'rejects a later region with a width that is not a number'
	)
	test.throws(
		() => validateBinTotal({ rglst: Array.from({ length: 11 }, () => region), dotplotfactor: 20 }),
		/too many bins requested/,
		'rejects regions that are within the limit alone but over it in total'
	)
	test.end()
})

tape('plotWiggle()', async test => {
	const q = {
		// 2 bins over 100 css pixels, with a positive value in the first one only
		rglst: [{ start: 0, stop: 2, width: 100, values: [10, 0] }],
		regionspace: 0,
		width: 100,
		barheight: 20,
		devicePixelRatio: 2,
		name: 'test',
		pcolor: '#ff0000',
		ncolor: '#0000ff'
	}
	{
		const result = await plotWiggle(structuredClone(q), { autoscale: true })
		test.deepEqual(pngOf(result.src), { width: 200, height: 40, type: 'png' }, 'renders a png at the device pixel size')
		test.equal(result.maxv, 10, 'autoscales the max to the largest value')
		test.deepEqual(await pixelAt(result.src, 25, 10, 2), [255, 0, 0, 255], 'draws the bar of a positive value')
		test.deepEqual(await pixelAt(result.src, 75, 10, 2), [0, 0, 0, 0], 'leaves a zero value blank')
	}
	{
		const result = await plotWiggle({ ...structuredClone(q), rglst: [{ start: 0, stop: 2, width: 100 }] }, {})
		test.equal(result.nodata, true, 'flags a request without values as nodata')
		test.deepEqual(pngOf(result.src), { width: 200, height: 40, type: 'png' }, 'renders the nodata message as a png')
	}
	{
		const result = await plotWiggle({ ...structuredClone(q), barheight: 0 }, { autoscale: true })
		test.equal(result.src, 'data:,', 'returns an empty image for a zero barheight')
	}
	{
		const result = await plotWiggle({ ...structuredClone(q), width: 20000 }, { autoscale: true })
		test.deepEqual(
			pngOf(result.src),
			{ width: 16384, height: 16, type: 'png' },
			'renders an image wider than the canvas limit at a lower pixel ratio'
		)
	}
	test.end()
})
