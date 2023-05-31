import { showGenesetEdit } from '../genesetEdit'
const tape = require('tape')
const d3s = require('d3-selection')
import { hg38, hg19 } from '../../test/testdata/genomes'
import { Menu } from '#dom/menu'

function getHolder() {
	return d3s.select('body').append('div')
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/
tape('\n', function(test) {
	test.pass('-***- dom/geneDictionary -***-')
	test.end()
})

tape('Empty opts.geneList', function(test) {
	test.timeoutAfter(100)
	const param = { label: 'Param 1', type: 'number', value: 10 }
	const vocabApi = {
		getTopGenes: () => [],
		termdbConfig: {
			topMutatedGenes: { params: [param] }
		}
	} //Fake vocab api returning  some genes

	testHG38()
	//testHG19()
	test.end()

	function testHG38() {
		const menu = new Menu({ padding: '0px' })
		const ui = showGenesetEdit({ x: 100, y: 200, menu, genome: hg38, callback: () => {}, vocabApi })
		test.true('msigdb' in ui.dom.tdbBtns, `should show MSigDB button for the hg38 genome`)
		test.equal(ui.dom.genesDiv.selectAll(':scope>div').size(), 0, 'should render 0 gene pills')
		test.equal(ui.dom.submitBtn.property('disabled'), true, `should have a disabled submit button`)
		test.equal(ui.dom.clearBtn.property('disabled'), true, `should have a disabled clear button`)
		test.true(ui.dom.loadBt !== undefined, `should show load top genes button`)

		if (test._ok) ui.destroy()
	}

	function testHG19() {
		const menu = new Menu({ padding: '0px' })
		const ui = showGenesetEdit({ x: 100, y: 200, menu, genome: hg19, callback: () => {}, vocabApi: {} })
		test.false('msigdb' in ui.dom.tdbBtns, `should not show MSigDB button for the hg19 genome`)
		test.equal(ui.dom.genesDiv.selectAll(':scope>div').size(), 0, 'should render 0 gene pills')
		test.equal(ui.dom.submitBtn.property('disabled'), true, `should have a disabled submit button`)
		test.equal(ui.dom.clearBtn.property('disabled'), true, `should have a disabled clear button`)
		test.true(ui.dom.loadBt == undefined, `should not show load top genes button`)

		if (test._ok) ui.destroy()
	}
})

tape('Non-empty opts.geneList', function(test) {
	test.timeoutAfter(100)
	const vocabApi = { getTopGenes: mode => [] } //Fake vocab api returning  some genes

	testHG38()
	test.end()

	function testHG38() {
		const menu = new Menu({ padding: '0px' })
		const geneList = [{ symbol: 'TP53' }, { symbol: 'KRAS' }]
		const ui = showGenesetEdit({ x: 100, y: 200, menu, genome: hg38, geneList, callback: () => {}, vocabApi })
		test.equal(ui.dom.genesDiv.selectAll(':scope>div').size(), geneList.length, 'should render two gene pills')
		test.equal(ui.dom.submitBtn.property('disabled'), false, `should not have a disabled submit button`)
		test.equal(ui.dom.clearBtn.property('disabled'), false, `should not have a disabled clear button`)
		if (test._ok) ui.destroy()
	}
})

tape('gene deletion', function(test) {
	test.timeoutAfter(100)

	testHG38()
	test.end()

	function testHG38() {
		const menu = new Menu({ padding: '0px' })
		const geneList = [{ symbol: 'TP53' }, { symbol: 'KRAS' }]
		const len = geneList.length
		const ui = showGenesetEdit({ x: 100, y: 200, menu, genome: hg38, geneList, callback: () => {}, vocabApi: {} })
		test.equal(ui.dom.genesDiv.selectAll(':scope>div').size(), len, `should render ${len} gene pills`)
		const geneListCopy = geneList.slice()
		ui.dom.genesDiv
			.node()
			.querySelector(':scope>div')
			.click()
		test.equal(ui.dom.genesDiv.selectAll(':scope>div').size(), len - 1, `should render ${len - 1} gene pill`)
		if (test._ok) ui.destroy()
	}
})

tape('submit button', function(test) {
	test.timeoutAfter(100)
	const vocabApi = {} //Fake vocab api returning  some genes

	const geneList = [{ symbol: 'TP53' }, { symbol: 'KRAS' }]
	const geneLstCopy = structuredClone(geneList)
	const menu = new Menu({ padding: '0px' })
	const ui = showGenesetEdit({ x: 100, y: 200, menu, genome: hg38, geneList, callback, vocabApi })
	ui.dom.submitBtn.node().click()

	function callback(arg) {
		test.deepEqual(geneLstCopy, arg, `should supply the expected geneList as a callback argument`)
		if (test._ok) ui.destroy()
		test.end()
	}
})

/*** TODO: test clear, search genes, add from msigdb, etc ***/

// tape('clear button', function(test) {}
