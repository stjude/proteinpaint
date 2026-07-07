import tape from 'tape'
import {
	filterAndConvertSnvIndel,
	filterAndConvertCnv,
	breakpointsToLesions,
	processSampleMlst,
	buildLesionTypeMap,
	getCnvLesionType
} from '../lesions.ts'
import { grin2KeyInputs, normalizeExcludeOptions, resolveExcludeBeds } from '../main.ts'
import {
	dtsnvindel,
	dtcnv,
	dtfusionrna,
	dtsv,
	mclasscnvgain,
	mclasscnvloss,
	mclasscnvAmp,
	mclasscnvHomozygousDel
} from '#shared'
import type { GRIN2Request } from '#types'

/* test sections

filterAndConvertSnvIndel
filterAndConvertCnv: log2ratio / segmean (baseline 0)
filterAndConvertCnv: copyNumber (baseline 2, absolute thresholds)
filterAndConvertCnv: category (qualitative class, thresholds ignored)
filterAndConvertCnv: maxSegLength + shared guards
breakpointsToLesions: fusion
breakpointsToLesions: sv
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
	test.equal(
		filterAndConvertSnvIndel(sample, m, { consequences: [] }),
		null,
		'empty consequences list => include none (mirrors cnvCategories)'
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

tape('processSampleMlst: GDC batched categorical cnv records route to gain/loss', test => {
	// Records shaped exactly as the GDC batchGet (fetchCnvForCases in gdc.hg38.ts) emits: a lean segment
	// carrying valueType:'category' and the finer 5-category class. Gain/Amplification => gain lesion,
	// Loss/Homozygous Deletion => loss lesion. GDC's ds cnvType default resolves to log2ratio, so this also
	// locks that the per-entry valueType wins over that numeric default with no thresholds sent.
	const gdcMlst = [
		{ dt: dtcnv, class: mclasscnvgain, valueType: 'category', ...SEG }, // Gain
		{ dt: dtcnv, class: mclasscnvAmp, valueType: 'category', ...SEG }, // Amplification
		{ dt: dtcnv, class: mclasscnvloss, valueType: 'category', ...SEG }, // Loss
		{ dt: dtcnv, class: mclasscnvHomozygousDel, valueType: 'category', ...SEG } // Homozygous Deletion
	]
	const gdcRequest = { cnvOptions: { maxSegLength: 0 } } as unknown as GRIN2Request
	const gdc = processSampleMlst(sample, gdcMlst, gdcRequest, 'log2ratio')
	test.deepEqual(
		gdc.sampleLesions.map(l => l[4]),
		['gain', 'gain', 'loss', 'loss'],
		'gain/amplification => gain lesion; loss/homozygous deletion => loss lesion (regardless of log2ratio default)'
	)
	test.deepEqual([...gdc.contributedTypes], [dtcnv], 'only cnv contributed')
	test.end()
})

tape('filterAndConvertCnv: category cnvCategories filter (UI checkboxes)', test => {
	const catOpts = (cats?: string[]) => ({ maxSegLength: 0, cnvCategories: cats })
	// class listed in cnvCategories => included
	test.deepEqual(
		filterAndConvertCnv(
			sample,
			{ ...SEG, valueType: 'category', class: mclasscnvAmp },
			catOpts([mclasscnvAmp]),
			'category'
		),
		[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
		'class in cnvCategories => amplification included as gain'
	)
	// class not listed => dropped
	test.equal(
		filterAndConvertCnv(
			sample,
			{ ...SEG, valueType: 'category', class: mclasscnvloss },
			catOpts([mclasscnvAmp]),
			'category'
		),
		null,
		'class not in cnvCategories => null'
	)
	// empty list => nothing included
	test.equal(
		filterAndConvertCnv(sample, { ...SEG, valueType: 'category', class: mclasscnvgain }, catOpts([]), 'category'),
		null,
		'empty cnvCategories => null'
	)
	// omitted list => all classes included (backward compatible)
	test.deepEqual(
		filterAndConvertCnv(
			sample,
			{ ...SEG, valueType: 'category', class: mclasscnvHomozygousDel },
			catOpts(undefined),
			'category'
		),
		[sample, SEG.chr, SEG.start, SEG.stop, 'loss'],
		'undefined cnvCategories => homozygous deletion included as loss'
	)
	test.end()
})

tape('filterAndConvertCnv: per-entry valueType overrides the ds default', test => {
	// ds default is numeric (log2ratio), but a category-tagged entry must classify by class
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, valueType: 'category', class: mclasscnvgain }, log2ratioOpts, 'log2ratio'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
		'entry.valueType=category overrides ds log2ratio => classified by class'
	)
	// ds default is category, but a numeric-tagged entry must classify by value/threshold
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, valueType: 'segmean', value: 1.0 }, log2ratioOpts, 'category'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
		'entry.valueType=segmean overrides ds category => classified by value'
	)
	// absent entry.valueType falls back to the ds default
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, class: mclasscnvloss }, categoryOpts, 'category'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'loss'],
		'no entry.valueType => falls back to ds default (category)'
	)
	test.end()
})

tape('filterAndConvertCnv: per-type thresholds (byType) for a mixed cohort', test => {
	// One cnvOptions object carries the right cutoffs for each value type present in the cohort.
	const mixedOpts = {
		maxSegLength: 0,
		byType: {
			segmean: { lossThreshold: -0.4, gainThreshold: 0.4 },
			copyNumber: { lossThreshold: 1, gainThreshold: 3 }
		}
	}
	// segmean value 1.0 is a gain under segmean cutoffs (>=0.4)...
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, valueType: 'segmean', value: 1.0 }, mixedOpts, 'log2ratio'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
		'segmean entry classified by byType.segmean cutoffs => gain'
	)
	// ...and copyNumber value 4 is a gain under copyNumber cutoffs (>=3), in the SAME request
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, valueType: 'copyNumber', value: 4 }, mixedOpts, 'log2ratio'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
		'copyNumber entry classified by byType.copyNumber cutoffs => gain'
	)
	// copyNumber value 1.0 would be a loss under segmean cutoffs but neutral here is not asserted;
	// under copyNumber cutoffs (loss<=1) it is a loss — proves the copyNumber cutoffs are applied
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, valueType: 'copyNumber', value: 1 }, mixedOpts, 'log2ratio'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'loss'],
		'copyNumber CN 1 <= byType.copyNumber loss cutoff => loss'
	)
	// byType falls back to flat thresholds when the resolved type is absent from byType
	test.deepEqual(
		filterAndConvertCnv(
			sample,
			{ ...SEG, valueType: 'segmean', value: 1.0 },
			{ maxSegLength: 0, lossThreshold: -0.4, gainThreshold: 0.4 },
			'log2ratio'
		),
		[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
		'no byType entry => falls back to flat lossThreshold/gainThreshold'
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
	// omitted maxSegLength must default to 0 (no filter), not silently drop the segment
	test.deepEqual(
		filterAndConvertCnv(sample, { ...SEG, value: 1.0 }, { lossThreshold: -0.4, gainThreshold: 0.4 }, 'log2ratio'),
		[sample, SEG.chr, SEG.start, SEG.stop, 'gain'],
		'omitted maxSegLength => no length filter (kept)'
	)
	test.end()
})

tape('breakpointsToLesions: fusion', test => {
	// single breakpoint (only chrA) => one lesion
	test.deepEqual(
		breakpointsToLesions(sample, { chrA: 'chr12', posA: 25225245 }, dtfusionrna),
		[[sample, 'chr12', 25225245, 25225245, 'fusion']],
		'single breakpoint => one fusion lesion'
	)
	// two breakpoints (chrA + chrB) => two lesions
	test.deepEqual(
		breakpointsToLesions(sample, { chrA: 'chr12', posA: 25225245, chrB: 'chr14', posB: 104779948 }, dtfusionrna),
		[
			[sample, 'chr12', 25225245, 25225245, 'fusion'],
			[sample, 'chr14', 104779948, 104779948, 'fusion']
		],
		'two breakpoints => two fusion lesions'
	)
	test.deepEqual(breakpointsToLesions(sample, { posA: 1 }, dtfusionrna), [], 'missing chrA => []')
	test.deepEqual(breakpointsToLesions(sample, { chrA: 'chr1' }, dtfusionrna), [], 'missing posA => []')
	test.end()
})

tape('breakpointsToLesions: sv', test => {
	test.deepEqual(
		breakpointsToLesions(sample, { chrA: 'chr9', posA: 100 }, dtsv),
		[[sample, 'chr9', 100, 100, 'sv']],
		'single breakpoint => one sv lesion'
	)
	test.deepEqual(
		breakpointsToLesions(sample, { chrA: 'chr9', posA: 100, chrB: 'chr22', posB: 200 }, dtsv),
		[
			[sample, 'chr9', 100, 100, 'sv'],
			[sample, 'chr22', 200, 200, 'sv']
		],
		'two breakpoints => two sv lesions'
	)
	test.deepEqual(breakpointsToLesions(sample, { posA: 1 }, dtsv), [], 'missing chrA => []')
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
		snvindelOptions: { consequences: ['M'] }, // include the MISSENSE snv in mlst
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
		{ snvindelOptions: { consequences: ['M'] } } as unknown as GRIN2Request,
		'log2ratio'
	)
	test.deepEqual([...snvOnly.contributedTypes], [dtsnvindel], 'absent option groups are skipped')
	test.equal(snvOnly.sampleLesions.length, 1, 'only the snvindel lesion remains')

	// mixed cohort: one sample carrying both a segmean and a copyNumber segment, each classified
	// under its own byType cutoffs within a single run
	const mixedMlst = [
		{ dt: dtcnv, ...SEG, valueType: 'segmean', value: 1.0 },
		{ dt: dtcnv, ...SEG, valueType: 'copyNumber', value: 4 }
	]
	const mixedRequest = {
		cnvOptions: {
			maxSegLength: 0,
			byType: {
				segmean: { lossThreshold: -0.4, gainThreshold: 0.4 },
				copyNumber: { lossThreshold: 1, gainThreshold: 3 }
			}
		}
	} as unknown as GRIN2Request
	const mixed = processSampleMlst(sample, mixedMlst, mixedRequest, 'log2ratio')
	test.deepEqual(
		mixed.sampleLesions.map(l => l[4]),
		['gain', 'gain'],
		'mixed segmean+copyNumber segments both classify as gain under their own byType cutoffs'
	)
	test.end()
})

tape('processSampleMlst: hypermutator cutoff', test => {
	// 3 snvindel + 1 cnv; snvindel cutoff 2 => snvindel dropped as hypermutated, cnv still kept
	const mlst = [
		{ dt: dtsnvindel, chr: 'chr1', pos: 10, class: 'M' },
		{ dt: dtsnvindel, chr: 'chr1', pos: 20, class: 'M' },
		{ dt: dtsnvindel, chr: 'chr1', pos: 30, class: 'M' },
		{ dt: dtcnv, chr: 'chr1', start: 100, stop: 200, value: 4 }
	]
	const req = {
		snvindelOptions: { consequences: ['M'], hyperMutator: 2 },
		cnvOptions: { lossThreshold: 1, gainThreshold: 3, maxSegLength: 0 }
	} as unknown as GRIN2Request

	const over = processSampleMlst(sample, mlst, req, 'copyNumber')
	test.deepEqual(over.hyperMutatedDt, [dtsnvindel], 'snvindel over cutoff => reported hypermutated')
	test.deepEqual(
		over.sampleLesions.map(l => l[4]),
		['gain'],
		'snvindel dropped, cnv gain kept'
	)
	test.notOk(over.contributedTypes.has(dtsnvindel), 'hypermutated dt not in contributedTypes')

	// at the cutoff (3 <= 3) => not hypermutated, all kept
	const atLimit = processSampleMlst(
		sample,
		mlst,
		{ ...req, snvindelOptions: { consequences: ['M'], hyperMutator: 3 } } as unknown as GRIN2Request,
		'copyNumber'
	)
	test.deepEqual(atLimit.hyperMutatedDt, [], 'count == cutoff is not over the cutoff')
	test.equal(atLimit.sampleLesions.length, 4, '3 snvindel + 1 cnv all kept')

	// cutoff 0 / absent => disabled even with many records
	const disabled = processSampleMlst(
		sample,
		mlst,
		{
			snvindelOptions: { consequences: ['M'] },
			cnvOptions: { lossThreshold: 1, gainThreshold: 3 }
		} as unknown as GRIN2Request,
		'copyNumber'
	)
	test.deepEqual(disabled.hyperMutatedDt, [], 'absent cutoff disables the check')
	test.equal(disabled.sampleLesions.length, 4, 'nothing dropped when cutoff is absent')
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
