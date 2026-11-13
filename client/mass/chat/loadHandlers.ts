// Loads the omnisearch handlers, the same way TermTypeSearch loads its term type handlers: each result key is a
// file in ./handlers that exports `includeResult(termdbConfig)` and a `SearchResultHandler` class (see types.ts
// for the interface).
//
// To add a result kind: write handlers/<key>.ts as described in types.ts, and add <key> to RESULT_KEYS.
import type { OmnisearchResultKey } from '#types'
import type { HandlerCtx, OmnisearchHandler } from './types.ts'

/** Result keys in display order. Each is also the file name of its handler in ./handlers. */
export const RESULT_KEYS: OmnisearchResultKey[] = ['dictionaryTerms', 'genes', 'samples', 'coord']

/** Load the handlers for this dataset. A result key whose `includeResult(termdbConfig)` is false (the dataset
 * cannot produce it) gets no handler instance, so everything downstream only ever sees handlers that apply.
 * Fresh instances are created per call because they hold per-dataset state. */
export async function initHandlers(ctx: HandlerCtx): Promise<OmnisearchHandler[]> {
	// Promise.all keeps the order of RESULT_KEYS
	const handlers = await Promise.all(
		RESULT_KEYS.map(async key => {
			try {
				const _ = await import(`./handlers/${key}.ts`)
				if (!_.includeResult) throw new Error('includeResult not implemented')
				if (!_.includeResult(ctx.termdbConfig)) return null
				const handler: OmnisearchHandler = new _.SearchResultHandler()
				if (!handler.init) throw new Error('init not implemented')
				if (handler.key !== key) throw new Error(`handler.key is '${handler.key}', expected '${key}'`)
				handler.init(ctx)
				return handler
			} catch (e: any) {
				throw new Error(`error with handler='./handlers/${key}.ts': ${e.message || e}`)
			}
		})
	)
	return handlers.filter((h): h is OmnisearchHandler => h !== null)
}
