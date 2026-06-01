import { parentPort } from 'node:worker_threads'
import { drawVolcanoPng, type VolcanoDrawInput } from './renderVolcanoDraw.ts'

/**
 * Worker-thread entry for volcano PNG rendering. Receives a transferable draw
 * payload from renderVolcanoPool.ts, runs the canvas draw+encode off the main
 * server thread, and posts back the PNG bytes (transferred, zero-copy). Errors
 * are sent as plain `{message,stack,name}` so the pool can rehydrate them into
 * an `Error` for the awaiting caller — `Error` instances don't structured-clone
 * with their prototype.
 *
 * This module is bundled standalone by build.sh into renderVolcanoWorker.js
 * (node-canvas stays external). In dev it runs as .ts via the tsx loader that
 * the pool registers inside the worker.
 */

if (!parentPort) throw new Error('renderVolcanoWorker must be run as a worker thread')
const port = parentPort

interface JobMessage {
	id: number
	input: VolcanoDrawInput
}

port.on('message', async (msg: JobMessage) => {
	const { id, input } = msg
	try {
		const buf = await drawVolcanoPng(input)
		// View over the exact PNG bytes; transfer its backing ArrayBuffer so the
		// bytes move to the main thread without a copy. node-canvas returns a
		// dedicated (non-pooled) buffer, so transferring its buffer is safe.
		const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
		port.postMessage({ id, ok: true, png: bytes }, [bytes.buffer])
	} catch (e: any) {
		port.postMessage({
			id,
			ok: false,
			error: { message: e?.message ?? String(e), stack: e?.stack, name: e?.name }
		})
	}
})

// Signal readiness only after the message handler is attached, so the pool
// never assigns work before this worker can receive it (matters in dev, where
// the tsx register()+import() bootstrap resolves asynchronously).
port.postMessage({ type: 'ready' })
