import tape from 'tape'
import * as d3s from 'd3-selection'
import { renderLocusHeatmap, type LocusHeatmapData } from '../block.locusHeatmap'

/**
 * Tests
 *   - draws the statistics rows, heatmap, annotation columns and a line per column with an x, and reports the cell under the pointer
 */

function getTk() {
	const svg = d3s.select('body').append('svg').attr('width', 500).attr('height', 500)
	return {
		glider: svg.append('g'),
		gleft: svg.append('g'),
		gright: svg.append('g'),
		rows: { heatmapHeight: 100 }
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
				bars: [{ v: 1, color: 'black' }, { v: -0.5, color: 'black' }, null],
				dots: [{ col: 0, v: 0, color: 'green', filled: true }]
			},
			{ label: 'mean', domain: [0, 1], lines: [{ color: 'red', values: [0, null, 1] }] }
		],
		annotations: [
			{ label: 'a', colors: ['red', 'blue'] },
			{ label: 'b', colors: ['gray', 'gray'], widths: [0.5, 1] }
		],
		note: ['2 rows'],
		onHover: (_, col, row) => (hover = [col, row])
	}
	const height = renderLocusHeatmap(tk, block, data)
	const r = tk.rows
	// two statistics rows of 40 + 4 gap, heatmap 100, linkage 60
	t.equal(height, 248, 'returns the height of the rows')
	const bars = r.statisticsG.selectAll('rect').nodes()
	t.equal(bars.length, 2, 'one bar per column with a value')
	t.deepEqual(
		bars.map(b => [Number(b.getAttribute('y')), Number(b.getAttribute('height'))]),
		[
			[0, 20],
			[20, 10]
		],
		'bars run from zero, up for a positive value and down for a negative one'
	)
	t.equal(r.statisticsG.selectAll('circle').size(), 1, 'a dot per given dot')
	t.equal(r.statisticsG.select('path').attr('d'), 'M50,40M250,0', 'a missing value breaks a line')
	t.equal(r.heatmapG.selectAll('image').size(), 1, 'the heatmap is one image')
	const ann = tk.annotationColG.selectAll('image').nodes()
	t.equal(ann.length, 2, 'one image per annotation column')
	t.ok(Number(ann[1].getAttribute('width')) > Number(ann[0].getAttribute('width')), 'a column of bars is wider')
	const gap = r.heatmapG.selectAll('line').nodes()
	t.equal(gap.length, 1, 'a gap per row break across the heatmap')
	t.equal(Number(gap[0].getAttribute('y1')), 138, 'above the row that starts the block')
	t.equal(tk.annotationColG.selectAll('line').size(), 1, 'and across the annotation columns')
	const lines = r.linkageG.selectAll('line').nodes()
	t.equal(lines.length, 2, 'no line for the column without x')
	t.equal(Number(lines[0].getAttribute('x1')), 50, 'a line starts under the middle of its column')
	t.equal(Number(lines[0].getAttribute('x2')), 10, 'and ends at the x of the column')
	t.equal(Number(lines[1].getAttribute('y2')) - Number(lines[0].getAttribute('y2')), 30, 'dy extends a line')
	t.equal(r.leftG.selectAll('text').size(), 4, 'a label per statistics row and the names of tall rows are on the left')

	// second column (100-200 px); the heatmap spans y 88-188
	const hit = r.heatmapG.select('rect').node()
	const box = hit.getBoundingClientRect()
	const move = (y: number) =>
		hit.dispatchEvent(new MouseEvent('mousemove', { clientX: box.left + 150, clientY: box.top + y, bubbles: true }))
	move(160)
	t.deepEqual(hover, [1, 1], 'hover reports the column and row under the pointer')
	t.equal(lines[1].getAttribute('stroke'), '#000', 'and highlights the line of that column')
	move(10)
	t.deepEqual(hover, [1, -1], 'over a statistics row, the column and no row')

	tk.rows.heatmapHeight = 10
	renderLocusHeatmap(tk, block, data)
	t.equal(r.leftG.selectAll('text').size(), 3, 'thin rows: the note instead of the row names')

	t.equal(renderLocusHeatmap(tk, block, { ...data, cols: [] }), 0, 'no columns: height 0')
	t.equal(r.heatmapG.selectAll('*').size(), 0, 'and the rows are cleared')
	t.end()
})
