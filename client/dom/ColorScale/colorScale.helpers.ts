import type { GetInterpolatedArg } from './types'

/** Generate an interpolated color scale based on the domain and range.
 * @param absMin - the absolute magnitude of the interpolation domain minimum value
 * @param absMax - the absolute magnitude of the interpolation domain minimum value
 * @param negInterpolator - function to convert number to css color
 * @param posInterpolator - function to convert number to css color
 * @param middleColor - Optional color to insert between two interpolated color ranges,
 * @param totalNumSteps - the target number of increments within the interpolation domain and range
 * @returns the domain and range for the interpolated color scale
 */

type InterpolatedDomainRange = {
	values: Set<number>
	colors: string[]
}

export function getInterpolatedDomainRange({
	absMin,
	absMax,
	negInterpolator,
	posInterpolator,
	middleColor = 'white',
	totalNumSteps = 100
}: GetInterpolatedArg) {
	/** If the range includes both negative and positive values, dividing
	 * the steps equally between the neg and pos values ensures the
	 * return domain does not exceed the intended length (i.e. total num steps)*/
	const denominator = negInterpolator && posInterpolator ? totalNumSteps / 2 : totalNumSteps
	const stepSize = (absMax - absMin) / denominator
	const neg: InterpolatedDomainRange = { values: new Set(), colors: [] }
	const pos: InterpolatedDomainRange = { values: new Set(), colors: [] }
	let n = -absMax
	for (let p = 0; p < absMax; p += stepSize) {
		if (p == 0) continue //In all instances, 0 is added to the final domain.
		if (negInterpolator) {
			n += stepSize
			const vn = n // / absMax
			neg.values.add(vn)
			neg.colors.push(negInterpolator(-vn / absMax))
		}
		if (posInterpolator) {
			const vp = p // / absMax // do not divide by absMax, use raw value
			pos.values.add(vp)
			pos.colors.push(posInterpolator(vp / absMax))
		}
	}
	/** Keep separate solution for now to reevlautate at a later time. */
	// let p = absMin,
	// 	n = -absMax //- stepSize
	// for (let i = 0; i < numSteps; i++) {
	// 	if (negInterpolator && !neg.values.has(n)) {
	// 		/** Include the raw value in the domain and calculate the color
	// 		 * as a percent of the absMax. */
	// 		neg.values.add(n)
	// 		neg.colors.push(negInterpolator(-n / absMax))
	// 	}
	// 	// increment negative value after adding entries to neg.values/colors
	// 	n += stepSize
	// 	p += stepSize
	// 	if (posInterpolator && !pos.values.has(p)) {
	// 		pos.values.add(p)
	// 		pos.colors.push(posInterpolator(p / absMax))
	// 	}
	// }

	if (negInterpolator && posInterpolator) {
		const domain = [-absMax, ...neg.values, 0, ...pos.values, absMax]
		const range = [negInterpolator(1), ...neg.colors, middleColor, ...pos.colors, posInterpolator(1)]
		if (domain.length != range.length)
			throw new Error(`unable to generate same-sized numeric -/+ domain and color range`)
		return { domain, range }
	} else if (negInterpolator) {
		const domain = [-absMax, ...neg.values, 0]
		const range = [negInterpolator(1), ...neg.colors, negInterpolator(0)]
		if (domain.length != range.length) throw new Error(`unable to generate same-sized negative domain and color range`)
		return { domain, range }
	} else if (posInterpolator) {
		const domain = [0, ...pos.values, absMax]
		const range = [posInterpolator(0), ...pos.colors, posInterpolator(1)]
		if (domain.length != range.length) throw new Error(`unable to generate same-sized positive domain and color range`)
		return { domain, range }
	} else {
		throw `missing both negInterpolator and posInterpolator in getInterpolatedDomainRange()`
	}
}

/** Calculate the color difference between two colors.
 * @param rgb1 - first color in rgb format
 * @param rgb2 - second color in rgb format
 * @returns the max difference between the two colors
 */
export function colorDelta(rgb1, rgb2) {
	// TODO: use ciede2000 when the installed d3-color version has it
	// lab =  CIELAB, approximate human-perceived color simiilarity
	// const color1 = lab(rgb1);
	// const color2 = lab(rgb2);
	// return ciede2000(color1, color2)

	// for now, simply compute the max diff across rgb components between the 2 colors
	const a = rgb1.split('(')[1].slice(0, -1).split(',').slice(0, 3)
	const b = rgb2.split('(')[1].slice(0, -1).split(',').slice(0, 3)
	let maxDiff = 0
	for (const [i, v] of a.entries()) {
		const d = v - b[i]
		if (maxDiff < d) maxDiff = d
	}
	return maxDiff
}

/** Remove outliers from the domain array by removing the top and bottom percent of values.
 * Prevents outlier ticks from appearing in the color scale.
 * @param domain - number array to remove outliers from
 * @returns the domain array without outliers
 */
export function removeOutliers(domain: number[], _opts = {}) {
	const opts = Object.assign(
		{
			minPercentile: 0.01,
			maxPercentile: 0.99,
			baseValue: undefined // if specified and detected in the domain, this value must not be considered an outlier
		},
		_opts
	)
	const sorted = domain.sort((a, b) => a - b)
	const first = sorted[0] === opts.baseValue ? opts.baseValue : sorted[Math.floor(sorted.length * opts.minPercentile)]
	const last =
		sorted[sorted.length - 1] === opts.baseValue
			? opts.baseValue
			: sorted[Math.floor(sorted.length * opts.maxPercentile)]
	let calculatedArray = sorted.filter(d => d >= first && d <= last)
	if (calculatedArray.length === 0) {
		/** It's possible user inputs restrict the range to the point
		 * where no values are included. In this instance, the smallest possible
		 * range is returned to allow the color scale to render. */
		const hasNeg = sorted[0] < 0
		const hasBoth = hasNeg && sorted[sorted.length - 1] > 0
		const idxClosestToZero = () => {
			return sorted.reduce((closestIdx, currentValue, currentIdx) => {
				const closestValue = sorted[closestIdx]
				return Math.abs(currentValue) < Math.abs(closestValue) ? currentIdx : closestIdx
			}, 0)
		}
		const idx = hasBoth ? idxClosestToZero() : hasNeg ? sorted.length - 1 : 0
		const firstValue = sorted[idx] ?? 0
		const secondValue = hasBoth
			? sorted[idx - 1] ?? firstValue
			: hasNeg
			? sorted[idx - 1] ?? firstValue
			: sorted[idx + 1] ?? firstValue
		const thirdValue = hasBoth
			? sorted[idx + 1] ?? firstValue
			: hasNeg
			? sorted[idx - 2] ?? secondValue
			: sorted[idx + 2] ?? secondValue
		calculatedArray = [firstValue, secondValue, thirdValue].sort((a, b) => a - b)
	}
	return calculatedArray
}

/** Removes outlier values from the interpolated domain/range object.
 * @param domainRange domain and range object returned from getInterpolatedDomainRange
 * @param firstPercent Optional percentage to calculate the min percentile cutoff
 * @param lastPercent Optional percentage to calculate the max percentile cutoff
 * @returns
 */
export function removeInterpolatedOutliers(
	domainRange: { domain: number[]; range: string[] },
	minPercentile = 0.01,
	maxPercentile = 0.99
) {
	const domain = removeOutliers(domainRange.domain, { minPercentile, maxPercentile })
	const range = domain.map(d => domainRange.range[domainRange.domain.indexOf(d)])
	return { domain, range }
}

/** Compute the num of desired ticks based on the domain range.
 * Helper mimics the behavior of d3's scale.ticks() method,
 * which calculates the tick num based on the domain
 * range and a target number of intervals. Affords the caller more precision.
 * @param domainRange - the range of the domain (max - min)
 * @param targetIntervals - the desired number of intervals between ticks (i.e. numTicks -1)
 * @returns the computed number of ticks
 */
export function computeTicks(domainRange: number, targetIntervals: number): number {
	if (!isFinite(domainRange) || domainRange === 0 || targetIntervals == 0) return 1
	if (domainRange < 0 || targetIntervals < 0) {
		throw new Error(
			`Neither domainRange or targetIntervals can be a non-negative number. Received domainRange: ${domainRange}, targetIntervals: ${targetIntervals}`
		)
	}
	const intervals = Math.max(1, targetIntervals ?? 4)
	const step = domainRange / intervals

	if (!isFinite(step) || step <= 0) return 1
	return step <= 2 ? 2 : step <= 3 ? 3 : 5
}
