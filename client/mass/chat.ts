import { getCompInit, type RxComponent } from '#rx'
import type { MassAppApi } from './types/mass'
import { Menu } from '#dom'
import { select } from 'd3-selection'
import { keyupEnter } from '#src/client'
import { dofetch3 } from '#common/dofetch'
import type { ChatRequest, ChatResponse } from '#types'
// Mass omnisearch (search-as-you-type) lives in ./search.ts; this file owns the AI-chat path and the
// shared DOM scaffold (the input + result popup + chat bubbles).
import { setSearchRenderers, handleOmnisearchKeyup } from './search.ts'

const MIN_PROMPT_LENGTH_FOR_CHAT = 5 // Set a minimum prompt length for chat submission

class MassAiChatBot implements RxComponent {
	static type = 'chat'
	type: string
	opts: any
	app: MassAppApi
	dom!: any
	state: any
	id!: string
	clear: any
	showTerms: any
	noResult: any
	isChat: any

	constructor(opts: any) {
		this.type = MassAiChatBot.type
		this.opts = opts
		this.app = opts.app
		this.opts.usecase = this.opts.usecase || { target: 'dictionary', detail: 'term' }
		this.opts.targetType = this.opts.targetType ? this.opts.targetType : 'Dictionary Variables'
		this.isChat = this.app.getState().termdbConfig?.queries?.chat // Storing if chat is supported by the dataset for easy access in other methods
		setSearchRenderers(this) // sets omnisearch renderers (showTerms, noResult, clear, showTerm, launchers) on this
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
		// Note: no server-side request here — the omnisearch resolves dictionary terms, genes, and the
		// dataset's gene data types together in a single request per search (see doSearch in search.ts), so
		// nothing is fetched eagerly at component init.
		this.initDom()
	}

	initDom() {
		//const cohortStr = this.getState(appState).cohortStr
		let text = 'Search an item'
		let height = '1px' // No white space needed for search only
		if (this.isChat) {
			text = 'Ask a question'
			height = '200px'
		}
		this.dom = {
			tip: new Menu({ padding: '5px' }),
			div: this.opts.subheader,
			error: this.opts.subheader.append('div').attr('id', 'sjpp-corrVolcano-error').style('opacity', 0.75),
			bubbleDiv: this.opts.subheader
				.append('div')
				.attr('class', 'sjpp_show_scrollbar')
				.style('margin', '5px 20px 0px 20px')
				.style('height', height)
				.style('overflow', 'auto')
				.style('scroll-behavior', 'smooth')
		}

		// Keep the omnisearch results popup open when the user clicks outside it. The Menu default hides on
		// any outside mousedown (see menu.js), which made the results vanish on an incidental click; the
		// omnisearch popup is instead dismissed explicitly — when the input is cleared, a result is
		// selected, or a new search renders. Remove only this tip's body-level outside-click hide listener.
		select(document.body).on('mousedown.menu' + this.dom.tip.typename, null)

		const inputSel = this.dom.div
			.append('input')
			.attr('type', 'search')
			.attr('data-testid', 'sjpp-mass-omnisearch-input')
			.style('margin', '15px')
			.style('padding', '17px')
			.style('border-radius', '34px')
			.attr('size', 70)
			.attr('placeholder', text)

		// Store the input node so the search result tip can position under it
		this.dom.inputNode = inputSel.node()

		// Result panel inside the tip, mirroring MassSearch.initUI
		this.dom.resultDiv = this.dom.tip.d
			.style('border-left', 'solid 1px rgb(133,182,225)')
			.style('padding-left', '5px')
			.attr('tabindex', -1)

		inputSel
			// omnisearch (search-as-you-type) — handler lives in ./search.ts
			.on('keyup.search', (event: KeyboardEvent) => handleOmnisearchKeyup(this, event))
			.on('keyup.submit', async (event: any) => {
				if (!keyupEnter(event)) return
				if (!this.isChat) {
					// Prevents unnecessary server side call when chat not supported by ds
					return
				}
				const prompt = event.target.value.trim()
				if (!prompt) return
				this.addBubble({ msg: escapeHtml(prompt), me: 1 })
				event.target.value = ''
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
						// Determine if plot state is complete or not. A field whose value carries a
						// `possible_options` array means the server could not resolve that term and
						// is offering the user a choice. If found, show click boxes; otherwise the
						// plot state is complete and can be dispatched directly.
						const optionField = findPossibleOptionsField(result.plot)
						if (optionField) {
							this.showPossibleOptions(serverBubble, result.plot, optionField, result.msg)
						} else {
							this.app.dispatch({
								type: 'plot_create',
								config: result.plot
							})
							serverBubble.text(`${result.msg ? result.msg + '. ' : ''}Please refer to the plot generated below.`)
						}
					}
				} catch (e: any) {
					if (e.stack) console.log(e.stack)
					serverBubble.html(`Error: ${e.message || e}`)
				}
			})
			.node()
			.focus()
	}

	addBubble(arg: { msg: string; me?: number }) {
		/** {
msg: add a chat bubble for this msg; msg is html as it might contain hyperlinks
me: if 1, is me; otherwise is ai
}
return the created bubble and allow to be modified
*/
		const bubble = this.dom.bubbleDiv
			.append('div')
			.style('padding', '10px')
			.html(`${arg.me ? '<span style="font-size:.7em">[ME]</span> ' : ''}${arg.msg}`)
		if (arg.me) bubble.style('background', '#f1f1f1')
		// set this to scroll to bottom
		const n = this.dom.bubbleDiv.node()
		n.scrollTop = n.scrollHeight
		return bubble
	}

	// Render click boxes for an incomplete plot state. `fieldKey` is the field of `plot` whose
	// value holds `possible_options`. Clicking a box completes the plot state and dispatches plot_create.
	// Each option completes the plot in one of two ways:
	//  - opt.config: a config patch merged into the plot (the incomplete field is dropped). Used when the
	//    choice sets other fields, e.g. the genome browser view sets blockIsProteinMode: true|false.
	//  - otherwise: the incomplete field is set to { id: opt.id }, e.g. survival term selection -> term:{id}.
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
					// Complete the plot state and dispatch the plot. An option may carry a `config` patch
					// (merged into the plot, dropping the incomplete field — e.g. the genome browser view sets
					// blockIsProteinMode); otherwise complete the incomplete field with the chosen option's id.
					const config = JSON.parse(JSON.stringify(plot))
					if (opt.config) {
						delete config[fieldKey]
						Object.assign(config, opt.config)
					} else {
						config[fieldKey] = { id: opt.id }
					}
					this.app.dispatch({
						type: 'plot_create',
						config
					})
					bubble.selectAll('*').remove()
					bubble.text(`Selected "${opt.name}". Please refer to the plot generated below.`)
				})
		}
	}

	main() {
		// If the subheader is hidden, it means the chat component is not visible, so we skip focusing the input to avoid accidental typing into the search/chat bar. The user can click on the chat again to focus when they want to use it.
		if (this.opts.subheader.style('display') == 'none') {
			this.dom.inputNode.blur()
			// hide the omnisearch results popup when leaving the tab; it no longer auto-hides on outside
			// click (see initDom), so dismiss it here to avoid it lingering over another tab's content
			this.dom.tip.hide()
			return
		}
		if (this.opts?.focus != 'off') this.dom.inputNode.focus()
	}
}

export const chatInit = getCompInit(MassAiChatBot)

// Prevents HTML/script injection in the chat UI (XSS) by entering markup in the prompt (Proposed fix by copilot)
function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}

// Scan a plot state for a field whose value carries a `possible_options` array, indicating the
// server could not resolve that term and is offering the user a list of choices. Returns the field
// name (e.g. 'term') or null if the plot state is complete.
function findPossibleOptionsField(plot: any): string | null {
	if (!plot || typeof plot !== 'object') return null
	for (const key of Object.keys(plot)) {
		const val = plot[key]
		if (val && typeof val === 'object' && Array.isArray(val.possible_options)) return key
	}
	return null
}
