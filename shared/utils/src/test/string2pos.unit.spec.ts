import tape from 'tape'
import { string2pos } from '../common.js'

/* test sections

string2pos()
*/

const genome = { chrlookup: { CHR1: { name: 'chr1', len: 1000 } } }

tape('\n', function (test) {
	test.comment('-***- string2pos specs -***-')
	test.end()
})

tape('string2pos()', test => {
	test.deepEqual(
		string2pos('chr1:5-10', genome, true),
		{ chr: 'chr1', chrlen: 1000, start: 5, stop: 10, actualposition: { position: 5, len: 5 } },
		'should parse chr:start-stop'
	)
	test.equal(string2pos('chr1 5 - 10', genome, true)?.stop, 10, 'should allow whitespace around the dash')
	test.equal(string2pos('chr1:1,00-2,00', genome, true)?.start, 100, 'should strip commas')
	for (const s of ['chr1:-5-10', 'chr1:5--10', 'chr1:-5', 'chr1 -5', 'chr1.-5']) {
		test.equal(string2pos(s, genome, true), null, `should reject negative coordinate in "${s}"`)
	}
	test.end()
})
