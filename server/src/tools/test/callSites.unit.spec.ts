import tape from 'tape'
import os from 'os'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { genomes as loadedGenomes } from '#src/initGenomesDs.js'
import { api as hicdataApi } from '#src/routes/hicdata.ts'
import { api as hicgenomeApi } from '#src/routes/hicgenome.ts'
import { api as blatApi } from '#src/routes/blat.ts'
import { getH5samples, getH5shape } from '#src/utils/h5samples.ts'
import { validate_cumburden } from '#src/mds3.init.js'
import { getAvailableMemoryMB } from '#src/utils/memory.ts'
import { checkDependenciesAndVersions } from '#src/checkDependenciesAndVersions.js'
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
getH5samples()
validate_cumburden()
getAvailableMemoryMB()
checkDependenciesAndVersions()
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

/** a genome with only what the routes below use */
const genome = {
	blat: { host: 'blat.a.org', port: '1234', seqDir: '/home/root/pp/tp/genomes/' }
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

tape('getH5shape()', async test => {
	standIns.add(
		'h5dump',
		`printf 'DATASET "beta/values" {\\n   DATASPACE  SIMPLE { ( 1304718, 415 ) / ( H5S_UNLIMITED, 415 ) }\\n}\\n'`
	)
	standIns.prependPath()
	try {
		const file = path.join(tp, 'files/hg38/TermdbTest/dnaMeth.h5')
		test.deepEqual(
			await getH5shape(file, 'beta/values'),
			[1304718, 415],
			'should return the dimensions from the header'
		)
		test.deepEqual(
			standIns.calls('h5dump'),
			[['-H', '-d', 'beta/values', file]],
			'should read the header only, of the dataset and the file'
		)
		standIns.reset()
		for (const [label, f, p] of [
			['a dataset path that is an option', file, '-o'],
			['a file outside tp', '/etc/passwd', 'beta/values']
		] as const) {
			try {
				await getH5shape(f, p)
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

tape('getAvailableMemoryMB()', async test => {
	// 200000 pages of 16 KB is 3125 MB, enough for the full lesion cap
	standIns.add(
		'vm_stat',
		`printf 'Mach Virtual Memory Statistics: (page size of 16384 bytes)\\nPages free: 100000.\\nPages inactive: 100000.\\n'`
	)
	standIns.prependPath()
	try {
		const availableMem = await getAvailableMemoryMB()
		if (process.platform == 'darwin')
			test.equal(availableMem, 3125, 'should return the available memory from the vm_stat output')
		else {
			const totalMB = os.totalmem() / 1024 / 1024
			test.ok(
				Number.isFinite(availableMem) && availableMem > 0 && availableMem <= totalMB,
				'should return a memory cap in MB, between 0 and less than or equal to total memory'
			)
		}
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
	const features = serverconfig.features
	const skip = features.skip_checkDependenciesAndVersions
	delete features.skip_checkDependenciesAndVersions
	standIns.prependPath()
	try {
		let deps = await checkDependenciesAndVersions(serverconfig)
		test.deepEqual(deps, { R: true }, 'should find R usable')
		standIns.add('Rscript', `echo 'there is no package called jsonlite' >&2; exit 1`)
		deps = await checkDependenciesAndVersions(serverconfig)
		test.deepEqual(deps, { R: false }, 'should not throw and find R that fails its check not usable')
	} finally {
		standIns.restorePath()
		if (skip !== undefined) features.skip_checkDependenciesAndVersions = skip
	}
	standIns.reset()
	test.end()
})

tape('cleanup', test => {
	standIns.remove()
	test.end()
})
