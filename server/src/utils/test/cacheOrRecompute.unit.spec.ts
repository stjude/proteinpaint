import tape from 'tape'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import serverconfig from '#src/serverconfig.js'
import {
	cacheFilePath,
	cacheOrRecompute,
	generateHash,
	stableStringify,
	writeJsonCache
} from '#src/utils/cacheOrRecompute.ts'
import { canonicalizeSamplelst } from '#src/utils/sampleGroups.ts'

/** Tests for the generic cache-or-recompute module. We use the existing
 * `de` subdir under serverconfig.cachedir (the test harness points
 * cachedir at test/cache/) and namespace each test's payload with random
 * tokens so files don't collide across runs. */

const SUBDIR_ABS = path.join(serverconfig.cachedir, 'de')
const writtenFiles: string[] = []

function ensureSubdir() {
	fs.mkdirSync(SUBDIR_ABS, { recursive: true })
}

function trackCachePath(cacheId: string) {
	writtenFiles.push(path.join(SUBDIR_ABS, `${cacheId}.json`))
}

function cleanup() {
	// rmSync with force:true is a silent no-op if the file is already gone
	// (e.g., a sibling test cleaned it up, or a test bailed before write).
	for (const f of writtenFiles.splice(0)) fs.rmSync(f, { force: true })
}

tape('\n', t => {
	t.comment('-***- src/utils/cacheOrRecompute -***-')
	t.end()
})

tape('stableStringify is key-order independent', t => {
	t.equal(stableStringify({ a: 1, b: 2 }), stableStringify({ b: 2, a: 1 }), 'top-level key order')
	t.equal(stableStringify({ outer: { a: 1, b: 2 } }), stableStringify({ outer: { b: 2, a: 1 } }), 'nested key order')
	t.equal(stableStringify(null), 'null', 'null serializes as "null"')
	t.equal(stableStringify(undefined), 'null', 'undefined falls back to "null"')
	t.equal(stableStringify([1, 2, 3]), '[1,2,3]', 'arrays preserve order')
	t.end()
})

tape('generateHash is deterministic, key-order independent, 32 hex chars', t => {
	const h1 = generateHash({ a: 1, b: 'x' })
	const h2 = generateHash({ b: 'x', a: 1 })
	t.equal(h1, h2, 'same hash regardless of input key order')
	t.match(h1, /^[0-9a-f]{32}$/, 'hash matches the validator regex used by cacheFilePath')
	t.notEqual(h1, generateHash({ a: 1, b: 'y' }), 'different inputs produce different hashes')
	t.end()
})

tape('canonicalizeSamplelst sorts values by sampleId', t => {
	const a = canonicalizeSamplelst({
		groups: [{ name: 'g', in: true, values: [{ sampleId: 3 }, { sampleId: 1 }, { sampleId: 2 }] }]
	})
	const b = canonicalizeSamplelst({
		groups: [{ name: 'g', in: true, values: [{ sampleId: 1 }, { sampleId: 2 }, { sampleId: 3 }] }]
	})
	t.deepEqual(a, b, 'two orderings of the same samples canonicalize identically')
	t.end()
})

tape('first call: miss → computeFresh runs; second call: hit, no recompute', async t => {
	ensureSubdir()
	const tag = crypto.randomBytes(8).toString('hex')
	const args = { tag, kind: 'miss-then-hit' }
	let computeCount = 0

	const opts = {
		computeArgument: args,
		cacheSubdir: 'de' as const,
		computeFresh: async ({ cacheId, cacheFilePath }: { cacheId: string; cacheFilePath: string }) => {
			computeCount++
			const env = { kind: 'TEST', payload: 'fresh-result', tag }
			await writeJsonCache(cacheFilePath, env)
			trackCachePath(cacheId)
			return env
		}
	}

	const r1 = await cacheOrRecompute(opts)
	t.equal(computeCount, 1, 'computeFresh ran exactly once on first call')
	t.equal(r1.result.payload, 'fresh-result', 'returned payload from computeFresh')

	const r2 = await cacheOrRecompute(opts)
	t.equal(computeCount, 1, 'computeFresh did not run on second call (hit)')
	t.equal(r2.cacheId, r1.cacheId, 'same cacheId across calls with same args')

	cleanup()
	t.end()
})

tape('100 concurrent same-input calls dedup to one computeFresh (conference-room property)', async t => {
	ensureSubdir()
	const tag = crypto.randomBytes(8).toString('hex')
	const args = { tag, kind: 'concurrent-dedup' }
	let computeCount = 0
	let computeStartCount = 0

	const opts = {
		computeArgument: args,
		cacheSubdir: 'de' as const,
		computeFresh: async ({ cacheId, cacheFilePath }: { cacheId: string; cacheFilePath: string }) => {
			computeStartCount++
			// Simulated work — long enough to ensure all 100 callers attach
			// to the same in-flight promise before it resolves.
			await new Promise(r => setTimeout(r, 50))
			computeCount++
			const env = { kind: 'TEST', payload: 'fresh', tag }
			await writeJsonCache(cacheFilePath, env)
			trackCachePath(cacheId)
			return env
		}
	}

	const promises = Array.from({ length: 100 }, () => cacheOrRecompute(opts))
	const results = await Promise.all(promises)

	t.equal(computeStartCount, 1, 'computeFresh entered exactly once across 100 concurrent callers')
	t.equal(computeCount, 1, 'computeFresh completed exactly once')
	t.equal(results.length, 100, 'all 100 callers received a result')
	t.ok(
		results.every(r => r.cacheId === results[0].cacheId),
		'all callers share the same cacheId'
	)

	cleanup()
	t.end()
})

tape('corrupted JSON file is treated as a miss and recomputed', async t => {
	ensureSubdir()
	const tag = crypto.randomBytes(8).toString('hex')
	const args = { tag, kind: 'corruption' }
	const cacheId = generateHash(args)
	const file = path.join(SUBDIR_ABS, `${cacheId}.json`)
	writtenFiles.push(file)

	// Plant a corrupted file at the deterministic path.
	fs.writeFileSync(file, '{not valid json')

	let computeCount = 0
	const result = await cacheOrRecompute({
		computeArgument: args,
		cacheSubdir: 'de',
		computeFresh: async ({ cacheFilePath }) => {
			computeCount++
			const env = { kind: 'TEST', payload: 'recovered', tag }
			await writeJsonCache(cacheFilePath, env)
			return env
		}
	})

	t.equal(computeCount, 1, 'computeFresh ran because JSON.parse failed on the corrupt file')
	t.equal((result.result as any).payload, 'recovered', 'fresh result is returned')

	// Confirm the corrupt file was overwritten with valid JSON.
	const overwritten = JSON.parse(fs.readFileSync(file, 'utf8'))
	t.equal(overwritten.payload, 'recovered', 'corrupt file was replaced by computeFresh write')

	cleanup()
	t.end()
})

tape('caller can evict a stale cache file by unlinking before recompute', async t => {
	// Generic eviction-by-unlink capability: a caller can delete the
	// cache JSON and have the next cacheOrRecompute call miss cleanly
	// and run computeFresh, without needing the module's cooperation.
	ensureSubdir()
	const tag = crypto.randomBytes(8).toString('hex')
	const args = { tag, kind: 'caller-evict' }
	let computeCount = 0

	const opts = {
		computeArgument: args,
		cacheSubdir: 'de' as const,
		computeFresh: async ({ cacheId, cacheFilePath }: { cacheId: string; cacheFilePath: string }) => {
			computeCount++
			const env = { kind: 'TEST', payload: `v${computeCount}`, tag }
			await writeJsonCache(cacheFilePath, env)
			trackCachePath(cacheId)
			return env
		}
	}

	const r1 = await cacheOrRecompute(opts)
	t.equal(computeCount, 1, 'computeFresh ran on first call')

	// Caller-side eviction: unlink the cache file.
	await fs.promises.unlink(r1.cacheFilePath)

	const r2 = await cacheOrRecompute(opts)
	t.equal(computeCount, 2, 'after caller unlinks, computeFresh ran a second time')
	t.equal((r2.result as any).payload, 'v2', 'fresh payload from the second compute')

	cleanup()
	t.end()
})

tape('cacheFilePath rejects ids that don’t match the 32-hex shape', t => {
	t.throws(
		() => cacheFilePath('de', '../traversal-attempt-not-32-hex'),
		/invalid cacheId/,
		'rejects path-traversal-shaped ids'
	)
	t.throws(() => cacheFilePath('de', 'TOO-SHORT'), /invalid cacheId/, 'rejects short ids')
	t.throws(() => cacheFilePath('de', 'g'.repeat(32)), /invalid cacheId/, 'rejects non-hex characters')
	t.end()
})
