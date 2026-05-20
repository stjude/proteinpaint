import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import { fileSize, formatElapsedTime } from '#shared'
import type { CacheOrRecomputeOpts, CacheOrRecomputeResult } from '#src/utils/types.ts'

/** Subdirs of serverconfig.cachedir that the cacheOrRecompute module
 * writes JSON cache files to. `maxPending` caps the concurrent compute
 * jobs per subdir and is the only field cacheOrRecompute itself reads.
 * CacheManager registers every entry automatically and supplies the
 * eviction policy (maxAge/skipMs/maxSize) from its own defaults. To add
 * a new analysis type, append a new entry here — no other file needs
 * to be edited. */
export const cacheJobPolicies = {
	de: { maxPending: 5 },
	dm: { maxPending: 5 },
	gsea: { maxPending: 5 },
	grin2: { maxPending: 5 },
	topve: { maxPending: 5 }
} as const satisfies Record<string, { maxPending: number }>

export type CacheSubdir = keyof typeof cacheJobPolicies

/** Hash the given object to a 32-hex-char cacheId via
 * sha256(JSON.stringify(args)). Truncation at 32 chars is safe for cache
 * keys — collision probability is negligible at realistic cache sizes.
 * Callers shape `args` to include only the fields whose identity
 * determines the cache key, and must construct it with a stable key order
 * (object literals do this naturally). */
export function generateHash(args: any): string {
	return crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex').slice(0, 32)
}

const HASH_RE = /^[0-9a-f]{32}$/

/** Build the canonical cache file path. Validates the cacheId shape so a
 * corrupted hash cannot inject path separators. */
export function cacheFilePath(subdir: CacheSubdir, cacheId: string): string {
	if (!HASH_RE.test(cacheId)) throw new Error('invalid cacheId')
	return path.join(serverconfig.cachedir, subdir, `${cacheId}.json`)
}

/** Write a result JSON to the given path. Internal — callers never invoke
 * this directly; `cacheOrRecompute` persists the value returned by
 * `computeFresh` automatically. */
async function writeJsonCache(filePath: string, result: unknown): Promise<void> {
	const t0 = Date.now()
	const body = JSON.stringify(result)
	await fs.promises.writeFile(filePath, body)
	// Buffer.byteLength gives the actual UTF-8 byte count that hits disk;
	// `body.length` would report UTF-16 code units, which under-counts
	// any multi-byte character.
	mayLog(
		`cacheOrRecompute write ${shortLabel(filePath)} (${fileSize(
			Buffer.byteLength(body, 'utf8')
		)}) in ${formatElapsedTime(Date.now() - t0)}`
	)
}

/** Last two path segments, e.g. "de/abc123…json". Keeps timing log lines
 * readable without leaking the full absolute cachedir path. */
function shortLabel(filePath: string): string {
	return filePath.split(path.sep).slice(-2).join('/')
}

/** In-flight work keyed by `${subdir}:${cacheId}`. Deduplicates
 * concurrent callers with identical inputs so only one read+parse (or one
 * compute) actually happens per unique key, even if N callers arrive
 * simultaneously. The synchronous get/set pair below relies on JS
 * single-threaded event-loop atomicity — two concurrent callers cannot both
 * miss the map and both start work.
 *
 * Subsequent attached callers resolve to the same result. Entry is cleared
 * once the promise settles so later, genuinely new requests start fresh. */
const pending = new Map<string, Promise<CacheOrRecomputeResult<any>>>()

/** Count of in-flight DISTINCT cacheIds per subdir. A X1st same-key
 * caller attaches to the existing `pending` entry and does NOT increment
 * this count, so the cap protects against thundering herds of distinct
 * computes without penalizing innocent dedup. */
const pendingCount = new Map<CacheSubdir, number>()

function makeBusyError(): Error {
	const err: any = new Error('Cache compute pool is full. Please try again shortly.')
	err.status = 429
	err.statusCode = 429
	err.code = 'CACHE_BUSY'
	return err
}

/** Generic cache-or-recompute: hash the inputs, look for a JSON file under
 * the canonical path, return its parsed contents on hit, otherwise call
 * `computeFresh` to produce the value and persist it to disk transparently
 * before returning. Callers only need to return the result. */
export async function cacheOrRecompute<TArgs, TResult>(
	opts: CacheOrRecomputeOpts<TArgs, TResult>
): Promise<CacheOrRecomputeResult<TResult>> {
	const { computeArgument, cacheSubdir, computeFresh } = opts
	const cacheId = generateHash(computeArgument)
	const file = cacheFilePath(cacheSubdir, cacheId)
	const dedupKey = `${cacheSubdir}:${cacheId}`

	const inFlight = pending.get(dedupKey)
	if (inFlight) return inFlight as Promise<CacheOrRecomputeResult<TResult>>

	/** `maxAge`, `skipMs`, `maxSize` for each subdir are already
	 deployer-overrideable via `serverconfig.features.cacheMonitor.subdirs`
	 — that override flows through CacheManager's constructor merge. But
	 `maxPending` is read straight from the static import below, so the
	 same override path does NOT reach it. Close this gap when a workload
	 with a different concurrency profile (e.g. GDC BAM slice or MAF) is
	 routed through cacheOrRecompute: at boot, merge
	 `serverconfig.features?.cacheMonitor?.subdirs?.[subdir]?.maxPending`
	 into a module-local map and read from that here instead. */
	if (!cacheJobPolicies[cacheSubdir]) {
		throw new Error(`Unknown cacheSubdir '${cacheSubdir}'. Add it to cacheJobPolicies in utils/cacheOrRecompute.ts.`)
	}
	const cap = cacheJobPolicies[cacheSubdir].maxPending
	const inUse = pendingCount.get(cacheSubdir) ?? 0
	if (inUse >= cap) throw makeBusyError()

	const work = (async (): Promise<CacheOrRecomputeResult<TResult>> => {
		const cached = await tryReadJson<TResult>(file)
		if (cached !== null) return { result: cached, cacheId, cacheFilePath: file }
		const fresh = await computeFresh({ cacheId })
		await writeJsonCache(file, fresh)
		return { result: fresh, cacheId, cacheFilePath: file }
	})()
	pending.set(dedupKey, work)
	pendingCount.set(cacheSubdir, inUse + 1)
	return work.finally(() => {
		pending.delete(dedupKey)
		pendingCount.set(cacheSubdir, (pendingCount.get(cacheSubdir) ?? 1) - 1)
	}) as Promise<CacheOrRecomputeResult<TResult>>
}

/** Returns null on ENOENT (cache miss) or JSON parse failure (corruption or
 * partial write). */
async function tryReadJson<T>(filePath: string): Promise<T | null> {
	const t0 = Date.now()
	let text: string
	try {
		text = await fs.promises.readFile(filePath, 'utf8')
	} catch (e: any) {
		if (e && e.code === 'ENOENT') return null
		throw e
	}
	try {
		const parsed = JSON.parse(text) as T
		// Buffer.byteLength gives the actual UTF-8 byte count read from
		// disk; `text.length` would report UTF-16 code units, which
		// under-counts any multi-byte character.
		mayLog(
			`cacheOrRecompute read ${shortLabel(filePath)} (${fileSize(
				Buffer.byteLength(text, 'utf8')
			)}) in ${formatElapsedTime(Date.now() - t0)}`
		)
		return parsed
	} catch (e: any) {
		if (e instanceof SyntaxError) return null
		throw e
	}
}
