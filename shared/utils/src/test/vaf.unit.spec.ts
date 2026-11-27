import tape from 'tape'
import { getVafCounts } from '../vaf.js'
import { isGermlineOrigin } from '../common.js'

/*
Tests:
	getVafCounts(): refCount, totalCount in its place, integer strings, invalid counts
	isGermlineOrigin(): the codes and texts of morigin
*/

tape('\n', function (test) {
	test.comment('-***- shared/vaf -***-')
	test.end()
})

tape('getVafCounts()', function (test) {
	test.deepEqual(getVafCounts({ altCount: 20, refCount: 24 }), { altCount: 20, totalCount: 44 }, 'should add refCount')
	test.deepEqual(
		getVafCounts({ altCount: 25, totalCount: 100 }),
		{ altCount: 25, totalCount: 100 },
		'should take totalCount in place of refCount'
	)
	test.deepEqual(
		getVafCounts({ altCount: 25, refCount: 50, totalCount: 100 }),
		{ altCount: 25, totalCount: 100 },
		'should prefer totalCount to refCount'
	)
	test.deepEqual(
		getVafCounts({ altCount: '25', refCount: '75' }),
		{ altCount: 25, totalCount: 100 },
		'should read integer strings as numbers, not join them'
	)
	const invalid: [string, any][] = [
		['no altCount', { refCount: 10 }],
		['no refCount or totalCount', { altCount: 10 }],
		['no reads', { altCount: 0, refCount: 0 }],
		['totalCount below altCount', { altCount: 10, totalCount: 5 }],
		['a negative count', { altCount: -1, refCount: 10 }],
		['a fraction', { altCount: 1.5, refCount: 10 }],
		['a string that is not an integer', { altCount: '10x', refCount: 10 }],
		['not an object', null]
	]
	for (const [name, v] of invalid) test.equal(getVafCounts(v), null, `should give null for ${name}`)
	test.end()
})

tape('isGermlineOrigin()', function (test) {
	for (const o of ['G', 'GP', 'GNP', 'germline', 'Germline', 'germline pathogenic', 'germline non-pathogenic']) {
		test.equal(isGermlineOrigin(o), true, `${o} should be germline`)
	}
	for (const o of ['S', 'somatic', 'R', 'relapse', 'germline?', '', undefined, 1]) {
		test.equal(isGermlineOrigin(o), false, `${o} should not be germline`)
	}
	test.end()
})
