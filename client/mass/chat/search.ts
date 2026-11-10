// Mass omnisearch request side: decide WHETHER and WHAT to search for a typed prompt (planSearch, pure),
// and call the server (fetchOmnisearch). Rendering lives in renderers.ts / popup.ts.
import { dofetch3 } from '#common/dofetch'
import type { OmnisearchResult } from '#types'

// Minimum prompt length per search family. Gene search runs from a single character; dictionary search
// requires 3 (it matches more loosely). Sample search (an all-samples scan on the server) never runs while
// typing, only when the user presses Enter. Coordinate search has no length gate (its regex decides).
export const MIN_PROMPT_LENGTH_FOR_GENE_SEARCH = 2
export const MIN_PROMPT_LENGTH_FOR_DICT_SEARCH = 3
export const MAX_PROMPT_LENGTH_FOR_OMNISEARCH = 20
/** wait this long after the last keystroke before searching */
export const SEARCH_DEBOUNCE_MS = 250

/** Genomic coordinate shape-filter + "chr" prefix toggling. Matches a typed "chr:start-stop" range
 * (e.g. "chr7:100000-200000" or, with the prefix omitted, "7:100000-200000") and returns the candidate
 * coordinate strings to try server-side: both the typed spelling and the "chr"-toggled one, since only the
 * server's genome object knows which chromosome name it uses. Returns null when the prompt is not a
 * coordinate range (a bare chr, a gene name, or partial typing). Chromosome existence and position validity
 * are left to the server's string2pos(); this is only a cheap shape/spelling step. */
export function parseCoordCandidates(prompt: string): string[] | null {
	const m = /^\s*(\w+)\s*:\s*([\d,]+)\s*-\s*([\d,]+)\s*$/.exec(prompt)
	if (!m) return null
	const [, chrToken, start, stop] = m
	const chrCandidates = /^chr/i.test(chrToken)
		? [chrToken, chrToken.replace(/^chr/i, '')] // "chr7" -> try "chr7", then "7"
		: [chrToken, 'chr' + chrToken] // "7" -> try "7", then "chr7"
	return chrCandidates.map(chr => `${chr}:${start}-${stop}`)
}

export type SearchPlan = {
	prompt: string
	coordCandidates: string[] | null
	includeDict: boolean
	includeSamples: boolean
}

/** Decide what to search for the typed text. Returns null when nothing should be searched (the results popup
 * is then cleared). `enter` is true when the user pressed Enter: only then are samples searched, and the
 * length cutoffs do not apply (the user explicitly asked for the search). */
export function planSearch(rawPrompt: string, opts: { enter: boolean }): SearchPlan | null {
	const prompt = rawPrompt.trim()
	if (!prompt) return null
	const coordCandidates = parseCoordCandidates(prompt)
	const withinGeneBounds =
		MIN_PROMPT_LENGTH_FOR_GENE_SEARCH <= prompt.length && prompt.length <= MAX_PROMPT_LENGTH_FOR_OMNISEARCH
	if (!opts.enter && !coordCandidates && !withinGeneBounds) return null
	return {
		prompt,
		coordCandidates,
		includeDict: opts.enter || prompt.length >= MIN_PROMPT_LENGTH_FOR_DICT_SEARCH,
		includeSamples: opts.enter
	}
}

/** Server call: POST the prompt to termdb/chat in omnisearch mode and return the OmnisearchResult. Takes
 * plain params (no DOM / component) so it can be integration-tested against a running server on its own.
 * `includeDict` / `includeSamples` are sent only when given; the server treats an omitted flag as true. */
export async function fetchOmnisearch(opts: {
	genome: string
	dslabel: string
	prompt: string
	cohortStr?: string
	usecase?: any
	treeFilter?: any
	coordCandidates?: string[] | null
	includeDict?: boolean
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
			includeSamples: opts.includeSamples
		}
	})
	if (data.error) throw data.error
	return data
}
