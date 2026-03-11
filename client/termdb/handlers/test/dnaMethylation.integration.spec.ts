import tape from 'tape'
import * as d3s from 'd3-selection'
import { SearchHandler } from '../dnaMethylation.ts'
import { hg38 } from '../../../test/testdata/genomes'
import { sleep } from '../../../test/test.helpers.js'
import { vocabInit } from '../../vocabulary'
import { TermTypes } from '#shared/terms.js'

/*
Tests:
	Search handler layout
	Coordinate search
	Gene search
	Gene search with navigation
*/

/**************
 test sections
***************/

const vocabApi: any = await getVocabApi()
const handler = new SearchHandler()

tape('\n', function (test) {
	test.comment('-***- dnaMethylation search handler -***-')
	test.end()
})

tape('Search handler layout', async test => {
	const holder = getHolder()
	await initializeSearchHandler({ holder })
	const geneSearchInput = holder.select('.sja_genesearchinput').node()
	test.ok(geneSearchInput, 'should display gene search input')
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Coordinate search', async test => {
	let term
	const callback = _term => {
		term = _term
	}
	const holder = getHolder()
	await initializeSearchHandler({ holder, callback })
	const geneSearchInput: any = holder.select('.sja_genesearchinput').node()
	const chr = 'chr17'
	const start = 7661778
	const stop = 7687537
	const coord = `${chr}:${start}-${stop}`
	geneSearchInput.value = coord
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(100)
	test.equal(term.chr, chr, 'term.chr should equal input chr')
	test.equal(term.start, start, 'term.start should equal input start')
	test.equal(term.stop, stop, 'term.stop should equal input stop')
	test.equal(term.id, coord, 'term.id should equal input coord')
	const unit = vocabApi.termdbConfig.queries.dnaMethylation.unit
	const name = `${coord} ${unit}`
	test.equal(term.name, name, 'term.name should be <coord> <unit>')
	test.equal(term.type, TermTypes.DNA_METHYLATION, 'term.type should be dnaMethylation')
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Gene search', async test => {
	let term
	const callback = _term => {
		term = _term
	}
	const holder = getHolder()
	await initializeSearchHandler({ holder, callback })
	const geneSearchInput: any = holder.select('.sja_genesearchinput').node()
	const geneSymbol = 'TP53'
	geneSearchInput.value = geneSymbol
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(100)
	const blockSvg = holder.select('[data-testid="sjpp_block_svg"]').node()
	test.ok(blockSvg, 'should render block svg')
	const submitBtn: any = holder.select('[data-testid="sjpp-dnaMethylation-submitDiv"]').select('button').node()
	submitBtn.click()
	await sleep(100)
	test.equal(term.chr, 'chr17', 'term.chr should be TP53 chr')
	test.equal(term.start, 7661778, 'term.start should be TP53 start')
	test.equal(term.stop, 7687537, 'term.stop should be TP53 stop')
	const coord = 'chr17:7661778-7687537'
	test.equal(term.id, coord, 'term.id should equal input coord')
	const unit = vocabApi.termdbConfig.queries.dnaMethylation.unit
	const name = `${coord} ${unit}`
	test.equal(term.name, name, 'term.name should be <coord> <unit>')
	test.equal(term.type, TermTypes.DNA_METHYLATION, 'term.type should be dnaMethylation')
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Gene search with navigation', async test => {
	let term
	const callback = _term => {
		term = _term
	}
	const holder = getHolder()
	await initializeSearchHandler({ holder, callback })
	// search by gene symbol
	const geneSearchInput: any = holder.select('.sja_genesearchinput').node()
	const geneSymbol = 'TP53'
	geneSearchInput.value = geneSymbol
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(1000)
	// then navigate to 2kb region within gene
	const blockCoordInput: any = holder.select('.sja_Block_div').select('input').node()
	const chr = 'chr17'
	const start = 7682350
	const stop = 7684350
	const coord = `${chr}:${start}-${stop}`
	blockCoordInput.value = coord
	blockCoordInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(1000)
	const submitBtn: any = holder.select('[data-testid="sjpp-dnaMethylation-submitDiv"]').select('button').node()
	submitBtn.click()
	await sleep(100)
	// term coordinate should equal coordinate of target region
	// TODO: term.start and term.stop are actually different by 1bp compared
	// to input start and input stop, respectively. This is different behavior
	// than when inputting a coordinate into the gene search box outside of block (see the "Coordinate search" test section above). Should resolve this discrepancy.
	test.equal(term.chr, chr, 'term.chr should equal input chr')
	test.equal(term.start, 7682349, 'term.start should equal input start')
	test.equal(term.stop, 7684349, 'term.stop should equal input stop')
	const new_coord = 'chr17:7682349-7684349'
	test.equal(term.id, new_coord, 'term.id should equal input coord')
	const unit = vocabApi.termdbConfig.queries.dnaMethylation.unit
	const name = `${new_coord} ${unit}`
	test.equal(term.name, name, 'term.name should be <coord> <unit>')
	test.equal(term.type, TermTypes.DNA_METHYLATION, 'term.type should be dnaMethylation')
	if (test['_ok']) holder.remove()
	test.end()
})

/*************************
 reusable helper functions
**************************/

async function getVocabApi() {
	const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
	if (!vocabApi) throw 'vocabApi is missing'
	await vocabApi.getTermdbConfig()
	return vocabApi
}

function getHolder() {
	const holder = d3s.select('body').append('div')
	return holder
}

async function initializeSearchHandler(opts) {
	const callback = opts.callback || (() => {})
	const hg38_copy = structuredClone(hg38)
	hg38_copy.hasSNP = false // to allow coordinate input
	await handler.init({
		holder: opts.holder,
		app: { vocabApi },
		genomeObj: hg38_copy,
		callback
	})
}
