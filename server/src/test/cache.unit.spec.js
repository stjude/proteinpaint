import tape from 'tape'
import serverconfig from '../serverconfig.js'
import path from 'path'
import fs from 'fs'
import { Cache } from '#src/Cache.js'

/** Tests
 * - init() cache files
 * - Delete cache files
 */

const cache = new Cache(serverconfig.cachedir)

/**************
 helper functions
***************/

function makeTestFiles() {
	for (const subdir of cache.defaultCacheDirs) {
		const dirPath = path.join(serverconfig.cachedir, subdir.dir)
		//Only create the file if it doesn't exist
		//Do not create new files when tests fail.
		const ext = subdir?.fileExtensions?.size ? Array.from(subdir.fileExtensions)[0] : 'txt'
		const testFilePath = `${dirPath}/testfile.${ext}`
		if (fs.existsSync(dirPath) && !fs.existsSync(testFilePath)) {
			fs.writeFileSync(testFilePath, 'test file')
		}
	}
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**************
 test sections
***************/

tape('\n', async function (test) {
	test.pass('-***- src/Cache -***-')
	test.end()
})

/** The cache subdirectories are created on init.
 * The test checks whether the cache subdirectories are created. */
tape('init() cache files', async function (test) {
	test.timeoutAfter(100)

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
	test.timeoutAfter(cache.interval + 100)

	makeTestFiles()
	cache.deleteCacheFiles(true)

	//Need to await the interval to ensure that the cache files are deleted.
	await sleep(cache.interval + 5)

	//Only the gsea is enabled at this time.
	//No need to test the other cache subdirectories.
	if (fs.existsSync(serverconfig.cachedir_gsea + '/testfile.pkl')) {
		test.fail('Cache files were not deleted.')
	} else {
		test.pass('Cache files were deleted.')
	}

	test.end()
})
