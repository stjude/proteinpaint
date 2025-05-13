import serverconfig from './serverconfig.js'
import fs from 'fs'
import path from 'path'

/*
  
*/

type CacheMonitor = {
	maxAge: number
	maxSize: number
	/**
	 * number of milliseconds to skip checking files in the subdir after the initial check
	 * - if zero, run on every interval of the cache monitor
	 * - if >1, do not check files again in the subdir until the skipped time is reached/exceeded
	 */
	skipMs: number
	fileExtensions?: Set<string | RegExp>
	absPath?: string // absolute path to cache dir
}

type CacheOpts = {
	interval?: number
	monitorByDir?: {
		[dir: string]: {
			maxAge?: number
			maxSize?: number
			skipMs?: number
			fileExtensions?: Set<string | RegExp>
		}
	}
}

// defaults
const cacheMonitorDefaults: CacheMonitor = {
	maxAge: 1000 * 60 * 60 * 2, // 2 hours
	maxSize: 5e9, // 5 GB
	skipMs: 0 // run on every interval check
}

const defaultOpts: CacheOpts = {
	interval: 1000 * 60, // wait time between each interval loop to check cache files
	monitorByDir: {
		// dirName: 'gsea' TODO: reuse for 'bam' | 'massSession' | 'snpgt' | etc
		gsea: {
			...cacheMonitorDefaults,
			fileExtensions: new Set(['.pkl'])
		},
		massSession: {
			...cacheMonitorDefaults,
			maxAge: 1000 * 60 * 60 * 24 * 30, // total milliseconds in 30 days
			skipMs: 1000 * 60 * 60 * 12 // every 12 hours
		},
		massSessionTrash: {
			...cacheMonitorDefaults,
			maxAge: 1000 * 60 * 60 * 24 * 60, // total milliseconds in 60 days
			skipMs: 1000 * 60 * 60 * 12 // run every 12 hours
		}
		// bam: {
		//  ...cacheMonitorDefaults,
		// 	fileExtensions: new Set(['.bam', '.bai'])
		// },
	}
}

/** This class created the subdirectories under the cache
 * and manages the cache files in those directories.*/
export class CacheManager {
	// the wait time before each iteration of checking the cache for expired files
	interval: number
	monitorByDir: Map<string, CacheMonitor & { absPath: string; skipUntil: number }> //
	// the reference to setInterval
	intervalId!: any // Timeout

	constructor(opts: CacheOpts = defaultOpts) {
		this.monitorByDir = new Map()
		this.interval = opts.interval || defaultOpts.interval || 1000 * 60 // default, every minute
		const monitorByDir = Object.assign({}, defaultOpts.monitorByDir, opts.monitorByDir || {})
		for (const [dirName, dirOpts] of Object.entries(monitorByDir)) {
			// NOTE: may want to use recursive copyMerge() here in case dirOpts becomes nested?
			const opts = Object.assign({}, cacheMonitorDefaults, dirOpts)
			this.setComputedMonitorConfig(dirName, opts)
		}
		this.startMonitor()
	}

	/** Check if the subdir exists. If not create. */
	setComputedMonitorConfig(subdir: string, dirOpts: CacheMonitor) {
		const dir = path.join(serverconfig.cachedir, subdir)
		try {
			fs.statSync(dir)
		} catch (e: any) {
			if (e.code == 'ENOENT') {
				try {
					// If no information is returned, make dir
					fs.mkdirSync(dir)
				} catch (err) {
					throw `cannot make sub cache ${subdir}: ${err}`
				}
			} else {
				throw `error stating sub cache ${subdir}`
			}
		}
		this.monitorByDir.set(subdir, { ...dirOpts, absPath: dir, skipUntil: 0 })
	}

	async startMonitor() {
		const checkCacheFiles = async () => {
			const now = Date.now()
			for (const [subdir, dirOpts] of this.monitorByDir.entries()) {
				if (now > dirOpts.skipUntil) await this.mayDeleteCacheFiles(subdir, dirOpts, this.interval)
				dirOpts.skipUntil = now + dirOpts.skipMs
			}
		}

		// clear expired cache files initially when this instance is constructed,
		// before the periodic check runs
		checkCacheFiles()

		// Clear the subdirectories periodically, defined by the interval
		// and optional cacheMonitor settings in serverconfig
		this.intervalId = setInterval(checkCacheFiles, this.interval)
	}

	// can call this in spec file after running tests
	stopMonitor() {
		clearInterval(this.intervalId)
	}

	async mayDeleteCacheFiles(subdir, dirOpts, interval: number) {
		const { maxSize, maxAge, absPath, fileExtensions } = dirOpts
		console.log(`checking for cached ${subdir} files to delete ...`)
		try {
			const minTime = Date.now() - maxAge
			const filenames = await fs.promises.readdir(absPath)
			if (filenames.length == 0) {
				console.log(`No ${subdir} cached files to delete`)
				return
			}
			// keep list of undeleted files. may need to rank them and delete old ones ranked by age
			const files: { path: any; time: any; size: any; deleted?: any }[] = []
			let totalSize = 0,
				deletedSize = 0,
				totalCount = 0,
				deletedCount = 0
			for (const filename of filenames) {
				if (fileExtensions?.size && fileExtensions.has(path.extname(filename))) continue
				totalCount++
				const fp = path.join(absPath, filename)
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
				`deleted ${deletedCount} of ${totalCount} ${subdir} cached files (${deletedSize} bytes deleted, ${totalSize} remaining)`
			)
		} catch (e) {
			// console.trace(e)
			console.error(`Error in mayDeleteCacheFiles() for ${subdir}: ${e}`)
		}
	}
}
