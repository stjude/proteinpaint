import type { GetInterpolatedArg, InterpolatedDomainRange } from '../types/colorScale'

/** Generate an interpolated color scale based on the domain and range.
 * @param absMin - the absolute magnitude of the interpolation domain minimum value
 * @param absMax - the absolute magnitude of the interpolation domain minimum value
 * @param negInterpolator - function to convert number to css color
 * @param posInterpolator - function to convert number to css color
 * @param middleColor - Optional color to insert between two interpolated color ranges,
 * @numSteps - the target number of increments within the interpolation domain and range
 * @returns the domain and range for the interpolated color scale
 */
export function getInterpolatedDomainRange({
	absMin,
	absMax,
	negInterpolator,
	posInterpolator,
	middleColor = 'white',
	numSteps = 100
}: GetInterpolatedArg) {
	const stepSize = (absMax - absMin) / numSteps
	const neg: InterpolatedDomainRange = { values: [], colors: [] }
	const pos: InterpolatedDomainRange = { values: [], colors: [] }
	let n = -absMax
	for (let p = 0; p < absMax; p += stepSize) {
		if (negInterpolator) {
			n += stepSize
			const vn = n / absMax
			neg.values.push(vn)
			neg.colors.push(negInterpolator(-vn))
		}
		if (posInterpolator) {
			const vp = p / absMax
			pos.values.push(vp)
			pos.colors.push(posInterpolator(vp))
		}
	}

	if (negInterpolator && posInterpolator) {
		return {
			domain: [-absMax, ...neg.values, 0, ...pos.values, absMax],
			range: [negInterpolator(1), ...neg.colors, middleColor, ...pos.colors, posInterpolator(1)]
		}
	} else if (negInterpolator) {
		return {
			domain: [-absMax, ...neg.values, 0],
			range: [negInterpolator(0), ...neg.colors, negInterpolator(1)]
		}
	} else if (posInterpolator) {
		return {
			domain: [0, ...pos.values, absMax],
			range: [posInterpolator(0), ...pos.colors, posInterpolator(1)]
		}
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

/** Remove outliers from the domain array by removing the top and bottom 1% of values.
 * Prevents outlier ticks from appearing in the color scale.
 * Logic specifc to cnv data where the min and max value maybe zero.
 * @param domain - number array to remove outliers from
 * @returns the cleaned up domain array
 */
export function removeOutliers(domain: number[], firstPercent = 0.01, lastPercent = 0.99) {
	const sorted = domain.sort((a, b) => a - b)
	const first = sorted[0] == 0 ? 0 : sorted[Math.floor(sorted.length * firstPercent)]
	const last = sorted[sorted.length - 1] == 0 ? 0 : sorted[Math.floor(sorted.length * lastPercent)]
	return sorted.filter(d => d >= first && d <= last)
}

export function removeInterpolatedOutliers(domainRange) {
	const domain = removeOutliers(domainRange.domain)
	const range = domain.map(d => domainRange.range[domainRange.domain.indexOf(d)])
	return { domain, range }
}
