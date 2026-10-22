import tape from 'tape'
import { availabilitySections } from '../groupDataAvailability'

/*
Tests:
	- availabilitySections() survival units
*/

const response = (units: (string | undefined)[]): any => ({
	dataTypes: [],
	groups: [
		{
			name: 'g',
			data: {},
			survival: units.map((unit, i) => ({ termid: `t${i}`, name: `T${i}`, count: 5, ...(unit ? { unit } : {}) }))
		}
	]
})

tape('\n', test => {
	test.comment('-***- mass/groupDataAvailability -***-')
	test.end()
})

tape('availabilitySections() survival units', test => {
	const [shared] = availabilitySections(response(['patients', 'patients']))
	test.equal(shared.title, 'Survival · patients', 'should name a unit that the terms share in the section title')
	test.ok(
		shared.rows.every(r => !r.unit),
		'should not repeat the shared unit in the rows'
	)

	const [mixed] = availabilitySections(response(['patients', 'samples']))
	test.equal(mixed.title, 'Survival', 'should name no unit in the title of terms with different units')
	test.deepEqual(
		mixed.rows.map(r => r.unit),
		['patients', 'samples'],
		'should give each row the unit of its term'
	)
	test.end()
})
