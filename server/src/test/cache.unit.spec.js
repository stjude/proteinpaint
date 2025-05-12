import tape from 'tape'
import serverconfig from '../serverconfig.js'
import path from 'path'
import fs from 'fs'
import { Cache } from '#src/Cache.ts'

/** Tests
 * - init() cache files
 * - Delete cache files
 */
const cache = new Cache(serverconfig.cachedir)

/**************
 helper functions
***************/

function makeTestFiles() {
	const filesCreated = []
	for (const subdir of cache.defaultCacheDirs) {
		//Only gsea is enabled at this time.
		if (subdir.dir != 'gsea') continue
		const dirPath = path.join(serverconfig.cachedir, subdir.dir)
		//Only create the file if it doesn't exist
		//Do not create new files when tests fail.
		const ext = subdir?.fileExtensions?.size ? Array.from(subdir.fileExtensions)[0] : '.txt'
		const testFilePath = `${dirPath}/testfile${ext}`
		if (fs.existsSync(dirPath) && !fs.existsSync(testFilePath)) {
			fs.writeFileSync(testFilePath, 'test file')
		}
		filesCreated.push(testFilePath)
	}
	return filesCreated
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
	//Ensure there's enough time with the cache interval
	test.timeoutAfter(cache.interval + 200)

	const filePaths = makeTestFiles()
	cache.deleteCacheFiles(true)
	//Need to await the interval to ensure that the cache files are deleted.
	//Keep + 100 for CI.
	await sleep(cache.interval + 100)
	for (const filePath of filePaths) {
		const message = `Should delete test cache file: ${filePath}`
		if (fs.existsSync(filePath)) {
			test.fail(message)
		} else {
			test.pass(message)
		}
	}

	test.end()
})
