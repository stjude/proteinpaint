import { scaleLinear } from 'd3-scale'
import { mclass } from '#shared/common.js'
import { table_cnv, itemtable_oneItem } from './itemtable'
import { axisRight } from 'd3-axis'
import { table2col, axisstyle } from '#dom'

/* (important param for cnv tk rendering thus is put at top)
arg is an array. each element is a row of either:
	- all cnv segments per sample (for each sample, all cnv are shown in one row)
	- a stack that will be shown as a row

logic:

	if there are small enough number of rows:
	- max out row height to maxRowHeight with spacing. total subtrack height shouldn't exceed limit

	if number of rows exceeds maxTkHeight:
		return fractional row height (maxTkHeight/#rows) for canvas plotting
	
	else:
		scale 
use same sample number cutoff values in scale and capping
*/
const maxRowHeight = 10
const maxTkHeight = 200 // cnv tk max height when skewer is present
function getRowHeight(rows, tk) {
	let maxh = maxTkHeight
	if (tk.subtk2height.skewer == 0) {
		/* assumes that skewer subtk is already rendered and height already determined. if skewer height=0, allow to double cnv max height due to:
		- tk is hardcoded cnv-only
		- there's no skewer data in view range
		*/
		maxh *= 2
	}

	// v is computed row height and used for deriving actual row height
	const v = maxh / rows.length
	if (v > maxRowHeight) return [maxRowHeight, 1] // small enough number of rows. use max height
	if (v > 3) return [Math.floor(v), 1] // big enough height, round to small integer with spacing
	if (v > 1) return [Math.floor(v), 0] // same above, no spacing
	return [v, 0] // very small height. no spacing
}

/*
tk.cnv = {

	// following are optional setting when tk.cnv.cnvGainCutoff is used (cnv using numeric values)
	presetMax: number // if set, use this to set colorscale domain
	absoluteMax: number // if presetMax is not set, use this for colorscale domain
}

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
	if (!tk.cnv) return
	// reset all properties indicative of run state; other code relies on them to detect if in segment or density mode
	tk.cnv?.g.selectAll('*').remove()
	delete tk.cnv.cnvLst
	delete tk.cnv.cnvInDensity
	delete tk.cnv.cnvMsg

	if (data.cnv) {
		if (!Array.isArray(data.cnv.cnvs)) throw 'data.cnv.cnvs[] not array'
		tk.cnv.cnvMsg = data.cnv.cnvMsg
		// has moderate amounts of segments. show as lines
		renderSegments(data, tk, block)
		// tk.cnv.cnvLst created
		return
	}
	if (data.cnvDensity) {
		tk.cnv.cnvInDensity = true
		tk.cnv.cnvMsg = data.cnvDensity.cnvMsg
		renderDensity(data, tk, block)
		return
	}

	tk.subtk2height.cnv = 0 // set to 0 in case cnv was showing before and now turned off so as to remove its space
	if (tk.cnv) tk.cnv.cnvLst = [] // a trick to hide legend colorscale
}

function renderDensity(data, tk, block) {
	/* render two subtracks, one for density of gain and loss
	 */
	tk.cnv.g
		.append('image')
		.attr('width', block.width)
		.attr('height', tk.cnv.density.barheight)
		.attr('xlink:href', data.cnvDensity.gain.src)
	tk.cnv.g
		.append('image')
		.attr('width', block.width)
		.attr('height', tk.cnv.density.barheight)
		.attr('xlink:href', data.cnvDensity.loss.src)
		.attr('y', tk.cnv.density.barheight)

	// todo show axis in tk.gleft
	axisstyle({
		axis: tk.cnv.g
			.append('g')
			.attr('transform', `translate(-1,0)`)
			.call(
				axisRight()
					.scale(scaleLinear().domain([0, data.cnvDensity.max]).range([tk.cnv.density.barheight, 0]))
					.tickValues([0, data.cnvDensity.max])
			),
		color: 'black',
		showline: true
	})
	axisstyle({
		axis: tk.cnv.g
			.append('g')
			.attr('transform', `translate(-1,${tk.cnv.density.barheight})`)
			.call(
				axisRight()
					.scale(scaleLinear().domain([0, data.cnvDensity.max]).range([0, tk.cnv.density.barheight]))
					.tickValues([0, data.cnvDensity.max])
			),
		color: 'black',
		showline: true
	})
	tk.cnv.g
		.append('text')
		.text('Gain')
		.attr('font-size', block.labelfontsize * 0.9)
		.attr('x', 5)
		.attr('y', tk.cnv.density.barheight / 2)
	tk.cnv.g
		.append('text')
		.text('Loss')
		.attr('font-size', block.labelfontsize * 0.9)
		.attr('x', 5)
		.attr('y', tk.cnv.density.barheight * 1.5)

	tk.subtk2height.cnv = tk.cnv.density.barheight * 2
}

function renderSegments(data, tk, block) {
	const [cnvBySample, cnvLst, absoluteMax] = prepData(data, tk, block)
	tk.cnv.cnvLst = cnvLst // raw list of events to be used in itemtable

	// FIXME if this tk is subtk keep value from parent tk and do not overwrite
	tk.cnv.absoluteMax = absoluteMax

	tk.cnv.colorScale = scaleLinear(
		tk.cnv.presetMax ? [-tk.cnv.presetMax, 0, tk.cnv.presetMax] : [-absoluteMax, 0, absoluteMax],
		[tk.cnv.lossColor, 'white', tk.cnv.gainColor]
	).clamp(true)

	const [rowheight, rowspace] = getRowHeight(cnvBySample || cnvLst, tk)

	/* rendering
	when using samples:
		each sample is a row, all cnv segments of this sample are rendered into this row; number of rows is number of unique samples
	when not using samples:
		total number of rows are determined by stacking segments
	{x1,x2} where x1<x2 no matter block is reversed or not, for onscreen rendering
	*/

	if (cnvBySample) {
		for (const sample of cnvBySample) {
			// all cnv segments of same sample are rendered in same row. segments have already been sorted
			// do not consider overlapping segments. sample is not supposed to have that
			for (const c of sample.cnvs) {
				plotOneSegment(c, sample.y * (rowheight + rowspace), rowheight, tk, block, sample)
			}
		}
	} else {
		// no sample
		for (const c of cnvLst) {
			plotOneSegment(c, c.y * (rowheight + rowspace), rowheight, tk, block)
		}
	}

	const rowc = (cnvBySample || cnvLst).length
	tk.subtk2height.cnv = rowc * rowheight + (rowc - 1) * rowspace
}

export function prepData(data, tk, block) {
	// return following 3 variables. contents will vary depends on if sample is present
	let maxAbsoluteValue = 0 // updated if cnv uses numeric value
	const sample2cnv = new Map() // k: sample_id, v: [{chr/start/stop/value/x1/x2}]. only populated when cnv has sample, in order to show cnvs from the same sample grouped together rather than scattered
	const cnvLst = [] // raw list of events passing filter, each has structure of {samples:[]} to be used in itemtable. is used for cnv rendering when there's no sample

	for (const v of data.cnv.cnvs) {
		if (!v.chr) continue
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

		// only when cnv uses numeric value
		if (Number.isFinite(v.value)) maxAbsoluteValue = Math.max(maxAbsoluteValue, Math.abs(v.value))

		cnvLst.push(j)

		if (Array.isArray(v.samples)) {
			// this cnv has sample (meaning all events should have sample)
			for (const s of v.samples) {
				// {sample_id}
				if (!sample2cnv.has(s.sample_id)) sample2cnv.set(s.sample_id, [])
				sample2cnv.get(s.sample_id).push(structuredClone(j))
			}
		}
	}

	let samples
	if (sample2cnv.size) {
		// group cnv by samples
		samples = [] // flatten to array. each sample is one elem showing in one row
		for (const [s, cnvs] of sample2cnv) {
			cnvs.sort((a, b) => a.x1 - b.x1) // important to guard against overlapping segments of a sample and allow such to be rendered
			samples.push({
				sample_id: s,
				cnvs,
				x1: Math.min(...cnvs.map(i => i.x1)),
				x2: Math.max(...cnvs.map(i => i.x2))
			})
		}
		samples.sort((a, b) => a.x1 - b.x1)
		// each sample will be rendered into one row. no samples will share rows. do not perform stacking
		for (let i = 0; i < samples.length; i++) samples[i].y = i
	} else {
		// not using samples. stack segments to plot
		cnvLst.sort((a, b) => a.x1 - b.x1)
		stackRows(cnvLst, 0)
	}

	return [samples, cnvLst, Math.min(tk.cnv.absoluteValueRenderMax, maxAbsoluteValue)]
}

function plotOneSegment(c, y, rowheight, tk, block, sample) {
	const x1 = Math.max(0, c.x1),
		x2 = Math.min(c.x2, block.width) // apply clip so segment box doesn't go beyond block
	tk.cnv.g
		.append('rect')
		.attr('x', x1)
		.attr('y', y)
		.attr('width', x2 - x1)
		.attr('height', Math.max(rowheight, 1))
		.attr('fill', Number.isFinite(c.value) ? tk.cnv.colorScale(c.value) : mclass[c.class].color)
		.on('mouseover', event => {
			event.target.setAttribute('stroke', 'black')
			tk.hovertip.clear().show(event.clientX, event.clientY)
			const table = table2col({ holder: tk.hovertip.d })
			table_cnv({ mlst: [c], tk }, table)
			if (sample) {
				const [t1, t2] = table.addRow()
				t1.text('Sample')
				t2.text(sample.sample_id)
			}
		})
		.on('mouseout', event => {
			event.target.setAttribute('stroke', '')
			tk.hovertip.hide()
		})
		.on('click', async event => {
			// TODO show more contents in click menu
			tk.itemtip.clear().show(event.clientX, event.clientY)
			await itemtable_oneItem({
				mlst: [c],
				tk,
				block,
				div: tk.itemtip.d
			})

			return

			const table = table2col({ holder: tk.itemtip.d })
			const cnv = structuredClone(c)

			if (sample) {
				// tricky! sample is optional
				cnv.samples = [{ sample_id: sample.sample_id }]
			}

			table_cnv({ mlst: [cnv], tk }, table, true)
		})
}

/* TODO sharable function.
lst:
	each item {x1,x2}. on finish, .y=integer is assigned to every item as stack id, or row number
spacing:
	mininum spacing width between items in one stack
*/
function stackRows(lst, spacing) {
	const stacks = [] // each value is screen x position of a stack
	for (const item of lst) {
		for (let i = 0; i < stacks.length; i++) {
			if (stacks[i] + spacing < item.x1) {
				// falls into this stack
				stacks[i] = item.x2
				item.y = i
				break
			}
		}
		if (!('y' in item)) {
			// item goes to a new stack
			item.y = stacks.length
			stacks.push(item.x2)
		}
	}
}
