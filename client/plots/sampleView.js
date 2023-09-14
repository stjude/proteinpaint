import { getCompInit, copyMerge } from '#rx'
import { MassDict } from './dictionary.js'
import { getTermValue } from '../termdb/tree.js'
import { select } from 'd3-selection'

const root_ID = 'root'

class SampleView {
	constructor(opts) {
		this.type = 'sampleView'
		this.setDom(opts)
		setInteractivity(this)
		setRenderers(this)
	}

	setDom(opts) {
		const mainDiv = opts.holder.append('div')
		const sampleDiv = mainDiv.insert('div') //.style('display', 'none')
		const tableDiv = mainDiv.insert('div').style('padding', '10px')
		const table = tableDiv.append('table')
		const thead = table.append('thead')
		this.dom = {
			header: opts.header,
			holder: opts.holder,
			mainDiv,
			sampleDiv,
			tableDiv,
			table,
			thead,
			theadrow: thead.append('tr'),
			tbody: table.append('tbody'),
			contentDiv: mainDiv
				.insert('div')
				.style('display', 'none')
				.style('vertical-align', 'top')
				.insert('div')
				//.style('width', '60%')
				.style('display', 'flex')
				.style('min-height', '500px')
				.style('flex-direction', 'column')
				.style('justify-content', 'center')
				.style('align-items', 'start')
			//.style('border-left', '1px solid gray')
		}
	}

	async init(appState) {
		const state = this.getState(appState)
		const config = appState.plots.find(p => p.id === this.id)
		this.termsByCohort = {}
		this.sampleId2Name = await this.app.vocabApi.getAllSamples()
		const samples = Object.entries(this.sampleId2Name)
		this.sample = config.sample || { sampleId: samples[0][0], sampleName: samples[0][1] }

		const div = this.dom.sampleDiv.style('display', 'block')
		div.insert('label').html('&nbsp;Sample:')

		this.select = div.append('select').style('margin', '0px 5px')
		this.select
			.selectAll('option')
			.data(samples)
			.enter()
			.append('option')
			.attr('value', d => d[0])
			.property('selected', d => d[0] == this.sample.sampleId)
			.html((d, i) => d[1])
		this.select.on('change', e => {
			const sampleId = this.select.node().value
			const sampleName = this.sampleId2Name[sampleId]
			this.sample = { sampleId, sampleName }
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { sample: this.sample } })
		})

		div
			.insert('button')
			.text('Download data')
			.on('click', e => {
				this.downloadData()
			})

		if (state.showContent) this.dom.contentDiv.style('display', 'inline-block')
	}

	getState(appState) {
		const config = appState.plots?.find(p => p.id === this.id)
		const q = appState.termdbConfig.queries
		const state = {
			config,
			// TODO: use state.config drectly, instead of having to extract
			// selected config.key-values into the component state
			activeCohort: config.activeCohort,
			sample: config?.sample || this.sample,
			terms: config.terms,
			expandedTermIds: config.expandedTermIds,
			samples: [this.sample], //for the tree
			singleSampleGenomeQuantification: q?.singleSampleGenomeQuantification,
			singleSampleMutation: q?.singleSampleMutation,
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken(),
			tokenVerificationPayload: this.app.vocabApi.tokenVerificationPayload,
			showContent: q.singleSampleGenomeQuantification || q.singleSampleMutation
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
		if (this.dom.header) this.dom.header.html(`Sample View`)
		this.termsById = this.getTermsById(this.state)
		this.sampleDataByTermId = {}
		const root = this.termsById[root_ID]
		root.terms = await this.requestTermRecursive(root)
		this.orderedVisibleTerms = this.getOrderedVisibleTerms(root)
		this.render()
		// if (this.state.showContent) {
		// 	const sample = { sample_id: this.sample.sampleName }

		// 	this.dom.contentDiv.selectAll('*').remove()
		// 	if (this.state.termdbConfig.queries?.singleSampleMutation) {
		// 		const div = this.dom.contentDiv
		// 		div.append('div').style('font-weight', 'bold').style('padding-left', '20px').text('Disco plot')
		// 		const discoPlotImport = await import('./plot.disco.js')
		// 		discoPlotImport.default(
		// 			this.state.termdbConfig,
		// 			this.state.vocab.dslabel,
		// 			sample,
		// 			div.append('div'),
		// 			this.app.opts.genome
		// 		)
		// 	}
		// 	if (this.state.termdbConfig.queries.singleSampleGenomeQuantification) {
		// 		for (const k in this.state.termdbConfig.queries.singleSampleGenomeQuantification) {
		// 			const div = this.dom.contentDiv.append('div').style('padding', '20px')
		// 			const label = k.match(/[A-Z][a-z]+|[0-9]+/g).join(' ')
		// 			div.append('div').style('padding-bottom', '20px').style('font-weight', 'bold').text(label)
		// 			const ssgqImport = await import('./plot.ssgq.js')
		// 			await ssgqImport.plotSingleSampleGenomeQuantification(
		// 				this.state.termdbConfig,
		// 				this.state.vocab.dslabel,
		// 				k,
		// 				sample,
		// 				div.append('div'),
		// 				this.app.opts.genome
		// 			)
		// 		}
		// 	}
		// }
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

		TODO determine when to re-request cached server response as needed

		CAUTION
		will be great if tree_collapse will not trigger this function
		but hard to do given that main() has no way of telling what action was dispatched
		to prevent previously loaded .terms[] for the collapsing term from been wiped out of termsById,
		need to add it back TERMS_ADD_BACK
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
		for (const t of data.lst) {
			t.parent_id = _ancestry.slice(-1)[0]
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
		const orderedTerms = this.sortVisibleTerms(this.termsById[root_ID], visibleTerms)
		return orderedTerms
	}

	isVisibleTermId(term) {
		if (term.parent_id == root_ID || !term.ancestry) return true
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
			//console.log(288, term.id, term.parent_id, currParent.id)
			if (term.parent_id == currParent.id) {
				orderedTerms.push(term)
			} else unorderedTerms.push(term)
		}
		if (unorderedTerms.length) {
			for (const term of orderedTerms) {
				currOrder.push(term)
				this.sortVisibleTerms(term, unorderedTerms, currOrder)
			}
		} else {
			currOrder.push(...orderedTerms)
		}
		return currOrder
	}

	async fillSampleData(terms) {
		const term_ids = []
		for (const term of terms) term_ids.push(term.id)
		for (const sample of this.state.samples) {
			const data = await this.app.vocabApi.getSingleSampleData({ sampleId: sample.sampleId, term_ids })
			if ('error' in data) throw data.error
			if (!this.sampleDataByTermId[sample.sampleId]) this.sampleDataByTermId[sample.sampleId] = structuredClone(sample)
			for (const id in data) this.sampleDataByTermId[sample.sampleId][id] = data[id]
		}
	}

	async downloadData() {
		const filename = `${this.state.sample.sampleName}.tsv`
		this.sampleData = await this.app.vocabApi.getSingleSampleData({ sampleId: this.state.sample.sampleId })
		let lines = ''
		for (const id in this.sampleData) {
			const term = this.sampleData[id].term
			let value = getTermValue(term, this.sampleData)
			if (value == null) continue
			lines += `${term.name}\t${value}\n`
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
	}

	mayRequireToken() {
		if (this.state.hasVerifiedToken) {
			this.dom.mainDiv.style('display', 'block')
			return false
		} else {
			const e = this.state.tokenVerificationPayload
			const missingAccess = e?.error == 'Missing access' && this.state.termdbConfig.dataDownloadCatch?.missingAccess
			const message = missingAccess?.message?.replace('MISSING-ACCESS-LINK', missingAccess?.links[e?.linkKey])
			const helpLink = this.state.termdbConfig.dataDownloadCatch?.helpLink
			this.dom.mainDiv
				.style('color', '#e44')
				.html(
					message ||
						(this.state.tokenVerificationMessage || 'Requires sign-in') +
							(helpLink ? ` <a href='${helpLink}' target=_blank>Tutorial</a>` : '')
				)

			return true
		}
	}
}

export const sampleViewInit = getCompInit(SampleView)
export const componentInit = sampleViewInit

function setRenderers(self) {
	self.render = function () {
		// use an array to support multiple visible samples,
		// but prototyping with just one sample for now
		const visibleSamples = [self.sampleDataByTermId[this.state.sample.sampleId]]
		// for the column names, just need the first column name + sample data
		self.renderTHead([{ name: 'Variable' }, ...visibleSamples])
		const tBodyData = self.orderedVisibleTerms.map((term, trIndex) => [
			{ term }, // first column, no sample data
			// create data to bind for each sample column
			...visibleSamples.map(sample => ({ term, sample }))
		])
		self.renderTBody(tBodyData)
	}

	self.renderTHead = function (data) {
		const trs = self.dom.theadrow.selectAll('th').data(data)
		trs.exit().remove()
		trs.html(self.getThHtml)
		trs.enter().append('th').style('padding', '10px').html(self.getThHtml)
	}

	self.getThHtml = d => d.sampleName || d.name

	self.renderTBody = function (data) {
		//console.log(326, data, self.dom.tbody.node())
		const trs = self.dom.tbody.selectAll('tr').data(data)
		trs.exit().remove()
		trs.each(self.renderTr)
		trs.enter().append('tr').each(self.renderTr)
	}

	self.renderTr = function (trData, trIndex) {
		//console.log(338, trData)
		const tds = select(this)
			.selectAll('td')
			.data(trData, d => d)
		tds.exit().remove()
		tds.each(self.renderTd)
		tds
			.enter()
			.append('td')
			.style('color', 'gray')
			.style('padding', '0 16px')
			.style('text-align', 'end')
			.style('border', '1px solid white')
			.style('text-align', (d, i) => (i === 0 ? 'left' : 'center'))
			.each(self.renderTd)
	}

	self.renderTd = function (d, i) {
		//console.log(354, d)
		if (!d.sample) {
			// first column for tree dict variables
			self.renderTerm(select(this))
			return
		}
		//const sampleId = Number(d.sample.sampleId)
		const data = d.sample
		const term = d.term
		select(this)
			.datum(d)
			// !!! TODO: use getTermValue only for actual data !!!
			.html(d.sample[d.term.id]?.label || getTermValue(d.term, d.sample))
	}

	self.renderTerm = function (td) {
		// must get the current data, since each row's data gets replaced
		// as child terms get inserted between each row
		const d = td.datum() // current data
		if (!td.select('span').size()) {
			const span = td.append('span')
			span
				.append('button')
				.style('display', 'none')
				.style('padding', '0 3px')
				.style('width', '24px')
				.style('cursor', 'pointer')
			span.append('span').style('margin-left', `3px`).style('cursor', 'pointer')
			td.on('click', function () {
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
			})
		}
		const leftIndent = d.term.ancestry.length * 24
		const span = td.select(':scope>span').style('margin-left', `${leftIndent}px`)
		const btn = span
			.select('button')
			.style('display', d.term.isleaf ? 'none' : '')
			.html(self.config.expandedTermIds.includes(d.term.id) ? '-' : '+')
		span.select('span').html(d.term.name)
		return
	}
}

function setInteractivity(self) {}

export async function getPlotConfig(opts) {
	const config = { activeCohort: 0, sample: null, expandedTermIds: [root_ID] }
	return copyMerge(config, opts)
}
