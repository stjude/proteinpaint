import { scaleLinear } from 'd3-scale'
import { ColorScale, Menu } from '#dom'
import { NEG_LOG_CAP, type Cell, type Column, type ColumnResult, type Grid, type GridSettings } from './viewModel'

/* The pathway comparison as a bubble heatmap: a dot per gene set (row) and comparison (column), colored by NES and
sized by −log10 q, ringed where q passes the cutoff; columns grouped under their case group.

Keyboard and screen reader (WAI-ARIA grid): the svg is a grid with one tab stop; arrow keys, Home and End move between
cells (roving tabindex), Enter or Space opens the cell's enrichment plot, Escape closes the tooltip. A column subheading
is a button that sorts the rows by that column's NES, with aria-sort on the sorted one; the result is announced in the
status line. The tooltip is the repo's Menu, shown on hover and on focus. */

export type ViewHandlers = {
	onSort: (col: number) => void
	onOpen: (row: number, col: number) => void
}

const CELL_W = 52
const CELL_H = 20
const MAX_R = 8.5
const MIN_R = 1.5
const FONT = 12
/** blue to red through a light neutral, as the portal's other signed scales (wsi.direct.ts) */
const NES_COLORS = ['#2a78d6', '#f0efec', '#d0342c']

export class GseaCompareView {
	holder: any
	status: any
	tip = new Menu({ padding: '6px' })
	focused: [number, number] = [0, 0]

	constructor(holder: any, status: any) {
		this.holder = holder
		this.status = status
	}

	render(grid: Grid, columns: Column[], results: ColumnResult[], s: GridSettings, h: ViewHandlers) {
		this.tip.hide()
		this.holder.selectAll('*').remove()
		const errors = results
			.map((r, i) => (r.status == 'error' ? `${columns[i].caseName}, ${columns[i].dataLabel}: ${r.error}` : ''))
			.filter(Boolean)
		for (const e of errors) this.holder.append('div').attr('class', 'sja_errorbar').style('margin', '4px 0').text(e)
		if (!grid.rows.length) {
			const running = results.some(r => r.status == 'pending')
			this.holder
				.append('div')
				.style('padding', '10px 0')
				.style('opacity', 0.75)
				.text(running ? 'Running the comparisons…' : `No gene set has q < ${s.fdrCutoff} in any comparison.`)
			return
		}

		const labelW =
			textWidth(
				grid.rows.map(r => r.label),
				FONT
			) + 12
		const headH = 64
		const x0 = labelW,
			y0 = headH
		const width = x0 + columns.length * CELL_W + 10
		const height = y0 + grid.rows.length * CELL_H + 8

		const svg = this.holder
			.append('svg')
			.attr('data-testid', 'sjpp-gseaCompare-svg')
			.attr('xmlns', 'http://www.w3.org/2000/svg')
			.attr('width', width)
			.attr('height', height)
			.attr('font-family', 'Arial, sans-serif')
			.attr('font-size', FONT)
			.attr('role', 'grid')
			.attr('aria-label', 'Gene-set enrichment by comparison: rows are gene sets, columns are comparisons')
			.attr('aria-rowcount', grid.rows.length + 1)
			.attr('aria-colcount', columns.length + 1)

		const color = scaleLinear<string>().domain([-grid.maxAbsNes, 0, grid.maxAbsNes]).range(NES_COLORS).clamp(true)
		const radius = scaleLinear()
			.domain([0, Math.max(grid.maxNegLog, 1)])
			.range([MIN_R, MAX_R])
			.clamp(true)

		this.renderHeader(svg, columns, results, s, x0, y0, h)

		const body = svg.append('g').attr('role', 'rowgroup')
		grid.rows.forEach((row, r) => {
			const g = body
				.append('g')
				.attr('role', 'row')
				.attr('aria-rowindex', r + 2)
				.attr('transform', `translate(0,${y0 + r * CELL_H})`)
			// a light band on every other row, for reading across
			if (r % 2 == 0) g.append('rect').attr('x', 0).attr('width', width).attr('height', CELL_H).attr('fill', '#f6f6f6')
			g.append('text')
				.attr('role', 'rowheader')
				.attr('x', labelW - 8)
				.attr('y', CELL_H / 2)
				.attr('dy', '0.35em')
				.attr('text-anchor', 'end')
				.text(row.label)
			row.cells.forEach((cell, c) => {
				const cg = g
					.append('g')
					.attr('role', 'gridcell')
					.attr('aria-colindex', c + 2)
					.attr('data-r', r)
					.attr('data-c', c)
					.attr('tabindex', r == this.focused[0] && c == this.focused[1] ? 0 : -1)
					.attr('aria-label', cellLabel(row.label, columns[c], cell, s.fdrCutoff))
					.attr('transform', `translate(${x0 + c * CELL_W},0)`)
					.style('cursor', cell.nes == null ? 'default' : 'pointer')
					.style('outline', 'none')
				// the hit area and the focus ring
				cg.append('rect')
					.attr('class', 'sjpp-gc-focus')
					.attr('x', 1)
					.attr('y', 1)
					.attr('width', CELL_W - 2)
					.attr('height', CELL_H - 2)
					.attr('rx', 3)
					.attr('fill', 'transparent')
					.attr('stroke', 'none')
				if (results[c]?.status == 'pending') {
					cg.append('text')
						.attr('x', CELL_W / 2)
						.attr('y', CELL_H / 2)
						.attr('dy', '0.35em')
						.attr('text-anchor', 'middle')
						.attr('fill', '#aaa')
						.text('…')
				} else if (cell.nes != null) {
					cg.append('circle')
						.attr('cx', CELL_W / 2)
						.attr('cy', CELL_H / 2)
						.attr('r', radius(cell.negLog))
						.attr('fill', color(cell.nes))
						.attr('stroke', cell.significant ? '#111' : 'none')
						.attr('stroke-width', 1.2)
				}
			})
		})

		this.bindGrid(svg, grid, columns, s, h)
		this.renderLegend(grid, s, color, radius)
		const shown = grid.rows.length < grid.totalRows ? ` (top ${grid.rows.length} of ${grid.totalRows})` : ''
		this.status.text(`${grid.rows.length} gene sets${shown} × ${columns.length} comparisons`)
	}

	/** case groups over their data-type columns; each subheading sorts by its column */
	renderHeader(
		svg,
		columns: Column[],
		results: ColumnResult[],
		s: GridSettings,
		x0: number,
		y0: number,
		h: ViewHandlers
	) {
		const head = svg.append('g').attr('role', 'row').attr('aria-rowindex', 1)
		head
			.append('text')
			.attr('role', 'columnheader')
			.attr('x', x0 - 8)
			.attr('y', y0 - 8)
			.attr('text-anchor', 'end')
			.attr('font-weight', 'bold')
			.text('Gene set')
		// every column is against the same reference: said once, over the row labels
		head
			.append('text')
			.attr('x', x0 - 8)
			.attr('y', 15)
			.attr('text-anchor', 'end')
			.attr('font-style', 'italic')
			.attr('fill', '#555')
			.text(`each vs ${columns[0]?.controlName}`)
		// spans of consecutive columns of one case group
		const spans: { name: string; color?: string; from: number; to: number }[] = []
		columns.forEach((c, i) => {
			const last = spans[spans.length - 1]
			if (last?.name == c.caseName) last.to = i
			else spans.push({ name: c.caseName, color: c.color, from: i, to: i })
		})
		for (const sp of spans) {
			const xa = x0 + sp.from * CELL_W + 3,
				xb = x0 + (sp.to + 1) * CELL_W - 3
			head
				.append('line')
				.attr('x1', xa)
				.attr('x2', xb)
				.attr('y1', 22)
				.attr('y2', 22)
				.attr('stroke', sp.color || '#555')
				.attr('stroke-width', 3)
			head
				.append('text')
				.attr('x', (xa + xb) / 2)
				.attr('y', 15)
				.attr('text-anchor', 'middle')
				.attr('font-weight', 'bold')
				.attr('fill', sp.color || '#333')
				.text(fit(sp.name, xb - xa, FONT))
		}
		columns.forEach((c, i) => {
			const sorted = s.sortCol == i
			const hg = head
				.append('g')
				.attr('role', 'columnheader')
				.attr('aria-colindex', i + 2)
				.attr('transform', `translate(${x0 + i * CELL_W + CELL_W / 2},${y0 - 6})`)
			if (sorted) hg.attr('aria-sort', s.sortDir)
			const btn = hg
				.append('g')
				.attr('role', 'button')
				.attr('tabindex', 0)
				.attr('data-testid', 'sjpp-gseaCompare-sort')
				.attr('aria-label', `${c.caseName}, ${c.dataLabel}${results[i]?.status == 'pending' ? ', running' : ''}`)
				.style('cursor', 'pointer')
				.on('click', () => h.onSort(i))
				.on('keydown', (e: KeyboardEvent) => {
					if (e.key == 'Enter' || e.key == ' ') {
						e.preventDefault()
						h.onSort(i)
					}
				})
			btn
				.append('rect')
				.attr('x', -CELL_W / 2 + 2)
				.attr('y', -30)
				.attr('width', CELL_W - 4)
				.attr('height', 34)
				.attr('fill', 'transparent')
			btn
				.append('text')
				.attr('text-anchor', 'middle')
				.attr('font-size', 10)
				.attr('y', -14)
				.text(c.dataLabel.split(' ')[0])
			if (c.dataLabel.includes(' '))
				btn
					.append('text')
					.attr('text-anchor', 'middle')
					.attr('font-size', 10)
					.attr('y', -3)
					.text(c.dataLabel.split(' ').slice(1).join(' '))
			// the sort direction, visual only: the state is aria-sort
			if (sorted)
				btn
					.append('text')
					.attr('aria-hidden', 'true')
					.attr('text-anchor', 'middle')
					.attr('y', -24)
					.attr('font-size', 9)
					.text(s.sortDir == 'descending' ? '▼' : '▲')
		})
	}

	bindGrid(svg, grid: Grid, columns: Column[], s: GridSettings, h: ViewHandlers) {
		const cellAt = (r: number, c: number) => svg.select(`[data-r="${r}"][data-c="${c}"]`)
		const show = (r: number, c: number) => {
			const node = cellAt(r, c).node()
			const cell = grid.rows[r]?.cells[c]
			if (!node || !cell || cell.nes == null) return this.tip.hide()
			/* a tooltip, positioned under the point without the launcher element: given one, Menu moves focus into its
			content (dom/menu.js setTabNavigation), which would take focus off the point being navigated with the keyboard */
			const box = (node as Element).getBoundingClientRect()
			this.tip.clear().show(box.left, box.bottom + 5, false)
			tooltip(this.tip.d, grid.rows[r].key, grid.rows[r].label, columns[c], cell, s.fdrCutoff)
		}
		const focusCell = (r: number, c: number) => {
			const [pr, pc] = this.focused
			cellAt(pr, pc).attr('tabindex', -1).select('.sjpp-gc-focus').attr('stroke', 'none')
			this.focused = [r, c]
			const sel = cellAt(r, c).attr('tabindex', 0)
			sel.select('.sjpp-gc-focus').attr('stroke', '#1a73e8').attr('stroke-width', 2)
			sel.node()?.focus()
			sel.node()?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
		}
		const pos = (e: Event) => {
			const t = (e.target as Element)?.closest?.('[role=gridcell]')
			return t ? [Number(t.getAttribute('data-r')), Number(t.getAttribute('data-c'))] : null
		}
		svg
			.on('mouseover', (e: MouseEvent) => {
				const p = pos(e)
				if (p) show(p[0], p[1])
			})
			.on('mouseleave', () => this.tip.hide())
			.on('focusin', (e: FocusEvent) => {
				const p = pos(e)
				if (!p) return
				this.focused = p as [number, number]
				cellAt(p[0], p[1]).select('.sjpp-gc-focus').attr('stroke', '#1a73e8').attr('stroke-width', 2)
				show(p[0], p[1])
			})
			.on('focusout', (e: FocusEvent) => {
				const p = pos(e)
				if (p) cellAt(p[0], p[1]).select('.sjpp-gc-focus').attr('stroke', 'none')
			})
			.on('click', (e: MouseEvent) => {
				const p = pos(e)
				if (p && grid.rows[p[0]].cells[p[1]].nes != null) h.onOpen(p[0], p[1])
			})
			.on('keydown', (e: KeyboardEvent) => {
				const p = pos(e)
				if (!p || e.altKey || e.ctrlKey || e.metaKey) return
				const [r, c] = p
				const last = [grid.rows.length - 1, columns.length - 1]
				const to: Record<string, [number, number]> = {
					ArrowUp: [r - 1, c],
					ArrowDown: [r + 1, c],
					ArrowLeft: [r, c - 1],
					ArrowRight: [r, c + 1],
					Home: [r, 0],
					End: [r, last[1]]
				}
				if (e.key == 'Escape') return this.tip.hide()
				if ((e.key == 'Enter' || e.key == ' ') && grid.rows[r].cells[c].nes != null) {
					e.preventDefault()
					return h.onOpen(r, c)
				}
				const t = to[e.key]
				// at the edge of the grid the key is left to the page, which scrolls
				if (!t || t[0] < 0 || t[1] < 0 || t[0] > last[0] || t[1] > last[1]) return
				e.preventDefault()
				focusCell(t[0], t[1])
			})
	}

	renderLegend(grid: Grid, s: GridSettings, color: any, radius: any) {
		const lg = this.holder
			.append('div')
			.style('display', 'flex')
			.style('gap', '28px')
			.style('flex-wrap', 'wrap')
			.style('align-items', 'flex-start')
			.style('margin-top', '8px')
			.style('font-size', '12px')
		const nes = lg.append('div')
		nes.append('div').text('NES (color)')
		const nesSvg = nes.append('svg').attr('width', 190).attr('height', 42)
		new ColorScale({
			holder: nesSvg,
			domain: color.domain(),
			colors: NES_COLORS,
			barwidth: 160,
			position: '15,5',
			ticks: 5
		})
		const q = lg.append('div')
		q.append('div').text(`−log10 q (size; capped at ${NEG_LOG_CAP})`)
		// reference dots at 1, half and all of the range, drawn with the grid's own scale
		const qSvg = q
			.append('svg')
			.attr('width', 160)
			.attr('height', 2 * MAX_R + 20)
		const marks = [1, grid.maxNegLog / 2, grid.maxNegLog].filter((v, i, a) => i == 0 || v > a[i - 1] + 0.05)
		marks.forEach((v, i) => {
			const cx = 14 + i * 48
			qSvg
				.append('circle')
				.attr('cx', cx)
				.attr('cy', MAX_R + 2)
				.attr('r', radius(v))
				.attr('fill', '#bbb')
			qSvg
				.append('text')
				.attr('x', cx)
				.attr('y', 2 * MAX_R + 16)
				.attr('text-anchor', 'middle')
				.attr('font-size', 10)
				.text(v.toFixed(1))
		})
		const ring = lg
			.append('div')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('gap', '6px')
			.style('margin-top', '14px')
		const rs = ring.append('svg').attr('width', 20).attr('height', 20)
		rs.append('circle')
			.attr('cx', 10)
			.attr('cy', 10)
			.attr('r', 7)
			.attr('fill', '#ddd')
			.attr('stroke', '#111')
			.attr('stroke-width', 1.2)
		ring.append('span').text(`q < ${s.fdrCutoff}`)
	}
}

function cellLabel(set: string, col: Column, cell: Cell, cutoff: number) {
	const head = `${set}, ${col.caseName} vs ${col.controlName}, ${col.dataLabel}`
	if (cell.nes == null) return `${head}: no result`
	return `${head}: NES ${fmt(cell.nes)}, q ${fmtQ(cell.fdr)}${cell.significant ? `, below ${cutoff}` : ''}`
}

function tooltip(d, key: string, label: string, col: Column, cell: Cell, cutoff: number) {
	d.append('div').style('font-weight', 'bold').text(label)
	d.append('div').style('font-size', '.8em').style('opacity', 0.7).text(key)
	d.append('div').style('margin-top', '4px').text(`${col.caseName} vs ${col.controlName}, ${col.dataLabel}`)
	const t = d.append('table').style('font-size', '.9em').style('margin-top', '4px')
	const row = (k: string, v: string) => {
		const tr = t.append('tr')
		tr.append('td').style('opacity', 0.7).text(k)
		tr.append('td').text(v)
	}
	row('NES', fmt(cell.nes))
	row('q', `${fmtQ(cell.fdr)}${cell.significant ? ` (< ${cutoff})` : ''}`)
	if (cell.size) row('Genes in set', String(cell.size))
	if (cell.leadingEdge.length) {
		const n = 12
		const more = cell.leadingEdge.length > n ? ` +${cell.leadingEdge.length - n} more` : ''
		row('Leading edge', cell.leadingEdge.slice(0, n).join(', ') + more)
	}
	d.append('div')
		.style('margin-top', '4px')
		.style('font-size', '.8em')
		.style('opacity', 0.7)
		.text('Click or press Enter for the enrichment plot')
}

/** a group name cut to the px it has, with an ellipsis; the full name is in every cell's label and tooltip */
function fit(name: string, px: number, size: number) {
	if (textWidth([name], size) <= px) return name
	let s = name
	while (s.length > 1 && textWidth([s + '…'], size) > px) s = s.slice(0, -1)
	return s + '…'
}

const fmt = (v: number | null) => (v == null ? '–' : v.toFixed(2))
const fmtQ = (v: number | null) => (v == null ? '–' : v < 0.001 ? v.toExponential(1) : v.toFixed(3))

/** the widest of these strings in px at the font size, measured in a hidden svg */
function textWidth(labels: string[], size: number) {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
	svg.style.position = 'absolute'
	svg.style.visibility = 'hidden'
	document.body.appendChild(svg)
	const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
	t.setAttribute('font-size', String(size))
	t.setAttribute('font-family', 'Arial, sans-serif')
	svg.appendChild(t)
	let w = 0
	for (const l of labels) {
		t.textContent = l
		w = Math.max(w, t.getComputedTextLength())
	}
	svg.remove()
	return Math.ceil(w)
}
