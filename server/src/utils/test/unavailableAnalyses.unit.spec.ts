import tape from 'tape'
import { getUnavailableAnalyses, genesetAnalyses, hasPythonBin } from '#src/utils/unavailableAnalyses.ts'

/*
test sections:

lists the analyses whose check is false, in the order of the checks
the default checks return a list of known analysis names
hasPythonBin() is false only for a binpath that does not exist
*/

tape('\n', test => {
	test.comment('-***- utils/unavailableAnalyses -***-')
	test.end()
})

tape('lists the analyses whose check is false, in the order of the checks', test => {
	test.deepEqual(
		getUnavailableAnalyses({ blitzgsea: () => false, cerno: () => true, ora: () => false }),
		['blitzgsea', 'ora'],
		'should list only the analyses that cannot run'
	)
	test.deepEqual(
		getUnavailableAnalyses({ blitzgsea: () => true, cerno: () => true, ora: () => true }),
		[],
		'should be empty when every analysis can run'
	)
	test.end()
})

tape('the default checks return a list of known analysis names', test => {
	const names = Object.keys(genesetAnalyses)
	test.deepEqual(names, ['blitzgsea', 'cerno', 'ora'], 'should check blitzgsea, cerno and ora')
	const unavailable = getUnavailableAnalyses()
	test.ok(
		unavailable.every(n => names.includes(n)),
		'should only list known names'
	)
	test.end()
})

tape('hasPythonBin() is false only for a binpath that does not exist', test => {
	test.equal(hasPythonBin(''), true, 'should be true when the binpath is not set')
	test.equal(hasPythonBin(process.execPath), true, 'should be true for an existing binpath')
	test.equal(hasPythonBin('/no/such/dir/python3'), false, 'should be false for a missing binpath')
	test.end()
})
