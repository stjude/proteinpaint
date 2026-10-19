import { AsyncLocalStorage } from 'async_hooks'

/*
The context of a request, which code that the request runs can read without it being passed as an argument, such as
startProcess() in toolRunner/client.ts, which stops the processes of a request when its response is closed.

setRequestContext() is a middleware, see app.middlewares.js. The context is kept across the awaits, timers and
callbacks that the request handler starts. Code that does not run for a request, such as the dataset init, has no
context.

signal: aborted when the response is closed, after it is sent or when the client disconnects, so that no process of
the request is still running after that
path: the request path, for log messages
*/

export type RequestContext = { signal: AbortSignal; path: string }

const storage = new AsyncLocalStorage<RequestContext>()

export function setRequestContext(req: { path: string }, res: NodeJS.EventEmitter, next: () => void) {
	const ctrl = new AbortController()
	// 'close' is emitted after 'finish' for a sent response, and also when the client disconnects before that
	res.once('close', () => ctrl.abort())
	storage.run({ signal: ctrl.signal, path: req.path }, next)
}

/** the context of the request that the calling code runs for, or undefined */
export function getRequestContext(): RequestContext | undefined {
	return storage.getStore()
}

export type SharedWork<T> = { promise: Promise<T>; join: () => void }

/*
Runs fn, whose result more than one request may wait for, such as a computation that concurrent requests with the
same inputs share, in a context of its own: its signal is aborted only when the responses of all the requests that
wait for it are closed, so that one closed response does not stop the processes of work that another request still
waits for. The request that calls this waits for it, and join() adds the request of a later caller. A caller that
does not run for a request, such as the dataset init, keeps the work running until it is done.
*/
export function startSharedWork<T>(fn: () => Promise<T>): SharedWork<T> {
	const ctrl = new AbortController()
	const first = storage.getStore()
	let waiting = 0
	let unbound = false
	const join = () => {
		const context = storage.getStore()
		if (!context) {
			unbound = true
			return
		}
		// a request whose response is already closed does not wait
		if (context.signal.aborted) return
		waiting++
		context.signal.addEventListener(
			'abort',
			() => {
				if (--waiting == 0 && !unbound) ctrl.abort()
			},
			{ once: true }
		)
	}
	join()
	if (waiting == 0 && !unbound) ctrl.abort()
	const promise = storage.run({ signal: ctrl.signal, path: first?.path || 'shared work' }, fn)
	return { promise, join }
}

/** runs fn in the context, such as for a test */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
	return storage.run(context, fn)
}
