import tape from 'tape'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { readFastaRegion } from '#src/fasta.ts'
import { get_fasta } from '#src/utils.js'

/*
test sections:

readFastaRegion(): a bgzipped and a plain fasta file
readFastaRegion(): rejected arguments
get_fasta()
*/

const tp = path.resolve(serverconfig.tpmasterdir)
// chrA has 1000 bases, 70 on each line, and chrB has 333, 7 on each line; test.fa.gz is the same, bgzipped
const plain = 'files/hg38/fasta/test.fa'
const bgzipped = 'files/hg38/fasta/test.fa.gz'

async function rejects(test, fn: () => Promise<unknown>, pattern: RegExp, msg: string) {
	try {
		await fn()
		test.fail(msg)
	} catch (e) {
		test.match(String(e), pattern, msg)
	}
}

tape('\n', test => {
	test.comment('-***- fasta specs -***-')
	test.end()
})

tape('readFastaRegion(): a bgzipped and a plain fasta file', async test => {
	// as samtools faidx 1.24, which wraps the sequence by the line length of the chromosome in the fasta file
	const cases: [string, number, number, string][] = [
		['chrB', 5, 30, '>chrB:5-30\nAgatact\ncgtCtcG\ngGAGacG\nagaNa'],
		[
			'chrA',
			1,
			150,
			'>chrA:1-150\nGCaCtttgTCtAggAtaTCcAAANAgTgANTttNTcTTtaAgNCGaCcNgNTaatNgAtTggGcNcCtNC\n' +
				'GNgctAtAagGGNTATNNTgNcctaNAgNGNNTgAtcNTNgtcgcANNctATGNGCNaACCAtAaTaCGc\naCGGaNGaat'
		],
		['chrA', 991, 1000, '>chrA:991-1000\nGNGaAgAcgg'],
		['chrA', 1000, 1000, '>chrA:1000-1000\ng']
	]
	for (const file of [bgzipped, plain, path.join(tp, bgzipped)]) {
		for (const [chr, start, stop, fasta] of cases) {
			test.equal(await readFastaRegion(file, chr, start, stop), fasta, `should read ${chr}:${start}-${stop} of ${file}`)
		}
	}
	test.end()
})

tape('readFastaRegion(): rejected arguments', async test => {
	for (const [label, args, pattern] of [
		['a chr that is not in the file', [bgzipped, 'chrC', 1, 2], /chromosome not found/],
		// samtools faidx warns about such a region, which get_fasta() rejected
		['a stop after the chr end', [bgzipped, 'chrA', 990, 1001], /beyond the chromosome end/],
		['a start of 0', [bgzipped, 'chrA', 0, 10], /invalid region/],
		['a stop before the start', [bgzipped, 'chrA', 10, 9], /invalid region/],
		['a fractional coordinate', [bgzipped, 'chrA', 1.5, 9], /invalid region/],
		['a file outside tp', ['/etc/passwd', 'chrA', 1, 2], /invalid fasta file/],
		['a file with a .. segment', ['files/../../x.fa', 'chrA', 1, 2], /invalid fasta file/],
		['a file that does not exist', ['files/none.fa', 'chrA', 1, 2], /cannot open the fasta file/],
		['a file without a .fai index', ['files/hg38/TermdbTest/trackLst/facet.json', 'chrA', 1, 2], /\.fai index/]
	] as const) {
		await rejects(
			test,
			() => readFastaRegion(...(args as [string, string, number, number])),
			pattern,
			`should reject ${label}`
		)
	}
	// a bgzipped file must have the .gzi index, which samtools faidx would otherwise write next to it
	const dir = fs.mkdtempSync(path.join(tp, 'files/pp-fasta-'))
	try {
		fs.copyFileSync(path.join(tp, bgzipped), path.join(dir, 'a.fa.gz'))
		fs.copyFileSync(path.join(tp, bgzipped + '.fai'), path.join(dir, 'a.fa.gz.fai'))
		await rejects(
			test,
			() => readFastaRegion(path.join(dir, 'a.fa.gz'), 'chrA', 1, 2),
			/\.gzi index/,
			'should reject a bgzipped file without a .gzi index'
		)
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
	test.end()
})

tape('get_fasta()', async test => {
	const chrlookup = { CHRA: { name: 'chrA', len: 1000 }, CHRB: { name: 'chrB', len: 333 } }
	const gn = { genomefile: bgzipped, chrlookup }
	test.equal(await get_fasta(gn, 'chrB:5-30'), '>chrB:5-30\nAgatact\ncgtCtcG\ngGAGacG\nagaNa', 'should read a region')
	test.equal(
		await get_fasta(gn, 'CHRB:5-30'),
		'>chrB:5-30\nAgatact\ncgtCtcG\ngGAGacG\nagaNa',
		'should use the canonical chr name'
	)
	for (const [label, g, coord, pattern] of [
		['a coordinate that is an option', gn, '-o', /invalid coordinate/],
		['a chromosome without a range', gn, 'chrA', /invalid coordinate/],
		['a coordinate outside the chromosome', gn, 'chrA:100-99999999', /invalid coordinate/],
		['a genome fasta outside tp', { ...gn, genomefile: '/etc/passwd' }, 'chrA:100-200', /invalid fasta file/]
	] as const) {
		await rejects(test, () => get_fasta(g, coord), pattern, `should reject ${label}`)
	}
	test.end()
})
