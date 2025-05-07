import serverconfig from './serverconfig.js'
import fs from 'fs'
import path from 'path'

export class Cache {
	readonly defaultCacheDirs = [
		/** Temporarily stores sliced bam files */
		{ dir: 'bam' },
		/** In use? */
		{ dir: 'genome' },
		/** Temporarily stores pickle files for gsea */
		{ dir: 'gsea' },
		/** to ensure temp files saved in previous server session are accessible in current session
		 * must use consistent dir name but not random dir name that changes from last server boot
		 */
		{ dir: 'massSession' },
		/** DELETE THIS after process for deleting mass session files moved into production */
		{ dir: 'massSessionTrash' },
		/** Used by snplst and snplocus terms */
		{
			dir: 'snpgt',
			fileNameRegexp: /[^\w]/, // client-provided cache file name matching with this are denied
			sampleColumn: 6 // in cache file, sample column starts from 7th column
		}
	]

	async init() {
		// create sub directories under cachedir, and register path in serverconfig
		for (const dir of this.defaultCacheDirs) {
			if (Object.keys(dir).length > 1) {
				//cache objs are defined as cache_<dir> in serverconfig
				serverconfig[`cache_${dir.dir}`] = {
					dir: await this.mayCreateSubdirInCache(dir.dir),
					fileNameRegexp: dir.fileNameRegexp || '',
					sampleColumn: dir.sampleColumn || 0
				}
			}
			// cache dirs are defined as cachedir_<dir> in serverconfig
			else serverconfig[`cachedir_${dir.dir}`] = await this.mayCreateSubdirInCache(dir.dir)
		}
	}

	/** Check if the subdir exists. If not create. */
	async mayCreateSubdirInCache(subdir: string) {
		const dir = path.join(serverconfig.cachedir, subdir)
		try {
			await fs.promises.stat(dir)
		} catch (e: any) {
			if (e.code == 'ENOENT') {
				try {
					// If no information is returned, make dir
					await fs.promises.mkdir(dir)
				} catch (err) {
					throw `cannot make sub cache ${subdir}: ${err}`
				}
			} else {
				throw `error stating sub cache ${subdir}`
			}
		}
		return dir
	}
}
