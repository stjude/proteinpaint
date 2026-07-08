import { getCompInit, type RxComponent } from '#rx'
import type { MassAppApi } from './types/mass'
import { Menu } from '#dom'
import { keyupEnter } from '#src/client'
import { dofetch3 } from '#common/dofetch'
import type { ChatRequest, ChatResponse, OmnisearchResult } from '#types'
import { sayerror } from '../dom/sayerror.ts'
import { select } from 'd3-selection'
import { fillTermWrapper } from '#termsetting'
import { dtsnvindel, dtcnv, dtsv, dtfusionrna, string2pos } from '#shared/common.js'
import { DNA_METHYLATION } from '#shared/terms.js'
import { getDNAMethUnit } from '#tw/dnaMethylation'
import { first_genetrack_tolist } from '#common/1stGenetk'

const MIN_PROMPT_LENGTH_FOR_OMNISEARCH = 3 // Set a minimum prompt length for omnisearch to trigger
// Max prompt length for omnisearch to trigger. Sized to accommodate typed genomic coordinate ranges
// (handled in doSearch), e.g. "chr7:100000-200000" (18 chars) or larger loci like
// "chr16:100000000-200000000" (25 chars); gene/dictionary names are well within this.
const MAX_PROMPT_LENGTH_FOR_OMNISEARCH = 35
const MIN_PROMPT_LENGTH_FOR_CHAT = 5 // Set a minimum prompt length for chat submission

/** Build a region-based dnaMethylation term for the given coordinates. */
function makeMethylationRegionTerm(opts: { chr: string; start: number; stop: number }, vocabApi: any) {
	const { chr, start, stop } = opts
	if (!chr || !Number.isInteger(start) || !Number.isInteger(stop)) throw new Error('invalid coordinate')
	return {
		chr,
		start,
		stop,
		type: DNA_METHYLATION,
		unit: getDNAMethUnit('region', vocabApi),
		genomicFeatureType: 'region'
	}
}

/**
 * Embed a genome browser of a gene/region into `holder` with a "Submit Region" button. On submit,
 * builds a region-based dnaMethylation term from the region the user navigated to and passes it to
 * `callback`. Returns the Block instance. Used by the mass omnisearch to open a methylation region
 * picker for a gene. (The dnaMethylation search handler keeps its own equivalent inline logic.)
 */
async function embedMethylationRegionPicker(opts: {
	holder: any
	genomeObj: any
	vocabApi: any
	chr: string
	start: number
	stop: number
	callback: (term: any) => void | Promise<void>
	debug?: boolean
}) {
	const { holder, genomeObj, vocabApi, chr, start, stop, callback } = opts
	if (!chr || !Number.isInteger(start) || !Number.isInteger(stop)) throw new Error('unable to retrieve gene coordinate')

	holder.selectAll('*').remove()
	holder.style('display', 'block')
	holder.append('div').style('opacity', 0.6).text('Navigate genome browser to desired region')

	const arg: any = {
		holder,
		genome: genomeObj, // genome obj
		chr,
		start,
		stop,
		tklst: [],
		nobox: true,
		width: 500,
		hidegenelegend: true,
		debugmode: opts.debug
	}
	first_genetrack_tolist(genomeObj, arg.tklst)
	const _ = await import('#src/block')
	const blockInstance = new _.Block(arg)

	holder
		.append('div')
		.attr('data-testid', 'sjpp-dnaMethylation-submitDiv')
		.style('margin', '10px 0px')
		.append('button')
		.style('border', 'none')
		.style('border-radius', '20px')
		.style('padding', '10px 15px')
		.text('Submit Region')
		.on('click', async () => {
			const { chr, start, stop } = blockInstance.rglst[0]
			await callback(makeMethylationRegionTerm({ chr, start, stop }, vocabApi))
		})

	return blockInstance
}

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

	/** True when the dataset supports opening the genome browser in genomic view (needed for typed coordinates). */
	datasetHasGenomeBrowser(): boolean {
		const q = this.app.getState().termdbConfig?.queries
		if (!q || !(q.snvindel || q.cnv || q.svfusion)) return false
		// protein-restricted datasets do not allow coordinate-based (genomic) view
		return q.gbRestrictMode !== 'protein'
	}

	async init() {
		// Note: no server-side request here — the omnisearch resolves dictionary terms, genes, and the
		// dataset's gene data types together in a single request per search (see doSearch), so nothing is
		// fetched eagerly at component init.
		this.initDom()
	}

	// Search method, adapted from MassSearch.doSearch
	async doSearch(prompt: string) {
		if (!prompt) {
			this.clear({ hide: true })
			return
		}
		const cohortStr = this.getState(this.app.getState()).cohortStr
		// Genomic coordinate typed as the prompt (e.g. "chr7:100000-200000" or "7:100000-200000") is
		// treated as another searchable data type, alongside dictionary terms and genes: when the dataset
		// has genomic-alteration data (snvindel/cnv/svfusion) and the prompt is a valid coordinate range,
		// a coordinate result is added below whose "Genome Browser" button opens the genomic view. Parsed
		// client-side (no server round trip); a coordinate never matches a gene/dictionary term.
		const coord = this.datasetHasGenomeBrowser() ? parseGenomicCoord(prompt, this.app.opts.genome) : null
		// Single server request that searches genomic coordinates, dictionary variables and genes together, and reports the
		// dataset's gene data types. The server (termdb/chat, runOmnisearch) does the gene lookup for the
		// search results, so the client does not need an extra genelookup request during omnisearch.
		const data: OmnisearchResult = await dofetch3('termdb/chat', {
			body: {
				genome: this.app.vocabApi.vocab.genome,
				dslabel: this.app.vocabApi.vocab.dslabel,
				omnisearch: true,
				prompt,
				cohortStr,
				usecase: this.opts.usecase,
				treeFilter: this.app.vocabApi.state?.treeFilter
			}
		})
		if (data.error) throw data.error
		const lst: any[] = Array.isArray(data.dictionaryTerms) ? data.dictionaryTerms : []
		// Each gene match carries its own available data types (a gene may have e.g. SNV/indel while
		// another does not), so action buttons are decided per gene rather than dataset-wide.
		const genes: { gene: string; dataTypes: any; coord?: any }[] = Array.isArray(data.genes) ? data.genes : []

		// Build one entry per gene, skipping any whose name already appears among the dictionary results.
		// Each gene renders as a single row whose buttons are the actions available for that gene, and
		// its own per-variant-type options (SNV/indel, CNV, SV/fusion) are attached for showTerm to use.
		const dictNames = new Set(lst.map((t: any) => t.name?.toUpperCase()))
		const geneMap = new Map<string, any>()
		for (const g of genes) {
			const gene = g?.gene
			if (!gene || dictNames.has(gene.toUpperCase())) continue
			const dt = g.dataTypes || {}
			// per-gene variant sub-type buttons; svfusion maps to two dts (SV and fusion), tried in order
			const geneVariantTypes: any[] = []
			if (dt.snvindel) geneVariantTypes.push({ label: 'SNV/indel', testid: 'snvindel', dtCandidates: [dtsnvindel] })
			if (dt.cnv) geneVariantTypes.push({ label: 'CNV', testid: 'cnv', dtCandidates: [dtcnv] })
			if (dt.svfusion)
				geneVariantTypes.push({ label: 'SV/fusion', testid: 'svfusion', dtCandidates: [dtsv, dtfusionrna] })
			const entry: any = { name: gene, gene, isGene: true }
			if (dt.geneExpression) entry.isGeneExpression = true
			if (geneVariantTypes.length) {
				entry.isGeneVariant = true
				entry.geneVariantTypes = geneVariantTypes
			}
			// genome browser is offered whenever any genomic-alteration data type (snvindel/cnv/svfusion)
			// is available for this gene; the browser's mds3 track renders all available types together
			if (dt.genomeBrowser) {
				entry.isGenomeBrowser = true
				// server-resolved default coordinate, used to seed the genome browser's genomic view
				entry.coord = g.coord
			}
			if (dt.dnaMethylation) {
				entry.isMethylation = true
				// server-resolved default coordinate, used to seed the genome browser region picker
				entry.coord = g.coord
			}
			// only list a gene if it has at least one available data type / action
			if (entry.isGeneExpression || entry.isGeneVariant || entry.isGenomeBrowser || entry.isMethylation) {
				geneMap.set(gene.toUpperCase(), entry)
			}
		}
		for (const entry of geneMap.values()) lst.push(entry)
		// Add the genomic coordinate as its own result entry (like a gene entry), rendered by showTerm
		if (coord) {
			lst.push({
				isCoord: true,
				name: `${coord.chr}:${coord.start.toLocaleString()}-${coord.stop.toLocaleString()}`,
				coord
			})
		}
		if (!lst.length) {
			// Show the "No match..." message one time at the first miss
			if (!this.dom.noMatchShown) {
				this.dom.noMatchShown = true
				this.noResult()
			}
		} else {
			this.dom.noMatchShown = false
			this.showTerms({ lst })
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
			return
		}
		if (this.opts?.focus != 'off') this.dom.inputNode.focus()
	}
}

export const chatInit = getCompInit(MassAiChatBot)

// Parse a genomic coordinate RANGE typed into the omnisearch box (e.g. "chr7:100000-200000", or with
// the "chr" prefix omitted, "7:100000-200000") into { chr, start, stop }, or null if the input is not
// such a range. Requires the chr:start-stop form (a bare chr name or single position is intentionally
// ignored so partial typing doesn't prematurely trigger the genome browser). Final validation
// (chromosome exists, positions in range) is delegated to string2pos(), which returns null on invalid input.
function parseGenomicCoord(str: string, genome: any): { chr: string; start: number; stop: number } | null {
	if (!genome) return null
	// Cheap SHAPE pre-filter + capture: bail out unless the text looks like a "chr:start-stop" range, so
	// we only call string2pos() (and only trigger the genome browser) for range-like input. This checks
	// form only — chromosome existence and position validity are left to string2pos() below. The three
	// capture groups are the chromosome token, start, and stop.
	// Regex breakdown: ^ \s*        optional leading spaces
	//                  (\w+)       chromosome token (letters/digits/_), e.g. "chr7", "7", "chrX", "X"
	//                  \s* : \s*   a colon separator, optional spaces around it
	//                  ([\d,]+)    start position, digits with optional thousands commas, e.g. "100,000"
	//                  \s* - \s*   a dash separator, optional spaces around it
	//                  ([\d,]+)    stop position
	//                  \s* $       optional trailing spaces, end of string
	// Matches (→ passes to string2pos): "chr7:100000-200000", "chr7: 100000-200000",
	//                                    "chr7:100,000-200,000", "chrX:5000-6000", "7:100000-200000"
	// Rejected here (→ returns null, falls through to normal search): "chr7" (bare chr),
	//                "chr7:1000" (single position, no dash), "BRCA1" (gene name), "" (empty)
	// Note: shape-valid but semantically bad input like "chr7:200000-100000" (start>stop) or
	//       "chr99:1-2" (no such chromosome) passes this test but is rejected later by string2pos().
	const m = /^\s*(\w+)\s*:\s*([\d,]+)\s*-\s*([\d,]+)\s*$/.exec(str)
	if (!m) return null
	const [, chrToken, start, stop] = m
	// The genome's chrlookup is keyed by its canonical chromosome names (e.g. "chr7"). Accept input with
	// the "chr" prefix omitted (e.g. "7:100000-200000") by also trying the toggled form: add "chr" when
	// missing, or strip it when present. Whichever the genome actually knows resolves via string2pos();
	// the other candidate simply returns null. e.g. "7" -> try "7" then "chr7"; "chr7" -> try "chr7" then "7".
	const chrCandidates = /^chr/i.test(chrToken)
		? [chrToken, chrToken.replace(/^chr/i, '')]
		: [chrToken, 'chr' + chrToken]
	for (const chr of chrCandidates) {
		try {
			const pos = string2pos(`${chr}:${start}-${stop}`, genome, true)
			if (pos) return { chr: pos.chr, start: pos.start, stop: pos.stop }
		} catch {
			// try the next chromosome-name candidate
		}
	}
	return null
}

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

	// Open the genome browser as a separate mass chart (chartType 'genomeBrowser') with full plot state,
	// via launchPlot -> plot_create. The plot's mds3 track renders the dataset's SNV/indel, CNV and
	// SV/fusion data (whichever it has).
	// - 'protein': gene/protein view, seeded by gene symbol (blockIsProteinMode=true)
	// - 'genomic': genomic view over a region (chr/start/stop) from opts.coord (blockIsProteinMode=false)
	//   — used both for a gene's locus and for a coordinate typed into the omnisearch box
	// blockIsProteinMode is set explicitly so each view opens as named regardless of the dataset's
	// default gbRestrictMode. launchPlot() dispatches plot_create and closes the search popup.
	self.launchGenomeBrowserView = async (
		mode: 'protein' | 'genomic',
		opts: { gene?: string; coord?: { chr: string; start: number; stop: number } }
	) => {
		if (mode == 'protein') {
			if (!opts.gene) throw new Error('gene symbol required for protein view')
			await self.launchPlot({
				chartType: 'genomeBrowser',
				geneSearchResult: { geneSymbol: opts.gene },
				blockIsProteinMode: true
			})
			return
		}
		if (!opts.coord) throw new Error('coordinate required for genomic view')
		await self.launchPlot({
			chartType: 'genomeBrowser',
			geneSearchResult: { chr: opts.coord.chr, start: opts.coord.start, stop: opts.coord.stop },
			blockIsProteinMode: false
		})
	}

	// "Genome Browser": open a chooser popup offering protein vs genomic view of the gene; picking a view
	// opens the genome browser as a separate mass chart with plot state (see launchGenomeBrowserView).
	// The two buttons and the protein/genomic decision mirror the genome browser's
	// GeneSearchRenderer.renderGeneSearch (which shows the same "Protein view of <gene>" / "Genomic view
	// of <gene>" buttons on an interactive gene search); here they live in the omnisearch popup since the
	// omnisearch already resolved the gene. A mode-restricted dataset (gbRestrictMode) skips the chooser
	// and opens its one allowed view directly.
	self.launchGenomeBrowser = async (gene: string, coord?: { chr: string; start: number; stop: number }) => {
		const gbRestrictMode = self.app.getState().termdbConfig?.queries?.gbRestrictMode
		if (gbRestrictMode == 'protein') {
			await self.launchGenomeBrowserView('protein', { gene })
			return
		}
		if (gbRestrictMode == 'genomic') {
			let c = coord
			if (!c) {
				const def = self.app.getState().termdbConfig?.queries?.defaultCoord
				const pos = def ? string2pos(def, self.app.opts.genome, true) : null
				if (pos) c = { chr: pos.chr, start: pos.start, stop: pos.stop }
			}
			if (!c) throw new Error(`Unable to resolve coordinates for "${gene}" and no defaultCoord is configured`)
			await self.launchGenomeBrowserView('genomic', { coord: c })
			return
		}

		// both views allowed: show the two view buttons; clicking opens the browser chart in that view
		self.dom.tip.clear()
		self.dom.tip.showunder(self.dom.inputNode)
		const holder = self.dom.resultDiv.append('div').style('margin', '10px')
		holder.append('div').style('margin-bottom', '5px').text(gene)
		const btndiv = holder.append('div')
		const addViewBtn = (label: string, testid: string, mode: 'protein' | 'genomic') => {
			btndiv
				.append('button')
				.attr('data-testid', testid)
				.style('margin-right', '10px')
				.text(label)
				.on(
					'click',
					() =>
						void self
							.launchGenomeBrowserView(mode, { gene, coord })
							.catch(e => sayerror(self.dom.resultDiv, 'Error: ' + (e?.message || e)))
				)
		}
		addViewBtn(`Protein view of ${gene}`, `sjpp-mass-chat-gb-protein-${gene}`, 'protein')
		// genomic view needs a coordinate; omit the button if the gene could not be resolved to one
		if (coord) addViewBtn(`Genomic view of ${gene}`, `sjpp-mass-chat-gb-genomic-${gene}`, 'genomic')
	}

	// DNA methylation: open a genome browser at the gene's default coordinates inline in the result
	// area with a "Submit Region" button (see embedMethylationRegionPicker above); on submit, open a
	// violin plot of the region-based dnaMethylation term's per-sample beta values.
	self.launchMethylationPlot = async (gene: string, coord: { chr: string; start: number; stop: number }) => {
		// coord is the gene's default genomic coordinate, resolved server-side by the omnisearch
		// (GeneMatch.coord) and used to seed the genome browser track — no genelookup request here.
		if (!coord) throw `Could not resolve coordinates for gene "${gene}"`

		// render the region picker inline in the chat result area, replacing the result list
		self.dom.tip.clear()
		self.dom.tip.showunder(self.dom.inputNode)
		const holder = self.dom.resultDiv.append('div').style('margin', '10px')
		holder.append('div').style('margin-bottom', '5px').text(gene)

		await embedMethylationRegionPicker({
			holder: holder.append('div'),
			genomeObj: self.app.opts.genome,
			vocabApi: self.app.vocabApi,
			chr: coord.chr,
			start: coord.start,
			stop: coord.stop,
			callback: async (term: any) => {
				await self.launchPlot({ chartType: 'summary', term: { term } })
			}
		})
	}

	self.showTerm = function (term: any) {
		const tr = select(this)

		if (term.isCoord) {
			// Genomic coordinate row: region label + a "Genome Browser" button opening the genomic view as
			// a separate mass chart with plot state. No protein view — a bare region is not tied to one gene.
			tr.append('td').text(term.name).style('padding', '5px 10px')
			tr.append('td')
				.append('span')
				.attr('class', 'sja_menuoption')
				.attr('data-testid', 'sjpp-mass-chat-coord-genomebrowser')
				.style('display', 'inline-block')
				.style('margin', '0px 3px')
				.style('padding', '5px 10px')
				.style('border-radius', '5px')
				.style('cursor', 'pointer')
				.text('Genome Browser')
				.on(
					'click',
					() =>
						void self
							.launchGenomeBrowserView('genomic', { coord: term.coord })
							.catch(e => sayerror(self.dom.resultDiv, 'Error: ' + (e?.message || e)))
				)
			return
		}

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
				// one button per variant data type available for THIS gene (snvindel/cnv/svfusion);
				// each opens a mutated-vs-wildtype barchart restricted to that data type.
				for (const vt of term.geneVariantTypes || []) {
					addBtn(vt.label, `sjpp-mass-chat-gene-${vt.testid}-${term.gene}`, async () => {
						await self.launchGeneVariantPlot(term.gene, vt.dtCandidates)
					})
				}
			}
			if (term.isGenomeBrowser) {
				// open a chooser window offering "Protein view"/"Genomic view" of the gene; picking a view
				// opens the genome browser as a separate mass chart with plot state, whose mds3 track shows
				// the gene's SNV/indel, CNV and SV/fusion data (whichever the dataset has). See launchGenomeBrowser.
				addBtn('Genome Browser', `sjpp-mass-chat-gene-genomebrowser-${term.gene}`, async () => {
					await self.launchGenomeBrowser(term.gene, term.coord)
				})
			}
			if (term.isMethylation) {
				// open a violin plot of the gene's per-sample DNA methylation beta values
				addBtn('DNA methylation', `sjpp-mass-chat-gene-methylation-${term.gene}`, async () => {
					await self.launchMethylationPlot(term.gene, term.coord)
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
