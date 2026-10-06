import fs from 'fs'
import path from 'path'

const minute = 1000 * 60
const hour = minute * 60 // 1 hour in milliseconds
const halfDay = hour * 12 // 12 hours in milliseconds
const day = halfDay * 2 // 24 hours in milliseconds

// eviction options of a cache subdir, which a deployer may override with serverconfig.features.cacheMonitor.subdirs[name]
type EvictionOpts = {
	maxAge?: number // file expiration in milliseconds
	maxSize?: number // total cache subdir size of all files, in bytes
	skipMs?: number // milliseconds to wait before rerunning cache subdir checks, cause some check iterations to be skipped
	moveTo?: string // move expired files to this abs path or cache subdir instead of deleting right away
	fileExtensions?: Set<string | RegExp> // only check files with these extensions
}
const evictionKeys = ['maxAge', 'maxSize', 'skipMs', 'moveTo', 'fileExtensions'] as const

/* .type of a cacheRegistry entry
- compute: JSON results written by utils/cacheOrRecompute.ts; must have maxPending, the cap on concurrent
  computes of distinct cacheIds, which is the only field cacheOrRecompute reads
- file: files written by their own route; must have fileExtensions, so that only the cached files are evicted
- session: saved user data written by the massSession route
*/
type CacheRegistryItem =
	| ({ type: 'compute'; maxPending: number } & EvictionOpts)
	| ({ type: 'file'; fileExtensions: Set<string | RegExp> } & EvictionOpts)
	| ({ type: 'session' } & EvictionOpts)

// eviction defaults of each type, used for the options that a registry entry does not set
const typeDefaults: { [T in CacheRegistryItem['type']]: EvictionOpts } = {
	compute: { maxAge: day * 60, skipMs: halfDay },
	file: {},
	session: { maxAge: day * 30, skipMs: halfDay }
}

/** All subdirs of serverconfig.cachedir. This is the only place to declare a cache subdir: CacheManager
 * creates every entry at server launch, even when the feature that uses it is disabled, and evicts its files.
 * To add a new cacheOrRecompute analysis, append an entry with type 'compute'; no other file needs to be edited. */
export const cacheRegistry = {
	de: { type: 'compute', maxPending: 5 },
	dm: { type: 'compute', maxPending: 5 },
	/* DMR scans. Lower than the analyses above because each pending job is not one process: it
	fans out to `serverconfig.dmrBatchConcurrency` rust invocations (default 2), each holding one
	chromosome's matrix at ~0.5GB and saturating a core. Total concurrent rust processes is
	maxPending x dmrBatchConcurrency, so a deployer raising either must consider the other -- at 2
	and 2 that is 4 processes and ~2GB, which is the ceiling a 4-core deployment can absorb.
	Identical requests still share one compute through the in-flight dedup in cacheOrRecompute, so
	several users running the SAME scan cost one. */
	dmr: { type: 'compute', maxPending: 2 },
	// per-gene gene-body methylation deltas for a contrast; same fan-out as a scan, same ceiling
	geneBodyMeth: { type: 'compute', maxPending: 2 },
	gsea: { type: 'compute', maxPending: 5 },
	grin2: { type: 'compute', maxPending: 5 },
	topve: { type: 'compute', maxPending: 5 },
	/* per-case gene counts downloaded from GDC. unlike the analysis subdirs above, these are many
	small fetches rather than a few heavy computes: one entry per STAR-Counts file, written from
	inside a mapConcurrent fan-out. the real throttle is mapConcurrent, not this pool, so size this
	above the download concurrency (gdcDEconcurrency, default 60) times the simultaneous DE runs to
	tolerate: one run holds up to `concurrency` distinct cacheIds at once, so at 200 the third
	overlapping run is the first that can hit the cap. exceeding it throws 429, which the caller
	surfaces rather than treating as a failed download -- and buildGdcCountsFile fails the whole run
	on it, so a cap set below real concurrency would kill a legitimate second user's analysis rather
	than queue it. raise this in step with gdcDEconcurrency. */
	gdcCounts: { type: 'compute', maxPending: 200 },
	// saved sessions; a deployer may set maxAge: 0 to disable the /massSession and /sessionIds routes
	massSession: { type: 'session' },
	massSessionTrash: { type: 'session', maxAge: day * 60 },
	// WSI tiles rendered on demand from .svs by wsitiles route. Flat .jpg
	// files (the sweep is non-recursive), evicted by mtime like any other subdir.
	wsitiles: { type: 'file', fileExtensions: new Set(['.jpg']), maxAge: day * 30, skipMs: halfDay },
	// Cached bedj track files served by tkbedj when req.query.isCache=true (see bedj.js).
	// Flat tabix/bigbed files plus index, evicted by mtime like any other subdir.
	bedj: { type: 'file', fileExtensions: new Set(['.gz', '.tbi', '.csi', '.bb']), maxAge: day * 30, skipMs: halfDay },
	// GDC bam slices and their index files, written by get_gdc_bam() in bam.js
	bam: { type: 'file', fileExtensions: new Set(['.bam', '.bai']) }
} as const satisfies Record<string, CacheRegistryItem>

type CacheRegistry = typeof cacheRegistry

/** the subdirs that cacheOrRecompute may write to */
export type CacheSubdir = {
	[K in keyof CacheRegistry]: CacheRegistry[K]['type'] extends 'compute' ? K : never
}[keyof CacheRegistry]

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
	// overrides of the registry entries; a subdir cannot be disabled, and must be declared in the registry
	subdirs?: { [dirName: string]: EvictionOpts }
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

// defaults
const subdirOptsDefaults: SubdirOpts = {
	maxAge: hour * 2, // 2 hours
	maxSize: 5e9, // 5 GB
	skipMs: 0 // run on every interval check
}

// these configurations can be overriden by the argument to CacheManager constructor(),
// which is primarily specified in serverconfig.features.cacheMonitor
const defaultOpts = {
	cachedir: path.join(process.cwd(), '.cache'),
	interval: minute,
	callbacks: {}
} satisfies CacheOpts

function pickEvictionOpts(o: object): EvictionOpts {
	return Object.fromEntries(evictionKeys.filter(k => k in o).map(k => [k, o[k]]))
}

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

	/** registry is only an argument for spec files, a deployer can only override the entries with opts.subdirs */
	constructor(opts: CacheOpts = defaultOpts, registry: Record<string, CacheRegistryItem> = cacheRegistry) {
		/* v8 ignore start */
		this.interval = opts.interval || defaultOpts.interval
		this.cachedir = opts.cachedir || defaultOpts.cachedir
		this.callbacks = opts.callbacks || defaultOpts.callbacks
		if (opts.quiet) this.quiet = opts.quiet
		/* v8 ignore stop */
		this.subdirs = new Map()

		// Synchronous setup: cachedir, override validation, and subdir creation.
		// Kept out of init() so a validation throw surfaces as a real constructor
		// error instead of an unhandled promise rejection.
		const overrides = opts.subdirs || {}
		for (const [dirName, override] of Object.entries(overrides)) {
			if (!Object.hasOwn(registry, dirName)) {
				throw new Error(
					`Unknown cache subdir '${dirName}' in cacheMonitor.subdirs. Declare it in cacheRegistry in CacheManager.ts.`
				)
			}
			if (!override || typeof override != 'object') {
				throw new Error(
					`cacheMonitor.subdirs.${dirName} must be an object of overrides, a cache subdir cannot be disabled.`
				)
			}
			for (const key of Object.keys(override)) {
				if (!(evictionKeys as readonly string[]).includes(key)) {
					throw new Error(
						`cacheMonitor.subdirs.${dirName}.${key} cannot be overridden, only ${evictionKeys.join(', ')} can be.`
					)
				}
			}
		}

		if (!fs.existsSync(this.cachedir)) fs.mkdirSync(this.cachedir, { recursive: true })
		for (const [dirName, item] of Object.entries(registry)) {
			// an override only replaces the given properties, the rest fall back to this entry and then to its type's defaults
			const subdirOpts = Object.assign(
				{},
				subdirOptsDefaults,
				typeDefaults[item.type],
				pickEvictionOpts(item),
				overrides[dirName]
			)
			this.setComputedOpts(dirName, subdirOpts)
		}

		this.init(opts) // do not await, since contructor() can only return an object instance and not a Promise
	}

	async init(opts) {
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
			files.sort((i, j) => i.time - j.time) // ascending, so that the oldest files are deleted first
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
