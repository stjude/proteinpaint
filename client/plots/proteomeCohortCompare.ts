import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from './PlotBase'
import { Menu } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { scaleLinear, axisBottom, axisLeft } from 'd3'

/*
proteomeCohortCompare — cross-cohort comparison of standardized fold change (log2FC-z).

Launched from the Sample Sets catalog when ≥2 cohorts are selected. Fetches the aligned z matrix
from termdb/proteomeCohortCompare and renders (view switchable in the controls):
  - 2 cohorts  → a concordance scatter (z vs z); points colored by shared DAP direction
  - ≥3 cohorts → a protein × cohort clustered heatmap (default), a cohort correlation matrix, or a
                 shared-vs-specific DAP overlap (an UpSet per up/down direction), each intersection
                 click-through to its protein list
  - a series   → an age/progression trajectory: when the selection contains ≥1 ordered series
                 (cohorts sharing dataset trajectory.series), one panel per k-means cluster showing
                 the member proteins' relative-abundance trajectories + a thick eigengene trend line

A cross-species toggle appears when the selection spans organisms (off by default).
*/

const defaultConfig = { chartType: 'proteomeCohortCompare' }

type CohortRef = { organism: string; assay: string; cohort: string; label?: string }

const PLOT = 360
const MARGIN = { top: 16, right: 12, bottom: 46, left: 50 }
const UP = '#b2182b'
const DOWN = '#2166ac'
const DISCORDANT = '#e08214' // DAP in both cohorts, opposite directions
const NEUTRAL = '#cccccc' // not a shared DAP
/** default DAP cutoffs. A real DAP needs BOTH a fold-change and a significance cutoff
 *  (the DAP file lists every identified protein). papers use |log2FC-z|>2 (human)/2.5 (mouse)
 *  and FDR<0.05; both are user-adjustable. */
const Z_THRESH = 2
const FDR_THRESH = 0.05

class ProteomeCohortCompare extends PlotBase implements RxComponent {
	static type = 'proteomeCohortCompare'
	type: string
	dom!: {
		holder: any
		controls: any
		body: any
		tip: Menu
		header?: any
	}
	cohorts: CohortRef[] = []
	crossSpecies = false
	matrixMetric: 'spearman' | 'pearson' = 'spearman'
	/** DAP thresholds (scatter coloring + heatmap row selection) */
	zThresh = Z_THRESH
	fdrThresh = FDR_THRESH
	/** which view: the default (scatter for 2 / correlation matrix for ≥3), the protein heatmap,
	 *  the shared-vs-specific DAP overlap (UpSet), or the age/progression trajectory.
	 *  Initialized in main(): heatmap by default when >2 cohorts, scatter when exactly 2. */
	view: 'default' | 'heatmap' | 'overlap' | 'trajectory' = 'default'
	viewInitialized = false
	/** max heatmap rows (DAP-union capped by cross-cohort variance) */
	maxRows = 30
	/** number of k-means clusters in the trajectory view */
	nClusters = 3
	/** trajectory drill-down selection: which series/cluster's genes are listed + highlighted */
	trajSelected: { si: number; pi: number } | null = null
	/** last fetched response, kept so threshold changes re-render without refetching */
	data: any = null
	/** signature of the current cohort selection — used to reset the trajectory drill-down when it changes */
	cohortKey = ''

	constructor(opts: any, api) {
		super(opts, api)
		this.type = ProteomeCohortCompare.type
	}

	async init() {
		const holder = this.opts.holder.append('div').style('padding', '10px')
		this.dom = {
			holder,
			controls: holder.append('div').style('margin-bottom', '10px'),
			body: holder.append('div'),
			tip: new Menu({ padding: '' }),
			header: this.opts.header
		}
		if (this.dom.header) this.dom.header.html('Cohort Comparison')
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	async main() {
		const config: any = this.state.config
		this.cohorts = config.cohorts || []
		if (this.cohorts.length < 2) {
			this.dom.body.selectAll('*').remove()
			this.dom.body.append('div').style('color', '#666').text('Select at least two cohorts to compare.')
			return
		}
		// initialize view + crossSpecies once from config; afterwards the in-plot toggles own them
		// (they don't dispatch config changes, so re-reading config here would clobber the user's choice)
		if (!this.viewInitialized) {
			this.crossSpecies = !!config.crossSpecies
			this.view = this.cohorts.length > 2 ? 'heatmap' : 'default'
			this.viewInitialized = true
		}
		// reset the trajectory drill-down when the cohort selection changes (its si/pi would be stale)
		const key = this.cohorts.map(c => `${c.organism}|${c.assay}|${c.cohort}`).join(';')
		if (key !== this.cohortKey) {
			this.cohortKey = key
			this.trajSelected = null
		}
		await this.reload()
	}

	cohortLabel(c: CohortRef) {
		return c.label || c.cohort
	}

	spansSpecies() {
		return new Set(this.cohorts.map(c => c.organism)).size > 1
	}

	/** number of ordered series with ≥3 distinct timepoints among the response cohorts — gates the
	 *  Trajectory view (matches the server, which needs ≥3 distinct ages to build a trajectory) */
	trajectorySeriesCount(cohortsData: any[]): number {
		const bySeries = new Map<string, Set<number>>()
		for (const c of cohortsData || []) {
			const t = c?.trajectory
			if (!t?.series) continue
			let vals = bySeries.get(t.series)
			if (!vals) bySeries.set(t.series, (vals = new Set()))
			vals.add(t.value)
		}
		let n = 0
		for (const vals of bySeries.values()) if (vals.size >= 3) n++
		return n
	}

	async reload() {
		// exactly 2 cohorts only support the scatter — drop any stale heatmap/overlap/trajectory view
		if (this.cohorts.length <= 2 && this.view !== 'default') this.view = 'default'
		this.dom.body.selectAll('*').remove()
		const data = await dofetch3('termdb/proteomeCohortCompare', {
			body: {
				genome: this.app.opts.state.vocab.genome,
				dslabel: this.app.opts.state.vocab.dslabel,
				cohorts: this.cohorts,
				crossSpecies: this.crossSpecies,
				heatmap: this.view === 'heatmap',
				overlap: this.view === 'overlap',
				trajectory: this.view === 'trajectory',
				zThresh: this.zThresh,
				fdrThresh: this.fdrThresh,
				maxRows: this.maxRows,
				nClusters: this.nClusters
			}
		})
		// guard: a missing/failed endpoint (e.g. 404) returns no z matrix — fail clearly, don't crash
		if (!data || data.error || !Array.isArray(data.z) || typeof data.sharedGeneCount !== 'number') {
			this.renderControls({ error: true })
			this.dom.body
				.append('div')
				.style('padding', '12px')
				.style('color', '#a00')
				.text(
					(data && data.error) ||
						'Cohort comparison is unavailable — the server may need to be restarted to load the comparison endpoint.'
				)
			return
		}
		this.data = data
		// the trajectory view needs ≥1 ordered series in the current selection; if that no longer
		// holds (e.g. the selection changed), fall back to the heatmap and refetch for it
		if (this.view === 'trajectory' && this.trajectorySeriesCount(data.cohorts) === 0) {
			this.view = 'heatmap'
			this.trajSelected = null
			return this.reload() // awaited by the caller so the refetch completes before main() resolves
		}
		this.renderControls(data)
		if (data.sharedGeneCount < 3) {
			this.dom.body
				.append('div')
				.style('padding', '12px')
				.style('color', '#a00')
				.text('Too few shared proteins to compare.')
			return
		}
		if (this.view === 'trajectory') this.renderTrajectory(data.trajectory)
		else if (this.view === 'overlap') this.renderOverlap(data.overlap)
		else if (this.view === 'heatmap') this.renderHeatmap(data.heatmap)
		else if (this.cohorts.length === 2) this.renderScatter(data)
		else this.renderMatrix(data)
	}

	/** re-render just the scatter (e.g. after a threshold change) without refetching */
	redrawScatter() {
		if (!this.data) return
		this.dom.body.selectAll('*').remove()
		this.renderScatter(this.data)
	}

	renderControls(data: any) {
		const div = this.dom.controls
		div.selectAll('*').remove()

		// view toggle — only offered for >2 cohorts (exactly 2 cohorts always shows the scatter).
		// ≥3 cohorts: correlation matrix, protein heatmap, the shared-vs-specific UpSet, and — when
		// the selection contains ≥1 ordered series (≥3 timepoints) — the age/progression trajectory.
		if (!data.error && this.cohorts.length > 2) {
			const viewOptions: [string, string][] = [
				['default', 'Correlation matrix'],
				['heatmap', 'Protein heatmap'],
				['overlap', 'UpSet']
			]
			if (this.trajectorySeriesCount(data.cohorts) > 0) viewOptions.push(['trajectory', 'Trajectory'])
			const label = div.append('label').style('font-size', '0.85em').style('margin-right', '16px').text('View: ')
			const sel = label.append('select').on('change', (event: any) => {
				this.view = event.target.value
				this.trajSelected = null // reset trajectory drill-down on any view switch
				this.reload()
			})
			for (const [val, txt] of viewOptions) {
				const o = sel.append('option').attr('value', val).text(txt)
				if (val === this.view) o.property('selected', true)
			}
		}

		// cross-species toggle — only relevant when the selection spans organisms
		if (this.spansSpecies()) {
			const label = div
				.append('label')
				.style('font-size', '0.85em')
				.style('cursor', 'pointer')
				.style('margin-right', '16px')
			label
				.append('input')
				.attr('type', 'checkbox')
				.property('checked', this.crossSpecies)
				.style('margin-right', '5px')
				.on('change', (event: any) => {
					this.crossSpecies = event.target.checked
					this.reload()
				})
			label.append('span').text('Cross-species (match by ortholog symbol)')
		}

		// correlation-metric toggle — only for the correlation-matrix view (not the heatmap)
		if (this.cohorts.length > 2 && !data.error && this.view === 'default') {
			const label = div.append('label').style('font-size', '0.85em').style('margin-right', '6px').text('Correlation: ')
			const sel = label.append('select').on('change', (event: any) => {
				this.matrixMetric = event.target.value
				this.reload()
			})
			for (const m of ['spearman', 'pearson']) {
				const o = sel
					.append('option')
					.attr('value', m)
					.text(m[0].toUpperCase() + m.slice(1))
				if (m === this.matrixMetric) o.property('selected', true)
			}
		}
	}

	renderScatter(data: any) {
		const [ca, cb] = this.cohorts
		const zx: number[] = data.z[0]
		const zy: number[] = data.z[1]
		const px: number[] = data.p[0] // the DAP file p-value is already an FDR
		const py: number[] = data.p[1]
		const genes: string[] = data.genes
		const rho: number = data.spearman[0][1]
		const r: number = data.pearson[0][1]
		const n: number = data.sharedGeneCount
		const zT = this.zThresh
		const fT = this.fdrThresh

		// a protein is a DAP in a cohort only if it clears BOTH the |z| and FDR cutoffs.
		// classify by shared direction across the two cohorts.
		const isDap = (z: number, fdr: number) => Math.abs(z) >= zT && fdr <= fT
		const catOf = (i: number): 'up' | 'down' | 'discordant' | 'other' => {
			if (!isDap(zx[i], px[i]) || !isDap(zy[i], py[i])) return 'other'
			const a = zx[i] > 0,
				b = zy[i] > 0
			if (a && b) return 'up'
			if (!a && !b) return 'down'
			return 'discordant'
		}
		const cats = genes.map((_, i) => catOf(i))
		const counts = { up: 0, down: 0, discordant: 0, other: 0 }
		for (const c of cats) counts[c]++
		const catColor = { up: UP, down: DOWN, discordant: DISCORDANT, other: NEUTRAL }

		// --- plot on the left, info/controls/legend panel on the right ---
		const row = this.dom.body
			.append('div')
			.style('display', 'flex')
			.style('gap', '18px')
			.style('align-items', 'flex-start')

		// axes on the ACTUAL data extent (no empty margins around the cloud)
		let xmin = Infinity,
			xmax = -Infinity,
			ymin = Infinity,
			ymax = -Infinity
		for (let i = 0; i < genes.length; i++) {
			if (zx[i] < xmin) xmin = zx[i]
			if (zx[i] > xmax) xmax = zx[i]
			if (zy[i] < ymin) ymin = zy[i]
			if (zy[i] > ymax) ymax = zy[i]
		}
		const padX = (xmax - xmin) * 0.04 || 1
		const padY = (ymax - ymin) * 0.04 || 1
		const x = scaleLinear()
			.domain([xmin - padX, xmax + padX])
			.range([MARGIN.left, MARGIN.left + PLOT])
		const y = scaleLinear()
			.domain([ymin - padY, ymax + padY])
			.range([MARGIN.top + PLOT, MARGIN.top])

		const svg = row
			.append('svg')
			.attr('width', MARGIN.left + PLOT + MARGIN.right)
			.attr('height', MARGIN.top + PLOT + MARGIN.bottom)

		// zero reference lines (only when 0 is within the plotted range)
		if (xmin < 0 && xmax > 0)
			svg
				.append('line')
				.attr('x1', x(0))
				.attr('y1', MARGIN.top)
				.attr('x2', x(0))
				.attr('y2', MARGIN.top + PLOT)
				.attr('stroke', '#eee')
		if (ymin < 0 && ymax > 0)
			svg
				.append('line')
				.attr('x1', MARGIN.left)
				.attr('y1', y(0))
				.attr('x2', MARGIN.left + PLOT)
				.attr('y2', y(0))
				.attr('stroke', '#eee')

		// points — draw the grey background cloud first, colored shared movers on top
		const pts = svg.append('g')
		const drawPoint = (i: number) => {
			const c = cats[i]
			pts
				.append('circle')
				.attr('cx', x(zx[i]))
				.attr('cy', y(zy[i]))
				.attr('r', c === 'other' ? 1.8 : 2.6)
				.attr('fill', catColor[c])
				.attr('fill-opacity', c === 'other' ? 0.3 : 0.8)
				.on('mouseover', (event: any) => {
					this.dom.tip.clear().show(event.clientX, event.clientY)
					this.dom.tip.d
						.append('div')
						.style('padding', '5px 8px')
						.style('font-size', '0.85em')
						.html(
							`<b>${genes[i]}</b><br>${this.cohortLabel(ca)}: z=${zx[i].toFixed(2)} (log2FC ${data.fc[0][i].toFixed(
								2
							)}, FDR ${px[i].toExponential(1)})<br>${this.cohortLabel(cb)}: z=${zy[i].toFixed(2)} (log2FC ${data.fc[1][
								i
							].toFixed(2)}, FDR ${py[i].toExponential(1)})`
						)
				})
				.on('mouseout', () => this.dom.tip.hide())
		}
		for (let i = 0; i < genes.length; i++) if (cats[i] === 'other') drawPoint(i)
		for (let i = 0; i < genes.length; i++) if (cats[i] !== 'other') drawPoint(i)

		// axes + titles
		svg
			.append('g')
			.attr('transform', `translate(0,${MARGIN.top + PLOT})`)
			.call(axisBottom(x).ticks(5) as any)
		svg
			.append('g')
			.attr('transform', `translate(${MARGIN.left},0)`)
			.call(axisLeft(y).ticks(5) as any)
		svg
			.append('text')
			.attr('x', MARGIN.left + PLOT / 2)
			.attr('y', MARGIN.top + PLOT + 36)
			.attr('text-anchor', 'middle')
			.style('font-size', '11px')
			.text(`${this.cohortLabel(ca)}  (log2FC-z)`)
		svg
			.append('text')
			.attr('transform', `translate(12,${MARGIN.top + PLOT / 2}) rotate(-90)`)
			.attr('text-anchor', 'middle')
			.style('font-size', '11px')
			.text(`${this.cohortLabel(cb)}  (log2FC-z)`)

		// --- right panel: stats, DAP-cutoff controls, legend ---
		const panel = row.append('div').style('font-size', '0.85em').style('padding-top', '4px').style('min-width', '190px')

		const statBox = panel.append('div').style('margin-bottom', '12px').style('line-height', '1.6')
		statBox
			.append('div')
			.attr('title', 'Number of shared proteins compared')
			.html(`<b>n</b> = ${n.toLocaleString()} shared proteins`)
		statBox
			.append('div')
			.attr('title', 'Spearman rank correlation of log2FC-z (robust; no linearity assumption)')
			.html(`<b>ρ</b> (Spearman) = ${rho.toFixed(3)}`)
		statBox
			.append('div')
			.attr('title', 'Pearson correlation of log2FC-z (linear agreement; the papers’ R)')
			.html(`<b>r</b> (Pearson) = ${r.toFixed(3)}`)

		// DAP-cutoff controls — recolor without refetching
		const cutoffs = panel.append('div').style('margin-bottom', '12px')
		cutoffs
			.append('div')
			.style('font-weight', '600')
			.style('margin-bottom', '3px')
			.attr('title', 'A protein is a shared DAP only if it clears BOTH cutoffs in BOTH cohorts')
			.text('DAP cutoffs')
		const numInput = (label: string, value: number, step: number, title: string, onSet: (v: number) => void) => {
			const l = cutoffs.append('div').style('margin-bottom', '2px').attr('title', title)
			l.append('span').style('display', 'inline-block').style('width', '44px').html(label)
			l.append('input')
				.attr('type', 'number')
				.attr('step', step)
				.attr('min', 0)
				.property('value', value)
				.style('width', '70px')
				.on('change', (event: any) => {
					const v = Number(event.target.value)
					if (Number.isFinite(v) && v >= 0) {
						onSet(v)
						this.redrawScatter()
					}
				})
		}
		numInput('|z| ≥', this.zThresh, 0.5, 'Minimum |log2FC-z| (standardized fold change)', v => (this.zThresh = v))
		numInput(
			'FDR ≤',
			this.fdrThresh,
			0.01,
			'Maximum FDR (the DAP file p-value is already an FDR)',
			v => (this.fdrThresh = v)
		)

		// legend
		const legend = panel.append('div')
		legend.append('div').style('font-weight', '600').style('margin-bottom', '6px').text('Shared regulation')
		const legItems: [string, string, number][] = [
			[UP, 'Up in both', counts.up],
			[DOWN, 'Down in both', counts.down],
			[DISCORDANT, 'Opposite (DAP in both)', counts.discordant],
			[NEUTRAL, 'Not a shared DAP', counts.other]
		]
		for (const [col, lab, ct] of legItems) {
			const item = legend
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('gap', '6px')
				.style('margin-bottom', '3px')
			item
				.append('span')
				.style('width', '10px')
				.style('height', '10px')
				.style('border-radius', '50%')
				.style('background', col)
				.style('display', 'inline-block')
			item.append('span').html(`${lab} <span style="color:#999">(${ct.toLocaleString()})</span>`)
		}
	}

	renderMatrix(data: any) {
		const n = this.cohorts.length
		const corr: number[][] = data[this.matrixMetric]
		const order = leafOrder(corr)
		const labels = order.map(i => this.cohortLabel(this.cohorts[i]))

		const cell = Math.max(26, Math.min(48, Math.floor(360 / n)))
		const labelPad = 120
		const svg = this.dom.body
			.append('svg')
			.attr('width', labelPad + n * cell + 60)
			.attr('height', labelPad + n * cell + 20)

		const cscale = scaleLinear<string>().domain([-1, 0, 1]).range([DOWN, '#f7f7f7', UP]).clamp(true)

		const g = svg.append('g').attr('transform', `translate(${labelPad},${labelPad})`)
		for (let ri = 0; ri < n; ri++) {
			for (let ci = 0; ci < n; ci++) {
				const v = corr[order[ri]][order[ci]]
				g.append('rect')
					.attr('x', ci * cell)
					.attr('y', ri * cell)
					.attr('width', cell - 1)
					.attr('height', cell - 1)
					.attr('fill', cscale(v))
					.style('cursor', ri === ci ? 'default' : 'pointer')
					.on('mouseover', (event: any) => {
						this.dom.tip.clear().show(event.clientX, event.clientY)
						this.dom.tip.d
							.append('div')
							.style('padding', '5px 8px')
							.style('font-size', '0.85em')
							.html(`${labels[ri]} × ${labels[ci]}<br><b>${this.matrixMetric} = ${v.toFixed(3)}</b>`)
					})
					.on('mouseout', () => this.dom.tip.hide())
					.on('click', () => {
						if (ri === ci) return
						this.openPair(this.cohorts[order[ri]], this.cohorts[order[ci]])
					})
				g.append('text')
					.attr('x', ci * cell + cell / 2)
					.attr('y', ri * cell + cell / 2)
					.attr('text-anchor', 'middle')
					.attr('dominant-baseline', 'central')
					.style('font-size', '10px')
					.style('fill', Math.abs(v) > 0.6 ? '#fff' : '#333')
					.style('pointer-events', 'none') // let hover/click fall through to the cell rect below
					.text(v.toFixed(2))
			}
		}

		// row labels (left) + column labels (top, rotated)
		for (let i = 0; i < n; i++) {
			svg
				.append('text')
				.attr('x', labelPad - 6)
				.attr('y', labelPad + i * cell + cell / 2)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.style('font-size', '11px')
				.text(labels[i])
			svg
				.append('text')
				.attr('transform', `translate(${labelPad + i * cell + cell / 2},${labelPad - 6}) rotate(-45)`)
				.attr('text-anchor', 'start')
				.style('font-size', '11px')
				.text(labels[i])
		}

		this.dom.body
			.append('div')
			.style('font-size', '0.8em')
			.style('color', '#777')
			.style('margin-top', '6px')
			.text('Rows/cols ordered by hierarchical clustering. Click a cell to open the pairwise scatter.')
	}

	/** open a fresh 2-cohort comparison for the clicked matrix pair */
	openPair(a: CohortRef, b: CohortRef) {
		this.app.dispatch({
			type: 'plot_create',
			config: { chartType: 'proteomeCohortCompare', cohorts: [a, b], crossSpecies: this.crossSpecies }
		})
	}

	/** protein × cohort log2FC-z heatmap, clustered on both axes (via server hclust.R) */
	renderHeatmap(hm: any) {
		if (!hm) {
			this.dom.body.append('div').style('padding', '12px').style('color', '#a00').text('Heatmap unavailable.')
			return
		}

		// layout: heatmap on the left, controls + legend + count on the right, bottom-aligned to the heatmap
		const wrap = this.dom.body
			.append('div')
			.style('display', 'flex')
			.style('gap', '18px')
			.style('align-items', 'flex-end')
		const left = wrap.append('div')
		const panel = wrap.append('div').style('font-size', '0.85em').style('min-width', '160px')

		// DAP-cutoff + row-cap controls — changing any recomputes rows/clustering on the server
		panel.append('div').style('font-weight', '600').style('margin-bottom', '3px').text('DAP cutoffs')
		const numInput = (label: string, value: number, step: number, title: string, onSet: (v: number) => void) => {
			const l = panel.append('div').style('margin-bottom', '3px').attr('title', title)
			l.append('span').style('display', 'inline-block').style('width', '58px').html(label)
			l.append('input')
				.attr('type', 'number')
				.attr('step', step)
				.attr('min', 0)
				.property('value', value)
				.style('width', '64px')
				.on('change', (e: any) => {
					const v = Number(e.target.value)
					if (Number.isFinite(v) && v >= 0) {
						onSet(v)
						this.reload()
					}
				})
		}
		numInput('|z| ≥', this.zThresh, 0.5, 'DAP fold-change cutoff', v => (this.zThresh = v))
		numInput(
			'FDR ≤',
			this.fdrThresh,
			0.01,
			'DAP significance cutoff (the DAP p-value is already an FDR)',
			v => (this.fdrThresh = v)
		)
		numInput(
			'max rows',
			this.maxRows,
			25,
			'Cap on proteins shown (top by variance of z across cohorts)',
			v => (this.maxRows = Math.round(v))
		)
		// color legend goes here, directly under the DAP cutoffs (filled in once `cap` is known)
		const legendHolder = panel.append('div').style('margin-top', '12px')
		const countTxt =
			hm.shown < hm.totalDap ? `${hm.shown} of ${hm.totalDap} DAP-union proteins` : `${hm.shown} DAP-union proteins`
		panel.append('div').style('margin-top', '12px').style('color', '#777').text(countTxt)

		if (!hm.rowNames.length) {
			left
				.append('div')
				.style('padding', '12px')
				.style('color', '#a00')
				.text('No DAP proteins at these cutoffs — loosen |z| or FDR.')
			return
		}

		const rows: string[] = hm.rowNames
		const cols: string[] = hm.colLabels
		const Z: number[][] = hm.z
		const cellW = 45
		// cap the gene-rows grid at MAX_GRID_H px tall; shrink cell height when there are many genes,
		// and drop the gene names once cells get too short to fit readable text (hover still shows them)
		const MAX_GRID_H = 600
		const cellH = Math.min(18, MAX_GRID_H / rows.length)
		const showRowNames = cellH >= 8
		const rowDendW = hm.rowDendrogram ? 90 : 0
		const colDendH = hm.colDendrogram ? 70 : 0
		const maxLabelLen = Math.max(1, ...cols.map(c => c.length))
		// size the vertical-label band to the longest name + a gap so labels never touch the top dendrogram
		const colLabelH = Math.min(220, Math.max(70, Math.round(maxLabelLen * 7) + 12))
		const rowLabelW = showRowNames ? 140 : 8
		const legendW = 12 // just a little right padding now that the legend lives in the side panel
		const gridW = cols.length * cellW
		const gridH = rows.length * cellH
		const gridX = rowDendW
		const gridY = colDendH + colLabelH

		const svg = left
			.append('svg')
			.attr('width', gridX + gridW + rowLabelW + legendW)
			.attr('height', gridY + gridH + 12)
			.attr('font-family', 'sans-serif')

		let cap = 1
		for (const row of Z) for (const v of row) cap = Math.max(cap, Math.abs(v))
		const color = scaleLinear<string>().domain([-cap, 0, cap]).range([DOWN, '#f7f7f7', UP]).clamp(true)

		// dendrograms (both axes)
		if (hm.rowDendrogram)
			drawDendrogram(
				svg.append('g').attr('transform', `translate(0,${gridY})`),
				hm.rowDendrogram,
				cellH,
				rowDendW,
				'left'
			)
		if (hm.colDendrogram)
			drawDendrogram(
				svg.append('g').attr('transform', `translate(${gridX},0)`),
				hm.colDendrogram,
				cellW,
				colDendH,
				'top'
			)

		// column labels — vertical (90°), reading upward from the grid
		const labG = svg.append('g').attr('transform', `translate(${gridX},${gridY - 4})`)
		cols.forEach((c, i) => {
			const cx = i * cellW + cellW / 2
			labG
				.append('text')
				.attr('x', cx)
				.attr('y', 0)
				.attr('transform', `rotate(-90,${cx},0)`)
				.attr('text-anchor', 'start')
				.attr('dominant-baseline', 'central')
				.style('font-size', '11px')
				.text(c)
		})

		// cells
		const cg = svg.append('g').attr('transform', `translate(${gridX},${gridY})`)
		for (let r = 0; r < rows.length; r++) {
			for (let c = 0; c < cols.length; c++) {
				const v = Z[r][c]
				cg.append('rect')
					.attr('x', c * cellW)
					.attr('y', r * cellH)
					.attr('width', cellW - 0.5)
					.attr('height', cellH - 0.5)
					.attr('fill', color(v))
					.on('mouseover', (event: any) => {
						this.dom.tip.clear().show(event.clientX, event.clientY)
						this.dom.tip.d
							.append('div')
							.style('padding', '5px 8px')
							.style('font-size', '0.85em')
							.html(
								`<b>${rows[r]}</b> — ${cols[c]}<br>z = ${v.toFixed(2)}, log2FC = ${hm.fc[r][c].toFixed(
									2
								)}, FDR = ${hm.fdr[r][c].toExponential(1)}`
							)
					})
					.on('mouseout', () => this.dom.tip.hide())
			}
		}

		// row labels (right of grid) — only when cells are tall enough; font scales with cell height
		if (showRowNames) {
			const rowFont = Math.min(11, Math.max(7, Math.floor(cellH - 1)))
			const rg = svg.append('g').attr('transform', `translate(${gridX + gridW + 4},${gridY})`)
			rows.forEach((name, r) =>
				rg
					.append('text')
					.attr('x', 0)
					.attr('y', r * cellH + cellH / 2)
					.attr('dominant-baseline', 'central')
					.style('font-size', `${rowFont}px`)
					.text(name)
			)
		}

		// color legend — horizontal bar in the side panel, same font as gene labels
		const legLen = 150
		const legThick = 16
		const steps = 24
		const legSvg = legendHolder
			.append('svg')
			.attr('width', legLen + 8)
			.attr('height', legThick + 36)
			.attr('font-family', 'sans-serif')
		legSvg
			.append('text')
			.attr('x', 0)
			.attr('y', 10)
			.style('font-size', '11px')
			.style('font-weight', '600')
			.text('log2FC-z')
		const legG = legSvg.append('g').attr('transform', 'translate(2,18)')
		for (let s = 0; s < steps; s++) {
			const t = s / (steps - 1)
			legG
				.append('rect')
				.attr('x', t * legLen)
				.attr('y', 0)
				.attr('width', legLen / steps + 0.6)
				.attr('height', legThick)
				.attr('fill', color(-cap + 2 * cap * t))
		}
		for (const [t, lab] of [
			[0, `−${cap.toFixed(1)}`],
			[0.5, '0'],
			[1, `+${cap.toFixed(1)}`]
		] as [number, string][])
			legG
				.append('text')
				.attr('x', t * legLen)
				.attr('y', legThick + 13)
				.attr('text-anchor', t === 0 ? 'start' : t === 1 ? 'end' : 'middle')
				.style('font-size', '11px')
				.text(lab)
	}

	/** render a capped, expandable gene list (5 per row; first 10 shown, rest behind a black "more") */
	renderGeneList(holder: any, headerText: string, genes: string[]) {
		holder.selectAll('*').remove()
		holder.append('div').style('font-weight', '600').style('margin-bottom', '4px').text(headerText)
		const list = holder
			.append('div')
			.style('max-width', '360px')
			.style('line-height', '1.6')
			.style('color', '#333')
			.style('word-break', 'break-word')
		const LIMIT = 10
		const PER_ROW = 5
		const render = (expanded: boolean) => {
			list.selectAll('*').remove()
			if (!genes.length) {
				list.text('(none)')
				return
			}
			const shown = expanded ? genes : genes.slice(0, LIMIT)
			for (let i = 0; i < shown.length; i += PER_ROW) {
				const chunk = shown.slice(i, i + PER_ROW)
				const last = i + PER_ROW >= shown.length
				list.append('div').text(chunk.join(', ') + (last ? '' : ','))
			}
			if (genes.length > LIMIT)
				list
					.append('button')
					.attr('type', 'button')
					.style('cursor', 'pointer')
					.style('color', '#333') // same color as the gene names, not a link color
					.style('text-decoration', 'underline')
					.style('display', 'inline-block')
					.style('margin-top', '3px')
					.style('background', 'none')
					.style('border', 'none')
					.style('padding', '0')
					.style('font', 'inherit')
					.text(expanded ? 'less' : `more (${(genes.length - LIMIT).toLocaleString()})`)
					.on('click', () => render(!expanded))
		}
		render(false)
	}

	/** age/progression trajectory. One section per ordered series; within a section, one small panel
	 *  per k-means cluster: faint individual member trajectories (relative abundance)
	 *  plus a thick black module-eigengene trend line. Click a panel to list that cluster's genes.
	 *  DAP cutoffs + cluster count live in the right panel (all refetch). */
	renderTrajectory(traj: any) {
		const body = this.dom.body
		if (!Array.isArray(traj) || !traj.length) {
			body
				.append('div')
				.style('padding', '12px')
				.style('color', '#a00')
				.text(
					'No age/progression series in this selection — pick ≥3 cohorts that form one ordered series (same model/region/cell type, differing only by age or stage).'
				)
			return
		}
		const row = body.append('div').style('display', 'flex').style('gap', '24px').style('align-items', 'flex-start')
		const left = row.append('div')
		const panel = row.append('div').style('font-size', '0.85em').style('min-width', '170px')

		// controls (all refetch, and reset the drill-down since cluster identities change)
		panel.append('div').style('font-weight', '600').style('margin-bottom', '3px').text('DAP cutoffs')
		const numInput = (label: string, value: number, step: number, title: string, onSet: (v: number) => void) => {
			const l = panel.append('div').style('margin-bottom', '3px').attr('title', title)
			l.append('span').style('display', 'inline-block').style('width', '62px').html(label)
			l.append('input')
				.attr('type', 'number')
				.attr('step', step)
				.attr('min', 0)
				.property('value', value)
				.style('width', '60px')
				.on('change', (e: any) => {
					const v = Number(e.target.value)
					if (Number.isFinite(v) && v >= 0) {
						onSet(v)
						this.trajSelected = null
						this.reload()
					}
				})
		}
		numInput('|z| ≥', this.zThresh, 0.5, 'Variable-protein fold-change cutoff', v => (this.zThresh = v))
		numInput(
			'FDR ≤',
			this.fdrThresh,
			0.01,
			'Variable-protein significance cutoff (already an FDR)',
			v => (this.fdrThresh = v)
		)
		numInput(
			'clusters',
			this.nClusters,
			1,
			'Number of k-means clusters',
			v => (this.nClusters = Math.max(1, Math.round(v)))
		)

		panel
			.append('div')
			.style('margin-top', '10px')
			.style('font-size', '0.8em')
			.style('color', '#777')
			.style('line-height', '1.4')
			.html(
				'Each thin line is one protein (standardized log2FC-z).<br>The thick black line is the cluster eigengene (PC1).'
			)

		const genePanel = panel.append('div').style('margin-top', '14px')
		const showGenes = () => {
			const selSi = this.trajSelected?.si
			const s = selSi != null ? traj[selSi] : null
			const pr = s?.clusters?.[this.trajSelected!.pi]
			if (!pr) {
				genePanel.selectAll('*').remove()
				genePanel.append('div').style('color', '#888').text('Click a cluster to list its proteins.')
				return
			}
			this.renderGeneList(
				genePanel,
				`${pr.size.toLocaleString()} proteins · ${s!.label} · C${this.trajSelected!.pi + 1}:`,
				pr.genes
			)
		}

		const renderAll = () => {
			left.selectAll('*').remove()
			traj.forEach((s: any, si: number) => {
				const section = left.append('div').style('margin-bottom', '20px')
				section.append('div').style('font-weight', '600').style('max-width', '640px').text(s.label)
				section
					.append('div')
					.style('font-size', '0.8em')
					.style('color', '#888')
					.style('margin-bottom', '6px')
					.text(
						`${(s.geneCount || 0).toLocaleString()} variable proteins · ${s.points
							.map((p: any) => p.label)
							.join(' → ')}`
					)
				const grid = section.append('div').style('display', 'flex').style('flex-wrap', 'wrap').style('gap', '12px')
				if (!s.clusters?.length) {
					grid
						.append('div')
						.style('color', '#a00')
						.style('font-size', '0.85em')
						.text('No variable proteins at these cutoffs.')
					return
				}
				s.clusters.forEach((pr: any, pi: number) => {
					const selected = this.trajSelected != null && this.trajSelected.si === si && this.trajSelected.pi === pi
					const cell = grid
						.append('div')
						.style('border', selected ? '2px solid #333' : '1px solid #ddd')
						.style('border-radius', '4px')
						.style('padding', '4px 6px 2px')
						.style('cursor', 'pointer')
						.on('click', () => {
							this.trajSelected = selected ? null : { si, pi }
							renderAll()
							showGenes()
						})
					cell
						.append('div')
						.style('font-size', '0.8em')
						.style('font-weight', selected ? '700' : '600')
						.style('margin-bottom', '1px')
						.text(`C${pi + 1} · ${pr.size.toLocaleString()} proteins`)
					this.drawClusterPlot(cell.append('div'), s.points, pr)
				})
			})
		}
		renderAll()
		showGenes()
	}

	/** one cluster panel: faint member trajectories + a thick black eigengene line, over the ordered
	 *  timepoints (true-spaced by age). y = relative abundance (standardized log2FC-z). */
	drawClusterPlot(holder: any, points: { value: number; label: string }[], cluster: any) {
		const lines: number[][] = cluster.lines || []
		const eigengene: number[] = cluster.eigengene || []
		const W = 232,
			H = 162
		const M = { top: 8, right: 10, bottom: 34, left: 44 }
		const innerW = W - M.left - M.right
		const innerH = H - M.top - M.bottom
		const xs = points.map(p => p.value)
		const xmin = Math.min(...xs)
		const xmax = Math.max(...xs)

		let ymin = Infinity,
			ymax = -Infinity
		for (const ln of lines)
			for (const v of ln) {
				if (v < ymin) ymin = v
				if (v > ymax) ymax = v
			}
		for (const v of eigengene) {
			if (v < ymin) ymin = v
			if (v > ymax) ymax = v
		}
		if (!Number.isFinite(ymin)) {
			ymin = -2
			ymax = 2
		}
		if (ymin === ymax) {
			ymin -= 1
			ymax += 1
		}
		const padY = (ymax - ymin) * 0.06
		const x = scaleLinear()
			.domain([xmin, xmax])
			.range([M.left, M.left + innerW])
		const y = scaleLinear()
			.domain([ymin - padY, ymax + padY])
			.range([M.top + innerH, M.top])

		const svg = holder.append('svg').attr('width', W).attr('height', H).attr('font-family', 'sans-serif')
		if (ymin < 0 && ymax > 0)
			svg
				.append('line')
				.attr('x1', M.left)
				.attr('x2', M.left + innerW)
				.attr('y1', y(0))
				.attr('y2', y(0))
				.attr('stroke', '#eee')
		svg
			.append('g')
			.attr('transform', `translate(0,${M.top + innerH})`)
			.call(
				axisBottom(x)
					.tickValues(xs)
					.tickFormat(((_d: any, i: number) => points[i]?.label ?? '') as any) as any
			)
		svg
			.append('g')
			.attr('transform', `translate(${M.left},0)`)
			.call(axisLeft(y).ticks(3) as any)

		// axis labels: x = age (ticks are the ages), y = relative abundance (standardized log2FC-z)
		svg
			.append('text')
			.attr('x', M.left + innerW / 2)
			.attr('y', H - 3)
			.attr('text-anchor', 'middle')
			.style('font-size', '9px')
			.style('fill', '#555')
			.text('age')
		svg
			.append('text')
			.attr('transform', `translate(9,${M.top + innerH / 2}) rotate(-90)`)
			.attr('text-anchor', 'middle')
			.style('font-size', '9px')
			.style('fill', '#555')
			.text('relative abundance')

		const pathOf = (vec: number[]) => vec.map((v, i) => `${i ? 'L' : 'M'}${x(points[i].value)},${y(v)}`).join(' ')

		// faint individual member trajectories
		for (const ln of lines)
			svg
				.append('path')
				.attr('d', pathOf(ln))
				.attr('fill', 'none')
				.attr('stroke', '#888')
				.attr('stroke-width', 0.5)
				.attr('stroke-opacity', 0.22)
		// thick black eigengene trend
		if (eigengene.length)
			svg
				.append('path')
				.attr('d', pathOf(eigengene))
				.attr('fill', 'none')
				.attr('stroke', '#000')
				.attr('stroke-width', 2.5)
	}

	/** shared-vs-specific DAP overlap: an UpSet plot per direction (only offered for ≥3 cohorts).
	 *  Each protein falls in exactly one combination — the set of cohorts where it's a DAP in that
	 *  direction (|z| ≥ zThresh, FDR ≤ fdrThresh). Single-cohort groups are cohort-specific. */
	renderOverlap(overlap: any) {
		if (!overlap || !Array.isArray(overlap.up) || !Array.isArray(overlap.down)) {
			this.dom.body.append('div').style('padding', '12px').style('color', '#a00').text('Overlap unavailable.')
			return
		}
		const labels = this.cohorts.map(c => this.cohortLabel(c))
		const wrap = this.dom.body.append('div')

		// plots on the left, DAP-cutoff controls on the right
		const row = wrap.append('div').style('display', 'flex').style('gap', '24px').style('align-items', 'flex-start')
		const left = row.append('div')
		const panel = row.append('div').style('font-size', '0.85em').style('min-width', '150px')

		// DAP-cutoff controls (shared with the other views) — changing refetches
		panel.append('div').style('font-weight', '600').style('margin-bottom', '3px').text('DAP cutoffs')
		const numInput = (label: string, value: number, step: number, title: string, onSet: (v: number) => void) => {
			const l = panel.append('div').style('margin-bottom', '3px').attr('title', title)
			l.append('span').style('display', 'inline-block').style('width', '48px').html(label)
			l.append('input')
				.attr('type', 'number')
				.attr('step', step)
				.attr('min', 0)
				.property('value', value)
				.style('width', '64px')
				.on('change', (e: any) => {
					const v = Number(e.target.value)
					if (Number.isFinite(v) && v >= 0) {
						onSet(v)
						this.reload()
					}
				})
		}
		numInput('|z| ≥', this.zThresh, 0.5, 'DAP fold-change cutoff', v => (this.zThresh = v))
		numInput(
			'FDR ≤',
			this.fdrThresh,
			0.01,
			'DAP significance cutoff (the DAP p-value is already an FDR)',
			v => (this.fdrThresh = v)
		)

		const diagrams = left.append('div')

		// gene-list panel (right side, under the cutoffs), filled on click; first 10 shown, rest behind "more"
		const genePanel = panel.append('div').style('margin-top', '16px')
		const cohortPhrase = (idxs: number[]) => {
			const names = idxs.map(i => labels[i])
			if (names.length <= 1) return names[0] || '—'
			if (names.length === 2) return `${names[0]} and ${names[1]}`
			return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
		}
		const showGenes = (dir: string, combo: { cohorts: number[]; genes: string[] }) => {
			const cnt = combo.genes.length
			this.renderGeneList(
				genePanel,
				`${cnt.toLocaleString()} protein${cnt === 1 ? '' : 's'} ${dir.toLowerCase()} in ${cohortPhrase(
					combo.cohorts
				)}:`,
				combo.genes
			)
		}

		// one UpSet per direction, stacked (up above down)
		for (const [dir, combos] of [
			['Up-regulated', overlap.up],
			['Down-regulated', overlap.down]
		] as [string, any[]][]) {
			const box = diagrams.append('div').style('margin-bottom', '24px')
			box
				.append('div')
				.style('font-weight', '600')
				.style('margin-bottom', '4px')
				.text(`${dir} (${totalGenes(combos).toLocaleString()})`)
			this.drawUpSet(box, combos, labels, dir, showGenes)
		}
	}

	/** UpSet plot: intersection-size bars over a cohort-membership dot matrix. Bars clickable. */
	drawUpSet(
		container: any,
		combos: { cohorts: number[]; genes: string[] }[],
		labels: string[],
		dir: string,
		showGenes: (dir: string, combo: { cohorts: number[]; genes: string[] }) => void
	) {
		const n = labels.length
		const MAX_COLS = 22
		const shown = combos.slice(0, MAX_COLS)
		if (!shown.length) {
			container.append('div').style('color', '#a00').style('padding', '8px 0').text('No DAPs at these cutoffs.')
			return
		}
		const maxCount = Math.max(1, ...shown.map(c => c.genes.length))
		const leftW = 150,
			topPad = 14,
			barMaxH = 110,
			colW = 26,
			rowH = 15,
			dotR = 4.5
		const matrixTop = topPad + barMaxH + 14
		const W = leftW + shown.length * colW + 12
		const H = matrixTop + n * rowH + 8
		const svg = container.append('svg').attr('width', W).attr('height', H).attr('font-family', 'sans-serif')
		const barColor = dir[0] === 'U' ? UP : DOWN

		// per-cohort total DAP count (set size), over ALL combos (not just the shown ones)
		const totals = labels.map((_, i) => combos.reduce((s, c) => s + (c.cohorts.includes(i) ? c.genes.length : 0), 0))
		const yBar = scaleLinear().domain([0, maxCount]).range([0, barMaxH])

		// cohort rows (left labels + zebra background)
		for (let i = 0; i < n; i++) {
			svg
				.append('rect')
				.attr('x', leftW - 6)
				.attr('y', matrixTop + i * rowH)
				.attr('width', shown.length * colW + 6)
				.attr('height', rowH)
				.attr('fill', i % 2 ? '#f4f4f4' : '#fff')
			svg
				.append('text')
				.attr('x', leftW - 10)
				.attr('y', matrixTop + i * rowH + rowH / 2)
				.attr('text-anchor', 'end')
				.attr('dominant-baseline', 'central')
				.style('font-size', '11px')
				.text(`${labels[i]} (${totals[i].toLocaleString()})`)
		}

		shown.forEach(combo => {
			const j = shown.indexOf(combo)
			const x = leftW + j * colW + colW / 2
			const cnt = combo.genes.length
			const barH = yBar(cnt)
			const members = new Set(combo.cohorts)
			const tip = `${combo.cohorts.map(i => labels[i]).join(' ∩ ')}: ${cnt} proteins — click to list`

			// intersection bar
			svg
				.append('rect')
				.attr('x', x - colW * 0.34)
				.attr('y', topPad + barMaxH - barH)
				.attr('width', colW * 0.68)
				.attr('height', Math.max(1, barH))
				.attr('fill', barColor)
				.attr('fill-opacity', 0.85)
			svg
				.append('text')
				.attr('x', x)
				.attr('y', topPad + barMaxH - barH - 3)
				.attr('text-anchor', 'middle')
				.style('font-size', '9px')
				.style('fill', '#333')
				.text(cnt.toLocaleString())

			// membership connector line
			if (combo.cohorts.length > 1)
				svg
					.append('line')
					.attr('x1', x)
					.attr('x2', x)
					.attr('y1', matrixTop + Math.min(...combo.cohorts) * rowH + rowH / 2)
					.attr('y2', matrixTop + Math.max(...combo.cohorts) * rowH + rowH / 2)
					.attr('stroke', '#444')
					.attr('stroke-width', 1.5)
			for (let i = 0; i < n; i++)
				svg
					.append('circle')
					.attr('cx', x)
					.attr('cy', matrixTop + i * rowH + rowH / 2)
					.attr('r', dotR)
					.attr('fill', members.has(i) ? '#444' : '#d0d0d0')

			// transparent full-column hit area (small bars are otherwise hard to click)
			const hit = svg
				.append('rect')
				.attr('x', x - colW / 2)
				.attr('y', topPad)
				.attr('width', colW)
				.attr('height', H - topPad)
				.attr('fill', 'transparent')
				.style('cursor', 'pointer')
				.on('click', () => showGenes(dir, combo))
			hit.append('title').text(tip)
		})

		if (combos.length > shown.length)
			container
				.append('div')
				.style('font-size', '0.8em')
				.style('color', '#999')
				.style('margin-top', '2px')
				.text(`Showing the ${shown.length} largest of ${combos.length.toLocaleString()} intersections.`)
	}
}

type Hclust = {
	merge: { n1: number; n2: number }[]
	height: { height: number }[]
	order: { name: string }[]
	inputOrder: string[]
}

/** draw an hclust dendrogram into <g>. orient 'left' → leaves along y (row dendrogram, branches
 *  grow leftward); orient 'top' → leaves along x (column dendrogram, branches grow upward).
 *  leafSize = px per leaf (cell height/width); depth = px available for the height axis. */
function drawDendrogram(g: any, dend: Hclust, leafSize: number, depth: number, orient: 'left' | 'top') {
	const heights = dend.height.map(h => h.height)
	const maxH = Math.max(...heights, 1e-9)
	const toDepth = scaleLinear().domain([0, maxH]).range([depth, 0])
	const leafPos = new Map<string, number>()
	dend.order.forEach((leaf, i) => leafPos.set(leaf.name, i * leafSize + leafSize / 2))
	const merged = new Map<number, { leaf: number; depth: number }>()
	const pos = (n: number) =>
		n < 0 ? { leaf: leafPos.get(dend.inputOrder[-n - 1]) ?? 0, depth } : merged.get(n) || { leaf: 0, depth }
	const seg = (l1: number, d1: number, l2: number, d2: number) => {
		const [x1, y1, x2, y2] = orient === 'left' ? [d1, l1, d2, l2] : [l1, d1, l2, d2]
		g.append('line')
			.attr('x1', x1)
			.attr('y1', y1)
			.attr('x2', x2)
			.attr('y2', y2)
			.attr('stroke', '#555')
			.attr('stroke-width', 1)
	}
	for (let i = 0; i < dend.merge.length; i++) {
		const { n1, n2 } = dend.merge[i]
		const a = pos(n1),
			b = pos(n2)
		const d = toDepth(heights[i])
		seg(a.leaf, a.depth, a.leaf, d)
		seg(b.leaf, b.depth, b.leaf, d)
		seg(a.leaf, d, b.leaf, d)
		merged.set(i + 1, { leaf: (a.leaf + b.leaf) / 2, depth: d })
	}
}

/** average-linkage agglomerative clustering → leaf order (distance = 1 − correlation). n is small. */
function leafOrder(corr: number[][]): number[] {
	const n = corr.length
	const nodes: { members: number[] }[] = []
	for (let i = 0; i < n; i++) nodes.push({ members: [i] })
	let active = nodes.map((_, i) => i)
	const d0 = (i: number, j: number) => 1 - corr[i][j]
	const avgDist = (a: number, b: number) => {
		let s = 0
		for (const x of nodes[a].members) for (const y of nodes[b].members) s += d0(x, y)
		return s / (nodes[a].members.length * nodes[b].members.length)
	}
	while (active.length > 1) {
		let bi = 0,
			bj = 1,
			bd = Infinity
		for (let a = 0; a < active.length; a++)
			for (let b = a + 1; b < active.length; b++) {
				const d = avgDist(active[a], active[b])
				if (d < bd) {
					bd = d
					bi = a
					bj = b
				}
			}
		const A = active[bi],
			B = active[bj]
		nodes.push({ members: [...nodes[A].members, ...nodes[B].members] })
		active = active.filter((_, k) => k !== bi && k !== bj)
		active.push(nodes.length - 1)
	}
	return nodes[active[0]].members
}

/** total DAP proteins across all combinations of one direction (each protein is in exactly one) */
function totalGenes(combos: { genes: string[] }[]): number {
	return combos.reduce((s, c) => s + c.genes.length, 0)
}

export const componentInit = getCompInit(ProteomeCohortCompare)

export async function getPlotConfig(opts: any) {
	const config = structuredClone(defaultConfig)
	if (!opts.cohorts || opts.cohorts.length < 2) throw new Error('proteomeCohortCompare requires ≥2 cohorts')
	return copyMerge(config, opts)
}
