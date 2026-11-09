import tape from 'tape'
import { computeBlockModeFlag } from '../GB.ts'
import { getBlockState } from '../interactions/Interactions.ts'
import { View } from '../view/View.ts'
import { TabsRenderer } from '../view/TabsRenderer.ts'
import * as d3s from 'd3-selection'
import { makeJunctionTerm } from '../../../j2/render.js'
import { getParameter } from '../../../j2/tk.js'

/* 
Tests:

computeBlockModeFlag()
*/

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- plots/genomeBrowser -***-')
	test.end()
})

const config: any = {
	geneSearchResult: {}
}

const vocabApi: any = {
	termdbConfig: {
		queries: {
			//gbRestrictMode
		}
	}
}

tape('computeBlockModeFlag()', test => {
	// MUST delete flag before every of following test
	delete config.blockIsProteinMode
	computeBlockModeFlag(config, vocabApi)
	test.equal(config.blockIsProteinMode, false, 'no gbRestrictMode, no geneSearchResult, auto set to false')

	delete config.blockIsProteinMode
	config.geneSearchResult.geneSymbol = 'xx'
	computeBlockModeFlag(config, vocabApi)
	test.equal(config.blockIsProteinMode, true, 'no gbRestrictMode, has gene symbol, auto set to true')

	delete config.blockIsProteinMode
	vocabApi.termdbConfig.queries.gbRestrictMode = 'protein'
	computeBlockModeFlag(config, vocabApi)
	test.equal(config.blockIsProteinMode, true, 'gbRestrictMode=protein, auto set to true')

	delete config.blockIsProteinMode
	vocabApi.termdbConfig.queries.gbRestrictMode = 'genomic'
	computeBlockModeFlag(config, vocabApi)
	test.equal(config.blockIsProteinMode, false, 'gbRestrictMode=genomic, auto set to false')

	delete config.blockIsProteinMode
	vocabApi.termdbConfig.queries.gbRestrictMode = 'invalid'
	test.throws(
		function () {
			computeBlockModeFlag(config, vocabApi)
		},
		/unknown gbRestrictMode/,
		'throws on unknown gbRestrictMode'
	)

	test.end()
})

tape('getBlockState()', test => {
	const blockInstance: any = {
		rglst: [
			{
				chr: 'chr1',
				bstart: 0,
				bstop: 1000,
				start: 10,
				stop: 100,
				width: 250,
				reverse: true,
				unused: 'skip'
			},
			{ chr: 'chr2', start: 20, stop: 200 }
		],
		startidx: 0,
		stopidx: 1,
		regionspace: 10,
		gmmode: 'genomic',
		coord: { reverse: false }
	}
	const state = getBlockState(blockInstance, [{ chr: 'chr3', start: 30, stop: 300 }])
	test.deepEqual(
		state,
		{
			rglst: [
				{ chr: 'chr1', start: 10, stop: 100, bstart: 0, bstop: 1000, width: 250, reverse: true },
				{ chr: 'chr2', start: 20, stop: 200 }
			],
			startidx: 0,
			stopidx: 1,
			regionspace: 10,
			gmmode: 'genomic',
			coordReverse: false
		},
		'copies serializable block range state'
	)

	test.deepEqual(
		getBlockState(null, [{ chr: 'chr3', start: 30, stop: 300 }]),
		{ rglst: [{ chr: 'chr3', start: 30, stop: 300 }] },
		'falls back to callback rglst'
	)

	test.equal(getBlockState(null, []), null, 'returns null without rglst')
	test.end()
})

tape('junction details support', async test => {
	const app = { dispatch() {} }
	const view = new View(
		{ config: { junction: { shown: true } }, vocab: { dslabel: 'test-dataset' } },
		null,
		null,
		{},
		{ app, vocabApi: { termdbConfig: { queries: { junction: {} } } } },
		{},
		[]
	)
	const tracks = await view.generateTracks()
	test.equal(tracks[0].massApp, app, 'marks a junction track with its genome-browser app')
	test.deepEqual(
		makeJunctionTerm({ chr: 'chr1', start: 99, stop: 200, strand: '+', info: { canonical: true } }),
		{
			type: 'junction',
			id: 'chr1:99-200:+',
			name: 'chr1:100-201 (+)',
			chr: 'chr1',
			start: 99,
			stop: 200,
			strand: '+',
			info: { canonical: true }
		},
		'creates a numeric junction term from track data'
	)
	test.end()
})

tape('junction track request sample types', test => {
	const block = { genome: { name: 'hg38' }, tkarg_rglst: () => [], subpanels: [], regionspace: 0 }
	const tk: any = { dslabel: 'test-dataset', subpanels: [] }
	test.notOk('sampleTypes' in getParameter(tk, block)[0], 'should send no sample types when none were chosen')
	tk.sampleTypes = [2]
	test.deepEqual(getParameter(tk, block)[0].sampleTypes, [2], 'should send the sample types chosen for the track')
	test.end()
})

const sampleTypeConfig = {
	sampleTypes: {
		1: { name: 'Patient', plural_name: 'patients', parent_id: null },
		2: { name: 'Diagnosis', plural_name: 'diagnosis samples', parent_id: 1 },
		3: { name: 'Relapse', plural_name: 'relapse samples', parent_id: 1 }
	},
	queries: {}
}

tape('sample type row of the genome browser', test => {
	const choices: any[] = []
	const interactions = { setSampleTypes: c => choices.push(c) }
	const draw = (sampleTypes?: number[], termdbConfig: any = sampleTypeConfig) => {
		const sampleTypeDiv: any = d3s.select('body').append('div')
		const state = { config: { sampleTypes } }
		new View(state, null, {}, { sampleTypeDiv }, { vocabApi: { termdbConfig } }, interactions).mayRenderSampleTypes()
		return { sampleTypeDiv, boxes: sampleTypeDiv.selectAll('input[type=checkbox]').nodes() as HTMLInputElement[] }
	}

	const first = draw()
	test.equal(first.boxes.length, 2, 'should draw a checkbox for each sample type with a parent, not for patients')
	test.deepEqual(
		first.boxes.map(b => b.checked),
		[true, true],
		'should check every sample type when none is chosen'
	)
	first.boxes[1].click()
	test.deepEqual(choices[0], [2], 'should dispatch the ids of the checked sample types')

	const again = draw(choices[0])
	test.deepEqual(
		again.boxes.map(b => b.checked),
		[true, false],
		'should check the boxes of the chosen ids, e.g. from a state change'
	)
	again.boxes[1].click()
	test.equal(choices[1], null, 'should dispatch null when every sample type is checked')

	const one = draw(undefined, {
		sampleTypes: { 1: sampleTypeConfig.sampleTypes[1], 2: sampleTypeConfig.sampleTypes[2] }
	})
	test.equal(one.boxes.length, 0, 'should draw no row for a dataset of one sample type with a parent')

	if (test['_ok']) for (const d of [first, again, one]) d.sampleTypeDiv.remove()
	test.end()
})

tape('every track reads the sample types of the genome browser', async test => {
	const getTracks = async (sampleTypes?: number[]) => {
		const state = {
			config: { sampleTypes, snvindel: { shown: true }, junction: { shown: true } },
			vocab: { dslabel: 'ds' }
		}
		const view = new View(state, null, null, {}, { vocabApi: { termdbConfig: sampleTypeConfig } }, {})
		const tklst = await view.generateTracks()
		return { mds3: tklst.find(t => t.type == 'mds3'), j2: tklst.find(t => t.type == 'j2') }
	}
	const { mds3, j2 } = await getTracks([2])
	test.deepEqual(mds3.sampleTypes, [2], 'should read the chosen sample types on the mutation track')
	test.deepEqual(j2.sampleTypes, [2], 'should read them on the splice junction track')
	test.equal(j2.sampleTypeLabel, 'diagnosis samples', 'should name them, for the junction terms of Details and Select')
	test.notOk('sampleTypes' in (await getTracks([2, 3])).j2, 'should read every sample for every sample type')
	test.notOk('sampleTypes' in (await getTracks()).mds3, 'should read every sample when none is chosen')
	test.deepEqual(
		(await getTracks([2, 9])).j2.sampleTypes,
		[2],
		'should read only the sample types the browser offers, of those a launcher set'
	)
	test.end()
})

tape('opening tab', async test => {
	const draw = async (activeTab?: string) => {
		const tabsDiv: any = d3s.select('body').append('div')
		const config = { snvindel: { shown: true }, junction: { shown: true }, activeTab }
		const opts = { vocabApi: { termdbConfig: { queries: { junction: {} } } } }
		await new TabsRenderer({ config }, { tabsDiv }, opts, {}).main()
		return tabsDiv
	}
	const active = div => div.select('button.sjpp-active').datum()?.label

	const plain = await draw()
	test.equal(active(plain), 'Mutation', 'should open at the first shown tab by default')
	const junction = await draw('Splice Junction')
	test.equal(active(junction), 'Splice Junction', 'should open at the tab named by config.activeTab')

	if (test['_ok']) for (const d of [plain, junction]) d.remove()
	test.end()
})

tape('a track shown again goes back to its place', async test => {
	const block = {
		tklst: [
			{ type: 'mds3', dslabel: 'ds' },
			{ type: 'bedj', name: 'RefGene' }
		],
		block_addtk_template(tk) {
			const t = { ...tk }
			this.tklst.push(t)
			return t
		},
		tk_load() {}
	}
	const state = { config: {}, vocab: { dslabel: 'ds' } }
	const view = new View(state, block, {}, {}, { vocabApi: { termdbConfig: {} } }, {})
	const order = () => block.tklst.map((t: any) => t.name || t.type)

	await view.launchBlockWithTracks([
		{ type: 'mds3', dslabel: 'ds' },
		{ type: 'j2', dslabel: 'ds' }
	])
	test.deepEqual(order(), ['mds3', 'j2', 'RefGene'], 'should put the junction track back under the mutation track')

	block.tklst = [{ type: 'bedj', name: 'RefGene' }]
	await view.launchBlockWithTracks([{ type: 'j2', dslabel: 'ds' }])
	test.deepEqual(order(), ['j2', 'RefGene'], 'should put a track with none above it first')
	test.end()
})
