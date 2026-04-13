import type { LlmConfig } from '@sjcrh/proteinpaint-types'
import type { Value, DictTerm, GeneTerm } from './entity2termObj.ts'
import { route_to_appropriate_llm_provider } from './routeAPIcall.ts'
import { parse_dataset_db } from './utils.ts'
import { mayLog } from '#src/helpers.ts'

//>>>> Bin Config Types Definitions start
interface BinEntry {
	start?: number
	stop?: number
	startunbounded?: boolean
	stopunbounded?: boolean
	startinclusive: boolean
	stopinclusive: boolean
	label: string
}

interface RegularBinConfig {
	type: 'regular-bin'
	mode: 'discrete' | 'continuous'
}

interface CustomBinConfig {
	type: 'custom-bin'
	mode: 'discrete' | 'continuous'
	startinclusive: boolean
	lst: BinEntry[]
}
type BinConfig = RegularBinConfig | CustomBinConfig
//<<< Bin Config Types Definitions end

export function convert2TwTvs(
	match: { id: string; name: string; score: number }, // Dictionary match result
	type: string, // 'summary', 'de', or 'matrix'
	key: string, // tw1, tw2, tw3, or filter
	ds: any
) {
	if (type === 'summary') {
		const term = ds.cohort.termdb.q.termjsonByOneid(match.id)
		if (key === 'tw1' || key === 'tw2' || key === 'tw3') {
			// Generate tw object
			if (!term) throw new Error(`Invalid term id: ${match.id}`)
			const tw: any = { id: term.id }
			if (term.type == 'float' || term.type == 'integer') {
				tw.q = { mode: 'continuous' }
			}
			return tw
		} else if (key === 'filter') {
			// Generate tvslst object for filter
			if (!term) throw new Error(`Invalid filter term id: ${match.id}`)
			return {
				type: 'tvslst',
				in: true,
				lst: [{ type: 'tvs', tvs: { term } }]
			}
		} else {
			throw new Error(`Unknown key: ${key}`)
		}
	} else {
		throw 'Other plot types other than summary not yet supported'
	}
}

// Intermediate shapes produced after LLM resolution, before being turned into tvs nodes.
type ResolvedCatFilter = {
	kind: 'categorical'
	termObj: Value
	values: string[] // array so multi-category merges work (mirrors sortSameCategoricalFilterKeys)
	logicalOperator?: '&' | '|'
}
type ResolvedNumFilter = {
	kind: 'numeric'
	termObj: Value
	start?: string
	stop?: string
	logicalOperator?: '&' | '|'
}
type ResolvedFilter = ResolvedCatFilter | ResolvedNumFilter

/** Stable id for a term — matches on id for DictTerm, gene for GeneTerm, region for MethTerm. */
function getTermId(term: Value['term']): string {
	if ('id' in term) return term.id
	if ('gene' in term) return term.gene
	if ('chr' in term) return `${term.chr}:${term.startPos}-${term.endPos}`
	return ''
}

/**
 * sortSameCategoricalFilterKeys-equivalent for ResolvedFilter[]: when the same categorical term
 * appears multiple times (e.g. "males or females"), collapse them into a single entry with
 * merged value keys. Mirrors filter.ts's sortSameCategoricalFilterKeys(), but operates on our
 * pre-resolved intermediate shape (so we don't need ds for termdb lookups).
 */
function sortSameCategoricalFilterKeys(resolved: ResolvedFilter[]): ResolvedFilter[] {
	const sorted: ResolvedFilter[] = []
	const seenCatIdx = new Map<string, number>() // term id -> index into sorted[]
	for (const r of resolved) {
		if (r.kind === 'categorical') {
			const id = getTermId(r.termObj.term)
			const existingIdx = seenCatIdx.get(id)
			if (existingIdx !== undefined) {
				const existing = sorted[existingIdx] as ResolvedCatFilter
				for (const v of r.values) {
					if (!existing.values.includes(v)) existing.values.push(v)
				}
				continue
			}
			seenCatIdx.set(id, sorted.length)
		}
		sorted.push(r)
	}
	return sorted
}

/** Build a single tvs node from one ResolvedFilter (categorical → values[], numeric → ranges[]). */
function buildTvsNode(r: ResolvedFilter): any {
	if (r.kind === 'categorical') {
		return {
			type: 'tvs',
			tvs: {
				term: r.termObj.term,
				values: r.values.map(v => ({ key: v }))
			}
		}
	}
	const range: any = {}
	if (r.start && !r.stop) {
		range.start = Number(r.start)
		range.stopunbounded = true
	} else if (r.stop && !r.start) {
		range.stop = Number(r.stop)
		range.startunbounded = true
	} else if (r.start && r.stop) {
		range.start = Number(r.start)
		range.stop = Number(r.stop)
	}
	return {
		type: 'tvs',
		tvs: {
			term: r.termObj.term,
			ranges: [range]
		}
	}
}

/**
 * generate_filter_term-equivalent: build a flat tvslst from a list whose items are either a
 * ResolvedFilter (leaf) or a previously-assembled tvslst (nested child). Mirrors filter.ts's
 * generate_filter_term(): nested tvslst items are pushed as-is; ResolvedFilter items are
 * converted to tvs nodes; join is taken from any ResolvedFilter's logicalOperator (last wins),
 * defaulting to 'and' when items.length > 1 and nothing was set.
 */
function generateFlatTvslst(items: Array<ResolvedFilter | any>): any {
	const localfilter: any = { type: 'tvslst', in: true, lst: [] as any[] }
	for (const f of items) {
		if (f && f.type === 'tvslst') {
			localfilter.lst.push(f)
			continue
		}
		const r = f as ResolvedFilter
		if (r.logicalOperator) {
			localfilter.join = r.logicalOperator === '&' ? 'and' : 'or'
		}
		localfilter.lst.push(buildTvsNode(r))
	}
	if (items.length > 1 && !localfilter.join) {
		throw 'join term missing for multiple filter items:' + JSON.stringify(items)
	}
	return localfilter
}

async function resolveToTvs(tvsValues: Value[], dbPath: string, llm: LlmConfig): Promise<any> {
	// Resolve each filter phrase via the LLM helpers into an intermediate ResolvedFilter, then
	// assemble a tvslst matching filter.ts's validate_filter() + generate_filter_term() output:
	//   { type: 'tvslst', in: true, join?: 'and'|'or',
	//     lst: [ { type: 'tvs', tvs: { term, values|ranges } }, ... ] }
	// Categorical leaves get tvs.values[{ key }]; numeric leaves get
	// tvs.ranges[{ start?, stop?, startunbounded?, stopunbounded? }].
	const resolved: ResolvedFilter[] = []
	for (const termObj of tvsValues) {
		if (termObj.term.type === 'categorical') {
			const categoricalFilterTerm = await getCategoricalFilterTermValues(termObj, dbPath, llm)
			if (!categoricalFilterTerm) {
				console.warn(`resolveToTvs: skipping categorical filter term (no result): "${termObj.phrase}"`)
				continue
			}
			resolved.push({
				kind: 'categorical',
				termObj,
				values: [categoricalFilterTerm.value],
				logicalOperator: termObj.logicalOperator
			})
		} else if (
			termObj.term.type === 'integer' ||
			termObj.term.type === 'float' ||
			termObj.term.type === 'geneExpression' // Will need to add more nonDict term types here as needed, e.g. methylation, CNV, etc.
		) {
			const numericFilterTerm = await getNumericFilterTermValues(termObj, dbPath, llm)
			if (!numericFilterTerm) {
				console.warn(`resolveToTvs: skipping numeric filter term (no result): "${termObj.phrase}"`)
				continue
			}
			resolved.push({
				kind: 'numeric',
				termObj,
				start: numericFilterTerm.start,
				stop: numericFilterTerm.stop,
				logicalOperator: termObj.logicalOperator
			})
		}
	}

	// Merge duplicate categorical term ids into a single entry (sortSameCategoricalFilterKeys).
	const sorted = sortSameCategoricalFilterKeys(resolved)

	// Assemble. Mirrors validate_filter() in filter.ts:
	//   - 0 entries: empty tvslst
	//   - 1 or 2 entries: single generateFlatTvslst() call producing a flat tvslst
	//   - >2 entries: iteratively pair the accumulated tvslst with the next leaf to nest them,
	//     so each additional filter adds one wrapping tvslst layer.
	if (sorted.length === 0) {
		const empty = { type: 'tvslst', in: true, lst: [] as any[] }
		mayLog('localfilter:', JSON.stringify(empty))
		return empty
	}

	if (sorted.length <= 2) {
		const out = generateFlatTvslst(sorted)
		mayLog('localfilter:', JSON.stringify(out))
		return out
	}

	let current: any = null
	for (let i = 0; i < sorted.length - 1; i++) {
		const pair: Array<ResolvedFilter | any> = []
		if (i === 0) {
			pair.push(sorted[0])
		} else {
			pair.push(current)
		}
		pair.push(sorted[i + 1])
		current = generateFlatTvslst(pair)
	}
	mayLog('localfilter:', JSON.stringify(current))
	return current
}

// This function's main task is to detect if custom binning is requested in the user prompt
async function parseBinConfig(phrase: string, llm: LlmConfig): Promise<BinConfig> {
	const prompt = `You are a bioinformatics visualization assistant specialized in data binning configuration.
Your task is to analyze a user phrase and determine if it contains a request for custom binning of a numeric variable.
Respond ONLY with a valid JSON object. No explanation, no markdown, no code blocks.

## Output formats

### Format 1 — No custom binning requested:
Use this when the phrase simply names a variable without specifying any grouping or binning criteria.
{
  "type": "regular-bin",
  "mode": "discrete"
}

### Format 2 — Custom binning requested:
Use this when the phrase specifies groups, thresholds, ranges, quartiles, or any custom segmentation.
{
  "type": "custom-bin",
  "mode": "discrete",
  "lst": [
    {
      "startunbounded": true,
      "stop": <number>,
      "startinclusive": true,
      "stopinclusive": false,
      "label": "<label>"
    },
    {
      "start": <number>,
      "stop": <number>,
      "startinclusive": true,
      "stopinclusive": false,
      "label": "<label>"
    },
    {
      "start": <number>,
      "startinclusive": true,
      "stopunbounded": true,
      "stopinclusive": true,
      "label": "<label>"
    }
  ]
}

## Rules
- The first bin must always have "startunbounded": true
- The last bin must always have "stopunbounded": true
- Every bin must have a descriptive "label"
- Bins must be contiguous — the "stop" of one bin must equal the "start" of the next
- All numeric values must be numbers, not strings
- If the phrase only contains a variable name with no grouping criteria, always use Format 1

## Examples

Input: "age at diagnosis"
Output: {"type":"regular-bin","mode":"discrete"}

Input: "early (<10) and late (>=10) onset age at diagnosis"
Output:
{
  "type": "custom-bin",
  "mode": "discrete",
  "lst": [
    {
      "startunbounded": true,
      "stop": 10,
      "startinclusive": true,
      "stopinclusive": false,
      "label": "early onset (<10)"
    },
    {
      "start": 10,
      "startinclusive": true,
      "stopunbounded": true,
      "stopinclusive": true,
      "label": "late onset (>=10)"
    }
  ]
}

Input: "survival divided into 3 groups: short (<12 months), medium (12-60 months), long (>60 months)"
Output:
{
  "type": "custom-bin",
  "mode": "discrete",
  "lst": [
    {
      "startunbounded": true,
      "stop": 12,
      "startinclusive": true,
      "stopinclusive": false,
      "label": "short (<12 months)"
    },
    {
      "start": 12,
      "stop": 60,
      "startinclusive": true,
      "stopinclusive": false,
      "label": "medium (12-60 months)"
    },
    {
      "start": 60,
      "startinclusive": true,
      "stopunbounded": true,
      "stopinclusive": true,
      "label": "long (>60 months)"
    }
  ]
}

Analyze this phrase and return the appropriate JSON object: "${phrase}"
`
	const raw = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)

	// ── Parse and validate response ───────────────────────────────────────
	const text = raw
		.trim()
		.replace(/```json/g, '')
		.replace(/```/g, '')
		.trim()

	let parsed: RegularBinConfig | CustomBinConfig

	try {
		parsed = JSON.parse(text)
	} catch {
		console.warn('Failed to parse bin config response:', text)
		// Safe fallback — return regular bin if parsing fails
		return { type: 'regular-bin', mode: 'discrete' } as RegularBinConfig
	}

	// ── Validate structure ────────────────────────────────────────────────
	if (parsed.type === 'custom-bin') {
		if (!Array.isArray(parsed.lst) || parsed.lst.length === 0) {
			console.warn('custom-bin response missing lst array — falling back to regular-bin')
			return { type: 'regular-bin', mode: 'discrete' } as RegularBinConfig
		}
		// Ensure first bin has startunbounded and last bin has stopunbounded
		parsed.lst[0].startunbounded = true
		parsed.lst[parsed.lst.length - 1].stopunbounded = true
	}
	return parsed
}

async function resolveToTw(twValue: Value, llm: LlmConfig) {
	// Main objective is to support bin configs
	if (twValue.type === 'dictionary') {
		const twValueTerm = twValue.term as DictTerm
		// If it's a dictionary term and it is categorical, it doesn't support bins?
		// Check if this assumption is true with Robin/Colleen/Xin
		if (twValueTerm.type === 'categorical') {
			return { id: twValueTerm.id, type: 'categorical', q: { mode: 'discrete' } }
		} else {
			// For numeric terms, check if the phrase contains any binning language (e.g. "binned into 5 groups", "divided into quartiles", etc.)
			const binConfig = await parseBinConfig(twValue.phrase, llm)
			if (!binConfig) throw new Error(`Failed to parse bin config from phrase: ${twValue.phrase}`)
			mayLog('Parsed bin config:', JSON.stringify(binConfig))
			return { id: twValueTerm.id, type: twValueTerm.type, q: binConfig }
		}
	} else {
		if (twValue.type === 'geneExpression') {
			const twValueTerm = twValue.term as GeneTerm
			return {
				gene: twValueTerm.gene.toUpperCase(),
				name: twValueTerm.gene.toUpperCase(),
				type: twValueTerm.type,
				q: { mode: 'continuous' }
			}
		}
	}
}

export async function resolveToTwTvs(
	entity: Record<string, Value | Value[] | undefined>,
	plotType: string,
	llm: LlmConfig,
	dbPath: string
) {
	if (!entity) throw new Error('Undefined entity provided')

	const twTvsObjects: Record<string, any> = {}

	if (plotType === 'summary') {
		for (const [key, value] of Object.entries(entity)) {
			// special handling for filters
			if (key === 'filter') {
				const filterValues = value as Value[] | undefined
				if (!filterValues) throw new Error(`Invalid term entity for key ${key}`)
				const termWrapper = await resolveToTvs(filterValues, dbPath, llm)
				twTvsObjects[key] = termWrapper
				continue
			}
			// For other keys (tw1, tw2, tw3), we expect a single Term in the array
			const twValue = value as Value | undefined
			if (!twValue) throw new Error(`Invalid term entity for key ${key}`)
			const termWrapper = await resolveToTw(twValue, llm)
			mayLog(`Resolved term for key ${key}:`, JSON.stringify(termWrapper))
			twTvsObjects[key] = termWrapper
		}
	} else if (plotType == 'dge') {
		for (const [key, value] of Object.entries(entity)) {
			const filterValues = value as Value[] | undefined
			if (!filterValues) throw new Error(`Invalid term entity for key ${key}`)
			const termWrapper = await resolveToTvs(filterValues, dbPath, llm)
			twTvsObjects[key] = termWrapper
		}
	} else {
		throw 'Other plot types other than summary not yet supported'
	}
	return twTvsObjects
}

async function getCategoricalFilterTermValues(
	termObj: Value,
	dbPath: string,
	llm: LlmConfig
): Promise<{ term: string; value: string } | undefined> {
	// For categorical filters, we need to determine both the term and the specific value being filtered on
	// (e.g. "T cell" → term="cell_type" value="T_cell"). We ask an LLM to pick the rag_docs row whose
	// term + one of its enumerated values best matches termObj.phrase.
	if ('id' in termObj.term) {
		// Assuming categorical terms from the dictionary will have an 'id' field, while non-dictionary terms won't.
		const dataset_db_output = await parse_dataset_db(dbPath)
		const { db_rows, rag_docs } = dataset_db_output

		// Narrow to rows that actually describe a categorical term with enumerated values,
		// so the LLM is not distracted by numeric/condition/etc. rows.
		const candidateDocs: string[] = []
		for (let i = 0; i < db_rows.length; i++) {
			if (db_rows[i].term_type === 'categorical' && db_rows[i].values.length > 0) {
				candidateDocs.push(rag_docs[i])
			}
		}
		if (candidateDocs.length === 0) {
			console.warn('getCategoricalFilterTermValues: no categorical rows in DB')
			return undefined
		}

		const prompt = `You are an assistant that selects the best matching categorical dictionary term and its value for a user-supplied filter phrase.

You will be given:
1. A phrase describing a filter condition (e.g. "T cell", "male patients", "AML").
2. A list of dictionary rows. Each row describes one term: its field name, its type, its description, and the possible (key, label) values it can take.

Your job:
- Select the SINGLE row whose term (and one of its enumerated values) is most semantically similar to the phrase.
- From that row's possible values, select the SINGLE key whose label (or key) the phrase refers to.
- Return ONLY a JSON object conforming to this schema, with no explanation, no markdown, no extra keys:
  { "term": "<the field name of the selected row>", "value": "<the key of the selected value within that row>" }

Dictionary rows:
${candidateDocs.map((doc, i) => `Row ${i + 1}: ${doc}`).join('\n')}

Phrase: "${termObj.phrase}"

JSON response:`

		const response = await route_to_appropriate_llm_provider(prompt, llm, llm.classifierModelName)
		try {
			const parsed = JSON.parse(response) as { term: string; value: string }
			if (!parsed.term || !parsed.value) {
				console.warn(`getCategoricalFilterTermValues: LLM response missing term/value: ${response}`)
				return undefined
			}
			mayLog(
				`getCategoricalFilterTermValues: phrase="${termObj.phrase}" → term="${parsed.term}" value="${parsed.value}"`
			)
			return parsed
		} catch (e) {
			console.warn(`getCategoricalFilterTermValues: failed to parse LLM response: ${response}`, e)
			return undefined
		}
	} else {
		throw 'getCategoricalFilterTermValues: termObj.term is not from dictionary, cannot determine categorical filter values'
	}
}
async function getNumericFilterTermValues(
	termObj: Value,
	dbPath: string,
	llm: LlmConfig
): Promise<{ term: string; start?: string; stop?: string } | undefined> {
	// For numeric filters, we need to determine the term being filtered on and any specified cutoffs
	// (e.g. "age > 60" → term="age" start="60"). Branch by termObj.term shape:
	//   - DictTerm: use an LLM against numeric (integer/float) rag_docs rows to pick the term
	//   - GeneTerm / MethTerm: the term identifier is already known, skip the rag_docs lookup
	// Then use a second LLM call to extract start/stop cutoffs from termObj.phrase.
	let termName: string

	if ('id' in termObj.term) {
		const dataset_db_output = await parse_dataset_db(dbPath)
		const { db_rows, rag_docs } = dataset_db_output

		const candidateDocs: string[] = []
		for (let i = 0; i < db_rows.length; i++) {
			if (db_rows[i].term_type === 'integer' || db_rows[i].term_type === 'float') {
				candidateDocs.push(rag_docs[i])
			}
		}
		if (candidateDocs.length === 0) {
			console.warn('getNumericFilterTermValues: no numeric rows in DB')
			return undefined
		}

		const termPrompt = `You are an assistant that selects the best matching numeric dictionary term for a user-supplied filter phrase.

You will be given:
1. A phrase describing a numeric filter condition (e.g. "age > 60", "BMI between 20 and 30").
2. A list of dictionary rows. Each row describes one numeric term: its field name, its type (integer/float), and its description.

Your job:
- Select the SINGLE row whose term is most semantically similar to the phrase.
- Return ONLY a JSON object conforming to this schema, with no explanation, no markdown, no extra keys:
  { "term": "<the field name of the selected row>" }

Dictionary rows:
${candidateDocs.map((doc, i) => `Row ${i + 1}: ${doc}`).join('\n')}

Phrase: "${termObj.phrase}"

JSON response:`

		const termResponse = await route_to_appropriate_llm_provider(termPrompt, llm, llm.classifierModelName)
		try {
			const parsed = JSON.parse(termResponse) as { term: string }
			if (!parsed.term) {
				console.warn(`getNumericFilterTermValues: LLM response missing term: ${termResponse}`)
				return undefined
			}
			termName = parsed.term
		} catch (e) {
			console.warn(`getNumericFilterTermValues: failed to parse term response: ${termResponse}`, e)
			return undefined
		}
	} else if ('gene' in termObj.term) {
		termName = termObj.term.gene
	} else if ('chr' in termObj.term) {
		termName = `${termObj.term.chr}:${termObj.term.startPos}-${termObj.term.endPos}`
	} else {
		throw 'getNumericFilterTermValues: unknown term shape — expected DictTerm, GeneTerm, or MethTerm'
	}

	const cutoffPrompt = `You are an assistant that extracts numeric cutoffs from a filter phrase.

Given a phrase describing a numeric filter, extract any lower bound (start) and/or upper bound (stop).

Interpretation rules:
- "> N", ">= N", "above N", "greater than N", "older than N", "higher than N", "at least N" → start = N
- "< N", "<= N", "below N", "less than N", "younger than N", "lower than N", "at most N" → stop = N
- "between A and B", "from A to B", "A to B", "in the range A-B" → start = A, stop = B
- Return numeric values as strings without units (e.g. "60" not "60 years").
- If the phrase contains implied cutoffs with ("early onset of cancer" → stop = 15), ("senior citizens" → start = 65), ("young patients" → stop = 30), use your best judgment to assign reasonable numeric values.
- Omit the "start" key if no lower bound is mentioned. Omit the "stop" key if no upper bound is mentioned.
- Return ONLY a JSON object, with no explanation, no markdown, no extra keys:
  { "start": "<number>", "stop": "<number>" }

Phrase: "${termObj.phrase}"

JSON response:`

	const cutoffResponse = await route_to_appropriate_llm_provider(cutoffPrompt, llm, llm.classifierModelName)
	let start: string | undefined
	let stop: string | undefined
	try {
		const parsed = JSON.parse(cutoffResponse) as { start?: string; stop?: string }
		start = parsed.start
		stop = parsed.stop
	} catch (e) {
		console.warn(`getNumericFilterTermValues: failed to parse cutoff response: ${cutoffResponse}`, e)
	}

	if (!start && !stop) {
		throw `getNumericFilterTermValues: no start or stop could be extracted from phrase "${termObj.phrase}"`
	}

	mayLog(
		`getNumericFilterTermValues: phrase="${termObj.phrase}" → term="${termName}" start="${start ?? ''}" stop="${
			stop ?? ''
		}"`
	)
	return { term: termName, start, stop }
}
