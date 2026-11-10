// Result kind: dictionary variables (the dataset's clinical/phenotype terms). Click a term to open a
// summary (or survival) plot of it.
import type { OmnisearchResult } from '#types'
import { escapeHtml } from '../../../dom/escapeHtml.ts'
import { MIN_PROMPT_LENGTH_FOR_DICT_SEARCH, withinLength } from './constants.ts'
import { inactive, type HandlerDeps, type HandlerPlan, type OmnisearchHandler, type SearchInput } from './types.ts'

export type DictRow = {
	name: string
	/** the dictionary term as returned by the server; passed to the plot as `term` */
	term: any
	/** type-less terms (e.g. folders) are listed but not clickable */
	selectable: boolean
	ancestors: string
}

export class DictionaryHandler implements OmnisearchHandler<DictRow> {
	readonly id = 'dictionary'
	readonly key = 'dictionaryTerms' as const
	readonly heading = 'Dictionary'
	readonly noun = 'dictionary variable'
	readonly label = 'Dictionary variables'
	enabled = true // every dataset has a dictionary

	init() {}

	plan({ prompt, enter }: SearchInput): HandlerPlan {
		const active = enter || withinLength(prompt, MIN_PROMPT_LENGTH_FOR_DICT_SEARCH)
		return active ? { active, request: { includeDict: true } } : inactive({ includeDict: false })
	}

	buildRows(data: OmnisearchResult): DictRow[] {
		return (Array.isArray(data.dictionaryTerms) ? data.dictionaryTerms : []).map((t: any) => ({
			name: t.name,
			term: t,
			selectable: Boolean(t.type),
			ancestors: (t.__ancestorNames || []).join(' > ')
		}))
	}

	renderRow(tr: any, row: DictRow, deps: HandlerDeps) {
		const nameTd = tr.append('td').text(row.name)
		if (row.selectable) {
			nameTd
				.style('cursor', 'pointer')
				.attr('class', 'sja_menuoption')
				.attr('data-testid', `sjpp-mass-chat-term-${row.term.id}`)
				.on('click', async () => {
					deps.addBubble({ msg: escapeHtml(row.name) + ' (dictionary variable)', me: 1 })
					try {
						await deps.launcher.launchPlot({
							chartType: row.term.type == 'survival' ? 'survival' : 'summary',
							term: { term: row.term }
						})
					} catch (e) {
						deps.popup.showError(e)
					}
				})
		} else {
			nameTd.style('padding', '5px 10px').style('opacity', 0.5)
		}
		tr.append('td').text(row.ancestors).style('opacity', 0.5).style('font-size', '.7em')
	}
}
