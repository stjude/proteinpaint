import tape from 'tape'
import { vocabInit } from '#termdb/vocabulary'

/*********
Tests:
	QualTermCollection.fill() - exact name match against real TermdbTest config
	QualTermCollection.fill() - name with suffix does NOT match real TermdbTest config
**********/

/*************************
 reusable helper functions
**************************/

async function getVocabApi() {
	const vocabApi = vocabInit({ state: { vocab: { genome: 'hg38-test', dslabel: 'TermdbTest' } } })
	if (!vocabApi) throw 'vocabApi is missing'
	await vocabApi.getTermdbConfig()
	return vocabApi
}

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- tw/termCollection.integration -***-')
	test.end()
})

tape('QualTermCollection.fill() - exact name match against real TermdbTest config', async test => {
	const { QualTermCollection } = await import('../collection/QualTermCollection')
	const vocabApi = await getVocabApi()
	const term: any = { type: 'termCollection', name: 'Assay Availability', memberType: 'categorical' }
	try {
		QualTermCollection.fill(term, { vocabApi })
		test.ok(Array.isArray(term.termlst) && term.termlst.length > 0, 'termlst populated from real config')
		test.ok(Array.isArray(term.termIds) && term.termIds.length > 0, 'termIds derived from termlst')
		test.equal(term.memberType, 'categorical', 'memberType set to categorical')
	} catch (e: any) {
		test.fail('should not throw for exact name match: ' + e)
	}
	test.end()
})

tape('QualTermCollection.fill() - name with suffix does NOT match real TermdbTest config', async test => {
	const { QualTermCollection } = await import('../collection/QualTermCollection')
	const vocabApi = await getVocabApi()
	const term: any = { type: 'termCollection', name: 'Assay Availability (3)', memberType: 'categorical' }
	test.throws(
		() => QualTermCollection.fill(term, { vocabApi }),
		/no matching termCollection/,
		'should throw when suffix name does not strictly match any collection'
	)
	test.end()
})
