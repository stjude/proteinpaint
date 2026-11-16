import tape from 'tape'
import { select } from 'd3-selection'
import { renderSwimmerFace, renderSsgqFace, renderScatterFace } from '../sampleView.faces.ts'

/**
 Tests:
	- swimmer face is the full swimmer cropped to its lanes
	- ssgq face is only the server image
	- scatter face draws the dots in the plot colors
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
