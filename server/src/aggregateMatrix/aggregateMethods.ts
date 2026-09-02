import { PSEUDOBULK, type AggregateMethodOption } from '#types'
import { isNumericTerm } from '#shared/terms.js'

type AggregateMethodDefinition = AggregateMethodOption & {
	isAvailable: (ds: any) => boolean
	/** Future calculation and cache hooks belong here and are never sent to the client. */
	calculate?: (...args: any[]) => Promise<number | null> | number | null
}

const definitions: AggregateMethodDefinition[] = [
	{
		id: 'mean',
		label: 'Mean',
		appliesTo: 'numeric',
		termTypes: [PSEUDOBULK],
		isAvailable: ds => hasPseudobulkMethod(ds, 'mean')
	},
	{
		id: 'percent',
		label: 'Percent',
		appliesTo: 'numeric',
		termTypes: [PSEUDOBULK],
		isAvailable: ds => hasPseudobulkMethod(ds, 'percent')
	},
	{
		id: 'count',
		label: 'Count',
		appliesTo: 'nonNumeric',
		isAvailable: hasNonNumericTerms
	},
	{
		id: 'total',
		label: 'Total',
		appliesTo: 'nonNumeric',
		isAvailable: hasNonNumericTerms
	}
]

/** Attach the server-only aggregation capability resolver after dataset queries are validated. */
export function initAggregateMethods(ds: any) {
	const available = definitions.filter(method => method.isAvailable(ds))
	ds.getAvailableAggregateMethods = (terms: any[] = []): AggregateMethodOption[] =>
		available
			.filter(method => appliesToTerms(method, terms))
			.map(({ id, label, appliesTo, termTypes }) => ({ id, label, appliesTo, termTypes }))
}

function appliesToTerms(method: AggregateMethodDefinition, terms: any[]) {
	if (!terms.length) return true
	if (method.termTypes && !terms.every(term => method.termTypes!.includes(term.type))) return false
	if (method.appliesTo == 'any') return true
	return terms.every(term => isNumericTerm(term) == (method.appliesTo == 'numeric'))
}

function hasPseudobulkMethod(ds: any, method: string) {
	const pseudobulk = ds.queries?.singleCell?.pseudobulk
	if (!pseudobulk) return false
	for (const assay of Object.values<any>(pseudobulk)) {
		if (!assay || typeof assay != 'object') continue
		for (const member of Object.values<any>(assay)) {
			for (const category of Object.values<any>(member?.categories || {})) {
				if (category?.[`${method}File`]) return true
			}
		}
	}
	return false
}

function hasNonNumericTerms(ds: any) {
	const types = new Set<string>(ds.cohort?.termdb?.allowedTermTypes || [])
	for (const cohortTypes of Object.values<any>(ds.cohort?.termdb?.termtypeByCohort?.nested || {})) {
		for (const [type, count] of Object.entries(cohortTypes)) {
			if (count) types.add(type)
		}
	}
	for (const type of types) {
		if (!isNumericTerm({ type } as any)) return true
	}
	return false
}
