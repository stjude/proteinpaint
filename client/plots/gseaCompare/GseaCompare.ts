import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.js'
import { downloadTable, fileDateStamp } from '#dom'
import { downloadSingleSVG } from '#common/svg.download'
import { TermTypes } from '#types'
import { GseaCompareModel, getColumns, getColumnConfig } from './model'
import { buildGrid, gridTable, type ColumnResult, type GridSettings } from './viewModel'
import { GseaCompareView } from './view'

/* Pathway comparison: gene-set enrichment of several comparisons side by side, as a bubble heatmap of gene sets by
comparison. Each comparison is a case group against one reference group, on one data type: gene expression (DE fold
change) or DNA methylation (gene-body Δβ of a DMR scan). Opened from the Groups tab with 3 or more groups
(mass/groups.js); config.samplelst.groups[0] is the reference.

Every column runs the same requests as the differential analysis of its pair (./model.ts), so a cell opens that
analysis' GSEA tab on its gene set, from the same caches. Settings that only change the drawing (q cutoff, rows, sort)
redraw from the results already fetched. */

const HALLMARK = 'H: hallmark gene sets'

export type GseaCompareSettings = GridSettings & { pathway: string }

class GseaCompare extends PlotBase implements RxComponent {
	static type = 'gseaCompare'
	type = GseaCompare.type
	model: GseaCompareModel
	view!: GseaCompareView
	results: ColumnResult[] = []
	dataKey = ''

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.model = new GseaCompareModel(this)
		const holder = opts.holder.append('div').attr('data-testid', 'sjpp-gseaCompare').style('padding', '10px')
		this.dom = {
			header: opts.header,
			holder,
			controls: holder.append('div').attr('data-testid', 'sjpp-gseaCompare-controls'),
			// one polite live region for progress and sort announcements; never the grid itself
			status: holder
				.append('div')
				.attr('role', 'status')
				.style('margin', '6px 0')
				.style('font-size', '.9em')
				.style('opacity', 0.8),
			grid: holder.append('div').style('overflow-x', 'auto')
		}
		this.view = new GseaCompareView(this.dom.grid, this.dom.status)
	}

	getState(appState: any) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw new Error(`No plot with id='${this.id}' found`)
		return { config, termfilter: appState.termfilter }
	}

	async main() {
		const { config, termfilter } = this.state
		const columns = getColumns(config)
		const s: GseaCompareSettings = config.settings.gseaCompare
		this.dom.header?.text(`Pathway comparison: ${columns.length} comparisons`)
		this.renderControls(s)
		const key = JSON.stringify([config.samplelst.groups, config.termTypes, s.pathway, termfilter])
		const draw = () => {
			const grid = buildGrid(columns, this.results, s)
			this.view.render(grid, columns, this.results, s, {
				onSort: col => this.sort(col),
				onOpen: (r, c) => this.openColumnGsea(columns[c], grid.rows[r].key)
			})
			const done = this.results.filter(r => r.status != 'pending').length
			if (done < columns.length)
				this.dom.status.text(
					`Running ${done + 1}–${columns.length} of ${
						columns.length
					} comparisons; each fills in as it finishes. A first run of a methylation scan takes minutes.`
				)
			else if (s.sortCol != null)
				this.dom.status.text(
					`Sorted by ${columns[s.sortCol].caseName}, ${columns[s.sortCol].dataLabel}, ${s.sortDir}; ${
						grid.rows.length
					} gene sets`
				)
		}
		if (key == this.dataKey) return draw()
		this.dataKey = key
		this.results = columns.map(() => ({ status: 'pending' }))
		draw()
		await this.model.runAll(config, columns, (i, r) => {
			if (key != this.dataKey) return // superseded by a newer request
			this.results[i] = r
			draw()
		})
	}

	sort(col: number) {
		const s = this.state.config.settings.gseaCompare
		const sortDir = s.sortCol == col && s.sortDir == 'descending' ? 'ascending' : 'descending'
		this.edit({ sortCol: col, sortDir })
	}

	edit(changes: Partial<GseaCompareSettings>) {
		this.app.dispatch({ type: 'plot_edit', id: this.id, config: { settings: { gseaCompare: changes } } })
	}

	/** the differential analysis of the cell's pair, on its GSEA tab with the gene set's enrichment plot */
	openColumnGsea(col, genesetName: string) {
		// the cell's tooltip would otherwise stay over the plot it opens
		this.view.tip.hide()
		const c = getColumnConfig(this.state.config, col, this.app)
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'differentialAnalysis',
				childType: 'gsea',
				termType: c.termType,
				samplelst: c.samplelst,
				...(c.tw ? { tw: c.tw } : {}),
				settings: {
					volcano: { elementType: c.settings.volcano.elementType },
					gsea: { pathway: this.state.config.settings.gseaCompare.pathway }
				},
				gsea_params: { geneset_name: genesetName }
			}
		})
	}

	renderControls(s: GseaCompareSettings) {
		const d = this.dom.controls
		d.selectAll('*').remove()
		d.style('display', 'flex').style('flex-wrap', 'wrap').style('gap', '6px 16px').style('align-items', 'center')
		const field = (label: string) => {
			const l = d.append('label').style('display', 'inline-flex').style('gap', '6px').style('align-items', 'center')
			l.append('span').text(label)
			return l
		}
		const groups = (this.app.opts.genome?.termdbs?.msigdb?.analysisGenesetGroups || []).filter(g => g.value != '-')
		const sel = field('Gene sets')
			.append('select')
			.attr('data-testid', 'sjpp-gseaCompare-pathway')
			.on('change', e => this.edit({ pathway: e.target.value }))
		for (const g of groups)
			sel
				.append('option')
				.attr('value', g.value)
				.property('selected', g.value == s.pathway)
				.text(g.label)

		field('q <')
			.append('input')
			.attr('type', 'number')
			.attr('min', 0.0001)
			.attr('max', 1)
			.attr('step', 0.01)
			.style('width', '5em')
			.property('value', s.fdrCutoff)
			.on('change', e => {
				const v = Number(e.target.value)
				if (v > 0 && v <= 1) this.edit({ fdrCutoff: v })
			})

		const rows = field('Rows')
			.append('select')
			.on('change', e => this.edit({ rowFilter: e.target.value }))
		for (const [v, t] of [
			['significant', 'Significant in any comparison'],
			['all', 'All gene sets']
		])
			rows
				.append('option')
				.attr('value', v)
				.property('selected', v == s.rowFilter)
				.text(t)

		field('Show at most')
			.append('input')
			.attr('type', 'number')
			.attr('min', 5)
			.attr('max', 500)
			.attr('step', 5)
			.style('width', '5em')
			.property('value', s.maxRows)
			.on('change', e => {
				const v = Math.round(Number(e.target.value))
				if (v >= 5) this.edit({ maxRows: v })
			})

		d.append('button')
			.attr('type', 'button')
			.property('disabled', s.sortCol == null)
			.attr('title', 'Shared gene sets first: by the number of comparisons where q passes, then by |NES|')
			.text('Default order')
			.on('click', () => this.edit({ sortCol: null }))
		d.append('button')
			.attr('type', 'button')
			.text('Download SVG')
			.on('click', () => {
				const svg = this.dom.grid.select('svg')
				if (!svg.empty()) downloadSingleSVG(svg, `pathway-comparison-${fileDateStamp()}.svg`, this.dom.grid.node())
			})
		d.append('button')
			.attr('type', 'button')
			.text('Download table')
			.on('click', () => {
				const columns = getColumns(this.state.config)
				const grid = buildGrid(columns, this.results, { ...s, maxRows: Infinity })
				const { rows, cols } = gridTable(grid, columns)
				downloadTable(rows, cols, `pathway-comparison-${fileDateStamp()}.tsv`)
			})
	}
}

export const gseaCompareInit = getCompInit(GseaCompare)
export const componentInit = gseaCompareInit

/** opts: samplelst {groups: [reference, case, case, ...]}, tw (the groups' samplelst tw, for colors), termTypes */
export function getPlotConfig(opts: any, app: any) {
	if (!(opts.samplelst?.groups?.length >= 2)) throw new Error('a reference and at least one other group are required')
	const lst = (app?.opts?.genome?.termdbs?.msigdb?.analysisGenesetGroups || []).filter(g => g.value != '-')
	const settings: GseaCompareSettings = {
		pathway: lst.some(g => g.value == HALLMARK) ? HALLMARK : lst[0]?.value,
		fdrCutoff: 0.05,
		rowFilter: 'significant',
		maxRows: 50,
		sortCol: null,
		sortDir: 'descending'
	}
	const config = {
		chartType: 'gseaCompare',
		termTypes: [TermTypes.GENE_EXPRESSION],
		settings: { gseaCompare: settings },
		hidePlotFilter: true
	}
	return copyMerge(config, opts)
}
