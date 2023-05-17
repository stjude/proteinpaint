import { initGenesetSearch } from '../genesetSearch'
const helpers = require('../../test/front.helpers.js')
const tape = require('tape')
const d3s = require('d3-selection')

function getHolder() {
	return d3s.select('body').append('div')
}

const hg38 = {
	species: 'human',
	name: 'hg38',
	hasSNP: true,
	hasIdeogram: false,
	hasClinvarVCF: true,
	fimo_motif: true,
	blat: false,
	termdbs: { msigdb: { label: 'MSigDB' } }
}

const hg19 = {
	species: 'human',
	name: 'hg19',
	hasSNP: true,
	hasIdeogram: false,
	hasClinvarVCF: true,
	fimo_motif: true,
	blat: false,
	geneset: [
		{
			name: 'Signaling',
			lst: [
				{ name: 'NRAS' },
				{ name: 'FLT3' },
				{ name: 'KRAS' },
				{ name: 'JAK3' },
				{ name: 'BRAF' },
				{ name: 'NF1' },
				{ name: 'MAPK1' }
			]
		},
		{ name: 'Cell cycle', lst: [{ name: 'TP53' }, { name: 'RB1' }, { name: 'CDKN2A' }, { name: 'CDKN2B' }] },
		{
			name: 'Epigenetics',
			lst: [
				{ name: 'ATRX' },
				{ name: 'BCOR' },
				{ name: 'MYC' },
				{ name: 'MYCN' },
				{ name: 'WHSC1' },
				{ name: 'SUZ12' },
				{ name: 'EED' },
				{ name: 'EZH2' },
				{ name: 'SETD2' },
				{ name: 'CREBBP' },
				{ name: 'EHMT2' },
				{ name: 'PRDM1' },
				{ name: 'NSD1' },
				{ name: 'KMT2D' },
				{ name: 'UBR4' },
				{ name: 'ARID1A' },
				{ name: 'EP300' }
			]
		},
		{
			name: 'Development',
			lst: [
				{ name: 'RUNX1' },
				{ name: 'ETV6' },
				{ name: 'GATA3' },
				{ name: 'IKZF1' },
				{ name: 'EP300' },
				{ name: 'IKZF2' },
				{ name: 'IKZF3' },
				{ name: 'PAX5' },
				{ name: 'VPREB1' },
				{ name: 'EBF1' }
			]
		}
	]
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

	runTests()

	function runTests() {
		testHG38()
		testHG19()
		test.end()

		function testHG38() {
			const holder = getHolder()

			initGenesetSearch({ holder, genome: hg38, callback: console.log })
			const button = holder.select('button[name="msigdbBt"]')
			test.true(!button.empty(), `Should show MSigDB button for the hg38 genome`)
		}

		function testHG19() {
			const holder = getHolder()
			const vocabApi = { geneAPI: { mode: 'expression', getTopGenes: () => hg19.geneset[0].lst } } //Fake vocab api returning  some genes
			initGenesetSearch({
				holder,
				genome: hg19,
				callback: console.log,
				geneList: vocabApi.geneAPI.getTopGenes(),
				mode: 'expression'
			})
			const button = holder.select('button[name="msigdbBt"]')
			test.true(button.empty(), `Should not show MSigDB button for the hg19 genome`)
		}
	}
})
