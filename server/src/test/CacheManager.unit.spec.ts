import tape from 'tape'
import path from 'path'
import fs from 'fs'
import { CacheManager, cacheRegistry, cacheUrlProtocols } from '#src/CacheManager.ts'

/** Tests
 * - init() cache files
 * - Delete cache files
 */

/**************
 helper functions
***************/

/**************
 test sections
***************/

tape('\n', async function (test) {
	test.comment('-***- src/CacheManager -***-')
	test.end()
})

tape('defaults', function (test) {
	test.timeoutAfter(1000)

	const cachedir = path.join(process.cwd(), '.cache-test1')
	// clear any previously created test cache dir
	fs.rmSync(cachedir, { force: true, recursive: true })
	let numChecks = 0

	const monitor = new CacheManager({
		quiet: true,
		cachedir,
		interval: 100,
		callbacks: {
			preStart: m => {
				//console.log(38, m)
				test.deepEqual(
					Object.fromEntries(m.subdirs.entries()),
					{
						de: {
							maxAge: 5184000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/de`,
							skipUntil: 0
						},
						dm: {
							maxAge: 5184000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/dm`,
							skipUntil: 0
						},
						ds: {
							maxAge: 5184000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/ds`,
							skipUntil: 0
						},
						dmr: {
							maxAge: 5184000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/dmr`,
							skipUntil: 0
						},
						geneBodyMeth: {
							maxAge: 5184000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/geneBodyMeth`,
							skipUntil: 0
						},
						gsea: {
							maxAge: 5184000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/gsea`,
							skipUntil: 0
						},
						grin2: {
							maxAge: 5184000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/grin2`,
							skipUntil: 0
						},
						topve: {
							maxAge: 5184000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/topve`,
							skipUntil: 0
						},
						gdcCounts: {
							maxAge: 5184000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/gdcCounts`,
							skipUntil: 0
						},
						massSession: {
							maxAge: 2592000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/massSession`,
							skipUntil: 0
						},
						massSessionTrash: {
							maxAge: 5184000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							absPath: `${m.cachedir}/massSessionTrash`,
							skipUntil: 0
						},
						wsitiles: {
							maxAge: 2592000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							fileExtensions: new Set(['.jpg', '.png', '.csv']),
							absPath: `${m.cachedir}/wsitiles`,
							skipUntil: 0
						},
						bedj: {
							maxAge: 2592000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							fileExtensions: new Set(['.gz', '.tbi', '.csi', '.bb']),
							absPath: `${m.cachedir}/bedj`,
							skipUntil: 0
						},
						bam: {
							maxAge: 7200000,
							maxSize: 5000000000,
							skipMs: 0,
							fileExtensions: new Set(['.bam', '.bai']),
							absPath: `${m.cachedir}/bam`,
							skipUntil: 0
						},
						extApiResponse: {
							maxAge: 31536000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							fileExtensions: new Set(['']),
							absPath: `${m.cachedir}/extApiResponse`,
							skipUntil: 0
						},
						snpgt: {
							maxAge: 2592000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							fileExtensions: new Set(['']),
							absPath: `${m.cachedir}/snpgt`,
							skipUntil: 0
						},
						http: {
							maxAge: 2592000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							fileExtensions: new Set(['.tbi', '.csi', '.bai', '.crai', '.tmp']),
							absPath: `${m.cachedir}/http`,
							skipUntil: 0
						},
						https: {
							maxAge: 2592000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							fileExtensions: new Set(['.tbi', '.csi', '.bai', '.crai', '.tmp']),
							absPath: `${m.cachedir}/https`,
							skipUntil: 0
						},
						ftp: {
							maxAge: 2592000000,
							maxSize: 5000000000,
							skipMs: 43200000,
							fileExtensions: new Set(['.tbi', '.csi', '.bai', '.crai', '.tmp']),
							absPath: `${m.cachedir}/ftp`,
							skipUntil: 0
						}
					},
					`should set default subdir properties`
				)
			},
			postCheck(results) {
				numChecks++
				if (numChecks == 1) {
					test.deepEqual(
						results,
						{
							gsea: { deletedCount: 0, totalCount: 0 },
							massSession: { deletedCount: 0, totalCount: 0 },
							massSessionTrash: { deletedCount: 0, totalCount: 0 },
							grin2: { deletedCount: 0, totalCount: 0 },
							de: { deletedCount: 0, totalCount: 0 },
							dm: { deletedCount: 0, totalCount: 0 },
							dmr: { deletedCount: 0, totalCount: 0 },
							geneBodyMeth: { deletedCount: 0, totalCount: 0 },
							topve: { deletedCount: 0, totalCount: 0 },
							gdcCounts: { deletedCount: 0, totalCount: 0 },
							wsitiles: { deletedCount: 0, totalCount: 0 },
							bedj: { deletedCount: 0, totalCount: 0 },
							bam: { deletedCount: 0, totalCount: 0 },
							ds: { deletedCount: 0, totalCount: 0 },
							extApiResponse: { deletedCount: 0, totalCount: 0 },
							snpgt: { deletedCount: 0, totalCount: 0 },
							http: { deletedCount: 0, totalCount: 0 },
							https: { deletedCount: 0, totalCount: 0 },
							ftp: { deletedCount: 0, totalCount: 0 }
						},
						`should detect no cache files to delete`
					)
				}
				if (numChecks == 2) {
					test.deepEqual(
						results,
						{
							// All subdirs except bam have skipMs >= halfDay, so the 2nd
							// iteration (fired ~100ms after the first) only checks bam,
							// which has skipMs == 0 to be checked on every interval.
							bam: { deletedCount: 0, totalCount: 0 }
						},
						`should detect no cache files to delete`
					)
				}

				if (monitor.intervalId) {
					monitor.stop()
					fs.rmSync(cachedir, { force: true, recursive: true })
					test.end()
				}
			}
		}
	})
})

tape('move or delete by maxAge', test => {
	test.timeoutAfter(2000)
	test.plan(11)

	const cachedir = path.join(process.cwd(), '.cache-test2')
	// clear any previously created test cache dir
	fs.rmSync(cachedir, { force: true, recursive: true })
	let numChecks = 0

	const interval = 100
	// subtracting a few milliseconds from interval for maxAge will
	// cause a file with mtime == (N * maxAge) to expire in Nth iteration
	// in test0 dir, and in 2*Nth iteration in trash dir with skipMs == 2*maxAge;
	// NOTE: if the subtracted milliseconds is too big, it may cause mtime to be
	// rounded down enough that trash files may be deleted 1 iteration sooner, has
	// to subtract 5 milliseconds or less for less flakiness
	const maxAge = interval - 3
	const monitor = new CacheManager(
		{
			//quiet: true,
			cachedir,
			interval,
			callbacks: {
				preStart: m => {
					const subdirs = Object.fromEntries(m.subdirs.entries())
					test.deepEqual(
						subdirs.test0,
						{
							maxAge,
							maxSize: 5000000000,
							skipMs: 0,
							absPath: `${cachedir}/test0`,
							skipUntil: 0,
							moveTo: 'trash',
							movePath: `${cachedir}/trash`
						},
						`should set override test0 subdir properties`
					)
					test.deepEqual(
						subdirs.trash,
						{
							maxAge: maxAge * 2,
							maxSize: 5000000000,
							skipMs: interval * 2,
							absPath: `${cachedir}/trash`,
							skipUntil: 0
						},
						`should set override trash subdir properties`
					)

					const now = Date.now()
					for (const i of [1, 2, 3]) {
						const f = `${cachedir}/test0/file-${i}`
						// decimals will be interpreted into milliseconds by utimesSync;
						// the maxAge in this test has to be fine-tuned to avoid flaky subdir check results
						// due to variations in file stat performance and timestamp across OS
						const time = (now + (i - 1) * maxAge) / 1000
						fs.openSync(f, 'w')
						fs.utimesSync(f, time, time)
					}
				},
				postCheck: results => {
					// console.log(152, '--- postCheck()', numChecks, results)
					// check #0 is before setInterval()
					const expected =
						numChecks < 1
							? { deletedCount: 0, totalCount: 3 }
							: numChecks == 1 // file with mtime == maxAge expires
							? { deletedCount: 1, totalCount: 3 }
							: numChecks == 2 // file with mtime == 2*maxAge expires
							? { deletedCount: 1, totalCount: 2 }
							: numChecks == 3 // file with mtime == 3*maxAge expires
							? { deletedCount: 1, totalCount: 1 }
							: { deletedCount: 0, totalCount: 0 }

					test.deepEqual(results.test0, expected, `should have expected test0 subdir results after check #${numChecks}`)

					// // NOTE: trash deletion is flaky when using interval and maxAge < 1 second,
					// // will only test at the end that there are no remaining files
					// const expectedTrash =
					// 	numChecks == 0
					// 		? { deletedCount: 0, totalCount: 0 }
					// 		: numChecks == 1
					// 		? undefined
					// 		: numChecks == 2 // file with mtime == 1*maxAge expires, since maxAge in trash is 2*maxAge
					// 		? { deletedCount: 1, totalCount: 2 }
					// 		: numChecks == 3
					// 		? undefined
					// 		: numChecks == 4 // files with mtime == 2*maxAge and 3*maxAge expire, both mtimes are less than 2*2*maxAge
					// 		? results.trash // however, system file stat does not give reliable result in github CI
					// 		: results.trash != undefined // for check #5, should not equal the previous result.
					// 		? { deletedCount: 2, totalCount: 2 } // so the result is either undefined or delete 2 files,
					// 		: undefined // depending on the results of check #4

					// // don't test results from check #4 because it's flaky, test check #5 instead
					// if (numChecks !== 4)
					// 	test.deepEqual(results.trash, expectedTrash, `should have expected trash after check #${numChecks}`)

					numChecks++
					if (numChecks > 6) {
						monitor.stop()
						const remainingFiles = fs.readdirSync(`${cachedir}/test0`)
						test.equal(remainingFiles.length, 0, `should have no remaining cache files after the test`)
						const remainingTrash = fs.readdirSync(`${cachedir}/trash`)
						test.equal(remainingTrash.length, 0, `should have no remaining trash files after the test`)
						fs.rmSync(cachedir, { force: true, recursive: true })
						test.end()
					}
				}
			}
		},
		// a test registry, so that the real subdirs are not included in the test
		{
			test0: { type: 'session', maxAge, skipMs: 0, moveTo: 'trash' },
			// lifetime is twice as long as in test0 subdir;
			// check the trash subdir 1/2 as often than test0
			trash: { type: 'session', maxAge: maxAge * 2, skipMs: interval * 2 }
		}
	)
})

tape('delete by maxSize', test => {
	test.timeoutAfter(1000)

	const cachedir = path.join(process.cwd(), '.cache-test7')
	// clear any previously created test cache dir
	fs.rmSync(cachedir, { force: true, recursive: true })

	const interval = 100
	const monitor = new CacheManager(
		{
			quiet: true,
			cachedir,
			interval,
			callbacks: {
				preStart: () => {
					const now = Date.now()
					// file-4 is newer than the interval and must not be deleted even when over maxSize
					for (const [i, ageMs] of [
						[1, 10000],
						[2, 5000],
						[3, 3000],
						[4, 0]
					]) {
						const f = `${cachedir}/test0/file-${i}`
						fs.writeFileSync(f, '0123456789')
						const time = (now - ageMs) / 1000
						fs.utimesSync(f, time, time)
					}
				},
				postCheck: results => {
					if (monitor.intervalId) {
						// the initial check has been tested below, before setInterval() was called
						monitor.stop()
						fs.rmSync(cachedir, { force: true, recursive: true })
						test.end()
						return
					}
					test.deepEqual(results.test0, { deletedCount: 2, totalCount: 4 }, 'should delete files until below maxSize')
					test.deepEqual(
						fs.readdirSync(`${cachedir}/test0`).sort(),
						['file-3', 'file-4'],
						'should delete the oldest files first'
					)
				}
			}
		},
		{
			test0: {
				type: 'session',
				maxAge: 60000, // no file expires by age
				maxSize: 25, // bytes, four 10-byte files exceed this limit
				skipMs: 0
			}
		}
	)
})

tape('subdir overrides', test => {
	const cachedir = path.join(process.cwd(), '.cache-test8')
	fs.rmSync(cachedir, { force: true, recursive: true })
	const monitor = new CacheManager({
		quiet: true,
		cachedir,
		mustExitPendingValidation: true,
		subdirs: {
			bedj: { maxSize: 1 },
			bam: { maxAge: 1000 }
		},
		callbacks: {}
	})
	test.deepEqual(
		monitor.subdirs.get('bedj'),
		{
			maxAge: 2592000000,
			maxSize: 1,
			skipMs: 43200000,
			fileExtensions: new Set(['.gz', '.tbi', '.csi', '.bb']),
			absPath: `${cachedir}/bedj`,
			skipUntil: 0
		},
		'should keep the subdir-specific defaults that are not overridden'
	)
	test.deepEqual(
		monitor.subdirs.get('bam'),
		{
			maxAge: 1000,
			maxSize: 5000000000,
			skipMs: 0,
			fileExtensions: new Set(['.bam', '.bai']),
			absPath: `${cachedir}/bam`,
			skipUntil: 0
		},
		'should keep the bam file extensions when overriding its maxAge'
	)
	fs.rmSync(cachedir, { force: true, recursive: true })
	test.end()
})

tape('limit deletion by file extension', test => {
	test.timeoutAfter(1000)
	test.plan(3)

	const cachedir = path.join(process.cwd(), '.cache-test3')
	// clear any previously created test cache dir
	fs.rmSync(cachedir, { force: true, recursive: true })

	const interval = 100
	// has to divide millisecond interval by 2 to force file to be rounded
	const monitor = new CacheManager(
		{
			//quiet: true,
			cachedir,
			interval,
			callbacks: {
				preStart: () => {
					for (const i of [1, 2, 3]) {
						const f = `${cachedir}/test0/file-${i}.${i === 1 ? 'json' : 'txt'}`
						fs.openSync(f, 'w')
					}
				},
				postCheck: results => {
					const remainingFiles = fs.readdirSync(`${cachedir}/test0`)
					if (monitor.intervalId) {
						monitor.stop()
						test.equal(remainingFiles.length, 1, `should have no remaining cache files after the test`)
						fs.rmSync(cachedir, { force: true, recursive: true })
						test.end()
						return
					}
					test.deepEqual(results.test0, { deletedCount: 2, totalCount: 2 }, `should only files with matching extension`)
					test.equal(remainingFiles.length, 1, `should have no remaining cache files after the test`)
				}
			}
		},
		{
			test0: {
				type: 'file',
				maxAge: -10, // force deletion of all files (with matching extension) by maxAge
				fileExtensions: new Set(['.txt'])
			}
		}
	)
})

tape('delete files without an extension', async test => {
	const cachedir = path.join(process.cwd(), '.cache-test9')
	fs.rmSync(cachedir, { force: true, recursive: true })
	const monitor = new CacheManager({
		quiet: true,
		cachedir,
		mustExitPendingValidation: true,
		subdirs: { extApiResponse: { maxAge: -10 } }, // force deletion of all files with matching extension
		callbacks: {}
	})
	const dir = `${cachedir}/extApiResponse`
	fs.writeFileSync(`${dir}/da39a3ee5e6b4b0d3255bfef95601890afd80709`, '{}')
	fs.writeFileSync(`${dir}/file.json`, '{}')
	fs.mkdirSync(`${dir}/subdir`)
	const results = await monitor.mayDeleteCacheFiles('extApiResponse', monitor.subdirs.get('extApiResponse'), 0)
	test.equal(results?.deletedCount, 1, 'should delete the file without an extension')
	test.deepEqual(
		fs.readdirSync(dir).sort(),
		['file.json'],
		'should keep the file with an extension, and remove the empty subdir that is older than maxAge'
	)
	fs.rmSync(cachedir, { force: true, recursive: true })
	test.end()
})

tape('delete expired snpgt files by mtime', async test => {
	const cachedir = path.join(process.cwd(), '.cache-test10')
	fs.rmSync(cachedir, { force: true, recursive: true })
	const monitor = new CacheManager({
		quiet: true,
		cachedir,
		mustExitPendingValidation: true,
		callbacks: {}
	})
	const dir = `${cachedir}/snpgt`
	// file names as written by termdb.snp.js: genome_dslabel_timestamp_random
	const oldFile = `${dir}/hg38_ds1_1700000000000_1234`
	const newFile = `${dir}/hg38_ds1_1700000000001_5678`
	fs.writeFileSync(oldFile, 'snpid')
	fs.writeFileSync(newFile, 'snpid')
	const oldTime = new Date(Date.now() - 31 * 24 * 3600 * 1000)
	fs.utimesSync(oldFile, oldTime, oldTime)
	const results = await monitor.mayDeleteCacheFiles('snpgt', monitor.subdirs.get('snpgt'), 0)
	test.equal(results?.deletedCount, 1, 'should delete the snpgt file older than the default maxAge')
	test.deepEqual(fs.readdirSync(dir), ['hg38_ds1_1700000000001_5678'], 'should keep the recent snpgt file')
	fs.rmSync(cachedir, { force: true, recursive: true })
	test.end()
})

tape('delete files in nested dirs', async test => {
	const cachedir = path.join(process.cwd(), '.cache-test11')
	fs.rmSync(cachedir, { force: true, recursive: true })
	const monitor = new CacheManager(
		{ quiet: true, cachedir, mustExitPendingValidation: true, callbacks: {} },
		// force deletion of all files with matching extension by maxAge
		{ test0: { type: 'file', maxAge: -10, fileExtensions: new Set(['.txt']) } }
	)
	const dir = `${cachedir}/test0`
	fs.mkdirSync(`${dir}/a/b`, { recursive: true })
	fs.mkdirSync(`${dir}/empty`)
	fs.writeFileSync(`${dir}/top.txt`, 'x')
	fs.writeFileSync(`${dir}/a/b/nested.txt`, 'x')
	fs.writeFileSync(`${dir}/a/keep.json`, 'x')
	const results = await monitor.mayDeleteCacheFiles('test0', monitor.subdirs.get('test0'), 0)
	test.deepEqual(results, { deletedCount: 2, totalCount: 2 }, 'should delete the matching files at any dir level')
	test.equal(fs.existsSync(`${dir}/a/b/nested.txt`), false, 'should delete the file in a nested dir')
	test.equal(fs.existsSync(`${dir}/a/keep.json`), true, 'should keep the nested file without a matching extension')
	test.deepEqual(fs.readdirSync(dir), ['a'], 'should remove the empty dirs, and keep the dir that is not empty')
	test.deepEqual(
		fs.readdirSync(`${dir}/a`),
		['keep.json'],
		'should remove the nested dir after its last file is deleted'
	)
	fs.rmSync(cachedir, { force: true, recursive: true })
	test.end()
})

tape('keep a recent empty dir', async test => {
	const cachedir = path.join(process.cwd(), '.cache-test12')
	fs.rmSync(cachedir, { force: true, recursive: true })
	const monitor = new CacheManager(
		{ quiet: true, cachedir, mustExitPendingValidation: true, callbacks: {} },
		{ test0: { type: 'session', maxAge: 60000 } }
	)
	const dir = `${cachedir}/test0`
	fs.mkdirSync(`${dir}/old`)
	fs.mkdirSync(`${dir}/recent`)
	const oldTime = new Date(Date.now() - 120000)
	fs.utimesSync(`${dir}/old`, oldTime, oldTime)
	await monitor.mayDeleteCacheFiles('test0', monitor.subdirs.get('test0'), 0)
	test.deepEqual(fs.readdirSync(dir), ['recent'], 'should only remove the empty dir that is older than maxAge')
	fs.rmSync(cachedir, { force: true, recursive: true })
	test.end()
})

tape('do not follow symlinks', async test => {
	const cachedir = path.join(process.cwd(), '.cache-test13')
	const outside = path.join(process.cwd(), '.cache-test13-outside')
	for (const d of [cachedir, outside]) fs.rmSync(d, { force: true, recursive: true })
	fs.mkdirSync(outside)
	fs.writeFileSync(`${outside}/target.txt`, 'x')
	const monitor = new CacheManager(
		{ quiet: true, cachedir, mustExitPendingValidation: true, callbacks: {} },
		{ test0: { type: 'session', maxAge: -10 } }
	)
	const dir = `${cachedir}/test0`
	fs.symlinkSync(outside, `${dir}/dirlink`)
	fs.symlinkSync(`${outside}/target.txt`, `${dir}/filelink`)
	const results = await monitor.mayDeleteCacheFiles('test0', monitor.subdirs.get('test0'), 0)
	test.deepEqual(results, { deletedCount: 2, totalCount: 2 }, 'should delete each symlink like a file')
	test.deepEqual(fs.readdirSync(dir), [], 'should not leave the symlinks')
	test.deepEqual(fs.readdirSync(outside), ['target.txt'], 'should not delete a file outside of the subdir')
	for (const d of [cachedir, outside]) fs.rmSync(d, { force: true, recursive: true })
	test.end()
})

/* replaces the dir at `from` by a symlink to `to`, once fs.promises[method] is called with `trigger`,
after that call has returned, as if the dir was replaced right after the sweep listed or stated it */
function swapDirAfter(method: 'readdir' | 'lstat', trigger: string, from: string, to: string) {
	const original = fs.promises[method] as any
	;(fs.promises as any)[method] = async (p, ...args) => {
		const result = await original(p, ...args)
		if (p == trigger) {
			fs.rmSync(from, { recursive: true })
			fs.symlinkSync(to, from)
		}
		return result
	}
	return () => ((fs.promises as any)[method] = original)
}

tape('do not descend into a dir that is replaced by a symlink after it is listed', async test => {
	const cachedir = path.join(process.cwd(), '.cache-test17')
	const outside = path.join(process.cwd(), '.cache-test17-outside')
	for (const d of [cachedir, outside]) fs.rmSync(d, { force: true, recursive: true })
	fs.mkdirSync(outside)
	fs.writeFileSync(`${outside}/f`, 'x')
	const monitor = new CacheManager(
		{ quiet: true, cachedir, mustExitPendingValidation: true, callbacks: {} },
		{ test0: { type: 'session', maxAge: -10 } }
	)
	const dir = `${cachedir}/test0`
	fs.mkdirSync(`${dir}/a`)
	fs.writeFileSync(`${dir}/a/f`, 'x')
	const restore = swapDirAfter('readdir', dir, `${dir}/a`, outside)
	const consoleError = console.error
	const errors: string[] = []
	console.error = (msg: string) => errors.push(msg)
	try {
		await monitor.mayDeleteCacheFiles('test0', monitor.subdirs.get('test0'), 0)
	} finally {
		console.error = consoleError
		restore()
	}
	test.deepEqual(fs.readdirSync(outside), ['f'], 'should not delete a file in the dir that the symlink points to')
	test.equal(errors.length, 1, 'should log one error')
	test.ok(errors[0]?.includes('test0/a'), 'should log the path of the replaced dir')
	for (const d of [cachedir, outside]) fs.rmSync(d, { force: true, recursive: true })
	test.end()
})

tape('do not delete from a dir that is replaced by a symlink during the walk', async test => {
	const cachedir = path.join(process.cwd(), '.cache-test18')
	const outside = path.join(process.cwd(), '.cache-test18-outside')
	for (const d of [cachedir, outside]) fs.rmSync(d, { force: true, recursive: true })
	fs.mkdirSync(outside)
	fs.writeFileSync(`${outside}/f`, 'x')
	const monitor = new CacheManager(
		{ quiet: true, cachedir, mustExitPendingValidation: true, callbacks: {} },
		{ test0: { type: 'session', maxAge: -10 } }
	)
	const dir = `${cachedir}/test0`
	fs.mkdirSync(`${dir}/a`)
	fs.writeFileSync(`${dir}/a/f`, 'x')
	// the parent dir is replaced after the expired file is stated and before it is deleted
	const restore = swapDirAfter('lstat', `${dir}/a/f`, `${dir}/a`, outside)
	const consoleError = console.error
	const errors: string[] = []
	console.error = (msg: string) => errors.push(msg)
	try {
		await monitor.mayDeleteCacheFiles('test0', monitor.subdirs.get('test0'), 0)
	} finally {
		console.error = consoleError
		restore()
	}
	test.deepEqual(fs.readdirSync(outside), ['f'], 'should not delete a file in the dir that the symlink points to')
	test.equal(errors.length, 1, 'should log one error')
	test.ok(errors[0]?.includes('test0/a/f'), 'should log the path of the file that is not deleted')
	for (const d of [cachedir, outside]) fs.rmSync(d, { force: true, recursive: true })
	test.end()
})

tape('move nested files with their relative path', async test => {
	const cachedir = path.join(process.cwd(), '.cache-test14')
	fs.rmSync(cachedir, { force: true, recursive: true })
	const monitor = new CacheManager(
		{ quiet: true, cachedir, mustExitPendingValidation: true, callbacks: {} },
		{
			test0: { type: 'session', maxAge: -10, moveTo: 'trash' },
			trash: { type: 'session', maxAge: 60000 }
		}
	)
	const dir = `${cachedir}/test0`
	for (const sub of ['a', 'b']) {
		fs.mkdirSync(`${dir}/${sub}`)
		fs.writeFileSync(`${dir}/${sub}/same-name`, sub)
	}
	const results = await monitor.mayDeleteCacheFiles('test0', monitor.subdirs.get('test0'), 0)
	test.deepEqual(results, { deletedCount: 2, totalCount: 2 }, 'should move both expired files')
	for (const sub of ['a', 'b']) {
		test.equal(
			fs.readFileSync(`${cachedir}/trash/${sub}/same-name`, 'utf8'),
			sub,
			`should move ${sub}/same-name to the same relative path in trash`
		)
	}
	test.deepEqual(fs.readdirSync(dir), [], 'should remove the source dirs after their files are moved')
	fs.rmSync(cachedir, { force: true, recursive: true })
	test.end()
})

tape('continue the sweep after an unreadable dir', async test => {
	// root can read a dir without permissions, so the error cannot be created
	if (process.getuid?.() === 0) {
		test.comment('skipped when running as root')
		test.end()
		return
	}
	const cachedir = path.join(process.cwd(), '.cache-test15')
	fs.rmSync(cachedir, { force: true, recursive: true })
	const monitor = new CacheManager(
		{ quiet: true, cachedir, mustExitPendingValidation: true, callbacks: {} },
		{ test0: { type: 'session', maxAge: -10 } }
	)
	const dir = `${cachedir}/test0`
	for (const sub of ['a', 'b', 'c']) {
		fs.mkdirSync(`${dir}/${sub}`)
		fs.writeFileSync(`${dir}/${sub}/f`, 'x')
	}
	fs.chmodSync(`${dir}/b`, 0)
	const consoleError = console.error
	const errors: string[] = []
	console.error = (msg: string) => errors.push(msg)
	let results
	try {
		results = await monitor.mayDeleteCacheFiles('test0', monitor.subdirs.get('test0'), 0)
	} finally {
		console.error = consoleError
		fs.chmodSync(`${dir}/b`, 0o755)
	}
	test.deepEqual(results, { deletedCount: 2, totalCount: 2 }, 'should delete the files in the other dirs')
	test.deepEqual(fs.readdirSync(dir), ['b'], 'should only keep the unreadable dir')
	test.equal(errors.length, 1, 'should log one error')
	test.ok(errors[0]?.includes('test0/b'), 'should log the path of the unreadable dir')
	fs.rmSync(cachedir, { force: true, recursive: true })
	test.end()
})

tape('delete url index files by extension', async test => {
	const cachedir = path.join(process.cwd(), '.cache-test16')
	fs.rmSync(cachedir, { force: true, recursive: true })
	const monitor = new CacheManager({
		quiet: true,
		cachedir,
		mustExitPendingValidation: true,
		subdirs: { https: { maxAge: -10 } }, // force deletion of all files with matching extension
		callbacks: {}
	})
	// the cache dir of a track url, as created by cache_index
	const dir = `${cachedir}/https/example.org/tracks/t.gz`
	fs.mkdirSync(dir, { recursive: true })
	// an index url with a query string, and a partial download of an index
	for (const name of ['t.gz.tbi', 't.gz.tbi?token=x', 't.gz.csi#frag', 't.gz.tbi.123.456.tmp', 'notes.txt'])
		fs.writeFileSync(`${dir}/${name}`, 'x')
	const results = await monitor.mayDeleteCacheFiles('https', monitor.subdirs.get('https'), 0)
	test.deepEqual(results, { deletedCount: 4, totalCount: 4 }, 'should delete the index files and the partial download')
	test.deepEqual(fs.readdirSync(dir), ['notes.txt'], 'should keep the file without an index extension')
	fs.rmSync(cachedir, { force: true, recursive: true })
	test.end()
})

tape('url protocols are declared in cacheRegistry', test => {
	test.deepEqual([...cacheUrlProtocols].sort(), ['ftp', 'http', 'https'], 'should list the url subdirs')
	test.end()
})

tape('checks concurrency and postStop callback', test => {
	let hasChecked = false
	const message = `should not have multiple active checks`
	const interval = 100
	const monitor = new CacheManager({
		quiet: true,
		interval,
		callbacks: {
			preStart: m => {
				m.hasActiveCheck = true // force
			},
			/* v8 ignore start */
			postCheck: () => {
				hasChecked = true
				test.fail(message)
				monitor.stop()
			},
			/* v8 ignore stop */
			postStop: () => {
				test.pass(`should call a postStop callback if supplied`)
				test.end()
			}
		}
	})
	setTimeout(() => {
		/* v8 ignore next */
		if (hasChecked) return
		test.pass(message)
		monitor.stop()
	}, 2 * interval + 10)
})

tape('may skip start()', test => {
	test.timeoutAfter(300)
	test.plan(2)
	const cachedir = path.join(process.cwd(), '.cache-test4')
	let numChecks = 0
	const monitor = new CacheManager({
		quiet: true,
		cachedir,
		interval: 100,
		callbacks: {
			preStart: () => {
				test.pass('should call preStart callback')
			},
			/* v8 ignore start */
			postCheck: () => {
				numChecks++
				// will fail in the setTimeout callback below
				monitor.stop()
			}
			/* v8 ignore stop */
		},
		mustExitPendingValidation: true
	})

	setTimeout(() => {
		test.equal(numChecks, 0, 'must not start checking cache files when opts.mustExitPendingValidation=true')
		test.end()
	}, 200)
})

tape('creates every cacheRegistry subdir', test => {
	const cachedir = path.join(process.cwd(), '.cache-test5')
	fs.rmSync(cachedir, { force: true, recursive: true })
	const monitor = new CacheManager({
		quiet: true,
		cachedir,
		mustExitPendingValidation: true,
		// a disabled feature still has its subdir created
		subdirs: { massSession: { maxAge: 0 } },
		callbacks: {}
	})
	for (const name of Object.keys(cacheRegistry)) {
		test.ok(monitor.subdirs.get(name), `subdir '${name}' from cacheRegistry is registered`)
		test.ok(fs.existsSync(path.join(cachedir, name)), `subdir '${name}' is created`)
	}
	fs.rmSync(cachedir, { force: true, recursive: true })
	test.end()
})

tape('rejects invalid subdir overrides', test => {
	const cachedir = path.join(process.cwd(), '.cache-test6')
	fs.rmSync(cachedir, { force: true, recursive: true })
	const construct = subdirs => () =>
		new CacheManager({ quiet: true, cachedir, mustExitPendingValidation: true, subdirs, callbacks: {} })
	for (const name of ['de', 'bam', 'massSession']) {
		test.throws(
			construct({ [name]: undefined }),
			new RegExp(`cacheMonitor.subdirs.${name} must be an object of overrides, a cache subdir cannot be disabled`),
			`constructor throws synchronously when the ${name} subdir is set to undefined`
		)
	}
	test.throws(
		construct({ massSesion: { maxAge: 0 } }),
		/Unknown cache subdir 'massSesion'/,
		'constructor throws on a subdir that is not in cacheRegistry'
	)
	test.throws(
		construct({ bam: { type: 'compute' } }),
		/cacheMonitor.subdirs.bam.type cannot be overridden/,
		'constructor throws on an override of type'
	)
	test.throws(
		construct({ de: { maxPending: 100 } }),
		/cacheMonitor.subdirs.de.maxPending cannot be overridden/,
		'constructor throws on an override of maxPending'
	)
	test.equal(fs.existsSync(cachedir), false, 'should not create the cachedir when an override is invalid')
	test.end()
})
