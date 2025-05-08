import tape from 'tape'
import serverconfig from '../serverconfig.js'
import path from 'path'
import fs from 'fs'
import { Cache } from '#src/Cache.js'
import { clear } from 'console'

/** Tests
 * - init() cache files
 * - Delete cache files
 */

const cache = new Cache(serverconfig.cachedir)

function makeTestFiles() {
	for (const subdir of cache.defaultCacheDirs) {
		const dirPath = path.join(serverconfig.cachedir, subdir.dir)
		//Only create the file if it doesn't exist
		//Do not create new files when tests fail.
		const testFilePath = dirPath + '/testfile.txt'
		if (fs.existsSync(dirPath) && !fs.existsSync(testFilePath)) {
			fs.writeFileSync(testFilePath, 'test file')
		}
	}
}

tape('\n', async function (test) {
	test.pass('-***- src/Cache -***-')
	test.end()
})

/** The cache subdirectories are created on init.
 * The test checks whether the cache subdirectories are created. */
tape('init() cache files', async function (test) {
	test.timeoutAfter(3000)

	/** Creates all the directories under server/test/cache,
	 * if needed, for testing. server/test/cache is ignored
	 * by git. */
	await cache.init()

	for (const subdir of cache.defaultCacheDirs) {
		let failed = false
		//Test both conditions individually
		if (!serverconfig[`cachedir_${subdir.dir}`] && subdir?.onlyCache != true) failed = true
		if (subdir?.onlyCache == true && !serverconfig[`cache_${subdir.dir}`]) failed = true
		if (failed) {
			test.fail(`Subdirectory, ${subdir.dir}, failed to initialize.`)
			continue
		} else test.pass(`Subdirectory, ${subdir.dir}, initialized.`)
	}

	test.end()
})

tape('Delete cache files', async function (test) {
	test.timeoutAfter(3000)

	makeTestFiles()
	const interval = cache.deleteCacheFiles()
	interval.stop()
	test.end()
})
