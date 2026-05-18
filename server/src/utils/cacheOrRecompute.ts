import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
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
	await fs.promises.writeFile(filePath, JSON.stringify(result))
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

	const work = (async (): Promise<CacheOrRecomputeResult<TResult>> => {
		const cached = await tryReadJson<TResult>(file)
		if (cached !== null) return { result: cached, cacheId, cacheFilePath: file }
		const fresh = await computeFresh({ cacheId })
		await writeJsonCache(file, fresh)
		return { result: fresh, cacheId, cacheFilePath: file }
	})()
	pending.set(dedupKey, work)
	return work.finally(() => pending.delete(dedupKey)) as Promise<CacheOrRecomputeResult<TResult>>
}

/** Returns null on ENOENT (cache miss) or JSON parse failure (corruption or
 * partial write). */
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
