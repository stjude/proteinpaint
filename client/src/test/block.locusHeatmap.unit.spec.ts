import tape from 'tape'
import * as d3s from 'd3-selection'
import { renderLocusHeatmap, locusHeatmapHeight, fitLabel, type LocusHeatmapData } from '../block.locusHeatmap'

/**
 * Tests
 *   - draws the statistics rows, heatmap, annotation columns and a line per column with an x, and reports the cell under the pointer
 *   - draws intervals at their genomic extent under the lines
 *   - draws an annotation column of parts, and widens the block's right side for it
 *   - draws model rows under the lines, clipped to the view, with what goes with each on the right
 *   - fitLabel cuts a label to its room
 */

function getTk() {
	const svg = d3s.select('body').append('svg').attr('width', 500).attr('height', 500)
	return {
		glider: svg.append('g'),
		gleft: svg.append('g'),
		gright: svg.append('g'),
		rows: { heatmap: { height: 100 } }
	} as any
}

tape('renderLocusHeatmap', t => {
	const tk = getTk()
	const block = { width: 300, tkleftlabel_xshift: -10 }
	let hover: number[] = []
	const data: LocusHeatmapData = {
		rows: ['s1', 's2'],
		rowBreaks: [1],
		cols: [{ x: 10, values: [0, 1] }, { x: 20, dy: 30, values: [null, 0.5] }, { values: [1, 1] }],
		color: v => (v > 0.5 ? 'red' : 'blue'),
		missingColor: 'gray',
		stats: [
			{
				label: 'rho',
				domain: [-1, 1],
				bars: [{ v: 1, color: 'black' }, { v: -0.5, color: 'black' }, null]
			},
			{
				label: 'mean',
				domain: [0, 1],
				lines: [
					{ color: 'red', values: [0, null, 1] },
					{ color: 'blue', values: [0, 1, null] }
				],
				fill: {
					values: [
						[0.5, null, 0.75],
						[0.25, 1, 1]
					],
					colors: ['blue', 'orange']
				}
			}
		],
		annotations: [
			{ label: 'a', colors: ['red', 'blue'] },
			{ label: 'b', colors: ['gray', 'gray'], widths: [0.5, 1] }
		],
		note: ['2 rows'],
		onHover: (_, col, row) => (hover = [col, row])
	}
	const height = renderLocusHeatmap(tk, block, data)
	const { statistics, heatmap, linkage } = tk.rows
	// two statistics rows of 40 + 4 gap, heatmap 100, linkage 60
	t.equal(height, 248, 'returns the height of the rows')
	t.deepEqual(
		[statistics.height, heatmap.height, linkage.height, locusHeatmapHeight(tk)],
		[88, 100, 60, 248],
		'and keeps the height of each row, which add up to it'
	)
	t.ok(heatmap.leftWidth > 0, 'and the width of the labels on the left')
	const [rhoRow, meanRow] = statistics.g.selectAll(':scope > g').nodes()
	const bars = d3s.select(rhoRow).selectAll('rect').nodes() as Element[]
	t.equal(bars.length, 2, 'one bar per column with a value')
	t.deepEqual(
		bars.map(b => [Number(b.getAttribute('y')), Number(b.getAttribute('height'))]),
		[
			[0, 20],
			[20, 10]
		],
		'bars run from zero, up for a positive value and down for a negative one'
	)
	const band = d3s.select(meanRow).selectAll('rect').nodes() as Element[]
	t.deepEqual(
		band.map(r => [r.getAttribute('fill'), Number(r.getAttribute('y')), Number(r.getAttribute('height'))]),
		[
			['blue', 20, 10],
			['orange', 0, 10]
		],
		'the gap between two series is shaded in each column with both, by which is higher'
	)
	t.deepEqual(
		statistics.g
			.selectAll('path')
			.nodes()
			.map(p => p.getAttribute('d')),
		['M0,40h100M200,0h100', 'M50,40L150,0'],
		'a value with none next to it is a dash as wide as its column, and values next to each other are joined'
	)
	t.equal(heatmap.g.selectAll('image').size(), 1, 'the heatmap is one image')
	const ann = heatmap.rightG.selectAll('image').nodes()
	t.equal(ann.length, 2, 'one image per annotation column')
	t.ok(Number(ann[1].getAttribute('width')) > Number(ann[0].getAttribute('width')), 'a column of bars is wider')
	const gap = heatmap.g.selectAll('line').nodes()
	t.equal(gap.length, 1, 'a gap per row break across the heatmap')
	t.equal(Number(gap[0].getAttribute('y1')), 138, 'above the row that starts the block')
	t.equal(heatmap.rightG.selectAll('line').size(), 1, 'and across the annotation columns')
	const lines = linkage.g.selectAll('line').nodes()
	t.equal(lines.length, 2, 'no line for the column without x')
	t.equal(Number(lines[0].getAttribute('x1')), 50, 'a line starts under the middle of its column')
	t.equal(Number(lines[0].getAttribute('x2')), 10, 'and ends at the x of the column')
	t.equal(Number(lines[1].getAttribute('y2')) - Number(lines[0].getAttribute('y2')), 30, 'dy extends a line')
	t.equal(
		heatmap.leftG.selectAll('text').size(),
		4,
		'a label per statistics row and the names of tall rows are on the left'
	)

	// second column (100-200 px); the heatmap spans y 88-188
	const hit = heatmap.g.select('rect[fill=transparent]').node()
	const box = hit.getBoundingClientRect()
	const move = (y: number) =>
		hit.dispatchEvent(new MouseEvent('mousemove', { clientX: box.left + 150, clientY: box.top + y, bubbles: true }))
	move(160)
	t.deepEqual(hover, [1, 1], 'hover reports the column and row under the pointer')
	t.equal(lines[1].getAttribute('stroke'), '#000', 'and highlights the line of that column')
	const outline = heatmap.g.select('rect[fill=none]')
	t.equal(outline.attr('display'), null, 'outlines that column')
	t.equal(Number(outline.attr('x')), 100, 'at its place in the heatmap')
	move(10)
	t.deepEqual(hover, [1, -1], 'over a statistics row, the column and no row')
	heatmap.highlight(0)
	t.equal(Number(outline.attr('x')), 0, 'highlight() outlines a given column')
	t.equal(lines[0].getAttribute('stroke'), '#000', 'and highlights its line')
	t.equal(lines[1].getAttribute('stroke'), '#999', 'and no other line')
	heatmap.highlight(-1)
	t.equal(outline.attr('display'), 'none', 'highlight(-1) clears the outline')
	t.equal(lines[0].getAttribute('stroke'), '#999', 'and the line')

	heatmap.height = 10
	renderLocusHeatmap(tk, block, data)
	t.equal(heatmap.leftG.selectAll('text').size(), 3, 'thin rows: the note instead of the row names')

	t.equal(renderLocusHeatmap(tk, block, { ...data, cols: [] }), 0, 'no columns: height 0')
	t.equal(heatmap.g.selectAll('*').size(), 0, 'and the rows are cleared')
	t.equal(locusHeatmapHeight(tk), 0, 'and their heights are 0')
	t.equal(heatmap.highlight, undefined, 'and there is no column to highlight')
	t.end()
})

tape('renderLocusHeatmap draws intervals at their genomic extent under the lines', t => {
	const tk = getTk()
	const block = { width: 300, tkleftlabel_xshift: -10 }
	let hovered = -1
	const data: LocusHeatmapData = {
		rows: ['s1'],
		cols: [{ x: 10, values: [0] }],
		color: () => 'red',
		missingColor: 'gray',
		intervals: {
			label: 'DMRs',
			items: [
				{ x0: 20, x1: 120, color: 'orange' },
				// reversed ends, as on a minus-strand view
				{ x0: 200, x1: 150, color: 'blue' },
				// shorter than 2 px still shows
				{ x0: 250, x1: 250.5, color: 'blue' },
				// outside the view: not drawn
				{ x0: 400, x1: 450, color: 'blue' }
			],
			onHover: (_, i) => (hovered = i)
		}
	}
	const height = renderLocusHeatmap(tk, block, data)
	const { linkage } = tk.rows
	// heatmap 100, linkage 60 + the interval row 6 + 10 + 2
	t.equal(linkage.height, 78, 'the interval row adds to the linkage height')
	t.equal(height, 178, 'and to the height returned')
	const rects = linkage.g.selectAll('rect').nodes()
	t.deepEqual(
		rects.map(r => [Number(r.getAttribute('x')), Number(r.getAttribute('width')), r.getAttribute('fill')]),
		[
			[20, 100, 'orange'],
			[150, 50, 'blue'],
			[249.25, 2, 'blue']
		],
		'one rect per item in view, from its start to its end, at least 2 px wide'
	)
	t.ok(
		rects.every(r => Number(r.getAttribute('y')) == 100 + 60 + 6),
		'under the lines'
	)
	rects[1].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
	t.equal(hovered, 1, 'hover reports the item')
	t.ok(
		tk.rows.heatmap.leftG
			.selectAll('text')
			.nodes()
			.some(n => n.textContent == 'DMRs'),
		'with its label on the left'
	)
	t.end()
})

tape('renderLocusHeatmap: an annotation column of parts', t => {
	const tk = getTk()
	let widened = 0
	const block = { width: 300, tkleftlabel_xshift: -10, rightheadw: 50, blocksetw: () => widened++ }
	const data = {
		rows: ['s1', 's2'],
		cols: [{ values: [0, 1] }],
		color: () => 'red',
		missingColor: 'gray',
		annotations: [
			{
				label: 'parts',
				parts: [
					[
						{ color: 'red', width: 0.25 },
						{ color: 'blue', width: 0.75 }
					],
					[]
				]
			}
		]
	}
	renderLocusHeatmap(tk, block, data)
	const ann = tk.rows.heatmap.rightG.select('image')
	t.equal(Number(ann.attr('width')), 60, 'a column of parts has its own width')
	t.equal(block.rightheadw, 60 + 3 + 10, "the block's right side is widened to hold the column")
	t.equal(widened, 1, 'and the block is told to lay out again')
	renderLocusHeatmap(tk, block, data)
	t.equal(widened, 1, 'a column that fits does not lay the block out again')
	t.end()
})

tape('renderLocusHeatmap: model rows', t => {
	const tk = getTk()
	let widened = 0
	const block = { width: 300, tkleftlabel_xshift: -10, rightheadw: 50, blocksetw: () => widened++ }
	const rights: number[] = []
	const data: LocusHeatmapData = {
		rows: ['s1'],
		cols: [{ x: 10, values: [0] }],
		color: () => 'red',
		missingColor: 'gray',
		models: [
			{
				label: 'Isoforms',
				rowHeight: 20,
				rightWidth: 200,
				rows: [
					{
						label: 'a',
						color: 'blue',
						line: [10, 250],
						exons: [
							[10, 20],
							[240, 250]
						]
					},
					// running past the view: clipped to its right edge
					{ label: 'b', color: 'orange', line: [100, 400], exons: [[280, 400]] }
				],
				right: (g, i) => {
					rights.push(i)
					g.append('rect').attr('class', 'right')
				}
			},
			// a second block, under the first
			{ label: 'More', rowHeight: 10, rows: [{ label: 'c', color: 'green', line: [0, 50], exons: [] }] }
		]
	}
	renderLocusHeatmap(tk, block, data)
	const { linkage, heatmap } = tk.rows
	// heatmap 100, linkage 60, then 18 for the label and 2 rows of 20
	t.equal(linkage.height, 60 + 18 + 40 + 18 + 10, 'the model rows of each block add to the linkage height')
	const exons = linkage.g
		.selectAll('rect')
		.nodes()
		.filter((r: any) => r.getAttribute('height') == '8')
		.map((r: any) => [Number(r.getAttribute('x')), Number(r.getAttribute('width')), r.getAttribute('fill')])
	t.deepEqual(
		exons,
		[
			[10, 10, 'blue'],
			[240, 10, 'blue'],
			[280, 20, 'orange']
		],
		'an exon per box at its px, cut at the edge of the view'
	)
	t.deepEqual(rights, [0, 1], 'right() draws each row')
	t.equal(heatmap.rightG.selectAll('rect.right').size(), 2, 'in the right side')
	t.equal(block.rightheadw, 210, "the block's right side is widened to hold it")
	t.equal(widened, 1, 'and the block laid out again')
	t.end()
})

tape('fitLabel cuts a label to its room', t => {
	const text = d3s.select('body').append('svg').append('text').attr('font-size', 10)
	const node = text.node() as SVGTextElement
	fitLabel(node, 'Isoform share', 76)
	t.equal(node.textContent, 'Isoform share', 'whole when it fits')
	fitLabel(node, 'ENST00000382888 usage', 76)
	t.ok(node.textContent!.endsWith('…') && node.getComputedTextLength() <= 76, 'cut with an ellipsis to the room')
	;(text.node()!.parentNode as Element).remove()
	t.end()
})
