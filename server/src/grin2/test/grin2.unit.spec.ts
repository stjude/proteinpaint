import tape from 'tape'
import {
	filterAndConvertSnvIndel,
	filterAndConvertCnv,
	filterAndConvertFusion,
	filterAndConvertSV,
	processSampleMlst,
	buildLesionTypeMap,
	getCnvLesionType,
	grin2KeyInputs,
	normalizeExcludeOptions,
	resolveExcludeBeds
} from '../main.ts'
import { dtsnvindel, dtcnv, dtfusionrna, dtsv, mclasscnvgain, mclasscnvloss } from '#shared'
import type { GRIN2Request } from '#types'

/* test sections

filterAndConvertSnvIndel
filterAndConvertCnv: log2ratio / segmean (baseline 0)
filterAndConvertCnv: copyNumber (baseline 2, absolute thresholds)
filterAndConvertCnv: category (qualitative class, thresholds ignored)
filterAndConvertCnv: maxSegLength + shared guards
filterAndConvertFusion
filterAndConvertSV
processSampleMlst: routing, breakpoint expansion, cnvType threading
buildLesionTypeMap
getCnvLesionType
grin2KeyInputs + normalizeExcludeOptions
resolveExcludeBeds
*/

// Small TermdbTest-style fixtures. CNV objects mirror the dt:4 mlst entries that
// ds.queries.singleSampleMutation.get() returns; one object per quantification shape.
const sample = 'TEST1'
const SEG = { chr: 'chr17', start: 7668419, stop: 7687489 } // ~19kb segment

// log2ratio/segmean: numeric value centered on 0 (gain>0, loss<0)
const log2ratioOpts = { lossThreshold: -0.4, gainThreshold: 0.4, maxSegLength: 0 }
// copyNumber: absolute integer copy number centered on 2 (loss<=1, gain>=3, neutral=2)
const copyNumberOpts = { lossThreshold: 1, gainThreshold: 3, maxSegLength: 0 }
// category: thresholds are not sent by the UI (qualitative call)
const categoryOpts = { maxSegLength: 0 }

tape('\n', function (test) {
	test.comment('-***- server/grin2 main unit specs -***-')
	test.end()
})

tape('filterAndConvertSnvIndel', test => {
	const m = { chr: 'chr17', pos: 7675088, class: 'M' }

	test.deepEqual(
		filterAndConvertSnvIndel(sample, m, { consequences: ['M'] }),
		[sample, 'chr17', m.pos, m.pos, 'mutation'],
		'class in selected consequences => mutation lesion'
	)
	test.equal(
		filterAndConvertSnvIndel(sample, m, { consequences: ['F'] }),
		null,
		'class not in selected consequences => null'
	)
	test.deepEqual(
		filterAndConvertSnvIndel(sample, m, { consequences: [] }),
		[sample, 'chr17', m.pos, m.pos, 'mutation'],
		'empty consequences list => include all'
	)
	test.equal(
		filterAndConvertSnvIndel(sample, { chr: 'chr17', pos: 1.5, class: 'M' }, { consequences: [] }),
		null,
		'non-integer pos => null'
	)
	test.equal(filterAndConvertSnvIndel(sample, m, undefined), null, 'missing options => null')
	test.equal(filterAndConvertSnvIndel(sample, m, {}), null, 'options without consequences => null')
	test.end()
})

tape('filterAndConvertCnv: log2ratio / segmean (baseline 0)', test => {
	for (const type of ['log2ratio', 'segmean'] as const) {
		test.deepEqual(
			filterAndConvertCnv(sample, { ...SEG, value: 1.0 }, log2ratioOpts, type),
			[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
			`${type}: value 1.0 >= gainThreshold 0.4 => gain`
		)
		test.deepEqual(
			filterAndConvertCnv(sample, { ...SEG, value: -0.8 }, log2ratioOpts, type),
			[sample, SEG.chr, SEG.start, SEG.stop, 'loss'],
			`${type}: value -0.8 <= lossThreshold -0.4 => loss`
		)
		test.equal(
			filterAndConvertCnv(sample, { ...SEG, value: 0.1 }, log2ratioOpts, type),
			null,
			`${type}: value 0.1 between thresholds => neutral (null)`
		)
	}
	test.end()
})

tape('filterAndConvertCnv: copyNumber (baseline 2, absolute thresholds)', test => {
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, value: 4 }, copyNumberOpts, 'copyNumber'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
		'copyNumber: CN 4 >= gainThreshold 3 => gain'
	)
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, value: 0 }, copyNumberOpts, 'copyNumber'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'loss'],
		'copyNumber: CN 0 <= lossThreshold 1 => loss'
	)
	test.equal(
		filterAndConvertCnv(sample, { ...SEG, value: 2 }, copyNumberOpts, 'copyNumber'),
		null,
		'copyNumber: CN 2 (diploid) between thresholds => neutral (null)'
	)
	test.equal(
		filterAndConvertCnv(sample, { ...SEG, value: NaN }, copyNumberOpts, 'copyNumber'),
		null,
		'copyNumber: non-finite value => null'
	)
	test.end()
})

tape('filterAndConvertCnv: category (qualitative class, thresholds ignored)', test => {
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, class: mclasscnvgain }, categoryOpts, 'category'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
		`category: class ${mclasscnvgain} => gain (no value needed)`
	)
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, class: mclasscnvloss }, categoryOpts, 'category'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'loss'],
		`category: class ${mclasscnvloss} => loss`
	)
	test.equal(
		filterAndConvertCnv(sample, { ...SEG, class: 'SomethingElse' }, categoryOpts, 'category'),
		null,
		'category: unrecognized class => null'
	)
	test.end()
})

tape('filterAndConvertCnv: maxSegLength + shared guards', test => {
	const segLen = SEG.stop - SEG.start
	test.equal(
		filterAndConvertCnv(sample, { ...SEG, value: 1.0 }, { ...log2ratioOpts, maxSegLength: segLen - 1 }, 'log2ratio'),
		null,
		'segment longer than maxSegLength => null'
	)
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, value: 1.0 }, { ...log2ratioOpts, maxSegLength: segLen + 1 }, 'log2ratio'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
		'segment within maxSegLength => kept'
	)
	test.equal(
		filterAndConvertCnv(sample, { chr: 'chr17', start: 1.5, stop: 100, value: 1.0 }, log2ratioOpts, 'log2ratio'),
		null,
		'non-integer start => null'
	)
	test.end()
})

tape('filterAndConvertFusion', test => {
	// single breakpoint (only chrA)
	test.deepEqual(
		filterAndConvertFusion(sample, { chrA: 'chr12', posA: 25225245 }, {}),
		[sample, 'chr12', 25225245, 25225245, 'fusion'],
		'single breakpoint => one fusion lesion'
	)
	// two breakpoints (chrA + chrB) => two lesions
	test.deepEqual(
		filterAndConvertFusion(sample, { chrA: 'chr12', posA: 25225245, chrB: 'chr14', posB: 104779948 }, {}),
		[
			[sample, 'chr12', 25225245, 25225245, 'fusion'],
			[sample, 'chr14', 104779948, 104779948, 'fusion']
		],
		'two breakpoints => two fusion lesions'
	)
	test.equal(filterAndConvertFusion(sample, { posA: 1 }, {}), null, 'missing chrA => null')
	test.equal(filterAndConvertFusion(sample, { chrA: 'chr1' }, {}), null, 'missing posA => null')
	test.end()
})

tape('filterAndConvertSV', test => {
	test.deepEqual(
		filterAndConvertSV(sample, { chrA: 'chr9', posA: 100 }, {}),
		[sample, 'chr9', 100, 100, 'sv'],
		'single breakpoint => one sv lesion'
	)
	test.deepEqual(
		filterAndConvertSV(sample, { chrA: 'chr9', posA: 100, chrB: 'chr22', posB: 200 }, {}),
		[
			[sample, 'chr9', 100, 100, 'sv'],
			[sample, 'chr22', 200, 200, 'sv']
		],
		'two breakpoints => two sv lesions'
	)
	test.equal(filterAndConvertSV(sample, { posA: 1 }, {}), null, 'missing chrA => null')
	test.end()
})

tape('processSampleMlst: routing, breakpoint expansion, cnvType threading', test => {
	const mlst = [
		{ dt: dtsnvindel, chr: 'chr17', pos: 7675088, class: 'M' },
		{ dt: dtcnv, ...SEG, value: 4 }, // gain under copyNumber, neutral under log2ratio
		{ dt: dtfusionrna, chrA: 'chr12', posA: 1, chrB: 'chr14', posB: 2 },
		{ dt: dtsv, chrA: 'chr9', posA: 3 },
		{ dt: 999, chr: 'chrX', pos: 1 } // unknown dt is ignored
	]
	const request = {
		snvindelOptions: { consequences: [] },
		cnvOptions: copyNumberOpts,
		fusionOptions: {},
		svOptions: {}
	} as unknown as GRIN2Request

	const { sampleLesions, contributedTypes } = processSampleMlst(sample, mlst, request, 'copyNumber')
	// 1 snvindel + 1 cnv + 2 fusion breakpoints + 1 sv = 5 lesions
	test.equal(sampleLesions.length, 5, 'expands two-breakpoint fusion and routes each dt')
	test.deepEqual(
		[...contributedTypes].sort(),
		[dtsnvindel, dtfusionrna, dtcnv, dtsv].sort(),
		'contributedTypes reflects every dt that produced a lesion'
	)
	test.ok(
		sampleLesions.some(l => l[4] === 'gain'),
		'cnvType is threaded through: CN 4 classified as gain'
	)

	// when an option group is absent, that dt is skipped entirely
	const snvOnly = processSampleMlst(
		sample,
		mlst,
		{ snvindelOptions: { consequences: [] } } as unknown as GRIN2Request,
		'log2ratio'
	)
	test.deepEqual([...snvOnly.contributedTypes], [dtsnvindel], 'absent option groups are skipped')
	test.equal(snvOnly.sampleLesions.length, 1, 'only the snvindel lesion remains')
	test.end()
})

tape('buildLesionTypeMap', test => {
	test.deepEqual(
		buildLesionTypeMap(['cnvOptions']),
		{ loss: 'Loss', gain: 'Gain' },
		'cnv maps both lesion types to display names'
	)
	test.deepEqual(
		buildLesionTypeMap(['snvindelOptions', 'svOptions']),
		{ mutation: 'Mutation', sv: 'SV' },
		'combines maps across requested option groups'
	)
	test.deepEqual(buildLesionTypeMap(['bogusOptions']), {}, 'unknown option group contributes nothing')
	test.end()
})

tape('getCnvLesionType', test => {
	test.equal(getCnvLesionType(true), 'gain', 'isGain true => gain')
	test.equal(getCnvLesionType(false), 'loss', 'isGain false => loss')
	test.end()
})

tape('grin2KeyInputs + normalizeExcludeOptions', test => {
	const minimal = grin2KeyInputs({ genome: 'hg38', dslabel: 'TermdbTest' } as unknown as GRIN2Request)
	test.equal(minimal.filter, null, 'missing filter nulled in cache key')
	test.equal(minimal.cnvOptions, null, 'missing option groups nulled in cache key')
	test.equal(minimal.excludeOptions, null, 'missing excludeOptions => null')

	// overlapFrac normalization
	test.equal(normalizeExcludeOptions({ overlapFrac: NaN })?.overlapFrac, 0.5, 'NaN overlapFrac clamped to default 0.5')
	test.equal(normalizeExcludeOptions({ overlapFrac: 5 })?.overlapFrac, 1, 'overlapFrac > 1 clamped to 1')
	test.equal(normalizeExcludeOptions({ overlapFrac: -2 })?.overlapFrac, 0, 'overlapFrac < 0 clamped to 0')
	test.deepEqual(
		normalizeExcludeOptions({ blacklists: ['a'], overlapFrac: 0.3 }),
		{ blacklists: ['a'], overlapFrac: 0.3 },
		'valid blacklists + overlapFrac preserved'
	)
	test.equal(normalizeExcludeOptions(undefined), null, 'undefined excludeOptions => null')
	test.end()
})

tape('resolveExcludeBeds', test => {
	const g = {
		blacklists: [
			{ name: 'encode', file: '/tp/anno/encode.bed' },
			{ name: 'segdup', file: '/tp/anno/segdup.bed' }
		]
	}
	test.deepEqual(
		resolveExcludeBeds(g, undefined),
		['/tp/anno/encode.bed', '/tp/anno/segdup.bed'],
		'undefined selection => all declared sources'
	)
	test.deepEqual(resolveExcludeBeds(g, []), [], 'empty selection => none')
	test.deepEqual(resolveExcludeBeds(g, ['segdup']), ['/tp/anno/segdup.bed'], 'named subset')
	test.deepEqual(resolveExcludeBeds(g, ['segdup', 'unknown']), ['/tp/anno/segdup.bed'], 'unknown names ignored')
	test.deepEqual(resolveExcludeBeds({}, undefined), [], 'genome without blacklists => []')
	test.end()
})
