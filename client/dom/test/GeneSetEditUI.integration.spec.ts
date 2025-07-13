import { GeneSetEditUI } from '../GeneSetEdit/GeneSetEditUI'
import tape from 'tape'
import { select } from 'd3-selection'
import { hg38 } from '../../test/testdata/genomes'
import { vocabInit } from '../../termdb/vocabulary'

/**
 * NOTE: Do not add tests that require the fasta file to be available.
 * See tests in genesearch as a guide.
 *
 * Tests
 *     - With .limitedGenesList
 */

/*************************
 reusable helper functions
**************************/
function getHolder() {
	return select('body').append('div').style('max-width', '800px').style('border', '1px solid #555')
}

function getOpts(_opts, genome = 'hg38-test', dslabel = 'TermdbTest') {
	const state = {
		vocab: { route: 'termdb', genome, dslabel },
		termfilter: {},
		activeCohort: 0
	}
	const app = Object.assign(_opts.app || {}, {
		getState() {
			return state
		},
		opts: { state }
	})
	const vocabApi = _opts.vocabApi || vocabInit({ app, state })
	app.vocabApi = vocabApi

	const opts = {
		holder: _opts.holder,
		genome: hg38,
		geneList: [{ gene: 'KRAS' }, { gene: 'TP53' }],
		vocabApi,
		callback: () => {
			//Comment so ts-linter doesn't complain
		}
	} as any
	return Object.assign(opts, _opts)
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- dom/GeneSetEdit/GeneSetEditUI -***-')
	test.end()
})

tape('With .limitedGenesList', function (test) {
	test.timeoutAfter(100)
	const holder: any = getHolder()
	const opts = getOpts({ holder, limitedGenesList: ['TP53'] })
	const ui = new GeneSetEditUI(opts)

	const pills = ui.api.dom.geneHoldingDiv.selectAll('.sja_menuoption > div').nodes() as any
	test.equal(pills.length, 2, 'Should render two gene pills')
	test.equal(pills[0].textContent, 'KRAS', 'Should render the first gene pill as KRAS')
	test.equal(pills[0].style.textDecoration, 'line-through', 'Should show the first gene pill as strikethrough.')
	test.equal(pills[1].textContent, 'TP53', 'Should render the second gene pill as TP53.')
	test.equal(pills[1].style.textDecoration, '', 'Should show the second gene pill normally.')

	if (test['_ok']) ui.api.destroy()
	test.end()
})
