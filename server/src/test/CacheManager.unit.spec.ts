import tape from 'tape'
import path from 'path'
import fs from 'fs'
import { CacheManager } from '#src/CacheManager.ts'

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
	test.pass('-***- src/CacheManager -***-')
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
						gsea: {
							maxAge: 7200000,
							maxSize: 5000000000,
							skipMs: 0,
							fileExtensions: new Set(['.pkl']),
							absPath: `${m.cachedir}/gsea`,
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
							massSessionTrash: { deletedCount: 0, totalCount: 0 }
						},
						`should detect no cache files to delete`
					)
				}
				if (numChecks == 2) {
					test.deepEqual(
						results,
						{
							gsea: { deletedCount: 0, totalCount: 0 }
							// massSession|Trash has skipMs >= 30 days, so only gsea subdir will be checked in 2nd iteration
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

tape('move or delete by maxAge', function (test) {
	test.timeoutAfter(1000)
	test.plan(15)

	const cachedir = path.join(process.cwd(), '.cache-test2')
	// clear any previously created test cache dir
	fs.rmSync(cachedir, { force: true, recursive: true })
	let numChecks = 0

	const interval = 100
	const maxAge = interval - 10
	const monitor = new CacheManager({
		//quiet: true,
		cachedir,
		interval,
		subdirs: {
			gsea: undefined, // clear default entries, so they are not included in the test
			massSession: undefined,
			massSessionTrash: undefined,
			test0: {
				// only test0 will be created
				maxAge,
				moveTo: 'trash'
			},
			trash: {
				maxAge: maxAge * 2,
				skipMs: interval * 2
			}
		},
		callbacks: {
			preStart: m => {
				test.deepEqual(
					Object.fromEntries(m.subdirs.entries()),
					{
						test0: {
							maxAge,
							maxSize: 5000000000,
							skipMs: 0,
							absPath: `${cachedir}/test0`,
							skipUntil: 0,
							moveTo: 'trash',
							movePath: `${cachedir}/trash`
						},
						trash: {
							maxAge: maxAge * 2,
							maxSize: 5000000000,
							skipMs: interval * 2,
							absPath: `${cachedir}/trash`,
							skipUntil: 0
						}
					},
					`should set override subdir properties`
				)

				const now = Date.now()
				for (const i of [1, 2, 3]) {
					const f = `${cachedir}/test0/file-${i}`
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
						: numChecks == 1
						? { deletedCount: 1, totalCount: 3 }
						: numChecks == 2
						? { deletedCount: 1, totalCount: 2 }
						: numChecks == 3
						? { deletedCount: 1, totalCount: 1 }
						: { deletedCount: 0, totalCount: 0 }

				test.deepEqual(results.test0, expected, `should have expected results after check #${numChecks}`)

				const expectedTrash =
					numChecks == 0
						? { deletedCount: 0, totalCount: 0 }
						: numChecks == 1
						? undefined
						: numChecks == 2
						? { deletedCount: 1, totalCount: 2 }
						: numChecks == 3
						? undefined
						: numChecks == 4
						? { deletedCount: 2, totalCount: 2 }
						: undefined

				test.deepEqual(results.trash, expectedTrash, `should have expected trash after check #${numChecks}`)

				numChecks++
				if (numChecks > 5) {
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
	})
})

// TODO:
// tape('delete by maxSize', async function (test) {
// 	...
// })

tape('limit deletion by file extension', test => {
	test.timeoutAfter(1000)
	test.plan(3)

	const cachedir = path.join(process.cwd(), '.cache-test3')
	// clear any previously created test cache dir
	fs.rmSync(cachedir, { force: true, recursive: true })

	const interval = 100
	// has to divide millisecond interval by 2 to force file to be rounded
	const monitor = new CacheManager({
		//quiet: true,
		cachedir,
		interval,
		subdirs: {
			gsea: undefined, // clear default entries, so they are not included in the test
			massSession: undefined,
			massSessionTrash: undefined,
			test0: {
				maxAge: -10, // force deletion of all files (with matching extension) by maxAge
				fileExtensions: new Set(['.txt'])
			}
		},
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
	})
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
