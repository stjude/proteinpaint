import { junctionCustomTermSource, type JunctionCustomTerm } from './junction.customTerm.ts'
import { mayRenderFractionSelection } from './termCollectionFractionSelection.ts'
import { mayRenderSampleTypeRow, getTermSampleTypes } from '#dom'
import { getTermLabelSuffix } from '#shared/terms.js'

export class SearchHandler {
	async init(opts) {
		if (!opts?.holder) throw new Error('opts.holder is required')
		if (typeof opts.callback != 'function') throw new Error('opts.callback is required')

		const entries = getJunctionCustomTerms(opts.app.vocabApi.state?.customTerms)
		render(opts, entries)
	}
}

export function getJunctionCustomTerms(customTerms: any): JunctionCustomTerm[] {
	if (!Array.isArray(customTerms)) return []
	return customTerms.filter(term => term?.source === junctionCustomTermSource && term.tw?.term)
}

function render(opts, entries: JunctionCustomTerm[]) {
	const holder = opts.holder
	holder.selectAll('*').remove()
	const div = holder.append('div').style('padding', '10px 0px')

	if (!entries.length) {
		div.append('div').text('Junctions selected from genome browser will be shown here.')
		return
	}

	/* the sample types to read the picked junction for, as for gene expression and methylation terms.
	Drawn once: a delete redraws only the list below, so the choice stays */
	const termdbConfig = opts.app.vocabApi.termdbConfig
	const query = termdbConfig?.queries?.junction
	const sampleTypeSelect = mayRenderSampleTypeRow(div.append('div'), query, termdbConfig)
	/* a junction or event term, or the term wrapper of an event's fraction from the fraction chooser, with
	the chosen sample types, see withSampleTypes() */
	const pick = (termOrTw: any) => {
		const termSampleTypes = getTermSampleTypes(sampleTypeSelect, query, termdbConfig)
		// nothing selectable, which getTermSampleTypes() has alerted
		if (!termSampleTypes) return
		/* every sample type of the junction file, or its only one, is the same as no choice: the term then
		reads every sample, as before there was a selector, including any sample without a sample type */
		const all =
			!termSampleTypes.sampleTypes?.length || query.sampleTypes.every(t => termSampleTypes.sampleTypes!.includes(t))
		const apply = (term: any) => (all ? term : withSampleTypes(term, termSampleTypes))
		return opts.callback(termOrTw.term ? { ...termOrTw, term: apply(termOrTw.term) } : apply(termOrTw))
	}

	const listHolder = div.append('div')
	const renderList = () => {
		const entries = getJunctionCustomTerms(opts.app.vocabApi.state?.customTerms)
		// the last one is deleted
		if (!entries.length) return render(opts, entries)
		listHolder.selectAll('*').remove()
		const itemOpts = { ...opts, callback: pick, renderList }

		// the fraction chooser is rendered in a sibling div, so that the list may be
		// restored without reloading, when the user backs out of the chooser
		const listDiv = listHolder.append('div')
		const fractionDiv = listHolder.append('div')

		for (const entry of entries) {
			if (entry.eventlabel) renderJunctionEvent(listDiv, fractionDiv, entry, itemOpts)
			else renderJunction(listDiv, entry, itemOpts)
		}

		listDiv
			.append('div')
			.style('font-size', '.7em')
			.style('margin-top', '10px')
			.style('opacity', 0.7)
			.text('Select additional junctions from genome browser.')
	}
	renderList()
}

function renderJunction(holder, entry: JunctionCustomTerm, opts) {
	const choice = holder.append('div')
	choice
		.append('div')
		.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
		.style('display', 'inline-block')
		.style('border-radius', '6px')
		.style('margin', '1px 0')
		.text(entry.tw.term.name)
		.on('click', () => opts.callback(entry.tw.term))
	addDeleteButton(choice, entry, opts)
}

function renderJunctionEvent(holder, fractionDiv, entry: JunctionCustomTerm, opts) {
	const eventHolder = holder.append('div')
	const pillRow = eventHolder.append('div')
	pillRow
		.append('div')
		.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
		.style('display', 'inline-block')
		.style('border-radius', '6px')
		.style('margin', '1px 0')
		.text(entry.eventlabel!)
		.on('click', () => selectJunctionEvent(holder, fractionDiv, entry, opts))
	addDeleteButton(pillRow, entry, opts)
	eventHolder
		.append('div')
		.style('margin-left', '10px')
		.style('font-size', '.7em')
		.selectAll('div')
		.data(entry.tw.term.termlst, term => term.id)
		.enter()
		.append('div')
		.text(term => term.name)
}

function selectJunctionEvent(listDiv, fractionDiv, entry: JunctionCustomTerm, opts) {
	const isStaged = mayRenderFractionSelection({
		term: entry.tw.term,
		selectionMode: opts.termCollectionSelectionMode,
		listDiv,
		fractionDiv,
		callback: tw => opts.callback(tw)
	})
	if (!isStaged) opts.callback(entry.tw.term)
}

function addDeleteButton(holder, entry: JunctionCustomTerm, opts) {
	holder
		.append('button')
		.attr('data-testid', 'sjpp-junction-delete')
		.style('margin-left', '4px')
		.attr('aria-label', `Delete ${entry.name}`)
		.text('×')
		.on('click', async () => {
			await opts.app.vocabApi.deleteCustomTermById(entry.id)
			opts.renderList()
		})
}

/** A copy of a picked junction term, or of a splice event's termCollection, read for the chosen sample
 * types. A collection's member junctions get them too, since the server reads each member as a junction
 * term of its own. The caller leaves a term unchanged for no choice or a choice of every sample type. Like a methylation region term, the name says which
 * sample types, so that the same junction read for two of them is told apart where a plot labels terms
 * by name. */
function withSampleTypes(term: any, termSampleTypes: { sampleTypes?: number[]; sampleTypeLabel?: string }) {
	const { sampleTypes, sampleTypeLabel } = termSampleTypes
	const t = { ...term, sampleTypes, sampleTypeLabel }
	t.name = term.name + getTermLabelSuffix(t)
	if (Array.isArray(term.termlst)) t.termlst = term.termlst.map(m => ({ ...m, sampleTypes }))
	return t
}
