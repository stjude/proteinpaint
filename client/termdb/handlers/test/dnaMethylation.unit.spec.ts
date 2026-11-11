import tape from 'tape'
import { SearchHandler, embedRegionPicker, makeMethylationRegionTerm } from '../dnaMethylation.ts'

/* Tests
	SearchHandler.makeTerm()
	makeMethylationRegionTerm()   (shared with the mass omnisearch)
	embedRegionPicker()           (shared with the mass omnisearch; rendering is covered in the integration spec)
*/

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/dnaMethylation -***-')
	test.end()
})

function getHandler(dnaMethylation: any) {
	const handler = new SearchHandler()
	handler.app = {
		vocabApi: {
			termdbConfig: {
				queries: { dnaMethylation: { unit: 'Average M-value', ...dnaMethylation } },
				sampleTypes: {
					1: { plural_name: 'Primary tumors' },
					2: { plural_name: 'Relapses' }
				}
			}
		}
	} as any
	return handler
}
const region = { chr: 'chr17', start: 100, stop: 200 }

tape('makeTerm() assigns a single sample type without labelling it', test => {
	const term = getHandler({ sampleTypes: [1] }).makeTerm(region)
	test.deepEqual(term.sampleTypes, [1], 'Should assign the one available sample type')
	test.equal(term.sampleTypeLabel, '', 'Should use an empty label')
	test.equal(term.name, 'chr17:100-200 Average M-value', 'Should not add a sample type to the name')
	test.end()
})

tape('makeTerm() keeps a single sample type of a dataset with sample type terms', test => {
	const sampleTypesByTerms = { 'samples.event': { Baseline: [1] } }
	const term = getHandler({ sampleTypes: [1], sampleTypesByTerms }).makeTerm(region)
	test.deepEqual(term.sampleTypes, [1], 'Should assign the one available sample type')
	test.equal(term.sampleTypeLabel, '', 'Should use an empty label')
	test.end()
})

tape('makeTerm() names the selected sample-type subset', test => {
	const handler = getHandler({ sampleTypes: [1, 2] })
	handler.sampleTypeSelect = [
		{ property: key => (key == 'checked' ? false : 1) },
		{ property: key => (key == 'checked' ? true : 2) }
	] as any
	const term = handler.makeTerm(region)
	test.deepEqual(term.sampleTypes, [2], 'Should assign the selected sample types')
	test.equal(term.sampleTypeLabel, 'Relapses', 'Should label the selected subset')
	test.equal(term.id, undefined, 'Should leave the id to be filled as the region')
	test.equal(term.name, 'chr17:100-200 Average M-value (Relapses)', 'Should name the selected subset')
	test.end()
})

tape('makeMethylationRegionTerm() builds a region term without a SearchHandler', test => {
	const vocabApi = getHandler({ sampleTypes: [1] }).app.vocabApi
	const term = makeMethylationRegionTerm(undefined, vocabApi, region)
	test.deepEqual(term.sampleTypes, [1], 'Should assign the one available sample type')
	test.equal(term.name, 'chr17:100-200 Average M-value', 'Should name the region with the unit')
	test.equal(term.chr, region.chr, 'Should keep the region chr')
	test.equal(term.start, region.start, 'Should keep the region start')
	test.equal(term.stop, region.stop, 'Should keep the region stop')
	test.end()
})

tape('makeMethylationRegionTerm() names the selected sample-type subset', test => {
	const vocabApi = getHandler({ sampleTypes: [1, 2] }).app.vocabApi
	const sampleTypeSelect = [
		{ property: key => (key == 'checked' ? false : 1) },
		{ property: key => (key == 'checked' ? true : 2) }
	]
	const term = makeMethylationRegionTerm(sampleTypeSelect, vocabApi, region)
	test.deepEqual(term.sampleTypes, [2], 'Should assign the selected sample types')
	test.equal(term.name, 'chr17:100-200 Average M-value (Relapses)', 'Should name the selected subset')
	test.end()
})

tape('makeMethylationRegionTerm() returns nothing when no sample type is selected', test => {
	const vocabApi = getHandler({ sampleTypes: [1, 2] }).app.vocabApi
	const oldAlert = window.alert
	let alertMsg = ''
	window.alert = (msg: any) => {
		alertMsg = msg
	}
	const term = makeMethylationRegionTerm([{ property: key => (key == 'checked' ? false : 1) }], vocabApi, region)
	window.alert = oldAlert
	test.equal(term, undefined, 'Should not make a term')
	test.equal(alertMsg, 'Please select at least one sample type.', 'Should notify user to select sample type')
	test.end()
})

tape('embedRegionPicker() rejects an unresolved locus before rendering', async test => {
	const bad = [
		{ chr: '', start: 1, stop: 2 },
		{ chr: 'chr17', start: NaN, stop: 2 },
		{ chr: 'chr17', start: 1, stop: undefined }
	]
	for (const locus of bad) {
		let message = ''
		try {
			// holder is never touched: the locus is validated first
			await embedRegionPicker({ holder: {}, genomeObj: {}, onSubmit() {}, ...(locus as any) })
		} catch (e: any) {
			message = e.message
		}
		test.equal(message, 'unable to retrieve gene coordinate', `Should reject ${JSON.stringify(locus)}`)
	}
	test.end()
})

tape('makeTerm() returns nothing when no sample type is selected', test => {
	const handler = getHandler({ sampleTypes: [1, 2] })
	handler.sampleTypeSelect = [{ property: key => (key == 'checked' ? false : 1) }] as any
	const oldAlert = window.alert
	let alertMsg = ''
	window.alert = (msg: any) => {
		alertMsg = msg
	}
	const term = handler.makeTerm(region)
	window.alert = oldAlert
	test.equal(term, undefined, 'Should not make a term')
	test.equal(alertMsg, 'Please select at least one sample type.', 'Should notify user to select sample type')
	test.end()
})
