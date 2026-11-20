import { scaleLinear } from 'd3-scale'
import { ColorScale, Menu } from '#dom'
import { table2col } from '#dom/table2col'
import { DataPointInteractions } from '#dom/dataPointInteractions'
import { drawHoverShapes } from '#dom/hoverShapes'
import { openActionMenu, type ActionMenuItem } from '#dom/dataPointClickMenu'
import { HYPER_COLOR, HYPO_COLOR } from '#shared/dmrColors.js'
import type { ActivePathwaysResponse } from '#types'
import { formatSetName } from '../gseaCompare/viewModel'

/* ActivePathways as a heatmap: a row per gene set significant in some column, columns expression, gene body and the
two merged (server/src/routes/termdb.activePathways.ts), a cell colored by −log10 q signed by whether the set's picked
genes went up or gained methylation (orange, as hyper on the volcano) or down or lost it (blue), a dot where q < 0.05.

The pointer works as on the starburst and the volcano (DataPointInteractions): the plain cursor, an outline on the
cell under it, the shared tooltip, and a click opens the set's options. The keyboard: the heatmap is one tab stop;
arrow keys move between cells with the same outline and tooltip, Enter or Space opens the options, Escape closes. */

export type PathwayCell = { r: number; c: number; x: number; y: number }

export const LAYERS = ['Expression', 'Gene body', 'Both merged']
const CW = 46,
	CH = 16,
	CAP = 8,
	Q = 0.05,
	FONT = 11

export function drawPathwayHeatmap(
	holder: any,
	ap: ActivePathwaysResponse,
	opts: { groups: [string, string]; tip: Menu; getActions: (setId: string) => ActionMenuItem[]; maxRows?: number }
) {
	const sets = pathwayRows(ap, opts.maxRows ?? 40)
	const labels = sets.map(s => formatSetName(s.id))
	const labelW = Math.max(80, ...labels.map(l => l.length * 6.2)) + 10
	const m = { top: 40, left: labelW, right: 10, bottom: 10 }
	const W = LAYERS.length * CW,
		H = sets.length * CH
	const color = heatColor()

	const svg = holder
		.append('svg')
		.attr('data-testid', 'sjpp-methylationStarburst-pathways')
		.attr('width', m.left + W + m.right)
		.attr('height', m.top + H + m.bottom)
		.attr('font-family', 'Arial, sans-serif')
		.attr('font-size', FONT)
		.attr('role', 'group')
		.attr('tabindex', 0)
		.attr(
			'aria-label',
			`ActivePathways heatmap, ${sets.length} gene sets by ${LAYERS.join(', ')}. Arrow keys move between cells, ` +
				"Enter opens a set's options."
		)
		.style('outline-offset', '2px')
	const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)
	LAYERS.forEach((label, c) => {
		const words = label.split(' ')
		const t = g
			.append('text')
			.attr('x', c * CW + CW / 2)
			.attr('y', words.length > 1 ? -20 : -8)
			.attr('text-anchor', 'middle')
			.attr('font-size', 10)
		words.forEach((w, k) =>
			t
				.append('tspan')
				.attr('x', c * CW + CW / 2)
				.attr('dy', k ? 12 : 0)
				.text(w)
		)
	})
	sets.forEach((s, r) => {
		g.append('text')
			.attr('x', -8)
			.attr('y', r * CH + CH / 2)
			.attr('dy', '0.35em')
			.attr('text-anchor', 'end')
			.text(labels[r])
		s.layers.forEach((l, c) => {
			g.append('rect')
				.attr('x', c * CW)
				.attr('y', r * CH)
				.attr('width', CW - 1)
				.attr('height', CH - 1)
				.attr('fill', color(signedLogQ(l)))
			if (l.log10q < Math.log10(Q))
				g.append('circle')
					.attr('cx', c * CW + CW / 2)
					.attr('cy', r * CH + CH / 2)
					.attr('r', 2.2)
					.attr('fill', '#111')
		})
	})

	const hoverLayer = g.append('g').style('pointer-events', 'none')
	const cover = g
		.append('rect')
		.attr('width', W)
		.attr('height', H)
		.attr('fill', 'transparent')
		.style('pointer-events', 'all')
		// the plain pointer, as on the starburst and the volcano
		.style('cursor', 'default')
	const cells: PathwayCell[] = sets.flatMap((_, r) =>
		LAYERS.map((_, c) => ({ r, c, x: c * CW + CW / 2, y: r * CH + CH / 2 }))
	)
	const outline = (d: PathwayCell) => ({
		path: `M${-CW / 2},${-CH / 2}h${CW - 1}v${CH - 1}h${-(CW - 1)}Z`,
		transform: `translate(${d.x},${d.y})`,
		strokeWidth: 1.5
	})
	const info = (d: PathwayCell, holder: any) => {
		const s = sets[d.r],
			l = s.layers[d.c]
		const table = table2col({ holder })
		table.addRow('Gene set', labels[d.r])
		table.addRow('Evidence', LAYERS[d.c])
		table.addRow('q', fmtQ(10 ** l.log10q))
		if (l.direction)
			table.addRow(
				'Picked genes',
				`${l.overlap}, mostly ${l.direction > 0 ? (d.c == 1 ? 'gained' : 'up') : d.c == 1 ? 'lost' : 'down'} in ${
					opts.groups[1]
				}`
			)
		table.addRow('Genes in set', `${s.size} with both layers`)
		if (d.c == 2 && s.genes.length) table.addRow('Top genes', s.genes.slice(0, 12).join(', '))
	}
	const dpi = new DataPointInteractions<PathwayCell>({
		cover,
		hoverLayer,
		hoverTip: opts.tip,
		points: cells,
		getX: d => d.x,
		getY: d => d.y,
		// a cell's corners are this far from its center
		hitRadius: Math.hypot(CW, CH) / 2,
		// one cell at a time: the nearest, which is the one under the pointer
		getCluster: seed => [seed],
		toHoverSpec: outline,
		itemNoun: 'gene set',
		renderSingleHoverTooltip: (d, holder) => {
			info(d, holder)
			holder
				.append('div')
				.style('font-size', '0.8em')
				.style('opacity', 0.7)
				.style('padding', '2px 4px')
				.text('Click for options')
		},
		buildMultiHitTableData: ds => ({
			columns: [{ label: 'Gene set' }, { label: 'Evidence' }],
			rows: ds.map(d => [{ value: labels[d.r] }, { value: LAYERS[d.c] }])
		}),
		getActions: d => opts.getActions(sets[d.r].id),
		renderSingleHitInfo: info,
		getRowKey: d => `${d.r}\t${d.c}`
	})
	dpi.attach()

	// the keyboard, with the pointer's outline and tooltip
	const keyMenu = new Menu({ padding: '' })
	let at = -1
	const show = (k: number) => {
		const d = cells[k]
		drawHoverShapes(hoverLayer, [outline(d)])
		const box = (cover.node() as Element).getBoundingClientRect()
		opts.tip.clear()
		info(d, opts.tip.d)
		// without the launcher element: given one, Menu moves focus into the tooltip (dom/menu.js setTabNavigation)
		opts.tip.show(box.left + d.x + CW / 2 + 4, box.top + d.y, false)
	}
	svg
		.on('keydown', (e: KeyboardEvent) => {
			if (e.altKey || e.ctrlKey || e.metaKey || !cells.length) return
			if (e.key == 'Escape') {
				opts.tip.hide()
				return drawHoverShapes(hoverLayer, [])
			}
			if ((e.key == 'Enter' || e.key == ' ') && at >= 0) {
				e.preventDefault()
				opts.tip.hide()
				const d = cells[at]
				const box = (cover.node() as Element).getBoundingClientRect()
				return openActionMenu({
					menu: keyMenu,
					event: { clientX: box.left + d.x + CW / 2, clientY: box.top + d.y },
					actions: opts.getActions(sets[d.r].id),
					renderInfo: c => info(d, c)
				})
			}
			const n = LAYERS.length
			const [r, c] = at < 0 ? [0, -1] : [Math.floor(at / n), at % n]
			const to = { ArrowRight: [r, c + 1], ArrowLeft: [r, c - 1], ArrowDown: [r + 1, c], ArrowUp: [r - 1, c] }[e.key]
			if (!to) return
			const [nr, nc] = at < 0 ? [0, 0] : to
			// past an edge the key is left to the page, which scrolls
			if (nr < 0 || nc < 0 || nr >= sets.length || nc >= n) return
			e.preventDefault()
			at = nr * n + nc
			show(at)
		})
		.on('blur', () => {
			opts.tip.hide()
			drawHoverShapes(hoverLayer, [])
		})

	// legend: the color scale and the dot
	const lg = holder
		.append('div')
		.style('display', 'flex')
		.style('gap', '20px')
		.style('align-items', 'center')
		.style('font-size', '12px')
	const scale = lg.append('div')
	scale.append('div').text(`−log10 q, signed: down or lost (blue), up or gained (orange) in ${opts.groups[1]}`)
	new ColorScale({
		holder: scale.append('svg').attr('width', 190).attr('height', 42),
		domain: color.domain(),
		colors: color.range(),
		barwidth: 160,
		position: '15,5',
		ticks: 5
	})
	const dot = lg.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '6px')
	dot.append('svg').attr('width', 10).attr('height', 10).append('circle').attr('cx', 5).attr('cy', 5).attr('r', 2.5)
	dot.append('span').text(`q < ${Q}`)

	return {
		svg,
		/** the sets shown and the sets at q < 0.05 in some column */
		shown: sets.length,
		destroy: () => {
			dpi.destroy()
			keyMenu.destroy()
		}
	}
}

/** the sets to show: q < 0.05 in some column, the most significant merged first */
export function pathwayRows(ap: ActivePathwaysResponse, maxRows: number) {
	const sig = Math.log10(Q)
	return ap.sets
		.filter(s => s.layers.some(l => l.log10q < sig))
		.sort((a, b) => a.layers[2].log10q - b.layers[2].log10q || a.id.localeCompare(b.id))
		.slice(0, maxRows)
}

/** a layer's −log10 q, negative when its picked genes went down or lost methylation */
export function signedLogQ(l: { log10q: number; direction: number }) {
	return -l.log10q * (l.direction || 1)
}

function heatColor() {
	return scaleLinear<string>().domain([-CAP, 0, CAP]).range([HYPO_COLOR, '#f7f7f7', HYPER_COLOR]).clamp(true)
}

const fmtQ = (q: number) => (q < 1e-4 ? q.toExponential(1) : q.toPrecision(2))
