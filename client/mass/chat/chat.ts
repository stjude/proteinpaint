import { escapeHtml } from '#dom'
import { getCompInit, type RxComponent } from '#rx'
import { keyupEnter } from '#src/client'
import { dofetch3 } from '#common/dofetch'
import type { ChatRequest, ChatResponse } from '#types'
import type { MassAppApi } from '../types/mass'
import { buildCapabilities, describeSearchable } from './registry.ts'
import { buildResultRows } from './rows.ts'
import { planSearch, fetchOmnisearch, SEARCH_DEBOUNCE_MS, type SearchPlan } from './search.ts'
import { debounce } from 'debounce'
import { ResultsPopup } from './popup.ts'
import { Launcher } from './launcher.ts'
import { renderRow, type RenderDeps } from './renderers.ts'

const MIN_PROMPT_LENGTH_FOR_CHAT = 5 // Set a minimum prompt length for chat submission

/** The mass SEARCH / CHAT tab: a search-as-you-type omnisearch (dictionary variables, genes, samples,
 * genomic regions) that launches plots, plus, when the dataset supports it, an AI chat.
 * Module map: search.ts (what to search + server call), rows.ts (server data -> rows), registry.ts
 * (dataset capabilities, built once in init), renderers.ts (rows -> DOM), popup.ts (results popup),
 * launcher.ts (what the buttons do). */
class MassAiChatBot implements RxComponent {
	static type = 'chat'
	type: string
	opts: any
	app: MassAppApi
	dom!: any
	state: any
	id!: string
	/** dataset capabilities, built once in init() */
	caps!: ReturnType<typeof buildCapabilities>
	popup!: ResultsPopup
	launcher!: Launcher
	/** aborts the in-flight omnisearch request when a newer search, or a clear, supersedes it */
	private searchAbort?: AbortController

	constructor(opts: any) {
		this.type = MassAiChatBot.type
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
			nav: appState.nav
		}
	}

	async init() {
		// No server request here: each search resolves dictionary terms, genes, samples and a typed coordinate
		// in a single request. Everything that depends only on the dataset is decided once, here.
		this.caps = buildCapabilities(this.app.getState().termdbConfig)
		this.initDom()
	}

	initDom() {
		const subheader = this.opts.subheader
		this.dom = {
			bubbleDiv: subheader
				.append('div')
				.attr('class', 'sjpp_show_scrollbar')
				.style('margin', '5px 20px 0px 20px')
				// no white space needed for search only; grows to fit the selected gene's action buttons
				.style('height', this.caps.isChat ? '200px' : 'auto')
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
			.attr('placeholder', this.caps.isChat ? 'Ask a question' : 'Search an item')
		this.dom.inputNode = inputSel.node()

		// tells the user what can be searched; generated from the same capabilities that gate the search
		subheader
			.append('div')
			.attr('data-testid', 'sjpp-mass-omnisearch-searchable')
			.style('margin', '-5px 20px 10px 20px')
			.style('font-size', '.8em')
			.style('opacity', 0.6)
			.text(describeSearchable(this.caps.searchable))

		this.popup = new ResultsPopup(this.dom.inputNode, {
			noMatchText: this.caps.isChat ? 'No match. Using the chatbot...' : 'No match'
		})
		this.launcher = new Launcher({
			app: this.app,
			popup: this.popup,
			getActiveTab: () => this.state?.nav?.activeTab
		})

		const debouncedSearch = debounce((plan: SearchPlan) => void this.runSearch(plan), SEARCH_DEBOUNCE_MS)

		inputSel
			// search-as-you-type: debounced; never searches samples
			.on('keyup.search', (event: KeyboardEvent) => {
				if (keyupEnter(event)) return
				const plan = planSearch((event.target as HTMLInputElement).value, { enter: false })
				if (!plan) {
					debouncedSearch.clear()
					this.searchAbort?.abort() // drop any in-flight request for text that is no longer there
					this.popup.hide()
					return
				}
				debouncedSearch(plan)
			})
			.on('keyup.submit', async (event: KeyboardEvent) => {
				if (!keyupEnter(event)) return
				const value = (event.target as HTMLInputElement).value
				if (this.caps.isChat) return void (await this.submitChat(value.trim()))
				// search-only: Enter runs the full search immediately, including samples
				debouncedSearch.clear()
				const plan = planSearch(value, { enter: true })
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
				coordCandidates: plan.coordCandidates,
				includeDict: plan.includeDict,
				includeSamples: plan.includeSamples,
				signal
			})
			if (signal.aborted) return // belt and braces: a reused cached response can still resolve after abort
			const rows = buildResultRows(data)
			if (!rows.length) this.popup.showNoMatch()
			else this.popup.showRows(rows, (tr, row) => renderRow(tr, row, this.getRenderDeps()))
		} catch (e: any) {
			if (signal.aborted) return // superseded: not an error to show
			if (e.stack) console.log(e.stack)
			this.popup.clear()
			this.popup.showError(e)
		}
	}

	private getRenderDeps(): RenderDeps {
		return {
			caps: this.caps,
			launcher: this.launcher,
			popup: this.popup,
			addBubble: arg => this.addBubble(arg)
		}
	}

	async submitChat(prompt: string) {
		if (!prompt) return
		this.addBubble({ msg: escapeHtml(prompt), me: 1 })
		this.dom.inputNode.value = ''
		const serverBubble = this.addBubble({ msg: '...' }) // Keep server bubble always below prompt bubble so that responses are below the prompt always
		if (prompt.length <= MIN_PROMPT_LENGTH_FOR_CHAT) {
			serverBubble.text('Your prompt is too short. Enter a longer prompt.')
			return
		}
		const body: ChatRequest = {
			genome: this.app.vocabApi.vocab.genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			filter: this.app.vocabApi.state.termfilter?.filter,
			prompt
		}
		try {
			const data = await dofetch3('termdb/chat', { body })
			if (data.error) throw data.error

			const result: ChatResponse = data
			if (result.type === 'text') {
				serverBubble.text(result.text)
			} else if (result.type === 'html') {
				serverBubble.html(result.html)
			} else if (result.type === 'plot') {
				// A field whose value carries a `possible_options` array means the server could not resolve
				// that term and is offering the user a choice: show click boxes. Otherwise the plot state is
				// complete and can be dispatched directly.
				const optionField = findPossibleOptionsField(result.plot)
				if (optionField) {
					this.showPossibleOptions(serverBubble, result.plot, optionField, result.msg)
				} else {
					this.app.dispatch({ type: 'plot_create', config: result.plot })
					serverBubble.text(`${result.msg ? result.msg + '. ' : ''}Please refer to the plot generated below.`)
				}
			}
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			serverBubble.html(`Error: ${escapeHtml(String(e.message || e))}`)
		}
	}

	/** Add a chat bubble. `msg` is html (it may contain hyperlinks) and must already be escaped when it
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

	/** Render click boxes for an incomplete plot state. `fieldKey` is the field of `plot` whose value holds
	 * `possible_options`. Clicking a box completes the plot state and dispatches plot_create. An option
	 * completes the plot in one of two ways:
	 *  - opt.config: a config patch merged into the plot (the incomplete field is dropped), e.g. the genome
	 *    browser view sets blockIsProteinMode
	 *  - otherwise: the incomplete field is set to { id: opt.id }, e.g. survival term selection -> term:{id} */
	showPossibleOptions(bubble: any, plot: any, fieldKey: string, msg?: string) {
		const options = plot[fieldKey].possible_options || []
		bubble.text(`${msg ? msg + '. ' : ''}Multiple options are available. Please select one:`)
		const boxDiv = bubble.append('div').style('margin-top', '5px')
		for (const opt of options) {
			boxDiv
				.append('div')
				.attr('class', 'sja_menuoption')
				.attr('data-testid', `sjpp-mass-chat-option-${opt.id}`)
				.style('display', 'inline-block')
				.style('margin', '3px')
				.style('padding', '5px 10px')
				.style('border-radius', '5px')
				.style('cursor', 'pointer')
				.text(opt.name)
				.on('click', () => {
					const config = JSON.parse(JSON.stringify(plot))
					if (opt.config) {
						delete config[fieldKey]
						Object.assign(config, opt.config)
					} else {
						config[fieldKey] = { id: opt.id }
					}
					this.app.dispatch({ type: 'plot_create', config })
					bubble.selectAll('*').remove()
					bubble.text(`Selected "${opt.name}". Please refer to the plot generated below.`)
				})
		}
	}

	main() {
		// A hidden subheader means this tab is not visible: don't focus the input (avoids accidental typing)
		// and dismiss the results popup so it doesn't linger over another tab's content.
		if (this.opts.subheader.style('display') == 'none') {
			this.dom.inputNode.blur()
			this.popup.hide()
			return
		}
		if (this.opts?.focus != 'off') this.dom.inputNode.focus()
	}
}

export const chatInit = getCompInit(MassAiChatBot)

/** Scan a plot state for a field whose value carries a `possible_options` array, indicating the server
 * could not resolve that term and is offering the user a list of choices. Returns the field name (e.g.
 * 'term') or null if the plot state is complete. */
export function findPossibleOptionsField(plot: any): string | null {
	if (!plot || typeof plot !== 'object') return null
	for (const key of Object.keys(plot)) {
		const val = plot[key]
		if (val && typeof val === 'object' && Array.isArray(val.possible_options)) return key
	}
	return null
}
