import tape from 'tape'
import { getTermSampleTypeIds, mapParent2ChildrenWithSampleTypes } from '#src/utils/sampleTypes.ts'

/*
test sections:

getTermSampleTypeIds checks the ids and refuses an invalid one as a 400
mapParent2ChildrenWithSampleTypes keeps the chosen sample types through the mapping, and maps a filter given apart
*/

// a patient (1) with diagnosis (2) and relapse (3) samples; 'sex' annotates patients
const ds = {
	cohort: {
		termdb: {
			hasSampleAncestry: true,
			term2SampleType: new Map([['sex', 1]]),
			sampleTypes: {
				1: { name: 'Patient', parent_id: null },
				2: { name: 'Diagnosis', parent_id: 1 },
				3: { name: 'Relapse', parent_id: 1 }
			}
		}
	}
}
const filter = { type: 'tvslst', join: '', in: true, lst: [{ type: 'tvs', tvs: { term: { id: 'sex' } } }] }

tape('\n', t => {
	t.comment('-***- utils/sampleTypes -***-')
	t.end()
})

tape('getTermSampleTypeIds checks the ids and refuses an invalid one as a 400', t => {
	t.equal(getTermSampleTypeIds({}, ds), undefined, 'none chosen')
	t.deepEqual(getTermSampleTypeIds({ sampleTypes: [2, '3'] }, ds), [2, 3], 'numbers')
	for (const [sampleTypes, message] of [
		['2', 'sampleTypes must be an array'],
		[[9], "invalid sample type='9'"],
		[['x'], "invalid sample type='x'"]
	] as [any, string][]) {
		try {
			getTermSampleTypeIds({ sampleTypes }, ds)
			t.fail(`should refuse ${JSON.stringify(sampleTypes)}`)
		} catch (e: any) {
			t.equal(e.message, message, `should refuse ${JSON.stringify(sampleTypes)}`)
			t.equal(e.status, 400, 'as an error of the request')
		}
	}
	t.end()
})

tape('mapParent2ChildrenWithSampleTypes keeps the chosen sample types through the mapping', t => {
	const plain: any = { filter }
	mapParent2ChildrenWithSampleTypes(plain, ds)
	t.deepEqual(plain.sampleTypes, [2, 3], 'without a choice, a filter on patients reads every child sample type')
	t.equal(plain.mapParent2Children, true, 'maps patients to their samples')

	const chosen: any = { filter, sampleTypes: ['2'] }
	mapParent2ChildrenWithSampleTypes(chosen, ds)
	t.deepEqual(chosen.sampleTypes, [2], 'keeps the chosen sample type, which the mapping alone would reset')

	// an mds3 track sends its filter as filterObj, given to the mapping apart from q.filter
	const track: any = { filterObj: filter }
	mapParent2ChildrenWithSampleTypes(track, ds, track.filterObj)
	t.equal(track.mapParent2Children, true, 'maps patients to their samples for a filter given apart')
	t.deepEqual(track.sampleTypes, [2, 3], 'reads every child sample type of that filter')
	t.notOk('filter' in track, 'leaves q.filter as it is')

	const noFilter: any = { sampleTypes: [3] }
	mapParent2ChildrenWithSampleTypes(noFilter, ds)
	t.deepEqual(noFilter.sampleTypes, [3], 'keeps it without a filter too')
	t.end()
})
