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

tape('Search genes test', function(test) {
	test.timeoutAfter(3000)

	testHG38()
	testHG19()
	test.end()

	function testHG38() {
		const menu = new Menu({ padding: '0px' })

		showGenesetEdit({ x: 0, y: 200, menu, genome: hg38, callback: printGenes })
		const button = menu.d.select('button[name="msigdbBt"]')
		test.true(!button.empty(), `Should show MSigDB button for the hg38 genome`)
	}

	function testHG19() {
		const menu = new Menu({ padding: '0px' })
		const vocabApi = { geneAPI: { mode: 'expression', getTopGenes: () => hg19.geneset[0].lst } } //Fake vocab api returning  some genes
		showGenesetEdit({
			x: 0,
			y: 400,
			menu,
			genome: hg19,
			callback: printGenes,
			geneList: vocabApi.geneAPI.getTopGenes(),
			mode: 'expression'
		})
		const button = menu.d.select('button[name="msigdbBt"]')
		test.true(button.empty(), `Should not show MSigDB button for the hg19 genome`)
	}

	function printGenes(geneList) {
		console.log('Genes submitted')
		for (const gene of geneList) console.log(gene.name)
	}
})
