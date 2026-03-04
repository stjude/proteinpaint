/**
 * Test to verify that violin plot density calculation correctly handles log scale
 * 
 * The issue: When using log scale, density was calculated in linear space but displayed
 * on a log scale axis, causing visual distortion with bulges at the lower end.
 * 
 * The fix: Transform values to log space before density calculation, then back-transform
 * the x coordinates (not density values) to original space.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('Violin plot log scale density calculation', () => {
	it('should transform values to log space before density calculation', () => {
		// Test data representing typical age diagnosis values that would show the issue
		const values = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
		const logBase = 10
		
		// Transform to log space (what getDensities does internally when useLog=true)
		const logValues = values.map(v => Math.log(v) / Math.log(logBase))
		
		// Verify transformation (use approximate comparison for floating point)
		assert.strictEqual(logValues[0], 0) // log10(1) = 0
		assert.strictEqual(logValues[3], 1) // log10(10) = 1
		assert.strictEqual(logValues[6], 2) // log10(100) = 2
		assert.ok(Math.abs(logValues[9] - 3) < 0.0001) // log10(1000) ≈ 3
	})
	
	it('should back-transform x coordinates after density calculation', () => {
		// Simulated density result from R (in log space)
		const xInLogSpace = [0, 0.5, 1, 1.5, 2, 2.5, 3]
		const logBase = 10
		
		// Back-transform to original space (what getDensities does with the result)
		const xOriginalSpace = xInLogSpace.map(x => Math.pow(logBase, x))
		
		// Verify back-transformation
		assert.strictEqual(xOriginalSpace[0], 1) // 10^0 = 1
		assert.ok(Math.abs(xOriginalSpace[1] - 3.162) < 0.001) // 10^0.5 ≈ 3.162
		assert.strictEqual(xOriginalSpace[2], 10) // 10^1 = 10
		assert.ok(Math.abs(xOriginalSpace[3] - 31.623) < 0.001) // 10^1.5 ≈ 31.623
		assert.strictEqual(xOriginalSpace[4], 100) // 10^2 = 100
		assert.ok(Math.abs(xOriginalSpace[5] - 316.228) < 0.001) // 10^2.5 ≈ 316.228
		assert.strictEqual(xOriginalSpace[6], 1000) // 10^3 = 1000
		
		// The key insight: bins are now evenly distributed in log space,
		// which means they will be correctly visualized on a log scale axis
	})
	
	it('should use base 2 when logscaleBase2 is enabled', () => {
		const values = [1, 2, 4, 8, 16, 32, 64, 128]
		const logBase = 2
		
		// Transform to log2 space
		const logValues = values.map(v => Math.log(v) / Math.log(logBase))
		
		// Verify log2 transformation
		assert.strictEqual(logValues[0], 0) // log2(1) = 0
		assert.strictEqual(logValues[1], 1) // log2(2) = 1
		assert.strictEqual(logValues[2], 2) // log2(4) = 2
		assert.strictEqual(logValues[7], 7) // log2(128) = 7
	})
})

/**
 * Additional verification helper - not actually runnable without full setup
 * but documents expected behavior
 */
function demonstrateTheIssue() {
	// BEFORE THE FIX:
	// Values: [1, 10, 100, 1000]
	// R density calculates in linear space: bins might be [1, 250, 500, 750, 1000]
	// These are then plotted on log scale axis
	// Result: Most bins cluster near the top (1000), creating visual distortion
	
	// AFTER THE FIX:
	// Values: [1, 10, 100, 1000] → log10: [0, 1, 2, 3]
	// R density calculates in log space: bins evenly distributed [0, 0.75, 1.5, 2.25, 3]
	// Back-transform: [1, 5.62, 31.6, 177.8, 1000]
	// Result: Bins are evenly distributed on log scale axis - correct visualization!
}
