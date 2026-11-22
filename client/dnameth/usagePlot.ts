import { kernelDensityEstimator, kernelEpanechnikov } from '#shared/common.js'
import type { isoformParts } from './tk'

/* The share of an isoform per group, as the isoform rows of the methylation track draw it (./tk.ts isoformRows): a
violin per group, of the shares of its samples, with each sample a dot and the median a tick. */

// the shares are 0 to 1: the density is evaluated over that range
const grid = Array.from({ length: 101 }, (_, i) => i / 100)

/** the shares of part k in the samples of a group, in the order of parts.shares */
export function sharesOf(
	a: { parts: NonNullable<ReturnType<typeof isoformParts>>; groupOf: (string | undefined)[] },
	group: string,
	k: number
): number[] {
	return a.parts.shares.filter((s, j) => s.length && a.groupOf[j] === group).map(s => s[k])
}

/** one horizontal violin per group, h tall each and 2 px apart, with the group's samples as dots and its median as a
 * tick: shares from 0 to 1 on x */
export function drawShareViolins(g: any, o: { groups: { color: string; values: number[] }[]; x: any; h: number }) {
	o.groups.forEach((gr, i) => {
		const row = g.append('g').attr('transform', `translate(0,${i * (o.h + 2)})`)
		const values = [...gr.values].sort((p, q) => p - q)
		if (!values.length) return
		const mid = o.h / 2
		// only where there is density: the rest of 0 to 1 would draw as a flat line along the row
		const all = shareDensity(values)
		const first = all.findIndex(d => d[1] > 0),
			last = all.length - 1 - [...all].reverse().findIndex(d => d[1] > 0)
		const density = all.slice(Math.max(0, first - 1), last + 2)
		const top = Math.max(...density.map(d => d[1])) || 1
		// mirrored about the middle of the row, as a violin
		const y = (d: number) => (d / top) * (o.h / 2)
		const path =
			density.map(([v, d], j) => `${j ? 'L' : 'M'}${o.x(v)},${mid - y(d)}`).join('') +
			[...density]
				.reverse()
				.map(([v, d]) => `L${o.x(v)},${mid + y(d)}`)
				.join('') +
			'Z'
		row.append('path').attr('d', path).attr('fill', gr.color).attr('fill-opacity', 0.25).attr('stroke', gr.color)
		// the samples, spread over the row by a fixed sequence so that a redraw puts each where it was
		values.forEach((v, j) =>
			row
				.append('circle')
				.attr('cx', o.x(v))
				.attr('cy', 2 + ((j * 0.618034) % 1) * (o.h - 4))
				.attr('r', 1.2)
				.attr('fill', gr.color)
				.attr('fill-opacity', 0.6)
		)
		const median = values[Math.floor(values.length / 2)]
		row
			.append('line')
			.attr('x1', o.x(median))
			.attr('x2', o.x(median))
			.attr('y1', 0)
			.attr('y2', o.h)
			.attr('stroke', '#000')
			.attr('stroke-width', 1.5)
	})
}

/** the density of shares (0 to 1) over the grid: an Epanechnikov kernel, bandwidth by Silverman's rule, at least 0.02
 * so that a group of identical shares still has a shape */
export function shareDensity(values: number[]): [number, number][] {
	const n = values.length
	const mean = values.reduce((a, b) => a + b, 0) / n
	const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / Math.max(1, n - 1))
	const iqr = values[Math.floor((3 * n) / 4)] - values[Math.floor(n / 4)]
	const spread = Math.min(sd, iqr / 1.34) || sd
	const bw = Math.max(0.02, 0.9 * spread * n ** -0.2)
	return kernelDensityEstimator(kernelEpanechnikov(bw), grid)(values)
}

export function qText(q: number) {
	return q < 0.001 ? q.toExponential(1) : q.toFixed(3)
}
