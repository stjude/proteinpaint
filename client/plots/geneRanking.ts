import { renderTable, sayerror, icons } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { getCompInit, copyMerge } from '#rx'
import { roundValueAuto } from '#shared/roundValue.js'
import { PlotBase } from '#plots/PlotBase.js'
import { scaleLinear } from 'd3-scale'

const Integrative_rank_COLUMN = 'Integrative rank'

const MISSING_COLOR = '#d9d9d9'
// sequential scale for per-column min-max-scaled rank: low (top rank) = dark, high = light
const SEQ_COLOR_LOW = '#08306b'
const SEQ_COLOR_HIGH = '#f7fbff'

class GeneRanking extends PlotBase {
	static type = 'geneRanking'

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
	heatmapSection: any
	heatmapControls: any
	heatmapDiv: any
	heatmapStatus: any
	heatmapOrder: 'clustered' | 'rank' = 'clustered'
	minAssays: number = 3
	minAssaysSelect: any
	/** identity-tag of the data the current heatmap was rendered for; used to abort stale responses */
	heatmapRenderKey: string = ''

	constructor(opts) {
		super(opts)
		this.type = GeneRanking.type
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
			.style('font-size', '12px')
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
		this.tableDiv = main.append('div').attr('data-testid', 'sjpp-geneRanking-table').style('font-size', '12px')

		this.heatmapSection = main
			.append('div')
			.style('display', 'none')
			.style('margin-top', '24px')
			.attr('data-testid', 'sjpp-geneRanking-heatmap')
		const hmHeader = this.heatmapSection
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '12px')
			.style('margin-bottom', '8px')
		hmHeader.append('div').style('font-weight', 'bold').text('Heatmap of the current page')
		this.heatmapControls = hmHeader
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '6px')
		this.heatmapControls.append('span').style('font-size', '0.85em').style('color', '#555').text('Row order:')
		const orderSelect = this.heatmapControls
			.append('select')
			.style('padding', '2px 4px')
			.on('change', (event: any) => {
				this.heatmapOrder = event.target.value
				this.renderHeatmap()
			})
		orderSelect.append('option').attr('value', 'clustered').text('Clustered').property('selected', true)
		orderSelect.append('option').attr('value', 'rank').text('Ranking score')
		// min-assays selector wrapper, hidden when order is "rank"
		const minAssaysWrap = this.heatmapControls
			.append('span')
			.attr('class', 'sjpp-mr-min-assays-wrap')
			.style('display', 'inline-flex')
			.style('align-items', 'center')
			.style('gap', '6px')
		minAssaysWrap.append('span').style('font-size', '0.85em').style('color', '#555').text('Min assays:')
		this.minAssaysSelect = minAssaysWrap
			.append('select')
			.style('padding', '2px 4px')
			.on('change', (event: any) => {
				this.minAssays = Number(event.target.value)
				this.renderHeatmap()
			})
		// options are populated dynamically in renderHeatmap based on available modalities
		this.heatmapStatus = this.heatmapSection
			.append('div')
			.style('font-size', '0.85em')
			.style('color', '#777')
			.style('margin-bottom', '6px')
		this.heatmapDiv = this.heatmapSection.append('div').style('overflow-x', 'auto')

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
		return { config, vocab: appState.vocab, termdbConfig: appState.termdbConfig }
	}

	reactsTo(action) {
		if (action.type.startsWith('plot_')) return action.id === this.id
		return false
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
				const resp = await dofetch3('termdb/geneRanking', {
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
		const desc = this.state.termdbConfig?.queries?.geneRanking?.description
		this.noteDiv.style('display', desc ? 'block' : 'none').text(desc || '')
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
		const slug = (this.dataKey || 'geneRanking').replace(/[^A-Za-z0-9_-]+/g, '_')
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
					this.renderHeatmap()
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
			th.style.fontWeight = 'bold'
			th.style.opacity = '1'
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
		this.renderHeatmap()
	}

	/** rows displayed on the current page after filter + sort + pagination */
	private getVisibleRows(): (string | number | null)[][] {
		if (!this.cachedData) return []
		const { rows } = this.cachedData
		const filtered = this.searchQuery
			? rows.filter(r => {
					const gene = r[0]
					return typeof gene === 'string' && gene.toLowerCase().includes(this.searchQuery)
			  })
			: rows
		const sorted = this.sortIdx >= 0 ? sortRows(filtered, this.sortIdx, this.sortAsc) : filtered
		const start = (this.currentPage - 1) * this.pageSize
		return sorted.slice(start, start + this.pageSize)
	}

	async renderHeatmap() {
		if (!this.cachedData) {
			this.heatmapSection.style('display', 'none')
			return
		}
		const { columns } = this.cachedData

		// modality columns available in this dataset, intersected with biological order
		const colNameToIdx = new Map(columns.map((c, i) => [c, i]))
		const modalities: string[] = this.state.termdbConfig?.queries?.geneRanking?.modalities || []
		const usedCols = modalities.filter(m => colNameToIdx.has(m))
		if (usedCols.length < 2) {
			this.heatmapSection.style('display', 'none')
			return
		}
		this.heatmapSection.style('display', 'block')

		// (re)populate min-assays options based on the available modality count
		if (this.minAssays > usedCols.length) this.minAssays = usedCols.length
		if (this.minAssays < 2) this.minAssays = 2
		const optionVals = this.minAssaysSelect
			.selectAll('option')
			.nodes()
			.map((o: HTMLOptionElement) => Number(o.value))
		const want = Array.from({ length: usedCols.length - 1 }, (_, i) => i + 2)
		if (optionVals.length !== want.length || optionVals.some((v, i) => v !== want[i])) {
			this.minAssaysSelect.selectAll('option').remove()
			for (const n of want) {
				this.minAssaysSelect
					.append('option')
					.attr('value', n)
					.text(String(n))
					.property('selected', n === this.minAssays)
			}
		}

		const visible = this.getVisibleRows()
		const geneNames = visible.map(r => String(r[0]))
		const matrix: (number | null)[][] = visible.map(r =>
			usedCols.map(c => {
				const v = r[colNameToIdx.get(c)!]
				return typeof v === 'number' && Number.isFinite(v) ? v : null
			})
		)

		// per-column stats over the FULL dataset — the file values are already ranks,
		// so use them as-is and normalize for color by each column's full-data min/max.
		const fullStats = computeColStats(
			this.cachedData.rows,
			usedCols.map(c => colNameToIdx.get(c)!)
		)
		const toPct = (val: number | null, c: number): number | null => {
			if (val === null || !Number.isFinite(val as number)) return null
			const lo = fullStats.min[c]
			const hi = fullStats.max[c]
			if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) return 0
			return ((val as number) - lo) / (hi - lo)
		}
		const buildPct = (raw: (number | null)[][]) => raw.map(row => row.map((v, c) => toPct(v, c)))

		// fingerprint of the data so a late-arriving response from a previous
		// render doesn't overwrite the current one
		const renderKey = `${this.dataKey}|${this.heatmapOrder}|${this.minAssays}|${this.currentPage}|${this.pageSize}|${
			this.searchQuery
		}|${this.sortIdx}|${this.sortAsc}|${geneNames.join(',')}`
		this.heatmapRenderKey = renderKey
		this.heatmapDiv.selectAll('*').remove()
		this.heatmapStatus.text('Computing heatmap…')

		// show/hide min-assays selector based on order mode
		this.heatmapControls
			.select('.sjpp-mr-min-assays-wrap')
			.style('display', this.heatmapOrder === 'clustered' ? 'inline-flex' : 'none')

		// ranking-score order: keep all rows on the page, no clustering
		if (this.heatmapOrder === 'rank') {
			if (geneNames.length < 1) {
				this.heatmapStatus.text('No rows to display.')
				return
			}
			this.heatmapStatus.text(
				`${geneNames.length} rows in current page order. Missing values shown in gray; cells colored by rank within the full dataset per column (lower = better).`
			)
			this.drawHeatmap({
				rowNames: geneNames,
				colNames: usedCols,
				matrix: buildPct(matrix),
				rankMatrix: matrix,
				totals: fullStats.n,
				dendrogram: null
			})
			return
		}

		try {
			const resp = await dofetch3('termdb/geneRanking', {
				body: {
					for: 'cluster',
					matrix,
					row_names: geneNames,
					col_names: usedCols,
					minAssays: this.minAssays
				}
			})
			if (renderKey !== this.heatmapRenderKey) return // stale
			if (resp.error) throw resp.error
			const keptCount = resp.usedRowNames?.length ?? 0
			this.heatmapStatus.text(
				`${keptCount} of ${visible.length} rows shown (proteins with ≥${this.minAssays} assays). Missing values shown in gray; cells colored by rank within the full dataset per column (lower = better).`
			)
			const nameToIdx = new Map(geneNames.map((n, i) => [n, i]))
			const keptRawMatrix = (resp.usedRowNames as string[]).map(n => matrix[nameToIdx.get(n)!])
			const keptNameToIdx = new Map((resp.usedRowNames as string[]).map((n, i) => [n, i]))
			const orderedRowNames = resp.row.order.map((o: { name: string }) => o.name)
			const orderedRank = orderedRowNames.map((name: string) => keptRawMatrix[keptNameToIdx.get(name)!])
			const orderedPct = buildPct(orderedRank)
			this.drawHeatmap({
				rowNames: orderedRowNames,
				colNames: resp.usedColNames,
				matrix: orderedPct,
				rankMatrix: orderedRank,
				totals: fullStats.n,
				dendrogram: resp.row
			})
		} catch (e: any) {
			if (renderKey !== this.heatmapRenderKey) return
			this.heatmapStatus.text(`Heatmap error: ${e?.message || e}`)
		}
	}

	private drawHeatmap(opts: {
		rowNames: string[]
		colNames: string[]
		matrix: (number | null)[][]
		rankMatrix: (number | null)[][]
		totals: number[]
		dendrogram: null | {
			merge: { n1: number; n2: number }[]
			height: { height: number }[]
			order: { name: string }[]
			inputOrder: string[]
		}
	}) {
		const { rowNames, colNames, matrix, rankMatrix, totals, dendrogram } = opts
		const cellW = 44
		const cellH = 22
		const dendroW = dendrogram ? 110 : 0
		const dendroPad = dendrogram ? 8 : 0
		const colLabelH = 110
		const rowLabelW = 130
		const legendBlockW = 110 // space reserved to the right of row labels for the vertical legend
		const gridW = colNames.length * cellW
		const gridH = rowNames.length * cellH
		// legend dims (must match values used below when drawing)
		const legendGradH = Math.max(120, Math.min(gridH, 240))
		const missingSwatchExtra = 18 + 12 // gap + swatch height
		const totalW = dendroW + dendroPad + gridW + 8 + rowLabelW + legendBlockW
		const totalH = colLabelH + Math.max(gridH, legendGradH + missingSwatchExtra) + 16

		this.heatmapDiv.selectAll('*').remove()
		const svg = this.heatmapDiv
			.append('svg')
			.attr('width', totalW)
			.attr('height', totalH)
			.attr('font-family', 'sans-serif')

		// sequential color scale on min-max-scaled rank in [0,1]: low (best rank) = dark, high = light
		const seq = scaleLinear<string>().domain([0, 1]).range([SEQ_COLOR_LOW, SEQ_COLOR_HIGH]).clamp(true)
		const color = (v: number) => seq(v)

		// row dendrogram (left)
		if (dendrogram) {
			const g = svg.append('g').attr('transform', `translate(0,${colLabelH})`)
			drawRowDendrogram(g, dendrogram, dendroW, gridH, cellH)
		}

		// column labels (rotated)
		const gridX = dendroW + dendroPad
		const labelsG = svg.append('g').attr('transform', `translate(${gridX},${colLabelH - 4})`)
		labelsG
			.selectAll('text')
			.data(colNames)
			.enter()
			.append('text')
			.attr('x', (_d, i) => i * cellW + cellW / 2)
			.attr('y', 0)
			.attr('transform', (_d, i) => `rotate(-45,${i * cellW + cellW / 2},0)`)
			.attr('text-anchor', 'start')
			.attr('font-size', '13px')
			.attr('fill', '#000')
			.text(d => d)

		// cells
		const cellsG = svg.append('g').attr('transform', `translate(${gridX},${colLabelH})`)
		const cellData: { x: number; y: number; v: number | null; row: number; col: number }[] = []
		for (let r = 0; r < matrix.length; r++) {
			for (let c = 0; c < matrix[r].length; c++) {
				cellData.push({ x: c * cellW, y: r * cellH, v: matrix[r][c], row: r, col: c })
			}
		}
		cellsG
			.selectAll('rect')
			.data(cellData)
			.enter()
			.append('rect')
			.attr('x', d => d.x)
			.attr('y', d => d.y)
			.attr('width', cellW)
			.attr('height', cellH)
			.attr('fill', d => (d.v === null || !Number.isFinite(d.v) ? MISSING_COLOR : color(d.v as number)))
			.attr('stroke', '#fff')
			.attr('stroke-width', 0.5)
			.append('title')
			.text(d => {
				if (d.v === null || !Number.isFinite(d.v)) return `${rowNames[d.row]} — ${colNames[d.col]}\nmissing`
				const r = rankMatrix[d.row][d.col] as number
				const n = totals[d.col]
				const rStr = Number.isInteger(r) ? String(r) : r.toFixed(1)
				return `${rowNames[d.row]} — ${colNames[d.col]}\nrank: ${rStr} of ${n}\nscaled rank: ${(d.v as number).toFixed(
					3
				)}`
			})

		// rank number overlay on each non-null cell
		cellsG
			.selectAll('text.sjpp-mr-rank')
			.data(cellData.filter(d => d.v !== null && Number.isFinite(d.v)))
			.enter()
			.append('text')
			.attr('class', 'sjpp-mr-rank')
			.attr('x', d => d.x + cellW / 2)
			.attr('y', d => d.y + cellH / 2 + 3)
			.attr('text-anchor', 'middle')
			.attr('font-size', '9px')
			.attr('font-weight', 300)
			.attr('pointer-events', 'none')
			.attr('fill', d => ((d.v as number) < 0.5 ? 'rgba(255,255,255,0.85)' : 'rgba(40,40,40,0.7)'))
			.text(d => {
				const r = rankMatrix[d.row][d.col] as number
				return Number.isInteger(r) ? String(r) : r.toFixed(1)
			})

		// row labels (gene names) on the right
		const rowLabelsG = svg.append('g').attr('transform', `translate(${gridX + gridW + 6},${colLabelH})`)
		rowLabelsG
			.selectAll('text')
			.data(rowNames)
			.enter()
			.append('text')
			.attr('x', 0)
			.attr('y', (_d, i) => i * cellH + cellH / 2 + 4)
			.attr('font-size', '13px')
			.attr('fill', '#000')
			.text(d => d)

		// vertical color legend (placed to the right of the row labels)
		const legendGradW = 16
		const legendX = gridX + gridW + 8 + rowLabelW + 8
		const legendY = colLabelH
		const legendG = svg.append('g').attr('transform', `translate(${legendX},${legendY})`)
		// title rotated alongside the gradient
		legendG
			.append('text')
			.attr('transform', `translate(-6,${legendGradH / 2}) rotate(-90)`)
			.attr('text-anchor', 'middle')
			.attr('font-size', '11px')
			.attr('fill', '#555')
			.text('scaled rank (per column)')
		const stops = 32
		for (let i = 0; i < stops; i++) {
			// top of legend = 0 (best rank, dark); bottom = 1 (worst rank, light)
			const v = i / (stops - 1)
			legendG
				.append('rect')
				.attr('x', 0)
				.attr('y', (i * legendGradH) / stops)
				.attr('width', legendGradW)
				.attr('height', legendGradH / stops + 0.5)
				.attr('fill', color(v))
		}
		legendG
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
			.attr('width', legendGradW)
			.attr('height', legendGradH)
			.attr('fill', 'none')
			.attr('stroke', '#999')
			.attr('stroke-width', 0.5)
		// tick labels
		legendG
			.append('text')
			.attr('x', legendGradW + 6)
			.attr('y', 4)
			.attr('font-size', '11px')
			.text('0 (top)')
		legendG
			.append('text')
			.attr('x', legendGradW + 6)
			.attr('y', legendGradH / 2 + 4)
			.attr('font-size', '11px')
			.text('0.5')
		legendG
			.append('text')
			.attr('x', legendGradW + 6)
			.attr('y', legendGradH)
			.attr('font-size', '11px')
			.text('1 (bottom)')

		// missing-value swatch below the gradient
		const missingG = svg.append('g').attr('transform', `translate(${legendX},${legendY + legendGradH + 18})`)
		missingG
			.append('rect')
			.attr('width', legendGradW)
			.attr('height', 12)
			.attr('fill', MISSING_COLOR)
			.attr('stroke', '#999')
			.attr('stroke-width', 0.5)
		missingG
			.append('text')
			.attr('x', legendGradW + 6)
			.attr('y', 10)
			.attr('font-size', '11px')
			.attr('fill', '#555')
			.text('missing')
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

function computeColStats(
	allRows: (string | number | null)[][],
	colIdxs: number[]
): { min: number[]; max: number[]; n: number[] } {
	const min: number[] = colIdxs.map(() => Infinity)
	const max: number[] = colIdxs.map(() => -Infinity)
	const n: number[] = colIdxs.map(() => 0)
	for (const row of allRows) {
		for (let i = 0; i < colIdxs.length; i++) {
			const v = row[colIdxs[i]]
			if (typeof v === 'number' && Number.isFinite(v)) {
				if (v < min[i]) min[i] = v
				if (v > max[i]) max[i] = v
				n[i]++
			}
		}
	}
	return { min, max, n }
}

/**
 * Render a row dendrogram from hclust output into the given <g>.
 * Adapted from matrix/hierCluster.renderers.js plotDendrogramHclust:
 * we walk the merge tree, recording each cluster's (x, y) where y is the
 * vertical center of its leaf range and x is its merge height. Branches
 * extend leftward from the heatmap edge so the deepest merges sit at x=0.
 */
function drawRowDendrogram(
	g: any,
	dend: {
		merge: { n1: number; n2: number }[]
		height: { height: number }[]
		order: { name: string }[]
		inputOrder: string[]
	},
	width: number,
	gridH: number,
	cellH: number
) {
	const heights = dend.height.map(h => h.height)
	const maxH = Math.max(...heights, 1e-9)
	const hToX = scaleLinear().domain([0, maxH]).range([width, 0])

	// position of each leaf in the dendrogram (y in pixels, leaf order from .order)
	const leafYByName = new Map<string, number>()
	dend.order.forEach((leaf, i) => {
		leafYByName.set(leaf.name, i * cellH + cellH / 2)
	})

	// for each merged cluster, record {x, y}
	const merged = new Map<number, { x: number; y: number }>()
	for (let i = 0; i < dend.merge.length; i++) {
		const { n1, n2 } = dend.merge[i]
		const pos = (n: number): { x: number; y: number } => {
			if (n < 0) {
				// leaf: index in inputOrder is -n-1
				const name = dend.inputOrder[-n - 1]
				return { x: width, y: leafYByName.get(name) ?? 0 }
			}
			return merged.get(n) || { x: width, y: 0 }
		}
		const a = pos(n1)
		const b = pos(n2)
		const x = hToX(heights[i])
		const y = (a.y + b.y) / 2

		// horizontal segment from each child to the merge x, then a vertical between them
		g.append('line')
			.attr('x1', a.x)
			.attr('x2', x)
			.attr('y1', a.y)
			.attr('y2', a.y)
			.attr('stroke', '#000')
			.attr('stroke-width', 1)
		g.append('line')
			.attr('x1', b.x)
			.attr('x2', x)
			.attr('y1', b.y)
			.attr('y2', b.y)
			.attr('stroke', '#000')
			.attr('stroke-width', 1)
		g.append('line')
			.attr('x1', x)
			.attr('x2', x)
			.attr('y1', a.y)
			.attr('y2', b.y)
			.attr('stroke', '#000')
			.attr('stroke-width', 1)

		merged.set(i + 1, { x, y })
	}
}

export async function getPlotConfig(opts) {
	const config = {
		chartType: GeneRanking.type,
		rankingKey: opts.rankingKey || ''
	}
	return copyMerge(config, opts)
}

export const componentInit = getCompInit(GeneRanking)

export function makeChartBtnMenu(holder, chartsInstance) {
	chartsInstance.dom.tip.clear()
	const cfg = chartsInstance.state.termdbConfig?.queries?.geneRanking as
		| { rankings?: Record<string, string> }
		| undefined
	const rankings = cfg?.rankings

	if (!rankings || !Object.keys(rankings).length) {
		holder
			.append('div')
			.style('padding', '8px')
			.style('color', '#888')
			.text('No multiomic rankings available for this dataset.')
		return
	}

	for (const key of Object.keys(rankings)) {
		holder
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text(key)
			.on('click', () => {
				chartsInstance.dom.tip.hide()
				chartsInstance.prepPlot({
					config: {
						chartType: 'geneRanking',
						rankingKey: key
					}
				})
			})
	}
}
