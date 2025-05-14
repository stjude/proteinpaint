import tape from 'tape'
import serverconfig from '../serverconfig.js'
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
	test.plan()

	const cachedir = path.join(process.cwd(), '.cache-test1')
	// clear any previously created test cache dir
	fs.rmSync(cachedir, { force: true, recursive: true })
	let numChecks = 0

	const monitor = new CacheManager({
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

tape('delete by maxAge', function (test) {
	test.timeoutAfter(10000)
	test.plan(6)

	const cachedir = path.join(process.cwd(), '.cache-test2')
	// clear any previously created test cache dir
	fs.rmSync(cachedir, { force: true, recursive: true })
	let numChecks = 0

	const interval = 100
	// has to divide millisecond interval by 2 to force file to be rounded
	const maxAge = interval - 10
	const monitor = new CacheManager({
		cachedir,
		interval,
		subdirs: {
			gsea: undefined, // clear default entries, so they are not included in the test
			massSession: undefined,
			massSessionTrash: undefined,
			test0: {
				// only test0 will be created
				maxAge
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
				numChecks++
				if (numChecks > 3) {
					monitor.stop()
					const remainingFiles = fs.readdirSync(`${cachedir}/test0`)
					test.equal(remainingFiles.length, 0, `should delete all cache files after the test`)
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
