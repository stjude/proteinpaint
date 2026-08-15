import test from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
	filterByItem,
	filterByTvsLst,
	mayFilterByMaf,
	mayValidateBcfMafFilter,
	setFile,
	svfusionByNameGetter_file
} from '../mds3.init.js'
import { toBreakpointPos } from '../svfusion.breakpoint.ts'
import serverconfig from '../serverconfig.js'

/*
Tests:
	filterByItem: mutated sample matches filter
	filterByItem: tested sample, but no match
	filterByItem: mname (amino acid change) matching
	filterByItem: mixed class and mname values
	filterByItem: mname matched mutations flow into values[]
	filterByItem: mname with maf filter
	filterByItem: mname with origin
	filterByItem: mname mcount single/multiple
	filterByItem: mname restricted by gene
	filterByItem: sv/fusion self breakpoint range
	filterByItem: sv/fusion partner breakpoint range
	filterByItem: self and partner breakpoint ranges apply to the same event
	filterByItem: breakpoint range boundaries are inclusive
	filterByItem: breakpoint range requires a sv/fusion tvs
	filterByItem: sample not tested
	filterByItem: wildtype sample matches wildtype filter
	filterByItem: mutated sample does not match wildtype filter
	filterByItem: not tested sample matches not tested filter
	filterByItem: wildtype/mutated samples do not match not tested filter
	filterByItem: mcount=any
	filterByItem: mcount=single
	filterByItem: mcount=multiple
	filterByItem: mcount=all
	filterByItem: mutation, origin
	filterByItem: wildtype, origin
	filterByItem: continuous CNV
	filterByTvsLst: single tvs
	filterByTvsLst: multiple tvs, OR join
	filterByTvsLst: multiple tvs, AND join
	filterByTvsLst: in=false
	filterByTvsLst: nested tvslst
	filterByItem: cnv overlap is measured against the value's own region
	filterByTvsLst: values[] only collects mutations of a matching tvs
	mayFilterByMaf: basic mafFilter
	mayFilterByMaf: mafFilter with child ids
	mayFilterByMaf: basic mafFilter, min allelic depth
	mayFilterByMaf: mafFilter with child ids, min allelic depth
	setFile: validates and resolves files
	toBreakpointPos: parses breakpoint positions
	svfusionByNameGetter_file: breakpoint positions of the file
*/

test('\n', t => {
	t.pass('-***- mds3.init unit tests -***-')
	t.end()
})

test('setFile: validates and resolves files', async t => {
	const originalTpMasterDir = serverconfig.tpmasterdir
	const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pp-setfile-'))
	serverconfig.tpmasterdir = tmpdir

	try {
		await fs.promises.mkdir(path.join(tmpdir, 'nested'))
		await fs.promises.writeFile(path.join(tmpdir, 'relative.txt'), '')
		await fs.promises.writeFile(path.join(tmpdir, 'nested', 'custom.txt'), '')
		await fs.promises.writeFile(path.join(tmpdir, 'absolute.txt'), '')

		{
			const q = { file: 'relative.txt' }
			await setFile(q, 'testType')
			t.equal(q.file, path.join(tmpdir, 'relative.txt'), 'resolves relative file against tpmasterdir')
		}
		{
			const file = path.join(tmpdir, 'absolute.txt')
			const q = { file }
			await setFile(q, 'testType')
			t.equal(q.file, file, 'keeps absolute file path under tpmasterdir')
		}
		{
			const q = { jsonFile: 'nested/custom.txt' }
			await setFile(q, 'testType', 'jsonFile')
			t.equal(q.jsonFile, path.join(tmpdir, 'nested', 'custom.txt'), 'supports custom file key')
		}

		for (const [q, expected] of [
			[{ file: 1 }, 'testType.file not string'],
			[{ file: '' }, 'testType.file empty string']
		]) {
			try {
				await setFile(q, 'testType')
				t.fail('setFile should reject invalid file value')
			} catch (e) {
				t.equal(e, expected, `throws "${expected}"`)
			}
		}

		try {
			await setFile({ file: 'missing.txt' }, 'testType')
			t.fail('setFile should reject unreadable file')
		} catch (e) {
			t.ok(String(e).includes('No such file or directory'), 'throws for unreadable file')
		}
	} finally {
		serverconfig.tpmasterdir = originalTpMasterDir
		await fs.promises.rm(tmpdir, { recursive: true, force: true })
		t.end()
	}
})

test('filterByItem: mutated sample matches filter', t => {
	t.plan(4)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'any'
		}
	}
	const mlst1 = [{ dt: 1, class: 'M' }]
	const mlst2 = [
		{ dt: 1, class: 'L' },
		{ dt: 1, class: 'M' }
	]
	for (const mlst of [mlst1, mlst2]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
})

test('filterByItem: tested sample, but no match', t => {
	t.plan(4)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'any'
		}
	}
	const mlst1 = [{ dt: 1, class: 'WT' }]
	const mlst2 = [{ dt: 1, class: 'L' }]
	for (const mlst of [mlst1, mlst2]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
})

test('filterByItem: mname (amino acid change) matching', t => {
	t.plan(6)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
			genotype: 'variant',
			mcount: 'any'
		}
	}
	{
		// sample with the G12D missense mutation
		const mlst = [{ dt: 1, class: 'M', mname: 'G12D' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample with matching mname passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		// sample with a different missense mutation
		const mlst = [{ dt: 1, class: 'M', mname: 'G12V' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample with different mname does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		// mname match is class-scoped, same mname of a different class does not match
		const mlst = [{ dt: 1, class: 'F', mname: 'G12D' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample with same mname of different class does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
})

test('filterByItem: mixed class and mname values', t => {
	t.plan(6)
	// class-only entry matches any FRAMESHIFT; mname entry matches only M G12D
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }
			],
			genotype: 'variant',
			mcount: 'any'
		}
	}
	{
		const mlst = [{ dt: 1, class: 'F', mname: 'K100fs' }]
		const [pass] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Any frameshift passes via class-only entry')
	}
	{
		const mlst = [{ dt: 1, class: 'M', mname: 'G12D' }]
		const [pass] = filterByItem(filter, mlst)
		t.equal(pass, true, 'G12D missense passes via mname entry')
	}
	{
		const mlst = [{ dt: 1, class: 'M', mname: 'G12V' }]
		const [pass] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Non-G12D missense does not pass')
	}
	{
		// mcount=all: every tested mutation must match a value entry
		const filter2 = structuredClone(filter)
		filter2.tvs.mcount = 'all'
		const mlst1 = [
			{ dt: 1, class: 'M', mname: 'G12D' },
			{ dt: 1, class: 'F', mname: 'K100fs' }
		]
		const [pass1] = filterByItem(filter2, mlst1)
		t.equal(pass1, true, 'mcount=all passes when all mutations match')
		const mlst2 = [
			{ dt: 1, class: 'M', mname: 'G12D' },
			{ dt: 1, class: 'M', mname: 'G12V' }
		]
		const [pass2] = filterByItem(filter2, mlst2)
		t.equal(pass2, false, 'mcount=all fails when a mutation does not match')
	}
	{
		// isnot inverts the mname match
		const filter3 = structuredClone(filter)
		filter3.tvs.isnot = true
		const mlst = [{ dt: 1, class: 'M', mname: 'G12D' }]
		const [pass] = filterByItem(filter3, mlst)
		t.equal(pass, false, 'isnot=true inverts mname match')
	}
})

test('filterByItem: mname matched mutations flow into values[]', t => {
	// the values[] output param collects matched mutations, used by
	// mayGetGeneVariantData() to attach mutations to groupset groups
	t.plan(3)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
			genotype: 'variant',
			mcount: 'any'
		}
	}
	const g12d = { dt: 1, class: 'M', mname: 'G12D' }
	const mlst = [g12d, { dt: 1, class: 'M', mname: 'G12V' }, { dt: 1, class: 'F', mname: 'K100fs' }]
	const values = []
	const [pass] = filterByItem(filter, mlst, values)
	t.equal(pass, true, 'Sample passes filter')
	t.equal(values.length, 1, 'values[] contains only the matching mutation')
	t.equal(values[0], g12d, 'values[] contains the G12D mutation object')
})

test('filterByItem: mname with maf filter', t => {
	t.plan(2)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
			genotype: 'variant',
			mcount: 'any',
			mafFilter // shared fixture: maf > 0.1 on tumor_DNA_WGS
		}
	}
	{
		// G12D mutation passing maf cutoff
		const mlst = [{ dt: 1, class: 'M', mname: 'G12D', tumor_DNA_WGS: '70,30' }]
		const [pass] = filterByItem(filter, mlst)
		t.equal(pass, true, 'mname-matching mutation passing maf cutoff passes filter')
	}
	{
		// G12D mutation failing maf cutoff
		const mlst = [{ dt: 1, class: 'M', mname: 'G12D', tumor_DNA_WGS: '70,5' }]
		const [pass] = filterByItem(filter, mlst)
		t.equal(pass, false, 'mname-matching mutation failing maf cutoff does not pass filter')
	}
})

test('filterByItem: mname with origin', t => {
	t.plan(4)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel', origin: 'somatic' },
			values: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
			genotype: 'variant',
			mcount: 'any'
		}
	}
	{
		const mlst = [{ dt: 1, class: 'M', mname: 'G12D', origin: 'somatic' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'somatic G12D matches somatic tvs')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		// same mname, but only in germline; sample has no somatic data
		const mlst = [{ dt: 1, class: 'M', mname: 'G12D', origin: 'germline' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'germline G12D does not match somatic tvs')
		t.equal(tested, false, 'Sample is not tested for somatic')
	}
})

test('filterByItem: mname mcount single/multiple', t => {
	t.plan(4)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M', label: 'G12D', value: 'G12D', mname: 'G12D' }],
			genotype: 'variant',
			mcount: 'single'
		}
	}
	// one G12D; the G12V does not count toward the matching mutations
	const mlstOne = [
		{ dt: 1, class: 'M', mname: 'G12D' },
		{ dt: 1, class: 'M', mname: 'G12V' }
	]
	// two G12D
	const mlstTwo = [
		{ dt: 1, class: 'M', mname: 'G12D' },
		{ dt: 1, class: 'M', mname: 'G12D' }
	]
	{
		const [pass] = filterByItem(filter, mlstOne)
		t.equal(pass, true, 'mcount=single passes with one matching mutation')
	}
	{
		const [pass] = filterByItem(filter, mlstTwo)
		t.equal(pass, false, 'mcount=single fails with two matching mutations')
	}
	const filterMultiple = structuredClone(filter)
	filterMultiple.tvs.mcount = 'multiple'
	{
		const [pass] = filterByItem(filterMultiple, mlstTwo)
		t.equal(pass, true, 'mcount=multiple passes with two matching mutations')
	}
	{
		const [pass] = filterByItem(filterMultiple, mlstOne)
		t.equal(pass, false, 'mcount=multiple fails with one matching mutation')
	}
})

test('filterByItem: mname restricted by gene', t => {
	// for a geneVariant term with multiple genes, a value entry with .gene
	// matches the amino acid change only in that gene
	t.plan(4)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M', label: 'KRAS G12D', value: 'G12D', mname: 'G12D', gene: 'KRAS' }],
			genotype: 'variant',
			mcount: 'any'
		}
	}
	{
		const mlst = [{ dt: 1, class: 'M', mname: 'G12D', gene: 'KRAS' }]
		const [pass] = filterByItem(filter, mlst)
		t.equal(pass, true, 'G12D of the specified gene passes')
	}
	{
		const mlst = [{ dt: 1, class: 'M', mname: 'G12D', gene: 'NRAS' }]
		const [pass] = filterByItem(filter, mlst)
		t.equal(pass, false, 'same mname of another gene does not pass')
	}
	{
		// value entry without .gene (e.g. saved before gene was tracked)
		// matches the mname regardless of gene
		const filterNoGene = structuredClone(filter)
		delete filterNoGene.tvs.values[0].gene
		const mlst = [{ dt: 1, class: 'M', mname: 'G12D', gene: 'NRAS' }]
		const [pass] = filterByItem(filterNoGene, mlst)
		t.equal(pass, true, 'value entry without gene matches any gene')
	}
	{
		// values[] collects only the matching gene's mutation
		const kras = { dt: 1, class: 'M', mname: 'G12D', gene: 'KRAS' }
		const mlst = [kras, { dt: 1, class: 'M', mname: 'G12D', gene: 'NRAS' }]
		const values = []
		filterByItem(filter, mlst, values)
		t.deepEqual(values, [kras], 'values[] has only the matching gene mutation')
	}
})

/*
fusion fixtures below follow the real shape of a geneVariant value of a sv/fusion event
(see mayGetGeneVariantData): .chr/.pos are the breakpoint on the queried gene, .mname is
the partner gene, and .pairlst[0] holds both points with .pairlstIdx telling which of the
two is the queried gene.

modeled on TermdbTest_Fusion data, where the queried gene AKT1 (chr14:104779348) is fused
to TP53 at two distinct breakpoints, chr17:7674289 and chr17:7674915 -- a miniature of the
two breakpoint clusters that motivate breakpoint range filtering
*/
function makeFusion(selfPos, partnerPos, selfChr = 'chr14') {
	return {
		dt: 2,
		class: 'Fuserna',
		gene: 'AKT1',
		chr: selfChr,
		pos: selfPos,
		mname: 'TP53',
		pairlstIdx: 1, // the queried gene is the b{} point, so the partner is a{}
		pairlst: [
			{
				a: { chr: 'chr17', pos: partnerPos, name: 'TP53' },
				b: { chr: selfChr, pos: selfPos, name: 'AKT1' }
			}
		]
	}
}
const akt1_tp53_a = makeFusion(104779348, 7674289)
// same fusion in another sample, breakpoint of the partner gene is in the other cluster
const akt1_tp53_b = makeFusion(104779348, 7674915)

test('filterByItem: sv/fusion self breakpoint range', t => {
	t.plan(6)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 2, type: 'dtfusion' },
			values: [{ key: 'Fuserna', label: 'Fusion transcript', value: 'Fuserna' }],
			genotype: 'variant',
			mcount: 'any',
			selfBreakpointRange: { chr: 'chr14', start: 104779000, stop: 104780000 }
		}
	}
	{
		const [pass, tested] = filterByItem(filter, [akt1_tp53_a])
		t.equal(pass, true, 'breakpoint of queried gene within range passes')
		t.equal(tested, true, 'sample is tested')
	}
	{
		const [pass, tested] = filterByItem(filter, [makeFusion(104700000, 7674289)])
		t.equal(pass, false, 'breakpoint outside range does not pass')
		t.equal(tested, true, 'sample is still tested, a breakpoint range does not affect tested status')
	}
	{
		// range of another chr, e.g. a range of a different gene of a geneset term
		const [pass] = filterByItem(filter, [makeFusion(104779348, 7674289, 'chr9')])
		t.equal(pass, false, 'breakpoint on another chr does not pass')
	}
	{
		// events of a svfusion byname query may lack coordinates; such an event
		// cannot be shown to satisfy the range, so must not pass
		const [pass] = filterByItem(filter, [makeFusion(undefined, undefined)])
		t.equal(pass, false, 'event without a breakpoint position does not pass')
	}
})

test('filterByItem: sv/fusion partner breakpoint range', t => {
	t.plan(6)
	// select the AKT1::TP53 fusions of only the second TP53 breakpoint cluster
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 2, type: 'dtfusion' },
			values: [
				{
					key: 'Fuserna',
					label: 'TP53',
					value: 'TP53',
					mname: 'TP53',
					partnerBreakpointRange: { chr: 'chr17', start: 7674900, stop: 7674930 }
				}
			],
			genotype: 'variant',
			mcount: 'any'
		}
	}
	{
		const [pass] = filterByItem(filter, [akt1_tp53_b])
		t.equal(pass, true, 'partner breakpoint within range passes')
	}
	{
		const [pass, tested] = filterByItem(filter, [akt1_tp53_a])
		t.equal(pass, false, 'partner breakpoint of the other cluster does not pass')
		t.equal(tested, true, 'sample is tested')
	}
	{
		// the partner point is a{} when pairlstIdx=1 and b{} when 0; a wrong side
		// would make the queried gene's own breakpoint be tested against the range
		const flipped = { ...akt1_tp53_b, pairlstIdx: 0 }
		const [pass] = filterByItem(filter, [flipped])
		t.equal(pass, false, 'pairlstIdx decides which point is the partner')
	}
	{
		// multi-gene pairlst is not yet supported by the getters (.mname is left
		// unset there), so its partner cannot be identified and must not pass
		const multi = { ...akt1_tp53_b, pairlst: [...akt1_tp53_b.pairlst, ...akt1_tp53_b.pairlst] }
		const [pass] = filterByItem(filter, [multi])
		t.equal(pass, false, 'event of an unsupported pairlst shape does not pass')
	}
	{
		// a class-wide entry has no range and keeps matching any event of its class
		const withClassEntry = structuredClone(filter)
		withClassEntry.tvs.values.push({ key: 'Fuserna', label: 'Fusion transcript', value: 'Fuserna' })
		const [pass] = filterByItem(withClassEntry, [akt1_tp53_a])
		t.equal(pass, true, 'out-of-range event still matches a class-wide entry')
	}
})

test('filterByItem: self and partner breakpoint ranges apply to the same event', t => {
	t.plan(4)
	/* the whole point of testing both ranges on one event: a sample carrying two
	fusions, one satisfying the self range and the other the partner range, must NOT
	pass, as no single fusion of it satisfies both */
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 2, type: 'dtfusion' },
			values: [
				{
					key: 'Fuserna',
					label: 'TP53',
					value: 'TP53',
					mname: 'TP53',
					partnerBreakpointRange: { chr: 'chr17', start: 7674900, stop: 7674930 }
				}
			],
			genotype: 'variant',
			mcount: 'any',
			selfBreakpointRange: { chr: 'chr14', start: 104779000, stop: 104780000 }
		}
	}
	{
		const [pass] = filterByItem(filter, [akt1_tp53_b])
		t.equal(pass, true, 'one event satisfying both ranges passes')
	}
	{
		// event 1: self in range, partner in the other cluster
		// event 2: partner in range, self outside
		const event2 = makeFusion(104700000, 7674915)
		const [pass] = filterByItem(filter, [akt1_tp53_a, event2])
		t.equal(pass, false, 'two events each satisfying one range do not pass')
	}
	{
		const values = []
		filterByItem(filter, [akt1_tp53_a, akt1_tp53_b], values)
		t.deepEqual(values, [akt1_tp53_b], 'values[] has only the event satisfying both ranges')
	}
	{
		// a range narrows the matching events before they are counted
		const single = structuredClone(filter)
		single.tvs.mcount = 'single'
		const [pass] = filterByItem(single, [akt1_tp53_a, akt1_tp53_b])
		t.equal(pass, true, 'mcount counts only the events left by the ranges')
	}
})

test('filterByItem: breakpoint range boundaries are inclusive', t => {
	t.plan(4)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 2, type: 'dtfusion' },
			values: [{ key: 'Fuserna', label: 'Fusion transcript', value: 'Fuserna' }],
			genotype: 'variant',
			mcount: 'any',
			selfBreakpointRange: { chr: 'chr14', start: 104779348, stop: 104779350 }
		}
	}
	t.equal(filterByItem(filter, [akt1_tp53_a])[0], true, 'breakpoint at range start passes')
	t.equal(filterByItem(filter, [makeFusion(104779350, 7674289)])[0], true, 'breakpoint at range stop passes')
	t.equal(filterByItem(filter, [makeFusion(104779347, 7674289)])[0], false, 'breakpoint before start fails')
	t.equal(filterByItem(filter, [makeFusion(104779351, 7674289)])[0], false, 'breakpoint after stop fails')
})

test('filterByItem: breakpoint range requires a sv/fusion tvs', t => {
	t.plan(2)
	// on another dt the range would silently filter e.g. snvindels by position
	const selfRange = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
			genotype: 'variant',
			mcount: 'any',
			selfBreakpointRange: { chr: 'chr17', start: 7674900, stop: 7674930 }
		}
	}
	t.throws(
		() => filterByItem(selfRange, [{ dt: 1, class: 'M', mname: 'G12D', chr: 'chr17', pos: 7674915 }]),
		/breakpoint range requires a sv\/fusion tvs/,
		'self range on a snvindel tvs throws'
	)
	const partnerRange = structuredClone(selfRange)
	delete partnerRange.tvs.selfBreakpointRange
	partnerRange.tvs.values[0].partnerBreakpointRange = { chr: 'chr17', start: 7674900, stop: 7674930 }
	t.throws(
		() => filterByItem(partnerRange, [{ dt: 1, class: 'M', mname: 'G12D' }]),
		/breakpoint range requires a sv\/fusion tvs/,
		'partner range on a snvindel tvs throws'
	)
})

test('filterByItem: sample not tested', t => {
	t.plan(8)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'any'
		}
	}
	const mlst1 = []
	const mlst2 = [{ dt: 1, class: 'Blank' }]
	const mlst3 = [{ dt: 4, class: 'CNV_amp' }]
	const mlst4 = [
		{ dt: 1, class: 'Blank' },
		{ dt: 4, class: 'CNV_amp' }
	]
	for (const mlst of [mlst1, mlst2, mlst3, mlst4]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
})

test('filterByItem: wildtype sample matches wildtype filter', t => {
	t.plan(2)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [],
			genotype: 'wt'
		}
	}
	const mlst = [{ dt: 1, class: 'WT' }]
	const [pass, tested] = filterByItem(filter, mlst)
	t.equal(pass, true, 'Sample passes filter')
	t.equal(tested, true, 'Sample is tested')
})

test('filterByItem: mutated sample does not match wildtype filter', t => {
	t.plan(6)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [],
			genotype: 'wt'
		}
	}

	const mlst1 = [{ dt: 1, class: 'M' }]
	const mlst2 = [{ dt: 1, class: 'F' }]
	for (const mlst of [mlst1, mlst2]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}

	const mlst3 = [{ dt: 1, class: 'Blank' }]
	const [pass, tested] = filterByItem(filter, mlst3)
	t.equal(pass, false, 'Sample does not pass filter')
	t.equal(tested, false, 'Sample is not tested')
})

test('filterByItem: not tested sample matches not tested filter', t => {
	t.plan(2)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [],
			genotype: 'nt'
		}
	}
	const mlst = [{ dt: 1, class: 'Blank' }]
	const [pass, tested] = filterByItem(filter, mlst)
	t.equal(pass, true, 'Sample passes filter')
	t.equal(tested, false, 'Sample is not tested')
})

test('filterByItem: wildtype/mutated samples do not match not tested filter', t => {
	t.plan(6)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [],
			genotype: 'nt'
		}
	}
	const mlst = [{ dt: 1, class: 'WT' }]
	const [pass, tested] = filterByItem(filter, mlst)
	t.equal(pass, false, 'Sample does not pass filter')
	t.equal(tested, true, 'Sample is tested')

	const mlst1 = [{ dt: 1, class: 'M' }]
	const mlst2 = [{ dt: 1, class: 'F' }]
	for (const mlst of [mlst1, mlst2]) {
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
})

test('filterByItem: mcount=any', t => {
	t.plan(14)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'any'
		}
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' },
			{ dt: 1, class: 'D' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
})

test('filterByItem: mcount=single', t => {
	t.plan(12)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'single'
		}
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
})

test('filterByItem: mcount=multiple', t => {
	t.plan(16)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'multiple'
		}
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' },
			{ dt: 1, class: 'D' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
})

test('filterByItem: mcount=all', t => {
	t.plan(22)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'all'
		}
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'M' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' },
			{ dt: 1, class: 'D' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'Blank' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample passes filter')
		t.equal(tested, false, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'L' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, class: 'CNV_amp' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample passes filter')
		t.equal(tested, false, 'Sample is tested')
	}
})

test('filterByItem: isnot=true', t => {
	t.plan(18)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'any',
			isnot: true
		}
	}
	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'Blank' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}

	const filter2 = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'single',
			isnot: true
		}
	}
	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByItem(filter2, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'L' }
		]
		const [pass, tested] = filterByItem(filter2, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByItem(filter2, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 1, class: 'F' },
			{ dt: 1, class: 'D' }
		]
		const [pass, tested] = filterByItem(filter2, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
})

test('filterByItem: mutation, origin', t => {
	t.plan(10)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel', origin: 'somatic' },
			values: [
				{ key: 'M', label: 'MISSENSE', value: 'M' },
				{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
				{ key: 'D', label: 'PROTEINDEL', value: 'D' }
			],
			genotype: 'variant',
			mcount: 'any'
		}
	}

	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'F', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'L', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'Blank', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
})

test('filterByItem: wildtype, origin', t => {
	t.plan(10)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel', origin: 'somatic' },
			values: [],
			genotype: 'wt'
		}
	}

	{
		const mlst = [
			{ dt: 1, class: 'WT', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'F', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'Blank', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' }
		]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
})

test('filterByItem: continuous CNV', t => {
	t.plan(20)
	const filter = {
		type: 'tvs',
		tvs: {
			term: { dt: 4, type: 'dtcnv' },
			continuousCnv: true,
			cnvGainCutoff: 0.5,
			cnvLossCutoff: -0.5,
			cnvMaxLength: 100,
			values: [],
			cnvWT: false
		}
	}
	{
		const mlst = [{ dt: 4, value: 1, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes cnv gain cutoff')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: 0.3, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass cnv gain cutoff')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: -1, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes cnv loss cutoff')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: -0.3, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass cnv loss cutoff')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: 1, start: 0, stop: 150 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass cnv max length')
		t.equal(tested, true, 'Sample is tested')
	}

	// wildtype filter
	filter.tvs.cnvWT = true
	{
		const mlst = [{ dt: 4, value: 1, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass wildtype filter (cnv gain above cutoff)')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: 0.3, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes wildtype filter (cnv gain below cutoff)')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: -1, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass wildtype filter (cnv loss below cutoff)')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 4, value: -0.3, start: 0, stop: 50 }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, true, 'Sample passes wildtype filter (cnv loss above cutoff)')
		t.equal(tested, true, 'Sample is tested')
	}

	// not tested sample
	{
		const mlst = [{ dt: 1, class: 'M', origin: 'somatic' }]
		const [pass, tested] = filterByItem(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter (not tested)')
		t.equal(tested, false, 'Sample is not tested')
	}
})

test('filterByTvsLst: single tvs', t => {
	t.plan(12)
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel' },
					values: [
						{ key: 'M', label: 'MISSENSE', value: 'M' },
						{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
						{ key: 'D', label: 'PROTEINDEL', value: 'D' }
					],
					genotype: 'variant',
					mcount: 'any'
				}
			}
		]
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'L' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'Blank' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	{
		const mlst = [{ dt: 4, class: 'CNV_amp' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested for mutation type')
	}
})

test('filterByTvsLst: multiple tvs, OR join', t => {
	t.plan(12)
	const filter = {
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel' },
					values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
					genotype: 'variant',
					mcount: 'any'
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { dt: 4, type: 'dtcnv' },
					values: [{ key: 'CNV_amp', label: 'Gain', value: 'CNV_amp' }],
					genotype: 'variant',
					mcount: 'any'
				}
			}
		]
	}

	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, false, 'Sample is not tested')
	}
})

test('filterByTvsLst: multiple tvs, AND join', t => {
	t.plan(12)
	const filter = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel' },
					values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
					genotype: 'variant',
					mcount: 'any'
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { dt: 4, type: 'dtcnv' },
					values: [{ key: 'CNV_amp', label: 'Gain', value: 'CNV_amp' }],
					genotype: 'variant',
					mcount: 'any'
				}
			}
		]
	}

	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M' },
			{ dt: 4, class: 'Blank' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
})

test('filterByTvsLst: in=false', t => {
	t.plan(12)
	const filter = {
		type: 'tvslst',
		in: false,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel' },
					values: [
						{ key: 'M', label: 'MISSENSE', value: 'M' },
						{ key: 'F', label: 'FRAMESHIFT', value: 'F' },
						{ key: 'D', label: 'PROTEINDEL', value: 'D' }
					],
					genotype: 'variant',
					mcount: 'any'
				}
			}
		]
	}

	{
		const mlst = [{ dt: 1, class: 'M' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'L' },
			{ dt: 1, class: 'F' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'L' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'WT' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [{ dt: 1, class: 'Blank' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested')
	}
	{
		const mlst = [{ dt: 4, class: 'CNV_amp' }]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, false, 'Sample is not tested for mutation type')
	}
})

test('filterByTvsLst: nested tvslst', t => {
	t.plan(10)
	const tvslst_snvindel = {
		type: 'tvslst',
		in: true,
		join: 'or',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel', origin: 'somatic' },
					values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
					genotype: 'variant',
					mcount: 'any'
				}
			},
			{
				type: 'tvs',
				tvs: {
					term: { dt: 1, type: 'dtsnvindel', origin: 'germline' },
					values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
					genotype: 'variant',
					mcount: 'any'
				}
			}
		]
	}

	const tvs_cnv = {
		type: 'tvs',
		tvs: {
			term: { dt: 4, type: 'dtcnv' },
			values: [{ key: 'CNV_amp', label: 'Gain', value: 'CNV_amp' }],
			genotype: 'variant',
			mcount: 'any'
		}
	}

	const filter = {
		type: 'tvslst',
		in: true,
		join: 'and',
		lst: [tvslst_snvindel, tvs_cnv]
	}

	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 1, class: 'WT', origin: 'germline' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'WT', origin: 'somatic' },
			{ dt: 1, class: 'M', origin: 'germline' },
			{ dt: 4, class: 'WT' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, false, 'Sample does not pass filter')
		t.equal(tested, true, 'Sample is tested')
	}
	{
		const mlst = [
			{ dt: 1, class: 'M', origin: 'somatic' },
			{ dt: 1, class: 'Blank', origin: 'germline' },
			{ dt: 4, class: 'CNV_amp' }
		]
		const [pass, tested] = filterByTvsLst(filter, mlst)
		t.equal(pass, true, 'Sample passes filter')
		t.equal(tested, false, 'Sample is not tested')
	}
})

test("filterByItem: cnv overlap is measured against the value's own region", t => {
	t.plan(7)
	/* a cnv value records the region that was queried as .region, distinct from its own
	start/stop, so the overlap needs no lookup and no tw. See mayGetGeneVariantData() */
	const cnvTvs = {
		type: 'tvs',
		tvs: {
			term: { dt: 4, type: 'dtcnv' },
			values: [],
			continuousCnv: true,
			cnvGainCutoff: 0.1,
			cnvLossCutoff: -0.1,
			cnvMaxLength: null,
			fractionOverlap: 0.8
		}
	}
	// a value found through a gene entry: .gene is the symbol, .region its coordinates
	const geneRegion = { chr: 'chr17', start: 0, stop: 100 }
	{
		const seg = { dt: 4, gene: 'TP53', region: geneRegion, value: -1, start: 0, stop: 100 }
		const [pass, tested] = filterByItem(cnvTvs, [seg])
		t.equal(pass, true, 'segment spanning the queried gene passes')
		t.equal(tested, true, 'sample is tested')
	}
	{
		const seg = { dt: 4, gene: 'TP53', region: geneRegion, value: -1, start: 0, stop: 10 }
		t.equal(filterByItem(cnvTvs, [seg])[0], false, 'segment under the overlap fails')
	}

	/* a value found through a kind='coord' entry has no .gene at all. Matching a queried
	gene by name used to be the only way to size the overlap, so a region term threw */
	const region = { chr: 'chr1', start: 47213990, stop: 47318918 }
	{
		const seg = { dt: 4, region, value: -1, start: 47213990, stop: 47318918 }
		t.equal(filterByItem(cnvTvs, [seg])[0], true, 'segment spanning the queried region passes')
	}
	{
		// a focal deletion, ~10kb of a ~105kb region
		const seg = { dt: 4, region, value: -1, start: 47213990, stop: 47223990 }
		t.equal(filterByItem(cnvTvs, [seg])[0], false, 'focal segment is under the overlap')
	}
	{
		const seg = { dt: 4, gene: 'TP53', value: -1, start: 0, stop: 100 }
		t.throws(() => filterByItem(cnvTvs, [seg]), /no .region/, 'throws on a value carrying no region')
	}
	{
		// a nested sublist, as a custom groupset that mixes joins produces. No tw is
		// threaded anywhere, since the value carries everything the overlap needs
		const filter = {
			type: 'tvslst',
			in: true,
			join: 'and',
			lst: [
				{
					type: 'tvs',
					tvs: {
						term: { dt: 1, type: 'dtsnvindel' },
						values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
						genotype: 'variant',
						mcount: 'any'
					}
				},
				{ type: 'tvslst', in: true, join: 'or', lst: [cnvTvs] }
			]
		}
		const mlst = [
			{ dt: 1, class: 'M', gene: 'TP53', region: geneRegion },
			{ dt: 4, gene: 'TP53', region: geneRegion, value: -1, start: 0, stop: 100 }
		]
		t.equal(filterByTvsLst(filter, mlst)[0], true, 'a cnv tvs nested in a sublist is measured the same way')
	}
})

test('filterByTvsLst: values[] only collects mutations of a matching tvs', t => {
	t.plan(6)
	// values[] is rendered as the variants of the group a sample was assigned to,
	// so a tvs that did not match must not contribute to it
	const mutTvs = {
		type: 'tvs',
		tvs: {
			term: { dt: 1, type: 'dtsnvindel' },
			values: [{ key: 'M', label: 'MISSENSE', value: 'M' }],
			genotype: 'variant',
			mcount: 'any'
		}
	}
	const wtTvs = {
		type: 'tvs',
		tvs: { term: { dt: 1, type: 'dtsnvindel' }, values: [], genotype: 'wt' }
	}
	const cnvGainTvs = {
		type: 'tvs',
		tvs: {
			term: { dt: 4, type: 'dtcnv' },
			values: [],
			continuousCnv: true,
			cnvGainCutoff: 0.5,
			cnvLossCutoff: -0.5
		}
	}
	// a neutral cnv tvs matches a sample that has no qualifying segment, so the
	// segments it does find are why it failed, not evidence that it matched
	const cnvWtTvs = {
		type: 'tvs',
		tvs: {
			term: { dt: 4, type: 'dtcnv' },
			values: [],
			continuousCnv: true,
			cnvGainCutoff: 0.5,
			cnvLossCutoff: -0.5,
			cnvWT: true
		}
	}
	const snv = { dt: 1, class: 'M' }
	const gain = { dt: 4, value: 1, start: 0, stop: 50 }

	{
		// "mutated OR cnv neutral": the snvindel tvs assigns the sample, the cnv tvs
		// fails, so its gain segment is not a variant of the group
		const filter = { type: 'tvslst', in: true, join: 'or', lst: [mutTvs, cnvWtTvs] }
		const values = []
		const [pass] = filterByTvsLst(filter, [snv, gain], values)
		t.equal(pass, true, 'Sample passes on the matching tvs of an or join')
		t.deepEqual(values, [snv], 'should collect the mutation of the matching tvs only')
	}
	{
		// a sublist that fails contributes nothing, even though its own cnv tvs matched
		const filter = {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [mutTvs, { type: 'tvslst', in: true, join: 'and', lst: [cnvGainTvs, wtTvs] }]
		}
		const values = []
		const [pass] = filterByTvsLst(filter, [snv, gain], values)
		t.equal(pass, true, 'Sample passes on the matching tvs of an or join')
		t.deepEqual(values, [snv], 'should discard the mutations of a failing sublist')
	}
	{
		/* the gain segment matches the cnv tvs of the negated sublist, which is exactly
		why that sublist rejects the sample. the sample is assigned by the snvindel tvs
		of the or join instead, so the segment is not a variant of the group */
		const filter = {
			type: 'tvslst',
			in: true,
			join: 'or',
			lst: [mutTvs, { type: 'tvslst', in: false, join: '', lst: [cnvGainTvs] }]
		}
		const values = []
		const [pass] = filterByTvsLst(filter, [snv, gain], values)
		t.equal(pass, true, 'Sample passes on the matching tvs of an or join')
		t.deepEqual(values, [snv], 'should discard the mutations matched by a negated sublist')
	}
})

test('mayFilterByMaf: basic mafFilter', t => {
	t.plan(12)

	// start bounded, stop unbounded
	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,20' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '30,70' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,5' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	// start and stop bounded
	const mafFilter2 = structuredClone(mafFilter)
	mafFilter2.lst[0].tvs.ranges = [
		{
			start: 0.1,
			stop: 0.6,
			startinclusive: true,
			stopinclusive: true,
			startunbounded: false,
			stopunbounded: false
		}
	]

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter2, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,5' }
		const pass = mayFilterByMaf(mafFilter2, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '30,70' }
		const pass = mayFilterByMaf(mafFilter2, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	// start unbounded, stop bounded
	const mafFilter3 = structuredClone(mafFilter)
	mafFilter3.lst[0].tvs.ranges = [{ stop: 0.6, stopinclusive: true, startunbounded: true }]

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter3, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,5' }
		const pass = mayFilterByMaf(mafFilter3, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,2' }
		const pass = mayFilterByMaf(mafFilter3, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '30,70' }
		const pass = mayFilterByMaf(mafFilter3, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}
})

test('mayFilterByMaf: mafFilter with child ids', t => {
	t.plan(7)

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WES: '70,30' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,5' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30', tumor_DNA_WES: '70,30' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,10' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,10', tumor_DNA_WES: '70,2' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,2', tumor_DNA_WES: '70,10' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}
})

test('mayFilterByMaf: basic mafFilter, min allelic depth', t => {
	t.plan(11)

	// default allelic depth
	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,1' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '0,1' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,0' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '0,0' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M' }
		const pass = mayFilterByMaf(mafFilter, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	// min allelic depth = 100
	const mafFilter_100 = structuredClone(mafFilter)
	mafFilter_100.lst[0].tvs.minAllelicDepth = 100

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,40' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,20' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,10' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '140,20' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}
})

test('mayFilterByMaf: mafFilter with child ids, min allelic depth', t => {
	t.plan(14)

	// default allelic depth
	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30', tumor_DNA_WES: '70,30' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,1', tumor_DNA_WES: '1,1' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,1', tumor_DNA_WES: '1,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,1', tumor_DNA_WES: '0,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '0,1', tumor_DNA_WES: '0,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '1,0', tumor_DNA_WES: '0,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '0,0', tumor_DNA_WES: '1,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '0,0', tumor_DNA_WES: '0,0' }
		const pass = mayFilterByMaf(mafFilter_childIds, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	// min allelic depth = 100
	const mafFilter_100 = structuredClone(mafFilter_childIds)
	mafFilter_100.lst[0].tvs.minAllelicDepth = 100

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '70,30', tumor_DNA_WES: '70,30' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '50,20', tumor_DNA_WES: '30,5' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '50,20', tumor_DNA_WES: '20,5' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '50,20', tumor_DNA_WES: '10,5' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '90,15', tumor_DNA_WES: '0,0' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, true, 'Sample passes filter')
	}

	{
		const m = { dt: 1, class: 'M', tumor_DNA_WGS: '90,15', tumor_DNA_WES: '90,5' }
		const pass = mayFilterByMaf(mafFilter_100, m)
		t.equal(pass, false, 'Sample does not pass filter')
	}
})

test('mayFilterByMaf: total depth filter', t => {
	t.plan(4)
	// total depth >= 100
	t.equal(mayFilterByMaf(mafFilter_totalDepth, { dt: 1, class: 'M', tumor_DNA_WGS: '70,40' }), true, '110 passes')
	t.equal(
		mayFilterByMaf(mafFilter_totalDepth, { dt: 1, class: 'M', tumor_DNA_WGS: '70,20' }),
		false,
		'90 does not pass'
	)
	t.equal(
		mayFilterByMaf(mafFilter_totalDepth, { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }),
		true,
		'100 passes (inclusive)'
	)
	t.equal(mayFilterByMaf(mafFilter_totalDepth, { dt: 1, class: 'M' }), false, 'unannotated does not pass')
})

test('mayFilterByMaf: alt allele depth filter', t => {
	t.plan(3)
	// alt depth >= 20
	t.equal(mayFilterByMaf(mafFilter_altDepth, { dt: 1, class: 'M', tumor_DNA_WGS: '10,25' }), true, 'alt 25 passes')
	t.equal(
		mayFilterByMaf(mafFilter_altDepth, { dt: 1, class: 'M', tumor_DNA_WGS: '10,15' }),
		false,
		'alt 15 does not pass'
	)
	t.equal(mayFilterByMaf(mafFilter_altDepth, { dt: 1, class: 'M' }), false, 'unannotated does not pass')
})

test('mayFilterByMaf: AND combination of maf and alt depth', t => {
	t.plan(4)
	// maf > 0.1 AND alt depth >= 20
	t.equal(mayFilterByMaf(mafFilter_and, { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }), true, 'both pass')
	t.equal(mayFilterByMaf(mafFilter_and, { dt: 1, class: 'M', tumor_DNA_WGS: '10,15' }), false, 'only maf passes')
	t.equal(mayFilterByMaf(mafFilter_and, { dt: 1, class: 'M', tumor_DNA_WGS: '300,25' }), false, 'only alt depth passes')
	t.equal(mayFilterByMaf(mafFilter_and, { dt: 1, class: 'M', tumor_DNA_WGS: '300,5' }), false, 'neither passes')
})

test('mayFilterByMaf: OR combination of maf and alt depth', t => {
	t.plan(4)
	// maf > 0.1 OR alt depth >= 20
	t.equal(mayFilterByMaf(mafFilter_or, { dt: 1, class: 'M', tumor_DNA_WGS: '70,30' }), true, 'both pass')
	t.equal(mayFilterByMaf(mafFilter_or, { dt: 1, class: 'M', tumor_DNA_WGS: '10,15' }), true, 'only maf passes')
	t.equal(mayFilterByMaf(mafFilter_or, { dt: 1, class: 'M', tumor_DNA_WGS: '300,25' }), true, 'only alt depth passes')
	t.equal(mayFilterByMaf(mafFilter_or, { dt: 1, class: 'M', tumor_DNA_WGS: '300,5' }), false, 'neither passes')
})

test('mayValidateBcfMafFilter: validate and auto-populate depth terms', t => {
	t.plan(11)

	const format = {
		tumor_DNA_WGS: { ID: 'tumor_DNA_WGS', Number: 'R', Type: 'Integer', Description: 'Tumor DNA WGS' },
		GT: { ID: 'GT', Number: '1', Type: 'String', isGT: true }
	}
	const makeQ = () => ({
		byrange: { _tk: { format } },
		mafFilter: {
			opts: { joinWith: ['and', 'or'] },
			filter: { type: 'tvslst', join: '', in: true, lst: [] },
			terms: [{ id: 'tumor_DNA_WGS', name: 'Tumor DNA WGS', parent_id: null, isleaf: true, type: 'float' }]
		}
	})

	const q = makeQ()
	t.doesNotThrow(() => mayValidateBcfMafFilter(q), 'does not throw on valid filter')
	t.equal(q.mafFilter.terms.length, 3, 'appended exactly 2 depth terms (1 user term + 2 generated)')
	const generated = q.mafFilter.terms.filter(tm => tm.mafFilterMode)
	t.deepEqual(
		generated.map(tm => tm.mafFilterMode).sort(),
		['altDepth', 'totalDepth'],
		'generated totalDepth and altDepth terms'
	)
	t.ok(
		generated.every(tm => tm.mafFormatKey == 'tumor_DNA_WGS'),
		'generated terms reference the source FORMAT key, GT skipped'
	)

	// idempotency: a second call does not double-append
	mayValidateBcfMafFilter(q)
	t.equal(q.mafFilter.terms.length, 3, 'second call does not double-append')

	// missing FORMAT key throws
	const qBad = makeQ()
	qBad.mafFilter.terms[0].id = 'no_such_field'
	t.throws(() => mayValidateBcfMafFilter(qBad), /unknown FORMAT key/, 'throws on unknown FORMAT key')

	// no FORMAT anywhere (neither byrange._tk.format nor q.format) throws when mafFilter present
	const qNoFormat = makeQ()
	delete qNoFormat.byrange._tk.format
	t.throws(() => mayValidateBcfMafFilter(qNoFormat), /no FORMAT/, 'throws when format missing')

	// a dataset-configured depth term with a valid mafFormatKey passes validation
	const qDepth = makeQ()
	qDepth.mafFilter.terms.push({
		id: 'my_total_depth',
		name: 'my total depth',
		parent_id: null,
		isleaf: true,
		type: 'integer',
		mafFilterMode: 'totalDepth',
		mafFormatKey: 'tumor_DNA_WGS'
	})
	t.doesNotThrow(() => mayValidateBcfMafFilter(qDepth), 'configured depth term with valid mafFormatKey passes')

	// a configured depth term missing mafFormatKey throws
	const qNoKey = makeQ()
	qNoKey.mafFilter.terms.push({
		id: 'bad_depth',
		name: 'bad',
		parent_id: null,
		isleaf: true,
		type: 'integer',
		mafFilterMode: 'altDepth'
	})
	t.throws(
		() => mayValidateBcfMafFilter(qNoKey),
		/missing mafFormatKey/,
		'configured depth term without mafFormatKey throws'
	)

	// a configured depth term with an unknown mafFormatKey throws
	const qBadKey = makeQ()
	qBadKey.mafFilter.terms.push({
		id: 'bad_depth',
		name: 'bad',
		parent_id: null,
		isleaf: true,
		type: 'integer',
		mafFilterMode: 'totalDepth',
		mafFormatKey: 'no_such_field'
	})
	t.throws(
		() => mayValidateBcfMafFilter(qBadKey),
		/unknown FORMAT key/,
		'configured depth term with unknown mafFormatKey throws'
	)

	// an unknown mafFilterMode throws
	const qBadMode = makeQ()
	qBadMode.mafFilter.terms[0].mafFilterMode = 'bogus'
	t.throws(() => mayValidateBcfMafFilter(qBadMode), /unknown mafFilterMode/, 'unknown mafFilterMode throws')
})

test('mayValidateBcfMafFilter: GDC-shaped q resolves FORMAT from q.format', t => {
	t.plan(2)
	// GDC has a byrange with no _tk.format; its FORMAT is on q.format. The `|| q.format` fallback in
	// mayValidateBcfMafFilter is the whole reason GDC MAF works — guard it so a cleanup can't silently
	// break GDC (validation would then throw /no FORMAT/ and take down the GDC snvindel query).
	const q = {
		byrange: {},
		format: { TumorAC: { ID: 'TumorAC', Number: 'R', Type: 'Integer', Description: 'tumor allele counts' } },
		mafFilter: {
			opts: { joinWith: ['and', 'or'] },
			filter: { type: 'tvslst', join: '', in: true, lst: [] },
			terms: [{ id: 'TumorAC', name: 'Tumor MAF', parent_id: null, isleaf: true, type: 'float' }]
		}
	}
	t.doesNotThrow(() => mayValidateBcfMafFilter(q), 'GDC-shaped q (format on q.format) passes validation')
	t.equal(q.mafFilter.terms.length, 3, 'auto-populated totalDepth + altDepth terms from q.format')
})

test('toBreakpointPos: parses breakpoint positions', t => {
	t.plan(6)
	// positions of the svfusion byname file are strings and must become numbers, so that
	// a breakpoint of either file format can be compared against a range and tallied by
	// the same key
	t.equal(toBreakpointPos('130713016'), 130713016, 'numeric string converted to number')
	t.equal(toBreakpointPos(130713016), 130713016, 'number kept as is')
	// a breakpoint without position must stay undefined and not become 0, otherwise an
	// event lacking coordinates would appear to have one at the start of the chromosome
	t.equal(toBreakpointPos(''), undefined, 'empty string yields undefined')
	t.equal(toBreakpointPos(undefined), undefined, 'undefined yields undefined')
	t.equal(toBreakpointPos(null), undefined, 'null yields undefined')
	t.equal(toBreakpointPos('n/a'), undefined, 'non-numeric string yields undefined')
})

test('svfusionByNameGetter_file: breakpoint positions of the file', async t => {
	/* the byname file may lack a breakpoint position on either gene of an event. such a
	breakpoint must come out undefined, both on the event (read by getSelfBreakpoint) and
	on the pairlst point of the same gene (read by getPartnerBreakpoints), so that the
	event is reported as lacking a coordinate rather than placed at position 0 */
	const tmpdir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pp-svfusion-byname-'))
	try {
		const file = path.join(tmpdir, 'fusion.txt')
		const header = [
			'sample_name',
			'gene_a',
			'chr_a',
			'position_a',
			'strand_a',
			'gene_b',
			'chr_b',
			'position_b',
			'strand_b',
			'event_type',
			'origin'
		]
		const rows = [
			// queried gene is gene_a and has no position, the partner has one
			['sample1', 'BCR', 'chr22', '', '+', 'ABL1', 'chr9', '130713016', '+', 'fusion', 'somatic'],
			// both genes have a position
			['sample2', 'BCR', 'chr22', '23290100', '+', 'ABL1', 'chr9', '130713016', '+', 'fusion', 'somatic'],
			// queried gene is gene_b and has no position
			['sample3', 'ABL1', 'chr9', '130713016', '+', 'BCR', 'chr22', '', '+', 'fusion', 'somatic']
		]
		await fs.promises.writeFile(file, [header, ...rows].map(l => l.join('\t')).join('\n') + '\n')

		const ds = {
			queries: { svfusion: { byname: { file } } },
			// the file names samples, map each to the integer id of the term db
			cohort: { termdb: { q: { sampleName2id: name => Number(name.replace('sample', '')) } } }
		}
		const genome = { chrlookup: { CHR22: { name: 'chr22', len: 50818468 } } }
		const get = await svfusionByNameGetter_file(ds, genome)
		const events = await get({ rglst: [{ chr: 'chr22', start: 23180000, stop: 23320000, name: 'BCR' }] })

		t.equal(events.length, 3, 'an event is returned for each line')
		// events are keyed by their breakpoint on the queried gene, find each by its sample
		const bySample = new Map(events.map(e => [e.samples[0].sample_id, e]))

		const noSelfPos = bySample.get(1)
		t.equal(noSelfPos.pos, undefined, 'blank position of the queried gene yields no event position')
		t.equal(noSelfPos.pairlst[0].a.pos, undefined, 'and none on its pairlst point')
		t.equal(noSelfPos.pairlst[0].b.pos, 130713016, 'position of the partner gene is kept')

		const bothPos = bySample.get(2)
		t.equal(bothPos.pos, 23290100, 'position of the queried gene is converted to number')
		t.equal(bothPos.pairlst[0].a.pos, 23290100, 'and is the same on its pairlst point')

		// the queried gene is gene_b here, covering the other branch of the conversion
		const noSelfPosB = bySample.get(3)
		t.equal(noSelfPosB.pos, undefined, 'blank position yields none when the queried gene is gene_b')
		t.equal(noSelfPosB.pairlst[0].b.pos, undefined, 'and none on its pairlst point')

		/* the event position and the pairlst point of the queried gene are the same
		breakpoint, so must be derived the same way; a mismatch would let an event without a
		coordinate satisfy a breakpoint range */
		for (const e of events) {
			const self = e.pairlstIdx === 0 ? e.pairlst[0].a : e.pairlst[0].b
			t.equal(e.pos, self.pos, `event position agrees with its pairlst point (sample${e.samples[0].sample_id})`)
		}
	} finally {
		await fs.promises.rm(tmpdir, { recursive: true, force: true })
		t.end()
	}
})

const mafFilter = {
	type: 'tvslst',
	join: '',
	in: true,
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: {
					id: 'tumor_DNA_WGS',
					name: 'Tumor DNA WGS',
					parent_id: null,
					isleaf: true,
					type: 'float',
					default: true,
					min: 0,
					max: 1
				},
				ranges: [
					{
						start: 0.1,
						startinclusive: false,
						startunbounded: false,
						stopunbounded: true
					}
				],
				minAllelicDepth: 1
			}
		}
	]
}

const mafFilter_totalDepth = {
	type: 'tvslst',
	join: '',
	in: true,
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: {
					id: 'tumor_DNA_WGS__totalDepth',
					name: 'Tumor DNA WGS total depth',
					parent_id: null,
					isleaf: true,
					type: 'integer',
					mafFilterMode: 'totalDepth',
					mafFormatKey: 'tumor_DNA_WGS',
					min: 0
				},
				ranges: [{ start: 100, startinclusive: true, startunbounded: false, stopunbounded: true }]
			}
		}
	]
}

const mafFilter_altDepth = {
	type: 'tvslst',
	join: '',
	in: true,
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: {
					id: 'tumor_DNA_WGS__altDepth',
					name: 'Tumor DNA WGS alt depth',
					parent_id: null,
					isleaf: true,
					type: 'integer',
					mafFilterMode: 'altDepth',
					mafFormatKey: 'tumor_DNA_WGS',
					min: 0
				},
				ranges: [{ start: 20, startinclusive: true, startunbounded: false, stopunbounded: true }]
			}
		}
	]
}

// maf > 0.1 combined with alt depth >= 20, used for AND/OR combination tests
const mafComboLst = [structuredClone(mafFilter.lst[0]), structuredClone(mafFilter_altDepth.lst[0])]
const mafFilter_and = { type: 'tvslst', join: 'and', in: true, lst: structuredClone(mafComboLst) }
const mafFilter_or = { type: 'tvslst', join: 'or', in: true, lst: structuredClone(mafComboLst) }

const mafFilter_childIds = {
	type: 'tvslst',
	join: '',
	in: true,
	lst: [
		{
			type: 'tvs',
			tvs: {
				term: {
					id: 'tumor_DNA',
					name: 'Tumor DNA',
					parent_id: null,
					child_ids: ['tumor_DNA_WGS', 'tumor_DNA_WES'],
					isleaf: true,
					type: 'float',
					default: true,
					min: 0,
					max: 1
				},
				ranges: [
					{
						start: 0.1,
						startinclusive: false,
						startunbounded: false,
						stopunbounded: true
					}
				],
				minAllelicDepth: 1
			}
		}
	]
}
