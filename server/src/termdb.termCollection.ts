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

// 'prototype' plus every own property name inherited from Object.prototype (toString,
// hasOwnProperty, __proto__, constructor, etc.) -- any of these read back as truthy/callable
// on a plain object that never had them explicitly set, so they must all be excluded from use
// as a $id, not just the classic __proto__/constructor/prototype trio.
const RESERVED_TERM_IDS = new Set(['prototype', ...Object.getOwnPropertyNames(Object.prototype)])

/** True if this $id could reach the Object.prototype chain when later used as a
 *  plain-object property key (e.g. sampleData[$id] = ... or byTermId[$id] = ...).
 *  Bracket notation coerces any non-symbol key via ToPropertyKey (equivalent to
 *  String(id)), so a non-string $id -- e.g. ['__proto__'], or an object with a
 *  custom toString() -- can reach the same dangerous keys while evading a strict
 *  string-equality check; checking String(id) against the reserved set catches
 *  those without rejecting harmless non-string ids such as a plain number, which
 *  can never coerce to a reserved name. Symbols never collide with a string key,
 *  and nullish is allowed through so callers can still fall back to
 *  tw.term.id/tw.term.name. */
export function isReservedTermId(id: any): boolean {
	if (id == null || typeof id === 'symbol') return false
	return RESERVED_TERM_IDS.has(String(id))
}

/** Reject $id values that could be used to reach the Object.prototype chain
 *  when later used as a plain-object property key (e.g. sampleData[$id] = ...). */
function assertSafeTermId(id: any, context: string) {
	if (!id || typeof id !== 'string') throw new Error(`${context} is missing $id`)
	if (isReservedTermId(id)) throw new Error(`${context} has invalid $id`)
}

/** Expand custom termCollection tws into individual member tws.
 *  Non-custom terms pass through unchanged.
 *  Returns the expanded terms array and mappings needed for reconstitution. */
export function expandCustomTermCollection(terms: any[]): { expandedTerms: any[]; tcMappings: TcMapping[] } {
	const expandedTerms: any[] = []
	const tcMappings: TcMapping[] = []
	for (const tw of terms) {
		if (tw.term?.type === 'termCollection' && tw.term.isCustom) {
			assertSafeTermId(tw.$id, 'custom termCollection')
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
			// null-prototype: memberId comes from the client-supplied termlst (mt.id || mt.name),
			// so a member named '__proto__' must not be able to reassign this map's prototype
			// instead of setting an own value
			const memberValues: Record<string, number> = Object.create(null)
			for (const { expandedId, memberId } of mapping.memberMap) {
				const entry = sampleData[expandedId]
				if (entry != null) {
					memberValues[memberId] = entry.value
					delete sampleData[expandedId]
				}
			}
			if (Object.keys(memberValues).length > 0) {
				// defineProperty (not sampleData[key] = value) so a $id of '__proto__' cannot
				// reassign sampleData's prototype instead of setting a data property
				Object.defineProperty(sampleData, mapping.originalTcId, {
					value: { key: sampleId, value: memberValues },
					enumerable: true,
					configurable: true,
					writable: true
				})
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
		// an empty array is truthy, but getBin() always returns -1 against it, so treating an
		// empty bins list as "bins configured" would delete every sample's fraction result below
		// instead of falling back to unbinned values; require at least one bin to opt into binning
		const rawBins =
			tw.q.mode !== 'discrete'
				? undefined
				: tw.q.type === 'custom-bin'
				? tw.q.lst
				: computeFractionBins(tw.q, [...valuesBySample.values()])
		const bins = rawBins?.length ? rawBins : undefined
		if (bins) {
			data.refs ||= {}
			data.refs.byTermId ||= {}
			if (!Object.hasOwn(data.refs.byTermId, tw.$id)) data.refs.byTermId[tw.$id] = {}
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
	assertSafeTermId(tw.$id, 'fraction termCollection')
	validateTermCollectionFraction(tw.q, tw.term)
	if (tw.q.mode === 'discrete' && tw.q.type === 'custom-bin' && !(Array.isArray(tw.q.lst) && tw.q.lst.length))
		throw new Error('custom-bin fraction termCollection requires a non-empty q.lst[]')
}

function computeFractionBins(q: any, values: number[]) {
	if (!values.length) return []
	const min = Math.min(...values)
	const max = Math.max(...values)
	return compute_bins(q, () => ({ min, max }), undefined)
}
