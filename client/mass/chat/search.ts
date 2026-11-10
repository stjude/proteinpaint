// Mass omnisearch request side: merge what each handler wants searched into ONE request (planSearch, pure),
// and call the server (fetchOmnisearch). What each result kind does with its part lives in ./handlers.
import { dofetch3 } from '#common/dofetch'
import type { OmnisearchResult } from '#types'
import type { OmnisearchHandler } from './handlers/types.ts'

/** wait this long after the last keystroke before searching */
export const SEARCH_DEBOUNCE_MS = 250

export type SearchPlan = {
	prompt: string
	/** merged request fields of every handler (their include* flags and coordCandidates) */
	request: Record<string, any>
}

/** Ask every handler whether and how to search the typed text, and merge their request fields. Returns null
 * when no handler wants to search (the results popup is then cleared). `enter` is true when the user
 * pressed Enter. */
export function planSearch(
	handlers: OmnisearchHandler[],
	rawPrompt: string,
	opts: { enter: boolean }
): SearchPlan | null {
	const prompt = rawPrompt.trim()
	if (!prompt) return null
	const plans = handlers.map(h => h.plan({ prompt, enter: opts.enter }))
	if (!plans.some(p => p.active)) return null
	return { prompt, request: Object.assign({}, ...plans.map(p => p.request)) }
}

/** Server call: POST the prompt to termdb/chat in omnisearch mode and return the OmnisearchResult. Takes
 * plain params (no DOM / component) so it can be integration-tested against a running server on its own.
 * The include* flags are sent only when given; the server treats an omitted flag as true. */
export async function fetchOmnisearch(opts: {
	genome: string
	dslabel: string
	prompt: string
	cohortStr?: string
	usecase?: any
	treeFilter?: any
	coordCandidates?: string[] | null
	includeDict?: boolean
	includeGenes?: boolean
	includeSamples?: boolean
	/** aborts the request, e.g. when a newer keystroke supersedes this search */
	signal?: AbortSignal
}): Promise<OmnisearchResult> {
	const data: OmnisearchResult = await dofetch3('termdb/chat', {
		signal: opts.signal,
		body: {
			genome: opts.genome,
			dslabel: opts.dslabel,
			omnisearch: true,
			prompt: opts.prompt,
			cohortStr: opts.cohortStr,
			usecase: opts.usecase,
			treeFilter: opts.treeFilter,
			coordCandidates: opts.coordCandidates || undefined,
			includeDict: opts.includeDict,
			includeGenes: opts.includeGenes,
			includeSamples: opts.includeSamples
		}
	})
	if (data.error) throw data.error
	return data
}
