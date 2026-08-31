import tape from 'tape'
import { pickDeEngine } from '#src/routes/termdb.DE.ts'

/** Tests
 * - pickDeEngine() engine selection
 * - pickDeEngine() DE_method sent to R
 */

/**************
 helper
***************/

const pick = (method: string | undefined, n1: number, n2: number) => pickDeEngine(method, n1, n2)

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- routes/termdb.DE pickDeEngine -***-')
	test.end()
})

tape('engine selection', function (test) {
	test.equal(pick('wilcoxon', 50, 50).engine, 'wilcoxon', 'wilcoxon on large groups')
	test.equal(pick('edgeR', 50, 50).engine, 'edgeR', 'edgeR on large groups')
	test.equal(pick('limma', 50, 50).engine, 'edgeR', 'limma runs the edgeR branch')

	// too few degrees of freedom for the non-parametric test
	test.equal(pick('wilcoxon', 6, 6).engine, 'edgeR', 'small groups force edgeR')
	test.equal(pick('wilcoxon', 8, 8).engine, 'edgeR', '8 per group is still small')
	test.equal(pick('wilcoxon', 9, 8).engine, 'wilcoxon', 'both groups must be <=8 to force')
	test.end()
})

tape('DE_method handed to R', function (test) {
	/* edge_newh5.R requires DE_method and accepts only edgeR/limma. It used to receive the
	client's method verbatim, so both cases below reached R as something it rejects. */
	test.equal(pick('wilcoxon', 6, 6).DE_method, 'edgeR', 'forced-off wilcoxon is relabelled, not passed through')
	test.equal(pick(undefined, 6, 6).DE_method, 'edgeR', 'an absent method never reaches R as undefined')

	test.equal(pick('limma', 50, 50).DE_method, 'limma', 'limma is preserved, not flattened to edgeR')
	test.equal(pick('limma', 6, 6).DE_method, 'limma', 'limma is preserved on small groups too')
	test.equal(pick('edgeR', 50, 50).DE_method, 'edgeR', 'edgeR passes through')

	// the rust pipeline ignores DE_method, but it should still name what ran
	test.equal(pick('wilcoxon', 50, 50).DE_method, 'wilcoxon', 'wilcoxon run is labelled wilcoxon')

	for (const [method, n1, n2] of [
		['wilcoxon', 6, 6],
		['wilcoxon', 50, 50],
		[undefined, 6, 6],
		[undefined, 50, 50],
		['limma', 6, 6],
		['edgeR', 50, 50]
	] as [string | undefined, number, number][]) {
		const { engine, DE_method } = pick(method, n1, n2)
		if (engine == 'edgeR') {
			test.ok(
				DE_method == 'edgeR' || DE_method == 'limma',
				`edgeR branch never sends R an invalid DE_method (${method} ${n1}v${n2} -> ${DE_method})`
			)
		}
	}
	test.end()
})
