import { junctionCustomTermSource, type JunctionCustomTerm } from './junction.customTerm.ts'

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

	if (!entries.length) {
		holder.append('div').text('Junctions selected from genome browser will be shown here.')
		return
	}

	for (const entry of entries) {
		if (entry.eventlabel) renderJunctionEvent(holder, entry, opts)
		else renderJunction(holder, entry, opts)
	}

	holder
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

function renderJunctionEvent(holder, entry: JunctionCustomTerm, opts) {
	const eventHolder = holder.append('div')
	const pillRow = eventHolder.append('div')
	pillRow
		.append('div')
		.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
		.style('display', 'inline-block')
		.style('border-radius', '6px')
		.style('margin', '1px 0')
		.text(entry.eventlabel!)
		.on('click', () => opts.callback(entry.tw.term))
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
