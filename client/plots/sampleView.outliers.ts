import type { SampleOutlierRow, SampleOutliersKind, TermdbSampleOutliersResponse } from '#types'
import type { Sample, SampleTool, ToolContext } from './sampleView.tiles.ts'
import { filterInit } from '#filter'
import { axisstyle } from '#dom'
import { axisBottom } from 'd3-axis'
import { scaleLinear } from 'd3-scale'

/*********************************************************************
 * sampleView outlier tiles
 *
 * The gene sets (ssGSEA) or genes (gene expression) whose value in the
 * sample is unusually high or low against a reference group of samples:
 * all samples, the samples sharing the sample's value of a term set in
 * ds.cohort.termdb.sampleView.outliers (e.g. same diagnosis), or a custom
 * group built with a filter, by z-score (termdb/sampleOutliers). The face
 * shows the top rows each way; expanded shows the ranked rows and a choice
 * of reference group. Each row shows the sample's value on the group's
 * box, or a bar of the z-score without a box: gene set scores all on one
 * axis, as they are in a narrow range, and genes each on its own log axis,
 * as their values range widely.
 *********************************************************************/

type Outliers = Exclude<TermdbSampleOutliersResponse, { error: any }>
/** the response of each reference group the tile was shown with, by reference id, or by 'custom:' and the filter */
type OutlierData = {
	byReference: Map<string, Promise<Outliers>>
	first: Outliers
}

/** rows per direction requested for gene expression; all gene sets of a collection are requested */
const EXPRESSION_LIMIT = 100
/** most custom group responses kept per tile, the least recently used dropped, as on the server: unlike the
 * configured groups, users can make any number of them */
const MAX_CUSTOM_GROUPS = 20
/** rows per direction on the face */
const FACE_ROWS = 5
const HIGH_COLOR = '#c2410c'
const LOW_COLOR = '#1d4ed8'
const BOX_FILL = '#e5e7eb'
const BOX_LINE = '#9ca3af'
const MEDIAN_COLOR = '#374151'
const ZERO_COLOR = '#e5e7eb'
const AXIS_COLOR = '#6b7280'
/** room for the sample's tick at either end of a box's axis */
const BOX_PAD = 2

export function getOutlierTool(kind: SampleOutliersKind, title: string): SampleTool<OutlierData> {
	return {
		key: 'outliers:' + kind,
		title,
		scope: 'sample',
		load: async ([sample], ctx) => {
			const first = await fetchOutliers(ctx, sample, kind)
			// the sample has no data in the file
			if (!first) return null
			return { first, byReference: new Map([[first.reference.id, Promise.resolve(first)]]) }
		},
		renderFace: (face, data) => renderFace(face, data.first, kind),
		renderExpanded: (holder, data, [sample], ctx) => renderExpanded(holder, data, sample, ctx, kind)
	}
}

/** the filter of the custom reference group, by app: one group for both tiles and all samples, used by a tile
 * only when its "Custom group" is chosen */
const customFilters = new WeakMap<object, any>()
/** destroys the filter UI of a drawing's expanded tile, with its body-mounted menus */
const filterDestroyers = new WeakMap<object, () => void>()

/** null when the sample has no data */
async function fetchOutliers(
	ctx: ToolContext,
	sample: Sample,
	kind: SampleOutliersKind,
	reference?: string,
	referenceFilter?: any
) {
	const vocabApi = ctx.app.vocabApi
	const headers = await vocabApi.mayGetAuthHeaders('termdb')
	const body: any = { genome: ctx.vocab.genome, dslabel: ctx.vocab.dslabel, sample: sample.sampleName, kind }
	if (reference) body.reference = reference
	if (referenceFilter) body.referenceFilter = referenceFilter
	if (kind == 'geneExpression') body.limit = EXPRESSION_LIMIT
	const r = await vocabApi.dofetch3('termdb/sampleOutliers', { headers, body }, vocabApi.opts.fetchOpts)
	if (r?.status == 404) return null
	if (r?.error) throw r.error
	return r as Outliers
}

/** the reference group as text, e.g. "vs Same diagnosis: BCP-ALL (2,929 samples)" */
function referenceText(r: Outliers) {
	const ref = r.reference
	return `vs ${ref.label}${ref.value ? ': ' + ref.value : ''} (${ref.n.toLocaleString()} samples)`
}

/** the top rows each way, on the group's box or as bars from zero by z-score */
function renderFace(face: any, r: Outliers, kind: SampleOutliersKind) {
	const high = r.high.filter(row => row.z > 0).slice(0, FACE_ROWS)
	const low = r.low.slice(0, FACE_ROWS)
	const max = Math.max(1, ...[...high, ...low].map(row => Math.abs(row.z)))
	const domain = getSharedDomain([...high, ...low], kind)
	const table = face.append('div').style('margin-top', '6px').style('font-size', '.72em')
	for (const row of [...high, ...low]) {
		const line = table
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '4px')
			.style('height', '15px')
			.attr('title', `${row.name}: z = ${row.z}, value ${row.value.toFixed(2)}${r.unit ? ' ' + r.unit : ''}`)
		line
			.append('div')
			.style('flex', '1')
			.style('white-space', 'nowrap')
			.style('overflow', 'hidden')
			.style('text-overflow', 'ellipsis')
			.text(row.name)
		const cell = line.append('div').style('width', '70px').style('flex', 'none')
		if (row.box) {
			// the box's own tooltip has the group's values
			line.attr('title', null)
			renderBox(cell, row, r, kind, 70, 13, domain)
		} else {
			const bar = cell.style('position', 'relative').style('height', '9px')
			bar
				.append('div')
				.style('position', 'absolute')
				.style('top', '0')
				.style('height', '9px')
				.style('left', row.z > 0 ? '35px' : `${35 - (35 * Math.abs(row.z)) / max}px`)
				.style('width', `${(35 * Math.abs(row.z)) / max}px`)
				.style('background', row.z > 0 ? HIGH_COLOR : LOW_COLOR)
		}
		line.append('div').style('width', '30px').style('flex', 'none').style('text-align', 'right').text(row.z.toFixed(1))
	}
	if (domain) {
		// under the boxes, the name and z-score columns left blank
		const line = table.append('div').style('display', 'flex').style('gap', '4px').style('margin-bottom', '10px')
		line.append('div').style('flex', '1')
		renderAxis(line.append('div').style('width', '70px').style('flex', 'none'), domain, 70, 3, 8)
		line.append('div').style('width', '30px').style('flex', 'none')
	}
	face
		.append('div')
		.style('font-size', '.7em')
		.style('color', '#6b7280')
		.style('margin-top', '4px')
		.text(referenceText(r))
	// genes have no common axis: the face has no room for the legend of the expanded tile, so say it here
	if (kind == 'geneExpression' && [...high, ...low].some(row => row.box))
		face
			.append('div')
			.style('font-size', '.7em')
			.style('color', '#6b7280')
			.text('Each gene on its own scale: compare a tick with its own box only')
}

/** the choice of reference group, and the ranked rows against the chosen one */
function renderExpanded(holder: any, data: OutlierData, sample: Sample, ctx: ToolContext, kind: SampleOutliersKind) {
	const controls = holder
		.append('div')
		.attr('data-testid', 'sjpp-sampleview-outliers-references')
		.style('margin', '6px 0 10px')
		.style('font-size', '.9em')
	const body = holder.append('div')
	let current = data.first.reference.id
	// the latest show() call: an earlier one still loading does not draw
	let shown = 0

	controls.append('span').style('margin-right', '8px').text('Compare with:')
	for (const ref of data.first.references) {
		const label = controls
			.append('label')
			.style('margin-right', '14px')
			.style('opacity', ref.unavailable ? 0.5 : 1)
			.attr('title', ref.unavailable || '')
		label
			.append('input')
			.attr('type', 'radio')
			.attr('name', `sjpp-sampleview-outliers-${kind}-${sample.sampleName}`)
			.attr('value', ref.id)
			.property('checked', ref.id == current)
			.property('disabled', !!ref.unavailable)
			.on('change', () => {
				current = ref.id
				builder.style('display', 'none')
				show(ref.id)
			})
		label.append('span').text(` ${ref.label}${ref.value ? ` (${ref.value})` : ''}`)
	}

	// a custom group: the samples passing a filter the user builds here, shown after its radio when chosen; the
	// radio and the filter are in one span so that they wrap to a new line together
	const customOption = controls.append('span').style('display', 'inline-flex').style('align-items', 'center')
	const customLabel = customOption.append('label')
	customLabel
		.append('input')
		.attr('type', 'radio')
		.attr('name', `sjpp-sampleview-outliers-${kind}-${sample.sampleName}`)
		.attr('value', 'custom')
		.on('change', () => {
			current = 'custom'
			builder.style('display', 'inline-block')
			show('custom')
		})
	customLabel.append('span').text(' Custom group')
	const builder = customOption
		.append('span')
		.attr('data-testid', 'sjpp-sampleview-outliers-custom')
		.style('display', 'none')
		.style('margin-left', '8px')
	const filter = filterInit({
		holder: builder,
		vocabApi: ctx.app.vocabApi,
		callback: f => {
			if (f?.lst?.length) customFilters.set(ctx.app, f)
			else customFilters.delete(ctx.app)
			if (current == 'custom') show('custom')
		}
	})
	filter.main(customFilters.get(ctx.app) || { type: 'tvslst', in: true, join: '', lst: [] })
	// one filter UI per drawing: reopening the tile replaces the one of the previous opening, and discarding the
	// drawing (e.g. closing sample view) destroys it
	filterDestroyers.get(data)?.()
	let destroyed = false
	const destroy = () => {
		if (destroyed) return
		destroyed = true
		filter.destroy()
	}
	filterDestroyers.set(data, destroy)
	ctx.onDestroy(destroy)

	const show = async (id: string) => {
		const call = ++shown
		body.selectAll('*').remove()
		const filter = id == 'custom' ? customFilters.get(ctx.app) : undefined
		if (id == 'custom' && !filter) {
			body.append('div').style('color', '#6b7280').text('Add a filter to define the group of samples to compare with.')
			return
		}
		// a custom group is identified by its filter
		const key = filter ? 'custom:' + JSON.stringify(filter) : id
		const wait = body.append('div').style('color', '#6b7280').text('Loading…')
		let r: Outliers | null
		try {
			let p = data.byReference.get(key)
			if (!p) p = fetchOutliers(ctx, sample, kind, id, filter) as Promise<Outliers>
			if (filter) {
				// most recently used last, so that the first custom group is the one dropped
				data.byReference.delete(key)
				const custom = [...data.byReference.keys()].filter(k => k.startsWith('custom:'))
				if (custom.length >= MAX_CUSTOM_GROUPS) data.byReference.delete(custom[0])
			}
			data.byReference.set(key, p)
			r = await p
		} catch (e: any) {
			// a failed request is made again when the group is chosen again
			data.byReference.delete(key)
			if (call == shown) wait.text('Error: ' + (e.message || e))
			return
		}
		// another group, or another custom filter, was chosen while this one loaded
		if (call != shown || !r) return
		wait.remove()
		renderRows(body, r, kind)
	}
	return show(current)
}

/** the rows ranked by z-score: a gene set collection as one list, genes as their highest and lowest; each row on
 * the group's box when it has one, else as a bar of its z-score */
function renderRows(body: any, r: Outliers, kind: SampleOutliersKind) {
	const sections =
		kind == 'ssGSEA'
			? [{ title: '', rows: [...r.high, ...r.low.slice().reverse()] }]
			: [
					{ title: `Highest of ${r.total.toLocaleString()} genes`, rows: r.high.filter(row => row.z > 0) },
					{ title: 'Lowest', rows: r.low }
			  ]
	const max = Math.max(1, ...r.high.concat(r.low).map(row => Math.abs(row.z)))
	// bar width
	const w = 120
	// box width: wider for gene sets, all on one axis
	const bw = kind == 'ssGSEA' ? 260 : 180
	const hasBox = r.high.concat(r.low).some(row => row.box)
	const domain = getSharedDomain(r.high.concat(r.low), kind)
	const wrap = body.append('div').style('display', 'flex').style('gap', '30px').style('flex-wrap', 'wrap')
	for (const s of sections) {
		const col = wrap.append('div').attr('data-testid', 'sjpp-sampleview-outliers-rows')
		if (s.title) col.append('div').style('font-weight', 600).style('margin-bottom', '4px').text(s.title)
		const table = col.append('table').style('border-collapse', 'collapse').style('font-size', '.85em')
		const head = table.append('tr').style('color', '#6b7280')
		for (const h of [
			kind == 'ssGSEA' ? 'Gene set' : 'Gene',
			kind == 'ssGSEA' ? 'Score' : r.unit || 'Value',
			'z-score',
			hasBox ? `${kind == 'ssGSEA' ? 'Score' : r.unit || 'Value'} vs group` : ''
		])
			head.append('th').style('text-align', 'left').style('padding', '2px 8px 2px 0').text(h)
		for (const row of s.rows) {
			const tr = table.append('tr')
			tr.append('td').style('padding', '1px 8px 1px 0').text(row.name)
			tr.append('td').style('padding', '1px 8px 1px 0').style('text-align', 'right').text(row.value.toFixed(2))
			tr.append('td').style('padding', '1px 8px 1px 0').style('text-align', 'right').text(row.z.toFixed(2))
			if (hasBox) {
				const cell = tr.append('td')
				if (row.box) renderBox(cell, row, r, kind, bw, 14, domain)
				else cell.style('color', AXIS_COLOR).text('Distribution unavailable')
				continue
			}
			const bar = tr
				.append('td')
				.append('div')
				.style('position', 'relative')
				.style('width', `${w}px`)
				.style('height', '10px')
			bar
				.append('div')
				.style('position', 'absolute')
				.style('left', `${w / 2}px`)
				.style('top', '0')
				.style('width', '1px')
				.style('height', '10px')
				.style('background', '#d1d5db')
			bar
				.append('div')
				.style('position', 'absolute')
				.style('top', '1px')
				.style('height', '8px')
				.style('left', row.z > 0 ? `${w / 2}px` : `${w / 2 - ((w / 2) * Math.abs(row.z)) / max}px`)
				.style('width', `${((w / 2) * Math.abs(row.z)) / max}px`)
				.style('background', row.z > 0 ? HIGH_COLOR : LOW_COLOR)
		}
		if (domain) {
			const tr = table.append('tr')
			tr.append('td').attr('colspan', 3)
			renderAxis(tr.append('td').style('padding-bottom', '12px'), domain, bw, 5, 10)
		}
	}
	if (hasBox) renderBoxLegend(body, kind, r.unit)
}

/** ssGSEA: one axis for all the rows shown, as gene set scores are in a narrow range, from the least to the
 * greatest of the groups' values and the sample's; undefined for genes, each on its own axis. Not rounded out to
 * round ticks, which can leave a third of the width empty */
function getSharedDomain(rows: SampleOutlierRow[], kind: SampleOutliersKind): [number, number] | undefined {
	if (kind != 'ssGSEA') return
	const values = rows.flatMap(row => (row.box ? [row.box.min, row.box.max, row.value] : []))
	if (!values.length) return
	return [Math.min(...values), Math.max(...values)]
}

/** the shared axis under the boxes, aligned with their scale */
function renderAxis(holder: any, domain: [number, number], width: number, ticks: number, fontSize: number) {
	const svg = holder
		.append('svg')
		.attr('width', width)
		.attr('height', fontSize + 6)
		.style('display', 'block')
		// the end labels may reach past the axis
		.style('overflow', 'visible')
	const axis = svg.append('g').call(
		axisBottom(
			scaleLinear()
				.domain(domain)
				.range([BOX_PAD, width - BOX_PAD])
		)
			.ticks(ticks)
			.tickSize(3)
	)
	axisstyle({ axis, color: AXIS_COLOR, fontsize: fontSize, showline: true })
}

/** the sample's value as a tick on the reference group's box, on the shared axis of the rows when given, else on
 * the row's own: from the least to the greatest of the group's values and the sample's, expression on the
 * log2(value+1) scale of its z-score, as the values of a gene are mostly low with a long tail of high ones */
function renderBox(
	holder: any,
	row: SampleOutlierRow,
	r: Outliers,
	kind: SampleOutliersKind,
	width: number,
	height: number,
	domain?: [number, number]
) {
	const b = row.box!
	const scale = kind == 'geneExpression' ? (v: number) => Math.log2(v + 1) : (v: number) => v
	let [lo, hi] = domain || [scale(Math.min(b.min, row.value)), scale(Math.max(b.max, row.value))]
	if (hi == lo) {
		lo -= 0.5
		hi += 0.5
	}
	const x = (v: number) => BOX_PAD + ((scale(v) - lo) / (hi - lo)) * (width - 2 * BOX_PAD)
	const mid = height / 2
	const svg = holder.append('svg').attr('width', width).attr('height', height).style('display', 'block')
	// on a shared axis, zero lines up down the rows
	if (domain && lo < 0 && hi > 0)
		svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', height).attr('stroke', ZERO_COLOR)
	const f = (v: number) => v.toFixed(2)
	const unit = r.unit ? ' ' + r.unit : ''
	svg
		.append('title')
		.text(
			`${row.name}\nthis sample: ${f(row.value)}${unit} (z = ${row.z})\n${referenceText(r)}:\n` +
				`median ${f(b.p50)}, quartiles ${f(b.p25)} to ${f(b.p75)}\n` +
				`whiskers ${f(b.w1)} to ${f(b.w2)}, range ${f(b.min)} to ${f(b.max)}`
		)
	// the group's values beyond the whiskers, as a dotted line to its least and greatest
	for (const [a, c] of [
		[b.min, b.w1],
		[b.w2, b.max]
	]) {
		if (a == c) continue
		svg
			.append('line')
			.attr('x1', x(a))
			.attr('x2', x(c))
			.attr('y1', mid)
			.attr('y2', mid)
			.attr('stroke', BOX_LINE)
			.attr('stroke-dasharray', '1,2')
	}
	svg.append('line').attr('x1', x(b.w1)).attr('x2', x(b.w2)).attr('y1', mid).attr('y2', mid).attr('stroke', BOX_LINE)
	for (const w of [b.w1, b.w2])
		svg
			.append('line')
			.attr('x1', x(w))
			.attr('x2', x(w))
			.attr('y1', mid - height / 5)
			.attr('y2', mid + height / 5)
			.attr('stroke', BOX_LINE)
	svg
		.append('rect')
		.attr('x', x(b.p25))
		.attr('width', Math.max(1, x(b.p75) - x(b.p25)))
		.attr('y', height * 0.2)
		.attr('height', height * 0.6)
		.attr('fill', BOX_FILL)
		.attr('stroke', BOX_LINE)
	svg
		.append('line')
		.attr('x1', x(b.p50))
		.attr('x2', x(b.p50))
		.attr('y1', height * 0.2)
		.attr('y2', height * 0.8)
		.attr('stroke', MEDIAN_COLOR)
		.attr('stroke-width', 1.5)
	svg
		.append('line')
		.attr('data-testid', 'sjpp-sampleview-outliers-sample')
		.attr('x1', x(row.value))
		.attr('x2', x(row.value))
		.attr('y1', 0)
		.attr('y2', height)
		.attr('stroke', row.z >= 0 ? HIGH_COLOR : LOW_COLOR)
		.attr('stroke-width', 2.5)
}

/** what the box and the tick of a row are, and for genes, that their positions are not comparable between rows */
function renderBoxLegend(body: any, kind: SampleOutliersKind, unit?: string) {
	const legend = body.append('div').style('font-size', '.75em').style('color', '#6b7280').style('margin-top', '8px')
	legend
		.append('div')
		.text(
			`Box: the reference group${kind == 'ssGSEA' ? ', all rows on one scale' : ''}: median, quartiles, whiskers ` +
				'to the farthest values within 1.5 IQR, dotted to the least and greatest. Colored tick: this sample.'
		)
	if (kind == 'geneExpression')
		legend
			.append('div')
			.style('margin-top', '3px')
			.text(
				"No common axis: each gene is on its own log scale, from the group's least to greatest value and " +
					"the sample's. Compare a tick only with its own gene's box; where a box sits and how wide it is " +
					`are not comparable between genes. For the level, see the ${unit || 'value'} column; for how ` +
					'unusual the sample is, the z-score.'
			)
}
