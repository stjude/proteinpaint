import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from './PlotBase'
import { Menu, renderTable, addGeneSearchbox } from '#dom'
import type { TableColumn, TableRow } from '#dom'

/** PTM proteome layers — kept separate from protein-level (Whole/Insoluble) layers because
 *  PTM z is site-level collapsed to gene, so the two aren't directly comparable in a scatter/heatmap */
const PTM_PROTEOMES = new Set(['Phospho', 'Ubiquitin'])

/** facets that get a "launch chart" button. needsGene=false charts launch directly (no gene
 *  picker); gene-centric charts prompt for a gene first. `requires(queries)` gates the button on
 *  the dataset config that chart needs, so it only shows where the chart can actually run. */
const FACET_CHART: Record<
	string,
	{ chartType: string; label: string; needsGene: boolean; requires: (q: any) => boolean }
> = {
	disease: {
		chartType: 'animatedBubbleChart',
		label: 'Bubble Chart',
		needsGene: false,
		requires: q => !!q?.geneRanking
	},
	cellType: {
		chartType: 'cellTypeBubbleHeatmap',
		label: 'Cell-type Bubble Heatmap',
		needsGene: true,
		requires: q => !!q?.proteome?.cellTypeBubbleHeatmap
	},
	brainRegion: {
		chartType: 'brainRegions',
		label: 'Brain Regional Proteome',
		needsGene: true,
		requires: q => !!q?.proteome?.brainRegions
	}
}

const defaultConfig = {
	chartType: 'studyCatalog'
}

type CatalogColumn = { key: string; label: string }
type CatalogUiConfig = {
	columns: CatalogColumn[]
	facets: string[]
}
type CatalogRow = { [key: string]: string } & { organism: string; assay: string; cohort: string }

const PANEL_GAP = 24
const FACET_WIDTH = 210

class StudyCatalog extends PlotBase implements RxComponent {
	static type = 'studyCatalog'
	type: string
	dom!: {
		holder: any
		body: any
		facetsDiv: any
		rightDiv: any
		actionBtn: any
		countSpan: any
		tableDiv: any
		tip: Menu
		header?: any
	}
	/** active filter values per facet key; empty set (or absent) = no filter on that facet */
	activeFilters: Map<string, Set<string>> = new Map()
	/** derived rows, one per cohort */
	rows: CatalogRow[] = []
	/** currently checked rows */
	selected: CatalogRow[] = []
	/** stable keys of the checked cohorts, so selection survives a table re-render */
	selectedKeys: Set<string> = new Set()
	/** number of cohorts currently passing the filters (shown when nothing is selected) */
	filteredCount = 0

	constructor(opts: any, api) {
		super(opts, api)
		this.type = StudyCatalog.type
	}

	async init() {
		const holder = this.opts.holder.append('div').style('padding', '10px')
		const body = holder.append('div')
		this.dom = {
			holder,
			body,
			facetsDiv: undefined,
			rightDiv: undefined,
			actionBtn: undefined,
			countSpan: undefined,
			tableDiv: undefined,
			tip: new Menu({ padding: '' }),
			header: this.opts.header
		}
		if (this.dom.header) this.dom.header.html('Sample Sets')
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	async main() {
		const proteome = this.app.vocabApi.termdbConfig?.queries?.proteome
		const ui: CatalogUiConfig | undefined = proteome?.studyCatalog
		this.dom.body.selectAll('*').remove()
		if (!ui || !proteome?.organisms) {
			this.dom.body
				.append('div')
				.style('padding', '20px')
				.style('color', '#666')
				.text('No study catalog is configured.')
			return
		}

		this.rows = this.deriveRows(proteome.organisms)
		if (!this.rows.length) {
			this.dom.body.append('div').style('padding', '20px').style('color', '#666').text('No cohorts found.')
			return
		}

		// top bar (above facets + table): action button + count, indented so they line up with
		// the table's left edge (its line-number column), not with the filter rail
		const topBar = this.dom.body
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '12px')
			.style('margin-bottom', '8px')
			.style('padding-left', `${FACET_WIDTH + PANEL_GAP}px`)
		this.dom.actionBtn = topBar
			.append('button')
			.attr('class', 'sjpp_apply_btn sja_sharp_border')
			.property('disabled', true)
			.text('Analyze Cohort')
			.on('click', () => this.onAction())
		this.dom.countSpan = topBar.append('span').style('font-size', '0.85em').style('color', '#555')

		const layout = this.dom.body.append('div').style('display', 'flex').style('gap', `${PANEL_GAP}px`)

		// left rail — filters; border-box so its total width is exactly FACET_WIDTH (keeps the
		// button/table alignment above), capped to the table's height so the two line up
		this.dom.facetsDiv = layout
			.append('div')
			.style('flex', `0 0 ${FACET_WIDTH}px`)
			.style('box-sizing', 'border-box')
			.style('max-height', '60vh')
			.style('overflow-y', 'auto')
			.style('border-right', '1px solid #eee')
			.style('padding-right', '12px')

		// right — table
		this.dom.rightDiv = layout.append('div').style('flex', '1 1 auto').style('min-width', '0')
		this.dom.tableDiv = this.dom.rightDiv.append('div')

		this.renderFacets(ui)
		this.renderTable(ui)
	}

	/** one row per organism→assay→cohort. `species` and `proteome` are derived from the query
	 *  structure (organism key + the assay's proteomeLabel); every other display field comes from
	 *  the cohort's `catalog` object in the dataset. A `catalog` key can still override either. */
	deriveRows(organisms: any): CatalogRow[] {
		const rows: CatalogRow[] = []
		for (const organism in organisms) {
			const species = organism.charAt(0).toUpperCase() + organism.slice(1)
			const assays = organisms[organism].assays || {}
			for (const assay in assays) {
				const proteome = assays[assay].proteomeLabel || assay
				const cohorts = assays[assay].cohorts || {}
				for (const cohort in cohorts) {
					// species/proteome first so catalog may override them; identity keys last so it can't
					rows.push({ species, proteome, ...(cohorts[cohort].catalog || {}), organism, assay, cohort } as CatalogRow)
				}
			}
		}
		return rows
	}

	/** rows passing every active filter, optionally excluding one facet (for that facet's own counts) */
	filteredRows(excludeFacet?: string): CatalogRow[] {
		return this.rows.filter(row => {
			for (const [facet, values] of this.activeFilters) {
				if (facet === excludeFacet) continue
				if (values.size === 0) continue
				if (!values.has(row[facet] || '')) return false
			}
			return true
		})
	}

	facetLabel(ui: CatalogUiConfig, key: string): string {
		return ui.columns.find(c => c.key === key)?.label || key
	}

	renderFacets(ui: CatalogUiConfig) {
		const div = this.dom.facetsDiv
		div.selectAll('*').remove()

		// dataset query config, used to gate each facet's chart button on what the chart needs
		const queries = this.app.vocabApi.termdbConfig?.queries

		const header = div
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('margin-bottom', '8px')
		header.append('span').style('font-weight', 'bold').text('Filter by')
		const anyActive = [...this.activeFilters.values()].some(s => s.size > 0)
		header
			.append('span')
			.style('margin-left', 'auto')
			.style('font-size', '0.8em')
			.style('color', anyActive ? '#0a5' : '#aaa')
			.style('cursor', anyActive ? 'pointer' : 'default')
			.text('clear all')
			.on('click', () => {
				if (!anyActive) return
				this.activeFilters.clear()
				this.renderFacets(ui)
				this.renderTable(ui)
			})

		for (const facet of ui.facets) {
			// counts reflect all OTHER active filters (standard faceted behavior)
			const scope = this.filteredRows(facet)
			const counts = new Map<string, number>()
			for (const row of scope) {
				const v = row[facet] || ''
				if (!v) continue
				counts.set(v, (counts.get(v) || 0) + 1)
			}
			if (counts.size === 0) continue

			const group = div.append('div').style('margin-bottom', '12px')
			const titleRow = group
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('gap', '6px')
				.style('margin-bottom', '4px')
			titleRow.append('span').style('font-weight', '600').style('font-size', '0.9em').text(this.facetLabel(ui, facet))
			// some facets get a button that launches a related chart — only if the dataset supports it
			const chart = FACET_CHART[facet]
			if (chart && chart.requires(queries)) {
				titleRow
					.append('button')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.style('font-size', '0.72em')
					.style('padding', '1px 5px')
					.style('cursor', 'pointer')
					.attr('title', `Open ${chart.label}`)
					.text('📊')
					.on('click', (event: any) => this.openChartMenu(chart, event))
			}

			const active = this.activeFilters.get(facet) || new Set<string>()
			const values = [...counts.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
			for (const value of values) {
				const line = group
					.append('label')
					.style('display', 'flex')
					.style('align-items', 'center')
					.style('gap', '6px')
					.style('font-size', '0.85em')
					.style('cursor', 'pointer')
					.style('padding', '1px 0')
				line
					.append('input')
					.attr('type', 'checkbox')
					.property('checked', active.has(value))
					.on('change', (event: any) => {
						const set = this.activeFilters.get(facet) || new Set<string>()
						if (event.target.checked) set.add(value)
						else set.delete(value)
						if (set.size) this.activeFilters.set(facet, set)
						else this.activeFilters.delete(facet)
						this.renderFacets(ui)
						this.renderTable(ui)
					})
				line.append('span').style('flex', '1 1 auto').text(value)
				line.append('span').style('color', '#999').text(counts.get(value)!)
			}
		}
	}

	renderTable(ui: CatalogUiConfig) {
		const rows = this.filteredRows()
		this.filteredCount = rows.length
		this.dom.tableDiv.selectAll('*').remove()
		this.dom.tableDiv.style('font-size', '13px')

		// preserve selection across re-renders (rx main() rebuilds the table): preselect the
		// still-visible rows whose cohort is selected, and prune keys that got filtered out
		const selectedRows: number[] = []
		rows.forEach((r, i) => {
			if (this.selectedKeys.has(this.cohortKey(r))) selectedRows.push(i)
		})
		this.selected = selectedRows.map(i => rows[i])
		this.selectedKeys = new Set(this.selected.map(r => this.cohortKey(r)))
		this.updateActionBtn()

		const columns: TableColumn[] = ui.columns.map(c => ({ label: c.label, sortable: true }))
		const tableRows: TableRow[] = rows.map(row => ui.columns.map(c => ({ value: row[c.key] ?? '' })) as TableRow)

		renderTable({
			columns,
			rows: tableRows,
			div: this.dom.tableDiv,
			showLines: true,
			striped: true,
			maxHeight: '60vh',
			maxWidth: '72vw',
			resize: true,
			selectedRows,
			header: { allowSort: true, style: { 'font-weight': 'bold', color: '#000' } },
			buttons: [
				{
					text: 'select',
					callback: () => {},
					onChange: (idxs: number[], button: any) => {
						button.style.display = 'none'
						let sel = idxs.map(i => rows[i])
						if (sel.length > 1) {
							const cls = this.proteomeClass(sel[0])
							const offIdx = new Set(idxs.filter(i => this.proteomeClass(rows[i]) !== cls))
							if (offIdx.size) {
								sel = idxs.filter(i => !offIdx.has(i)).map(i => rows[i])
								const nodes = this.dom.tableDiv.selectAll('tbody input[type="checkbox"]').nodes() as HTMLInputElement[]
								for (const node of nodes) if (offIdx.has(Number(node.getAttribute('value')))) node.checked = false
							}
						}
						this.selected = sel
						this.selectedKeys = new Set(sel.map(r => this.cohortKey(r)))
						this.updateActionBtn()
						this.applyClassLock(rows)
					}
				}
			]
		})
	}

	/** stable identity of a cohort row, used to keep the selection across re-renders */
	cohortKey(row: CatalogRow): string {
		return `${row.organism}|${row.assay}|${row.cohort}`
	}

	/** PTM (site-level) vs non-PTM (protein-level) class of a cohort row */
	proteomeClass(row: CatalogRow): 'ptm' | 'nonptm' {
		return PTM_PROTEOMES.has(row.proteome) ? 'ptm' : 'nonptm'
	}

	/** PTM/non-PTM lock: once a cohort is selected, disable + dim checkboxes
	 *  for cohorts of the OTHER class. */
	applyClassLock(rows: CatalogRow[]) {
		const locked = this.selected.length ? this.proteomeClass(this.selected[0]) : null
		const nodes = this.dom.tableDiv.selectAll('tbody input[type="checkbox"]').nodes() as HTMLInputElement[]
		for (const input of nodes) {
			const vAttr = input.getAttribute('value')
			if (vAttr === null) continue
			const idx = Number(vAttr)
			if (!Number.isInteger(idx) || idx < 0 || idx >= rows.length) continue
			const disable = locked !== null && !input.checked && this.proteomeClass(rows[idx]) !== locked
			input.disabled = disable
			const tr = input.closest('tr') as HTMLElement | null
			if (tr) tr.style.opacity = disable ? '0.4' : ''
		}
	}

	/** update the action button + count text from the current selection.
	 *  count: nothing selected → total filtered cohorts; 1 selected → hidden; ≥2 → selected count */
	updateActionBtn() {
		const btn = this.dom.actionBtn
		if (!btn) return
		const n = this.selected.length
		btn.property('disabled', n === 0).text(n >= 2 ? 'Compare cohorts' : 'Analyze Cohort')
		const cs = this.dom.countSpan
		if (n === 1) cs.style('display', 'none')
		else if (n >= 2) cs.style('display', '').text(`${n} cohorts`)
		else cs.style('display', '').text(`${this.filteredCount} cohort${this.filteredCount === 1 ? '' : 's'}`)
	}

	/** run the action for the current selection: 1 cohort → Analyze; ≥2 → Compare */
	onAction() {
		const sel = this.selected
		if (sel.length === 1) this.openAnalyticsTools(sel[0])
		else if (sel.length >= 2) this.openCompare(sel)
	}

	/** launch a facet's chart. Charts that don't need a gene open directly; gene-centric ones
	 *  prompt for a gene first. Dispatches exactly chart.chartType (no importPlot indirection). */
	openChartMenu(chart: { chartType: string; needsGene: boolean }, event: any) {
		if (!chart.needsGene) {
			this.app.dispatch({ type: 'plot_create', config: { chartType: chart.chartType } })
			return
		}
		this.dom.tip.clear().show(event.clientX, event.clientY)
		const row = this.dom.tip.d.append('div').style('padding', '5px')
		row.append('span').style('font-weight', 'bold').text('Enter a gene name:')
		const geneSearch = addGeneSearchbox({
			row,
			genome: this.app.opts.genome,
			tip: new Menu({ padding: '0px' }),
			searchOnly: 'gene',
			callback: () => {
				if (!geneSearch.geneSymbol) throw new Error('A valid gene selection is required')
				this.dom.tip.hide()
				this.app.dispatch({ type: 'plot_create', config: { chartType: chart.chartType, gene: geneSearch.geneSymbol } })
			}
		})
	}

	/** open the ProteomeInput "Analytics Tools" panel for a cohort, mirroring the
	 *  Sample Selection (proteomeAbundance) chart's "Analytics Tools" button */
	openAnalyticsTools(row: CatalogRow) {
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'ProteomeInput',
				proteomeDetails: { organism: row.organism, assay: row.assay, cohort: row.cohort },
				hidePlotFilter: true
			}
		})
	}

	/** open the cross-cohort log2FC-z comparison for the selected cohorts */
	openCompare(selected: CatalogRow[]) {
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'proteomeCohortCompare',
				cohorts: selected.map(r => ({ organism: r.organism, assay: r.assay, cohort: r.cohort, label: r.cohort })),
				crossSpecies: false
			}
		})
	}
}

export const componentInit = getCompInit(StudyCatalog)

export async function getPlotConfig(opts: any) {
	const config = structuredClone(defaultConfig)
	return copyMerge(config, opts)
}
