import tape from 'tape'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import serverconfig from '#src/serverconfig.js'
import { cacheFilePath, cacheOrRecompute, generateHash } from '#src/utils/cacheOrRecompute.ts'
import { cacheJobPolicies } from '#src/utils/cacheOrRecompute.ts'
import { canonicalizeSamplelst } from '#src/utils/sampleGroups.ts'

/*
test sections:

generateHash is deterministic and 32 hex chars
canonicalizeSamplelst sorts values by sampleId
first call: miss → computeFresh runs; second call: hit, no recompute
100 concurrent same-input calls dedup to one computeFresh (conference-room property)
corrupted JSON file is treated as a miss and recomputed
caller can evict a stale cache file by unlinking before recompute
debugmode emits one write log and one read log per cache cycle
timing logs are silent when debugmode is off
pool gates DISTINCT keys, not same-key attachers
distinct key beyond the cap rejects with CACHE_BUSY and status 429
client retry works once a slot frees (no negative caching of busy state)
cacheFilePath rejects ids that don't match the 32-hex shape
cacheOrRecompute rejects an unknown cacheSubdir with a helpful error
non-ENOENT read errors propagate (e.g. a directory at the cache path triggers EISDIR)
*/

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

tape('generateHash is deterministic and 32 hex chars', t => {
	const args = { a: 1, b: 'x' }
	const h1 = generateHash(args)
	t.equal(h1, generateHash(args), 'same input produces the same hash')
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
		computeFresh: async ({ cacheId }: { cacheId: string }) => {
			computeCount++
			const env = { kind: 'TEST', payload: 'fresh-result', tag }
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
		computeFresh: async ({ cacheId }: { cacheId: string }) => {
			computeStartCount++
			// Simulated work — long enough to ensure all 100 callers attach
			// to the same in-flight promise before it resolves.
			await new Promise(r => setTimeout(r, 50))
			computeCount++
			const env = { kind: 'TEST', payload: 'fresh', tag }
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
		computeFresh: async () => {
			computeCount++
			const env = { kind: 'TEST', payload: 'recovered', tag }
			return env
		}
	})

	t.equal(computeCount, 1, 'computeFresh ran because JSON.parse failed on the corrupt file')
	t.equal((result.result as any).payload, 'recovered', 'fresh result is returned')

	// Confirm the corrupt file was overwritten with valid JSON.
	const overwritten = JSON.parse(fs.readFileSync(file, 'utf8'))
	t.equal(overwritten.payload, 'recovered', 'corrupt file was replaced by cacheOrRecompute write')

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
		computeFresh: async ({ cacheId }: { cacheId: string }) => {
			computeCount++
			const env = { kind: 'TEST', payload: `v${computeCount}`, tag }
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

tape('debugmode emits one write log and one read log per cache cycle', async t => {
	ensureSubdir()
	const tag = crypto.randomBytes(8).toString('hex')
	const args = { tag, kind: 'timing-log' }

	const originalDebugmode = serverconfig.debugmode
	const originalLog = console.log
	const captured: string[] = []
	serverconfig.debugmode = true
	console.log = (...parts: any[]) => captured.push(parts.join(' '))

	try {
		const opts = {
			computeArgument: args,
			cacheSubdir: 'de' as const,
			computeFresh: async ({ cacheId }: { cacheId: string }) => {
				trackCachePath(cacheId)
				return { kind: 'TEST', payload: 'timing', tag }
			}
		}
		await cacheOrRecompute(opts) // write (cold miss)
		await cacheOrRecompute(opts) // read (warm hit)
	} finally {
		console.log = originalLog
		serverconfig.debugmode = originalDebugmode
	}

	const writeLines = captured.filter(l => l.startsWith('cacheOrRecompute write '))
	const readLines = captured.filter(l => l.startsWith('cacheOrRecompute read '))
	t.equal(writeLines.length, 1, 'one write log line emitted')
	t.equal(readLines.length, 1, 'one read log line emitted')
	const lineShape =
		/^cacheOrRecompute (write|read) de\/[0-9a-f]{32}\.json \([\d.]+ (Bytes|KB|MB|GB)\) in [\d.]+(ms|s|m \d)/
	t.match(writeLines[0], lineShape, 'write log line has the expected shape (subdir/cacheId.json, bytes, elapsed)')
	t.match(readLines[0], lineShape, 'read log line has the expected shape')

	cleanup()
	t.end()
})

tape('timing logs are silent when debugmode is off', async t => {
	ensureSubdir()
	const tag = crypto.randomBytes(8).toString('hex')
	const args = { tag, kind: 'timing-silent' }

	const originalDebugmode = serverconfig.debugmode
	const originalLog = console.log
	const captured: string[] = []
	serverconfig.debugmode = false
	console.log = (...parts: any[]) => captured.push(parts.join(' '))

	try {
		const opts = {
			computeArgument: args,
			cacheSubdir: 'de' as const,
			computeFresh: async ({ cacheId }: { cacheId: string }) => {
				trackCachePath(cacheId)
				return { kind: 'TEST', payload: 'silent', tag }
			}
		}
		await cacheOrRecompute(opts)
		await cacheOrRecompute(opts)
	} finally {
		console.log = originalLog
		serverconfig.debugmode = originalDebugmode
	}

	const timingLines = captured.filter(l => l.startsWith('cacheOrRecompute '))
	t.equal(timingLines.length, 0, 'no cacheOrRecompute timing log lines when debugmode is off')

	cleanup()
	t.end()
})

tape('pool gates DISTINCT keys, not same-key attachers', async t => {
	ensureSubdir()
	const tag = crypto.randomBytes(8).toString('hex')
	const cap = cacheJobPolicies.de.maxPending

	const slowOpts = (n: number) => ({
		computeArgument: { tag, n, kind: 'pool-dedup' },
		cacheSubdir: 'de' as const,
		computeFresh: async ({ cacheId }: { cacheId: string }) => {
			trackCachePath(cacheId)
			await new Promise(r => setTimeout(r, 80))
			return { kind: 'TEST', tag, n }
		}
	})

	// Fill the pool with `cap` distinct in-flight computes.
	const inflight = Array.from({ length: cap }, (_, i) => cacheOrRecompute(slowOpts(i)))

	// Fire 100 same-input callers for slot 0. They should all dedup onto
	// the in-flight promise for slot 0 — none should trip the busy gate.
	const sameKeyCallers = Array.from({ length: 100 }, () => cacheOrRecompute(slowOpts(0)))
	const sameKeyResults = await Promise.all(sameKeyCallers)
	t.equal(sameKeyResults.length, 100, 'all 100 same-key callers resolved')
	t.ok(
		sameKeyResults.every(r => r.cacheId === sameKeyResults[0].cacheId),
		'all 100 share the same cacheId (deduped onto one promise)'
	)

	await Promise.all(inflight)
	cleanup()
	t.end()
})

tape('distinct key beyond the cap rejects with CACHE_BUSY and status 429', async t => {
	ensureSubdir()
	const tag = crypto.randomBytes(8).toString('hex')
	const cap = cacheJobPolicies.de.maxPending

	const slowOpts = (n: number) => ({
		computeArgument: { tag, n, kind: 'pool-busy' },
		cacheSubdir: 'de' as const,
		computeFresh: async ({ cacheId }: { cacheId: string }) => {
			trackCachePath(cacheId)
			await new Promise(r => setTimeout(r, 80))
			return { kind: 'TEST', tag, n }
		}
	})

	const inflight = Array.from({ length: cap }, (_, i) => cacheOrRecompute(slowOpts(i)))

	let busyErr: any
	try {
		await cacheOrRecompute(slowOpts(cap + 1))
		t.fail('expected (cap+1)th distinct request to reject with CACHE_BUSY')
	} catch (e: any) {
		busyErr = e
	}
	t.equal(busyErr.status, 429, 'busy error carries status 429')
	t.equal(busyErr.statusCode, 429, 'busy error carries statusCode 429')
	t.equal(busyErr.code, 'CACHE_BUSY', 'busy error carries code CACHE_BUSY')
	t.match(busyErr.message, /Cache compute pool is full/, 'busy message identifies a busy cache pool')
	t.match(busyErr.message, /try again shortly/i, 'busy message tells the client to retry')

	await Promise.all(inflight)
	cleanup()
	t.end()
})

tape('client retry works once a slot frees (no negative caching of busy state)', async t => {
	ensureSubdir()
	const tag = crypto.randomBytes(8).toString('hex')
	const cap = cacheJobPolicies.de.maxPending

	const slowOpts = (n: number) => ({
		computeArgument: { tag, n, kind: 'pool-retry' },
		cacheSubdir: 'de' as const,
		computeFresh: async ({ cacheId }: { cacheId: string }) => {
			trackCachePath(cacheId)
			await new Promise(r => setTimeout(r, 80))
			return { kind: 'TEST', tag, n }
		}
	})

	const inflight = Array.from({ length: cap }, (_, i) => cacheOrRecompute(slowOpts(i)))

	// First attempt of the (cap+1)th distinct request — should reject.
	let firstAttemptErr: any
	try {
		await cacheOrRecompute(slowOpts(cap + 1))
	} catch (e) {
		firstAttemptErr = e
	}
	t.ok(firstAttemptErr, 'first attempt rejected while pool is full')

	// Drain the pool.
	await Promise.all(inflight)

	// Retry the same input — should now succeed without negative caching.
	const retried = await cacheOrRecompute(slowOpts(cap + 1))
	t.equal((retried.result as any).n, cap + 1, 'retry returned the fresh result for the previously-busy input')

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

tape('cacheOrRecompute rejects an unknown cacheSubdir with a helpful error', async t => {
	let err: any
	try {
		await cacheOrRecompute({
			computeArgument: { tag: 'bad-subdir' },
			// Bypass the static type-check so we can verify the runtime guard.
			cacheSubdir: 'not-a-real-subdir' as any,
			computeFresh: async () => ({ kind: 'TEST' })
		})
	} catch (e) {
		err = e
	}
	t.ok(err, 'cacheOrRecompute threw for an unregistered subdir')
	t.match(err.message, /Unknown cacheSubdir/, 'error message points at the unknown cacheSubdir guard')
	t.match(err.message, /cacheJobPolicies/, 'error message tells the developer where to register the subdir')
	t.end()
})

tape('non-ENOENT read errors propagate (e.g. a directory at the cache path triggers EISDIR)', async t => {
	ensureSubdir()
	const tag = crypto.randomBytes(8).toString('hex')
	const args = { tag, kind: 'eisdir' }
	const cacheId = generateHash(args)
	const dirAsFile = path.join(SUBDIR_ABS, `${cacheId}.json`)

	// Plant a directory at the exact path tryReadJson will try to read as a
	// file. readFile() on a directory throws an error with code 'EISDIR'
	// (not 'ENOENT'), so the early-return-on-miss guard does not apply and
	// the error must be rethrown.
	fs.mkdirSync(dirAsFile, { recursive: true })

	let caught: any
	try {
		await cacheOrRecompute({
			computeArgument: args,
			cacheSubdir: 'de',
			computeFresh: async () => ({ kind: 'TEST', tag })
		})
		t.fail('expected EISDIR (or equivalent non-ENOENT) read error to surface')
	} catch (e: any) {
		caught = e
	} finally {
		fs.rmdirSync(dirAsFile)
	}

	t.ok(caught, 'read error was rethrown (not swallowed as a cache miss)')
	t.notEqual(caught.code, 'ENOENT', 'rethrown error is NOT an ENOENT (that path would be silenced)')
	t.end()
})
