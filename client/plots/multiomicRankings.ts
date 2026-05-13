import { renderTable, sayerror, icons } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { getCompInit, copyMerge } from '#rx'
import { roundValueAuto } from '#shared/roundValue.js'
import { PlotBase } from '#plots/PlotBase.js'

const Integrative_rank_COLUMN = 'Integrative rank'

class MultiomicRankings extends PlotBase {
	static type = 'multiomicRankings'

	loadingDiv: any
	errDiv: any
	tableDiv: any
	type: string
	state: any
	config: any
	dataKey?: string
	cachedData?: { columns: string[]; rows: (string | number | null)[][] }
	sortIdx: number = -1
	sortAsc: boolean = true
	pageSize: number = 10
	currentPage: number = 1
	searchQuery: string = ''
	toolbarDiv: any
	noteDiv: any
	searchInput: any

	constructor(opts) {
		super(opts)
		this.type = MultiomicRankings.type
		const main = opts.holder.append('div').style('padding', '12px').style('max-width', '95vw')
		this.errDiv = main.append('div').style('color', 'red').style('display', 'none').style('padding', '8px')
		this.loadingDiv = main.append('div').style('padding', '8px').text('Loading...')
		this.toolbarDiv = main
			.append('div')
			.style('display', 'none')
			.style('align-items', 'center')
			.style('justify-content', 'space-between')
			.style('flex-wrap', 'wrap')
			.style('gap', '8px')
			.style('margin-bottom', '6px')
		const leftBar = this.toolbarDiv
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '6px')
		const dlBtn = leftBar
			.append('button')
			.style('display', 'inline-flex')
			.style('align-items', 'center')
			.style('gap', '6px')
			.style('padding', '4px 10px')
			.style('cursor', 'pointer')
			.on('click', () => this.downloadAll())
		icons['download'](dlBtn.append('span').style('display', 'inline-flex').style('align-items', 'center'), {
			width: 14,
			height: 14,
			title: 'Download data as TSV'
		})
		dlBtn.append('span').text('Download data')
		const rightBar = this.toolbarDiv.append('div')
		rightBar.append('span').text('Search: ').style('margin-right', '4px')
		this.searchInput = rightBar
			.append('input')
			.attr('type', 'search')
			.attr('placeholder', 'gene name')
			.style('padding', '3px 6px')
			.on('input', (event: any) => {
				this.searchQuery = (event.target.value || '').trim().toLowerCase()
				this.currentPage = 1
				this.renderTable()
			})
		this.noteDiv = main
			.append('div')
			.style('display', 'none')
			.style('font-size', '0.85em')
			.style('color', '#555')
			.style('margin-bottom', '10px')
			.style('line-height', '1.4')
			.style('white-space', 'normal')
			.style('word-break', 'normal')
			.style('overflow-wrap', 'break-word')
			.text(
				'We ranked individual genes/proteins using order statistics to integrate multiple omics datasets, including GWAS, transcriptome, various proteomes, and the interactome. The proteomic datasets include the whole proteome, insoluble proteins, phosphoproteome, and ubiquitinome, if available. Genes/proteins in each dataset are ranked based on p/FDR values or log2FC-z scores, and finally sorted by the combined order statistic Q scores.'
			)
		this.tableDiv = main.append('div').attr('data-testid', 'sjpp-multiomicRankings-table')
		this.dom = {
			holder: main,
			header: opts.header,
			errDiv: this.errDiv,
			loadingDiv: this.loadingDiv,
			toolbarDiv: this.toolbarDiv,
			noteDiv: this.noteDiv,
			tableDiv: this.tableDiv
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config, vocab: appState.vocab }
	}

	reactsTo(action) {
		if (action.type.startsWith('plot_')) return action.id === this.id
	}

	async main() {
		this.config = structuredClone(this.state.config)
		const key = this.config.rankingKey
		if (!key) {
			this.loadingDiv.style('display', 'none')
			this.errDiv.style('display', 'block').text('No ranking key selected')
			return
		}
		if (this.dom.header)
			this.dom.header.html(`${key} <span style="font-size:.8em;opacity:.7">MULTIOMIC RANKINGS</span>`)

		if (this.dataKey !== key) {
			this.loadingDiv.style('display', 'block')
			this.tableDiv.selectAll('*').remove()
			try {
				const resp = await dofetch3('termdb/multiomicRankings', {
					body: {
						genome: this.state.vocab.genome,
						dslabel: this.state.vocab.dslabel,
						key
					}
				})
				if (resp.error) throw resp.error
				this.cachedData = { columns: resp.columns, rows: resp.rows }
				this.dataKey = key
				// default sort: Integrative rank ascending
				const integrativeRankIdx = resp.columns.indexOf(Integrative_rank_COLUMN)
				this.sortIdx = integrativeRankIdx >= 0 ? integrativeRankIdx : -1
				this.sortAsc = true
				this.currentPage = 1
				this.searchQuery = ''
				if (this.searchInput) this.searchInput.node().value = ''
			} catch (e: any) {
				this.loadingDiv.style('display', 'none')
				sayerror(this.errDiv.style('display', 'block'), e.message || e)
				return
			}
			this.loadingDiv.style('display', 'none')
		}
		this.toolbarDiv.style('display', 'flex')
		this.noteDiv.style('display', 'block')
		this.renderTable()
	}

	downloadAll() {
		if (!this.cachedData) return
		const { columns, rows } = this.cachedData
		const filtered = this.searchQuery
			? rows.filter(r => {
					const gene = r[0]
					return typeof gene === 'string' && gene.toLowerCase().includes(this.searchQuery)
			  })
			: rows
		const sorted = this.sortIdx >= 0 ? sortRows(filtered, this.sortIdx, this.sortAsc) : filtered
		const lines = [columns.join('\t')]
		for (const row of sorted) {
			lines.push(row.map(v => (v == null ? 'NA' : String(v))).join('\t'))
		}
		const blob = new Blob([lines.join('\n')], { type: 'text/tab-separated-values' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		const slug = (this.dataKey || 'multiomicRankings').replace(/[^A-Za-z0-9_-]+/g, '_')
		a.href = url
		a.download = `${slug}.tsv`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)
	}

	renderTable() {
		if (!this.cachedData) return
		const { columns, rows } = this.cachedData

		const filtered = this.searchQuery
			? rows.filter(r => {
					const gene = r[0]
					return typeof gene === 'string' && gene.toLowerCase().includes(this.searchQuery)
			  })
			: rows

		const sortedRows = this.sortIdx >= 0 ? sortRows(filtered, this.sortIdx, this.sortAsc) : filtered

		const cols = columns.map((label, i) => ({
			label,
			sortable: true,
			align: i === 0 ? 'left' : 'right',
			nowrap: i === 0
		}))

		const tableRows = sortedRows.map(row =>
			row.map(v => {
				if (v === null || v === undefined) return { value: '' }
				if (typeof v === 'number') return { value: roundValueAuto(v) }
				return { value: v }
			})
		)

		// onSort hook: when caller-controlled sort is needed across pages, we
		// rebind by re-rendering the table with our own sort state. Use header
		// click overlay since renderTable's built-in sort only orders the
		// current `rows` reference passed in (which is fine here because we
		// pre-sort the full dataset before passing it in).
		this.tableDiv.selectAll('*').remove()

		// Custom sort headers: we wrap renderTable but disable its built-in
		// sort buttons, intercepting header clicks ourselves to keep sort
		// applied across all pages.
		renderTable({
			columns: cols,
			rows: tableRows,
			div: this.tableDiv,
			showLines: true,
			striped: true,
			showHeader: true,
			header: { allowSort: false },
			maxWidth: '95vw',
			maxHeight: '70vh',
			pagination: {
				pageSize: this.pageSize,
				pageSizeOptions: [10, 25, 50, 100],
				currentPage: this.currentPage,
				onChange: ({ currentPage, pageSize }) => {
					this.currentPage = currentPage
					this.pageSize = pageSize
				}
			}
		})

		// Make the column headers clickable to sort across the full dataset
		const ths = this.tableDiv.selectAll('thead th')
		ths.each((_d, i, nodes) => {
			const th = nodes[i] as HTMLElement
			th.style.cursor = 'pointer'
			th.style.userSelect = 'none'
			th.style.whiteSpace = 'nowrap'
			th.style.color = '#000'
			const colIdx = i
			const label = columns[colIdx]
			if (!label) return
			const active = this.sortIdx === colIdx
			const upColor = active && this.sortAsc ? '#000' : '#ccc'
			const downColor = active && !this.sortAsc ? '#000' : '#ccc'
			th.innerHTML =
				`<span>${escapeHtml(label)}</span>` +
				`<span style="display:inline-flex;flex-direction:column;line-height:0.6em;margin-left:4px;vertical-align:middle;font-size:0.7em;">` +
				`<span style="color:${upColor}">\u25B2</span>` +
				`<span style="color:${downColor}">\u25BC</span>` +
				`</span>`
			th.onclick = () => {
				if (this.sortIdx === colIdx) this.sortAsc = !this.sortAsc
				else {
					this.sortIdx = colIdx
					this.sortAsc = true
				}
				this.currentPage = 1
				this.renderTable()
			}
		})

		// match toolbar + note width to the rendered table width
		requestAnimationFrame(() => {
			// the inline-block wrapper that renderTable creates around the <table>
			const wrapper = this.tableDiv.select(':scope > div').node() as HTMLElement | null
			const measured = wrapper || (this.tableDiv.select('table').node() as HTMLElement | null)
			if (!measured) return
			const w = measured.getBoundingClientRect().width
			if (w > 0) {
				const px = `${Math.ceil(w)}px`
				this.toolbarDiv.style('width', px).style('box-sizing', 'border-box')
				this.noteDiv.style('width', px).style('box-sizing', 'border-box')
			}
		})
	}
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function sortRows(rows: (string | number | null)[][], idx: number, asc: boolean): (string | number | null)[][] {
	const sign = asc ? 1 : -1
	return rows
		.map((r, i) => ({ r, i }))
		.sort((a, b) => {
			const va = a.r[idx]
			const vb = b.r[idx]
			// nulls always last regardless of direction
			if (va == null && vb == null) return a.i - b.i
			if (va == null) return 1
			if (vb == null) return -1
			if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sign
			return String(va).localeCompare(String(vb)) * sign
		})
		.map(x => x.r)
}

export async function getPlotConfig(opts) {
	const config = {
		chartType: MultiomicRankings.type,
		rankingKey: opts.rankingKey || ''
	}
	return copyMerge(config, opts)
}

export const componentInit = getCompInit(MultiomicRankings)

export function makeChartBtnMenu(holder, chartsInstance) {
	chartsInstance.dom.tip.clear()
	const cfg = chartsInstance.state.termdbConfig?.queries?.multiomicRankings as Record<string, string> | undefined

	const menu = holder.append('div').style('padding', '8px')

	if (!cfg || !Object.keys(cfg).length) {
		menu.append('div').style('color', '#888').text('No multiomic rankings available for this dataset.')
		return
	}

	for (const key of Object.keys(cfg)) {
		menu
			.append('div')
			.attr('class', 'sja_menuoption')
			.style('padding', '6px 12px')
			.style('cursor', 'pointer')
			.text(key)
			.on('click', () => {
				chartsInstance.dom.tip.hide()
				chartsInstance.prepPlot({
					config: {
						chartType: 'multiomicRankings',
						rankingKey: key
					}
				})
			})
	}
}
