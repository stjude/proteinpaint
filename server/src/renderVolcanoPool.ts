import { Worker } from 'node:worker_threads'
import type { VolcanoDrawInput } from './renderVolcanoDraw.ts'

/**
 * Fixed-size pool of worker threads that run the volcano PNG draw+encode off
 * the main server thread. The pool size IS the concurrency gate (it replaces
 * the former in-process semaphore in renderVolcano.ts) — at most POOL_SIZE
 * renders run at once; overflow waits in a FIFO queue.
 *
 * Workers are spawned lazily (so a server that never renders pays no
 * skia-canvas init cost) and kept alive for reuse. A crashed worker is dropped
 * and recreated on the next demand, so a single poison render can't
 * permanently kill a slot.
 */

const POOL_SIZE = 3

// renderVolcano.ts (which imports this module) is bundled into src/app.js in
// prod, so at runtime import.meta.url points at app.js and the compiled worker
// sits beside it as src/renderVolcanoWorker.js. In dev (tsx) this module runs
// in place and the sibling is renderVolcanoWorker.ts.
const isTs = import.meta.url.endsWith('.ts')
const workerUrl = new URL(isTs ? './renderVolcanoWorker.ts' : './renderVolcanoWorker.js', import.meta.url)

function spawnWorker(): Worker {
	if (isTs) {
		// tsx does NOT propagate its loader into spawned worker threads (the
		// auto-register is isMainThread-gated). Register it inside the worker via
		// an eval bootstrap, then import the real entry. `execArgv: ['--import',
		// 'tsx']` is unreliable on Node 20+, so the eval form is used instead.
		const href = JSON.stringify(workerUrl.href)
		return new Worker(`import('tsx/esm/api').then(({ register }) => { register(); return import(${href}) })`, {
			eval: true
		})
	}
	// Prod: plain .js sibling, no loader needed.
	return new Worker(workerUrl)
}

interface PendingJob {
	id: number
	input: VolcanoDrawInput
	transferList: ArrayBuffer[]
	resolve: (buf: Buffer) => void
	reject: (err: Error) => void
}

interface WorkerHandle {
	worker: Worker
	ready: boolean
	busy: boolean
	currentJob: PendingJob | null
}

const handles: WorkerHandle[] = []
const queue: PendingJob[] = []
let nextJobId = 1

function rehydrateError(e: { message?: string; stack?: string; name?: string } | undefined): Error {
	const err = new Error(e?.message ?? 'renderVolcano worker error')
	if (e?.name) err.name = e.name
	if (e?.stack) err.stack = e.stack
	return err
}

function failHandle(handle: WorkerHandle, err: Error): void {
	const idx = handles.indexOf(handle)
	if (idx !== -1) handles.splice(idx, 1)
	const job = handle.currentJob
	handle.currentJob = null
	handle.busy = false
	handle.worker.terminate().catch(() => {})
	if (job) job.reject(err)
	// A queued or in-flight job was rejected; try to make progress on the rest.
	pump()
}

function createHandle(): WorkerHandle {
	const worker = spawnWorker()
	const handle: WorkerHandle = { worker, ready: false, busy: false, currentJob: null }
	// Idle workers must not keep the process alive — otherwise importing this
	// module (transitively, via the routes) would hang tests/CLI tools, and the
	// pre-warmed worker below would never let the process exit. We ref() a
	// worker only while it has a job in flight (see pump / message handler).
	worker.unref()

	worker.on('message', (msg: any) => {
		if (msg && msg.type === 'ready') {
			handle.ready = true
			pump()
			return
		}
		const job = handle.currentJob
		if (!job || msg?.id !== job.id) return
		handle.currentJob = null
		handle.busy = false
		worker.unref()
		if (msg.ok) {
			const png = msg.png as Uint8Array
			job.resolve(Buffer.from(png.buffer, png.byteOffset, png.byteLength))
		} else {
			job.reject(rehydrateError(msg.error))
		}
		pump()
	})

	worker.on('error', err => failHandle(handle, err instanceof Error ? err : new Error(String(err))))
	worker.on('exit', code => {
		// Clean exits (terminate after error, or process shutdown) need no action
		// here — failHandle already removed the handle. A non-zero exit while the
		// handle is still tracked means a real crash.
		if (code !== 0 && handles.includes(handle)) {
			failHandle(handle, new Error(`renderVolcano worker exited with code ${code}`))
		}
	})

	return handle
}

function pump(): void {
	// Assign queued jobs to any idle, ready workers.
	for (const handle of handles) {
		if (queue.length === 0) break
		if (!handle.ready || handle.busy) continue
		const job = queue.shift()!
		handle.busy = true
		handle.currentJob = job
		// Keep the loop alive for the duration of this render; unref'd again on reply.
		handle.worker.ref()
		handle.worker.postMessage({ id: job.id, input: job.input }, job.transferList)
	}
	// Grow the pool only by what the backlog actually needs (capped at
	// POOL_SIZE). Non-busy handles are idle/still-warming workers that will pick
	// up queued jobs once ready, so they already cover that many queued jobs —
	// don't spawn a fresh worker per queued job and over-allocate. Newly spawned
	// workers call pump() again once they post `ready`.
	const willServe = handles.reduce((n, h) => n + (h.busy ? 0 : 1), 0)
	let deficit = queue.length - willServe
	while (deficit > 0 && handles.length < POOL_SIZE) {
		handles.push(createHandle())
		deficit--
	}
}

/**
 * Queue a volcano draw on the pool. `transferList` should contain the backing
 * ArrayBuffers of `input.x` / `input.y` / `input.flags` so they move to the
 * worker without a copy (they are neutered on this thread afterward). Resolves
 * with the raw PNG bytes.
 */
export function runOnPool(input: VolcanoDrawInput, transferList: ArrayBuffer[]): Promise<Buffer> {
	return new Promise<Buffer>((resolve, reject) => {
		queue.push({ id: nextJobId++, input, transferList, resolve, reject })
		pump()
	})
}

/**
 * Spawn (up to `count`, capped at POOL_SIZE) workers ahead of demand so the
 * first render doesn't pay the ~one-time worker-spawn + skia-canvas init cost.
 * Safe to call repeatedly; workers stay unref'd while idle so this never keeps
 * the process alive. Failures are swallowed — a warm-up crash just falls back
 * to lazy spawn on the next real render.
 */
export function prewarmVolcanoPool(count = 1): void {
	const target = Math.min(Math.max(count, 0), POOL_SIZE)
	while (handles.length < target) handles.push(createHandle())
}

// Warm one worker in the background at startup (this module is imported when the
// routes register), so the first user render hits a ready worker instead of a
// cold one. Idle workers are unref'd, so this adds no shutdown hang.
//
// Prod only: under tsx (dev + the single-process unit suite) the worker is
// spawned via the tsx/esm/api register() bootstrap, and doing that at
// module-import time races against tsx's Atomics-based ESM loader while the
// suite's module graph is still resolving — a nondeterministic mid-suite hang.
// renderVolcano.ts mirrors this: under tsx it draws on the main thread and never
// calls runOnPool, so the pool stays inert on import there.
if (!isTs) prewarmVolcanoPool(1)
