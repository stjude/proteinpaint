import { scaleLinear } from 'd3-scale'
import { mclasscnvgain, mclasscnvloss } from '#shared/common'
import { table_cnv } from './itemtable'
import { table2col } from '#dom/table2col'

/*
to find out if server can return a cnv segment with >1 samples

click cnv legend to:
- hide all cnv
- show only
- hide gain
- hide loss
- set absoluteValueRenderMax
- set cnvMaxLength
also
- subtk maintains same absoluteMax as parent tk
*/

export function may_render_cnv(data, tk, block) {
	tk.cnv?.g.selectAll('*').remove()
	if (!data.cnv) {
		delete tk.subtk2height.cnv
		return
	}

	const [cnvBySample, cnvLst, absoluteMax] = prepData(data, tk, block)
	/* each elem is a row, which holds cnv segments of a sample
	{x1,x2} where x1<x2 no matter block is reversed or not, for onscreen rendering
	*/
	tk.cnv.cnvLst = cnvLst // raw list of events to be used in itemtable

	// FIXME if this tk is subtk keep value from parent tk and do not overwrite
	tk.cnv.absoluteMax = absoluteMax

	tk.cnv.colorScale = scaleLinear([-absoluteMax, 0, absoluteMax], [tk.cnv.lossColor, 'white', tk.cnv.gainColor]).clamp(
		true
	)

	const [rowheight, rowspace] = getRowHeight(cnvBySample, tk)

	let y = 0
	for (const sample of cnvBySample) {
		// all cnv segments of same sample are rendered in same row by y
		for (const c of sample.cnvs) {
			const x1 = Math.max(0, c.x1),
				x2 = Math.min(c.x2, block.width) // apply clip so segment box doesn't go beyond block
			tk.cnv.g
				.append('rect')
				.attr('x', x1)
				.attr('y', y)
				.attr('width', x2 - x1)
				.attr('height', rowheight)
				.attr('fill', tk.cnv.colorScale(c.value))
				.on('mouseover', event => {
					event.target.setAttribute('stroke', 'black')
					tk.itemtip.clear().show(event.clientX, event.clientY)
					const table = table2col({ holder: tk.itemtip.d })
					const cnv = structuredClone(c)
					cnv.samples = [{ sample_id: sample.sample_id }]
					table_cnv({ mlst: [cnv], tk }, table)
				})
				.on('mouseout', event => {
					event.target.setAttribute('stroke', '')
					tk.itemtip.hide()
				})
		}
		y += rowheight + rowspace
	}
	tk.subtk2height.cnv = y
}

function prepData(data, tk, block) {
	let maxAbsoluteValue = 0
	const sample2cnv = new Map() // k: sample_id, v: [{chr/start/stop/value/x1/x2}]
	const cnvLst = [] // raw list of events passing filter, each has structure of {samples:[]} to be used in itemtable

	for (const v of data.cnv) {
		// TODO report invalid data
		if (!v.chr) continue
		if (!Number.isFinite(v.value)) {
			// no value. to cope with ds supplying qualitative calls
			if (typeof v.class == 'string') {
				if (v.class == mclasscnvgain) {
					v.value = 1
				} else if (v.class == mclasscnvloss) {
					v.value = -1
				} else {
					continue
				}
			} else {
				continue
			}
		}
		if (!Number.isInteger(v.start) || !Number.isInteger(v.stop)) continue

		const t1 = block.seekcoord(v.chr, v.start)[0]
		if (!t1) continue
		const t2 = block.seekcoord(v.chr, v.stop)[0]
		if (!t2) continue

		// the segment is visible

		const j = { chr: v.chr, start: v.start, stop: v.stop, value: v.value, dt: v.dt }
		if (t1.x > t2.x) {
			// block is reverse
			j.x1 = t2.x
			j.x2 = t1.x
		} else {
			j.x1 = t1.x
			j.x2 = t2.x
		}

		if (!Array.isArray(v.samples)) continue

		// valid

		cnvLst.push(v)

		for (const s of v.samples) {
			// {sample_id}
			if (!sample2cnv.has(s.sample_id)) sample2cnv.set(s.sample_id, [])
			sample2cnv.get(s.sample_id).push(structuredClone(j))
		}

		maxAbsoluteValue = Math.max(maxAbsoluteValue, Math.abs(v.value))
	}

	const samples = [] // flatten to array. each sample is one elem showing in one row
	for (const [s, cnvs] of sample2cnv) {
		samples.push({
			sample_id: s,
			cnvs,
			x1: Math.min(...cnvs.map(i => i.x1)),
			x2: Math.max(...cnvs.map(i => i.x2))
		})
	}

	samples.sort((a, b) => a.x1 - b.x1)

	return [samples, cnvLst, Math.min(tk.cnv.absoluteValueRenderMax, maxAbsoluteValue)]
}

// use same sample number cutoff values in scale and capping
const rhScale = scaleLinear([40, 120], [10, 1])
function getRowHeight(samples, tk) {
	if (samples.length > 120) return [1, 0]
	if (samples.length < 40) return [10, 1]
	return [Math.ceil(rhScale(samples.length)), 1]
}
