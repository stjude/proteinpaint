import { getCompInit, copyMerge } from '#rx'
import { select } from 'd3-selection'
import { controlsInit } from './controls'
import { getNormalRoot } from '#filter/filter'
import { dofetch3 } from '#common/dofetch'
import { DEFAULT_SAMPLE_TYPE, isNumericTerm, ROOT_SAMPLE_TYPE, getDateStrFromNumber } from '#shared/terms.js'
import { sayerror } from '../dom/sayerror.ts'

const root_ID = 'root'
const samplesLimit = 15

class SampleView {
	constructor(opts) {
		this.opts = opts
		this.type = 'sampleView'
		this.setDom(opts)
		setInteractivity(this)
		setRenderers(this)
	}

	setDom(opts) {
		const div = opts.holder.append('div')

		const controlsDiv = div.append('div').style('display', 'inline-block')
		const headerDiv = div.append('div').style('display', 'inline-block').style('padding', '20px')
		const contentDiv = div
			.append('div')
			.style('display', 'flex')
			.style('flex-direction', 'row')
			.style('flex-wrap', 'wrap')
			.style('justify-content', 'flex-start')
			.style('width', '100vw')

		const plotsDiv = contentDiv //div.append('div').style('display', 'inline-block').style('margin-top', '10px') //div with plots
		const sampleDiv = headerDiv.insert('div').style('display', 'inline-block')
		const showPlotsDiv = headerDiv.append('div').style('display', 'inline-block').style('vertical-align', 'top')

		this.dom = {
			header: opts.header,
			holder: opts.holder,
			controlsDiv,
			sampleDiv,
			showPlotsDiv,

			plotsDiv
		}
	}

	async init(appState) {
		this.termsByCohort = {}

		await this.setSampleSelect(appState)
		const state = this.getState(appState)

		await this.setControls(state)
	}

	async setSampleSelect(appState) {
		const config = appState.plots.find(p => p.id === this.id)

		const sampleDiv = this.dom.sampleDiv
		if (this.dom.header) this.dom.header.html(`Sample View`)

		if (config.samples && config.samples.length > 1) {
			const sampleLabel = sampleDiv.insert('label').style('vertical-align', 'top').html('Samples:')

			const select = sampleDiv
				.insert('select')
				.style('margin', '0px 5px')
				.property('multiple', true)
				.attr('id', 'select')
			select
				.selectAll('option')
				.data(config.samples)
				.enter()
				.append('option')
				.attr('value', d => d.sampleId)
				.property('selected', (d, i) => i < samplesLimit)
				.html((d, i) => d.sampleName)

			this.dom.noteDiv = sampleDiv
				.insert('div')
				.style('display', 'none')
				.style('vertical-align', 'top')
				.style('font-size', '0.8em')
				.style('color', '#aaa')
				.html(
					`*Note that only ${samplesLimit} samples can be selected.<br/>&nbsp;Navigate through the list to view all the samples.`
				)
			if (config.samples.length > samplesLimit) this.dom.noteDiv.style('display', 'inline-block')

			select.on('change', e => {
				const options = select.node().options
				const samples = []
				let count = 0
				for (const option of options) {
					if (option.selected) {
						if (count < samplesLimit) {
							const sampleId = Number(option.value)
							const sampleName = config.samples.find(s => s.sampleId == sampleId).sampleName
							const sample = { sampleId, sampleName }
							samples.push(sample)
							count++
						} else option.selected = false
					}
				}
				this.app.dispatch({ type: 'plot_edit', id: this.id, config: { samples } })
			})
		} else {
			this.samplesData = await this.app.vocabApi.getSamplesByName({
				filter: appState.termfilter?.filter
			})
			if (Object.keys(this.samplesData).length == 0) throw 'No accessible samples found'
			const callback = sampleName => {
				if (this.samplesData[sampleName]) {
					const samples = getSamplesRelated(this.samplesData, sampleName)

					this.app.dispatch({ type: 'plot_edit', id: this.id, config: { samples } })
					this.dom.downloadbt.property('disabled', false)
				} else {
					this.dom.tableDiv.style('display', 'none')
					for (const div of this.discoPlots) div.cellDiv.style('display', 'none')
					for (const div of Object.values(this.singleSamplePlots)) {
						div.forEach(p => p.cellDiv.style('display', 'none'))
					}
					for (const div of this.brainPlots) div.cellDiv.style('display', 'none')

					if (sampleName != '') {
						this.dom.downloadbt.property('disabled', true)
						const errorDiv = sampleDiv.append('div')
						sayerror(errorDiv, `Invalid sample ID: ${sampleName}. Please check the sample ID.`)
						setTimeout(() => {
							errorDiv.remove()
						}, 6000)
					}
				}
			}
			const hasSampleAncestry = appState.termdbConfig.hasSampleAncestry
			const sampleName = searchSampleInput(this.dom.sampleDiv, this.samplesData, hasSampleAncestry, callback)
			this.sample = config.sample || { sampleId: this.samplesData[sampleName].id, sampleName }

			this.dom.downloadbt = sampleDiv
				.insert('button')
				.style('margin-left', '10px')
				.style('vertical-align', 'top')
				.text('Download')
				.on('click', e => {
					this.downloadData()
				})
			this.dom.messageDiv = sampleDiv
				.insert('div')
				.style('display', 'inline-block')
				.style('display', 'none')
				.style('vertical-align', 'top')
				.html('&nbsp;&nbsp;Downloading data ...')
		}
	}

	getState(appState) {
		const config = appState.plots?.find(p => p.id === this.id)
		let samples = config.samples || getSamplesRelated(this.samplesData, this.sample.sampleName)

		if (config.samples?.length > 15) samples = config.samples.filter((s, i) => i < 15)
		const q = appState.termdbConfig.queries

		const state = {
			config,
			termfilter: appState.termfilter,
			// TODO: use state.config drectly, instead of having to extract
			// selected config.key-values into the component state
			activeCohort: config.activeCohort,
			terms: config.terms,
			expandedTermIds: config.expandedTermIds,
			samples,
			singleSampleGenomeQuantification: q?.singleSampleGenomeQuantification,
			singleSampleMutation: q?.singleSampleMutation,
			NIdata: q?.NIdata,
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
		if (this.mayRequireToken()) return
		this.config = structuredClone(this.state.config)
		this.settings = this.state.config.settings.sampleView
		this.dom.plotsDiv.selectAll('*').remove()

		this.termsById = this.getTermsById(this.state)
		this.sampleDataByTermId = {}
		const root = this.termsById[root_ID]
		root.terms = await this.requestTermRecursive(root)
		this.orderedVisibleTerms = this.getOrderedVisibleTerms(root)
		if (this.dom.downloadbt)
			this.dom.downloadbt.style('display', this.settings.showDictionary ? 'inline-block' : 'none')

		if (this.settings.showDictionary) this.renderSampleDictionary()
		this.dom.tableDiv.style('display', this.settings.showDictionary ? 'block' : 'none')

		await this.renderPlots(this.state, this.state.samples)
		this.showVisiblePlots()
	}

	async setControls(state) {
		const q = state.termdbConfig.queries
		const hasPlots =
			q?.singleSampleMutation ||
			q?.singleSampleGenomeQuantification ||
			q?.NIdata ||
			q?.images ||
			q?.DZImages ||
			q?.WSImages
		if (hasPlots) {
			this.dom.showPlotsDiv
				.append('input')
				.attr('id', 'showDictionary')
				.attr('type', 'checkbox')
				.property('checked', true)
				.on('change', e => {
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { sampleView: { showDictionary: e.target.checked } } }
					})
				})
			this.dom.showPlotsDiv.append('label').text('Show Dictionary').attr('for', 'showDictionary')
		}

		if (q?.DZImages) {
			this.dom.showPlotsDiv
				.append('input')
				.attr('id', 'showDzi')
				.attr('type', 'checkbox')
				.property('checked', true)
				.on('change', e => {
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { sampleView: { showDzi: e.target.checked } } }
					})
				})
			this.dom.showPlotsDiv.append('label').attr('for', 'showDzi').text('Show DZI images')
		}

		if (q?.WSImages) {
			this.dom.showPlotsDiv
				.append('input')
				.attr('id', 'showWsi')
				.attr('type', 'checkbox')
				.property('checked', true)
				.on('change', e => {
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { sampleView: { showWsi: e.target.checked } } }
					})
				})
			this.dom.showPlotsDiv.append('label').attr('for', 'showWsi').text('Show WSI images')
		}

		if (q?.singleSampleMutation) {
			this.dom.showPlotsDiv
				.append('input')
				.attr('type', 'checkbox')
				.property('checked', true)
				.attr('id', 'showDisco')
				.on('change', e => {
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { sampleView: { showDisco: e.target.checked } } }
					})
				})
			this.dom.showPlotsDiv.append('label').text('Show Disco').attr('for', 'showDisco')
		}

		if (q?.singleSampleGenomeQuantification) {
			for (const ssgqKey in q.singleSampleGenomeQuantification) {
				const label = ssgqKey.replace(/([a-z](?=[A-Z]))/g, '$1 ')

				this.dom.showPlotsDiv
					.append('input')
					.attr('type', 'checkbox')
					.property('checked', true)
					.attr('id', ssgqKey)
					.on('change', e => {
						this.app.dispatch({
							type: 'plot_edit',
							id: this.id,
							config: { settings: { sampleView: { [ssgqKey]: e.target.checked } } }
						})
					})
				this.dom.showPlotsDiv
					.append('label')
					.text('Show ' + label)
					.attr('for', ssgqKey)
			}
		}
		if (q?.images) {
			this.dom.showPlotsDiv
				.append('input')
				.attr('type', 'checkbox')
				.property('checked', true)
				.attr('id', 'showImages')
				.on('change', e => {
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { sampleView: { showImages: e.target.checked } } }
					})
				})
			this.dom.showPlotsDiv.append('label').text('Show Images').attr('for', 'showImages')
		}

		if (q?.NIdata) {
			this.dom.showPlotsDiv
				.append('input')
				.attr('type', 'checkbox')
				.property('checked', true)
				.attr('id', 'showBrainImaging')
				.on('change', e => {
					this.app.dispatch({
						type: 'plot_edit',
						id: this.id,
						config: { settings: { sampleView: { showBrainImaging: e.target.checked } } }
					})
				})
			this.dom.showPlotsDiv.append('label').text('Show brain imaging').attr('for', 'showBrainImaging')
		}
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

	async requestTermRecursive(term, _ancestry = [root_ID]) {
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
		const data = await this.app.vocabApi.getTermChildren(
			term,
			this.state.toSelectCohort ? this.state.cohortValuelst : null
		)
		if (data.error) throw data.error
		if (!data.lst || data.lst.length == 0) {
			// do not throw exception; its children terms may have been filtered out
			return []
		}
		const terms = []
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
				if (this.state.samples) await this.fillSampleData(copy.terms)
			} else {
				const t0 = this.termsById[copy.id]
				if (this.state.samples) await this.fillSampleData([copy])

				if (t0 && t0.terms) {
					copy.terms = t0.terms
				}
			}

			this.termsById[copy.id] = copy
		}
		return terms
	}

	getOrderedVisibleTerms(root) {
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

	sortVisibleTerms(currParent, remainingTerms, currOrder = []) {
		const unorderedTerms = []
		const orderedTerms = []
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

	async fillSampleData(terms) {
		const term_ids = []
		for (const term of terms) term_ids.push(term.id)
		for (const sample of this.state.samples) {
			const data = await this.app.vocabApi.getSingleSampleData({
				sampleId: sample.sampleId,
				term_ids,
				filter: this.state.termfilter.filter
			})
			if ('error' in data) throw data.error
			if (!this.sampleDataByTermId[sample.sampleId]) this.sampleDataByTermId[sample.sampleId] = {}
			for (const id in data) this.sampleDataByTermId[sample.sampleId][id] = data[id]
		}
	}

	async downloadData() {
		this.dom.messageDiv.style('display', 'block')
		this.dom.downloadbt.style('display', 'none')
		const filename = `samples.tsv`
		const sampleData = {}
		let lines = 'Sample'
		for (const sample of this.state.samples) {
			sampleData[sample.sampleId] = await this.app.vocabApi.getSingleSampleData({
				sampleId: sample.sampleId,
				filter: this.state.termfilter.filter
			})
			lines += `\t${sample.sampleName}`
		}
		lines += '\n'

		const sampleId = this.state.samples[0].sampleId
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

	showVisiblePlots() {
		this.visiblePlots = false
		this.showPlotsFromCategory(this.discoPlots, 'showDisco')
		for (const ssgqKey in this.state.singleSampleGenomeQuantification)
			this.showPlotsFromCategory(this.singleSamplePlots[ssgqKey], ssgqKey)
		this.showPlotsFromCategory(this.brainPlots, 'showBrain')
		this.showPlotsFromCategory(this.imagePlots, 'showImages')
		this.showPlotsFromCategory(this.dziPlots, 'showDzi')
		this.showPlotsFromCategory(this.wsiPlots, 'showWsi')
		if (this.state.samples.length == 1 && this.visiblePlots)
			this.dom.tableDiv.style('max-width', '48vw').style('max-height', '40vw').attr('class', 'sjpp_show_scrollbar')
		else this.dom.tableDiv.style('max-width', '').style('max-height', '').attr('class', '')
	}

	showPlotsFromCategory(plots, key) {
		for (const div of plots) {
			const visibleSample = this.state.samples.find(s => s.sampleName == div.sample.sampleName)
			const visiblePlot = this.settings[key] && visibleSample
			if (visiblePlot) this.visiblePlots = true
			div.cellDiv.style('display', visiblePlot ? 'table-cell' : 'none')
		}
	}

	async renderPlots(state, samples) {
		const plotsDiv = this.dom.plotsDiv
		this.discoPlots = []
		this.singleSamplePlots = {}
		this.brainPlots = []
		this.imagePlots = []
		this.dziPlots = []
		this.wsiPlots = []
		const q = state.termdbConfig.queries
		if (state.termdbConfig.queries?.DZImages) {
			let div = plotsDiv.append('div')
			if (state.samples.length == 1) div.style('display', 'inline-block').style('width', '50vw')
			for (const sample of samples) {
				const data = await dofetch3('sampledzimages', {
					body: {
						genome: this.app.opts.genome.name,
						dslabel: state.vocab.dslabel,
						sample_id: sample.sampleName
					}
				})
				if (data.sampleDZImages?.length > 0) {
					const cellDiv = div.append('div').style('display', 'inline-block')
					this.dziPlots.push({ sample, cellDiv })
					const dziviewer = await import('./dziviewer/plot.dzi.js')
					dziviewer.default(state.vocab.dslabel, cellDiv, this.app.opts.genome, sample.sampleName, data.sampleDZImages)
				}
			}
		}

		if (state.termdbConfig.queries?.WSImages) {
			let div = plotsDiv.append('div')
			if (state.samples.length == 1) div.style('display', 'inline-block').style('width', '50vw')
			for (const sample of samples) {
				const cellDiv = div.append('div').style('display', 'inline-block')
				this.wsiPlots.push({ sample, cellDiv })
				const wsiViewer = await import('./wsiviewer/plot.wsi.js')
				wsiViewer.default(state.vocab.dslabel, cellDiv, this.app.opts.genome, sample.sampleName)
			}
		}

		if (state.termdbConfig?.queries?.singleSampleMutation) {
			let div = plotsDiv.append('div')
			if (state.samples.length == 1) div.style('display', 'inline-block').style('width', '50vw')
			let someFound = false
			for (const sample of samples) {
				const cellDiv = div.append('div').style('display', 'inline-block')
				this.discoPlots.push({ sample, cellDiv })
				const header = cellDiv.insert('div')
				const discoPlotImport = await import('./plot.disco.js')
				const found = await discoPlotImport.default(
					state.termdbConfig,
					state.vocab.dslabel,
					{ sample_id: sample.sampleName },
					cellDiv,
					this.app.opts.genome,
					{}, //overrides
					false //showError
				)
				if (found) {
					if (state.samples.length > 1)
						header.style('font-weight', 'bold').style('padding-left', '20px').text(sample.sampleName)
					someFound = true
				}
			}
			this.dom.showPlotsDiv.select('input[id=showDisco').style('display', someFound ? 'inline-block' : 'none')
			this.dom.showPlotsDiv.select('label[for=showDisco').style('display', someFound ? 'inline-block' : 'none')
		}
		if (state.termdbConfig.queries?.singleSampleGenomeQuantification) {
			for (const k in state.termdbConfig.queries.singleSampleGenomeQuantification) {
				let someFound = false
				this.singleSamplePlots[k] = []
				let div = plotsDiv.append('div')
				if (state.samples.length == 1) div.style('display', 'inline-block').style('width', '50vw')
				for (const sample of samples) {
					const label = k.match(/[A-Z][a-z]+|[0-9]+/g).join(' ')
					const plotDiv = div.insert('div').style('display', 'table-cell').style('padding', '20px')
					this.singleSamplePlots[k].push({ sample, cellDiv: plotDiv })
					if (state.samples.length > 1)
						plotDiv.insert('div').style('font-weight', 'bold').text(`${sample.sampleName} ${label}`)
					const ssgqImport = await import('./plot.ssgq.js')
					const found = await ssgqImport.plotSingleSampleGenomeQuantification(
						state.termdbConfig,
						state.vocab.dslabel,
						k,
						{ sample_id: sample.sampleName },
						plotDiv.insert('div'),
						this.app.opts.genome,
						null, //geneName
						false //showError
					)
					if (found) someFound = true
				}
				this.dom.showPlotsDiv.select(`input[id=${k}`).style('display', someFound ? 'inline-block' : 'none')
				this.dom.showPlotsDiv.select(`label[for=${k}`).style('display', someFound ? 'inline-block' : 'none')
			}
		}
		if (state.termdbConfig.queries?.NIdata) {
			let div = plotsDiv.append('div')
			if (state.samples.length == 1) div.style('display', 'inline-block')

			for (const k in state.termdbConfig.queries?.NIdata) {
				let div = plotsDiv.append('div')
				if (state.samples.length == 1) div.style('display', 'inline-block').style('width', '50vw')
				for (const sample of samples) {
					const plotDiv = div.insert('div').style('display', 'inline-block')
					this.brainPlots.push({ sample, cellDiv: plotDiv })
					if (state.samples.length > 1)
						plotDiv.insert('div').style('font-weight', 'bold').style('padding-left', '20px').text(sample.sampleName)

					const brainImagingImport = await import('./plot.brainImaging.js')
					brainImagingImport.default(
						state.termdbConfig,
						state.vocab.dslabel,
						k,
						{ sample_id: sample.sampleName },
						plotDiv,
						this.app.opts.genome
					)
				}
			}
		}
		if (state.termdbConfig?.queries?.images) {
			let div = plotsDiv.append('div')
			if (state.samples.length == 1) div.style('display', 'inline-block').style('width', '50vw')
			for (const sample of samples) {
				const cellDiv = div.append('div').style('display', 'inline-block')
				this.imagePlots.push({ sample, cellDiv })
				if (state.samples.length > 1)
					cellDiv.insert('div').style('font-weight', 'bold').style('padding-left', '20px').text(sample.sampleName)
				const imagePlotImport = await import('./imagePlot.js')
				imagePlotImport.renderImagePlot(state, cellDiv, sample)
			}
		}
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

	if (term.type == 'categorical') return term.values[value]?.label || term.values[value]?.key

	if (term.type == 'condition') {
		const values = value.toString().split(' ')
		let [years, status] = values
		status = term.values[status].label || term.values[status].key
		return `Max grade: ${status}, Time to event: ${Number(years).toFixed(1)} years`
	}
	if (term.type == 'survival') {
		const values = value.split(' ')
		let [years, status] = values
		status = term.values?.[status]?.label || term.values?.[status]?.key || status
		return `${status} after ${Number(years).toFixed(1)} years`
	}
	return null
}

export const sampleViewInit = getCompInit(SampleView)
export const componentInit = sampleViewInit

function setRenderers(self) {
	self.renderSampleDictionary = function () {
		this.dom.tableDiv = this.dom.plotsDiv.append('div').style('display', 'inline-block').style('padding', '20px')
		const table = this.dom.tableDiv.append('table').style('border-collapse', 'collapse')
		const thead = table.append('thead')
		const theadrow = thead.append('tr')
		const tbody = table.append('tbody')
		// use an array to support multiple visible samples,
		// but prototyping with just one sample for now
		const visibleSamples = []
		for (const sample of self.state.samples) visibleSamples.push(self.sampleDataByTermId[sample.sampleId])
		// for the column names, just need the first column name + sample data
		self.renderTHead(['', ...self.state.samples.map(s => s.sampleName)], theadrow)
		const tBodyData = self.orderedVisibleTerms.map((term, trIndex) => [
			{ term }, // first column, no sample data
			// create data to bind for each sample column
			...visibleSamples.map(sample => ({ term, sample }))
		])
		self.renderTBody(tBodyData, tbody)
	}

	self.renderTHead = function (data, theadrow) {
		const trs = theadrow.selectAll('th').data(data)
		trs.exit().remove()
		trs.html(self.getThHtml)
		trs.enter().append('th').style('padding', '5px 10px').style('text-align', 'end').html(self.getThHtml)
	}

	self.getThHtml = d => d

	self.renderTBody = function (data, tbody) {
		const trs = tbody.selectAll('tr').data(data)
		trs.exit().remove()
		trs.each(self.renderTr)
		trs.enter().append('tr').each(self.renderTr)
	}

	self.renderTr = function (trData, trIndex) {
		const tds = select(this)
			.selectAll('td')
			.data(trData, d => d)
		tds.exit().remove()
		tds.each(self.renderTd)
		tds
			.enter()
			.append('td')
			.style('border-bottom', 'solid 1px rgb(245,245,245)')
			.style('text-align', (d, i) => (i === 0 ? 'left' : 'center'))
			.style('padding', '2px 10px')
			.each(self.renderTd)
	}

	self.renderTd = function (d, i) {
		if (!d.sample) {
			// first column for tree dict variables
			self.renderTerm(select(this))
			return
		}
		//const sampleId = Number(d.sample.sampleId)
		const data = d.sample
		const term = d.term
		const isNumeric = isNumericTerm(term)
		const value = getTermValue(d.term, d.sample)
		const td = select(this)
			.datum(d)
			.style('text-align', 'end')
			.style('padding', '5px 10px')

			// !!! TODO: use getTermValue only for actual data !!!
			.html(d.sample[d.term.id]?.label || value)
		if (isNumeric)
			td.append('button')
				.style('margin-left', '5px')
				.text('Plot')
				.on('click', e => {
					const tw = { id: term.id, q: { mode: 'continuous' } }
					self.app.dispatch({ type: 'plot_create', config: { chartType: 'violin', term: tw, value } })
				})
	}

	self.renderTerm = function (td) {
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
			td.on('click', self.toggleTerm)
		}
		const leftIndent = (d.term.ancestry.length - 1) * 24
		const span = td.select(':scope>span').style('margin-left', `${leftIndent}px`)
		const btn = span
			.select('button')
			.style('display', d.term.isleaf ? 'none' : '')
			.html(self.config.expandedTermIds.includes(d.term.id) ? '-' : '+')
		span.select('span').html(d.term.name)
		return
	}
}

function setInteractivity(self) {
	self.toggleTerm = function () {
		const d = select(this).datum()
		if (d.term.isleaf) return
		const expandedTermIds = self.config.expandedTermIds.slice() // create a copy
		const i = expandedTermIds.indexOf(d.term.id)
		if (i == -1) expandedTermIds.push(d.term.id)
		else expandedTermIds.splice(i, 1)
		self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { expandedTermIds }
		})
	}
}

export async function getPlotConfig(opts, app) {
	const q = app.getState()?.termdbConfig?.queries
	const settings = {
		sampleView: {
			showDictionary: true,
			showDisco: true,
			showBrain: true,
			showImages: true,
			showDzi: true,
			showWsi: true
		}
	}
	if (q)
		//Init show property for each genome quantification plot to true
		for (const ssgqKey in q.singleSampleGenomeQuantification) settings.sampleView[ssgqKey] = true
	const config = { activeCohort: 0, sample: null, expandedTermIds: [root_ID], settings }
	return copyMerge(config, opts)
}

export function searchSampleInput(holder, samplesData, hasSampleAncestry, callback, keyUpCallback) {
	const limit = 100
	const allSamples = []
	for (const sample in samplesData) {
		const sample_type = samplesData[sample].sample_type
		if (
			sample_type == ROOT_SAMPLE_TYPE ||
			sample_type == null ||
			(!hasSampleAncestry && sample_type == DEFAULT_SAMPLE_TYPE)
		)
			//If the dataset has no ancestors, all the samples should be root'
			allSamples.push(sample)
	}
	const isBigDataset = allSamples.length > 10000

	if (allSamples.length == 0)
		//Happens if it requires sign in first
		return
	const sampleName = allSamples[0]
	const input = holder
		.append('input')
		.attr('list', 'sampleDatalist')
		.property('autocomplete', 'off')
		.attr('placeholder', sampleName)
		.style('width', '250px')

	holder.style('opacity', '0.8')
	const datalist = holder.append('datalist').attr('id', 'sampleDatalist')
	addOptions(allSamples)
	input.on('keyup', e => {
		datalist.selectAll('*').remove()
		const str = input.node().value.toLowerCase()
		if (keyUpCallback) keyUpCallback(str)
		const options = []
		for (const sample of allSamples) {
			if (sample.toLowerCase().startsWith(str)) options.push(sample)
			if (options.length == limit && allSamples.length > 10000) break
		}
		for (const sample of allSamples) {
			if (sample.toLowerCase().includes(str) && !options.includes(sample)) options.push(sample)
			if (options.length == limit && allSamples.length > 10000) break
		}
		if (options.length > 1 || (options.length == 1 && input.node().value != options[0])) addOptions(options, this)
	})
	input.on('change', e => {
		const sampleName = input.node().value
		callback(sampleName)
	})
	function addOptions(options) {
		datalist
			.selectAll('option')
			.data(options.filter((s, i) => i < limit))
			.enter()
			.append('option')
			.attr('value', d => d)
			.attr(
				'label',
				(d, i) =>
					getLabel(d) +
					(i + 1 == limit
						? isBigDataset
							? ` Showing first ${i + 1} hits`
							: ` Showing ${i + 1} of ${options.length} hits`
						: i + 1 === options.length && i > 0
						? `  (Found ${options.length} hits)`
						: '')
			)
	}

	function getLabel(sampleName) {
		const samples = getSamplesRelated(samplesData, sampleName)
		return samples.map(s => s.sampleName).join(' > ')
	}
	return sampleName
}

//Get samples related through parent
export function getSamplesRelated(samplesData, sampleName) {
	let lastName = sampleName
	const samplesArray = Object.values(samplesData)
	let lastSample = samplesArray.find(s => s.ancestor_name == lastName)
	while (lastSample) {
		lastName = lastSample.name
		lastSample = samplesArray.find(s => s.ancestor_name == lastName)
	}
	let sampleData = samplesData[lastName]
	if (!sampleData) return []
	const samples = [{ sampleId: sampleData.id, sampleName: sampleData.name }]
	while (sampleData.ancestor_name) {
		if (samplesData[sampleData.ancestor_name]?.sample_type != ROOT_SAMPLE_TYPE)
			//not a root sample
			samples.unshift({ sampleId: sampleData.ancestor_id, sampleName: sampleData.ancestor_name })
		sampleData = samplesData[sampleData.ancestor_name]
	}
	return samples
}
