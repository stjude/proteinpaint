// Prompt length gates, shared by the handlers. Gene search runs from MIN_PROMPT_LENGTH_FOR_GENE_SEARCH
// characters; dictionary search requires more (it matches more loosely). Prompts over the max are not
// searched while typing. Pressing Enter ignores the length gates: the user explicitly asked for the search.
export const MIN_PROMPT_LENGTH_FOR_GENE_SEARCH = 2
export const MIN_PROMPT_LENGTH_FOR_DICT_SEARCH = 3
export const MAX_PROMPT_LENGTH_FOR_OMNISEARCH = 20

/** true when typing (not Enter) a prompt of this length may be searched with the given minimum */
export function withinLength(prompt: string, min: number): boolean {
	return min <= prompt.length && prompt.length <= MAX_PROMPT_LENGTH_FOR_OMNISEARCH
}
