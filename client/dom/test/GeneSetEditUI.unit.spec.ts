import { GeneSetEditUI } from '../GeneSetEdit/GeneSetEditUI'
import tape from 'tape'
import { select } from 'd3-selection'
import { hg38, hg19 } from '../../test/testdata/genomes'
import { detectGte } from '../../test/test.helpers'

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
	test.comment('-***- dom/GeneSetEdit//GeneSetEditUI -***-')
	test.end()
})

tape('Empty opts.geneList', function (test) {
	test.timeoutAfter(100)
	const param = { label: 'Param 1', type: 'number', value: 10 }
	const vocabApi = {
		getTopGenes: () => [],
		termdbConfig: {
			queries: { topMutatedGenes: { arguments: [param] } }
		}
	} //Fake vocab api returning  some genes

	testHG38()
	testHG19()
	test.end()

	function testHG38() {
		const holder: any = getHolder()
		const ui = new GeneSetEditUI({
			holder,
			genome: hg38,
			callback: () => {
				//comment so ts-linter doesn't complain
			},
			vocabApi,
			geneList: []
		})
		test.true(
			ui.menuList.some(d => d.label.includes('MSigDB')),
			`Should show MSigDB button for the hg38 genome`
		)
		test.equal(ui.api.dom.geneHoldingDiv.selectAll(':scope>div').size(), 0, 'Should render 0 gene pills')
		test.equal(ui.api.dom.submitBtn.property('disabled'), true, `Should have a disabled submit button`)
		test.equal(ui.api.dom.clearBtn.property('disabled'), true, `Should have a disabled clear button`)
		test.false(
			ui.menuList.some(d => d.label.includes('mutated')),
			`should show load top genes button`
		)

		if (test['_ok']) ui.api.destroy()
	}

	function testHG19() {
		const holder: any = getHolder()
		const genome: any = hg19
		const ui = new GeneSetEditUI({
			holder,
			genome,
			callback: () => {
				//comment so ts-linter doesn't complain
			},
			vocabApi: {},
			geneList: []
		})
		test.false(
			ui.menuList.some(d => d.label.includes('MSigDB')),
			`Should not show MSigDB button for the hg19 genome`
		)
		test.equal(ui.api.dom.geneHoldingDiv.selectAll(':scope>div').size(), 0, 'Should render 0 gene pills')
		test.equal(ui.api.dom.submitBtn.property('disabled'), true, `Should have a disabled submit button`)
		test.equal(ui.api.dom.clearBtn.property('disabled'), true, `Should have a disabled clear button`)
		test.false(
			ui.menuList.some(d => d.label.includes('mutated')),
			`should show load top genes button`
		)

		if (test['_ok']) ui.api.destroy()
	}
})

tape('Non-empty opts.geneList', function (test) {
	test.timeoutAfter(100)
	const vocabApi = { getTopGenes: () => [] } //Fake vocab api returning  some genes

	testHG38()
	test.end()

	function testHG38() {
		const holder: any = getHolder()
		const geneList = [{ gene: 'TP53' }, { gene: 'KRAS' }]
		const ui = new GeneSetEditUI({
			holder,
			genome: hg38,
			geneList,
			callback: () => {
				//Comment so ts-linter doesn't complain
			},
			vocabApi
		})
		test.equal(
			ui.api.dom.geneHoldingDiv.selectAll(':scope>div').size(),
			geneList.length,
			'Should render two gene pills'
		)
		test.equal(ui.api.dom.submitBtn.property('disabled'), true, `Should have a disabled submit button`)
		test.equal(ui.api.dom.clearBtn.property('disabled'), false, `Should not have a disabled clear button`)

		if (test['_ok']) ui.api.destroy()
	}
})

tape('Gene deletion', function (test) {
	test.timeoutAfter(100)

	testHG38()
	test.end()

	function testHG38() {
		const holder: any = getHolder()
		const geneList = [{ gene: 'TP53' }, { gene: 'KRAS' }]
		const len = geneList.length
		const ui = new GeneSetEditUI({
			holder,
			genome: hg38,
			geneList,
			callback: () => {
				//Comment so ts-linter doesn't complain
			},
			vocabApi: {}
		})
		test.equal(ui.api.dom.submitBtn.property('disabled'), true, `should have a disabled submit button`)
		test.equal(ui.api.dom.geneHoldingDiv.selectAll(':scope>div').size(), len, `should render ${len} gene pills`)
		//Leave this line. Necessary for the .click() to work
		ui.api.dom.geneHoldingDiv.node() as HTMLElement
		;(ui.api.dom.geneHoldingDiv.node()!.querySelector(':scope>div') as HTMLElement).click()
		test.equal(ui.api.dom.geneHoldingDiv.selectAll(':scope>div').size(), len - 1, `should render ${len - 1} gene pill`)
		test.equal(ui.api.dom.submitBtn.property('disabled'), false, `should not have a disabled submit button`)

		if (test['_ok']) ui.api.destroy()
	}
})

tape('Submit button', function (test) {
	test.timeoutAfter(100)
	const holder: any = getHolder()
	const geneList: { gene: string }[] = [{ gene: 'KRAS' }, { gene: 'TP53' }]
	const geneLstCopy = structuredClone(geneList)
	const ui = new GeneSetEditUI({
		holder,
		genome: hg38,
		geneList,
		callback,
		vocabApi: {}
	})
	geneList.slice(-1)
	//Leave this line. Necessary for the .click() to work
	ui.api.dom.geneHoldingDiv.node() as HTMLElement
	;(ui.api.dom.geneHoldingDiv.node()!.querySelector(':scope>div') as HTMLElement).click()
	test.equal(ui.api.dom.submitBtn.property('disabled'), false, `should not have a disabled submit button`)
	ui.api.dom.submitBtn.node()!.click()

	function callback({ geneList }) {
		test.deepEqual(geneLstCopy.slice(-1), geneList, `should supply the expected geneList as a callback argument`)
		if (test['_ok']) ui.api.destroy()
		test.end()
	}
})

tape('Clear button', function (test) {
	test.timeoutAfter(100)
	const holder: any = getHolder()
	const geneList: { gene: string }[] = [{ gene: 'KRAS' }, { gene: 'TP53' }]
	const ui = new GeneSetEditUI({
		holder,
		genome: hg38,
		geneList,
		callback: () => {
			//Comment so ts-linter doesn't complain
		},
		vocabApi: {}
	})

	ui.api.dom.clearBtn.node()!.click()
	test.equal(ui.api.dom.geneHoldingDiv.selectAll(':scope>div').size(), 0, `Should remove all gene pills`)
	test.equal(ui.api.dom.submitBtn.property('disabled'), true, `Should disable submit button after clearing all genes`)

	if (test['_ok']) ui.api.destroy()
	test.end()
})

//Test works locally but fails on CI
tape.skip('MSigDB gene set', async function (test) {
	test.timeoutAfter(100)
	const holder: any = getHolder()
	const geneList: { gene: string }[] = [{ gene: 'KRAS' }, { gene: 'TP53' }]
	const ui = new GeneSetEditUI({
		holder,
		genome: hg38,
		geneList,
		callback: () => {
			//Comment so ts-linter doesn't complain
		},
		vocabApi: {}
	})

	const options = await detectGte({
		selector: '.termdiv',
		target: ui.tip2.dnode,
		count: 9,
		trigger() {
			ui.menuList.find(d => d.label.includes('MSigDB'))!.callback()
		}
	})
	test.equal(options.length, 9, `Should display 9 MSigDB gene sets`)

	if (test['_ok']) {
		ui.tip2.hide()
		ui.api.destroy()
	}
	test.end()
})
