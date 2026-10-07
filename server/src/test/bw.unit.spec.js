import tape from 'tape'
import { validateCanvasSize } from '../bw.js'

tape('\n', test => {
	test.pass('-***- bw specs -***-')
	test.end()
})

tape('validateCanvasSize()', test => {
	const ok = { width: 800, barheight: 50, devicePixelRatio: 2 }
	test.doesNotThrow(() => validateCanvasSize(ok), 'accepts a normal size')
	test.doesNotThrow(() => validateCanvasSize({ width: 800, barheight: 50 }), 'accepts a missing devicePixelRatio')
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
