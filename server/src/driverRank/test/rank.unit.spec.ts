import tape from 'tape'
import { dtsnvindel, dtcnv, dtfusionrna, dtsv, dtitd, dtgeneexpression, mclasscnvAmp, mclasscnvgain } from '#shared'
import { rankEvents, rankMutationResult, parseAaChange } from '../rank.ts'
import { compileDsDriverKb, getGeneLookup } from '../kb.ts'
import { getKb, lookup, match, rules, kbText } from './fixture.ts'

/*
Tests:
	snvindel: allele-specific hotspot, reference amino acid guard, gene-level tier 2, silent
	snvindel: splice event of class false, frameshift, exon rule, in-frame range, alias gene name
	parseAaChange()
	fusion: known pair either order, wildcard rule by orientation
	fusion: not a rearrangement within one gene, not an old alias that is a gene of its own
	sv: breakpoints to genes, wildcard of unknown orientation, locus rule with window, window limit
	locus: IGH by the names of its genes and IGH@, not by genes of other loci, only by its region on chr14
	locus: IGK and IGL by region and by name, the span of a locus without the window, a gene name with a strand
	itd: by gene, by exon of a pinned isoform
	cnv: focal amp, arm-level segment, gain below amp, deepDel and del, valueType of an event, category class
	enhancer: focal gain or amp over the locus, not beside it, not a loss or a long segment, gene amp first,
		tandem duplication sv, no gain threshold, without coordinates in the build, locus far from its gene
	hypermutated sample: tier 2 snvindel tags dropped, by dt2total and by count
	event of another dt, or malformed, is not ranked
	rankMutationResult(): order, germline, VAF, drivers only, alternativeDataByDt, sources, input not changed
	rankMutationResult(): germline origin codes, VAF of string counts and of totalCount
	getGeneLookup(): gene names checked in memory, without a query of the gene db
	compileDsDriverKb(): disabled source and rule, changed match, invalid match, disabled rules of the dataset file
*/

const kb = getKb()
const ctx = { cnvType: 'log2ratio' }
const snv = (gene: string, mname: string, mclass: any, more = {}) => ({
	dt: dtsnvindel,
	gene,
	mname,
	class: mclass,
	...more
})
const tagOf = (m: any, k = kb) => rankEvents([m], k, ctx).tags[0]

tape('\n', test => {
	test.comment('-***- driverRank/rank specs -***-')
	test.end()
})

tape('snvindel: hotspot, reference guard, gene level, silent', test => {
	const g12d = tagOf(snv('KRAS', 'G12D', 'M'))
	test.equal(g12d?.tier, 1, 'KRAS G12D should be tier 1')
	test.equal(g12d?.reason, 'snv', 'KRAS G12D should be tagged by the snv rule')
	test.deepEqual(
		g12d?.ruleIds,
		['hotspots:KRAS:G12', 'civic:6'],
		'should list the hotspot rule first, then the gene rule'
	)
	test.deepEqual(g12d?.sources, ['hotspots', 'civic'], 'should list the sources of the matched rules')
	test.deepEqual(g12d?.genes, ['KRAS'], 'should name the gene')

	const g12c = tagOf(snv('KRAS', 'G12C', 'M'))
	test.equal(g12c?.tier, 2, 'KRAS G12C, an alt that the hotspot rule lacks, should be tier 2 by the gene rule')
	test.equal(g12c?.reason, 'gene', 'KRAS G12C should be tagged by the gene rule')

	const wrongRef = tagOf(snv('KRAS', 'A12D', 'M'))
	test.deepEqual(
		wrongRef?.ruleIds,
		['civic:6'],
		'a reference amino acid other than G at 12 should not match the hotspot'
	)

	test.equal(tagOf(snv('KRAS', 'G12=', 'S')), null, 'a silent event should not be ranked')
	test.equal(
		tagOf(snv('KRAS', 'G12D', 'M', { gene: 'NOTAGENE' })),
		null,
		'an event of a gene without rules is not ranked'
	)
	test.equal(tagOf(snv('OLDKRAS', 'G12D', 'M'))?.tier, 1, 'an event naming the gene by an alias should match')
	test.end()
})

tape('snvindel: splice, frameshift, exon, in-frame', test => {
	test.equal(
		tagOf(snv('TP53', 'X126_splice', false))?.tier,
		1,
		'a splice event with class false should match the splice hotspot'
	)

	const w288 = tagOf(snv('NPM1', 'W288Cfs*12', 'F', { chr: 'chr5', pos: 171410541 }))
	test.equal(w288?.reason, 'fs', 'NPM1 W288Cfs*12 should be tagged by the frameshift rule')
	test.deepEqual(
		w288?.ruleIds,
		['civic:3', 'civic:4', 'civic:5'],
		'NPM1 W288Cfs*12 should match the fs, exon and gene rules'
	)

	const w290 = tagOf(snv('NPM1', 'W290Cfs*10', 'F', { chr: 'chr5', pos: 171410550 }))
	test.equal(w290?.tier, 1, 'NPM1 W290Cfs*10 should be tier 1')
	test.equal(w290?.reason, 'exon', 'NPM1 W290Cfs*10 should be tagged by the exon rule, not the W288 rule')

	const s254 = tagOf(snv('NPM1', 'S254Lfs*22', 'F', { chr: 'chr5', pos: 171405391 }))
	test.equal(s254?.tier, 2, 'an NPM1 frameshift outside of exon 11 should only be tier 2 by the gene rule')

	const itdAsIndel = tagOf(snv('FLT3', 'F594_D600dup', 'I'))
	test.equal(itdAsIndel?.reason, 'inframe', 'an in-frame duplication in FLT3 578-613 should match the range')
	test.equal(tagOf(snv('FLT3', 'D650_D651dup', 'I')), null, 'an in-frame change outside the range should not match')
	test.end()
})

tape('parseAaChange()', test => {
	test.deepEqual(parseAaChange('R175H', 'M'), { ref: 'R', pos: 175, end: 175, kind: 'sub', alt: 'H' }, 'missense')
	test.deepEqual(parseAaChange('p.R417*', 'N'), { ref: 'R', pos: 417, end: 417, kind: 'sub', alt: '*' }, 'nonsense, p.')
	test.deepEqual(parseAaChange('W1815X', 'N'), { ref: 'W', pos: 1815, end: 1815, kind: 'sub', alt: '*' }, 'stop as X')
	test.deepEqual(
		parseAaChange('E746_A750del', 'D'),
		{ ref: 'E', pos: 746, end: 750, kind: 'inframe', alt: '' },
		'range'
	)
	test.deepEqual(
		parseAaChange('N542delinsGPM', 'N'),
		{ ref: 'N', pos: 542, end: 542, kind: 'inframe', alt: '' },
		'delins'
	)
	test.deepEqual(
		parseAaChange('X119_splice', 'L'),
		{ ref: 'X', pos: 119, end: 119, kind: 'splice', alt: 'sp' },
		'splice'
	)
	test.equal(parseAaChange('T>C', 'Intron'), null, 'a non-protein name should not parse')
	test.equal(parseAaChange(undefined, 'M'), null, 'a missing name should not parse')
	test.end()
})

tape('fusion: known pair, wildcard by orientation', test => {
	const f = (geneA: string, geneB: string) => tagOf({ dt: dtfusionrna, geneA, geneB })
	test.equal(f('BCR', 'ABL1')?.tier, 1, 'BCR::ABL1 should be tier 1')
	test.deepEqual(f('BCR', 'ABL1')?.genes, ['BCR', 'ABL1'], 'should name both genes')
	test.equal(f('ABL1', 'BCR')?.tier, 1, 'the reciprocal ABL1::BCR should be tier 1')
	test.equal(f('KMT2A', 'MLLT3')?.tier, 1, 'KMT2A as the 5 prime gene should match KMT2A::* at tier 1')
	test.equal(f('MLLT3', 'KMT2A')?.tier, 2, 'KMT2A as the 3 prime gene should match KMT2A::* only at tier 2')
	test.equal(f('MLLT3', 'ABL1'), null, 'a pair without a rule should not be ranked')
	const unoriented = compileDsDriverKb(kb, { match: { fusion: { geneAIs5prime: false } } }, lookup, '')
	test.equal(
		tagOf({ dt: dtfusionrna, geneA: 'KMT2A', geneB: 'MLLT3' }, unoriented)?.tier,
		2,
		'without orientation, tier 2'
	)
	test.end()
})

tape('fusion: within one gene, old alias', test => {
	const fusion = (geneA: string, geneB: string) => tagOf({ dt: dtfusionrna, geneA, geneB })
	test.deepEqual(fusion('ZMYM2', 'FGFR1')?.ruleIds, ['civic:11'], 'ZMYM2::FGFR1 should match *::FGFR1')
	test.equal(fusion('ZMYM2', 'FGFR1')?.tier, 1, 'in the orientation of the rule, at its tier')
	test.equal(fusion('FGFR1', 'FGFR1'), null, 'a fusion of FGFR1 with itself should not match *::FGFR1')
	test.equal(
		tagOf({
			dt: dtsv,
			chrA: 'chr8',
			posA: 38420000,
			chrB: 'chr8',
			posB: 38460000,
			geneA: 'FGFR1(+)',
			geneB: 'FGFR1(+)'
		}),
		null,
		'an sv within FGFR1 should not match *::FGFR1'
	)
	test.equal(tagOf({ dt: dtsv, geneA: 'FGFR1(-)' })?.tier, 2, 'an sv of FGFR1 and an unknown partner is tier 2')
	test.equal(fusion('ZMYM2', 'FLG'), null, 'FLG, the gene of filaggrin, should not be taken for FGFR1, its old alias')
	test.end()
})

tape('sv: breakpoints, locus, window', test => {
	const sv = (chrA: string, posA: number, chrB: string, posB: number) => tagOf({ dt: dtsv, chrA, posA, chrB, posB })
	test.equal(sv('chr22', 23290000, 'chr9', 130800000)?.tier, 1, 'breakpoints in BCR and ABL1 should be tier 1')
	const kmt2a = sv('chr11', 118480000, 'chr9', 20400000)
	test.equal(
		kmt2a?.tier,
		2,
		'breakpoints in KMT2A and MLLT3 match KMT2A::* only at tier 2, as the orientation is unknown'
	)
	test.deepEqual(kmt2a?.genes, ['KMT2A'], 'should name the gene of the rule')
	const igh = sv('chr14', 105900000, 'chr8', 127200000)
	test.equal(igh?.reason, 'sv', 'a breakpoint in the IGH locus and one within 1 Mb of MYC should match IGH::MYC')
	test.deepEqual(igh?.genes, ['IGH', 'MYC'], 'should name the locus and the gene')
	test.equal(sv('chr14', 105900000, 'chr8', 125000000), null, 'a breakpoint 2.7 Mb from MYC should not match')
	test.equal(sv('chr5', 1310000, 'chr3', 5000000)?.reason, 'sv', 'a breakpoint 15 kb from TERT should match TERT::*')
	test.equal(sv('chr5', 1400000, 'chr3', 5000000), null, 'a breakpoint 105 kb from TERT should not match')
	test.equal(
		tagOf({ dt: dtsv, geneA: 'TERT', geneB: 'XYZ' })?.reason,
		'sv',
		'an sv without coordinates should match TERT::* by name'
	)
	test.end()
})

tape('locus: IGH by name and by region', test => {
	const fusion = (geneA: string, geneB: string) => tagOf({ dt: dtfusionrna, geneA, geneB })
	for (const [a, b] of [
		['IGH', 'CRLF2'],
		['IGH@', 'CRLF2'],
		['IGHM', 'CRLF2'],
		['CRLF2', 'IGHV3-53']
	]) {
		test.deepEqual(fusion(a, b)?.ruleIds, ['civic:10'], `a ${a}::${b} fusion should match IGH::CRLF2`)
	}
	test.equal(fusion('IGHMBP2', 'CRLF2'), null, 'IGHMBP2, not of the IGH locus, should not match IGH::CRLF2')
	test.equal(fusion('IGHV1OR15-1', 'CRLF2'), null, 'an IGH orphon on chr15 should not match IGH::CRLF2')

	const sv = (chrA: string, posA: number, chrB: string, posB: number) => tagOf({ dt: dtsv, chrA, posA, chrB, posB })
	test.deepEqual(
		sv('chr14', 105900000, 'chrX', 1200000)?.ruleIds,
		['civic:10'],
		'breakpoints in the IGH locus and CRLF2 should match IGH::CRLF2'
	)
	test.equal(sv('chr15', 21000500, 'chr8', 127200000), null, 'a breakpoint at an IGH orphon should not match IGH::MYC')
	test.equal(sv('chr11', 68910000, 'chr8', 127200000), null, 'a breakpoint in IGHMBP2 should not match IGH::MYC')
	test.deepEqual(
		[...kb.fusionGenesByChr].filter(([, rs]) => rs.some(r => r.name == 'IGH')).map(([chr]) => chr),
		['chr14'],
		'the IGH locus should be a region of chr14 only'
	)
	test.end()
})

tape('locus: IGK and IGL', test => {
	const sv = (chrA: string, posA: number, chrB: string, posB: number) => tagOf({ dt: dtsv, chrA, posA, chrB, posB })
	test.deepEqual(sv('chr2', 89000000, 'chr8', 127900000)?.ruleIds, ['curated:7'], 'an IGK and a MYC breakpoint')
	test.deepEqual(sv('chr22', 22500000, 'chr8', 127900000)?.ruleIds, ['curated:8'], 'an IGL and a MYC breakpoint')
	test.deepEqual(
		kb.sv.find(r => r.id == 'curated:7')?.geneRegions,
		[{ name: 'IGK', chr: 'chr2', start: 88857161, stop: 90235370 }],
		'IGK should span its genes on chr2, without the IGK orphon 20 Mb away'
	)
	test.equal(sv('chr2', 110000200, 'chr8', 127900000), null, 'a breakpoint at an IGK orphon should not match IGK::MYC')
	test.equal(
		sv('chr22', 23200000, 'chr8', 127900000),
		null,
		'a breakpoint in BCR, 280 kb from IGL, should not match IGL::MYC, as the window is around MYC, not IGL'
	)
	test.equal(sv('chr14', 106500000, 'chr8', 127900000), null, 'nor should one 500 kb beyond the genes of IGH')

	const fusion = (geneA: string, geneB: string) => tagOf({ dt: dtfusionrna, geneA, geneB })
	test.deepEqual(fusion('IGK@', 'MYC')?.ruleIds, ['curated:7'], 'an IGK@::MYC fusion should match IGK::MYC')
	test.deepEqual(fusion('IGLV4-69', 'MYC')?.ruleIds, ['curated:8'], 'an IGLV4-69::MYC fusion should match IGL::MYC')
	test.equal(fusion('IGLL1', 'MYC'), null, 'IGLL1, not of the IGL locus, should not match IGL::MYC')
	test.equal(fusion('IGLON5', 'MYC'), null, 'IGLON5 should not match IGL::MYC')
	test.deepEqual(
		tagOf({ dt: dtsv, geneA: 'BCR(+)', geneB: 'ABL1(-)' })?.ruleIds,
		['civic:1'],
		'the gene names of an sv with their strands should match BCR::ABL1'
	)
	test.equal(fusion('IGHEP2', 'CRLF2'), null, 'IGHEP2, which fits the IGH pattern but is on chr9, should not be IGH')
	test.end()
})

tape('itd: by gene, by exon', test => {
	const itd = (chr: string, start: number, stop: number) => tagOf({ dt: dtitd, chr, start, stop })
	const flt3 = itd('chr13', 28034091, 28034132)
	test.equal(flt3?.reason, 'itd', 'an itd in FLT3 should be tagged')
	test.deepEqual(flt3?.genes, ['FLT3'], 'should name FLT3, which the event lacks')
	test.equal(itd('chr17', 44208050, 44208150)?.tier, 1, 'an itd in UBTF exon 13 should be tier 1')
	test.equal(itd('chr17', 44210050, 44210150), null, 'an itd in UBTF exon 11 should not match the exon 13 rule')
	test.end()
})

tape('cnv: focal, calls, value types', test => {
	const cnv = (chr: string, start: number, stop: number, value: any, more = {}) =>
		tagOf({ dt: dtcnv, chr, start, stop, value, ...more })
	test.equal(cnv('chr2', 15000000, 16500000, 2.1)?.reason, 'amp', 'a focal MYCN amplification should be tagged')
	test.equal(cnv('chr2', 1000000, 60000000, 2.1), null, 'an arm-level segment should not match')
	test.equal(cnv('chr2', 15000000, 16500000, 0.4), null, 'a gain below the amp threshold should not match')
	test.equal(cnv('chr2', 15942000, 16500000, 2.1), null, 'an amplification must contain the whole gene')
	const deep = cnv('chr9', 21900000, 22100000, -2)
	test.equal(deep?.reason, 'deepDel', 'a homozygous CDKN2A deletion should be tagged by the deepDel rule')
	test.deepEqual(deep?.ruleIds, ['curated:2', 'civic:9'], 'a deepDel call should also match the del rule')
	test.equal(cnv('chr9', 21900000, 22100000, -0.5)?.reason, 'del', 'a CDKN2A loss above deepDel should match del only')
	test.equal(
		cnv('chr8', 127000000, 128000000, 3, { valueType: 'copyNumber' }),
		null,
		'3 copies by the valueType of the event should not be an amplification'
	)
	test.equal(cnv('chr8', 127000000, 128000000, 8, { valueType: 'copyNumber' })?.reason, 'amp', '8 copies is amp')
	test.equal(
		cnv('chr8', 127000000, 128000000, undefined, { class: mclasscnvAmp })?.reason,
		'amp',
		'a qualitative amplification should be called by its class'
	)
	test.equal(cnv('chr9', 21900000, 22100000, 0.5), null, 'a gain over CDKN2A should not match its del rule')
	test.end()
})

tape('enhancer: cnv over the locus', test => {
	const cnv = (start: number, stop: number, value: any, more = {}) =>
		tagOf({ dt: dtcnv, chr: 'chr8', start, stop, value, ...more })
	// the N-Me amplification of an ASH sample, 1.4 Mb from MYC
	const amp = cnv(129148100, 129203799, 2.593)
	test.equal(amp?.reason, 'enhancer', 'an amplification over N-Me should be tagged by the enhancer rule')
	test.equal(amp?.tier, 2, 'should have the tier of the rule')
	test.deepEqual(amp?.genes, ['MYC'], 'should name the gene that the locus activates')
	test.equal(amp?.locus, 'N-Me', 'should name the locus')
	test.deepEqual(amp?.ruleIds, ['curated:6'], 'should not match the MYC amp rule, which needs MYC in the segment')
	test.equal(cnv(129160000, 129190000, 0.35)?.reason, 'enhancer', 'a single-copy gain over N-Me should match')
	test.equal(cnv(129160000, 129190000, 0.1), null, 'a value below the gain threshold should not match')
	test.equal(cnv(129160000, 129190000, -0.8), null, 'a loss over N-Me should not match')
	test.equal(cnv(129170000, 129300000, 2), null, 'a gain beside N-Me should not match')
	test.equal(cnv(127000000, 131000000, 2), null, 'a segment longer than focalMaxLength should not match')
	test.equal(
		cnv(129160000, 129190000, undefined, { class: mclasscnvgain })?.reason,
		'enhancer',
		'a qualitative gain should be called by its class'
	)
	test.equal(
		cnv(129160000, 129190000, 3, { valueType: 'copyNumber' })?.reason,
		'enhancer',
		'3 copies by the valueType of the event should be a gain'
	)
	const both = cnv(127700000, 129200000, 2)
	test.equal(both?.reason, 'amp', 'an amplification of MYC and N-Me should be tagged by the tier 1 MYC amp rule')
	test.deepEqual(both?.ruleIds, ['curated:5', 'curated:6'], 'should list the enhancer rule after it')
	test.equal(both?.locus, undefined, 'should name no locus, as the best rule is not an enhancer rule')

	const noGain = getKb({ ...match, cnv: { ...match.cnv, calls: { log2ratio: { amp: 1, del: -0.3, deepDel: -1.3 } } } })
	test.equal(
		tagOf({ dt: dtcnv, chr: 'chr8', start: 129160000, stop: 129190000, value: 0.5 }, noGain),
		null,
		'without a gain threshold, a gain should not match'
	)
	test.equal(
		tagOf({ dt: dtcnv, chr: 'chr8', start: 129160000, stop: 129190000, value: 1.5 }, noGain)?.reason,
		'enhancer',
		'without a gain threshold, an amplification should still match'
	)
	test.end()
})

tape('enhancer: tandem duplication sv', test => {
	const sv = (posA: number, posB: number, svtype?: string) =>
		tagOf({ dt: dtsv, chrA: 'chr8', posA, chrB: 'chr8', posB, svtype, strandA: '-', strandB: '+' })
	const dup = sv(129187288, 129157775, 'DUP')
	test.equal(dup?.reason, 'enhancer', 'a tandem duplication over N-Me should be tagged by the enhancer rule')
	test.equal(dup?.locus, 'N-Me', 'should name the locus')
	test.equal(sv(129157775, 129187288, 'DEL'), null, 'a deletion over N-Me should not match')
	test.equal(sv(129157775, 129187288), null, 'an sv without svtype should not match, as it may be a deletion')
	test.equal(sv(129170000, 129187288, 'DUP'), null, 'a duplication beside N-Me should not match')
	test.equal(sv(126000000, 129187288, 'DUP'), null, 'a duplication longer than focalMaxLength should not match')
	test.end()
})

tape('enhancer: rules that cannot match', test => {
	const hg18 = getKb(match, 'hg18')
	test.ok(
		hg18.skipped.some(s => s.startsWith('curated:6: no coordinates of N-Me in hg18')),
		'should leave out a rule without coordinates in the build'
	)
	test.equal(hg18.enhancerByChr.size, 0, 'should index no enhancer rule then')
	test.equal(getKb().enhancerByChr.get('chr8')?.[0].region.start, 129167819, 'should take the coordinates of the build')
	const far = getKb(match, 'hg38', {
		curated: rules.curated.map(r => (r.kind == 'enhancer' ? { ...r, region: 'hg38=chr8:139167819-139168726' } : r))
	})
	test.ok(
		far.skipped.some(s => s.startsWith('curated:6: N-Me is not within')),
		'should leave out a rule whose locus is far from its gene, as of another build'
	)
	test.notOk(getKb().genes.has('N-Me'), 'should not take the locus for a gene')
	test.end()
})

tape('hypermutated sample', test => {
	const mlst = [snv('KRAS', 'G12D', 'M'), snv('KRAS', 'G12C', 'M'), { dt: dtfusionrna, geneA: 'MLLT3', geneB: 'KMT2A' }]
	const r = rankEvents(mlst, kb, { ...ctx, snvindelTotal: 10000 })
	test.deepEqual(r.hypermutated, { snvindelCount: 10000, threshold: 500 }, 'should report the hypermutated sample')
	test.equal(r.tags[0]?.tier, 1, 'should keep a tier 1 snvindel')
	test.equal(r.tags[1], null, 'should drop a tier 2 snvindel')
	test.equal(r.tags[2]?.tier, 2, 'should keep a tier 2 tag of another dt')
	const low = compileDsDriverKb(kb, { match: { hypermutated: { minSnvindel: 1 } } }, lookup, '')
	test.equal(
		rankEvents(mlst, low, ctx).hypermutated?.snvindelCount,
		2,
		'should count the snvindel events without dt2total'
	)
	test.equal(rankEvents(mlst, kb, ctx).hypermutated, undefined, 'should not report a sample below the threshold')
	test.end()
})

tape('event of another dt, or malformed', test => {
	const r = rankEvents(
		[{ dt: dtgeneexpression, gene: 'KRAS' }, null, 'x', { dt: dtsv }, { dt: dtcnv, chr: 'chr2' }, { dt: dtsnvindel }],
		kb,
		ctx
	)
	test.deepEqual(r.tags, [null, null, null, null, null, null], 'should not rank, and not throw')
	test.end()
})

tape('rankMutationResult()', test => {
	const mlst = [
		{ dt: dtcnv, chr: 'chr1', start: 1, stop: 100, value: 0.5 },
		snv('KRAS', 'G12C', 'M'),
		snv('TP53', 'X126_splice', 'L', { origin: 'germline' }),
		snv('KRAS', 'G12D', 'M', { vafs: [{ altCount: 10, refCount: 90 }] }),
		snv('KRAS', 'G12V', 'M', { vafs: [{ altCount: 40, refCount: 60 }] }),
		{ dt: dtfusionrna, geneA: 'BCR', geneB: 'ABL1' }
	]
	const input = {
		mlst,
		alternativeDataByDt: {
			[dtcnv]: [{ name: 'x', mlst: [{ dt: dtcnv, chr: 'chr2', start: 15000000, stop: 16500000, value: 2 }] }]
		}
	}
	const before = JSON.stringify(input)
	const out = rankMutationResult(input, kb, ctx, false)
	test.deepEqual(
		out.mlst.map((m: any) => m.mname || m.geneA || 'cnv'),
		['G12V', 'G12D', 'BCR', 'X126_splice', 'G12C', 'cnv'],
		'should order tier 1 by VAF, then the other tier 1, germline last in its tier, then tier 2, then the rest'
	)
	test.equal(out.mlst[5].driver, undefined, 'should not tag a non-driver')
	test.equal(out.alternativeDataByDt[dtcnv][0].mlst[0].driver?.reason, 'amp', 'should tag the alternative data')
	test.deepEqual(
		out.driverRank.sources.map((s: any) => s.id),
		['hotspots', 'civic'],
		'should list the sources of the matched rules'
	)
	test.equal(out.driverRank.kbVersion, 'test', 'should give the kb version')
	test.equal(JSON.stringify(input), before, 'should not change the result of the getter')

	const only = rankMutationResult(input, kb, ctx, true)
	test.equal(only.mlst.length, 5, 'drivers only: should keep the 5 driver events')
	test.ok(
		only.mlst.every((m: any) => m.driver),
		'drivers only: every event should have a tag'
	)
	test.equal(only.alternativeDataByDt, undefined, 'drivers only: should leave out the alternative data')
	test.end()
})

tape('rankMutationResult(): origin codes and VAF formats', test => {
	const names = (mlst: any[]) => rankMutationResult({ mlst }, kb, ctx, false).mlst.map((m: any) => m.mname)
	test.deepEqual(
		names([
			snv('KRAS', 'G12D', 'M', { vorigin: 'GP' }),
			snv('KRAS', 'G12V', 'M', { origin: 'G' }),
			snv('TP53', 'X126_splice', 'L', { vorigin: 'somatic' })
		]),
		['X126_splice', 'G12D', 'G12V'],
		'should rank the germline codes GP and G after a somatic driver of the tier'
	)
	test.deepEqual(
		names([
			snv('KRAS', 'G12D', 'M', { vafs: [{ altCount: 10, totalCount: 100 }] }),
			snv('KRAS', 'G12V', 'M', { vafs: [{ altCount: '25', refCount: '75' }] }),
			snv('TP53', 'X126_splice', 'L', { vafs: [{ altCount: 20, refCount: 80 }] })
		]),
		['G12V', 'X126_splice', 'G12D'],
		'should order by the VAF of string counts (25%) and of a totalCount (10%)'
	)
	test.end()
})

tape('getGeneLookup()', test => {
	let queries = 0
	const genedb = {
		mapByName: new Map([['TP53', 'TP53']]),
		getjsonbyname: { get: () => ++queries && undefined }
	}
	const lookup = getGeneLookup(genedb)
	test.equal(lookup.isName('TP53'), true, 'should know a gene name')
	test.equal(lookup.isName('tp53'), true, 'should know it in another case, as does the sql of the gene db')
	test.equal(lookup.isName('NOTAGENE'), false, 'should not know another name')
	test.equal(queries, 0, 'should check the names in memory, without a query of the gene db')
	test.end()
})

tape('compileDsDriverKb()', test => {
	const noCivic = compileDsDriverKb(kb, { disable: ['civic', 'hotspots:TP53:X126'] }, lookup, '')
	test.equal(tagOf(snv('KRAS', 'G12C', 'M'), noCivic), null, 'a disabled source should not match')
	test.equal(tagOf(snv('TP53', 'X126_splice', 'L'), noCivic), null, 'a disabled rule should not match')
	test.equal(tagOf(snv('KRAS', 'G12D', 'M'), noCivic)?.tier, 1, 'the other rules should still match')
	test.deepEqual(
		noCivic.sources.map(s => s.id),
		['hotspots', 'curated'],
		'should leave out a disabled source from the sources'
	)
	test.notEqual(noCivic.version, kb.version, 'should have another version')
	test.equal(match.hypermutated.minSnvindel, 500, 'should not change the genome kb match')
	test.throws(
		() => compileDsDriverKb(kb, { match: { cnv: { calls: { log2ratio: { del: 2 } } } } }, lookup, ''),
		/needs deepDel <= del < amp/,
		'should throw on invalid cnv calls'
	)

	const dsFile = kbText(
		[
			{ id: 'ds:1', kind: 'gene', gene: 'TP53', alt: 'any', tier: 1 },
			{ id: 'ds:2', kind: 'gene', gene: 'NPM1', alt: 'trunc', tier: 1 }
		],
		{ source: 'dataset rules' }
	)
	const readText = (file: string) => {
		if (file != 'tp/ds.txt') throw 'unexpected file ' + file
		return dsFile
	}
	const withDs = (disable: string[]) => compileDsDriverKb(kb, { file: 'ds.txt', disable }, lookup, 'tp', readText)
	const oneOff = withDs(['ds:2'])
	test.deepEqual(
		oneOff.rows.filter(r => r.source == 'ds').map(r => r.id),
		['ds:1'],
		'should leave out a disabled rule of the dataset file'
	)
	test.ok(
		oneOff.sources.some(s => s.id == 'ds'),
		'should list the dataset source while some of its rules are on'
	)
	const dsOff = withDs(['ds'])
	test.equal(
		dsOff.rows.filter(r => r.source == 'ds').length,
		0,
		'should leave out the rules of a disabled dataset source'
	)
	test.notOk(
		dsOff.sources.some(s => s.id == 'ds'),
		'should leave out the disabled dataset source'
	)
	test.end()
})
