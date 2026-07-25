/*
Expand/reconstitute utilities for custom (non-dictionary) termCollections.

Before getData(): expandCustomTermCollection() replaces custom termCollection
tws with individual member tws so existing non-dict handlers (isoformExpression,
geneExpression, etc.) process them.

After getData(): reconstituteCustomTermCollection() regroups the per-member
sample data back into the JSON-grouped shape that downstream code expects.
*/

import { getBin } from '#shared/terms.js'
import { compute_bins, get_bin_label } from '#shared/termdb.bins.js'
import { validateTermCollectionFraction } from '#shared/termCollection.js'

type MemberMapping = { expandedId: string; memberId: string }
type TcMapping = { originalTcId: string; originalTw: any; memberMap: MemberMapping[] }

/** Expand custom termCollection tws into individual member tws.
 *  Non-custom terms pass through unchanged.
 *  Returns the expanded terms array and mappings needed for reconstitution. */
export function expandCustomTermCollection(terms: any[]): { expandedTerms: any[]; tcMappings: TcMapping[] } {
	const expandedTerms: any[] = []
	const tcMappings: TcMapping[] = []
	for (const tw of terms) {
		if (tw.term?.type === 'termCollection' && tw.term.isCustom) {
			if (!tw.term.termlst?.length) throw new Error('custom termCollection has empty termlst')
			const mapping: TcMapping = { originalTcId: tw.$id, originalTw: tw, memberMap: [] }
			for (const mt of tw.term.termlst) {
				const memberId = mt.id || mt.name
				const expandedId = `__${tw.$id}__${memberId}`
				expandedTerms.push({ $id: expandedId, term: mt, q: {} })
				mapping.memberMap.push({ expandedId, memberId })
			}
			tcMappings.push(mapping)
		} else {
			expandedTerms.push(tw)
		}
	}
	return { expandedTerms, tcMappings }
}

/** Regroup expanded per-member sample data back into JSON-grouped termCollection shape.
 *  Mutates data.samples in place. */
export function reconstituteCustomTermCollection(
	data: { samples?: Record<string, any> },
	tcMappings: TcMapping[]
): void {
	if (!tcMappings.length || !data?.samples) return
	for (const [sampleId, sampleData] of Object.entries(data.samples)) {
		for (const mapping of tcMappings) {
			const memberValues: Record<string, number> = {}
			for (const { expandedId, memberId } of mapping.memberMap) {
				const entry = sampleData[expandedId]
				if (entry != null) {
					memberValues[memberId] = entry.value
					delete sampleData[expandedId]
				}
			}
			if (Object.keys(memberValues).length > 0) {
				sampleData[mapping.originalTcId] = { key: sampleId, value: memberValues }
			}
		}
	}
}

/** Resolve fraction-mode numeric collections to one scalar value per sample.
 *
 * q.denominators is the denominator set and q.numerators is a subset of it.
 * Member values absent from a sample contribute zero. A sample with a zero
 * denominator has no value for the collection.
 */
export function resolveTermCollectionFractions(
	data: { samples?: Record<string, any>; refs?: { byTermId?: Record<string, any> } },
	terms: any[]
): void {
	if (!data.samples) return
	for (const tw of terms) {
		if (
			tw.term?.type !== 'termCollection' ||
			tw.term.memberType !== 'numeric' ||
			tw.type !== 'TermCollectionTWFraction'
		)
			continue
		validateFractionTw(tw)
		const valuesBySample = new Map<any, number>()
		for (const sampleData of Object.values(data.samples)) {
			const memberValues = sampleData[tw.$id]?.value
			if (!memberValues || typeof memberValues !== 'object') continue
			let denominator = 0
			let numerator = 0
			for (const id of tw.q.denominators) {
				const value = Number(memberValues[id])
				if (Number.isFinite(value)) denominator += value
			}
			for (const id of tw.q.numerators) {
				const value = Number(memberValues[id])
				if (Number.isFinite(value)) numerator += value
			}
			if (Number.isFinite(denominator) && denominator !== 0) {
				const value = numerator / denominator
				if (Number.isFinite(value)) valuesBySample.set(sampleData, value)
			}
		}
		const bins =
			tw.q.mode !== 'discrete'
				? undefined
				: tw.q.type === 'custom-bin'
				? tw.q.lst
				: computeFractionBins(tw.q, [...valuesBySample.values()])
		if (bins) {
			data.refs ||= {}
			data.refs.byTermId ||= {}
			data.refs.byTermId[tw.$id] ||= {}
			data.refs.byTermId[tw.$id].bins = bins
		}
		for (const sampleData of Object.values(data.samples)) {
			const value = valuesBySample.get(sampleData)
			if (value === undefined) {
				delete sampleData[tw.$id]
				continue
			}
			let key: number | string = value
			if (bins) {
				const index = getBin(bins, value)
				if (index === -1) {
					delete sampleData[tw.$id]
					continue
				}
				key = get_bin_label(bins[index], tw.q)
			}
			sampleData[tw.$id] = { key, value }
		}
	}
}

function validateFractionTw(tw: any) {
	if (!tw.$id) throw new Error('fraction termCollection is missing $id')
	validateTermCollectionFraction(tw.q, tw.term)
}

function computeFractionBins(q: any, values: number[]) {
	if (!values.length) return []
	const min = Math.min(...values)
	const max = Math.max(...values)
	return compute_bins(q, () => ({ min, max }), undefined)
}
