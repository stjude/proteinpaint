import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import { fileSize, formatElapsedTime } from '#shared'
import { CACHE_OR_RECOMPUTE_SUBDIRS } from '#src/utils/types.ts'
import type { CacheOrRecomputeOpts, CacheOrRecomputeResult, CacheSubdir } from '#src/utils/types.ts'

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
	const cap = CACHE_OR_RECOMPUTE_SUBDIRS[cacheSubdir].maxPending
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
