import { getCompInit, type RxComponent } from '#rx'
import type { MassAppApi } from './types/mass'
import { Menu } from '#dom'
import { keyupEnter } from '#src/client'
import { dofetch3 } from '#common/dofetch'
import type { ChatRequest, ChatResponse } from '#types'
import { sayerror } from '../dom/sayerror.ts'
import { select } from 'd3-selection'
import { fillTermWrapper } from '#termsetting'
import { dtsnvindel, dtcnv, dtsv, dtfusionrna } from '#shared/common.js'
import { getDNAMethUnit } from '#tw/dnaMethylation'
import { first_genetrack_tolist } from '#common/1stGenetk'

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
	hasGeneExp: any
	hasGeneVariant: any
	hasMethylation: any
	geneVariantTypes: any

	constructor(opts: any) {
		this.type = MassAiChatBot.type
		this.opts = opts
		this.app = opts.app
		this.opts.usecase = this.opts.usecase || { target: 'dictionary', detail: 'term' }
		this.opts.targetType = this.opts.targetType ? this.opts.targetType : 'Dictionary Variables'
		this.isChat = this.app.getState().termdbConfig?.queries?.chat // Storing if chat is supported by the dataset for easy access in other methods
		this.hasGeneExp = this.app.getState().termdbConfig?.queries?.geneExpression // Whether the dataset supports gene expression, gating gene search in omnisearch
		this.hasMethylation = this.app.getState().termdbConfig?.queries?.dnaMethylation // Whether the dataset supports DNA methylation, gating methylation gene search in omnisearch
		this.hasGeneVariant = false // Whether the dataset supports gene variant, gating gene search in omnisearch
		if (
			this.app.getState().termdbConfig?.queries?.snvindel ||
			this.app.getState().termdbConfig?.queries?.cnv ||
			this.app.getState().termdbConfig?.queries?.svfusion
		)
			this.hasGeneVariant = true
		// When gene variant is supported, expose a separate option per variant data type, but only
		// for the data types actually defined on the dataset. Each opens a mutated-vs-wildtype
		// barchart restricted to that data type. svfusion maps to two dts (SV and fusion); the dt
		// candidates are tried in order so whichever the dataset actually has is used.
		this.geneVariantTypes = []
		if (this.hasGeneVariant) {
			const queries = this.app.getState().termdbConfig?.queries
			if (queries?.snvindel)
				this.geneVariantTypes.push({ label: 'SNV/indel', testid: 'snvindel', dtCandidates: [dtsnvindel] })
			if (queries?.cnv) this.geneVariantTypes.push({ label: 'CNV', testid: 'cnv', dtCandidates: [dtcnv] })
			if (queries?.svfusion)
				this.geneVariantTypes.push({ label: 'SV/fusion', testid: 'svfusion', dtCandidates: [dtsv, dtfusionrna] })
		}
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
		// Search dictionary variables and (when supported) gene names for gene expression, gene
		// variant, and DNA methylation in parallel. Each gene search returns only when the dataset
		// supports that data type.
		const [data, geneExpressionHits, geneVariantHits, methylationHits] = await Promise.all([
			this.app.vocabApi.findTerm(prompt, cohortStr, this.opts.usecase, this.opts.targetType),
			this.hasGeneExp ? this.app.vocabApi.findGene(prompt).catch(() => []) : Promise.resolve([]),
			this.hasGeneVariant ? this.app.vocabApi.findGeneVariant(prompt).catch(() => []) : Promise.resolve([]),
			this.hasMethylation ? this.app.vocabApi.findMethylationGene(prompt).catch(() => []) : Promise.resolve([])
		])
		if (!Array.isArray(data.lst)) data.lst = []
		// Append matching genes, skipping any whose name already appears among the dictionary results.
		// Gene entries render as a single row per gene with action buttons for the supported data types (expression/variant).
		const dictNames = new Set(data.lst.map((t: any) => t.name?.toUpperCase()))
		// Merge gene hits into one entry per gene, recording which data types (expression/variant/
		// methylation) are available for it. Each gene then renders as a single row whose buttons are
		// the available actions, shown together in the same row.
		const geneMap = new Map<string, any>()
		const addGeneAction = (gene: string, action: 'isGeneExpression' | 'isGeneVariant' | 'isMethylation') => {
			if (dictNames.has(gene.toUpperCase())) return
			const key = gene.toUpperCase()
			let entry = geneMap.get(key)
			if (!entry) {
				entry = { name: gene, gene, isGene: true }
				geneMap.set(key, entry)
			}
			entry[action] = true
		}
		for (const gene of geneExpressionHits) addGeneAction(gene, 'isGeneExpression')
		for (const gene of geneVariantHits) addGeneAction(gene, 'isGeneVariant')
		for (const gene of methylationHits) addGeneAction(gene, 'isMethylation')
		for (const entry of geneMap.values()) data.lst.push(entry)
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
	// value holds `possible_options`. Clicking a box completes the plot state by replacing that
	// field with the chosen option's id and dispatches plot_create.
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
					// Complete the plot state with the chosen option's id and dispatch the plot.
					const config = JSON.parse(JSON.stringify(plot))
					config[fieldKey] = { id: opt.id }
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

	// dispatch a plot and reset the search box/popup
	self.launchPlot = async (config: any) => {
		if (self.state?.nav?.activeTab == 0) {
			await self.app.dispatch({ type: 'tab_set', activeTab: 1 })
		}
		self.app.dispatch({ type: 'plot_create', config })
		self.dom.inputNode.value = '' // clear the search box
		self.clear({ hide: true })
	}

	// open a mutated-vs-wildtype barchart for one gene, restricted to a variant data type.
	// dtCandidates are tried in order (svfusion has two dts) until a matching predefined groupset
	// is found, since fillTermWrapper throws when the dataset lacks a groupset for a given dt.
	self.launchGeneVariantPlot = async (gene: string, dtCandidates: number[]) => {
		let tw: any
		let lastErr: any
		for (const dt of dtCandidates) {
			const candidate: any = {
				term: {
					id: gene,
					name: gene,
					genes: [{ kind: 'gene', id: gene, gene, name: gene, type: 'geneVariant' }],
					type: 'geneVariant'
				},
				q: { type: 'predefined-groupset', dtLst: [dt] }
			}
			try {
				await fillTermWrapper(candidate, self.app.vocabApi)
				tw = candidate
				break
			} catch (e) {
				lastErr = e
			}
		}
		if (!tw) throw lastErr
		await self.launchPlot({ chartType: 'summary', term: tw })
	}

	// DNA methylation: mirror the summary chart's dnaMethylation term search (see
	// client/termdb/handlers/dnaMethylation.ts). Open a genome browser at the gene's default
	// coordinates with a "Submit Region" button; on submit, build a region-based dnaMethylation
	// term from the region the user navigated to and open a violin plot of its per-sample beta values.
	self.launchMethylationPlot = async (gene: string) => {
		const coord = await self.app.vocabApi.getGeneCoord(gene)
		if (!coord) throw `Could not resolve coordinates for gene "${gene}"`
		const genomeObj = self.app.opts.genome

		// render the region picker inline in the chat result area, replacing the result list
		self.dom.tip.clear()
		self.dom.tip.showunder(self.dom.inputNode)
		const holder = self.dom.resultDiv.append('div').style('margin', '10px')
		holder
			.append('div')
			.style('opacity', 0.6)
			.style('margin-bottom', '5px')
			.text(`${gene}: navigate to the desired region`)
		const blockDiv = holder.append('div')

		const arg: any = {
			holder: blockDiv,
			genome: genomeObj,
			chr: coord.chr,
			start: coord.start,
			stop: coord.stop,
			tklst: [],
			nobox: true,
			width: 500,
			hidegenelegend: true
		}
		first_genetrack_tolist(genomeObj, arg.tklst)
		const _ = await import('#src/block')
		const blockInstance = new _.Block(arg)

		holder
			.append('div')
			.style('margin', '10px 0px')
			.append('button')
			.attr('data-testid', 'sjpp-mass-chat-methylation-submit')
			.style('border', 'none')
			.style('border-radius', '20px')
			.style('padding', '10px 15px')
			.style('cursor', 'pointer')
			.text('Submit Region')
			.on('click', async () => {
				const { chr, start, stop } = blockInstance.rglst[0]
				const term = {
					chr,
					start,
					stop,
					type: 'dnaMethylation',
					unit: getDNAMethUnit('region', self.app.vocabApi),
					genomicFeatureType: 'region'
				}
				await self.launchPlot({ chartType: 'summary', term: { term } })
			})
	}

	self.showTerm = function (term: any) {
		const tr = select(this)

		if (term.isGene) {
			// Gene row: gene name as a plain label, with an action button per available data type
			// ('Gene expression', variant types, 'DNA methylation') — all shown together in the same row.
			tr.append('td').text(term.name).style('padding', '5px 10px')
			const btnTd = tr.append('td')
			const addBtn = (label: string, testid: string, onClick: () => Promise<void>) => {
				btnTd
					.append('span')
					.attr('class', 'sja_menuoption')
					.attr('data-testid', testid)
					.style('display', 'inline-block')
					.style('margin', '0px 3px')
					.style('padding', '5px 10px')
					.style('border-radius', '5px')
					.style('cursor', 'pointer')
					.text(label)
					.on('click', () => void onClick().catch(e => sayerror(self.dom.resultDiv, 'Error: ' + (e?.message || e))))
			}
			if (term.isGeneExpression) {
				// open a summary plot of the gene's expression
				addBtn('Gene expression', `sjpp-mass-chat-gene-exp-${term.gene}`, async () => {
					await self.launchPlot({
						chartType: 'summary',
						term: { term: { gene: term.gene, name: term.name, type: 'geneExpression' } }
					})
				})
			}
			if (term.isGeneVariant) {
				// one button per variant data type defined on the dataset (snvindel/cnv/svfusion);
				// each opens a mutated-vs-wildtype barchart restricted to that data type.
				for (const vt of self.geneVariantTypes) {
					addBtn(vt.label, `sjpp-mass-chat-gene-${vt.testid}-${term.gene}`, async () => {
						await self.launchGeneVariantPlot(term.gene, vt.dtCandidates)
					})
				}
			}
			if (term.isMethylation) {
				// open a violin plot of the gene's per-sample DNA methylation beta values
				addBtn('DNA methylation', `sjpp-mass-chat-gene-methylation-${term.gene}`, async () => {
					await self.launchMethylationPlot(term.gene)
				})
			}
			return
		}

		// Dictionary term row
		const button = tr.append('td').text(term.name)
		if (term.type) {
			button
				.style('cursor', 'pointer')
				.attr('class', 'sja_menuoption')
				.attr('data-testid', `sjpp-mass-chat-term-${term.id}`)
				.on('click', async () => {
					await self.launchPlot({
						chartType: term.type == 'survival' ? 'survival' : 'summary',
						term: { term }
					})
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
