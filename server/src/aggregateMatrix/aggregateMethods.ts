import { PSEUDOBULK, type AggregateMethodOption } from '#types'
import { isNumericTerm } from '#shared/terms.js'

type AggregateMethodDefinition = AggregateMethodOption & {
	isAvailable: (ds: any, terms: any[]) => boolean
	/** Server-only hook. Sufficient statistics are computed once for all requested methods. */
	calculateFromStats?: (stats: { matches: number; numericMatches: number; cohortCount: number; sum: number }) => number | null
}

const definitions: AggregateMethodDefinition[] = [
	{
		id: 'mean',
		label: 'Mean',
		appliesTo: 'numeric',
		isAvailable: (ds, terms) => hasNumericMethod(ds, terms, 'mean'),
		calculateFromStats: stats => (stats.numericMatches ? stats.sum / stats.numericMatches : null)
	},
	{
		id: 'percent',
		label: 'Percent',
		appliesTo: 'any',
		isAvailable: (ds, terms) => hasPercentMethod(ds, terms),
		calculateFromStats: stats => (stats.cohortCount ? (stats.matches / stats.cohortCount) * 100 : null)
	},
	{
		id: 'count',
		label: 'Count',
		appliesTo: 'any',
		isAvailable: (ds, terms) => hasCountMethod(ds, terms)
	}
]

export function calculateAggregateMethod(
	methodId: string,
	stats: { matches: number; numericMatches: number; cohortCount: number; sum: number }
) {
	const calculate = definitions.find(method => method.id == methodId)?.calculateFromStats
	if (!calculate) throw new Error(`Unsupported sample-based aggregate method: ${methodId}`)
	return calculate(stats)
}

/** Attach the server-only aggregation capability resolver after dataset queries are validated. 
 * This runs after sample validation in mds3.init. */
export function initAggregateMethods(ds: any) {
	ds.getAvailableAggregateMethods = (terms: any[] = []): AggregateMethodOption[] =>
		definitions
			.filter(method => method.isAvailable(ds, terms))
			.filter(method => appliesToTerms(method, terms))
			.map(({ id, label, appliesTo, termTypes }) => ({ id, label, appliesTo, termTypes }))
}

/** Calculate all requested sample-based methods in one pass over a getData response. */
export function calculateSampleBasedMethods(
	methodIds: string[],
	samples: Record<string, any>,
	rowIds: string[],
	columnId: string,
	columnTerm?: any,
	cohortCount = Object.keys(samples).length
): Map<string, Record<string, number | null>> {
	const requested = methodIds.map(id => definitions.find(method => method.id == id))
	if (requested.some((method, index) => methodIds[index] != 'count' && !method?.calculateFromStats)) {
		throw new Error(`Unsupported sample-based aggregate method: ${methodIds.join(', ')}`)
	}

	const matches = new Uint32Array(rowIds.length)
	const numericMatches = new Uint32Array(rowIds.length)
	const sums = new Float64Array(rowIds.length)
	for (const sample of Object.values(samples)) {
		if (!Object.prototype.hasOwnProperty.call(sample, columnId)) continue
		const columnAnnotation = sample[columnId]
		const columnValue = columnAnnotation?.value
		for (let i = 0; i < rowIds.length; i++) {
			if (!Object.prototype.hasOwnProperty.call(sample, rowIds[i])) continue
			matches[i]++
			if (isComputableNumeric(columnAnnotation, columnTerm, columnValue)) {
				numericMatches[i]++
				sums[i] += columnValue
			}
		}
	}

	const result = new Map<string, Record<string, number | null>>()
	for (let methodIndex = 0; methodIndex < methodIds.length; methodIndex++) {
		const values: Record<string, number | null> = {}
		for (let rowIndex = 0; rowIndex < rowIds.length; rowIndex++) {
			values[rowIds[rowIndex]] =
				methodIds[methodIndex] == 'count'
					? matches[rowIndex]
					: requested[methodIndex]!.calculateFromStats!({
							matches: matches[rowIndex],
							numericMatches: numericMatches[rowIndex],
							cohortCount,
							sum: sums[rowIndex]
						})
		}
		result.set(methodIds[methodIndex], values)
	}
	return result
}

function isComputableNumeric(annotation: any, term: any, value: unknown): value is number {
	if (typeof value != 'number' || !Number.isFinite(value)) return false
	const keys = annotation?.values?.length ? annotation.values.map(item => item.key) : [annotation?.key]
	return !keys.some(key => term?.values?.[key]?.uncomputable || Object.entries<any>(term?.values || {}).some(([_, item]) => item?.uncomputable && item.label === key))
}

function hasNumericMethod(ds: any, terms: any[], method: 'mean') {
	if (terms.length) {
		return terms.every(term =>
			term.type == PSEUDOBULK ? hasPseudobulkMethod(ds, method, term) : isNumericTerm(term)
		)
	}
	return hasStandardNumericTerms(ds) || hasPseudobulkMethod(ds, method)
}

function hasPercentMethod(ds: any, terms: any[]) {
	if (terms.length) {
		return terms.every(term => term.type == PSEUDOBULK ? hasPseudobulkMethod(ds, 'percent', term) : true)
	}
	return hasStandardNumericTerms(ds) || hasNonNumericTerms(ds) || hasPseudobulkMethod(ds, 'percent')
}

function hasCountMethod(ds: any, terms: any[]) {
	if (terms.length) {
		return terms.every(term => term.type != PSEUDOBULK)
	}
	return hasStandardNumericTerms(ds) || hasNonNumericTerms(ds)
}

function appliesToTerms(method: AggregateMethodDefinition, terms: any[]) {
	if (!terms.length) return true
	if (method.termTypes && !terms.every(term => method.termTypes!.includes(term.type))) return false
	if (method.appliesTo == 'any') return true
	return terms.every(term => isNumericTerm(term) == (method.appliesTo == 'numeric'))
}

function hasPseudobulkMethod(ds: any, method: string, term?: any): boolean {
	const pseudobulk = ds.queries?.singleCell?.pseudobulk
	if (!pseudobulk) return false
	if (term) {
		if (term.type != PSEUDOBULK) return false
		/* No need to check every file in the pseudobulk member; will fail on init if missing
		in validatePseudobulk. just check if the specific method is enabled. */
		return pseudobulk[term.assay]?.[term.memberId]?.enabledMethods?.has(method) || false
	}
	for (const assay of Object.values<any>(pseudobulk)) {
		if (!assay || typeof assay != 'object') continue
		for (const member of Object.values<any>(assay)) {
			if (member?.enabledMethods?.has(method)) return true
		}
	}
	return false
}

function hasStandardNumericTerms(ds: any) {
	const types = getDatasetTermTypes(ds)
	for (const type of types) {
		if (type != PSEUDOBULK && isNumericTerm({ type } as any)) return true
	}
	return !!(
		ds.queries?.geneExpression ||
		ds.queries?.isoformExpression ||
		ds.queries?.metaboliteIntensity ||
		ds.queries?.proteome ||
		ds.queries?.ssGSEA ||
		ds.queries?.dnaMethylation?.get ||
		ds.queries?.junction
	)
}

function hasNonNumericTerms(ds: any) {
	for (const type of getDatasetTermTypes(ds)) {
		if (!isNumericTerm({ type } as any)) return true
	}
	return false
}

function getDatasetTermTypes(ds: any) {
	const types = new Set<string>(ds.cohort?.termdb?.allowedTermTypes || [])
	for (const cohortTypes of Object.values<any>(ds.cohort?.termdb?.termtypeByCohort?.nested || {})) {
		for (const [type, count] of Object.entries(cohortTypes)) {
			if (count) types.add(type)
		}
	}
	return types
}
