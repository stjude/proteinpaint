import { junctionCustomTermSource, type JunctionCustomTerm } from './junction.customTerm.ts'
import { mayRenderFractionSelection } from './termCollectionFractionSelection.ts'

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

	// the fraction chooser is rendered in a sibling div, so that the list may be
	// restored without reloading, when the user backs out of the chooser
	const listDiv = div.append('div')
	const fractionDiv = div.append('div')

	for (const entry of entries) {
		if (entry.eventlabel) renderJunctionEvent(listDiv, fractionDiv, entry, opts)
		else renderJunction(listDiv, entry, opts)
	}

	listDiv
		.append('div')
		.style('font-size', '.7em')
		.style('margin-top', '10px')
		.style('opacity', 0.7)
		.text('Select additional junctions from genome browser.')
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
		.text(term => term.id)
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
			render(opts, getJunctionCustomTerms(opts.app.vocabApi.state?.customTerms))
		})
}
