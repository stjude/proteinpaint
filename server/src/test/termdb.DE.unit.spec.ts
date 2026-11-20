import tape from 'tape'
import {
	pickDeEngine,
	admitDeRun,
	deMethodsOverMemory,
	deSampleLimitAlert,
	selectedColumnSpan,
	isIsoformDE,
	addIsoformGenes,
	flagUnknownGenes,
	resolveDE
} from '#src/routes/termdb.DE.ts'

/** Tests
 * - pickDeEngine() engine selection
 * - pickDeEngine() DE_method sent to R
 * - admitDeRun() refusal and the wilcoxon suggestion
 * - deMethodsOverMemory()
 * - deSampleLimitAlert()
 * - admitDeRun() counts the columns wilcoxon reads
 * - selectedColumnSpan()
 * - isIsoformDE()
 * - resolveDE() picks the counts of the term type
 * - addIsoformGenes()
 * - flagUnknownGenes()
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

tape('admitDeRun', function (test) {
	const genes = 17928 // ASH, where the costs were measured
	// the error message, or '' when the run fits; an admitted run is released at once, so the next check starts clear
	const check = (
		method: 'edgeR' | 'limma' | 'wilcoxon',
		n1: number,
		n2: number,
		freeMB: number,
		opts: { runDE_methods?: string[]; confounded?: boolean; genes?: number } = {}
	) => {
		try {
			admitDeRun({ method, n1, n2, genes, availableMB: freeMB, ...opts })()
			return ''
		} catch (e: any) {
			test.equal(e.code, 'LOW_MEMORY', `${method} ${n1}v${n2} at ${freeMB} MB => code LOW_MEMORY`)
			test.equal(e.status, 503, `${method} ${n1}v${n2} at ${freeMB} MB => status 503`)
			return e.message
		}
	}
	const smaller = 'Select a smaller cohort.'
	const orWilcoxon = 'Select a smaller cohort, or use the Wilcoxon method, which needs less memory.'

	// on ASH, 500 samples cost ≈ 1850 MB with edgeR, ≈ 2150 with limma and ≈ 509 with wilcoxon
	test.equal(check('edgeR', 250, 250, 16000), '', 'edgeR on 500 samples fits in 16 GB (the 3,072 MB default maxMB)')
	test.ok(
		check('edgeR', 250, 250, 1600).endsWith(orWilcoxon),
		'edgeR on 500 samples with 1,600 MB free => suggests wilcoxon, which fits'
	)
	test.ok(
		check('limma', 200, 300, 2000).endsWith(orWilcoxon),
		'limma on 500 samples with 2,000 MB free => suggests wilcoxon'
	)
	test.ok(check('limma', 200, 300, 2000).includes('on 500 samples'), 'the message says how many samples were selected')
	test.ok(
		check('edgeR', 250, 250, 1600, { runDE_methods: ['edgeR', 'Limma'] }).endsWith(smaller),
		'wilcoxon not offered by this server => only a smaller cohort'
	)
	test.ok(check('limma', 250, 250, 400).endsWith(smaller), 'wilcoxon would not fit either => only a smaller cohort')
	test.ok(
		check('edgeR', 250, 250, 1600, { confounded: true }).endsWith(smaller),
		'a run with confounders => no wilcoxon, which would drop the adjustment'
	)
	test.ok(
		check('edgeR', 6, 6, 400).endsWith(smaller),
		'groups of 8 or fewer => no wilcoxon, which would fall back to edgeR'
	)
	test.ok(check('wilcoxon', 250, 250, 400).endsWith(smaller), 'wilcoxon itself too big => only a smaller cohort')
	test.ok(
		check('limma', 250, 250, 100000, { genes: 59400 }).endsWith(orWilcoxon),
		'limma on 500 samples of a 59,400-gene file (~4,579 MB) on a 100 GB host => over DE maxMB, suggests wilcoxon'
	)
	test.end()
})

tape('deMethodsOverMemory', function (test) {
	const genes = 17928
	test.deepEqual(deMethodsOverMemory(500, genes, 500, 16000), [], '500 samples in 16 GB => every method fits')
	test.deepEqual(
		deMethodsOverMemory(500, genes, 500, 2000),
		['limma'],
		'500 samples with 2,000 MB free => limma (~2,150 MB) does not fit'
	)
	test.deepEqual(deMethodsOverMemory(500, genes, 500, 2000, true), [], 'report mode => none refused')
	test.deepEqual(
		deMethodsOverMemory(500, 59400, 500, 100000),
		['edgeR', 'limma'],
		'500 samples of a 59,400-gene file on a 100 GB host => DE maxMB refuses edgeR and limma, wilcoxon fits'
	)
	test.end()
})

tape('deSampleLimitAlert', function (test) {
	const groups = (n1: number, n2: number) => ({
		group1names: Array.from({ length: n1 }, (_, i) => `a${i}`),
		group2names: Array.from({ length: n2 }, (_, i) => `b${i}`)
	})
	const ds = { cohort: { termdb: { uiLabels: { samples: 'cases' } } } }
	test.equal(deSampleLimitAlert(groups(500, 500), ds), '', '1000 samples => within the default limit')
	test.match(
		deSampleLimitAlert(groups(501, 500), ds),
		/^1001 cases selected exceeds the limit of 1000 per run/,
		'over 1000 => alert'
	)
	test.match(
		deSampleLimitAlert(groups(10, 11), ds, 20),
		/exceeds the limit of 20 per run/,
		'a ds limit below 1000 => that limit'
	)
	test.match(
		deSampleLimitAlert(groups(501, 500), ds, 1500),
		/exceeds the limit of 1000 per run/,
		'a ds limit above 1000 => still 1000'
	)
	test.end()
})

tape('admitDeRun counts the columns wilcoxon reads', function (test) {
	// 20 samples spread over 10,000 columns of a 60,660-gene file: rust reads the whole span, ~2.3 GB as f32
	const run = { method: 'wilcoxon' as const, n1: 10, n2: 10, genes: 60660, availableMB: 1000 }
	test.doesNotThrow(() => admitDeRun(run)(), 'adjacent samples at 1 GB => fits')
	test.throws(
		() => admitDeRun({ ...run, spanSamples: 10000 }),
		/too low/,
		'the same samples over 10,000 columns => refused'
	)
	test.end()
})

tape('selectedColumnSpan', function (test) {
	const file = ['a', 'b', 'c', 'd', 'e', 'f']
	test.equal(selectedColumnSpan(file, ['b', 'c']), 2, 'adjacent => 2')
	test.equal(selectedColumnSpan(file, ['e', 'a']), 5, 'a to e, in any order => 5')
	test.equal(selectedColumnSpan(file, ['b', 'x', 'd']), 3, 'a sample not in the file is skipped')
	test.equal(selectedColumnSpan(file, ['x', 'y']), 2, 'none in the file => the number selected')
	test.end()
})

tape('isIsoformDE', function (test) {
	const req = (termType?: any) => ({ termType } as any)
	test.equal(isIsoformDE(req()), false, 'a run without termType tests genes')
	test.equal(isIsoformDE(req('geneExpression')), false, 'geneExpression tests genes')
	test.equal(isIsoformDE(req('isoformExpression')), true, 'isoformExpression tests transcripts')
	test.throws(
		() => isIsoformDE(req('dnaMethylation')),
		/invalid termType/,
		'throws for a data type the route does not test'
	)
	try {
		isIsoformDE(req('dnaMethylation'))
	} catch (e: any) {
		test.equal(e.status, 400, 'an unknown termType is a client error')
	}
	test.end()
})

tape('resolveDE() picks the counts of the term type', function (test) {
	const geneSamples = new Set(['a', 'b'])
	const isoformSamples = new Set(['a', 'c'])
	const ds = {
		queries: {
			rnaseqGeneCount: { file: '/genes.h5', allSampleSet: geneSamples, maxSamples: 300 },
			isoformExpressionCount: { file: '/isoforms.h5', allSampleSet: isoformSamples, maxSamples: 100 }
		}
	}
	const genes = resolveDE({}, ds)
	test.equal(genes.countsFile, '/genes.h5', 'a gene run reads the gene counts')
	test.equal(genes.allSampleSet, geneSamples, 'with the samples of the gene counts')

	const isoforms = resolveDE({ termType: 'isoformExpression' }, ds)
	test.equal(isoforms.countsFile, '/isoforms.h5', 'an isoform run reads the transcript counts')
	test.equal(isoforms.allSampleSet, isoformSamples, 'with the samples of the transcript counts')
	test.equal(isoforms.maxSamples, 100, 'and their sample limit')
	test.notOk(isoforms.buildCountsFile, 'and builds no counts file')

	test.throws(
		() => resolveDE({ termType: 'isoformExpression' }, { queries: { rnaseqGeneCount: ds.queries.rnaseqGeneCount } }),
		/no isoformExpressionCount/,
		'throws for an isoform run on a dataset without transcript counts'
	)
	test.throws(
		() => resolveDE({ termType: 'isoformExpression', pseudobulk: { assay: 'x', memberId: 'y', category: 'z' } }, ds),
		/pseudobulk is not supported/,
		'throws for an isoform run on pseudobulk'
	)
	test.end()
})

tape('addIsoformGenes', function (test) {
	const known = new Map([
		['ENST00000269305', 'TP53'],
		['ENST00000256078', 'KRAS']
	])
	const genome = {
		genedb: { getnamebyisoform: { get: (i: string) => (known.has(i) ? { name: known.get(i) } : undefined) } }
	}
	const rows: any[] = [
		{ gene_name: 'ENST00000269305' },
		{ gene_name: 'ENST00000256078.10' },
		{ gene_name: 'ENST99999999999' }
	]
	addIsoformGenes(rows, genome)
	test.equal(rows[0].gene, 'TP53', 'names the gene of a transcript')
	test.equal(rows[1].gene, 'KRAS', 'names the gene of a transcript id with a version suffix')
	test.notOk('gene' in rows[2], 'names no gene for a transcript the annotation does not have')
	test.equal(rows[1].gene_name, 'ENST00000256078.10', 'keeps the transcript id as gene_name')

	const unchanged: any[] = [{ gene_name: 'ENST00000269305' }]
	addIsoformGenes(unchanged, {})
	test.notOk('gene' in unchanged[0], 'names no gene on a genome without gene annotation')
	test.end()
})

tape('flagUnknownGenes', function (test) {
	const genome = {
		genomicNameRegexp: /[^a-zA-Z0-9.:_-]/,
		genedb: {
			mapByName: new Map([['TP53', 'TP53']]),
			mapByIsoform: new Map(),
			mapByAlias: new Map([['P53', ['TP53']]])
		}
	}
	const getRows = (): any[] => [{ gene_name: 'TP53' }, { gene_name: 'p53' }, { gene_name: 'AC011767.1' }]

	const rows = getRows()
	flagUnknownGenes(rows, genome, {})
	test.notOk('unknownGene' in rows[0], 'does not flag a gene that the gene db has')
	test.notOk('unknownGene' in rows[1], 'does not flag an alias that the gene db has')
	test.equal(rows[2].unknownGene, true, 'flags a gene that the gene db does not have')

	const skipped = getRows()
	flagUnknownGenes(skipped, genome, { cohort: { termdb: { skipGeneNameValidation: ['geneExpression'] } } })
	test.notOk(
		skipped.some(r => r.unknownGene),
		'flags no gene for a dataset whose gene expression names are not checked'
	)

	const noGenedb = getRows()
	flagUnknownGenes(noGenedb, {}, {})
	test.notOk(
		noGenedb.some(r => r.unknownGene),
		'flags no gene on a genome without gene db lookups'
	)
	test.end()
})
