import tape from 'tape'
import { SearchHandler } from '../dnaMethylation.ts'

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
