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

/** runs fn in the context, such as for a test */
export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
	return storage.run(context, fn)
}
