import * as helpers from '../../test/front.helpers.js'
import tape from 'tape'
import { sleep, detectOne, detectGte, detectLst } from '../../test/test.helpers.js'
import { select } from 'd3-selection'

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test'
	},
	debug: 1
})

/**************
 test sections

4 genes for hiercluster, 1 term and 1 gene mutation

***************/
tape('\n', function (test) {
	test.pass('-***- plots/hiercluster.js -***-')
	test.end()
})

tape('4 genes for hiercluster, 1 term and 1 gene mutation', function (test) {
	test.timeoutAfter(5000)
	const genes = [
		{ name: 'TP53', type: 'geneVariant' },
		{ name: 'AKT1', type: 'geneVariant' },
		{ name: 'BCR', type: 'geneVariant' },
		{ name: 'KRAS', type: 'geneVariant' }
	]
	runpp({
		state: {
			nav: { header_mode: 'hidden' }, // must set to hidden for gdc, since it lacks termdb method to get cohort size..
			plots: [
				{
					chartType: 'hierCluster',
					termgroups: [
						{
							lst: [{ term: { name: 'TP53', type: 'geneVariant' } }, { id: 'diaggrp' }]
						}
					],
					genes
				}
			]
		},
		hierCluster: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(hc) {
		hc.on('postRender.test', null)
		test.equal(hc.Inner.dom.termLabelG.selectAll('.sjpp-matrix-label').size(), 6, 'should render 6 rows')

		if (test._ok) hc.Inner.app.destroy()
		test.end()
	}
})
