import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { CacheOrRecomputeOpts, CacheOrRecomputeResult, CacheSubdir } from '#src/utils/types.ts'

/** Stable, structural JSON serialization. Sort keys so {a:1,b:2} and
 * {b:2,a:1} produce the same string — input objects from different code
 * paths must hash to the same id. Any drift between writers and readers
 * causes cache-miss storms. Keep it minimal and purely structural. */
export function stableStringify(v: any): string {
	if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null'
	if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
	const keys = Object.keys(v).sort()
	return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}'
}

/** Hash the given object to a 32-hex-char cacheId via
 * sha256(stableStringify(args)). Truncation at 32 chars is safe for
 * cache keys — collision probability is negligible at realistic cache
 * sizes. Callers shape `args` to include only the fields whose identity
 * should determine the cache key (e.g., DE/DM exclude dataset-pinned
 * fields like storage_type, GRIN2 excludes view params like width/height). */
export function generateHash(args: any): string {
	return crypto.createHash('sha256').update(stableStringify(args)).digest('hex').slice(0, 32)
}

const HASH_RE = /^[0-9a-f]{32}$/

/** Build the canonical cache file path. Validates the cacheId shape so a
 * corrupted hash cannot inject path separators. */
export function cacheFilePath(subdir: CacheSubdir, cacheId: string): string {
	if (!HASH_RE.test(cacheId)) throw new Error('invalid cacheId')
	return path.join(serverconfig.cachedir, subdir, `${cacheId}.json`)
}

/** Persist a result as JSON to the given path. Companion to the module's
 * built-in JSON read; use this from `computeFresh` callbacks. */
export async function writeJsonCache(filePath: string, result: unknown): Promise<void> {
	await fs.promises.writeFile(filePath, JSON.stringify(result))
}

/** In-flight work keyed by `${subdir}:${cacheId}`. Deduplicates
 * concurrent callers with identical inputs so only one read+parse (or one
 * compute) actually happens per unique key, even if N callers arrive
 * simultaneously. The synchronous get/set pair below relies on JS
 * single-threaded event-loop atomicity — two concurrent callers cannot both
 * miss the map and both start work. Critical for workshop / conference-room
 * scenarios where 100-200 users may hit the same demo at once.
 *
 * Subsequent attached callers resolve to the same result. Entry is cleared
 * once the promise settles so later, genuinely new requests start fresh. */
const pending = new Map<string, Promise<CacheOrRecomputeResult<any>>>()

/** Generic cache-or-recompute: hash the inputs, look for a JSON file under
 * the canonical path, return its parsed contents on hit, otherwise call
 * `computeFresh` and have it write the file. JSON-only by design. */
export async function cacheOrRecompute<TArgs, TResult>(
	opts: CacheOrRecomputeOpts<TArgs, TResult>
): Promise<CacheOrRecomputeResult<TResult>> {
	const { computeArgument, cacheSubdir, computeFresh } = opts
	const cacheId = generateHash(computeArgument)
	const file = cacheFilePath(cacheSubdir, cacheId)
	const dedupKey = `${cacheSubdir}:${cacheId}`

	const inFlight = pending.get(dedupKey)
	if (inFlight) return inFlight as Promise<CacheOrRecomputeResult<TResult>>

	const work = (async (): Promise<CacheOrRecomputeResult<TResult>> => {
		const cached = await tryReadJson<TResult>(file)
		if (cached !== null) return { result: cached, cacheId, cacheFilePath: file }
		const fresh = await computeFresh(computeArgument, cacheId, file)
		return { result: fresh, cacheId, cacheFilePath: file }
	})()
	pending.set(dedupKey, work)
	return work.finally(() => pending.delete(dedupKey)) as Promise<CacheOrRecomputeResult<TResult>>
}

/** Returns null on ENOENT (cache miss) or JSON parse failure (corruption /
 * partial write — auto-recovery beats failing every user's request until
 * someone hand-cleans the dir). Other I/O errors propagate. */
async function tryReadJson<T>(filePath: string): Promise<T | null> {
	let text: string
	try {
		text = await fs.promises.readFile(filePath, 'utf8')
	} catch (e: any) {
		if (e && e.code === 'ENOENT') return null
		throw e
	}
	try {
		return JSON.parse(text) as T
	} catch (e: any) {
		if (e instanceof SyntaxError) return null
		throw e
	}
}
