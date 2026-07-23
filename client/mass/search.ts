// Mass omnisearch (search-as-you-type): resolves a typed prompt to dictionary variables, genes, and a
// genomic coordinate via one termdb/chat request, and renders the results as rows whose action buttons
// launch plots. Extracted from chat.ts; the functions here operate on the MassAiChatBot instance (`self`),
// which owns the DOM (self.dom), app api (self.app), and options (self.opts).
import { keyupEnter } from '#src/client'
import { dofetch3 } from '#common/dofetch'
import type { OmnisearchResult } from '#types'
import { sayerror } from '../dom/sayerror.ts'
import { select } from 'd3-selection'
import { fillTermWrapper } from '#termsetting'
import { dtsnvindel, dtcnv, dtsv, dtfusionrna } from '#shared/common.js'
import { DNA_METHYLATION } from '#shared/terms.js'
import { getDNAMethUnit } from '#tw/dnaMethylation'
import { first_genetrack_tolist } from '#common/1stGenetk'

// Minimum prompt length per search family. Gene search runs from a single character; dictionary and
// sample search require 3 (they match more loosely and, for samples, scan every sample name). Coordinate
// search has no length gate (its regex decides). The dict/sample cutoff is sent to the server, which skips
// those searches for short prompts so a 1–2 char keystroke never scans all samples on a large dataset.
const MIN_PROMPT_LENGTH_FOR_GENE_SEARCH = 1
const MIN_PROMPT_LENGTH_FOR_OTHER_SEARCH = 3
const MAX_PROMPT_LENGTH_FOR_OMNISEARCH = 20

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

/** Genomic coordinate shape-filter + "chr" prefix toggling (moved from server chat/search.ts). Matches a
 * typed "chr:start-stop" range (e.g. "chr7:100000-200000" or, with the prefix omitted, "7:100000-200000")
 * and returns the candidate coordinate strings to try server-side — both the typed spelling and the
 * "chr"-toggled one, since only the server's genome object knows which chromosome name it uses. Returns
 * null when the prompt is not a coordinate range (a bare chr, a gene name, or partial typing), so no
 * coordinate is sent to the server. Chromosome existence and position validity are left to the server's
 * string2pos(); this is only a cheap shape/spelling step. */
function parseCoordCandidates(prompt: string): string[] | null {
	const m = /^\s*(\w+)\s*:\s*([\d,]+)\s*-\s*([\d,]+)\s*$/.exec(prompt)
	if (!m) return null
	const [, chrToken, start, stop] = m
	const chrCandidates = /^chr/i.test(chrToken)
		? [chrToken, chrToken.replace(/^chr/i, '')] // "chr7" -> try "chr7", then "7"
		: [chrToken, 'chr' + chrToken] // "7" -> try "7", then "chr7"
	return chrCandidates.map(chr => `${chr}:${start}-${stop}`)
}

/** keyup handler for the omnisearch input: run the omnisearch (doSearch) as the user types. A typed
 * genomic coordinate range triggers a search regardless of prompt length (no length cutoff — coordinate
 * strings can be long); any other prompt is gated by the length bounds. Otherwise clear the results popup.
 * Wired in chat.ts's initDom. `self` is the MassAiChatBot instance. */
export async function handleOmnisearchKeyup(self: any, event: KeyboardEvent) {
	if (keyupEnter(event)) return
	const prompt = (event.target as HTMLInputElement).value.trim()
	if (!prompt) {
		self.dom.noMatchShown = false
		self.clear({ hide: true })
		return
	}
	// A coordinate (regex passes) is searched regardless of length; only a coordinate triggers the
	// server's coordinate resolution (its candidates are passed to doSearch). Other prompts stay gated.
	const coordCandidates = parseCoordCandidates(prompt)
	if (
		coordCandidates ||
		(MIN_PROMPT_LENGTH_FOR_GENE_SEARCH <= prompt.length && prompt.length <= MAX_PROMPT_LENGTH_FOR_OMNISEARCH)
	) {
		try {
			await doSearch(self, prompt, coordCandidates) // Search as user types
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			sayerror(self.dom.resultDiv, 'Error: ' + (e.message || e))
		}
	} else {
		self.dom.noMatchShown = false
		self.clear({ hide: true })
	}
}

/** Server call for the mass omnisearch: POST the prompt (and, when the client's coordinate regex passed,
 * the "chr:start-stop" candidate spellings) to termdb/chat and return the OmnisearchResult. The server does
 * the gene/dictionary lookup and resolves the typed coordinate via string2pos (the genome object stays
 * server-side). Separated from the rendering (renderOmnisearchResults) and takes plain params (no DOM /
 * component instance) so it can be integration-tested against a running server on its own. */
export async function fetchOmnisearch(opts: {
	genome: string
	dslabel: string
	prompt: string
	cohortStr?: string
	usecase?: any
	treeFilter?: any
	coordCandidates?: string[] | null
}): Promise<OmnisearchResult> {
	const data: OmnisearchResult = await dofetch3('termdb/chat', {
		body: {
			genome: opts.genome,
			dslabel: opts.dslabel,
			omnisearch: true,
			prompt: opts.prompt,
			cohortStr: opts.cohortStr,
			usecase: opts.usecase,
			treeFilter: opts.treeFilter,
			coordCandidates: opts.coordCandidates || undefined,
			// gene search runs from 1 char; dictionary + sample search only once the prompt reaches the
			// longer cutoff, so the server skips them (and their all-samples scan) for short prompts
			includeDictAndSampleSearch: opts.prompt.trim().length >= MIN_PROMPT_LENGTH_FOR_OTHER_SEARCH
		}
	})
	if (data.error) throw data.error
	return data
}

/** Build the result rows from an OmnisearchResult and render them into the results popup (or show the
 * "No match" message): one row per dictionary term, per gene (with the action buttons available for that
 * gene), and the typed genomic coordinate. Separated from the server call (fetchOmnisearch) so each can be
 * tested on its own. */
function renderOmnisearchResults(self: any, data: OmnisearchResult) {
	// Genomic coordinate typed as the prompt (e.g. "chr7:100000-200000" or "7:100000-200000") is
	// treated as another searchable data type alongside dictionary terms and genes: the server returns
	// a parsed coordinate when the prompt is a valid range and the dataset supports the genomic view.
	// A coordinate result is added below whose "Genome Browser" button opens the genomic view.
	const coord = data.coord || null
	const dictItems: any[] = Array.isArray(data.dictionaryTerms) ? data.dictionaryTerms : []
	// Each gene match carries its own available data types (a gene may have e.g. SNV/indel while
	// another does not), so action buttons are decided per gene rather than dataset-wide.
	const genes: { gene: string; dataTypes: any; coord?: any }[] = Array.isArray(data.genes) ? data.genes : []

	// Build one entry per gene, skipping any whose name already appears among the dictionary results.
	// Each gene renders as a single row whose buttons are the actions available for that gene, and
	// its own per-variant-type options (SNV/indel, CNV, SV/fusion) are attached for showTerm to use.
	const dictNames = new Set(dictItems.map((t: any) => t.name?.toUpperCase()))
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
	const geneItems = [...geneMap.values()]
	// Matched samples. The server only sends these when the dataset allows displaying sample ids
	// (authApi.canDisplaySampleIds), so no permission check is repeated here — an empty/absent list
	// means either no match or a dataset that does not permit it.
	const sampleItems = (Array.isArray(data.samples) ? data.samples : [])
		.filter((s: any) => s?.name)
		.map((s: any) => ({ isSample: true, name: s.name, sampleId: s.id }))
	// The genomic coordinate is its own result entry (like a gene entry), rendered by showTerm
	const coordItems = coord
		? [{ isCoord: true, name: `${coord.chr}:${coord.start.toLocaleString()}-${coord.stop.toLocaleString()}`, coord }]
		: []

	// Per-type total match counts (server capped each type; totals report the full counts). A group's
	// results were truncated when its total exceeds the number the server returned for that type, in which
	// case a note is shown at the bottom of the group.
	const totals = data.totals || ({} as any)
	// Group the results under headings so each result type is labeled (e.g. "Dictionary" above the matched
	// dictionary variables, then "Genes" above the matched genes). A heading row is inserted only for a
	// non-empty group; showTerm renders {isHeading:true} rows as the group label, {isNote:true} as the note.
	const lst: any[] = []
	for (const group of [
		{
			key: 'dictionary',
			heading: 'Dictionary',
			noun: 'dictionary variable',
			items: dictItems,
			returned: dictItems.length,
			total: totals.dictionaryTerms
		},
		{
			key: 'genes',
			heading: 'Genes',
			noun: 'gene',
			items: geneItems,
			returned: Array.isArray(data.genes) ? data.genes.length : 0,
			total: totals.genes
		},
		{
			key: 'samples',
			heading: 'Samples',
			noun: 'sample',
			items: sampleItems,
			returned: sampleItems.length,
			total: totals.samples
		},
		{
			key: 'coord',
			heading: 'Genomic region',
			noun: '',
			items: coordItems,
			returned: coordItems.length,
			total: undefined
		}
	]) {
		if (!group.items.length) continue
		lst.push({ isHeading: true, name: group.heading })
		for (const item of group.items) lst.push(item)
		// truncation note: shown only when the server capped this type (total > what it returned)
		if (typeof group.total == 'number' && group.total > group.returned) {
			lst.push({
				isNote: true,
				testid: `sjpp-mass-chat-note-${group.key}`,
				name: `Displaying ${group.items.length} out of a total of ${group.total} ${group.noun} matches`
			})
		}
	}
	if (!lst.length) {
		// Show the "No match..." message one time at the first miss
		if (!self.dom.noMatchShown) {
			self.dom.noMatchShown = true
			self.noResult()
		}
	} else {
		self.dom.noMatchShown = false
		self.showTerms({ lst })
	}
}

// Search method, adapted from MassSearch.doSearch. Thin orchestration: fetch results from the server
// (fetchOmnisearch), then render them (renderOmnisearchResults). `coordCandidates` (when the prompt matched
// the coordinate regex on the client) are the "chr:start-stop" spellings the server resolves via
// string2pos; pass null/undefined for a normal gene/dictionary search.
export async function doSearch(self: any, prompt: string, coordCandidates?: string[] | null) {
	if (!prompt) {
		self.clear({ hide: true })
		return
	}
	// search-as-you-type fires one doSearch per keystroke ("PAX5" -> P, PA, PAX, PAX5), and the fetches
	// are not ordered — a stale shorter-prompt response can arrive after the latest one and overwrite the
	// rendered rows. Tag each search and render only if it is still the most recent when the response lands.
	const seq = (self.omnisearchSeq = (self.omnisearchSeq || 0) + 1)
	const data = await fetchOmnisearch({
		genome: self.app.vocabApi.vocab.genome,
		dslabel: self.app.vocabApi.vocab.dslabel,
		prompt,
		cohortStr: self.getState(self.app.getState()).cohortStr,
		usecase: self.opts.usecase,
		treeFilter: self.app.vocabApi.state?.treeFilter,
		coordCandidates
	})
	if (seq !== self.omnisearchSeq) return // a newer keystroke superseded this search; drop the stale result
	renderOmnisearchResults(self, data)
}

// Minimal renderers ported from MassSearch. Assigns the omnisearch renderers (noResult, showTerms,
// launchPlot, the plot-launchers, showTerm, clear) onto the component instance `self`.
export function setSearchRenderers(self: any) {
	let text = 'No match'
	if (self.isChat) {
		text = 'No match. Using the chatbot...'
	}
	self.noResult = () => {
		self.clear()
		self.dom.resultDiv.append('div').text(text).style('padding', '3px 3px 3px 0px').style('opacity', 0.5)

		// Hide the popup after a delay. Track the timer so (a) successive no-match keystrokes don't stack
		// timers and (b) showTerms can cancel it — otherwise a stale hide from an earlier no-match keystroke
		// (e.g. a short gene-only prompt that matched nothing) fires later and wipes freshly-rendered results.
		clearTimeout(self.noResultTimer)
		self.noResultTimer = setTimeout(() => {
			self.clear({ hide: true })
		}, 1500)
	}

	self.showTerms = (data: any) => {
		// cancel any pending no-match hide so a stale timer can't wipe these results
		clearTimeout(self.noResultTimer)
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
			// genomic view requires the gene's locus (server-resolved in search.ts). Error out rather than
			// falling back to a dataset default region, which would open a locus unrelated to the gene.
			if (!coord) throw new Error(`Unable to resolve genomic coordinates for gene "${gene}".`)
			await self.launchGenomeBrowserView('genomic', { coord })
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
		if (!coord) throw new Error(`Could not resolve coordinates for gene "${gene}"`)

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

	self.showTerm = function (this: any, term: any) {
		const tr = select(this)

		if (term.isHeading) {
			// group label row spanning both columns (name + action-button columns); not selectable
			tr.append('td')
				.attr('colspan', 2)
				.attr('data-testid', `sjpp-mass-chat-heading-${term.name.toLowerCase().replace(/\s+/g, '-')}`)
				.text(term.name)
				.style('padding', '6px 10px 2px')
				.style('font-weight', 'bold')
				.style('font-size', '0.85em')
				.style('text-transform', 'uppercase')
				.style('opacity', 0.5)
			return
		}

		if (term.isNote) {
			// "Displaying N out of M ... matches" note at the bottom of a truncated group; not selectable
			tr.append('td')
				.attr('colspan', 2)
				.attr('data-testid', term.testid || 'sjpp-mass-chat-note')
				.text(term.name)
				.style('padding', '2px 10px 6px')
				.style('font-size', '0.8em')
				.style('font-style', 'italic')
				.style('opacity', 0.6)
			return
		}

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

		if (term.isSample) {
			// Sample row: sample name + a "Sample View" button opening the sample as a separate mass chart.
			// Passes config.sample (singular), the same single-sample shape the scatter click handler
			// dispatches (scatterInteractivity.ts), which sampleView resolves to its related samples.
			tr.append('td').text(term.name).style('padding', '5px 10px')
			tr.append('td')
				.append('span')
				.attr('class', 'sja_menuoption')
				.attr('data-testid', `sjpp-mass-chat-sample-view-${term.sampleId}`)
				.style('display', 'inline-block')
				.style('margin', '0px 3px')
				.style('padding', '5px 10px')
				.style('border-radius', '5px')
				.style('cursor', 'pointer')
				.text('Sample View')
				.on(
					'click',
					() =>
						void self
							.launchPlot({
								chartType: 'sampleView',
								sample: { sampleId: term.sampleId, sampleName: term.name }
							})
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
