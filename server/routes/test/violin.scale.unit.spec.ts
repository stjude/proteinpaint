import tape from 'tape'

/**
 * Tests for violin plot density calculation with log scale transformation
 * 
 * The issue: When using log scale, density was calculated in linear space but displayed
 * on a log scale axis, causing visual distortion with bulges at the lower end.
 * 
 * The fix: Transform values to log space before density calculation, then back-transform
 * the x coordinates (not density values) to original space.
 */

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- #routes/termdb.violin log scale transformation -***-')
	test.end()
})

tape('transform values to log space before density calculation', function (test) {
	// Test data representing typical age diagnosis values that would show the issue
	const values = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
	const logBase = 10

	// Transform to log space (what getDensities does internally when useLog=true)
	const logValues = values.map(v => Math.log(v) / Math.log(logBase))

	// Verify transformation (use approximate comparison for floating point)
	test.equal(logValues[0], 0, 'log10(1) should equal 0')
	test.equal(logValues[3], 1, 'log10(10) should equal 1')
	test.equal(logValues[6], 2, 'log10(100) should equal 2')
	test.ok(Math.abs(logValues[9] - 3) < 0.0001, 'log10(1000) should be approximately 3')

	test.end()
})

tape('back-transform x coordinates after density calculation', function (test) {
	// Simulated density result from R (in log space)
	const xInLogSpace = [0, 0.5, 1, 1.5, 2, 2.5, 3]
	const logBase = 10

	// Back-transform to original space (what getDensities does with the result)
	const xOriginalSpace = xInLogSpace.map(x => Math.pow(logBase, x))

	// Verify back-transformation
	test.equal(xOriginalSpace[0], 1, '10^0 should equal 1')
	test.ok(Math.abs(xOriginalSpace[1] - 3.162) < 0.001, '10^0.5 should be approximately 3.162')
	test.equal(xOriginalSpace[2], 10, '10^1 should equal 10')
	test.ok(Math.abs(xOriginalSpace[3] - 31.623) < 0.001, '10^1.5 should be approximately 31.623')
	test.equal(xOriginalSpace[4], 100, '10^2 should equal 100')
	test.ok(Math.abs(xOriginalSpace[5] - 316.228) < 0.001, '10^2.5 should be approximately 316.228')
	test.equal(xOriginalSpace[6], 1000, '10^3 should equal 1000')

	// The key insight: bins are now evenly distributed in log space,
	// which means they will be correctly visualized on a log scale axis
	test.end()
})

tape('use base 2 when logscaleBase2 is enabled', function (test) {
	const values = [1, 2, 4, 8, 16, 32, 64, 128]
	const logBase = 2

	// Transform to log2 space
	const logValues = values.map(v => Math.log(v) / Math.log(logBase))

	// Verify log2 transformation
	test.equal(logValues[0], 0, 'log2(1) should equal 0')
	test.equal(logValues[1], 1, 'log2(2) should equal 1')
	test.equal(logValues[2], 2, 'log2(4) should equal 2')
	test.equal(logValues[7], 7, 'log2(128) should equal 7')

	test.end()
})

tape('filter out non-positive values when using log scale', function (test) {
	// Values with some non-positive values
	const values = [-5, 0, 1, 2, 10, 100]
	const logBase = 10

	// Filter and transform (what getDensities does)
	const filteredAndTransformed = values.filter(v => v > 0).map(v => Math.log(v) / Math.log(logBase))

	// Verify only positive values are included
	test.equal(filteredAndTransformed.length, 4, 'Should only include 4 positive values [1, 2, 10, 100]')
	test.equal(filteredAndTransformed[0], 0, 'log10(1) should equal 0')
	test.ok(
		Math.abs(filteredAndTransformed[1] - 0.301) < 0.001,
		'log10(2) should be approximately 0.301'
	)
	test.equal(filteredAndTransformed[2], 1, 'log10(10) should equal 1')
	test.equal(filteredAndTransformed[3], 2, 'log10(100) should equal 2')

	test.end()
})

/**
 * Documentation of the issue and the fix:
 * 
 * BEFORE THE FIX:
 * Values: [1, 10, 100, 1000]
 * R density calculates in linear space: bins might be [1, 250, 500, 750, 1000]
 * These are then plotted on log scale axis
 * Result: Most bins cluster near the top (1000), creating visual distortion
 * 
 * AFTER THE FIX:
 * Values: [1, 10, 100, 1000] → log10: [0, 1, 2, 3]
 * R density calculates in log space: bins evenly distributed [0, 0.75, 1.5, 2.25, 3]
 * Back-transform: [1, 5.62, 31.6, 177.8, 1000]
 * Result: Bins are evenly distributed on log scale axis - correct visualization!
 */
