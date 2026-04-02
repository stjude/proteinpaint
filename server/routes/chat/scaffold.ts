import type { LlmConfig } from '#types' // ,TermType
import { mayLog } from '#src/helpers.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
// import { SummaryScaffold } from './scaffoldTypes.ts'

async function summary(user_prompt: string, llm: LlmConfig) {
	const prompt = `You are a structured data extraction assistant. Your job is to parse the user prompt string and extract variables into a strict JSON scaffold for a summary plot configuration.
## Output Schema
Always return ONLY a JSON object in this exact format:
{
  "tw1": "<phrase>",        // REQUIRED
  "tw2": "<phrase>",        // OPTIONAL
  "tw3": "<phrase>",        // OPTIONAL
  "filter": "<phrase>"      // OPTIONAL
}

## Field Definitions
- tw1 (REQUIRED): The PRIMARY analysis variable — what is being measured, summarized, or analyzed. Extract the exact phrase from the query.
- tw2 (OPTIONAL): OVERLAY/GROUPING variable — a secondary variable used to compare or stratify tw1 across groups (e.g., "between X and Y", "by group", "across conditions").
- tw3 (OPTIONAL): DIVIDE BY variable — a tertiary variable used to split or facet the tw1 data (e.g., "divided by", "split by", "per", "for each").
- filter (OPTIONAL): A SUBGROUP RESTRICTION on the data — limits which records are included based on a condition (e.g., "age from 10 to 40", "only female patients", "stage I only").

## Extraction Rules
1. Always identify tw1 first — it answers "what is being plotted/summarized?"
2. tw2 answers "compared across what groups?" — look for prepositions like "between", "across", "by", "among", etc
3. tw3 answers "divided/faceted by what?" — look for "divided by", "split by", "per", "for each", "stratified by", etc
4. filter answers "restricted to which subset?" — look for "with", "where", "only", "from X to Y", "aged", "in stage", etc
5. If tw2 and tw3 are ambiguous, prefer tw2 for binary/categorical comparisons and tw3 for a faceting/panel variable
6. Omit any field that is not clearly present in the query
7. Return ONLY the JSON — no explanation, no markdown fences, no extra text

Parse the following query into the summary plot scaffold:
Query: ${user_prompt}
`
	// let response = summaryScaffold
	const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
	mayLog(`--> Summary scaffold: ${response}`)
	return response
}

export async function inferScaffold(user_prompt: string, plotType: string, llm: LlmConfig) {
	switch (plotType) {
		case 'summary':
			return await summary(user_prompt, llm)
		default:
			throw `No scaffold function defined for plot type: ${plotType}`
	}
}
