import type { JunctionTerm } from '#types'
import { getColors } from '#shared/common.js'

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

export function makeJunctionCustomTerm(junctions: JunctionTerm[], eventlabel?: string): JunctionCustomTerm {
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
