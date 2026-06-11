import { getCompInit, type RxComponent } from '#rx'
import type { MassAppApi } from './types/mass'
import { Menu } from '#dom'
import { keyupEnter } from '#src/client'
import { dofetch3 } from '#common/dofetch'
import type { ChatRequest, ChatResponse } from '#types'
import { sayerror } from '../dom/sayerror.ts'
import { select } from 'd3-selection'

const MIN_PROMPT_LENGTH_FOR_OMNISEARCH = 3 // Set a minimum prompt length for omnisearch to trigger
const MAX_PROMPT_LENGTH_FOR_OMNISEARCH = 15 // Set a maximum prompt length for omnisearch to trigger
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
		setRenderers(this) // needed so that this.showTerms, noResult, clear work
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
		this.initDom()
	}

	// Search method, adapted from MassSearch.doSearch
	async doSearch(prompt: string) {
		if (!prompt) {
			this.clear({ hide: true })
			return
		}
		const cohortStr = this.getState(this.app.getState()).cohortStr
		const data = await this.app.vocabApi.findTerm(prompt, cohortStr, this.opts.usecase, this.opts.targetType)
		if (!data.lst || data.lst.length == 0) {
			// Show the "No match..." message one time at the first miss
			if (!this.dom.noMatchShown) {
				this.dom.noMatchShown = true
				this.noResult()
			}
		} else {
			this.dom.noMatchShown = false
			this.showTerms(data)
		}
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

		const inputSel = this.dom.div
			.append('input')
			.attr('type', 'search')
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
			.on('keyup.search', async (event: KeyboardEvent) => {
				if (keyupEnter(event)) return
				const prompt = (event.target as HTMLInputElement).value.trim()
				if (!prompt) {
					this.dom.noMatchShown = false
					this.clear({ hide: true })
					return
				}
				if (MIN_PROMPT_LENGTH_FOR_OMNISEARCH <= prompt.length && prompt.length <= MAX_PROMPT_LENGTH_FOR_OMNISEARCH) {
					//console.log(
					//	`User prompt: "${prompt}", cohortStr: "${cohortStr}", usecase: "${this.opts.usecase}", targetType: "${this.opts.targetType}"`
					//)
					try {
						await this.doSearch(prompt) // Search as user types
					} catch (e: any) {
						if (e.stack) console.log(e.stack)
						sayerror(this.dom.resultDiv, 'Error: ' + (e.message || e))
					}
				} else {
					this.dom.noMatchShown = false
					this.clear({ hide: true })
					return
				}
			})
			.on('keyup.submit', async (event: any) => {
				if (!keyupEnter(event)) return
				if (!this.isChat) {
					// Prevents unnecessary server side call when chat not supported by ds
					return
				}
				const prompt = event.target.value.trim()
				if (!prompt) return
				const serverBubble = this.addBubble({ msg: '...' })
				this.addBubble({ msg: prompt, me: 1 })
				event.target.value = ''
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
						this.app.dispatch({
							type: 'plot_create',
							config: result.plot
						})
						serverBubble.text(`${result.msg ? result.msg + '. ' : ''}Please refer to the plot generated below.`)
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

	main() {
		// If the subheader is hidden, it means the chat component is not visible, so we skip focusing the input to avoid accidental typing into the search/chat bar. The user can click on the chat again to focus when they want to use it.
		if (this.opts.subheader.style('display') == 'none') {
			this.dom.inputNode.blur()
			return
		}
		if (this.opts?.focus != 'off') this.dom.inputNode.focus()
	}
}

export const chatInit = getCompInit(MassAiChatBot)

// Minimal renderers ported from MassSearch
function setRenderers(self: any) {
	let text = 'No match'
	if (self.isChat) {
		text = 'No match. Using the chatbot...'
	}
	self.noResult = () => {
		self.clear()
		self.dom.resultDiv.append('div').text(text).style('padding', '3px 3px 3px 0px').style('opacity', 0.5)

		// Hide the popup after 2 seconds
		setTimeout(() => {
			self.clear({ hide: true })
		}, 1500)
	}

	self.showTerms = (data: any) => {
		if (self.opts.disable_terms)
			data.lst.forEach((t: any) => {
				if (t.disabled) self.opts.disable_terms.push(t)
			})
		self.clear({ hide: !data.lst.length })
		if (data.lst.length) {
			self.dom.resultDiv.append('table').selectAll().data(data.lst).enter().append('tr').each(self.showTerm)
		}
	}

	self.showTerm = function (term: any) {
		const tr = select(this)
		const button = tr.append('td').text(term.name)

		if (term.type) {
			button
				.style('cursor', 'pointer')
				.attr('class', 'sja_menuoption')
				.attr('data-testid', `sjpp-mass-chat-term-${term.id}`)
				.on('click', async () => {
					if (self.state?.nav?.activeTab == 0) {
						await self.app.dispatch({ type: 'tab_set', activeTab: 1 })
					}
					self.app.dispatch({
						type: 'plot_create',
						config: {
							chartType: term.type == 'survival' ? 'survival' : 'summary',
							term: { term }
						}
					})
					self.dom.inputNode.value = '' // clear the search box
					self.clear({ hide: true })
				})
		} else {
			button.style('padding', '5px 10px').style('opacity', 0.5)
		}

		tr.append('td')
			.text((term.__ancestorNames || []).join(' > '))
			.style('opacity', 0.5)
			.style('font-size', '.7em')
	}

	self.clear = (opts: any = {}) => {
		self.dom.tip.clear()
		if (opts.hide) self.dom.tip.hide()
		else self.dom.tip.showunder(self.dom.inputNode)
	}
}
