import type { BaseTerm, TermValues } from '../index.ts'

/*
For term type 'multivalue'

A multivalue term annotates a sample with a JSON object of {key: number} entries,
e.g. {"SJMB12": 1, "SJDAWN": 1} or {"ALMOST ALWAYS": 7}. How that map is interpreted
is declared by term.valueMeaning; generic plotting/filtering code must branch on it.
*/

export type MultivalueTerm = BaseTerm & {
	id: string
	name?: string
	type: 'multivalue'
	/** how the {key: number} annotation is interpreted:
	 * 'membership': keys are categories the sample belongs to (number is a positive flag/count);
	 *   generic queries expand one row per key, so a sample may be counted under multiple categories
	 * 'score': keys map to numeric scores whose meaning is dataset-specific (e.g. PrOFILE module
	 *   ratings); generic queries return the raw JSON string and bespoke routes interpret it
	 * missing: treated as 'score', preserving the behavior of dbs built before this field existed */
	valueMeaning?: 'membership' | 'score'
	/** category metadata (label/color/order) for membership keys, same shape as categorical values */
	values?: TermValues
}

export type RawMultivalueTerm = MultivalueTerm
