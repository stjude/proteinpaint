import tape from 'tape'
import * as d3s from 'd3-selection'
import { SearchHandler } from '../ssGSEA.ts'
import { mayRenderSampleTypeRow } from '#dom'
import { TermTypes } from '#types'

/*************************
 reusable helper functions
**************************/

function getHolder() {
	return d3s.select('body').append('div')
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- termdb/handlers/ssGSEA -***-')
	test.end()
})

tape('init() should throw when genomeObj.termdbs is missing', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()

	try {
		await handler.init({
			holder,
			callback: () => {},
			app: {},
			genomeObj: { name: 'hg38' }
		})
		test.fail('Should throw when genesetDbName is missing')
	} catch (e) {
		test.match(String(e), /genesetDbName missing/, 'Should throw expected error message')
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('init() should throw when genomeObj.termdbs is empty', async test => {
	const handler = new SearchHandler()
	const holder = getHolder()

	try {
		await handler.init({
			holder,
			callback: () => {},
			app: {},
			genomeObj: { name: 'hg38', termdbs: {} }
		})
		test.fail('Should throw when no databases are available')
	} catch (e) {
		test.match(String(e), /genesetDbName missing/, 'Should throw expected error message for empty termdbs')
	}

	if (test['_ok']) holder.remove()
	test.end()
})

tape('selectTerm() reads the sample types chosen in the sample type row', test => {
	const termdbConfig = {
		queries: { ssGSEA: { sampleTypes: [1, 2, 3] } },
		sampleTypes: {
			1: { name: 'patient', plural_name: 'patients', parent_id: null },
			2: { name: 'diagnosis sample', plural_name: 'diagnosis samples', parent_id: 1 },
			3: { name: 'relapse sample', plural_name: 'relapse samples', parent_id: 1 }
		}
	}
	const handler = new SearchHandler()
	const picked: any[] = []
	handler.callback = term => picked.push(term)
	handler.app = { vocabApi: { termdbConfig } }
	const holder = getHolder()
	handler.sampleTypeSelect = mayRenderSampleTypeRow(holder, handler.query, termdbConfig)
	const boxes = holder.selectAll('input[type=checkbox]').nodes() as HTMLInputElement[]
	test.equal(boxes.length, 2, 'should offer the sample types with a parent')

	const geneset = { id: 'HALLMARK_APOPTOSIS', name: 'HALLMARK_APOPTOSIS' }
	handler.selectTerm(geneset)
	test.deepEqual(
		picked[0],
		{ id: geneset.id, type: TermTypes.SSGSEA, name: geneset.name },
		'should read every sample when every sample type is checked'
	)

	boxes[1].click()
	handler.selectTerm(geneset)
	test.deepEqual(picked[1].sampleTypes, [2], 'should read the checked sample types')
	test.equal(picked[1].sampleTypeLabel, 'diagnosis samples', 'should name them')

	handler.sampleTypeSelect = undefined
	handler.app = { vocabApi: { termdbConfig: { queries: {} } } }
	handler.selectTerm(geneset)
	test.notOk('sampleTypes' in picked[2], 'should read every sample for scores without sample types')

	if (test['_ok']) holder.remove()
	test.end()
})
