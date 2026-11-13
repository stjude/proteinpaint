// Mass omnisearch: the SEARCH tab component (MassSearch), plus its request side: decide which result kinds to
// search for the typed text and build ONE request (planSearch, pure), and call the server (fetchOmnisearch).
// What each result kind does lives in ./handlers.
import { getCompInit, type RxComponent } from '#rx'
import { keyupEnter } from '#src/client'
import { dofetch3 } from '#common/dofetch'
import type { OmnisearchRequest, OmnisearchResult } from '#types'
import type { MassAppApi } from '../types/mass'
import { debounce } from 'debounce'
import { initHandlers } from './loadHandlers.ts'
import type { HandlerDeps, OmnisearchHandler } from './types.ts'
import { buildResultList, renderEntry, describeSearchable } from './results.ts'
import { ResultsPopup } from './popup.ts'
import { Launcher } from './launcher.ts'

/** wait this long after the last keystroke before searching */
export const SEARCH_DEBOUNCE_MS = 250

export type SearchPlan = {
	prompt: string
	/** `include` lists the key of every handler that searches this text, plus any extra fields they need */
	request: OmnisearchRequest
}

/** Ask every handler whether it searches the typed text. The request's `include` list is the keys of those that
 * do, in handler order. Returns null when no handler does (the results popup is then cleared). `enter` is true
 * when the user pressed Enter. */
export function planSearch(
	handlers: OmnisearchHandler[],
	rawPrompt: string,
	opts: { enter: boolean }
): SearchPlan | null {
	const prompt = rawPrompt.trim()
	if (!prompt) return null
	const input = { prompt, enter: opts.enter }
	const searched = handlers.filter(h => h.includeInSearch(input))
	if (!searched.length) return null
	return {
		prompt,
		request: Object.assign({ include: searched.map(h => h.key) }, ...searched.map(h => h.requestExtras?.(input)))
	}
}

/** Server call: POST the prompt to termdb/chat in omnisearch mode and return the OmnisearchResult. Takes
 * plain params (no DOM / component) so it can be integration-tested against a running server on its own.
 * Without `include` the server searches only dictionary terms and genes (see OmnisearchRequest). */
export async function fetchOmnisearch(
	opts: {
		genome: string
		dslabel: string
		prompt: string
		cohortStr?: string
		usecase?: any
		treeFilter?: any
		/** aborts the request, e.g. when a newer keystroke supersedes this search */
		signal?: AbortSignal
	} & OmnisearchRequest
): Promise<OmnisearchResult> {
	const { signal, ...body } = opts
	const data: OmnisearchResult = await dofetch3('termdb/chat', { signal, body: { ...body, omnisearch: true } })
	if (data.error) throw data.error
	return data
}

/** The mass SEARCH tab: a search-as-you-type omnisearch (dictionary variables, genes, samples, genomic regions)
 * that launches plots.
 * Module map: handlers/ (one per result kind: when it is searched, its rows, what clicking does),
 * search.ts (this component, merge the handlers' requests + server call), results.ts (generic headings/notes/list),
 * popup.ts (results popup), launcher.ts (plot launchers shared by handlers). */
class MassSearch implements RxComponent {
	static type = 'search'
	type: string
	opts: any
	app: MassAppApi
	dom!: any
	state: any
	id!: string
	/** one per result kind, initialized once from the dataset config in init() */
	handlers!: OmnisearchHandler[]
	popup!: ResultsPopup
	launcher!: Launcher
	/** aborts the in-flight omnisearch request when a newer search, or a clear, supersedes it */
	private searchAbort?: AbortController
	/** debounced search-as-you-type; kept on the component so main() can cancel a queued search */
	private debouncedSearch!: ((plan: SearchPlan) => void) & { clear: () => void }

	constructor(opts: any) {
		this.type = MassSearch.type
		this.opts = opts
		this.app = opts.app
		this.opts.usecase = this.opts.usecase || { target: 'dictionary', detail: 'term' }
	}

	getState(appState: any) {
		return {
			cohortStr:
				appState.activeCohort == -1 || !appState.termdbConfig.selectCohort
					? ''
					: appState.termdbConfig.selectCohort.values[appState.activeCohort].keys.slice().sort().join(','),
			search: appState.search,
			nav: appState.nav,
			termdbConfig: appState.termdbConfig
		}
	}

	async init(appState) {
		// No server request here: each search resolves dictionary terms, genes, samples and a typed coordinate
		// in a single request. Everything that depends only on the dataset is decided once, here.
		this.handlers = await initHandlers({ app: this.app, termdbConfig: appState.termdbConfig })
		this.initDom()
	}

	initDom() {
		const subheader = this.opts.subheader
		// grows to fit the selected gene's action buttons
		this.dom = {
			bubbleDiv: subheader
				.append('div')
				.attr('class', 'sjpp_show_scrollbar')
				.style('margin', '5px 20px 0px 20px')
				.style('height', 'auto')
				.style('max-height', '200px')
				.style('overflow', 'auto')
				.style('scroll-behavior', 'smooth')
		}

		const inputSel = subheader
			.append('input')
			.attr('type', 'search')
			.attr('data-testid', 'sjpp-mass-omnisearch-input')
			.style('margin', '15px')
			.style('padding', '17px')
			.style('border-radius', '34px')
			.attr('size', 70)
			.attr('placeholder', 'Search an item')
		this.dom.inputNode = inputSel.node()

		// tells the user what can be searched; generated from the same handlers that gate the search
		subheader
			.append('div')
			.attr('data-testid', 'sjpp-mass-omnisearch-searchable')
			.style('margin', '-5px 20px 10px 20px')
			.style('font-size', '.8em')
			.style('opacity', 0.6)
			.text(describeSearchable(this.handlers))

		this.popup = new ResultsPopup(this.dom.inputNode, { noMatchText: 'No match' })
		this.launcher = new Launcher({
			app: this.app,
			popup: this.popup,
			getActiveTab: () => this.state?.nav?.activeTab
		})

		this.debouncedSearch = debounce((plan: SearchPlan) => void this.runSearch(plan), SEARCH_DEBOUNCE_MS)

		inputSel
			// search-as-you-type: debounced; never searches samples
			.on('keyup.search', (event: KeyboardEvent) => {
				if (keyupEnter(event)) return
				const plan = planSearch(this.handlers, (event.target as HTMLInputElement).value, { enter: false })
				if (!plan) {
					this.debouncedSearch.clear()
					this.searchAbort?.abort() // drop any in-flight request for text that is no longer there
					this.popup.hide()
					return
				}
				this.debouncedSearch(plan)
			})
			.on('keyup.submit', async (event: KeyboardEvent) => {
				if (!keyupEnter(event)) return
				// Enter runs the full search immediately, including samples
				this.debouncedSearch.clear()
				const plan = planSearch(this.handlers, (event.target as HTMLInputElement).value, { enter: true })
				if (plan) await this.runSearch(plan)
				else this.popup.hide()
			})
			.node()
			.focus()
	}

	/** One omnisearch request. A newer search or a clear aborts it; an aborted request renders nothing and
	 * shows no error. */
	async runSearch(plan: SearchPlan) {
		this.searchAbort?.abort()
		const { signal } = (this.searchAbort = new AbortController())
		try {
			const data = await fetchOmnisearch({
				genome: this.app.vocabApi.vocab.genome,
				dslabel: this.app.vocabApi.vocab.dslabel,
				prompt: plan.prompt,
				cohortStr: this.getState(this.app.getState()).cohortStr,
				usecase: this.opts.usecase,
				treeFilter: this.app.vocabApi.state?.treeFilter,
				...plan.request,
				signal
			})
			if (signal.aborted) return // belt and braces: a reused cached response can still resolve after abort
			const list = buildResultList(this.handlers, data)
			if (!list.length) this.popup.showNoMatch()
			else this.popup.showRows(list, (tr, entry) => renderEntry(tr, entry, this.getHandlerDeps()))
		} catch (e: any) {
			if (signal.aborted) return // superseded: not an error to show
			if (e.stack) console.log(e.stack)
			this.popup.clear()
			this.popup.showError(e)
		}
	}

	private getHandlerDeps(): HandlerDeps {
		return {
			app: this.app,
			launcher: this.launcher,
			popup: this.popup,
			addBubble: arg => this.addBubble(arg)
		}
	}

	/** Add a message bubble. `msg` is html (it may contain hyperlinks) and must already be escaped when it
	 * includes user input. `me`: if 1, the user's side. Returns the bubble so it can be modified. */
	addBubble(arg: { msg: string; me?: number }) {
		const bubble = this.dom.bubbleDiv
			.append('div')
			.style('padding', '10px')
			.html(`${arg.me ? '<span style="font-size:.7em">[ME]</span> ' : ''}${arg.msg}`)
		if (arg.me) bubble.style('background', '#f1f1f1')
		const n = this.dom.bubbleDiv.node()
		n.scrollTop = n.scrollHeight // scroll to bottom
		return bubble
	}

	main() {
		// A hidden subheader means this tab is not visible: don't focus the input (avoids accidental typing)
		// and dismiss the results popup so it doesn't linger over another tab's content. Also cancel any
		// queued or in-flight search so a late result can't reopen the popup over the other tab.
		if (this.opts.subheader.style('display') == 'none') {
			this.debouncedSearch.clear()
			this.searchAbort?.abort()
			this.dom.inputNode.blur()
			this.popup.hide()
			return
		}
		if (this.opts?.focus != 'off') this.dom.inputNode.focus()
	}
}

export const searchInit = getCompInit(MassSearch)
