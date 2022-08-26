import { getCompInit, copyMerge } from '../rx'
import { select } from 'd3-selection'
import { sayerror } from '../dom/error'
import { termsettingInit, fillTermWrapper, nonDictionaryTermTypes } from '#termsetting'
import { appInit } from '#termdb/app'

/*

*/

class DataDownload {
	constructor(opts) {
		this.type = 'dataDownload'
		this.genomeObj = opts.app.opts.genome
		this.pillBy$id = {}
	}

	async init(appState) {
		setInteractivity(this) // in cases of static viz, you don't use interactivity code
		setRenderers(this)

		this.dom = {
			header: this.opts.header, // header is optional
			errordiv: this.opts.holder.append('div'),
			titleDiv: this.opts.holder
				.append('div')
				.style('margin', '10px')
				.style('font-weight', 600),
			terms: this.opts.holder.append('div'),
			addBtn: this.opts.holder
				.append('div')
				.style('margin', '10px 10px 20px 10px')
				.style('cursor', 'pointer')
				.html('+Add Term(s)')
				.on('click', this.showTreeMenu),
			submitDiv: this.opts.holder.append('div').style('margin', '10px')
		}

		this.dom.submitBtn = this.dom.submitDiv
			.append('button')
			.html('Download')
			.on('click', this.download)

		this.dom.submitNote = this.dom.submitDiv
			.append('span')
			.style('margin-left', '5px')
			.style('font-style', 'italic')

		// this.id is from opts.id and assigned by rx
		const config = appState.plots.find(p => p.id === this.id)
	}

	getState(appState, sub) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}

		return {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config,
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken()
		}
	}

	/* do not set reactsTo
	so it reacts to all actions matching with the plot id (controlled by store method)
	including filter/cohort change
	*/
	async main() {
		try {
			this.config = JSON.parse(JSON.stringify(this.state.config))
			this.mayUpdateSandboxHeader()
			if (this.mayRequireToken()) return
			const reqOpts = await this.getDataRequestOpts()
			this.data = await this.app.vocabApi.getAnnotatedSampleData(reqOpts)
			this.processData()
			const n = this.activeSamples.length

			this.dom.submitBtn.property('disabled', n < 1)
			this.dom.submitNote.html(n ? `${n} samples` : 'no sample data')
			this.render()
		} catch (e) {
			sayerror(this.dom.errordiv, 'Error: ' + (e.error || e))
			if (e.stack) console.log(e.stack)
		}
	}

	mayUpdateSandboxHeader() {
		if (!this.dom.header) return
		// based on data in config state, but not section
		this.dom.header.html('<span>Data download</span>')
	}

	mayRequireToken() {
		if (this.state.hasVerifiedToken) {
			this.dom.titleDiv.html('Selected terms')
			this.dom.terms.style('display', '')
			this.dom.addBtn.style('display', '')
			this.dom.submitDiv.style('display', '')
			return false
		} else {
			this.dom.titleDiv.html('Requires login')
			this.dom.terms.style('display', 'none')
			this.dom.addBtn.style('display', 'none')
			this.dom.submitDiv.style('display', 'none')
			return true
		}
	}

	// creates an opts object for the vocabApi.getNestedChartsData()
	async getDataRequestOpts() {
		const terms = this.config.terms
		return { terms, filter: this.state.termfilter.filter }
	}

	processData() {
		const { lst, bySampleId } = this.data
		this.activeSamples = []
		for (const d of lst) {
			for (const tw of this.config.terms) {
				if (tw.term && tw.$id in d) {
					this.activeSamples.push(d)
					break
				}
			}
		}
	}

	async getNewPill(holder, d) {
		const pill = await termsettingInit({
			placeholder: '+Add term',
			holder,
			menuOptions: 'all',
			vocabApi: this.app.vocabApi,
			activeCohort: this.state.activeCohort,
			debug: this.app.opts.debug,
			usecase: { target: 'dataDownload' },
			numericEditMenuVersion: ['continuous', 'discrete'],
			abbrCutoff: 50,
			callback: tw => {
				const termsCopy = this.config.terms.slice(0)
				const i = this.config.terms.findIndex(tw => tw.$id === d.tw.$id)
				if (!tw?.term) {
					termsCopy.splice(i, 1)
				} else if (i === -1) {
					tw.$id = d.tw.$id
					termsCopy.push(tw)
				} else {
					tw.$id = d.tw.$id
					termsCopy[i] = tw
				}

				this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					chartType: 'dataDownload',
					config: {
						terms: termsCopy
					}
				})
			}
		})
		this.pillBy$id[d.tw.$id] = pill
		return pill
	}
}

export const dataDownloadInit = getCompInit(DataDownload)
// this alias will allow abstracted dynamic imports
export const componentInit = dataDownloadInit

const idSuffix = `_ts_${(+new Date()).toString().slice(-8)}_${Math.random()
	.toString()
	.slice(-6)}`
let $id = 0
function getTw$id() {
	return `${$id++}${idSuffix}`
}

function setRenderers(self) {
	self.render = function() {
		const data = self.config.terms.map(tw => {
			return { tw, pill: self.pillBy$id[tw.$id] }
		})
		//if (!data.find(d => !d.tw.term)) {
		//data.push({ tw: { $id: getTw$id() } })
		//}
		const terms = self.dom.terms.selectAll(':scope>div').data(data, d => d.tw.$id)
		terms.exit().remove()
		terms.each(self.renderTerm)
		terms
			.enter()
			.append('div')
			.each(self.addTerm)
	}

	self.addTerm = async function(d) {
		// console.log(136, 'addTerm()', d)
		const div = select(this)
			.style('display', 'inline-block')
			.style('width', 'fit-content')
			.style('margin', '10px')
			.style('padding', '5px')

		d.pill = await self.getNewPill(div, d)
		await d.pill.main({
			term: d.tw.term,
			q: d.tw.q,
			filter: self.state.filter,
			activeCohort: self.state.activeCohort
		})
	}

	self.renderTerm = async function(d) {
		// this should not happen, even empty terms have a pill
		if (!d.pill) throw `no pill on update renderTerm()`
		await d.pill.main({
			term: d.tw?.term,
			q: d.tw.q,
			filter: self.state.filter,
			activeCohort: self.state.activeCohort
		})
	}
}

function setInteractivity(self) {
	self.showTreeMenu = () => {
		self.app.tip.clear().showunder(self.dom.addBtn.node())
		appInit({
			holder: self.app.tip.d,
			vocabApi: self.app.vocabApi,
			state: {
				//vocab: self.state.vocab,
				activeCohort: self.state.activeCohort,
				nav: {
					header_mode: 'search_only'
				},
				tree: { usecase: self.type }
			},
			tree: {
				submit_lst: async termlst => {
					self.app.tip.hide()
					const tws = await Promise.all(
						termlst.map(async term => {
							const q = {}
							if (term.type == 'condition') q.mode = 'cox'
							const tw = { id: term.id, term, q }
							await fillTermWrapper(tw)
							return tw
						})
					)
					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: {
							terms: [...self.config.terms, ...tws]
						}
					})
				}
			}
		})
	}

	self.download = () => {
		const header = ['sample']
		for (const tw of self.config.terms) {
			header.push(tw.term.name)
			if (tw.term.type == 'condition') header.push(tw.term.name + ': Age at event')
		}
		const rows = [header]
		for (const s of self.activeSamples) {
			const samplename = self.data.refs.bySampleId[s.sample]
			const row = [samplename]
			for (const tw of self.config.terms) {
				if (!s[tw.$id]) row.push('')
				else {
					row.push(s[tw.$id].key)
					if (tw.term.type == 'condition') row.push(s[tw.$id].value)
				}
			}
			rows.push(row)
		}

		const matrix = rows.map(row => row.join('\t')).join('\n')
		const a = document.createElement('a')
		document.body.appendChild(a)
		a.addEventListener(
			'click',
			function() {
				a.download = 'cohortData.txt'
				a.href = URL.createObjectURL(new Blob([matrix], { type: 'text/tab-separated-values' }))
				document.body.removeChild(a)
			},
			false
		)
		a.click()
	}
}

let _ID_ = 1
export async function getPlotConfig(opts, app) {
	const id = 'id' in opts ? opts.id : `_DATADOWNLOAD_${_ID_++}`
	const config = { id, terms: [] }

	copyMerge(config, opts)
	for (const tw of config.terms) {
		fillTermWrapper(tw)
	}

	return config
}
