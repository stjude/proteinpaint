import tape from 'tape'
import { select } from 'd3-selection'
import { renderSwimmerFace, renderSsgqFace, renderScatterFace, zoomRange } from '../sampleView.faces.ts'

/**
 Tests:
	- swimmer face is the full swimmer cropped to its lanes
	- ssgq face is only the server image
	- scatter face draws the dots in the plot colors
	- scatter face zooms into the highlighted samples and rings them
	- zoomRange spans the highlighted dots, at least a part of the plot, inside the plot
 */

const swimmer = {
	timeReferences: [{ key: 'Birth', timeLabel: 'Days after birth', isDefault: true }],
	categories: { Induction: { label: 'Induction', color: '#a1d99b' } },
	events: {
		Dx: { label: 'Diagnosis', color: '#6baed6', shape: 'filledDiamond' },
		CSF: { label: 'CSF sample', color: '#dd8452', shape: 'filledCircle' }
	}
}

const data = {
	timeReference: 'Birth',
	lanes: [
		{
			sample: 'P1_patient',
			sampleId: 1,
			ranges: [{ category: 'Induction', start: 100, end: 300 }],
			points: [
				{ event: 'Dx', time: 50 },
				{ event: 'CSF', time: 120, sample: 'P1_N1', sampleId: 2 },
				{ event: 'CSF', time: 250, sample: 'P1_N2', sampleId: 3 }
			]
		}
	]
}

function getFace() {
	return select(document.body).append('div')
}

tape('\n', function (test) {
	test.comment('-***- plots/sampleView.faces -***-')
	test.end()
})

tape('swimmer face is the full swimmer cropped to its lanes', async function (test) {
	const face = getFace()
	const destroy: (() => void)[] = []
	const ctx: any = { termdbConfig: { queries: { swimmer } }, app: {}, onDestroy: fn => destroy.push(fn) }
	await renderSwimmerFace(face, data as any, ctx, 'P1_N2')
	const svg = face.select('svg')
	const legend = svg.select('[data-testid="sjpp-swimmer-legend-item"]').node() as Element
	const [x, , w] = svg.attr('viewBox').split(' ').map(Number)
	test.ok(
		legend.getBoundingClientRect().left >= (svg.node() as Element).getBoundingClientRect().right,
		'Should crop the legend out of the face.'
	)
	test.ok(w > 0 && x >= 0, 'Should crop the svg to the lanes.')
	test.equal(svg.style('pointer-events'), 'none', 'Should not handle the mouse on the face.')
	test.equal(face.selectAll('[data-testid="sjpp-swimmer-highlight"]').size(), 1, 'Should outline the chosen event.')
	for (const fn of destroy) fn()
	face.remove()
	test.end()
})

tape('ssgq face is only the server image', function (test) {
	const face = getFace()
	renderSsgqFace(face, {
		src: 'data:,',
		canvasWidth: 1000,
		canvasHeight: 300,
		xoff: 50,
		chrLst: [{ chr: 'chr1', xStart: 0, xStop: 900 }]
	})
	test.equal(face.selectAll('img').size(), 1, 'Should show the image.')
	test.equal(face.text(), '', 'Should show no labels or key.')
	face.remove()
	test.end()
})

tape('scatter face draws the dots in the plot colors', function (test) {
	const face = getFace()
	renderScatterFace(face, {
		Default: {
			colorLegend: [['A', { color: 'red' }]],
			samples: [
				{ sample: 's1', x: 0, y: 0, category: 'A' },
				{ sample: 's2', x: 1, y: 1, category: 'B' }
			]
		}
	})
	const dots = face.selectAll('circle').nodes() as Element[]
	test.equal(dots.length, 2, 'Should draw every dot.')
	test.equal(dots[0].getAttribute('fill'), 'red', 'Should color a dot by its category.')
	face.remove()
	test.end()
})

tape('scatter face zooms into the highlighted samples and rings them', function (test) {
	const face = getFace()
	const samples = [{ sample: 'far', x: 100, y: 100, category: 'A' }]
	for (let i = 0; i <= 10; i++) samples.push({ sample: 'n' + i, x: i, y: i, category: 'A' })
	renderScatterFace(face, { Default: { colorLegend: [['A', { color: 'red' }]], samples } }, ['n4', 'n5'], 'n5')
	const rings = face.selectAll('[data-testid="sjpp-sampleview-scatter-highlight"]').nodes() as Element[]
	test.equal(rings.length, 2, 'Should ring each highlighted sample.')
	test.equal(rings[1].getAttribute('stroke-width'), '2', 'Should draw the emphasized ring last and thicker.')
	const dots = face.select('g').selectAll('circle').nodes() as Element[]
	test.ok(dots.length < samples.length, 'Should leave out the dots far from the highlighted samples.')
	const cx = rings.map(r => Number(r.getAttribute('cx')))
	// one unit is about 2px over the full range of 100, and about 20px over the zoomed range of 10
	test.ok(cx[1] - cx[0] > 10, 'Should spread the highlighted samples apart by zooming in.')
	face.remove()
	test.end()
})

tape('zoomRange spans the highlighted dots, at least a part of the plot, inside the plot', function (test) {
	test.deepEqual(zoomRange([0, 100], undefined), [0, 100], 'Should show the full range without highlighted dots.')
	test.deepEqual(zoomRange([0, 100], [50, 50]), [45, 55], 'Should show a lone dot with its neighborhood.')
	test.deepEqual(zoomRange([0, 100], [0, 0]), [0, 10], 'Should keep a region at the edge inside the plot.')
	const [a, b] = zoomRange([0, 100], [40, 80])
	test.ok(a < 40 && b > 80 && b - a < 100, 'Should pad the range of several dots.')
	test.deepEqual(zoomRange([0, 100], [0, 100]), [0, 100], 'Should not go past the full range.')
	test.deepEqual(zoomRange([5, 5], [5, 5]), [4.5, 5.5], 'Should give a single-valued axis some width.')
	test.end()
})
