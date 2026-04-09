/*
Expand/reconstitute utilities for custom (non-dictionary) termCollections.

Before getData(): expandCustomTermCollection() replaces custom termCollection
tws with individual member tws so existing non-dict handlers (isoformExpression,
geneExpression, etc.) process them.

After getData(): reconstituteCustomTermCollection() regroups the per-member
sample data back into the JSON-grouped shape that downstream code expects.
*/

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
