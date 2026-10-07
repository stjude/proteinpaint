import tape from 'tape'
import { validateCanvasSize, validateBinTotal } from '../bw.js'

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
	test.throws(
		() => validateCanvasSize({ width: 6000, barheight: 2000, devicePixelRatio: 5 }),
		/image size out of bound/,
		'rejects a size that is within each limit but too large in area'
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
