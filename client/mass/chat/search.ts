// Mass omnisearch request side: decide which result kinds to search for the typed text and build ONE request
// (planSearch, pure), and call the server (fetchOmnisearch). What each result kind does lives in ./handlers.
import { dofetch3 } from '#common/dofetch'
import type { OmnisearchRequest, OmnisearchResult } from '#types'
import type { OmnisearchHandler } from './types.ts'

/** wait this long after the last keystroke before searching */
export const SEARCH_DEBOUNCE_MS = 250

export type SearchPlan = {
	prompt: string
	/** `include` lists the key of every handler that searches this text, plus any extra fields they need */
	request: OmnisearchRequest
}

/** Ask every handler whether it searches the typed text. The request's `include` list is the keys of those that
 * do, in handler order. Returns null when no handler does (the results popup is then cleared). `enter` is true
 * when the user pressed Enter. */
export function planSearch(
	handlers: OmnisearchHandler[],
	rawPrompt: string,
	opts: { enter: boolean }
): SearchPlan | null {
	const prompt = rawPrompt.trim()
	if (!prompt) return null
	const input = { prompt, enter: opts.enter }
	const searched = handlers.filter(h => h.includeInSearch(input))
	if (!searched.length) return null
	return {
		prompt,
		request: Object.assign({ include: searched.map(h => h.key) }, ...searched.map(h => h.requestExtras?.(input)))
	}
}

/** Server call: POST the prompt to termdb/chat in omnisearch mode and return the OmnisearchResult. Takes
 * plain params (no DOM / component) so it can be integration-tested against a running server on its own.
 * Without `include` the server searches only dictionary terms and genes (see OmnisearchRequest). */
export async function fetchOmnisearch(
	opts: {
		genome: string
		dslabel: string
		prompt: string
		cohortStr?: string
		usecase?: any
		treeFilter?: any
		/** aborts the request, e.g. when a newer keystroke supersedes this search */
		signal?: AbortSignal
	} & OmnisearchRequest
): Promise<OmnisearchResult> {
	const { signal, ...body } = opts
	const data: OmnisearchResult = await dofetch3('termdb/chat', { signal, body: { ...body, omnisearch: true } })
	if (data.error) throw data.error
	return data
}
