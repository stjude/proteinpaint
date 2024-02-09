import { scaleLinear } from 'd3-scale'

export function may_render_cnv(data, tk, block) {
	tk.cnv.g.selectAll('*').remove()
	if (!data.cnv) return

	const [cnvLst, absoluteMax] = prepData(data, tk, block)
	// each of cnvLst[]: {x1,x2} where x1<x2 no matter block is reversed or not, for onscreen rendering

	const colorScale = scaleLinear([-absoluteMax, 0, absoluteMax], [tk.cnv.lossColor, 'white', tk.cnv.gainColor]).clamp(
		true
	)

	const [rowheight, rowspace] = getRowHeight(cnvLst, tk)

	let y = 0
	for (const item of cnvLst) {
		tk.cnv.g
			.append('rect')
			.attr('x', item.x1)
			.attr('y', y)
			.attr('width', item.x2 - item.x1)
			.attr('height', rowheight)
			.attr('fill', colorScale(item.value))
		y += rowheight + rowspace
	}
}

function prepData(data, tk, block) {
	let maxAbsoluteValue = 0
	const cnvLst = [] // drop invalid ones
	for (const v of data.cnv) {
		// TODO report invalid data
		if (!v.chr) continue
		if (!Number.isFinite(v.value)) continue
		if (!Number.isInteger(v.start) || !Number.isInteger(v.stop)) continue

		const t1 = block.seekcoord(v.chr, v.start)[0]
		if (!t1) continue
		const t2 = block.seekcoord(v.chr, v.stop)[0]
		if (!t2) continue

		// the segment is visible

		const j = structuredClone(v)
		if (t1.x > t2.x) {
			// block is reverse
			j.x1 = t2.x
			j.x2 = t1.x
		} else {
			j.x1 = t1.x
			j.x2 = t2.x
		}

		cnvLst.push(j)
		maxAbsoluteValue = Math.max(maxAbsoluteValue, v.value)
	}

	// each segment takes one row.
	// FIXME segments of same sample should be put together
	cnvLst.sort((i, j) => i.x1 - j.x1)

	return [cnvLst, Math.min(5, maxAbsoluteValue)]
}

function getRowHeight(cnvLst, tk) {
	return [5, 1]
}
