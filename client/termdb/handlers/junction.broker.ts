import type { JunctionTerm } from '#types'
import type { Selection } from 'd3-selection'

export type PublishedJunction = JunctionTerm & { eventlabel?: string }

type Listener = (terms: PublishedJunction[]) => void

type DatasetTerms = {
	withoutEventLabel: Map<string, PublishedJunction>
	byEventLabel: Map<string, Map<string, PublishedJunction>>
}

const termsByDataset = new Map<string, DatasetTerms>()
const listenersByDataset = new Map<string, Set<Listener>>()

export function publishJunction(
	key: string,
	junctions: JunctionTerm[],
	buttonDom: HTMLElement,
	msgDiv: Selection<HTMLDivElement, unknown, any, any>,
	eventlabel?: string
) {
	let datasetTerms = termsByDataset.get(key)
	if (!datasetTerms) {
		datasetTerms = {
			withoutEventLabel: new Map(),
			byEventLabel: new Map()
		}
		termsByDataset.set(key, datasetTerms)
	}

	let terms = datasetTerms.withoutEventLabel
	if (eventlabel) {
		terms = datasetTerms.byEventLabel.get(eventlabel) || new Map()
		datasetTerms.byEventLabel.set(eventlabel, terms)
	}
	for (const junction of junctions) terms.set(junction.id, eventlabel ? { ...junction, eventlabel } : junction)

	const selected = getSelectedJunctions(datasetTerms)
	for (const listener of listenersByDataset.get(key) || []) listener(selected)

	buttonDom.remove()
	msgDiv.html(
		eventlabel
			? `${junctions.length} junctions can now be found through variable selection under label <b>${eventlabel}</b>.`
			: 'This junction can now be found through variable selection.'
	)
}

export function subscribeJunctions(key: string, listener: Listener) {
	let listeners = listenersByDataset.get(key)
	if (!listeners) {
		listeners = new Set()
		listenersByDataset.set(key, listeners)
	}

	listeners.add(listener)
	const datasetTerms = termsByDataset.get(key)
	listener(datasetTerms ? getSelectedJunctions(datasetTerms) : [])

	return () => listeners.delete(listener)
}

export function deleteJunction(key: string, junctionId: string) {
	const datasetTerms = termsByDataset.get(key)
	if (!datasetTerms) return
	datasetTerms.withoutEventLabel.delete(junctionId)
	notifyListeners(key, datasetTerms)
}

export function deleteJunctionEvent(key: string, eventlabel: string) {
	const datasetTerms = termsByDataset.get(key)
	if (!datasetTerms) return
	datasetTerms.byEventLabel.delete(eventlabel)
	notifyListeners(key, datasetTerms)
}

function notifyListeners(key: string, datasetTerms: DatasetTerms) {
	const selected = getSelectedJunctions(datasetTerms)
	for (const listener of listenersByDataset.get(key) || []) listener(selected)
}

function getSelectedJunctions(datasetTerms: DatasetTerms) {
	return [
		...datasetTerms.withoutEventLabel.values(),
		...Array.from(datasetTerms.byEventLabel.values()).flatMap(terms => [...terms.values()])
	]
}
