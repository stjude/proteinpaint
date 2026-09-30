import tape from 'tape'
import { init_bulk_flag, parsesample } from '../bulk.js'

/*
Tests:
	init_bulk_flag() / parsesample() do not pollute Object.prototype

parsesample() indexes flag.patient2st and flag.sample2disease by attacker/curator-supplied
patient and sample names read from an uploaded or curated data file (code-scanning #147).
A name of "__proto__" must not reach Object.prototype.
*/

tape('\n', function (test) {
	test.comment('-***- shared/utils/src/bulk -***-')
	test.end()
})

tape('parsesample() does not pollute Object.prototype via patient="__proto__"', function (test) {
	const flag = init_bulk_flag({})

	parsesample({ patient: '__proto__', sample: 'sample1', sampletype: 'diagnosis' }, flag, 0, [])

	test.equal(Object.prototype.diagnosis, undefined, 'Object.prototype must not gain a "diagnosis" property')
	test.equal(
		flag.patient2st['__proto__'].diagnosis,
		'sample1',
		'the value is still recorded as an own property of flag.patient2st'
	)
	test.end()
})

tape('parsesample() does not pollute Object.prototype via sample="__proto__"', function (test) {
	const flag = init_bulk_flag({})

	parsesample({ patient: 'patient1', sample: '__proto__', disease: 'AML' }, flag, 0, [])

	test.equal((Object.prototype as any).AML, undefined, 'Object.prototype must not gain a disease-named property')
	test.equal(
		flag.sample2disease['__proto__'],
		'AML',
		'the value is still recorded as an own property of flag.sample2disease'
	)
	test.end()
})

tape('parsesample() does not lose a nested patient2st bucket entry keyed "__proto__"', function (test) {
	const flag = init_bulk_flag({})

	// sampletype defaults to m.sample when unset, so sample="__proto__" also indexes
	// the nested flag.patient2st[patient] bucket by "__proto__"
	parsesample({ patient: 'patient1', sample: '__proto__' }, flag, 0, [])

	test.equal(
		Object.getPrototypeOf(flag.patient2st['patient1']),
		null,
		'the nested bucket must not have its own prototype reassigned'
	)
	test.equal(
		flag.patient2st['patient1']['__proto__'],
		'__proto__',
		'the sample mapping must not be silently dropped when sampletype is "__proto__"'
	)
	test.end()
})
