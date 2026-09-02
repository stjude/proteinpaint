import { PSEUDOBULK, type AggregateMethodOption } from '#types'
import { isNumericTerm } from '#shared/terms.js'

type AggregateMethodDefinition = AggregateMethodOption & {
	isAvailable: (ds: any) => boolean
	/** Server-only calculation hook. Counts are computed once and shared by all requested methods. */
	calculateFromCounts?: (counts: { matches: number; total: number }) => number
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
		isAvailable: hasNonNumericTerms,
		calculateFromCounts: counts => counts.matches
	},
	{
		id: 'total',
		label: 'Total',
		appliesTo: 'nonNumeric',
		isAvailable: hasNonNumericTerms,
		calculateFromCounts: counts => counts.total
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

/** Calculate all requested sample-based methods in one pass over a getData response. */
export function calculateSampleBasedMethods(
	methodIds: string[],
	samples: Record<string, any>,
	rowIds: string[],
	columnId: string
): Map<string, Record<string, number>> {
	const requested = methodIds.map(id => definitions.find(method => method.id == id))
	if (requested.some(method => !method?.calculateFromCounts)) {
		throw new Error(`Unsupported sample-based aggregate method: ${methodIds.join(', ')}`)
	}

	const matches = new Uint32Array(rowIds.length)
	let total = 0
	for (const sample of Object.values(samples)) {
		if (!Object.prototype.hasOwnProperty.call(sample, columnId)) continue
		total++
		for (let i = 0; i < rowIds.length; i++) {
			if (Object.prototype.hasOwnProperty.call(sample, rowIds[i])) matches[i]++
		}
	}

	const result = new Map<string, Record<string, number>>()
	for (let methodIndex = 0; methodIndex < methodIds.length; methodIndex++) {
		const values: Record<string, number> = {}
		const calculate = requested[methodIndex]!.calculateFromCounts!
		for (let rowIndex = 0; rowIndex < rowIds.length; rowIndex++) {
			values[rowIds[rowIndex]] = calculate({ matches: matches[rowIndex], total })
		}
		result.set(methodIds[methodIndex], values)
	}
	return result
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
