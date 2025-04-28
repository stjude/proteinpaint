import fs from 'fs'
import path from 'path'
import serverconfig from './serverconfig.js'

type CacheOpts = {
	/** Set a specific directory within the cache (e.g. bam, gsea, etc.) instead of
	 * the default/root cachedir.*/
	cachedir?: string
	/** time to wait before triggering another call to mayDeleteCacheFiles(),
	 * this is used to debounce/prevent multiple active calls to mayDeleteCacheFiles()
	 * also assumed to be roughly equivalent to the minimum required time for a file read
	 * to complete, otherwise deleting sooner than this may cause a file read error;
	 * this last assumption only applies to file deletion when the maxSize is exceeded */
	checkWait?: number
	/** file extensions to target. Leave blank to delete everything in the dir */
	fileExtensions?: string[]
	/** the max age for the modified time, will delete files whose modified time
	 * exceeds this "aged" access (in milliseconds) */
	maxAge?: number
	/** maximum allowed cache size in bytes */
	maxSize?: number
}

/**
 * This is a prototype cache class for managing files in the cachedir.
 */

export class Cache {
	/** a pending timeout reference from setTimeout that calls mayDeleteCacheFiles */
	private cacheCheckTimeout: NodeJS.Timeout | undefined | number
	cachedir: string
	public checkWait: number
	private fileExtensions: string[]
	/** in milliseconds */
	private maxAge: number
	/** in bytes */
	private maxSize: number
	private nextCheckTime = 0

	constructor(opts: CacheOpts = {}) {
		this.cacheCheckTimeout = 0
		this.cachedir = opts.cachedir || serverconfig.cachedir
		this.checkWait = opts.checkWait || 1 * 60 * 1000
		this.fileExtensions = opts.fileExtensions || []
		this.maxAge = opts.maxAge || 2 * 60 * 60 * 1000
		this.maxSize = opts.maxSize || 5e9
	}

	mayResetCacheCheckTimeout(wait = 0) {
		// do not trigger the cache check when only validating the server
		if (process.argv.includes('validate')) return

		const checkTime = Date.now() + wait
		if (this.cacheCheckTimeout) {
			if (this.nextCheckTime && this.nextCheckTime <= checkTime + 5) return
			else {
				clearTimeout(this.cacheCheckTimeout)
				this.cacheCheckTimeout = undefined
			}
		}
		this.nextCheckTime = checkTime
		console.log(`will trigger mayDeleteCacheFiles() in ${wait} ms`)
		this.cacheCheckTimeout = setTimeout(this.mayDeleteCacheFiles.bind(this), wait)
	}

	async mayDeleteCacheFiles() {
		console.log(`checking for cached files to delete ...`)
		try {
			const minTime = Date.now() - this.maxAge
			const filenames = await fs.promises.readdir(this.cachedir)
			const files: { path: any; time: any; size: any; deleted?: any }[] = [] // keep list of undeleted files. may need to rank them and delete old ones ranked by age
			let totalSize = 0,
				deletedSize = 0,
				totalCount = 0,
				deletedCount = 0
			for (const filename of filenames) {
				if (this.fileExtensions.length && !this.fileExtensions.some(ext => filename.endsWith(ext))) continue
				totalCount++
				const fp = path.join(this.cachedir, filename)
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
			if (totalSize >= this.maxSize) {
				/*
                storage use is still above limit, deleting files just older than cutoff is not enough
                a lot of recent requests may have deposited lots of cache files
                must delete more old files ranked by age
                */
				const minMtime = Date.now() - this.checkWait
				for (const f of files) {
					// do not delete files too soon that it may affect a current file read
					if (f.time > minMtime) break
					await fs.promises.unlink(f.path)
					f.deleted = true
					deletedCount++
					deletedSize += f.size
					totalSize -= f.size
					if (totalSize < this.maxSize) break
				}
			}
			console.log(
				`deleted ${deletedCount} of ${totalCount} cached files (${deletedSize} bytes deleted, ${totalSize} remaining)`
			)
			// empty out the following tracking variables
			this.cacheCheckTimeout = undefined
			this.nextCheckTime = 0
			const nextFile = totalSize && files.find(f => !f.deleted)
			if (nextFile) {
				// trigger another mayDeleteCachefile() call with setTimeout,
				// using the oldest file mtime + checkWait as the wait time,
				// or much sooner if the max cache size is currently exceeded
				const wait =
					this.checkWait +
					Math.round(totalSize >= this.maxSize ? 0 : Math.max(0, nextFile.time + this.maxAge - Date.now()))
				this.mayResetCacheCheckTimeout(wait)
			}
		} catch (e) {
			console.error('Error in mayDeleteCacheFiles(): ' + e)
		}
	}
}
