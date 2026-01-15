import test from 'tape'
import MutationWaterfallMapper from '../MutationWaterfallMapper'
import Reference from '#plots/disco/chromosome/Reference.ts'

const mockSettings = {
	padAngle: 0,
	rings: { chromosomeInnerRadius: 10, chromosomeWidth: 5 }
} as any

const reference = new Reference(mockSettings, { chr1: 100 })

const sampleData = [{ chr: 'chr1', position: 50, logDistance: 1 }] as any

test('\n', t => {
	t.pass('-***- client/plots/disco/waterfall/MutationWaterfallMapper.ts -***-')
	t.end()
})

test('MutationWaterfallMapper assigns configured color to points', t => {
	const mapper = new MutationWaterfallMapper(10, 5, reference, { min: 0, max: 2 }, '#123456')
	const points = mapper.map(sampleData)

	t.equal(points.length, 1, 'creates a point for waterfall datum')
	t.equal(points[0].color, '#123456', 'uses provided color for waterfall dots')
	t.end()
})
