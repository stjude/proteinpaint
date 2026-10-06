import tape from 'tape'
import path from 'path'
import fs from 'fs'
import { CacheManager, cacheRegistry } from '#src/CacheManager.ts'

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
							fileExtensions: new Set(['.jpg']),
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
							extApiResponse: { deletedCount: 0, totalCount: 0 },
							snpgt: { deletedCount: 0, totalCount: 0 }
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
		['file.json', 'subdir'],
		'should keep the file with an extension and the subdir'
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
