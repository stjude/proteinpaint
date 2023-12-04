import tape from 'tape'
import { HicRunProteinPaintTrackArgs } from '../../../types/hic.ts'
import * as d3s from 'd3-selection'
import { runproteinpaint } from '../../../test/front.helpers.js'
//import { sleep, detectOne, detectGte } from '../../../test/test.helpers.js'

function getHolder() {
	return d3s
		.select('body')
		.append('div')
		.style('border', '1px solid #aaa')
		.style('padding', '5px')
		.style('margin', '5px')
		.node()
}

tape('\n', function (test) {
	test.pass('-***- tracks/hic -***-')
	test.end()
})

// tape('Render Hi-C track', function (test) {
// 	// test.plan(1)
// 	test.timeoutAfter(3000)
// 	const holder = getHolder() as HTMLDivElement

// 	runproteinpaint({
// 		holder,
// 		block: true,
// 		nobox: 1,
// 		noheader: 1,
// 		genome: 'hg19',
// 		position: 'chr7:13749862-20841903',
// 		nativetracks: 'RefGene',
// 		tracks: [
// 			{
// 				type: 'hicstraw',
// 				file: 'proteinpaint_demo/hg19/hic/hic_demo.hic',
// 				name: 'Hi-C Demo',
// 				percentile_max: 95,
// 				mincutoff: 1,
// 				pyramidup: 1,
// 				enzyme: 'MboI',
// 				normalizationmethod: 'VC'
// 			} as HicRunProteinPaintTrackArgs
// 		]
// 	})
// 	test.pass('Rendered Hi-C track')

// 	// if (test._ok) holder.remove()
// 	test.end()
// })
