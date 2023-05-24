import { initGenesetEdit } from '../genesetEdit'
const helpers = require('../../test/front.helpers.js')
const tape = require('tape')
const d3s = require('d3-selection')
import { hg38, hg19 } from '../../test/testdata/genomes'

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
		const holder = getHolder()

		initGenesetEdit({ holder, genome: hg38, callback: printGenes })
		const button = holder.select('button[name="msigdbBt"]')
		test.true(!button.empty(), `Should show MSigDB button for the hg38 genome`)
	}

	function testHG19() {
		const holder = getHolder()
		const vocabApi = { geneAPI: { mode: 'expression', getTopGenes: () => hg19.geneset[0].lst } } //Fake vocab api returning  some genes
		initGenesetEdit({
			holder,
			genome: hg19,
			callback: printGenes,
			geneList: vocabApi.geneAPI.getTopGenes(),
			mode: 'expression'
		})
		const button = holder.select('button[name="msigdbBt"]')
		test.true(button.empty(), `Should not show MSigDB button for the hg19 genome`)
	}

	function printGenes(geneList) {
		console.log('Genes submitted')
		for (const gene of geneList) console.log(gene.name)
	}
})
