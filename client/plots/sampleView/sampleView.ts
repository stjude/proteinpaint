import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '#plots/PlotBase.js'
import { select } from 'd3-selection'
import { isNumericTerm, getDateStrFromNumber } from '#shared/terms.js'
import { importPlot } from '#plots/importPlot.js'
import { makeTileGrid, makeTileCard, makeAsyncCard, tileExpandState } from '../tileCard.ts'
import { getSampleTools, type Sample, type SampleTool, type ToolContext } from './sampleView.tiles.ts'
import { showSamplePicker } from './samplePicker.ts'

/*********************************************************************
 * sampleView
 *
 * All available data of a sample, as a grid of tiles: the dictionary
 * plus one tile per tool (disco, methylation array, brain
 * imaging, swimmer, genome browser, single cell, whole slide images, ssGSEA, gene expression
 * , prebuilt scatter plots). The shown samples are a patient's related
 * samples (or the samples passed in config.samples); a switcher picks
 * the sample whose tiles are shown, while patient-level tiles (swimmer)
 * and the expanded dictionary cover all shown samples.
 *
 * The sample is chosen before the plot is opened, e.g. in the menu of the
 * Sample View chart button, and is named in the sandbox header. A plot
 * without a sample shows the sample picker.
 *********************************************************************/

const root_ID = 'root'
/** most samples compared side by side in the expanded dictionary */
const samplesLimit = 15
/** most samples shown as switcher buttons; more are shown in a dropdown */
const switcherButtonsLimit = 8
/** dictionary values shown on the dictionary tile face */
const faceValuesLimit = 8

/** a tool's loaded data for a sample (or for all shown samples), kept to be drawn again
 * without refetching when the grid is redrawn; and its faces by the chosen sample, drawn once and moved
 * to each new card: a face may draw the full tool */
type Drawing = {
	ctx: ToolContext
	destroy: (() => void)[]
	data: Promise<any>
	faces: Map<string, { div: Element; done: Promise<void> }>
}

/** the samples related to a sample (e.g. its patient's samples), and their root sample (e.g. the patient);
 * see TermdbRelatedSamplesResponse */
type RelatedSamples = { samples: Sample[]; root?: Sample }

class SampleView extends PlotBase implements RxComponent {
	static type = 'sampleView'

	type: string
	termsByCohort: any
	dom!: {
		header: any
		holder: any
		/** the button to download the data of the shown samples */
		controlsDiv: any
		downloadbt: any
		messageDiv: any
		switcherDiv: any
		loadingDiv: any
		plotsDiv: any
	}
	vocabApi: any
	config!: any
	termsById!: Record<string, any>
	sampleDataByTermId!: Record<string, any>
	orderedVisibleTerms!: any[]
	tools!: SampleTool[]
	/** the shown samples: config.samples, else the samples related to the chosen sample */
	samples!: Sample[]
	/** the samples related to the first shown sample, whose root sample (e.g. the patient) fills in the dictionary */
	related?: RelatedSamples
	/** the sample whose tiles are shown */
	activeSample!: Sample
	/** the samples compared in the expanded dictionary */
	dictSamples!: Sample[]
	/** by tool key + sample name(s); cleared when the shown samples change */
	drawings = new Map<string, Drawing>()
	/** all values of a sample, for the dictionary tile face; cleared with the drawings */
	sampleValues = new Map<string, Promise<any>>()
	/** the shown samples, to know when the drawings are stale */
	samplesKey?: string
	/** used by tileExpandState() to reopen the expanded tile on rerender */
	expandedTileKey?: string | null
	/** child plots (e.g. the full prebuilt scatter of an expanded scatter tile) by key: each is created
	 * on first expand, then its live component is moved into the tile on every later expand. While out of the
	 * page (its tile collapsed), its components are parked out of this.components so that they are not updated */
	childPlots = new Map<string, { div: any; mounting?: Promise<void>; parked?: { [key: string]: any } }>()

	constructor(opts, api: ComponentApi) {
		super(opts, api)
		this.type = SampleView.type
		this.setDom(opts)
	}

	setDom(opts) {
		opts.holder.style('position', 'relative')
		const div = opts.holder.append('div').style('padding', '10px 20px')
		const headerDiv = div.append('div')
		const controlsDiv = headerDiv
			.append('div')
			.style('display', 'none')
			.style('vertical-align', 'top')
			.style('margin-bottom', '5px')
		const downloadbt = controlsDiv
			.append('button')
			.text('Download')
			.on('click', () => this.downloadData())
		const messageDiv = controlsDiv
			.append('div')
			.style('display', 'none')
			.style('vertical-align', 'top')
			.html('&nbsp;&nbsp;Downloading data ...')
		const switcherDiv = headerDiv
			.append('div')
			.attr('data-testid', 'sjpp-sampleview-switcher')
			.style('display', 'inline-block')
			.style('margin-left', '20px')
			.style('vertical-align', 'top')
		const plotsDiv = div.append('div')

		// loading overlay shown over the sandbox while sample data is fetched;
		// reuses the shared .sjpp-loading-overlay box + .sjpp-spinner glyph
		const loadingDiv = opts.holder.append('div').attr('class', 'sjpp-loading-overlay').style('display', 'none')
		loadingDiv.append('div').attr('class', 'sjpp-spinner')

		this.dom = {
			header: opts.header,
			holder: opts.holder,
			controlsDiv,
			downloadbt,
			messageDiv,
			switcherDiv,
			loadingDiv,
			plotsDiv
		}
	}

	async init(appState) {
		this.termsByCohort = {}
		this.tools = getSampleTools(appState.termdbConfig)
	}

	getState(appState) {
		const config = appState.plots?.find(p => p.id === this.id)
		const state: {
			config: any
			termfilter: any
			activeCohort: any
			hasVerifiedToken: any
			tokenVerificationPayload: any
			termdbConfig: any
			vocab: any
			toSelectCohort?: boolean
			cohortValuelst?: any
		} = {
			config,
			termfilter: appState.termfilter,
			// TODO: use state.config drectly, instead of having to extract
			// selected config.key-values into the component state
			activeCohort: config.activeCohort,
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken(),
			tokenVerificationPayload: this.app.vocabApi.tokenVerificationPayload,
			termdbConfig: appState.termdbConfig,
			vocab: appState.vocab
		}
		if (appState.termdbConfig.selectCohort) {
			state.toSelectCohort = true
			const choice = appState.termdbConfig.selectCohort.values[state.activeCohort]
			if (choice) {
				// a selection has been made
				state.cohortValuelst = choice.keys
			}
		}

		return state
	}

	async main() {
		this.renderHeader()
		if (this.mayRequireToken()) return
		this.config = structuredClone(this.state.config)
		if (!this.config.samples?.length && !this.config.sample) {
			this.renderSamplePrompt()
			return
		}
		this.dom.controlsDiv.style('display', 'inline-block')
		// enabled once the shown samples are known, and only when there are any
		this.dom.downloadbt.property('disabled', true)
		this.dom.loadingDiv.style('display', '')
		try {
			await this.setSamples()
			const samples = this.samples
			this.dom.downloadbt.property('disabled', !samples.length)
			// the drawings are of these samples, the filter and the cohort
			const samplesKey = JSON.stringify([
				samples.map(s => s.sampleName),
				this.state.termfilter?.filter,
				this.state.activeCohort
			])
			if (samplesKey !== this.samplesKey) {
				this.clearDrawings()
				this.samplesKey = samplesKey
			}
			const name = this.config.activeSample || this.config.sample?.sampleName
			this.activeSample = samples.find(s => s.sampleName == name) || samples[0]
			this.dictSamples = samples.length <= samplesLimit ? samples : this.activeSample ? [this.activeSample] : []

			this.termsById = this.getTermsById(this.state)
			this.sampleDataByTermId = {}
			const root = this.termsById[root_ID]
			root.terms = await this.requestTermRecursive(root)
			this.orderedVisibleTerms = this.getOrderedVisibleTerms()
		} finally {
			this.dom.loadingDiv.style('display', 'none')
		}

		this.renderSwitcher()
		// detach only the direct children: the cached drawings inside the cards are moved to the new grid
		this.dom.plotsDiv.node().replaceChildren()
		if (!this.activeSample) {
			this.dom.plotsDiv.append('div').style('color', '#6b7280').text('No accessible data for this sample.')
			return
		}
		const grid = makeTileGrid(this.dom.plotsDiv).attr('data-testid', 'sjpp-sampleview-tiles')
		this.renderDictionaryTile(grid)
		for (const tool of this.tools) {
			const toolSamples = tool.scope == 'patient' ? this.samples : [this.activeSample]
			const d = this.getDrawing(tool, toolSamples)
			const expand = tileExpandState(this, tool.key)
			const card = makeAsyncCard(grid, {
				title: tool.title,
				data: d.data,
				renderFace: (face, data) => this.renderFace(face, data, tool, toolSamples, d),
				renderExpanded: (holder, data) => tool.renderExpanded(holder, data, toolSamples, d.ctx, this.activeSample),
				open: expand.open,
				onToggle: open => {
					expand.onToggle!(open)
					if (!open) this.parkDetachedChildren()
				}
			})
			card.attr('data-testid', `sjpp-sampleview-tile-${tool.key}`)
		}
		// the grid is new: the child plot of an expanded tile is mounted again when the tile reopens
		this.parkDetachedChildren()
	}

	/** the chosen sample, or the number of samples passed in, in the sandbox header */
	renderHeader() {
		if (!this.dom.header) return
		const config = this.state.config
		const passed: Sample[] | undefined = config.samples?.length ? config.samples : undefined
		const name = passed
			? passed.length == 1
				? passed[0].sampleName
				: `${passed.length} samples`
			: config.sample?.sampleName
		this.dom.header.text(name ? `Sample View: ${name}` : 'Sample View')
	}

	/** a plot without a sample, e.g. of a session saved before choosing one: the sample picker */
	renderSamplePrompt() {
		this.dom.controlsDiv.style('display', 'none')
		this.dom.switcherDiv.selectAll('*').remove()
		this.dom.plotsDiv.node().replaceChildren()
		this.dom.plotsDiv.append('div').style('color', '#6b7280').text('Choose a sample to view its data.')
		showSamplePicker({
			holder: this.dom.plotsDiv,
			vocabApi: this.vocabApi,
			filter: this.state.termfilter?.filter,
			hasSampleAncestry: this.state.termdbConfig.hasSampleAncestry,
			// the shown samples are then the samples related to config.sample
			onSelect: sample =>
				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { sample, samples: null, activeSample: sample.sampleName }
				})
		})
	}

	/** the shown samples: those passed in config.samples, else the samples related to the chosen sample. The samples
	 * related to the first shown sample also give its root sample (e.g. its patient), see getPatient() */
	async setSamples() {
		const passed: Sample[] | undefined = this.config.samples?.length ? this.config.samples : undefined
		const sample = passed?.[0] || this.config.sample
		this.related = undefined
		if (sample) {
			try {
				this.related = await this.getRelatedSamples(sample)
			} catch (e) {
				// a newer update stops this render
				if (!passed || this.app.isAbortError(e)) throw e
				// passed samples are shown without the values of their root sample
				console.warn('sampleView: cannot get the related samples', e)
			}
		}
		this.samples = passed || this.related?.samples || []
	}

	/** the samples related to a sample, of the samples passing the filter. Not cached here: dofetch3() reuses a
	 * response, but not for a request of an aborted update */
	async getRelatedSamples(sample: Sample): Promise<RelatedSamples> {
		const r = await this.vocabApi.getRelatedSamples({
			sampleId: sample.sampleId,
			filter: this.state.termfilter?.filter
		})
		if ('error' in r) throw r.error
		return r
	}

	/** buttons, or a dropdown for many samples, to choose the sample whose tiles are shown */
	renderSwitcher() {
		const div = this.dom.switcherDiv
		div.selectAll('*').remove()
		const samples = this.samples
		if (samples.length < 2) return
		const choose = (sampleName: string) => {
			if (sampleName == this.activeSample.sampleName) return
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { activeSample: sampleName } })
			this.mayUpdateChildHighlight(this.samples, sampleName)
		}
		if (samples.length > switcherButtonsLimit) {
			div.append('label').style('margin-right', '5px').text(`Sample (${samples.length}):`)
			div
				.append('select')
				.on('change', event => choose(event.target.value))
				.selectAll('option')
				.data(samples)
				.enter()
				.append('option')
				.attr('value', d => d.sampleName)
				.property('selected', d => d == this.activeSample)
				.text(d => d.sampleName)
			return
		}
		div
			.attr('role', 'tablist')
			.selectAll('button')
			.data(samples)
			.enter()
			.append('button')
			.attr('role', 'tab')
			.attr('aria-selected', d => String(d == this.activeSample))
			.style('margin-right', '4px')
			.style('padding', '3px 10px')
			.style('border', '1px solid #d1d5db')
			.style('border-radius', '4px')
			.style('cursor', 'pointer')
			.style('background', d => (d == this.activeSample ? '#e5e7eb' : '#fff'))
			.style('font-weight', d => (d == this.activeSample ? '600' : null))
			.text(d => d.sampleName)
			.on('click', (_event, d) => choose(d.sampleName))
	}

	/** the face of a drawing for the chosen sample, drawn on first use, then moved into the new card */
	renderFace(face: any, data: any, tool: SampleTool, samples: Sample[], d: Drawing): Promise<void> {
		const key = this.activeSample.sampleName
		const cached = d.faces.get(key)
		if (cached) {
			face.node().append(cached.div)
			return cached.done
		}
		// drawn in the card, where it is displayed to be measured
		const div = face.append('div')
		const done = Promise.resolve(tool.renderFace(div, data, samples, d.ctx, this.activeSample)).catch(e => {
			// drawn again on the next render
			d.faces.delete(key)
			div.remove()
			throw e
		})
		d.faces.set(key, { div: div.node(), done })
		return done
	}

	/** the cached data of a tool for samples, or a new load */
	getDrawing(tool: SampleTool, samples: Sample[]): Drawing {
		const key = tool.key + '\t' + samples.map(s => s.sampleName).join('\t')
		const cached = this.drawings.get(key)
		if (cached) return cached
		const destroy: (() => void)[] = []
		const ctx: ToolContext = {
			termdbConfig: this.state.termdbConfig,
			vocab: this.state.vocab,
			genome: this.app.opts.genome,
			app: this.app,
			config: this.config,
			onDestroy: fn => destroy.push(fn),
			filter: this.state.termfilter.filter,
			mountChildPlot: (holder, key, config) => this.mountChildPlot(holder, key, config)
		}
		const drawing: Drawing = { ctx, destroy, data: tool.load(samples, ctx), faces: new Map() }
		this.drawings.set(key, drawing)
		return drawing
	}

	/** the configs of the child plots of sample view, in the store */
	getChildConfigs(): any[] {
		return this.app.getState().plots.filter((p: any) => p.parentId === this.id)
	}

	/** mount child plot `key` into holder: created with `config` on first use, else the live component
	 * is moved here. as a sub-component it then gets the later state updates (e.g. its setting edits) */
	async mountChildPlot(holder: any, key: string, config: any) {
		let child = this.childPlots.get(key)
		if (child) {
			holder.node().appendChild(child.div.node())
			if (child.parked) {
				// back in the page: updated again, from the state it missed while parked
				Object.assign(this.components, child.parked)
				const parked = Object.values(child.parked)
				delete child.parked
				const appState = this.app.getState()
				await child.mounting
				for (const c of parked) await c.update({ appState })
				return
			}
		} else {
			// a child plot wider than the card (e.g. a scatter with its settings open) scrolls sideways
			child = { div: holder.append('div').style('overflow-x', 'auto') }
			this.childPlots.set(key, child)
		}
		if (!child.mounting) {
			const div = child.div
			child.mounting = (async () => {
				// a retry starts over: a failed mount may have left a filter or plot holder
				div.node().replaceChildren()
				let childConfig = this.getChildConfigs().find(p => p.childKey === key)
				if (!childConfig) {
					await this.app.dispatch({
						type: 'plot_create',
						parentId: this.id,
						config: { ...config, parentId: this.id, childKey: key }
					})
					childConfig = this.getChildConfigs().find(p => p.childKey === key)
					if (!childConfig) throw `failed to create the ${config.chartType} plot`
				}
				// the local sample filter of the child, shown and edited as in a plot of the mass app (mass/plot.js)
				const filterCfg = this.app.vocabApi.termdbConfig?.plotFilter
				let filter: any
				if (!childConfig.hidePlotFilter && !filterCfg?.hide) {
					const { filterRxCompInit } = await import('#filter')
					const id = childConfig.id
					const filterDiv = div.append('div').style('margin-bottom', '5px')
					// disabled (e.g. for the public view): greyed, with the reason on hover
					if (filterCfg?.disabledMessage)
						filterDiv.attr('title', filterCfg.disabledMessage).style('cursor', 'not-allowed')
					filter = await filterRxCompInit({
						app: this.app,
						vocabApi: this.app.vocabApi,
						parentId: id,
						holder: filterCfg?.disabledMessage
							? filterDiv.append('div').style('pointer-events', 'none').style('opacity', 0.5)
							: filterDiv,
						hideLabel: true,
						emptyLabel: '+Add new filter',
						callback: filter => this.app.dispatch({ type: 'plot_edit', id, parentId: this.id, config: { filter } })
					})
					this.components[key + ':filter'] = filter
				}
				const { componentInit } = await importPlot(childConfig.chartType)
				const component = await componentInit({
					app: this.app,
					holder: div.append('div'),
					id: childConfig.id,
					parentId: this.id
				})
				this.components[key] = component
				// the first render is forced, as mounting happens outside of a dispatch
				const appState = this.app.getState()
				await filter?.update({ appState })
				await component.update({ appState })
			})()
			// a failed mount is retried on the next expand
			child.mounting.catch(() => delete child!.mounting)
		}
		await child.mounting
		// collapsed while mounting
		this.parkDetachedChildren()
	}

	/** park the components of the child plots out of the page, see childPlots */
	parkDetachedChildren() {
		for (const [key, child] of this.childPlots) {
			if (child.parked || child.div.node().isConnected) continue
			for (const k of [key, key + ':filter']) {
				if (!this.components[k]) continue
				child.parked ||= {}
				child.parked[k] = this.components[k]
				delete this.components[k]
			}
		}
	}

	/** keep the highlighted samples of the child plots (e.g. scatter plots) on the shown samples */
	mayUpdateChildHighlight(samples: Sample[], activeSample: string) {
		const highlightSamples = samples.map(s => s.sampleName)
		for (const p of this.getChildConfigs()) {
			if (!p.highlightSamples) continue
			this.app.dispatch({
				type: 'plot_edit',
				id: p.id,
				parentId: this.id,
				config: { highlightSamples, emphasizedSample: activeSample }
			})
		}
	}

	clearDrawings() {
		for (const d of this.drawings.values()) for (const fn of d.destroy) fn()
		this.drawings.clear()
		this.sampleValues.clear()
	}

	/** face: the first values of the shown sample; expanded: the term tree, all shown samples side by side */
	renderDictionaryTile(grid) {
		// in a slot like the tool tiles, which carries the test id of the tile
		const slot = grid.append('div').style('display', 'contents').attr('data-testid', 'sjpp-sampleview-tile-dictionary')
		const face = makeTileCard(slot, {
			title: 'Dictionary',
			uniform: true,
			fixedHeight: true,
			openGroup: grid.node(),
			expand: { render: holder => this.renderSampleDictionary(holder), ...tileExpandState(this, 'dictionary') }
		})
		face.style('font-size', '.8em')
		const sample = this.activeSample
		if (!this.sampleValues.has(sample.sampleName))
			this.sampleValues.set(
				sample.sampleName,
				this.vocabApi.getSingleSampleData({
					sampleId: sample.sampleId,
					term_ids: [],
					filter: this.state.termfilter.filter || []
				})
			)
		const values = this.sampleValues.get(sample.sampleName)!
		const wait = face.append('div').style('color', '#6b7280').text('Loading…')
		values
			.then(data => {
				wait.remove()
				if ('error' in data) throw data.error
				const rows: [string, string][] = []
				for (const id in data) {
					const value = getTermValue(data[id].term, data)
					if (value != null) rows.push([data[id].term.name, value])
				}
				// one line per row, so the face keeps the card's fixed height; long text is cut with
				// an ellipsis and shown in full on hover
				const table = face
					.append('table')
					.style('border-collapse', 'collapse')
					.style('width', '100%')
					.style('table-layout', 'fixed')
				for (const [name, value] of rows.slice(0, faceValuesLimit)) {
					const tr = table.append('tr').style('border-bottom', 'solid 1px rgb(245,245,245)')
					for (const [i, text] of [name, value].entries()) {
						tr.append('td')
							.attr('title', text)
							.style('padding', '2px 4px')
							.style('width', i ? '40%' : '60%')
							.style('white-space', 'nowrap')
							.style('overflow', 'hidden')
							.style('text-overflow', 'ellipsis')
							.style('text-align', i ? 'end' : null)
							.style('color', i ? null : '#6b7280')
							.text(text)
					}
				}
				if (rows.length > faceValuesLimit)
					face
						.append('div')
						.style('color', '#6b7280')
						.style('margin-top', '4px')
						.text(`${rows.length - faceValuesLimit} more variables`)
			})
			.catch(e => {
				wait.remove()
				face
					.append('div')
					.style('color', '#b91c1c')
					.text(`Failed to load: ${e?.message || e}`)
			})
	}

	getTermsById(state) {
		if (!(state.activeCohort in this.termsByCohort)) {
			this.termsByCohort[state.activeCohort] = {
				[root_ID]: {
					id: root_ID,
					__tree_isroot: true // must not delete this flag
				}
			}
		}
		return this.termsByCohort[state.activeCohort]
	}

	async requestTermRecursive(term: any, _ancestry: string[] = [root_ID]) {
		/* will request child terms for this entire branch recursively

		must synthesize request string (dataName) for every call
		and get cached result for the same dataName which has been requested before
		this is to support future features
		e.g. to show number of samples for each term that can change based on filters
		where the same child terms already loaded must be re-requested with the updated filter parameters to update

		CAUTION
		will be great if tree_collapse will not trigger this function
		but hard to do given that main() has no way of telling what action was dispatched
		to prevent previously loaded .terms[] for the collapsing term from been wiped out of termsById,
		need to add it back TERMS_ADD_BACK

		NOTE: !!!! sortVisibleTerms() assumes that the child terms in the response.lst[]
					are returned in order. If not, a term.order can be used to sort the child terms array
		*/
		const data = await this.vocabApi.getTermChildren(
			term,
			this.state.toSelectCohort ? this.state.cohortValuelst : null,
			this.state.termfilter.filter
		)
		if (data.error) throw data.error
		if (!data.lst || data.lst.length == 0) {
			// do not throw exception; its children terms may have been filtered out
			return []
		}
		const terms: any[] = []
		const parent_id = _ancestry.slice(-1)[0]
		for (const t of data.lst) {
			t.parent_id = parent_id
			const ancestry = [..._ancestry]
			const copy = structuredClone(t)
			copy.ancestry = ancestry
			terms.push(copy)
			// rehydrate expanded terms as needed
			// fills in termsById, for recovering tree

			if (!copy.isleaf && this.config.expandedTermIds.includes(copy.id)) {
				copy.terms = await this.requestTermRecursive(copy, [...ancestry, t.id])
				await this.fillSampleData(copy.terms)
			} else {
				const t0 = this.termsById[copy.id]
				await this.fillSampleData([copy])

				if (t0 && t0.terms) {
					copy.terms = t0.terms
				}
			}

			this.termsById[copy.id] = copy
		}
		return terms
	}

	getOrderedVisibleTerms() {
		const visibleTerms = Object.values(this.termsById).filter(this.isVisibleTermId.bind(this))
		const orderedVisibleTerms = []
		this.sortVisibleTerms(this.termsById[root_ID], visibleTerms, orderedVisibleTerms)
		return orderedVisibleTerms
	}

	isVisibleTermId(term) {
		if (term.parent_id == root_ID) return true
		if (!term.ancestry) return false
		for (const pid of term.ancestry) {
			if (pid === root_ID) continue
			if (!this.config.expandedTermIds.includes(pid)) return false
		}
		return true
	}

	sortVisibleTerms(currParent: any, remainingTerms: any[], currOrder: any[] = []) {
		const unorderedTerms: any[] = []
		const orderedTerms: any[] = []
		for (const term of remainingTerms) {
			if (term.parent_id == currParent.id) {
				orderedTerms.push(term)
			} else unorderedTerms.push(term)
		}
		// remove ordered terms from the remainingTerms array
		remainingTerms.splice(0, remainingTerms.length, ...unorderedTerms)
		if (remainingTerms.length) {
			for (const term of orderedTerms) {
				currOrder.push(term)
				if (!term.isleaf && remainingTerms.length) {
					this.sortVisibleTerms(term, remainingTerms, currOrder)
				}
			}
		} else {
			currOrder.push(...orderedTerms)
		}
	}

	async fillSampleData(terms: any[]) {
		const term_ids: string[] = []
		for (const term of terms) term_ids.push(term.id)
		const get = (s: Sample) =>
			this.vocabApi.getSingleSampleData({ sampleId: s.sampleId, term_ids, filter: this.state.termfilter.filter })
		/* the shown samples are of one patient: its values (e.g. sex) fill in the terms a sample has none of, marked by
		.fromSample. A patient is known from the sample search list; samples passed in by another plot have none */
		const patient = this.dictSamples.length ? this.getPatient(this.dictSamples[0]) : undefined
		const pdata = patient && (await get(patient))
		for (const sample of this.dictSamples) {
			const data = await get(sample)
			if ('error' in data) throw data.error
			if (pdata && !('error' in pdata) && this.getPatient(sample)?.sampleName == patient!.sampleName)
				for (const id in pdata) if (!(id in data)) data[id] = { ...pdata[id], fromSample: patient!.sampleName }
			if (!this.sampleDataByTermId[sample.sampleId]) this.sampleDataByTermId[sample.sampleId] = {}
			for (const id in data) this.sampleDataByTermId[sample.sampleId][id] = data[id]
		}
	}

	/** the root sample above a sample, e.g. its patient, when the sample is related to the first shown sample */
	getPatient(sample: Sample): Sample | undefined {
		const root = this.related?.root
		if (!root || root.sampleId == sample.sampleId) return
		if (!this.related!.samples.some(s => s.sampleId == sample.sampleId)) return
		return root
	}

	async downloadData() {
		if (!this.samples?.length) return
		this.dom.messageDiv.style('display', 'block')
		this.dom.downloadbt.style('display', 'none')
		const filename = `samples.tsv`
		const sampleData = {}
		let lines = 'Sample'
		for (const sample of this.samples) {
			sampleData[sample.sampleId] = await this.vocabApi.getSingleSampleData({
				sampleId: sample.sampleId,
				/** term_ids is required for getSingleSampleData but not
				 * available in this instance. Pass empty array.*/
				term_ids: [],
				filter: this.state.termfilter.filter || []
			})
			lines += `\t${sample.sampleName}`
		}
		lines += '\n'

		const sampleId = this.samples[0].sampleId
		for (const termId in sampleData[sampleId]) {
			const term = sampleData[sampleId][termId].term
			lines += `${term.name}`
			for (const sampleId in sampleData) {
				const data = sampleData[sampleId]
				let value = getTermValue(term, data)
				if (value == null) value = 'Missing'
				lines += `\t${value}`
			}
			lines += '\n'
		}
		const dataStr = 'data:text/tsv;charset=utf-8,' + encodeURIComponent(lines)

		const link = document.createElement('a')
		link.setAttribute('href', dataStr)
		// If you don't know the name or want to use
		// the webserver default set name = ''
		link.setAttribute('download', filename)
		document.body.appendChild(link)
		link.click()
		link.remove()
		this.dom.messageDiv.style('display', 'none')
		this.dom.downloadbt.style('display', 'inline-block')
	}

	mayRequireToken() {
		if (this.state.hasVerifiedToken) {
			this.dom.holder.style('display', 'block')
			return false
		} else {
			const e = this.state.tokenVerificationPayload
			const missingAccess = e?.error == 'Missing access' && this.state.termdbConfig.dataDownloadCatch?.missingAccess
			const message = missingAccess?.message?.replace('MISSING-ACCESS-LINK', missingAccess?.links[e?.linkKey])
			const helpLink = this.state.termdbConfig.dataDownloadCatch?.helpLink
			this.dom.holder
				.style('color', '#e44')
				.style('padding', '10px')
				.html(
					message ||
						(this.state.tokenVerificationMessage || 'Requires sign-in') +
							(helpLink ? ` <a href='${helpLink}' target=_blank>Tutorial</a>` : '')
				)

			return true
		}
	}

	/** the term tree with the values of the compared samples side by side */
	renderSampleDictionary(holder) {
		if (this.dictSamples.length < this.samples.length)
			holder
				.append('div')
				.style('font-size', '.85em')
				.style('color', '#6b7280')
				.text(`Showing ${this.activeSample.sampleName} only: up to ${samplesLimit} samples are compared side by side.`)
		const table = holder
			.append('div')
			.attr('data-testid', 'sjpp-sampleview-dictionary')
			.style('padding', '10px')
			.append('table')
			.style('border-collapse', 'collapse')
		const theadrow = table.append('thead').append('tr')
		const tbody = table.append('tbody')
		const visibleSamples = this.dictSamples.map(sample => this.sampleDataByTermId[sample.sampleId] || {})
		// for the column names, just need the first column name + sample data
		this.renderTHead(['', ...this.dictSamples.map(s => s.sampleName)], theadrow)
		const tBodyData = this.orderedVisibleTerms.map(term => [
			{ term }, // first column, no sample data
			// create data to bind for each sample column
			...visibleSamples.map(sample => ({ term, sample }))
		])
		this.renderTBody(tBodyData, tbody)
	}

	renderTHead(data, theadrow) {
		const trs = theadrow.selectAll('th').data(data)
		trs.exit().remove()
		trs.text(d => d)
		trs
			.enter()
			.append('th')
			.style('padding', '5px 10px')
			.style('text-align', 'end')
			.text(d => d)
	}

	renderTBody(data, tbody) {
		// d3 each() callbacks, given the element as nodes[i]
		const renderTr = (trData, i, nodes) => {
			const tds = select(nodes[i])
				.selectAll('td')
				.data(trData, (d: any) => d)
			tds.exit().remove()
			tds.each(renderTd)
			tds
				.enter()
				.append('td')
				.style('border-bottom', 'solid 1px rgb(245,245,245)')
				.style('text-align', (_d, j) => (j === 0 ? 'left' : 'center'))
				.style('padding', '2px 10px')
				.each(renderTd)
		}
		const renderTd = (d: any, i, nodes) => {
			const td = select(nodes[i])
			if (!d.sample) {
				// first column for tree dict variables
				this.renderTerm(td)
				return
			}
			const term = d.term
			const value = getTermValue(term, d.sample)
			const fromSample = d.sample[term.id]?.fromSample
			td.datum(d)
				.style('text-align', 'end')
				.style('padding', '5px 10px')
				.style('color', fromSample ? '#9ca3af' : '')
				.attr('title', fromSample ? `of ${fromSample}` : '')
				// !!! TODO: use getTermValue only for actual data !!!
				.text(d.sample[term.id]?.label || value)
			if (isNumericTerm(term))
				td.append('button')
					.style('margin-left', '5px')
					.text('Plot')
					.on('click', () => {
						const tw = { id: term.id, q: { mode: 'continuous' } }
						this.app.dispatch({ type: 'plot_create', config: { chartType: 'violin', term: tw, value } })
					})
		}
		const trs = tbody.selectAll('tr').data(data)
		trs.exit().remove()
		trs.each(renderTr)
		trs.enter().append('tr').each(renderTr)
	}

	renderTerm(td) {
		// must get the current data, since each row's data gets replaced
		// as child terms get inserted between each row
		const d = td.datum() // current data
		if (!td.select('span').size()) {
			const span = td.append('span')

			span
				.append('button')
				.style('border-width', 0)
				.style('border-radius', '5px')
				.style('width', '28px')
				.style('height', '28px')
				.style('cursor', 'pointer')
			span.append('span').style('margin-left', `3px`).style('cursor', 'pointer')
			td.on('click', () => this.toggleTerm(td.datum().term))
		}
		const leftIndent = (d.term.ancestry.length - 1) * 24
		const span = td.select(':scope>span').style('margin-left', `${leftIndent}px`)
		span
			.select('button')
			.style('display', d.term.isleaf ? 'none' : '')
			.html(this.config.expandedTermIds.includes(d.term.id) ? '-' : '+')
		span.select('span').text(d.term.name)
	}

	toggleTerm(term) {
		if (term.isleaf) return
		const expandedTermIds = this.config.expandedTermIds.slice() // create a copy
		const i = expandedTermIds.indexOf(term.id)
		if (i == -1) expandedTermIds.push(term.id)
		else expandedTermIds.splice(i, 1)
		this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { expandedTermIds }
		})
	}

	destroy() {
		this.clearDrawings()
		// the parked components, as the others are destroyed by the component api
		for (const child of this.childPlots.values())
			for (const c of Object.values(child.parked || {})) (c as any).destroy?.()
		/* remove the child plot configs, as ProteomeInput does: deferred until app.main() has finished
		destroying the deleted plots, and only when this plot's own config is gone */
		const app = this.app
		const parentId = this.id
		const plots = app.getState().plots
		const descendants = new Set([parentId])
		for (const id of descendants) {
			for (const p of plots) {
				if (p.parentId === id) descendants.add(p.id)
			}
		}
		const childIds = [...descendants].filter(id => id !== parentId).reverse()
		if (!childIds.length) return
		queueMicrotask(() => {
			const ids = new Set(app.getState().plots.map((p: any) => p.id))
			if (ids.has(parentId)) return
			for (const id of childIds) if (ids.has(id)) app.dispatch({ type: 'plot_delete', id })
		})
	}
}

export function getTermValue(term, data) {
	let value = data[term.id]?.value
	if (value == null || value == undefined || value == 'undefined') return null
	if (term.type == 'date') return getDateStrFromNumber(value)
	if (isNumericTerm(term)) {
		value = term.values?.[value]?.label || term.values?.[value]?.key || value
		if (isNaN(value)) return value
		return value % 1 == 0 ? value.toString() : value.toFixed(2).toString()
	}

	if (term.type == 'categorical') return term.values?.[value]?.label || term.values?.[value]?.key

	if (term.type == 'condition') {
		const values = value.toString().split(' ')
		const [years, statusKey] = values
		const status = term.values?.[statusKey]?.label || term.values?.[statusKey]?.key || statusKey
		return `Max grade: ${status}, Time to event: ${Number(years).toFixed(1)} years`
	}
	if (term.type == 'survival') {
		const values = value.split(' ')
		const [years, statusKey] = values
		const status = term.values?.[statusKey]?.label || term.values?.[statusKey]?.key || statusKey
		return `${status} after ${Number(years).toFixed(1)} years`
	}
	return null
}

export const sampleViewInit = getCompInit(SampleView)
export const componentInit = sampleViewInit

export async function getPlotConfig(opts: any) {
	const config = { activeCohort: 0, sample: null, expandedTermIds: [root_ID], hidePlotFilter: true }
	return copyMerge(config, opts)
}

/** the menu of the Sample View chart button: the sample picker, to open the sample view of the chosen sample */
export function makeChartBtnMenu(holder, chartsInstance) {
	const app = chartsInstance.app
	showSamplePicker({
		holder,
		vocabApi: app.vocabApi,
		filter: chartsInstance.state.termfilter?.filter,
		hasSampleAncestry: chartsInstance.state.termdbConfig?.hasSampleAncestry,
		onSelect: sample => {
			chartsInstance.dom.tip.hide()
			app.dispatch({ type: 'plot_create', config: { chartType: 'sampleView', sample } })
		}
	})
}
