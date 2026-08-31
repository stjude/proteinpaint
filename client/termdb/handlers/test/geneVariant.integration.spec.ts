import tape from 'tape'
import * as d3s from 'd3-selection'
import { SearchHandler } from '../geneVariant.ts'
import { dtcnv, dtsnvindel } from '#shared/common.js'
import { hg38 } from '../../../test/testdata/genomes'
import { sleep } from '../../../test/test.helpers.js'
import { vocabInit } from '../../vocabulary'

/*
Tests:
	Search handler layout
    Single gene input
    Change mutation type
    Gene set input
	Gene set input - custom name
	Remembered settings are offered for the picked gene
	Remembered settings are applied on Enter
	Remembered settings of another mutation type do not lead
	Remembered settings are cleared on changing the mutation type
	Remembered settings are cleared on changing the input type
	Remembered settings are not offered where the q would be dropped
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

function getHolder() {
	const holder = d3s.select('body').append('div')
	return holder
}

async function initializeSearchHandler(opts) {
	const handler = new SearchHandler()
	const callback = opts.callback || (() => {})
	await handler.init({
		holder: opts.holder,
		app: { vocabApi: opts.vocabApi || vocabApi },
		genomeObj: hg38,
		keepsQ: opts.keepsQ,
		msg: opts.msg,
		callback
	})
	return handler
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- geneVariant search handler -***-')
	test.end()
})

tape('Search handler layout', async test => {
	const holder = getHolder()
	await initializeSearchHandler({ holder })
	const mutationTypeRadiosDiv = holder.select('[data-testid="sjpp-genevariant-mutationTypeRadios"]')
	test.ok(
		mutationTypeRadiosDiv.selectAll('input[type="radio"]').size() > 0,
		'Mutation type radio buttons should be present'
	)
	const inputTypeRadiosDiv = holder.select('[data-testid="sjpp-genevariant-genesetTypeRadios"]')
	test.equal(
		inputTypeRadiosDiv.selectAll('input[type="radio"]').size(),
		2,
		'Input type radio buttons should be present'
	)
	const searchDiv = holder.select('[data-testid="sjpp-genevariant-geneSearchDiv"]')
	test.equal(searchDiv.selectAll('input[type="search"]').size(), 1, 'Gene search input should be present')
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Single gene input', async test => {
	let tw
	const callback = _tw => {
		tw = _tw
	}
	const holder = getHolder()
	await initializeSearchHandler({ holder, callback })
	const geneSearchInput: any = holder
		.select('[data-testid="sjpp-genevariant-geneSearchDiv"]')
		.select('input[type="search"]')
		.node()
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
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Change mutation type', async test => {
	let tw
	const callback = _tw => {
		tw = _tw
	}
	const holder = getHolder()
	await initializeSearchHandler({ holder, callback })
	const mutationTypeRadiosDiv = holder.select('[data-testid="sjpp-genevariant-mutationTypeRadios"]')
	const mutationTypeRadios = mutationTypeRadiosDiv.selectAll('input[type="radio"]')
	// select CNV mutation type
	const thirdRadio: any = mutationTypeRadios.nodes()[2]
	thirdRadio.click()
	// verify gene set option is hidden for CNV
	const inputTypeRadiosDiv = holder.select('[data-testid="sjpp-genevariant-genesetTypeRadios"]')
	const geneSetDiv = inputTypeRadiosDiv.selectAll('div').filter((d: any) => d.value == 'geneset')
	test.equal(geneSetDiv.style('display'), 'none', 'Gene set option should be hidden for CNV')
	// enter gene to search
	const geneSearchInput: any = holder
		.select('[data-testid="sjpp-genevariant-geneSearchDiv"]')
		.select('input[type="search"]')
		.node()
	geneSearchInput.value = 'TP53'
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(100)
	test.equal(tw.q.predefined_groupset_idx, 2, 'q.predefined_groupset_idx should be 2 upon selecting third radio button')
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Gene set input', async test => {
	let tw
	const callback = _tw => {
		tw = _tw
	}
	const holder = getHolder()
	await initializeSearchHandler({ holder, callback })
	const inputTypeRadiosDiv = holder.select('[data-testid="sjpp-genevariant-genesetTypeRadios"]')
	const inputTypeRadios = inputTypeRadiosDiv.selectAll('input[type="radio"]')
	const secondRadio: any = inputTypeRadios.nodes()[1]
	secondRadio.click()
	const geneSearchInput: any = holder
		.select('[data-testid="sjpp-genevariant-geneSearchDiv"]')
		.select('input[type="search"]')
		.node()
	geneSearchInput.value = 'TP53'
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(100) // wait for dispatch event
	geneSearchInput.value = 'KRAS'
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	const buttons = holder.select('[data-testid="sjpp-genevariant-geneSearchDiv"]').selectAll('button').nodes()
	const submitButton: any = buttons.find((btn: any) => btn.textContent.trim() === 'Submit')
	await sleep(100) // wait until submit button is enabled
	submitButton.click()
	await sleep(100) // wait until tw is populated
	test.equal(tw.term.genes.length, 2, 'term.genes[] should have length of 2')
	test.equal(tw.term.name, 'TP53, KRAS', 'term.name should concatenate gene names')
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Gene set input - custom name', async test => {
	let tw
	const callback = _tw => {
		tw = _tw
	}
	const holder = getHolder()
	await initializeSearchHandler({ holder, callback })
	const inputTypeRadiosDiv = holder.select('[data-testid="sjpp-genevariant-genesetTypeRadios"]')
	const inputTypeRadios = inputTypeRadiosDiv.selectAll('input[type="radio"]')
	const secondRadio: any = inputTypeRadios.nodes()[1]
	secondRadio.click()
	const geneSearchInput: any = holder
		.select('[data-testid="sjpp-genevariant-geneSearchDiv"]')
		.select('input[type="search"]')
		.node()
	geneSearchInput.value = 'TP53'
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(100) // wait for dispatch event
	geneSearchInput.value = 'KRAS'
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(100) // wait for dispatch event
	const nameInput: any = holder.select('[data-testid="sja_genesetinput_name"]').node()
	nameInput.value = 'Test gene set'
	const buttons = holder.select('[data-testid="sjpp-genevariant-geneSearchDiv"]').selectAll('button').nodes()
	const submitButton: any = buttons.find((btn: any) => btn.textContent.trim() === 'Submit')
	await sleep(100) // wait until submit button is enabled
	submitButton.click()
	await sleep(100) // wait until tw is populated
	test.equal(tw.term.genes.length, 2, 'term.genes[] should have length of 2')
	test.equal(tw.term.name, 'Test gene set', 'term.name should be custom name')
	if (test['_ok']) holder.remove()
	test.end()
})

/* the settings a mass store remembers for a gene, see remember_gvq() in client/mass/store.ts.
Supplied through a derived vocabApi, so that the shared one is left alone */
function getVocabApiWithRememberedQ(lst) {
	return Object.assign(Object.create(vocabApi), { getGvQLst: () => structuredClone(lst) })
}

function getVocabApiWithSampleTypes() {
	const termdbConfig = structuredClone(vocabApi.termdbConfig)
	termdbConfig.sampleTypes = {
		1: { name: 'Primary' },
		2: { name: 'Relapse' }
	}
	termdbConfig.assayAvailability ??= { byDt: {} }
	termdbConfig.assayAvailability.byDt ??= {}
	termdbConfig.assayAvailability.byDt[dtsnvindel] = {
		...termdbConfig.assayAvailability.byDt[dtsnvindel],
		bySampleType: { 1: { hasSamples: true }, 2: { hasSamples: true } }
	}
	termdbConfig.assayAvailability.byDt[dtcnv] = {
		...termdbConfig.assayAvailability.byDt[dtcnv],
		bySampleType: { 1: { hasSamples: true } }
	}
	return Object.assign(Object.create(vocabApi), { termdbConfig })
}

tape('Sample types are derived from current assay availability', async test => {
	const holder = getHolder()
	const handler = await initializeSearchHandler({ holder, vocabApi: getVocabApiWithSampleTypes() })
	test.deepEqual(handler.getQuerySampleTypes(), [1, 2], 'should return available SNV/indel sample types')

	delete handler.opts.app.vocabApi.termdbConfig.assayAvailability.byDt[dtsnvindel].bySampleType
	test.deepEqual(handler.getQuerySampleTypes(), [], 'should not retain sample types after availability is removed')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Sample type selection is cleared when changing to a mutation type without a selector', async test => {
	let tw
	const holder = getHolder()
	await initializeSearchHandler({
		holder,
		callback: _tw => (tw = _tw),
		vocabApi: getVocabApiWithSampleTypes()
	})
	const sampleTypeCheckboxes: any = holder.selectAll('.sjpp-genesearch-sampletype-checkboxes input')
	test.equal(sampleTypeCheckboxes.size(), 2, 'should render sample type choices for SNV/indel')
	sampleTypeCheckboxes.nodes()[1].checked = true
	await pickGene(holder)
	test.deepEqual(tw.term.sampleTypes, [2], 'should submit the selected sample type')

	const cnvRadio: any = holder
		.select('[data-testid="sjpp-genevariant-mutationTypeRadios"]')
		.selectAll('input[type="radio"]')
		.nodes()[2]
	cnvRadio.click()
	test.equal(
		holder.selectAll('.sjpp-genesearch-sampletype-checkboxes input').size(),
		0,
		'should remove stale sample type choices'
	)
	await pickGene(holder, 'KRAS')
	test.deepEqual(tw.term.sampleTypes, [1], 'should carry the only available CNV sample type')

	if (test['_ok']) holder.remove()
	test.end()
})

/* The initial selection writes sampleTypes to the handler term. A remembered setting on the
next selection exercises the "Continue with ..." path, which must replace those values. */
tape('Continuing past remembered settings does not retain sample types from another mutation type', async test => {
	let tw
	const holder: any = getHolder()
	const sampleTypeVocabApi = getVocabApiWithSampleTypes()
	const vocabApiWithRememberedKrasQ = Object.assign(Object.create(sampleTypeVocabApi), {
		getGvQLst: (term: any) => (term.name == 'KRAS' ? structuredClone(rememberedLst) : [])
	})
	await initializeSearchHandler({
		holder,
		callback: _tw => (tw = _tw),
		vocabApi: vocabApiWithRememberedKrasQ,
		keepsQ: true
	})
	holder.selectAll('.sjpp-genesearch-sampletype-checkboxes input').nodes()[1].checked = true
	await pickGene(holder)
	test.deepEqual(tw.term.sampleTypes, [2], 'should submit the selected SNV/indel sample type')

	const cnvRadio: any = holder
		.select('[data-testid="sjpp-genevariant-mutationTypeRadios"]')
		.selectAll('input[type="radio"]')
		.nodes()[2]
	cnvRadio.click()
	await pickGene(holder, 'KRAS')
	const continueWithCnv: any = holder.selectAll('.sja_menuoption').nodes()[0]
	continueWithCnv.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	await sleep(100)
	test.deepEqual(tw.term.sampleTypes, [1], 'should not retain the prior SNV/indel sample type')

	if (test['_ok']) holder.remove()
	test.end()
})

/* a grouping of the first mutation type of this dataset, SNV/indel (somatic), as it is
remembered: a customset whose group filter carries the dt term of each tvs */
function getRememberedQ(name) {
	return {
		type: 'custom-groupset',
		customset: {
			groups: [
				{
					name,
					filter: {
						type: 'tvslst',
						join: '',
						in: true,
						lst: [{ type: 'tvs', tvs: { term: { id: 'snvindel_somatic', dt: dtsnvindel, origin: 'somatic' } } }]
					}
				}
			]
		}
	}
}

const rememberedLst = [
	{ label: 'TP53 missense', q: getRememberedQ('TP53 missense') },
	{ label: 'TP53 truncating', q: getRememberedQ('TP53 truncating') }
]

async function pickGene(holder, gene = 'TP53') {
	const geneSearchInput: any = holder
		.select('[data-testid="sjpp-genevariant-geneSearchDiv"]')
		.select('input[type="search"]')
		.node()
	geneSearchInput.value = gene
	geneSearchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }))
	await sleep(100)
}

tape('Remembered settings are offered for the picked gene', async test => {
	let tw
	const holder = getHolder()
	await initializeSearchHandler({
		holder,
		callback: _tw => (tw = _tw),
		vocabApi: getVocabApiWithRememberedQ(rememberedLst),
		keepsQ: true,
		// as client/plots/summarizeMutationSurvival.ts supplies it
		msg: 'Hit ENTER to launch plot.'
	})
	await pickGene(holder)

	test.equal(tw, undefined, 'should not apply the mutation type while the settings are offered')
	const msgDiv: any = holder
		.selectAll('div')
		.nodes()
		.find((n: any) => n.textContent == 'Hit ENTER to launch plot.')
	test.equal(msgDiv?.style.display, 'none', 'should hide a caller message that no longer describes what happens')
	const remembered = holder.selectAll('[data-testid="sjpp-genevariant-rememberedQ"]')
	test.equal(remembered.size(), 2, 'should offer both remembered settings')
	test.deepEqual(
		remembered.nodes().map((n: any) => n.textContent),
		['TP53 missense', 'TP53 truncating'],
		'should label each by its remembered label'
	)
	const options: any[] = holder.selectAll('.sja_menuoption').nodes()
	test.equal(options.length, 3, 'should offer a way to continue with the mutation type instead')
	test.ok(
		options.every((n: any) => n.getAttribute('tabindex') == '0'),
		'should make every option keyboard focusable'
	)
	test.equal(document.activeElement, options[0], 'should focus the most recent setting')

	// arrowing moves within the options and wraps, so focus cannot leave them by accident
	options[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
	test.equal(document.activeElement, options[1], 'should move focus down')
	options[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
	test.equal(document.activeElement, options[0], 'should move focus up')
	options[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
	test.equal(document.activeElement, options[2], 'should wrap to the last option')

	/* activating on keydown and not keyup: the gene above is picked by pressing Enter in the
	search box, whose keyup would otherwise land on the option focused here */
	options[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	await sleep(100)
	test.equal(tw?.q?.type, 'predefined-groupset', 'should continue with the mutation type on Enter')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Remembered settings are applied on Enter', async test => {
	let tw
	const holder = getHolder()
	await initializeSearchHandler({
		holder,
		callback: _tw => (tw = _tw),
		vocabApi: getVocabApiWithRememberedQ(rememberedLst),
		keepsQ: true
	})
	await pickGene(holder)

	const first: any = holder.selectAll('[data-testid="sjpp-genevariant-rememberedQ"]').nodes()[0]
	first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	await sleep(100)
	test.equal(tw.q.type, 'custom-groupset', 'should apply the remembered q')
	test.deepEqual(
		tw.q.customset.groups.map((g: any) => g.name),
		['TP53 missense'],
		'should apply the groups of the setting that was focused'
	)
	test.equal(tw.term.name, 'TP53', 'should apply it to the gene that was picked')
	test.equal(
		holder.select('[data-testid="sjpp-genevariant-rememberedQ"]').empty(),
		true,
		'should clear the offered settings once one is applied'
	)
	if (test['_ok']) holder.remove()
	test.end()
})

tape('Applying remembered settings applies the selected sample type', async test => {
	let tw
	const holder: any = getHolder()
	const sampleTypeVocabApi = getVocabApiWithSampleTypes()
	await initializeSearchHandler({
		holder,
		callback: _tw => (tw = _tw),
		vocabApi: Object.assign(Object.create(sampleTypeVocabApi), {
			getGvQLst: () => structuredClone(rememberedLst)
		}),
		keepsQ: true
	})
	holder.selectAll('.sjpp-genesearch-sampletype-checkboxes input').nodes()[1].checked = true
	await pickGene(holder)

	const first: any = holder.selectAll('[data-testid="sjpp-genevariant-rememberedQ"]').nodes()[0]
	first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	await sleep(100)
	test.deepEqual(tw.term.sampleTypes, [2], 'should apply the selected sample type with the remembered q')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Remembered settings of another mutation type do not lead', async test => {
	let tw
	const holder = getHolder()
	await initializeSearchHandler({
		holder,
		callback: _tw => (tw = _tw),
		vocabApi: getVocabApiWithRememberedQ(rememberedLst),
		keepsQ: true
	})
	// the settings above group SNV/indel (somatic) variants, so select CNV instead
	const cnvRadio: any = holder
		.select('[data-testid="sjpp-genevariant-mutationTypeRadios"]')
		.selectAll('input[type="radio"]')
		.nodes()[2]
	cnvRadio.click()
	await pickGene(holder)

	const options: any[] = holder.selectAll('.sja_menuoption').nodes()
	test.deepEqual(
		options.map((n: any) => n.textContent),
		['Continue with CNV', 'TP53 missense', 'TP53 truncating'],
		'should lead with the selected mutation type, followed by the settings of other mutation types'
	)
	test.equal(document.activeElement, options[0], 'should focus the way to continue with the mutation type')

	options[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
	await sleep(100)
	test.equal(tw?.q?.predefined_groupset_idx, 2, 'should continue with the selected mutation type on Enter')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Remembered settings are cleared on changing the mutation type', async test => {
	let tw
	const holder = getHolder()
	await initializeSearchHandler({
		holder,
		callback: _tw => (tw = _tw),
		vocabApi: getVocabApiWithRememberedQ(rememberedLst),
		keepsQ: true,
		msg: 'Hit ENTER to launch plot.'
	})
	await pickGene(holder)
	test.equal(holder.selectAll('.sja_menuoption').size(), 3, 'should offer the settings of the picked gene')

	// the options were offered against the mutation type selected above, so they no longer apply
	const cnvRadio: any = holder
		.select('[data-testid="sjpp-genevariant-mutationTypeRadios"]')
		.selectAll('input[type="radio"]')
		.nodes()[2]
	cnvRadio.click()
	await sleep(100)

	test.equal(holder.selectAll('.sja_menuoption').size(), 0, 'should clear the offered settings')
	test.equal(tw, undefined, 'should not apply anything on its own')
	const msgDiv: any = holder
		.selectAll('div')
		.nodes()
		.find((n: any) => n.textContent == 'Hit ENTER to launch plot.')
	test.equal(msgDiv?.style.display, 'block', 'should put back the caller message that describes picking a gene again')

	// the gene is picked again, now against the mutation type that was just selected
	await pickGene(holder)
	const options: any[] = holder.selectAll('.sja_menuoption').nodes()
	test.equal(
		options[0]?.textContent,
		'Continue with CNV',
		'should offer the settings against the mutation type now selected'
	)

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Remembered settings are cleared on changing the input type', async test => {
	let tw
	const holder = getHolder()
	await initializeSearchHandler({
		holder,
		callback: _tw => (tw = _tw),
		vocabApi: getVocabApiWithRememberedQ(rememberedLst),
		keepsQ: true
	})
	await pickGene(holder)
	test.equal(holder.selectAll('.sja_menuoption').size(), 3, 'should offer the settings of the picked gene')

	// the gene input is rebuilt empty, so the settings offered for the gene it held no longer apply
	const geneSetRadio: any = holder
		.select('[data-testid="sjpp-genevariant-genesetTypeRadios"]')
		.selectAll('input[type="radio"]')
		.nodes()[1]
	geneSetRadio.click()
	await sleep(100)

	test.equal(holder.selectAll('.sja_menuoption').size(), 0, 'should clear the offered settings')
	test.equal(tw, undefined, 'should not apply anything on its own')

	if (test['_ok']) holder.remove()
	test.end()
})

tape('Remembered settings are not offered where the q would be dropped', async test => {
	let tw
	const holder = getHolder()
	// a consumer that keeps only the term{}, see keepsQ in client/termdb/TermTypeSearch.ts
	await initializeSearchHandler({
		holder,
		callback: _tw => (tw = _tw),
		vocabApi: getVocabApiWithRememberedQ(rememberedLst)
	})
	await pickGene(holder)

	test.equal(
		holder.select('[data-testid="sjpp-genevariant-rememberedQ"]').empty(),
		true,
		'should offer no remembered setting'
	)
	test.equal(tw.q.type, 'predefined-groupset', 'should apply the mutation type directly')
	if (test['_ok']) holder.remove()
	test.end()
})
