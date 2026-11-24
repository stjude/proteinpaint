import tape from 'tape'
import { getContinuousValueTransform, getStoredValueRange } from '../continuousTransform.ts'

/* Tests
	- getContinuousValueTransform()
	- getStoredValueRange()
*/

tape('\n', test => {
	test.comment('-***- continuousTransform -***-')
	test.end()
})

tape('getContinuousValueTransform()', test => {
	for (const q of [undefined, {}, { mode: 'continuous' }, { mode: 'continuous', scale: 1 }]) {
		test.equal(getContinuousValueTransform(q), undefined, `no transform for q=${JSON.stringify(q)}`)
	}
	test.equal(
		getContinuousValueTransform({ mode: 'discrete', scale: 10, transform: 'log10p1' }),
		undefined,
		'no transform for a q that is not continuous'
	)

	const scaled = getContinuousValueTransform({ mode: 'continuous', scale: 10 })!
	test.equal(scaled.forward(25), 2.5, 'q.scale should divide a value')
	test.equal(scaled.inverse(2.5), 25, 'the inverse of q.scale should multiply a value')

	const logged = getContinuousValueTransform({ mode: 'continuous', transform: 'log10p1', scale: 10 })!
	test.equal(logged.forward(99), 2, "q.transform='log10p1' should give log10(value+1), and ignore q.scale")
	test.equal(logged.forward(0), 0, 'log10(0+1) should be 0')
	test.equal(logged.inverse(2), 99, 'the inverse of log10(value+1) should be 10^value-1')
	test.notOk(Number.isFinite(logged.forward(-1)), 'a value of -1 should have no log')

	test.throws(
		() => getContinuousValueTransform({ mode: 'continuous', transform: 'xyz' }),
		/unknown tw.q.transform/,
		'should throw on an unknown transform'
	)
	test.throws(
		() => getContinuousValueTransform({ mode: 'continuous', scale: 'abc' }),
		/invalid tw.q.scale/,
		'should throw on a scale that is not a number'
	)
	test.end()
})

tape('getStoredValueRange()', test => {
	test.deepEqual(
		getStoredValueRange({ mode: 'continuous' }, 1, 2),
		{ start: 1, stop: 2 },
		'should keep the range without a transform'
	)

	const q = { mode: 'continuous', transform: 'log10p1' }
	const t = getContinuousValueTransform(q)!
	const values = [0, 0.3, 7, 37.5, 1234.567]
	// the range of the plotted values, as a box plot gives for its plotted min and max
	const range = getStoredValueRange(q, t.forward(values[1]), t.forward(values[3]))
	const inRange = values.filter(v => v >= range.start && v <= range.stop)
	test.deepEqual(inRange, [0.3, 7, 37.5], 'the stored values at the bounds should be in the range')
	test.ok(range.start > 0.3 - 1e-6 && range.stop < 37.5 + 1e-6, 'the range should be widened only by a tiny margin')

	const scaled = getStoredValueRange({ mode: 'continuous', scale: 10 }, 0.03, 0.07)
	test.ok(scaled.start <= 0.3 && scaled.stop >= 0.7, 'should multiply the bounds by q.scale')
	test.end()
})
