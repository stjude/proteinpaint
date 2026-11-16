import tape from 'tape'
import { getSingleCellItemMap } from '../sampleView.tiles.ts'

/**
 Tests:
	- single-cell selection matches sample and experiment names exactly, without combined results
 */

tape('\n', function (test) {
	test.comment('-***- plots/sampleView.tiles -***-')
	test.end()
})

tape('single-cell selection matches sample and experiment names exactly, without combined results', function (test) {
	const map = getSingleCellItemMap([
		{ sample: 'All_leukemic_cells', isMetaResult: true },
		{ sample: 'S1' },
		{
			sample: 'S2',
			experiments: [
				{ experimentID: 'E1', sampleName: 'S2_a' },
				{ experimentID: 'E2', sampleName: 'S2_b' }
			]
		}
	])
	test.deepEqual(map.get('S1'), { sID: 'S1' }, 'Should select a sample without experiments by its name.')
	test.deepEqual(map.get('S2'), { sID: 'S2', eID: 'E1' }, 'Should select the first experiment of a sample.')
	test.deepEqual(map.get('S2_b'), { sID: 'S2_b', eID: 'E2' }, 'Should select an experiment by its own sample name.')
	test.notOk(map.has('All_leukemic_cells'), 'Should leave out combined results.')
	test.notOk(map.has('s1'), 'Should match names exactly, not ignoring case.')
	test.end()
})
