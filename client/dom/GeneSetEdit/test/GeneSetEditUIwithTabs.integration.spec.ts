import { GeneSetEditUIwithTabs } from '../GeneSetEditUIwithTabs.ts'
import tape from 'tape'
import { select } from 'd3-selection'
import { hg38 } from '../../../test/testdata/genomes'
import { detectGte, Locator } from '../../../test/test.helpers'
import { Menu } from '../../menu.js'

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

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- dom/GeneSetEdit/GeneSetEditUIwithTabs -***-')
	test.end()
})

tape('Initial radio buttons/tab for top, preset, and custom gene set', async function (test) {
	test.timeoutAfter(200)
	const holder: any = getHolder()
	const btn = holder.append('button').html('test-only')
	const tip = new Menu()
	tip.showunder(btn.node())
	const geneList: { gene: string }[] = [{ gene: 'KRAS' }, { gene: 'TP53' }]
	// the geneset ui holder should not be tip.d root element itself, to test disappearing parent/ancestor tip
	const uiHolder = tip.d.append('div')
	const ui = new GeneSetEditUIwithTabs({
		holder: uiHolder as any,
		genome: hg38,
		geneList,
		callback: () => {
			//Comment so ts-linter doesn't complain
		},
		vocabApi: {}
	})

	const tipLoc = await Locator.init(tip.d.node())
	const radios = await tipLoc.shows('input[type="radio"]').get()
	test.equal(radios.length, 3, 'should show 3 radio inputs initially')

	radios[2].dispatchEvent(new PointerEvent('click', { bubbles: true }))
	const msigBtn = await tipLoc.shows('[data-testid="sjpp-geneSetEditUi-msigdb"]').get(0)

	const branches = await detectGte({
		selector: '.termdiv',
		target: ui.tip2.dnode,
		count: 2,
		trigger() {
			msigBtn.click()
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
