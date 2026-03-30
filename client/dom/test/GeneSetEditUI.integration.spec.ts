import { GeneSetEditUI } from '../GeneSetEdit/GeneSetEditUI'
import tape from 'tape'
import { select } from 'd3-selection'
import { hg38 } from '../../test/testdata/genomes'
import { vocabInit } from '../../termdb/vocabulary'
import { detectGte } from '../../test/test.helpers'
import { Menu } from '../menu.js'

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

tape('MSigDB gene set', async function (test) {
	test.timeoutAfter(200)
	const holder: any = getHolder()
	const btn = holder.append('button').html('test-only')
	const tip = new Menu()
	tip.showunder(btn.node())
	const geneList: { gene: string }[] = [{ gene: 'KRAS' }, { gene: 'TP53' }]
	// the geneset ui holder should not be tip.d root element itself, to test disappearing parent/ancestor tip
	const uiHolder = tip.d.append('div')
	const ui = new GeneSetEditUI({
		holder: uiHolder as any,
		genome: hg38,
		geneList,
		callback: () => {
			//Comment so ts-linter doesn't complain
		},
		vocabApi: {}
	})

	const branches = await detectGte({
		selector: '.termdiv',
		target: ui.tip2.dnode,
		count: 2,
		trigger() {
			ui.menuList.find(d => d.label.includes('MSigDB'))!.callback()
		}
	})

	test.true(branches.length >= 2, `Should display >= 2 MSigDB branches`)

	const options = await detectGte({
		selector: '.ts_pill',
		target: ui.tip2.dnode,
		count: 9,
		trigger() {
			branches[0].querySelector('.termbtn').click()
		}
	})

	test.true(options.length >= 9, `Should display >= 9 MSigDB gene sets from the first branch`)

	const branchDiv = ui.tip2?.dnode?.querySelector('.termdiv')?.closest('div')
	branchDiv?.dispatchEvent(new Event('mousedown', { bubbles: true }))
	test.equal(
		tip.dnode?.checkVisibility(),
		true,
		'should not hide the parent menu after clicking on any part of the MSigDB menu UI'
	)

	if (test['_ok']) {
		holder.remove()
		ui.api.destroy()
		tip.destroy()
	}
	test.end()
})
