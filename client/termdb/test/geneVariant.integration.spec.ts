import tape from 'tape'
import * as d3s from 'd3-selection'
import { SearchHandler } from '../handlers/geneVariant.ts'
import { hg38 } from '../../test/testdata/genomes'
import { sleep } from '../../test/test.helpers.js'
import { vocabInit } from '../vocabulary'

/*
Tests:
	Search handler layout
    Single gene input
    Change mutation type
    Gene set input
*/

/*************************
 reusable helper functions
**************************/

async function getVocabApi() {
	const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
	if (!vocabApi) throw 'vocabApi is missing'
	await vocabApi.getTermdbConfig()
	return vocabApi
}

const vocabApi: any = await getVocabApi()

const handler = new SearchHandler()

function getHolder() {
	const holder = d3s.select('body').append('div')
	return holder
}

function initializeSearchHandler(opts) {
	const callback = opts.callback || (() => {})
	handler.init({
		holder: opts.holder,
		app: { vocabApi },
		genomeObj: hg38,
		callback
	})
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- geneVariant search handler -***-')
	test.end()
})

tape('Search handler layout', test => {
	const holder = getHolder()
	initializeSearchHandler({ holder })
	const mutationTypeRadiosDiv = holder.select('#mutationTypeRadiosDiv')
	test.ok(
		mutationTypeRadiosDiv.selectAll('input[type="radio"]').size() > 0,
		'Mutation type radio buttons should be present'
	)
	const inputTypeRadiosDiv = holder.select('#inputTypeRadiosDiv')
	test.ok(inputTypeRadiosDiv.selectAll('input[type="radio"]').size() > 0, 'Input type radio buttons should be present')
	const searchDiv = holder.select('#geneSearchDiv')
	test.equal(searchDiv.selectAll('input[type="text"]').size(), 1, 'Gene search input should be present')
	test.end()
})

tape('Single gene input', async test => {
	let tw
	const callback = _tw => {
		tw = _tw
	}
	const holder = getHolder()
	initializeSearchHandler({ holder, callback })
	const geneSearchInput: any = holder.select('#geneSearchDiv').select('input[type="text"]').node()
	// gene name input
	geneSearchInput.value = 'TP53'
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(100)
	test.equal(tw.term.type, 'geneVariant', 'term.type should be geneVariant')
	test.equal(tw.q.type, 'predefined-groupset', 'q.type should be predefined-groupset')
	test.equal(tw.q.predefined_groupset_idx, 0, 'q.predefined_groupset_idx should be 0')
	test.equal(tw.term.genes.length, 1, 'term.genes[] should have length of 1')
	test.deepEqual(
		tw.term.genes[0],
		{ kind: 'gene', id: 'TP53', gene: 'TP53', name: 'TP53', type: 'geneVariant' },
		'term.genes[0] should have expected structure'
	)
	test.end()
})

tape('Change mutation type', async test => {
	let tw
	const callback = _tw => {
		tw = _tw
	}
	const holder = getHolder()
	initializeSearchHandler({ holder, callback })
	const mutationTypeRadiosDiv = holder.select('#mutationTypeRadiosDiv')
	const mutationTypeRadios = mutationTypeRadiosDiv.selectAll('input[type="radio"]')
	const thirdRadio: any = mutationTypeRadios.nodes()[2]
	thirdRadio.click()
	const geneSearchInput: any = holder.select('#geneSearchDiv').select('input[type="text"]').node()
	geneSearchInput.value = 'TP53'
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(100)
	test.equal(tw.q.predefined_groupset_idx, 2, 'q.predefined_groupset_idx should be 2 upon selecting third radio button')
})

tape('Gene set input', async test => {
	let tw
	const callback = _tw => {
		tw = _tw
	}
	const holder = getHolder()
	initializeSearchHandler({ holder, callback })
	const inputTypeRadiosDiv = holder.select('#inputTypeRadiosDiv')
	const inputTypeRadios = inputTypeRadiosDiv.selectAll('input[type="radio"]')
	const secondRadio: any = inputTypeRadios.nodes()[1]
	secondRadio.click()
	const geneSearchInput: any = holder.select('#geneSearchDiv').select('input[type="text"]').node()
	geneSearchInput.value = 'TP53'
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	geneSearchInput.value = 'KRAS'
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	const buttons = holder.select('#geneSearchDiv').selectAll('button').nodes()
	const submitButton: any = buttons.find((btn: any) => btn.textContent.trim() === 'Submit')
	await sleep(100) // wait until submit button is enabled
	submitButton.click()
	await sleep(100) // wait until tw is populated
	test.equal(tw.term.genes.length, 2, 'term.genes[] should have length of 2')
	test.equal(tw.term.name, 'KRAS, TP53', 'term.name should concatenate gene names')
})
