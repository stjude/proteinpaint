import type { OmnisearchResult } from '#types'
import { escapeHtml } from '../../../dom/escapeHtml.ts'
import { MIN_PROMPT_LENGTH_FOR_DICT_SEARCH, withinLength } from '../constants.ts'
import type { HandlerDeps, OmnisearchHandler, SearchInput } from '../types.ts'

/*Result kind: dictionary variables (the dataset's clinical/phenotype terms). Click a term to open 
a summary (or survival) plot of it. */

export class SearchResultHandler implements OmnisearchHandler<DictRow> {
	readonly key = 'dictionaryTerms' as const
	readonly heading = 'Dictionary'
	readonly noun = 'dictionary variable'
	readonly label = 'Dictionary variables'

	init() {}

	/** Typing: from the dictionary minimum length up to the max; Enter ignores the length gates. */
	includeInSearch({ prompt, enter }: SearchInput) {
		return enter || withinLength(prompt, MIN_PROMPT_LENGTH_FOR_DICT_SEARCH)
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

/** Whether this dataset has dictionary terms to search: every dataset does. */
export function includeResult(_termdbConfig: any): boolean {
	return true
}

/**********************
        TYPES
 **********************/

export type DictRow = {
	name: string
	/** the dictionary term as returned by the server; passed to the plot as `term` */
	term: any
	/** type-less terms (e.g. folders) are listed but not clickable */
	selectable: boolean
	ancestors: string
}
