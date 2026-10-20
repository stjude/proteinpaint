import tape from 'tape'
import { pickDeEngine, checkDeMemory } from '#src/routes/termdb.DE.ts'

/** Tests
 * - pickDeEngine() engine selection
 * - pickDeEngine() DE_method sent to R
 * - checkDeMemory() refusal and the wilcoxon suggestion
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

tape('checkDeMemory', function (test) {
	const genes = 17928 // ASH, where the costs were measured
	// the error message, or '' when the run fits
	const check = (
		method: 'edgeR' | 'limma' | 'wilcoxon',
		n1: number,
		n2: number,
		freeMB: number,
		opts: { runDE_methods?: string[]; confounded?: boolean } = {}
	) => {
		try {
			checkDeMemory({ method, n1, n2, genes, availableMB: freeMB, ...opts })
			return ''
		} catch (e: any) {
			test.equal(e.code, 'LOW_MEMORY', `${method} ${n1}v${n2} at ${freeMB} MB => code LOW_MEMORY`)
			test.equal(e.status, 503, `${method} ${n1}v${n2} at ${freeMB} MB => status 503`)
			return e.message
		}
	}
	const smaller = 'Select a smaller cohort.'
	const orWilcoxon = 'Select a smaller cohort, or use the Wilcoxon method, which needs less memory.'

	test.equal(check('edgeR', 300, 700, 16000), '', 'edgeR on 1,000 samples fits in 16 GB')
	test.ok(
		check('edgeR', 1508, 2930, 12000).endsWith(orWilcoxon),
		'edgeR on 4,438 samples at 12 GB => suggests wilcoxon, which fits'
	)
	test.ok(check('limma', 1000, 2000, 12000).endsWith(orWilcoxon), 'limma on 3,000 samples => suggests wilcoxon')
	test.ok(
		check('limma', 1508, 2930, 12000).includes('on 4,438 samples'),
		'the message says how many samples were selected'
	)
	test.ok(
		check('edgeR', 1508, 2930, 12000, { runDE_methods: ['edgeR', 'Limma'] }).endsWith(smaller),
		'wilcoxon not offered by this server => only a smaller cohort'
	)
	test.ok(check('limma', 1508, 2930, 4000).endsWith(smaller), 'wilcoxon would not fit either => only a smaller cohort')
	test.ok(
		check('edgeR', 1508, 2930, 12000, { confounded: true }).endsWith(smaller),
		'a run with confounders => no wilcoxon, which would drop the adjustment'
	)
	test.ok(
		check('edgeR', 6, 6, 1000).endsWith(smaller),
		'groups of 8 or fewer => no wilcoxon, which would fall back to edgeR'
	)
	test.ok(check('wilcoxon', 1508, 2930, 4000).endsWith(smaller), 'wilcoxon itself too big => only a smaller cohort')
	test.end()
})
