import tape from 'tape'
import path from 'path'
import { fileURLToPath } from 'url'
import { compileKb, getGeneLookup, parseIndex, readKbFiles } from '../kb.ts'
import { parseKbText } from '../kbFormat.ts'
import { kbText, match } from './fixture.ts'

/*
Tests:
	the kb files of server/genome/driverKb parse, with a license for each source
	the enhancer rules have the coordinates of each build
	compileKb() of the kb files without a gene db keeps the rules that match by name
	parseIndex() rejects an invalid locus and cnv calls
	parseKbText() rejects invalid files and rows
*/

const indexFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../genome/driverKb/index.json')

tape('\n', test => {
	test.comment('-***- driverRank kb file specs -***-')
	test.end()
})

tape('the kb files of server/genome/driverKb', test => {
	const input = readKbFiles(indexFile, 'hg38')
	test.deepEqual(
		input.sources.map(s => s.id),
		['hotspots', 'civic', 'curated'],
		'should read the sources in the order of index.json'
	)
	for (const s of input.sources) test.ok(s.license, `source ${s.id} should have a license`)
	test.equal(input.sources[0].license, 'ODbL-1.0', 'the Cancer Hotspots file should be under the ODbL')
	test.ok(input.sources[0].attribution, 'the Cancer Hotspots file should give its attribution')
	test.ok(input.rows.length > 2000, `should have the rules of every file (${input.rows.length})`)
	test.equal(new Set(input.rows.map(r => r.id)).size, input.rows.length, 'rule ids should be unique across the files')
	test.match(input.version, /^[0-9a-f]{12}$/, 'should have a version hash')
	test.deepEqual(
		input.rows.find(r => r.id == 'curated:MYC-N-Me')?.regions,
		{
			hg19: { chr: 'chr8', start: 130180065, stop: 130180972 },
			hg38: { chr: 'chr8', start: 129167819, stop: 129168726 }
		},
		'should have the hg19 and hg38 coordinates of N-Me'
	)
	test.equal(input.build, 'hg38', 'should have the build')

	const kb = compileKb(input, getGeneLookup(null))
	test.ok(kb.snv.get('KRAS')?.get(12), 'should index the KRAS G12 hotspot')
	test.ok(kb.fusionPair.get('BCR::ABL1'), 'should index BCR::ABL1')
	test.ok(kb.skipped.length > 0, 'without a gene db, should leave out the rules that match by coordinates')
	test.end()
})

tape('parseIndex() rejects an invalid locus and cnv calls', test => {
	const index = (loci: any, m: any = match) => ({
		format: 'driverKb/1',
		sources: [{ id: 'a', file: 'a.txt' }],
		loci,
		match: m
	})
	test.deepEqual(
		parseIndex(index({ IGH: { genePattern: '^IGH', chr: 'chr14' } }), 'f').loci,
		{ IGH: { genePattern: '^IGH', chr: 'chr14' } },
		'should parse a locus'
	)
	const calls = (c: any) => ({ ...match, cnv: { ...match.cnv, calls: { log2ratio: c } } })
	const bad: [string, any, RegExp][] = [
		['a locus without genePattern', index({ E: { regions: { hg38: 'chr8:10-20' } } }), /genePattern missing/],
		['an invalid genePattern', index({ E: { genePattern: '(' } }), /not a regular expression/],
		['a chr that is not a string', index({ E: { genePattern: '^E', chr: 14 } }), /loci.E.chr must be a string/],
		['a gain above amp', index({}, calls({ amp: 1, gain: 1.5, del: -0.3, deepDel: -1 })), /del < gain <= amp/],
		['a gain below del', index({}, calls({ amp: 1, gain: -0.5, del: -0.3, deepDel: -1 })), /del < gain <= amp/]
	]
	for (const [name, json, error] of bad) test.throws(() => parseIndex(json, 'f'), error, `should reject ${name}`)
	test.end()
})

tape('parseKbText() rejects invalid files and rows', test => {
	const ok = { id: 'x:1', kind: 'snv', gene: 'KRAS', start: 12, ref: 'G', alt: 'D', tier: 1 }
	const enhancer = {
		id: 'x:2',
		kind: 'enhancer',
		gene: 'MYC',
		partner: 'E',
		alt: 'gain',
		region: 'hg19=chr8:10-20, hg38=chr8:30-40',
		tier: 2
	}
	test.equal(parseKbText(kbText([ok]), 'f', 'x').rows[0].alts[0], 'D', 'should parse a valid row')
	test.deepEqual(
		parseKbText(kbText([enhancer]), 'f', 'x').rows[0].regions,
		{ hg19: { chr: 'chr8', start: 10, stop: 20 }, hg38: { chr: 'chr8', start: 30, stop: 40 } },
		'should parse the regions of an enhancer row'
	)
	test.equal(
		parseKbText(kbText([ok]).replace(/\t+$/gm, ''), 'f', 'x').rows.length,
		1,
		'should accept a row whose blank trailing cells lost their tabs'
	)
	const bad: [string, string, RegExp][] = [
		['unknown kind', kbText([{ ...ok, kind: 'snp' }]), /unknown kind/],
		['missing required cell', kbText([{ ...ok, ref: '' }]), /snv requires ref/],
		['invalid alt', kbText([{ ...ok, alt: 'X' }]), /invalid alt/],
		['tier 3', kbText([{ ...ok, tier: 3 }]), /tier must be 1 or 2/],
		['id of another source', kbText([{ ...ok, id: 'y:1' }]), /does not start with 'x:'/],
		['duplicate id', kbText([ok, ok]), /duplicate id/],
		['end before start', kbText([{ ...ok, kind: 'inframe', start: 10, end: 5 }]), /end is before start/],
		['unknown exon change', kbText([{ ...ok, kind: 'exon', exon: '11', alt: 'some' }]), /alt of exon/],
		['invalid exon', kbText([{ ...ok, kind: 'exon', exon: '2-1', alt: 'any' }]), /invalid exon range/],
		['enhancer without locus', kbText([{ ...enhancer, partner: '' }]), /enhancer requires partner/],
		['enhancer without region', kbText([{ ...enhancer, region: '' }]), /enhancer requires region/],
		['enhancer change', kbText([{ ...enhancer, alt: 'any' }]), /alt of enhancer must be gain/],
		['invalid region', kbText([{ ...enhancer, region: 'chr8:10-20' }]), /region must be <build>=/],
		['region ending before start', kbText([{ ...enhancer, region: 'hg38=chr8:20-10' }]), /invalid region/],
		['two regions of a build', kbText([{ ...enhancer, region: 'hg38=chr8:1-2,hg38=chr8:3-4' }]), /two regions of hg38/],
		['region of another kind', kbText([{ ...ok, region: 'hg38=chr8:1-2' }]), /region is only for enhancer rows/],
		['no license', kbText([ok], { license: '' }), /#license missing/],
		['other format', kbText([ok], { format: 'other' }), /#format is not/],
		['no header', '#format=driverKb/1\n', /no header/]
	]
	for (const [name, text, error] of bad) {
		test.throws(() => parseKbText(text, 'f', 'x'), error, `should reject: ${name}`)
	}
	test.end()
})
