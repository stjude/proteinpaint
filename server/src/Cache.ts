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
		{ dir: 'gsea', fileExtensions: new Set(['.pkl']) },
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
		for (const subdir of this.defaultCacheDirs) {
			if (Object.keys(subdir).length > 1) {
				//cache objs are defined as cache_<dir> in serverconfig
				serverconfig[`cache_${subdir.dir}`] = {
					dir: await this.mayCreateSubdirInCache(subdir.dir),
					fileNameRegexp: subdir.fileNameRegexp || '',
					sampleColumn: subdir.sampleColumn || 0
				}
			}
			// cache dirs are defined as cachedir_<dir> in serverconfig
			else serverconfig[`cachedir_${subdir.dir}`] = await this.mayCreateSubdirInCache(subdir.dir)
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

	deleteCacheFiles() {
		// Allow the serverconfig to override the default interval of 1 minute
		// Useful for CI
		const cacheMonitor = serverconfig.features?.cacheMonitor
		const interval = cacheMonitor.intervalOverride || 1000 * 60
		// Clear the subdirectories periodically, defined by the interval
		// and optional cacheMonitor settings in serverconfig
		setInterval(async () => {
			console.log('Checking for cached files to delete ...')
			for (const subdir of this.defaultCacheDirs) {
				//Only enable gsea for now
				if (subdir.dir !== 'gsea') continue
				const maxAge = cacheMonitor?.[subdir.dir].maxAge || 1000 * 60 * 60 * 2 // 2 hours
				const maxSize = cacheMonitor?.[subdir.dir].maxSize || 5e9 // 5 GB
				await this.mayDeleteCacheFiles(maxAge, maxSize, serverconfig[`cache_${subdir.dir}`], interval)
			}
		}, interval)
	}

	async mayDeleteCacheFiles(maxAge: number, maxSize: number, subdir, interval: number) {
		console.log(`checking for cached ${subdir.dir} files to delete ...`)
		try {
			const minTime = Date.now() - maxAge
			const filenames = await fs.promises.readdir(subdir.dir)
			// keep list of undeleted files. may need to rank them and delete old ones ranked by age
			const files: { path: any; time: any; size: any; deleted?: any }[] = []
			let totalSize = 0,
				deletedSize = 0,
				totalCount = 0,
				deletedCount = 0
			for (const filename of filenames) {
				if (subdir.fileExtensions.size && !subdir.fileExtensions.has(path.extname(filename))) continue
				totalCount++
				const fp = path.join(subdir, filename)
				const s = await fs.promises.stat(fp)
				if (!s.isFile()) continue
				const time = s.mtimeMs
				if (time < minTime) {
					await fs.promises.unlink(fp)
					deletedCount++
					deletedSize += s.size
					continue
				}
				files.push({
					path: fp,
					time,
					size: s.size
				})
				totalSize += s.size
			}
			files.sort((i, j) => j.time - i.time) // descending
			if (totalSize >= maxSize) {
				/*
					storage use is still above limit, deleting files just older than cutoff is not enough
					a lot of recent requests may have deposited lots of cache files
					must delete more old files ranked by age
					*/
				const minMtime = Date.now() - interval
				for (const f of files) {
					// do not delete files too soon that it may affect a current file read
					if (f.time > minMtime) break
					await fs.promises.unlink(f.path)
					f.deleted = true
					deletedCount++
					deletedSize += f.size
					totalSize -= f.size
					if (totalSize < maxSize) break
				}
			}
			console.log(
				`deleted ${deletedCount} of ${totalCount} cached files (${deletedSize} bytes deleted, ${totalSize} remaining)`
			)
		} catch (e) {
			console.error('Error in mayDeleteCacheFiles(): ' + e)
		}
	}
}
