import tape from 'tape'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { spawnSync } from 'child_process'
import serverconfig from '../serverconfig.js'
import * as utils from '../utils.js'
import { api as ntseqApi } from '../routes/ntseq.ts'
import { api as dsdataApi } from '../routes/dsdata.ts'
import bamRequestClosure from '../bam.js'
import { mdsjunction_request_closure } from '../mds.junction.js'
import { handle_singlecell_closure } from '../singlecell.js'
import { handle_mdssurvivalplot } from '../km.js'
import { handle_request_closure as termdbClosure } from '../termdb.js'
import { setRoutes } from '../app.unorg.js'

/*
Regression specs for argument injection (CWE-88) into samtools/tabix argv.

A request value that lands in a samtools/tabix argv and starts with "-" is parsed as an option, e.g.
coord="-cr/etc/passwd" made `samtools faidx` read and echo a server file, a region chr="-o/path" made
`samtools view` write to an arbitrary path, and chr="-fc" made tabix rebuild a track index.
Each route below is driven with those payloads; the request must be rejected before any tool runs.
When samtools/tabix are installed, the specs also assert on the filesystem that nothing was read,
written or re-indexed; those assertions are skipped when the binaries are absent.

test sections:
- get_fasta() defense in depth with '--'
- /ntseq
- /tkbam
- /mdsjunction
- /dsdata
- /singlecell
- /mdssurvivalplot
- /termdb?getLDdata
- spawnTool() central guard
- /mdsgeneboxplot and /isoformbycoord, via the real route table
*/

const hasSamtools = spawnSync(serverconfig.samtools, ['--version']).status === 0
const hasTabix = spawnSync(serverconfig.tabix, ['--version']).status === 0

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-argv-'))
const leakMarker = 'LEAK_MARKER_' + crypto.randomUUID()
const leakFile = path.join(tmpdir, 'private.txt')
fs.writeFileSync(leakFile, leakMarker + '\n')

// payloads from the disclosure, plus variants for other options
const outFile = path.join(tmpdir, 'written-by-samtools.sam')
const chrAttacks = [`-o${outFile}`, '-fc', `-cr${leakFile}`, '--help', 'chrNotInGenome']

function getGenome(genomefile = 'NA') {
	return {
		name: 'hg38',
		genomefile,
		chrlookup: {
			CHR1: { name: 'chr1', len: 248956422 },
			CHR17: { name: 'chr17', len: 83257441 }
		},
		datasets: {}
	}
}

async function send(handler, query) {
	const sent = []
	const req = { query, get: () => undefined }
	const res = { send: x => sent.push(x), status: () => res, header: () => {}, set: () => {} }
	await handler(req, res)
	return sent[0]
}

function sha(file) {
	return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

tape('\n', function (test) {
	test.comment('-***- argv injection specs -***-')
	test.end()
})

tape('get_fasta() defense in depth with "--"', async test => {
	if (!hasSamtools) {
		test.comment('samtools not found, skipped')
		return test.end()
	}
	const fa = path.join(tmpdir, 'ref.fa')
	fs.writeFileSync(fa, '>chr1\nACGTACGTAC\n')
	const g = getGenome(fa)
	test.equal(await utils.get_fasta(g, 'chr1:2-5'), '>chr1:2-5\nCGTA', 'should return sequence from a real fasta')

	// even if a genome declared a chr that looks like an option, '--' keeps samtools from parsing it as one
	const evil = `-cr${leakFile}`
	g.chrlookup[evil.toUpperCase()] = { name: evil, len: 10 }
	// check the outcome whether get_fasta() resolves or rejects, so a leak on stdout cannot pass silently
	const out = await utils.get_fasta(g, `${evil}:1-2`).catch(e => e)
	test.notOk(String(out).includes(leakMarker), 'should not read the file named in an option-like region')
	test.end()
})

tape('/ntseq', async test => {
	const handler = ntseqApi.methods.get.init({ genomes: { hg38: getGenome() } })

	const ok = await send(handler, { genome: 'hg38', coord: 'chr17:10-12' })
	test.deepEqual(ok, { seq: 'NNN' }, 'should return sequence for a valid coord')

	for (const coord of [`-cr${leakFile}`, `--fai-idx=${tmpdir}/pwn.fai`, 'chr1:1-2 -o/x', 'chrX:1-2', ['chr1:1-2']]) {
		const r = await send(handler, { genome: 'hg38', coord })
		test.deepEqual(r, { error: 'cannot get sequence' }, `should reject coord=${JSON.stringify(coord)}`)
	}

	if (hasSamtools) {
		const fa = path.join(tmpdir, 'ntseq.fa')
		fs.writeFileSync(fa, '>chr1\nACGTACGTAC\n')
		const realHandler = ntseqApi.methods.get.init({ genomes: { hg38: getGenome(fa) } })
		const leak = await send(realHandler, { genome: 'hg38', coord: `-cr${leakFile}` })
		test.notOk(JSON.stringify(leak).includes(leakMarker), 'should not leak file contents through the error message')
		await send(realHandler, { genome: 'hg38', coord: `--fai-idx=${tmpdir}/pwn.fai` })
		test.notOk(fs.existsSync(`${tmpdir}/pwn.fai`), 'should not write an index to a requested path')
	} else {
		test.comment('samtools not found, skipped the filesystem assertions')
	}
	test.end()
})

tape('/tkbam', async test => {
	const handler = bamRequestClosure({ hg38: getGenome() })

	for (const chr of chrAttacks) {
		const r = await send(handler, {
			genome: 'hg38',
			getread: 1,
			chr,
			qname: 'x',
			start: 1,
			stop: 2,
			file: 'files/hg38/TermdbTest/trackLst/bam.bam'
		})
		test.equal(r?.error, 'invalid chr', `getread should reject chr=${chr}`)
	}

	const urlAttack = await send(handler, {
		genome: 'hg38',
		url: `-o${outFile}://abcde`,
		regions: [{ chr: 'chr1', start: 1, stop: 100, width: 100 }]
	})
	test.equal(urlAttack?.error, 'url must not start with "-"', 'should reject a url starting with "-"')

	// regions[] are validated before any samtools process starts, so these run without samtools too
	for (const chr of chrAttacks) {
		const r = await send(handler, {
			genome: 'hg38',
			file: 'files/hg38/TermdbTest/trackLst/bam.bam',
			nochr: false,
			regions: [{ chr, start: 1, stop: 100, width: 100 }]
		})
		test.equal(r?.error, 'invalid chr', `regions[] should reject chr=${chr}`)
	}
	if (hasSamtools) test.notOk(fs.existsSync(outFile), 'samtools view should not write to a requested path')
	test.end()
})

tape('/mdsjunction', async test => {
	const handler = mdsjunction_request_closure({ hg38: getGenome() })
	const file = 'files/hg38/TermdbTest/TermdbTest_ITD.gz'
	const tbi = path.join(serverconfig.tpmasterdir, file + '.tbi')
	const csi = path.join(serverconfig.tpmasterdir, file + '.csi')
	const tbiHash = sha(tbi)

	for (const chr of chrAttacks) {
		const j = await send(handler, {
			genome: 'hg38',
			iscustom: 1,
			file,
			junction: { chr, start: 1, stop: 2 }
		})
		test.equal(j?.error, 'invalid chr', `junction should reject chr=${chr}`)
		const jB = await send(handler, {
			genome: 'hg38',
			iscustom: 1,
			file,
			readcountByjBsamples: 1,
			junctionB: { chr, start: 1, stop: 2 },
			junctionAposlst: []
		})
		test.equal(jB?.error, 'invalid chr', `junctionB should reject chr=${chr}`)
		const rg = await send(handler, { genome: 'hg38', iscustom: 1, file, rglst: [{ chr, start: 1, stop: 2 }] })
		test.ok(rg?.error, `rglst should reject chr=${chr}`)
	}

	const urlAttack = await send(handler, {
		genome: 'hg38',
		iscustom: 1,
		url: '-fc://abcdefg',
		rglst: [{ chr: 'chr1', start: 1, stop: 2 }]
	})
	test.match(String(urlAttack?.error), /url must not start with "-"/, 'should reject a url starting with "-"')

	if (hasTabix) {
		test.equal(sha(tbi), tbiHash, 'should not rebuild the track .tbi')
		test.notOk(fs.existsSync(csi), 'should not drop a .csi beside the track')
	}
	test.end()
})

tape('/dsdata', async test => {
	const genome = getGenome()
	genome.datasets.testds = {
		queries: [{ vcffile: 'files/hg38/TermdbTest/TermdbTest_ITD.gz', vcf: {} }]
	}
	const handler = dsdataApi.methods.get.init({ genomes: { hg38: genome } })
	for (const chr of chrAttacks) {
		const r = await send(handler, { genome: 'hg38', dsname: 'testds', range: { chr, start: 1, stop: 2 } })
		test.equal(r?.error, 'invalid chr', `range should reject chr=${chr}`)
	}
	const noRange = await send(handler, { genome: 'hg38', dsname: 'testds' })
	test.equal(noRange?.error, 'invalid chr', 'should reject a missing range')
	test.end()
})

tape('/singlecell', async test => {
	const handler = handle_singlecell_closure({ hg38: getGenome() })
	const expfile = 'files/hg38/TermdbTest/TermdbTest_ITD.gz'
	for (const chr of chrAttacks) {
		const box = await send(handler, {
			genome: 'hg38',
			getgeneboxplot: { expfile, chr, start: 1, stop: 2, genename: 'TP53' }
		})
		test.equal(box?.error, 'invalid chr', `getgeneboxplot should reject chr=${chr}`)
		const heat = await send(handler, {
			genome: 'hg38',
			getheatmap: { expfile, gene_list: [{ chr, start: 1, stop: 2, gene: 'TP53' }] }
		})
		test.equal(heat?.error, 'invalid chr', `getheatmap should reject chr=${chr}`)
	}

	const getpcd = chr => ({
		genome: 'hg38',
		textfile: 'files/hg38/TermdbTest/tsne.txt',
		getpcd: {
			coord: [],
			gene_expression: {
				file: expfile,
				barcodecolumnidx: 4,
				chr,
				start: 1,
				stop: 2,
				genename: 'TP53',
				autoscale: true,
				color_min: '#000',
				color_max: '#fff'
			}
		}
	})
	for (const chr of chrAttacks) {
		const pcd = await send(handler, getpcd(chr))
		test.equal(pcd?.error, 'invalid chr', `getpcd.gene_expression should reject chr=${chr}`)
	}
	// a valid chr must get past the check, not fail with a ReferenceError from an out-of-scope genome;
	// a valid request runs tabix, so this needs the binary
	if (hasTabix) {
		const validPcd = await send(handler, getpcd('chr17'))
		test.notOk(
			/invalid chr|is not defined/.test(String(validPcd?.error)),
			'getpcd.gene_expression should accept a valid chr'
		)
	} else {
		test.comment('tabix not found, skipped the valid getpcd request')
	}
	test.end()
})

tape('/mdssurvivalplot', async test => {
	const genome = getGenome()
	genome.datasets.testds = {
		cohort: {
			annotation: { s1: { os: 10, censored: 0 } },
			survivalplot: { plots: { os: { serialtimekey: 'os', iscensoredkey: 'censored' } } }
		}
	}
	const handler = handle_mdssurvivalplot({ hg38: genome })
	for (const chr of chrAttacks) {
		for (const kind of ['geneexpression', 'mutation']) {
			const r = await send(handler, {
				genome: 'hg38',
				dslabel: 'testds',
				type: 'os',
				samplerule: { full: { useall: 1 }, set: { [kind]: 1, gene: 'TP53', chr, start: 1, stop: 2 } }
			})
			test.equal(r?.error, 'invalid chr', `samplerule.set.${kind} should reject chr=${chr}`)
		}
	}
	test.end()
})

tape('/termdb?getLDdata', async test => {
	const genome = getGenome()
	genome.datasets.testds = {
		cohort: { termdb: {} },
		queries: { ld: { tracks: [{ name: 'ld', file: 'files/hg38/TermdbTest/TermdbTest_ITD.gz' }] } }
	}
	const handler = termdbClosure({ hg38: genome })
	for (const chr of chrAttacks) {
		const r = await send(handler, {
			genome: 'hg38',
			dslabel: 'testds',
			getLDdata: 1,
			ldtkname: 'ld',
			m: { chr, pos: 1, ref: 'A', alt: 'T' }
		})
		test.equal(r?.error, 'invalid chr', `m.chr should reject chr=${chr}`)
	}
	test.end()
})

tape('spawnTool() central guard', async test => {
	// region-shaped arguments that start with "-" are what a request chr turns into
	for (const args of [
		['f.gz', `-o${outFile}:1-2`],
		['f.gz', '-fc:1-2'],
		['view', 'f.bam', '--help:x-y']
	]) {
		test.throws(() => utils.spawnTool('true', args), /invalid region argument/, `should reject ${JSON.stringify(args)}`)
	}
	// real flags have no ":", and a region after a flag value is fine
	for (const args of [
		['-H', 'f.gz'],
		['view', '-c', 'f.bam', 'chr1:1-2'],
		['query', 'f.bcf', '-r', 'chr1:1-2']
	]) {
		test.doesNotThrow(() => utils.spawnTool('true', args).kill(), `should allow ${JSON.stringify(args)}`)
	}

	// get_lines_bigfile() goes through the guard, so a route that forgot checkChr is still covered
	const file = path.join(serverconfig.tpmasterdir, 'files/hg38/TermdbTest/TermdbTest_ITD.gz')
	const tbiHash = sha(file + '.tbi')
	try {
		await utils.get_lines_bigfile({ args: [file, '-fc:1-2'], callback: () => {} })
		test.fail('get_lines_bigfile should reject a region-shaped option')
	} catch (e) {
		test.equal(e, 'invalid region argument', 'get_lines_bigfile should reject a region-shaped option')
	}
	test.equal(sha(file + '.tbi'), tbiHash, 'should not rebuild the track .tbi')
	test.end()
})

tape('/mdsgeneboxplot and /isoformbycoord, via the real route table', async test => {
	const routes = {}
	const record = (p, h) => (routes[p] = h)
	setRoutes(
		{ get: record, post: record, all: record, put: record, delete: record, use: () => {} },
		{ hg38: getGenome() },
		{}
	)
	for (const chr of chrAttacks) {
		const box = await send(routes['/mdsgeneboxplot'], {
			genome: 'hg38',
			iscustom: 1,
			file: 'files/hg38/TermdbTest/TermdbTest_ITD.gz',
			gene: 'TP53',
			chr,
			start: 1,
			stop: 2
		})
		test.equal(box?.error, 'invalid chr', `/mdsgeneboxplot should reject chr=${chr}`)
		const iso = await send(routes['/isoformbycoord'], { genome: 'hg38', chr, pos: 1 })
		test.equal(iso?.error, 'invalid chr', `/isoformbycoord should reject chr=${chr}`)
	}
	test.end()
})

tape('cleanup', test => {
	fs.rmSync(tmpdir, { recursive: true, force: true })
	test.end()
})
