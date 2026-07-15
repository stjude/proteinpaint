import tape from 'tape'
import { computeTypes } from '../validate.js'

tape('\n', test => {
	test.comment('-***- junction/validate specs -***-')
	test.end()
})

tape('computeTypes: canonical and event types', test => {
	const junction = {
		canonical: true,
		events: [{ attrValue: 'exon_skip' }, { attrValue: 'alt_donor' }, { attrValue: 'exon_skip' }]
	}

	const types = computeTypes(junction, new Set())

	test.deepEqual(types, ['canonical', 'exon_skip', 'alt_donor'], 'returns canonical and unique event attrValues')
	test.equal(junction.canonical, undefined, 'removes canonical from the junction info object')
	test.end()
})

tape('computeTypes: hidden types are excluded', test => {
	const junction = {
		canonical: true,
		events: [{ attrValue: 'exon_skip' }, { attrValue: 'alt_acceptor' }]
	}

	const types = computeTypes(junction, new Set(['canonical', 'alt_acceptor']))

	test.deepEqual(types, ['exon_skip'], 'omits hidden canonical and event types')
	test.equal(junction.canonical, undefined, 'removes canonical even when hidden')
	test.end()
})

tape('computeTypes: no events and non-canonical junction', test => {
	{
		const junction = {}
		const types = computeTypes(junction, new Set())
		test.deepEqual(types, ['na'], 'returns na when the junction is not canonical and has no events')
	}
	{
		const junction = {}
		const types = computeTypes(junction, new Set(['na']))
		test.deepEqual(types, [], 'returns no visible types when na is hidden')
	}
	test.end()
})

tape('computeTypes: event attrValue must be a string', test => {
	const junction = {
		events: [{ attrValue: 'exon_skip' }, {}]
	}

	test.throws(
		() => computeTypes(junction, new Set()),
		/event\.attrValue missing/,
		'throws when an event attrValue is missing'
	)
	test.end()
})
