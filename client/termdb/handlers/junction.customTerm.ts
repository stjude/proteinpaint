import type { JunctionTerm } from '#types'
import { getColors } from '#shared/common.js'
import { getTermLabelSuffix } from '#shared/terms.js'

export const junctionCustomTermSource = 'junction'

export type JunctionCustomTerm = {
	id: string
	name: string
	source: typeof junctionCustomTermSource
	eventlabel?: string
	tw: {
		term: any
		q: any
	}
}

/** termSampleTypes: the sample types of the genome browser track the junctions are selected from, see
 * withSampleTypes(). The entry is then read for them, and kept apart from one of the same junctions read for
 * other sample types. */
export function makeJunctionCustomTerm(
	junctions: JunctionTerm[],
	eventlabel?: string,
	termSampleTypes?: { sampleTypes?: number[]; sampleTypeLabel?: string }
): JunctionCustomTerm {
	const entry = makeEntry(junctions, eventlabel)
	if (!termSampleTypes?.sampleTypes?.length) return entry
	entry.tw.term = withSampleTypes(entry.tw.term, termSampleTypes)
	entry.name = entry.tw.term.name
	entry.id += `:${termSampleTypes.sampleTypes.join(',')}`
	return entry
}

function makeEntry(junctions: JunctionTerm[], eventlabel?: string): JunctionCustomTerm {
	if (!junctions.length) throw new Error('junctions[] is empty')

	if (!eventlabel) {
		const term = junctions[0]
		return {
			id: `junction:${term.id}`,
			name: term.name,
			source: junctionCustomTermSource,
			tw: {
				term,
				q: { mode: 'continuous' }
			}
		}
	}

	const termlst = [...new Map(junctions.map(term => [term.id, term])).values()]
	const colorScale = getColors(termlst.length)
	const termIds = termlst.map(term => term.id)
	return {
		id: `junction-event:${eventlabel}`,
		name: eventlabel,
		source: junctionCustomTermSource,
		eventlabel,
		tw: {
			term: {
				type: 'termCollection',
				isCustom: true,
				memberType: 'numeric',
				name: eventlabel,
				termIds,
				termlst,
				propsByTermId: Object.fromEntries(termlst.map(term => [term.id, { color: colorScale(term.id) }])),
				isleaf: true
			},
			q: {
				mode: 'continuous',
				type: 'values',
				lst: termIds,
				numerators: termIds
			}
		}
	}
}

/** A copy of a picked junction term, or of a splice event's termCollection, read for the chosen sample
 * types. A collection's member junctions get them too, since the server reads each member as a junction
 * term of its own. The caller leaves a term unchanged for no choice or a choice of every sample type. Like a methylation region term, the name says which
 * sample types, so that the same junction read for two of them is told apart where a plot labels terms
 * by name. */
export function withSampleTypes(term: any, termSampleTypes: { sampleTypes?: number[]; sampleTypeLabel?: string }) {
	const { sampleTypes, sampleTypeLabel } = termSampleTypes
	const t = { ...term, sampleTypes, sampleTypeLabel }
	// a term saved with sample types, by Select on a track that reads some, is already named for them
	const oldSuffix = getTermLabelSuffix(term)
	const name = oldSuffix && term.name.endsWith(oldSuffix) ? term.name.slice(0, -oldSuffix.length) : term.name
	t.name = name + getTermLabelSuffix(t)
	if (Array.isArray(term.termlst)) t.termlst = term.termlst.map(m => ({ ...m, sampleTypes }))
	return t
}
