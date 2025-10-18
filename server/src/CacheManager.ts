import fs from 'fs'
import path from 'path'

// configuration for each cache subdir
type SubdirOpts = {
	maxAge: number
	maxSize: number
	/**
	 * number of milliseconds to skip checking files in the subdir after the initial check
	 * - if zero, run on every interval of the cache monitor
	 * - if >1, do not check files again in the subdir until the skipped time is reached/exceeded
	 */
	skipMs: number // how many milliseconds to skip after the last check
	fileExtensions?: Set<string | RegExp>
	absPath?: string // absolute path to cache dir
	moveTo?: string // move expired files to this abs path or cache subdir instead of deleting right away
}

// computed configuration for each cache subdir
type ComputedSubdirOpts = {
	absPath: string // joins absolute cachedir path with subdir name
	movePath?: string // joins absolute cachedir path with moveTo name
	skipUntil: number // unix time in milliseconds when cache check should resume, will skip check iterations before then
}

type FullSubdirOpts = SubdirOpts & ComputedSubdirOpts

// argument to CacheManager constructor
type CacheOpts = {
	cachedir?: string // equals defaultOpts.cachedir or serverconfig.cachedir or runtime overrides (such as in spec files)
	interval?: number // wait time between each interval loop to check cache files
	quiet?: boolean
	subdirs?: {
		[dirName: string]:
			| undefined
			| {
					maxAge?: number // file expiration in milliseconds
					maxSize?: number // total cache subdir size of all files, in bytes
					skipMs?: number // milliseconds to wait before rerunning cache subdir checks, cause some check iterations to be skipped
					moveTo?: string
					fileExtensions?: Set<string | RegExp>
			  }
	}
	callbacks: Callbacks
	mustExitPendingValidation?: boolean
}

// options to trigger a callback after
type Callbacks = {
	preStart?: (c: CacheManager) => void
	//preCheck?: (c: CacheManager) => void
	postCheck?: (c: { [subdir: string]: { deletedCount: number; totalCount: number } }) => void
	postStop?: (c: CacheManager) => void
}

const minute = 1000 * 60
const hour = minute * 60 // 1 hour in milliseconds
const halfDay = hour * 12 // 12 hours in milliseconds
const day = halfDay * 2 // 24 hours in milliseconds

// defaults
const subdirOptsDefaults: SubdirOpts = {
	maxAge: hour * 2, // 2 hours
	maxSize: 5e9, // 5 GB
	skipMs: 0 // run on every interval check
}

// these configurations can be overriden by the argument to CacheManager constructor(),
// which is primarily specified in serverconfig.features.cache
const defaultOpts = {
	cachedir: path.join(process.cwd(), '.cache'),
	interval: minute,
	subdirs: {
		gsea: {
			...subdirOptsDefaults,
			fileExtensions: new Set(['.pkl'])
		},
		massSession: {
			...subdirOptsDefaults,
			maxAge: day * 30, // total milliseconds in 30 days
			skipMs: halfDay // every 12 hours
		},
		massSessionTrash: {
			...subdirOptsDefaults,
			maxAge: day * 60, // total milliseconds in 60 days
			skipMs: halfDay // run every 12 hours
		},
		grin2: {
			...subdirOptsDefaults,
			maxAge: day * 30,
			skipMs: halfDay
		}
		// bam: {
		//  ...subdirOptsDefaults,
		// 	fileExtensions: new Set(['.bam', '.bai'])
		// },
	},
	callbacks: {}
} satisfies CacheOpts

/** This class creates the subdirectories under the cache
 * and manages the cache files in those directories.*/
export class CacheManager {
	// equals serverconfig.cachedir, unless overridden
	cachedir: string
	// the wait time before each iteration of checking the cache for expired files
	interval: number
	subdirs: Map<string, FullSubdirOpts>
	// the reference to setInterval
	intervalId!: any // Timeout
	callbacks: Callbacks
	hasActiveCheck = false
	quiet = false

	constructor(opts: CacheOpts = defaultOpts) {
		/* v8 ignore start */
		this.interval = opts.interval || defaultOpts.interval
		this.cachedir = opts.cachedir || defaultOpts.cachedir
		this.callbacks = opts.callbacks || defaultOpts.callbacks
		if (opts.quiet) this.quiet = opts.quiet
		/* v8 ignore stop */
		this.subdirs = new Map()
		this.init(opts) // do not await, since contructor() can only return an object instance and not a Promise
	}

	async init(opts) {
		if (!fs.existsSync(this.cachedir)) fs.mkdirSync(this.cachedir, { recursive: true })

		const subdirs = Object.assign({}, defaultOpts.subdirs, opts.subdirs || {})
		for (const [dirName, dirOpts] of Object.entries(subdirs)) {
			if (dirOpts === undefined) delete subdirs[dirName]
			else {
				const subdirOpts = Object.assign({}, subdirOptsDefaults, dirOpts)
				this.setComputedOpts(dirName, subdirOpts)
			}
		}
		if (this.callbacks.preStart) await this.callbacks.preStart(this)
		if (!opts.mustExitPendingValidation) await this.start()
	}

	/** Check if the subdir exists. If not create. */
	setComputedOpts(subdir: string, subdirOpts: SubdirOpts) {
		const dir = path.join(this.cachedir, subdir)
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
		const fullOpts: FullSubdirOpts = { ...subdirOpts, absPath: dir, skipUntil: 0 }
		if (subdirOpts.moveTo)
			fullOpts.movePath = subdirOpts.moveTo.startsWith('/')
				? subdirOpts.moveTo
				: path.join(this.cachedir, subdirOpts.moveTo)
		this.subdirs.set(subdir, fullOpts)
	}

	async start() {
		console.log('starting cache monitor ...')

		const checkCacheFiles = async () => {
			if (this.hasActiveCheck) return // prevent two active checks from running at the same time
			this.hasActiveCheck = true
			const now = Date.now()
			const results = {}
			for (const [subdir, dirOpts] of this.subdirs.entries()) {
				if (now > dirOpts.skipUntil) {
					results[subdir] = await this.mayDeleteCacheFiles(subdir, dirOpts, this.interval)
					dirOpts.skipUntil = now + dirOpts.skipMs
				}
			}
			if (this.callbacks.postCheck) this.callbacks.postCheck(results)
			this.hasActiveCheck = false
		}

		// clear expired cache files initially when this instance is constructed,
		// before the periodic check runs
		await checkCacheFiles()

		// Clear the subdirectories periodically, defined by the interval
		// and optional SubdirOpts settings in serverconfig
		this.intervalId = setInterval(checkCacheFiles, this.interval)
	}

	// can call this in spec file after running tests
	stop() {
		if (!this.intervalId) return
		console.log('--- stopping cache monitor ---')
		clearInterval(this.intervalId)
		delete this.intervalId
		if (this.callbacks.postStop) this.callbacks.postStop(this)
	}

	async mayDeleteCacheFiles(subdir, dirOpts, interval: number) {
		const { maxSize, maxAge, absPath, fileExtensions, movePath } = dirOpts
		//if (!this.quiet) console.log(`checking for cached ${subdir} files to delete ...`)
		try {
			const minTime = Date.now() - maxAge
			const filenames = await fs.promises.readdir(absPath)
			if (filenames.length == 0) {
				//if (!this.quiet) console.log(`No ${subdir} cached files to delete`)
				return { deletedCount: 0, totalCount: 0 }
			}
			// keep list of undeleted files. may need to rank them and delete old ones ranked by age
			const files: { path: any; time: any; size: any; deleted?: any }[] = []
			let totalSize = 0,
				deletedSize = 0,
				totalCount = 0,
				deletedCount = 0
			for (const filename of filenames) {
				if (fileExtensions?.size && !fileExtensions.has(path.extname(filename))) continue
				totalCount++
				const fp = path.join(absPath, filename)
				const s = await fs.promises.stat(fp)
				if (!s.isFile()) continue
				const time = s.mtimeMs
				// console.log(188, filename, time < minTime, time, minTime)
				if (time < minTime) {
					if (movePath) await fs.promises.rename(fp, path.join(movePath, filename))
					else await fs.promises.unlink(fp)
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
			if (!this.quiet)
				console.log(
					`deleted ${deletedCount} of ${totalCount} ${subdir} cached files (${deletedSize} bytes deleted, ${totalSize} remaining)`
				)
			return { deletedCount, totalCount }
		} catch (e) {
			// console.trace(e)
			console.error(`Error in mayDeleteCacheFiles() for ${subdir}: ${e}`)
		}
	}
}
