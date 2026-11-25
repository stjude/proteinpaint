import tape from 'tape'
import { string2pos, string2exactCoord } from '../common.js'

/* test sections

string2pos()
string2exactCoord()
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

tape('string2exactCoord()', test => {
	const exact = (v: string, g: any = genome) => string2exactCoord(v, g)
	const coord = (start: number, stop: number) => ({ chr: 'chr1', start, stop })

	test.deepEqual(exact('chr1:5-10'), coord(5, 10), 'should keep a range as typed')
	test.deepEqual(
		exact('CHR1:1,00-2,00'),
		coord(100, 200),
		'should ignore commas, and name the chromosome as the genome does'
	)
	test.deepEqual(exact('chr1 5 10'), coord(5, 10), 'should accept whitespace as separator')
	test.deepEqual(exact('chr1 : 5 - 10'), coord(5, 10), 'should allow whitespace around the colon and the dash')
	test.deepEqual(exact('chr1:7'), coord(7, 7), 'should not widen a single position')
	test.deepEqual(exact('chr1:7-7'), coord(7, 7), 'should accept a range of one base')
	test.deepEqual(exact('chr1:1000'), coord(1000, 1000), 'should accept the last base of the chromosome')
	test.deepEqual(
		exact('HLA-A*01:01:01:01:5-10', { chrlookup: { 'HLA-A*01:01:01:01': { name: 'HLA-A*01:01:01:01', len: 3503 } } }),
		{ chr: 'HLA-A*01:01:01:01', start: 5, stop: 10 },
		'should take the last colon as the separator of a chromosome name with colons'
	)

	for (const [v, why] of [
		['chr1', 'a bare chromosome name'],
		['TP53', 'a gene name'],
		['chr1:', 'a missing position'],
		['chr1:0-10', 'a position below 1'],
		['chr1:20-10', 'a start past the stop'],
		['chr1:11-10', 'a start just past the stop'],
		['chr1:1001', 'a base past the chromosome'],
		['chr1:1-1001', 'a stop past the chromosome'],
		['chr1:-1-10', 'a signed start'],
		['chr1:1--10', 'a doubled dash'],
		['chr1:1-2-3', 'more than two positions'],
		['chr1.7.C.T', 'a variant'],
		['chrZ:1-10', 'an unknown chromosome']
	]) {
		test.equal(exact(v), undefined, `should not accept ${why}: "${v}"`)
	}
	test.end()
})
