import tape from 'tape'
import { relateSamples, validRequest, type SampleRow } from '../termdb.relatedSamples.ts'

/*
Tests:
	validRequest()
	relateSamples(): a sample of a patient
	relateSamples(): a root sample with data of its own
	relateSamples(): a sample not passing the filter
	relateSamples(): a sample whose parent does not pass the filter
	relateSamples(): a dataset without sample ancestry
*/

/** a patient (type 1) with a sample (2) that has a PDX sample (3) */
const names = { 1: 'P1', 2: '10', 3: '9', 4: 'S2', 5: 'S2-pdx', 6: 'P2', 7: 'X' }
const types = { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 2 }
const getName = id => names[id]
const getType = id => types[id]
/** rows as get_samples_ancestry() gives them: P1 > [10, 9, S2 > S2-pdx], P2 alone; P1 listed again as a root */
const rows: SampleRow[] = [
	{ id: 1, ancestor_id: null },
	{ id: 2, ancestor_id: 1 },
	{ id: 3, ancestor_id: 1 },
	{ id: 4, ancestor_id: 1 },
	{ id: 5, ancestor_id: 4 },
	{ id: 6, ancestor_id: null },
	{ id: 1, ancestor_id: null }
]
const sampleNames = (r: any) => r.samples.map(s => s.sampleName)

tape('\n', function (test) {
	test.comment('-***- #routes/termdb.relatedSamples -***-')
	test.end()
})

tape('validRequest()', test => {
	const q = { genome: 'hg38', dslabel: 'ds' }
	test.deepEqual(validRequest({ ...q, sampleId: 41 }), { ...q, sampleId: 41 }, 'Should accept a number')
	test.deepEqual(validRequest({ ...q, sampleId: '41' }), { ...q, sampleId: 41 }, 'Should convert a GET string')
	for (const sampleId of [undefined, '', 'abc', 1.5, null])
		test.throws(
			() => validRequest({ ...q, sampleId }),
			/sampleId/,
			`Should reject sampleId=${JSON.stringify(sampleId)}`
		)
	test.end()
})

tape('relateSamples(): a sample of a patient', test => {
	const r: any = relateSamples(rows, 5, getName, getType)
	test.deepEqual(
		sampleNames(r),
		['9', '10', 'S2', 'S2-pdx'],
		'Should list the samples under the patient in tree order, numeric names in numeric order, without the patient'
	)
	test.deepEqual(r.root, { sampleId: 1, sampleName: 'P1' }, 'Should give the patient as the root')
	test.deepEqual(
		sampleNames(relateSamples(rows, 1, getName, getType)),
		sampleNames(r),
		'Should list the same for the patient'
	)
	test.end()
})

tape('relateSamples(): a root sample with data of its own', test => {
	const r: any = relateSamples(rows, 6, getName, getType)
	test.deepEqual(sampleNames(r), ['P2'], 'Should list a patient without child samples')
	const withTypes: any = relateSamples(rows, 2, getName, id => (id == 1 ? 2 : types[id]))
	test.equal(sampleNames(withTypes)[0], 'P1', 'Should list first a root that is not of the root sample type')
	test.end()
})

tape('relateSamples(): a sample not passing the filter', test => {
	test.deepEqual(relateSamples(rows, 7, getName, getType), { samples: [] }, 'Should give no samples')
	test.end()
})

tape('relateSamples(): a sample whose parent does not pass the filter', test => {
	const r: any = relateSamples(
		rows.filter(r => r.id != 4),
		5,
		getName,
		getType
	)
	test.deepEqual(sampleNames(r), ['S2-pdx'], 'Should list the sample under its listed ancestor only')
	test.deepEqual(r.root, { sampleId: 5, sampleName: 'S2-pdx' }, 'Should give the sample as the root')
	test.end()
})

tape('relateSamples(): a dataset without sample ancestry', test => {
	const r: any = relateSamples([{ id: 2 }, { id: 3 }], 3, getName, () => undefined)
	test.deepEqual(sampleNames(r), ['9'], 'Should list the sample only')
	test.deepEqual(r.root, { sampleId: 3, sampleName: '9' }, 'Should give the sample as the root')
	test.end()
})
