import { decimalPlacesUntilFirstNonZero } from '../shared/roundValue'

/**
 * Correct an array of numbers with the appropriate number of decimal places
 * based on the range of numeric distribution for scales, axes, etc.
 * @param nums array of numbers to be sorted and corrected
 * @returns array of sorted numbers with corrected decimal places
 */
export function niceNumLabels(nums: number[]) {
	// Sort array and find the difference in distribution
	const sorted = nums.sort((a, b) => a - b)
	const abs = Math.abs(sorted[0] - sorted[sorted.length - 1])

	// Find the number of decimals
	const zeroDecimalNum = decimalPlacesUntilFirstNonZero(abs)
	/** > 10, no decimals
	 *  10 - 1, 1 decimal
	 * <= 1, 1 decimal past the first non-zero
	 */
	const decimals2Show = abs >= 10 ? 0 : abs >= 1 ? 1 : zeroDecimalNum + 2

	return nums.map(num => Number(num.toFixed(decimals2Show)))
}
