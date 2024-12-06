import type { GetInterpolatedArg, InterpolatedDomainRange } from '../types/colorScale'

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
