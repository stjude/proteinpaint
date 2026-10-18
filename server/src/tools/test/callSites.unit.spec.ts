import tape from 'tape'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { genomes as loadedGenomes } from '#src/initGenomesDs.js'
import { api as hicdataApi } from '#src/routes/hicdata.ts'
import { api as hicgenomeApi } from '#src/routes/hicgenome.ts'
import { api as blatApi } from '#src/routes/blat.ts'
import * as fimo from '#src/fimo.js'
import { getH5samples } from '#src/utils/h5samples.ts'
import { validate_cumburden } from '#src/mds3.init.js'
import { getMaxLesions } from '#src/grin2/memory.ts'
import { checkDependenciesAndVersions } from '#src/checkDependenciesAndVersions.js'
import fs from 'fs'
import * as utils from '#src/utils.js'
import { StandIns } from './standIns.ts'

/*
Specs of the code that starts a tool with runTool() or runToolOutput(). Each tool is replaced by a stand-in
that logs its argv, see standIns.ts. Each section checks that:
- a valid request or call reaches the tool with the expected argv, so that a caller that stops passing a field,
  or passes another value, is detected
- a value that only the caller checks is still rejected, without starting the tool, so that a removed check in
  the caller is detected
- a hostile value is rejected without starting the tool

test sections:
/hicdata
/hicgenome
/blat
/fimo
getH5samples()
validate_cumburden()
getMaxLesions()
checkDependenciesAndVersions()
readTabixLines(), readTabixHeader(), listTabixChrs()
readTabixHeader(): the cache dir of a url, and an ftp url
readTabixLines(): an exit that is not normal rejects, unless the read is stopped
get_fasta()
query_bigbed_by_coord(), query_bigbed_by_name(), testIfFileIsBigbed()
*/

const tp = path.resolve(serverconfig.tpmasterdir)
const cache = path.resolve(serverconfig.cachedir)
const standIns = new StandIns()

/** resolves with the first res.send() payload of a route handler */
function send(handler, query): Promise<any> {
	return new Promise(resolve => {
		const timer = setTimeout(() => resolve({ timeout: true }), 10000)
		const done = x => {
			clearTimeout(timer)
			resolve(x)
		}
		const res = { send: done, status: () => res, header: () => {}, set: () => {}, end: done }
		Promise.resolve(handler({ query, get: () => undefined }, res)).catch(e => done({ error: String(e) }))
	})
}

/** sets serverconfig[key] to value while fn runs, then restores it */
async function withConfig(key: string, value: unknown, fn: () => Promise<void>) {
	const prev = serverconfig[key]
	serverconfig[key] = value
	try {
		await fn()
	} finally {
		if (prev === undefined) delete serverconfig[key]
		else serverconfig[key] = prev
	}
}

/** a genome with only what the routes below use; genomefile NA makes get_fasta() return Ns without samtools */
const genome = {
	genomefile: 'NA',
	chrlookup: { CHR1: { name: 'chr1', len: 1000000 } },
	blat: { host: 'blat.a.org', port: '1234', seqDir: '/home/root/pp/tp/genomes/' },
	fimo_motif: { db: path.join(tp, 'anno/db/motif.meme') }
}

tape('\n', test => {
	test.comment('-***- tools call-site specs -***-')
	test.end()
})

tape('/hicdata', async test => {
	const straw = standIns.add('straw', `printf '100\\t200\\t5\\n'`)
	await withConfig('hicstraw', straw, async () => {
		const handler = (hicdataApi.methods.get as any).init()
		const q = { file: 'files/hg38/x.hic', matrixType: 'log(oe)', nmeth: 'KR', resolution: '5000' }
		const ok = await send(handler, { ...q, pos1: 'chr1:0:10000', pos2: 'chr2:5:6' })
		test.equal(ok.items?.length, 1, 'should return the items of a valid request')
		test.deepEqual(
			standIns.calls('straw'),
			[['oe', 'KR', path.join(tp, 'files/hg38/x.hic'), 'chr1:0:10000', 'chr2:5:6', 'BP', '5000']],
			'should pass each request value to its argv slot'
		)
		standIns.reset()
		for (const [label, pos1, error] of [
			['a start > stop, which only the route checks', 'chr1:10:5', /start > stop/],
			['an option', '-o', /invalid/],
			['a value with shell syntax', 'chr1;ls', /invalid/]
		] as const) {
			const res = await send(handler, { ...q, pos1, pos2: 'chr2' })
			test.match(JSON.stringify(res.error), error, `should reject ${label}`)
		}
		test.deepEqual(standIns.calls('straw'), [], 'should not start straw for a rejected request')
	})
	standIns.reset()
	test.end()
})

tape('/hicgenome', async test => {
	const straw = standIns.add('straw', `printf '100\\t200\\t5\\n'`)
	await withConfig('hicstraw', straw, async () => {
		const handler = (hicgenomeApi.methods.get as any).init()
		const q = { file: 'files/hg38/x.hic', nmeth: 'NONE', resolution: '1000000' }
		const ok = await send(handler, { ...q, chrlst: ['chr1', 'chr2'], nochr: true })
		test.equal(ok.data?.length, 3, 'should return the data of each chromosome pair')
		const file = path.join(tp, 'files/hg38/x.hic')
		test.deepEqual(
			standIns.calls('straw').sort(),
			[
				['observed', 'NONE', file, '1', '1', 'BP', '1000000'],
				['observed', 'NONE', file, '2', '1', 'BP', '1000000'],
				['observed', 'NONE', file, '2', '2', 'BP', '1000000']
			],
			'should pass the chromosome names without chr for a nochr file'
		)
		standIns.reset()
		for (const [label, query] of [
			['a duplicate chromosome, which only the route checks', { chrlst: ['chr1', 'chr1'] }],
			['too many chromosomes, which only the route checks', { chrlst: [...Array(101).keys()].map(i => 'chr' + i) }],
			['a name that is an option without chr', { chrlst: ['chr-o'], nochr: true }],
			['a name with shell syntax', { chrlst: ['chr1;ls'] }]
		] as const) {
			const res = await send(handler, { ...q, ...query })
			test.ok(res.error, `should reject ${label}`)
		}
		test.deepEqual(standIns.calls('straw'), [], 'should not start straw for a rejected request')
	})
	standIns.reset()
	test.end()
})

tape('/blat', async test => {
	// the psl output file is the 5th argument
	const gfClient = standIns.add('gfClient', `: > "$5"`)
	const prevGenomes = { ...loadedGenomes }
	Object.assign(loadedGenomes, { hgX: genome })
	try {
		await withConfig('gfClient', gfClient, async () => {
			// the init getter returns the route init only when a loaded genome has blat
			const handler = (blatApi.methods.post as any).init({ genomes: { hgX: genome } })
			const ok = await send(handler, { genome: 'hgX', seq: 'ATCGATCGATCG' })
			test.deepEqual(ok, { nohit: 1 }, 'should return no hit for an empty psl output')
			const calls = standIns.calls('gfClient')
			test.equal(calls.length, 1, 'should start gfClient once')
			const argv = calls[0] || []
			test.deepEqual(
				[...argv.slice(0, 3), ...argv.slice(5)],
				[
					'blat.a.org',
					'1234',
					'/home/root/pp/tp/genomes/',
					'-q=dna',
					'-nohead',
					'-minScore=20',
					'-minIdentity=0',
					'-out=psl'
				],
				'should pass the genome blat config and the fixed options'
			)
			test.ok(
				argv[3]?.startsWith(cache + path.sep) && argv[4]?.startsWith(cache + path.sep),
				'should pass query and output files in cachedir'
			)
			standIns.reset()
			for (const [label, query] of [
				['a missing sequence, which only the route checks', { genome: 'hgX' }],
				['an unknown genome, which only the route checks', { genome: 'hgY', seq: 'ATCG' }]
			] as const) {
				const res = await send(handler, query)
				test.ok(res.error, `should reject ${label}`)
			}
			const badPort = await send(
				(blatApi.methods.post as any).init({
					genomes: { hgX: { ...genome, blat: { ...genome.blat, port: '1234;ls' } } }
				}),
				{
					genome: 'hgX',
					seq: 'ATCG'
				}
			)
			test.ok(badPort.error, 'should reject an invalid port from the genome config')
			test.deepEqual(standIns.calls('gfClient'), [], 'should not start gfClient for a rejected request')
		})
	} finally {
		for (const k of Object.keys(loadedGenomes)) delete loadedGenomes[k]
		Object.assign(loadedGenomes, prevGenomes)
	}
	standIns.reset()
	test.end()
})

tape('/fimo', async test => {
	// no output means no motif match
	const fimoBin = standIns.add('fimo')
	await withConfig('fimo', fimoBin, async () => {
		const handler = fimo.handle_closure({ hgX: genome })
		const q = { genome: 'hgX', flankspan: 20, m: { chr: 'chr1', pos: 1000, ref: 'N', alt: 'T' } }
		const ok = await send(handler, { ...q, fimo_thresh: '1e-3' })
		test.notOk(ok.error, 'should not return an error for a valid request')
		const calls = standIns.calls('fimo')
		test.equal(calls.length, 2, 'should start fimo for the reference and the mutated sequence')
		for (const argv of calls) {
			test.deepEqual(
				argv.slice(0, 7),
				['--parse-genomic-coord', '--verbosity', '1', '--text', '--thresh', '0.001', genome.fimo_motif.db],
				'should pass the request threshold as a number and the motif db of the genome'
			)
			test.ok(argv[7]?.startsWith(cache + path.sep), 'should pass a fasta file in cachedir')
		}
		standIns.reset()
		await send(handler, q)
		test.equal(
			standIns.calls('fimo')[0]?.[5],
			'0.0001',
			'should pass the fimo default threshold when none is requested'
		)
		standIns.reset()
		for (const [label, query] of [
			['a position that is not an integer, which only the route checks', { ...q, m: { ...q.m, pos: '1000' } }],
			['a missing allele, which only the route checks', { ...q, m: { ...q.m, alt: '' } }],
			['a threshold that is an option', { ...q, fimo_thresh: '-o' }],
			['a threshold with shell syntax', { ...q, fimo_thresh: '0.1;ls' }],
			['a threshold over 1', { ...q, fimo_thresh: 2 }]
		] as const) {
			const res = await send(handler, query)
			test.ok(res.error, `should reject ${label}`)
		}
		test.deepEqual(standIns.calls('fimo'), [], 'should not start fimo for a rejected request')
	})
	standIns.reset()
	test.end()
})

tape('getH5samples()', async test => {
	standIns.add('h5dump', `printf '   DATA {\\n   (0): "s1", "s2"\\n   }\\n'`)
	standIns.prependPath()
	try {
		const file = path.join(tp, 'files/hg38/TermdbTest/dnaMeth.h5')
		test.deepEqual(
			await getH5samples(file, '/meta/samples/names'),
			['s1', 's2'],
			'should return the samples of the dataset'
		)
		test.deepEqual(
			standIns.calls('h5dump'),
			[['-d', '/meta/samples/names', file]],
			'should pass the dataset path and the file'
		)
		standIns.reset()
		for (const [label, f, p] of [
			['a dataset path that is an option', file, '-o'],
			['a dataset path with a .. segment', file, '/meta/../x'],
			['a file outside tp', '/etc/passwd', 'samples'],
			['a file with shell syntax', path.join(tp, 'a;ls.h5'), 'samples']
		] as const) {
			try {
				await getH5samples(f, p)
				test.fail(`should reject ${label}`)
			} catch (_) {
				test.pass(`should reject ${label}`)
			}
		}
		test.deepEqual(standIns.calls('h5dump'), [], 'should not start h5dump for a rejected call')
	} finally {
		standIns.restorePath()
	}
	standIns.reset()
	test.end()
})

tape('validate_cumburden()', async test => {
	const rscript = standIns.add('Rscript')
	// any existing tp file stands in for an RData file, since the stand-in does not read it
	const dir = 'files/hg38/TermdbTest'
	const ds = (files: Record<string, string>) => ({ cohort: { cumburden: { dir, files } } })
	const valid = { fit: 'dnaMeth.h5', surv: 'dnaMeth.h5', sample: 'dnaMeth.h5' }
	await withConfig('Rscript', rscript, async () => {
		await withConfig('debugmode', false, async () => {
			await validate_cumburden(ds(valid))
			const file = path.join(tp, dir, 'dnaMeth.h5')
			test.deepEqual(
				standIns.calls('Rscript'),
				Array(3).fill(['--vanilla', '-e', 'load(commandArgs(trailingOnly = TRUE)[1])', file]),
				'should pass each file as an argument after the R code, not in it'
			)
			standIns.reset()
			for (const [label, files] of [
				['a .. path segment, which only the dataset check rejects', { ...valid, fit: '../TermdbTest/dnaMeth.h5' }],
				['a missing file, which only the dataset check rejects', { ...valid, fit: 'missing.RData' }]
			] as const) {
				try {
					await validate_cumburden(ds(files))
					test.fail(`should reject ${label}`)
				} catch (_) {
					test.pass(`should reject ${label}`)
				}
			}
			test.deepEqual(standIns.calls('Rscript'), [], 'should not start Rscript for a rejected file')
		})
	})
	standIns.reset()
	test.end()
})

tape('getMaxLesions()', async test => {
	// 200000 pages of 16 KB is 3125 MB, enough for the full lesion cap
	standIns.add(
		'vm_stat',
		`printf 'Mach Virtual Memory Statistics: (page size of 16384 bytes)\\nPages free: 100000.\\nPages inactive: 100000.\\n'`
	)
	standIns.prependPath()
	try {
		const max = serverconfig.features.grin2maxLesions || 250000
		const cap = await getMaxLesions()
		if (process.platform == 'darwin') test.equal(cap, max, 'should return the full lesion cap from the vm_stat output')
		else test.ok(Number.isInteger(cap), 'should return a lesion cap')
		test.deepEqual(
			standIns.calls('vm_stat'),
			process.platform == 'darwin' ? [[]] : [],
			process.platform == 'darwin' ? 'should run vm_stat with no arguments on macOS' : 'should not run vm_stat on linux'
		)
	} finally {
		standIns.restorePath()
	}
	standIns.reset()
	test.end()
})

tape('checkDependenciesAndVersions()', async test => {
	// run_R() starts Rscript by name, to check the R packages
	standIns.add('Rscript')
	const samtools = standIns.add('samtools', `echo 'samtools 1.24'`)
	const bcftools = standIns.add('bcftools', `echo 'bcftools 1.24'`)
	const oldSamtools = standIns.add('samtools1.9', `echo 'samtools 1.9'`)
	const features = serverconfig.features
	const skip = features.skip_checkDependenciesAndVersions
	delete features.skip_checkDependenciesAndVersions
	standIns.prependPath()
	try {
		await withConfig('samtools', samtools, async () => {
			await withConfig('bcftools', bcftools, async () => {
				await checkDependenciesAndVersions(serverconfig)
				test.deepEqual(standIns.calls('samtools'), [['--version']], 'should run samtools --version')
				test.deepEqual(standIns.calls('bcftools'), [['-v']], 'should run bcftools -v')
			})
		})
		await withConfig('samtools', oldSamtools, async () => {
			try {
				await checkDependenciesAndVersions(serverconfig)
				test.fail('should reject a samtools version that is too old')
			} catch (e) {
				test.match(String(e), /samtools not >= 1\.10/, 'should reject a samtools version that is too old')
			}
		})
	} finally {
		standIns.restorePath()
		if (skip !== undefined) features.skip_checkDependenciesAndVersions = skip
	}
	standIns.reset()
	test.end()
})

tape('readTabixLines(), readTabixHeader(), listTabixChrs()', async test => {
	// the real tool, with a test file that has 2 lines on chr17
	const file = path.join(tp, 'files/hg38/TermdbTest/TermdbTest_ITD.gz')
	const region = { chr: 'chr17', start: 1, stop: 100000000 }
	const lines: string[] = []
	await utils.readTabixLines({ file, regions: [region], callback: line => lines.push(line) })
	test.equal(lines.length, 2, 'should read the lines of a region')
	test.deepEqual(await utils.listTabixChrs(file), ['chr17'], 'should list the chromosomes')
	test.ok((await utils.readTabixHeader(file))[0]?.startsWith('#sample'), 'should read the header lines')
	const first: string[] = []
	await utils.readTabixLines({ file, regions: [region], callback: (line, stop) => (first.push(line), stop()) })
	test.equal(first.length, 1, 'should stop reading when the callback calls stop()')
	try {
		await utils.readTabixLines({
			file,
			regions: [region],
			callback: () => {
				throw 'bad line'
			}
		})
		test.fail('should reject when the callback throws')
	} catch (e) {
		test.equal(e, 'bad line', 'should reject with the error of the callback')
	}

	// a stand-in, to check the argv and the working dir
	const tabix = standIns.add('tabix', 'pwd -P')
	const dir = fs.mkdtempSync(path.join(cache, 'pp-callsites-'))
	await withConfig('tabix', tabix, async () => {
		const out: string[] = []
		await utils.readTabixLines({
			file: 'files/x.gz',
			dir,
			regions: [
				{ chr: 'chr1', start: -5, stop: '10.5' },
				{ chr: 'chr2', start: 1.5, stop: 2 }
			],
			callback: line => out.push(line)
		})
		test.deepEqual(
			standIns.calls('tabix'),
			[[path.join(tp, 'files/x.gz'), 'chr1:0-11', 'chr2:1-2']],
			'should pass each region as an argument, with integer coordinates from 0'
		)
		test.deepEqual(out, [fs.realpathSync(dir)], 'should run tabix in the cache dir of a url file')
		standIns.reset()
		await utils.readTabixHeader('files/x.gz')
		await utils.listTabixChrs('files/x.gz')
		test.deepEqual(
			standIns.calls('tabix'),
			[
				['-H', path.join(tp, 'files/x.gz')],
				['-l', path.join(tp, 'files/x.gz')]
			],
			'should pass -H and -l'
		)
		standIns.reset()
		for (const [label, input] of [
			['a chr that is an option', { regions: [{ chr: '-o', start: 1, stop: 2 }] }],
			['a chr with shell syntax', { regions: [{ chr: 'chr1;ls', start: 1, stop: 2 }] }],
			['a coordinate that is not a number', { regions: [{ chr: 'chr1', start: '1;ls', stop: 2 }] }],
			['no region', { regions: [] }],
			['a file outside tp', { file: '/etc/passwd' }],
			['a dir outside cachedir', { dir: '/tmp' }]
		] as const) {
			try {
				const base = { file: 'files/x.gz', regions: [{ chr: 'chr1', start: 1, stop: 2 }], callback: () => {} }
				await utils.readTabixLines(Object.assign(base, input) as any)
				test.fail(`should reject ${label}`)
			} catch (_) {
				test.pass(`should reject ${label}`)
			}
		}
		test.deepEqual(standIns.calls('tabix'), [], 'should not start tabix for a rejected call')
	})
	fs.rmSync(dir, { recursive: true, force: true })
	standIns.reset()
	test.end()
})

tape('readTabixHeader(): the cache dir of a url, and an ftp url', async test => {
	const tabix = standIns.add('tabix', 'pwd -P')
	const features = serverconfig.features
	const allow = features.ALLOW_remotefilefromurl
	features.ALLOW_remotefilefromurl = true
	// the cache dir keeps the url body, with its port, percent-encoded characters, and query string
	const url = 'https://a.org:8443/x%20y/t.gz?token=1&v=2'
	const dir = await utils.cache_index(url, undefined)
	try {
		await withConfig('tabix', tabix, async () => {
			test.ok(/[:%?&]/.test(path.relative(cache, dir)), 'should have url characters in the cache dir name')
			test.deepEqual(
				await utils.readTabixHeader(url, dir),
				[fs.realpathSync(dir)],
				'should run tabix in the cache dir of the url'
			)
			standIns.reset()
			const ftp = 'ftp://a.org/x/t.gz'
			await utils.readTabixHeader(ftp, await utils.cache_index(ftp, undefined))
			test.deepEqual(standIns.calls('tabix'), [['-H', ftp]], 'should pass an ftp url, as fileurl() allows it')
		})
	} finally {
		if (allow === undefined) delete features.ALLOW_remotefilefromurl
		else features.ALLOW_remotefilefromurl = allow
		fs.rmSync(path.join(cache, 'https/a.org:8443'), { recursive: true, force: true })
		fs.rmSync(path.join(cache, 'ftp/a.org'), { recursive: true, force: true })
		standIns.reset()
	}
	test.end()
})

tape('readTabixLines(): an exit that is not normal rejects, unless the read is stopped', async test => {
	const file = 'files/x.gz'
	const regions = [{ chr: 'chr1', start: 1, stop: 2 }]
	for (const [label, script, re] of [
		['a nonzero exit without error output', 'echo line; exit 3', /tabix.query exited with code 3/],
		['a nonzero exit with error output', 'echo line; echo cannot open >&2; exit 1', /cannot open/],
		['a signal', 'echo line; kill -TERM $$', /tabix.query exited with signal SIGTERM/]
	] as const) {
		const tabix = standIns.add('tabix', script)
		await withConfig('tabix', tabix, async () => {
			const lines: string[] = []
			try {
				await utils.readTabixLines({ file, regions, callback: line => lines.push(line) })
				test.fail(`should reject ${label}`)
			} catch (e) {
				test.match(String(e), re, `should reject ${label}`)
			}
		})
	}
	// a stopped read is killed, which is not an error
	const tabix = standIns.add('tabix', 'echo a; echo b; exec sleep 30')
	await withConfig('tabix', tabix, async () => {
		const lines: string[] = []
		await utils.readTabixLines({ file, regions, callback: (line, stop) => (lines.push(line), stop()) })
		test.deepEqual(lines, ['a'], 'should resolve a read that the callback stops')
	})
	standIns.reset()
	test.end()
})

tape('get_fasta()', async test => {
	const samtools = standIns.add('samtools', `printf '>chr1:100-200\\nACGT\\n'`)
	const gn = { genomefile: path.join(tp, 'genomes/x.fa.gz'), chrlookup: genome.chrlookup }
	await withConfig('samtools', samtools, async () => {
		test.equal(
			await utils.get_fasta(gn, 'chr1:100-200'),
			'>chr1:100-200\nACGT',
			'should return the fasta of the region'
		)
		test.deepEqual(
			standIns.calls('samtools'),
			[['faidx', gn.genomefile, '--', 'chr1:100-200']],
			'should pass the region after --'
		)
		standIns.reset()
		for (const [label, g, coord] of [
			['a coordinate that is an option, which only get_fasta() checks', gn, '-o'],
			['a chromosome without a range, which only get_fasta() checks', gn, 'chr1'],
			['a coordinate outside the chromosome, which only get_fasta() checks', gn, 'chr1:100-99999999'],
			['a genome fasta outside tp', { ...gn, genomefile: '/etc/passwd' }, 'chr1:100-200']
		] as const) {
			try {
				await utils.get_fasta(g, coord)
				test.fail(`should reject ${label}`)
			} catch (_) {
				test.pass(`should reject ${label}`)
			}
		}
		test.deepEqual(standIns.calls('samtools'), [], 'should not start samtools for a rejected call')
	})
	standIns.reset()
	test.end()
})

tape('query_bigbed_by_coord(), query_bigbed_by_name(), testIfFileIsBigbed()', async test => {
	const toBed = standIns.add('bigBedToBed', `printf 'chr1\\t1\\t2\\tx\\n'`)
	const named = standIns.add('bigBedNamedItems', `printf 'chr1\\t1\\t2\\trs1\\n'`)
	const info = standIns.add('bigBedInfo', `echo 'version: 4'`)
	const file = path.join(tp, 'anno/a.bb')
	await withConfig('bigBedToBed', toBed, async () => {
		await withConfig('bigBedNamedItems', named, async () => {
			await withConfig('bigBedInfo', info, async () => {
				test.deepEqual(
					await utils.query_bigbed_by_coord(file, 'chr1', 0, 1000),
					['chr1\t1\t2\tx'],
					'should return the lines of a region'
				)
				test.deepEqual(
					standIns.calls('bigBedToBed'),
					[['-chrom=chr1', '-start=0', '-end=1000', file, 'stdout']],
					'should pass the region as options'
				)
				test.deepEqual(
					await utils.query_bigbed_by_name(file, 'rs1'),
					['chr1\t1\t2\trs1'],
					'should return the lines of a name'
				)
				test.deepEqual(standIns.calls('bigBedNamedItems'), [[file, 'rs1', 'stdout']], 'should pass the name')
				test.equal(await utils.testIfFileIsBigbed(file), true, 'should detect a bigBed file from its info')
				test.deepEqual(standIns.calls('bigBedInfo'), [[file]], 'should pass the file')
				standIns.reset()
				for (const [label, fn] of [
					['a chr that is an option', () => utils.query_bigbed_by_coord(file, '-o', 0, 1)],
					['a start that is not an integer', () => utils.query_bigbed_by_coord(file, 'chr1', '0;ls', 1)],
					['a name with shell syntax', () => utils.query_bigbed_by_name(file, 'rs1;ls')],
					['a file outside tp', () => utils.query_bigbed_by_name('/etc/passwd', 'rs1')]
				] as const) {
					try {
						await fn()
						test.fail(`should reject ${label}`)
					} catch (_) {
						test.pass(`should reject ${label}`)
					}
				}
				test.equal(
					await utils.testIfFileIsBigbed('/etc/passwd'),
					false,
					'should not detect a file outside tp as bigBed'
				)
				test.deepEqual(
					[...standIns.calls('bigBedToBed'), ...standIns.calls('bigBedNamedItems'), ...standIns.calls('bigBedInfo')],
					[],
					'should not start a bigBed tool for a rejected call'
				)
			})
		})
	})
	standIns.reset()
	test.end()
})

tape('cleanup', test => {
	standIns.remove()
	test.end()
})
