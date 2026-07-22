import { deleteJunction, deleteJunctionEvent, subscribeJunctions } from './junction.broker'
import type { PublishedJunction } from './junction.broker'

export class SearchHandler {
	unsubscribe?: () => void

	async init(opts) {
		if (!opts?.holder) throw new Error('opts.holder is required')
		if (typeof opts.callback != 'function') throw new Error('opts.callback is required')

		this.unsubscribe?.()
		if (typeof opts.genomeObj?.name != 'string') throw new Error('opts.genomeObj.name not string')

		const holder = opts.holder
		const key = `${opts.genomeObj.name}:${opts.app.vocabApi.vocab.dslabel}`

		this.unsubscribe = subscribeJunctions(key, terms => {
			holder.selectAll('*').remove()

			if (!terms.length) {
				holder.append('div').text('Junctions selected from genome browser will be shown here.')
				return
			}

			const termsByEventLabel = new Map<string, PublishedJunction[]>()
			const termsWithoutEventLabel: PublishedJunction[] = []
			for (const term of terms) {
				if (!term.eventlabel) {
					termsWithoutEventLabel.push(term)
					continue
				}
				const eventTerms = termsByEventLabel.get(term.eventlabel) || []
				eventTerms.push(term)
				termsByEventLabel.set(term.eventlabel, eventTerms)
			}

			if (termsWithoutEventLabel.length) renderJunctions(holder, termsWithoutEventLabel, opts.callback, key)
			for (const [eventlabel, eventTerms] of termsByEventLabel) {
				const eventHolder = holder.append('div')
				const pillRow = eventHolder.append('div')
				pillRow
					.append('div')
					.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
					.style('display', 'inline-block')
					.style('border-radius', '6px')
					.style('margin', '1px 0')
					.text(eventlabel)
					.on('click', () => opts.callback(makeTermCollection(eventlabel, eventTerms)))
				pillRow
					.append('button')
					.attr('data-testid', 'sjpp-junction-delete')
					.style('margin-left', '4px')
					.attr('aria-label', `Delete ${eventlabel}`)
					.text('×')
					.on('click', () => deleteJunctionEvent(key, eventlabel))
				eventHolder
					.append('div')
					.style('margin-left', '10px')
					.style('font-size', '.7em')
					.selectAll('div')
					.data(eventTerms, term => term.id)
					.enter()
					.append('div')
					.text(term => term.id)
			}
			holder
				.append('div')
				.style('font-size', '.7em')
				.style('margin-top', '10px')
				.style('opacity', 0.7)
				.text('Select additional junctions from genome browser.')
		})
	}
}

function renderJunctions(holder, terms: PublishedJunction[], callback, key: string) {
	const choices = holder
		.append('div')
		.selectAll('div')
		.data(terms, term => term.id)
		.enter()
		.append('div')
	choices
		.append('div')
		.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term')
		.style('display', 'inline-block')
		.style('border-radius', '6px')
		.style('margin', '1px 0')
		.text(term => term.name)
		.on('click', (_, term) => callback(term))
	choices
		.append('button')
		.attr('data-testid', 'sjpp-junction-delete')
		.style('margin-left', '4px')
		.attr('aria-label', term => `Delete ${term.name}`)
		.text('×')
		.on('click', (_, term) => deleteJunction(key, term.id))
}

function makeTermCollection(eventlabel: string, eventTerms: PublishedJunction[]) {
	const termlst = eventTerms.map(term => {
		const junction = { ...term }
		delete junction.eventlabel
		return junction
	})
	return {
		type: 'termCollection',
		isCustom: true,
		memberType: 'numeric',
		name: eventlabel,
		termIds: termlst.map(term => term.id),
		termlst,
		propsByTermId: {},
		isleaf: true
	}
}
