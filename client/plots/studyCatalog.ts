import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from './PlotBase'
import { Menu, renderTable, addGeneSearchbox } from '#dom'
import type { TableColumn, TableRow } from '#dom'
import { orderBy } from './proteinView.tiles'

/** The Proteome facet is nested under a derived single-select "Data type" facet
 *  (Protein → protein-level assays; PTM → assays marked PTMType in the dataset config).
 *  PTM layers are kept separate from protein-level layers because PTM z is site-level
 *  collapsed to gene, so the two aren't directly comparable in a scatter/heatmap: the
 *  radio keeps them apart structurally and the Proteome checkboxes only ever list the
 *  active class — no rows need to be greyed out after the fact. Proteome values sort
 *  in the order their assays appear in the dataset config. */
const DATA_TYPE_FACET = 'dataType'
const DATA_TYPE_CHILD = 'proteome'
const DATA_TYPE_LABEL = 'Data type'
const DATA_TYPE_ORDER = ['Protein', 'PTM']

/** proteome labels in dataset order (first appearance across organisms/assays) */
function proteomeOrder(organisms: any): string[] {
	const out: string[] = []
	for (const org of Object.values(organisms || {}) as any[]) {
		for (const assay in org?.assays || {}) {
			const label = org.assays[assay].proteomeLabel || assay
			if (!out.includes(label)) out.push(label)
		}
	}
	return out
}

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

/** urlBase renders the cell as a link to urlBase+value (e.g. a PubMed ID column) */
type CatalogColumn = { key: string; label: string; urlBase?: string }
type CatalogUiConfig = {
	columns: CatalogColumn[]
	facets: string[]
	/** facets rendered as radio buttons instead of checkboxes: exactly one value is active at
	 *  all times (defaults to the first value), so rows of different values never mix in the table */
	singleSelectFacets?: string[]
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

	constructor(opts: any, api: ComponentApi) {
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
		if (this.dom.header) this.dom.header.html('Studies')
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
					const dataType = assays[assay].PTMType ? 'PTM' : 'Protein'
					rows.push({
						species,
						proteome,
						dataType,
						...(cohorts[cohort].catalog || {}),
						organism,
						assay,
						cohort
					} as CatalogRow)
				}
			}
		}
		return rows
	}

	/** rows passing every active filter, optionally excluding one facet (for that facet's own counts) */
	filteredRows(excludeFacet?: string | string[]): CatalogRow[] {
		const excluded = new Set(Array.isArray(excludeFacet) ? excludeFacet : excludeFacet ? [excludeFacet] : [])
		return this.rows.filter(row => {
			for (const [facet, values] of this.activeFilters) {
				if (excluded.has(facet)) continue
				if (values.size === 0) continue
				if (!values.has(row[facet] || '')) return false
			}
			return true
		})
	}

	facetLabel(ui: CatalogUiConfig, key: string): string {
		if (key === DATA_TYPE_FACET) return DATA_TYPE_LABEL
		return ui.columns.find(c => c.key === key)?.label || key
	}

	/** facet order to render: the proteome facet is replaced by its Data type parent,
	 *  which renders the proteome values nested under the active radio option */
	effectiveFacets(ui: CatalogUiConfig): string[] {
		return ui.facets.map(f => (f === DATA_TYPE_CHILD ? DATA_TYPE_FACET : f))
	}

	sortValues(facet: string, values: string[]): string[] {
		const fixed =
			facet === DATA_TYPE_FACET
				? DATA_TYPE_ORDER
				: facet === DATA_TYPE_CHILD
				? proteomeOrder(this.app.vocabApi.termdbConfig?.queries?.proteome?.organisms)
				: null
		if (fixed)
			return orderBy(
				[...values].sort((a, b) => a.localeCompare(b)),
				fixed
			)
		return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
	}

	/** filters to ignore when computing a facet's own value counts: itself, plus — for the
	 *  Data type parent — its nested proteome filter, so that ticking e.g. "Insoluble" under
	 *  Protein never makes the PTM option disappear (it must stay clickable to switch class) */
	facetScopeExclusions(facet: string): string[] {
		return facet === DATA_TYPE_FACET ? [DATA_TYPE_FACET, DATA_TYPE_CHILD] : [facet]
	}

	/** counts of one facet's values under all OTHER active filters (standard faceted behavior) */
	facetCounts(facet: string): Map<string, number> {
		const counts = new Map<string, number>()
		for (const row of this.filteredRows(this.facetScopeExclusions(facet))) {
			const v = row[facet] || ''
			if (!v) continue
			counts.set(v, (counts.get(v) || 0) + 1)
		}
		return counts
	}

	/** one radio/checkbox line of a facet */
	appendFacetOption(
		ui: CatalogUiConfig,
		group: any,
		facet: string,
		value: string,
		count: number,
		single: boolean,
		checked: boolean,
		indentPx = 0
	) {
		const line = group
			.append('label')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '6px')
			.style('font-size', '0.85em')
			.style('cursor', 'pointer')
			.style('padding', '1px 0')
			.style('margin-left', indentPx ? `${indentPx}px` : null)
		line
			.append('input')
			.attr('type', single ? 'radio' : 'checkbox')
			.attr('name', single ? `sjpp-studyCatalog-facet-${this.id}-${facet}` : null)
			.property('checked', checked)
			.on('change', (event: any) => {
				if (single) {
					// radio: picking a value replaces the facet's single active value
					this.activeFilters.set(facet, new Set([value]))
					// the nested proteome values belong to the previous class; drop them
					if (facet === DATA_TYPE_FACET) this.activeFilters.delete(DATA_TYPE_CHILD)
				} else {
					const set = this.activeFilters.get(facet) || new Set<string>()
					if (event.target.checked) set.add(value)
					else set.delete(value)
					if (set.size) this.activeFilters.set(facet, set)
					else this.activeFilters.delete(facet)
				}
				this.renderFacets(ui)
				this.renderTable(ui)
			})
		line.append('span').style('flex', '1 1 auto').text(value)
		line.append('span').style('color', '#999').text(count)
	}

	renderFacets(ui: CatalogUiConfig) {
		const div = this.dom.facetsDiv
		div.selectAll('*').remove()

		// dataset query config, used to gate each facet's chart button on what the chart needs
		const queries = this.app.vocabApi.termdbConfig?.queries

		// single-select facets always have exactly one active value; default to the first available value
		// under the other active filters (also reapplied after "clear all"), so the table never mixes e.g. species
		const facets = this.effectiveFacets(ui)
		const singleSelect = new Set(ui.singleSelectFacets || [])
		if (facets.includes(DATA_TYPE_FACET)) singleSelect.add(DATA_TYPE_FACET)
		for (const facet of singleSelect) {
			if (!facets.includes(facet)) continue
			// available values given the other active filters (exclude this facet itself)
			const scope = this.filteredRows(this.facetScopeExclusions(facet))
			const values = this.sortValues(facet, [...new Set(scope.map(r => r[facet]).filter(Boolean))])
			if (!values.length) {
				this.activeFilters.delete(facet)
				if (facet === DATA_TYPE_FACET) this.activeFilters.delete(DATA_TYPE_CHILD)
				continue
			}
			const active = this.activeFilters.get(facet)
			const activeValue = active && active.size === 1 ? [...active][0] : null
			if (activeValue && values.includes(activeValue)) continue
			this.activeFilters.set(facet, new Set([values[0]]))
			// the class changed under the user: its nested proteome values belong to the old
			// class and would otherwise filter invisibly (nothing checked, empty table)
			if (facet === DATA_TYPE_FACET) this.activeFilters.delete(DATA_TYPE_CHILD)
		}

		const header = div
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('margin-bottom', '8px')
		header.append('span').style('font-weight', 'bold').text('Filter by')
		// single-select facets are always active by design, so they don't count towards "clear all"
		const anyActive = [...this.activeFilters.entries()].some(([f, s]) => !singleSelect.has(f) && s.size > 0)
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

		for (const facet of facets) {
			const counts = this.facetCounts(facet)
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

			const single = singleSelect.has(facet)
			const active = this.activeFilters.get(facet) || new Set<string>()
			for (const value of this.sortValues(facet, [...counts.keys()])) {
				this.appendFacetOption(ui, group, facet, value, counts.get(value)!, single, active.has(value))
				// nested proteome checkboxes under the active Data type option
				if (facet === DATA_TYPE_FACET && active.has(value)) {
					const childCounts = this.facetCounts(DATA_TYPE_CHILD)
					const childActive = this.activeFilters.get(DATA_TYPE_CHILD) || new Set<string>()
					for (const cv of this.sortValues(DATA_TYPE_CHILD, [...childCounts.keys()])) {
						this.appendFacetOption(ui, group, DATA_TYPE_CHILD, cv, childCounts.get(cv)!, false, childActive.has(cv), 22)
					}
				}
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

		// Columns are data-driven: a column that is empty for every row under the
		// current facet selection is dropped, so a single-species selection shows
		// only that species' attributes (e.g. brain region for human; model, cell
		// type and age group for mouse) instead of a fixed column set. With no rows
		// at all, keep every column so the empty table still has a header.
		// Single-select facets (e.g. Species) are dropped too: their radio always
		// states the one active value, so the column would just repeat it.
		const singleSelect = new Set(ui.singleSelectFacets || [])
		const visibleColumns = rows.length
			? ui.columns.filter(c => !singleSelect.has(c.key) && rows.some(row => row[c.key] != null && row[c.key] !== ''))
			: ui.columns
		const columns: TableColumn[] = visibleColumns.map(c => ({ label: c.label, sortable: true }))
		const tableRows: TableRow[] = rows.map(
			row =>
				visibleColumns.map(c => {
					const value = row[c.key] ?? ''
					return c.urlBase && value ? { value, url: c.urlBase + value } : { value }
				}) as TableRow
		)

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
						// the Data type radio already keeps PTM and protein-level cohorts apart,
						// so any combination of visible rows is a valid selection
						this.selected = idxs.map(i => rows[i])
						this.selectedKeys = new Set(this.selected.map(r => this.cohortKey(r)))
						this.updateActionBtn()
					}
				}
			]
		})
	}

	/** stable identity of a cohort row, used to keep the selection across re-renders */
	cohortKey(row: CatalogRow): string {
		return `${row.organism}|${row.assay}|${row.cohort}`
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
				cohorts: selected.map(r => ({ organism: r.organism, assay: r.assay, cohort: r.cohort, label: r.cohort }))
			}
		})
	}
}

export const componentInit = getCompInit(StudyCatalog)

export async function getPlotConfig(opts: any) {
	const config = structuredClone(defaultConfig)
	return copyMerge(config, opts)
}
