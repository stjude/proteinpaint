import { getCompInit, copyMerge } from '#rx'
import { select } from 'd3-selection'
import { sayerror } from '#dom/error'
import { termsettingInit, fillTermWrapper } from '#termsetting'

/*

this {}
	config {}
		terms []
			// each element { $id, id, isAtomic, tw, pill }
			// list of TW tracked in state
	activeSamples[]
		{ sample:'1', sampleName:str, <$tid>:Value, ...}
	genomeObj
	pillBy$id
	state{}
	termdbConfig{}
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
			titleDiv: this.opts.holder.append('div').style('margin', '10px'),
			// the whole holder has white-space=nowrap (likely from sjpp-output-sandbox-content)
			terms: this.opts.holder.append('div').style('white-space', 'normal'),
			submitDiv: this.opts.holder.append('div').style('margin', '10px')
		}

		this.dom.submitBtn = this.dom.submitDiv.append('button').html('Download').on('click', this.download)

		this.dom.submitNote = this.dom.submitDiv.append('span').style('margin-left', '5px').style('font-style', 'italic')
	}

	getState(appState, sub) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}

		this.termdbConfig = appState.termdbConfig

		return {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			config,
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken(),
			tokenVerificationPayload: this.app.vocabApi.tokenVerificationPayload
		}
	}

	/* do not set reactsTo
	so it reacts to all actions matching with the plot id (controlled by store method)
	including filter/cohort change
	*/
	async main() {
		try {
			this.config = structuredClone(this.state.config)
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
			this.dom.titleDiv.style('color', '').html('Selected terms')
			this.dom.terms.style('display', '')
			this.dom.submitDiv.style('display', '')
			return false
		} else {
			const e = this.state.tokenVerificationPayload
			const missingAccess = e?.error == 'Missing access' && this.termdbConfig.dataDownloadCatch?.missingAccess
			const message = missingAccess?.message?.replace('MISSING-ACCESS-LINK', missingAccess?.links[e?.linkKey])
			const helpLink = this.termdbConfig.dataDownloadCatch?.helpLink

			this.dom.titleDiv
				.style('color', '#e44')
				.html(
					message ||
						(this.state.tokenVerificationMessage || 'Requires sign-in') +
							(helpLink ? ` <a href='${helpLink}' target=_blank>Tutorial</a>` : '')
				)
			this.dom.terms.style('display', 'none')
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
			placeholder: '+Add variable',
			holder,
			menuOptions: 'all',
			vocabApi: this.app.vocabApi,
			activeCohort: this.state.activeCohort,
			debug: this.app.opts.debug,
			usecase: { target: 'dataDownload' },
			numericEditMenuVersion: ['continuous', 'discrete'],
			noTermPromptOptions: this.getNoTermPromptOptions(),
			genomeObj: this.genomeObj,
			abbrCutoff: 50,
			defaultQ4fillTW: {
				condition: { mode: 'cuminc' },
				numeric: { mode: 'continuous' }
			},
			callback: tw => {
				const termsCopy = this.config.terms.slice(0)
				const i = this.config.terms.findIndex(tw => tw.$id === d.tw.$id)
				if (!tw?.term) {
					termsCopy.splice(i, 1)
				} else if (i === -1) {
					tw.$id = d.tw.$id
					if (!tw.q?.mode && (tw.term.type == 'integer' || tw.term.type == 'float')) {
						tw.q.mode = 'continuous'
					}
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

	getNoTermPromptOptions() {
		const lst = []
		if (this.termdbConfig.allowedTermTypes.includes('snplst')) {
			lst.push({
				termtype: 'snplst',
				text: 'A list of variants',
				q: {
					doNotRestrictAncestry: 1,
					geneticModel: 3, // by genotype
					AFcutoff: 0 // do not drop any
				}
			})
		}
		if (this.termdbConfig.allowedTermTypes.includes('snplocus')) {
			lst.push({
				termtype: 'snplocus',
				text: 'Variants from a locus',
				q: {
					doNotRestrictAncestry: 1,
					geneticModel: 3, // by genotype
					AFcutoff: 0 // do not drop any
				}
			})
		}
		if (lst.length) lst.unshift({ isDictionary: true, text: 'Dictionary variable' })
		return lst
	}
}

export const dataDownloadInit = getCompInit(DataDownload)
// this alias will allow abstracted dynamic imports
export const componentInit = dataDownloadInit

const idSuffix = `_ts_${(+new Date()).toString().slice(-8)}_${Math.random().toString().slice(-6)}`
let $id = 0
function getTw$id() {
	return `${$id++}${idSuffix}`
}

function setRenderers(self) {
	self.render = function () {
		// duplicate the array, so as to insert blank term into array
		const data = self.config.terms.map(tw => {
			return { tw, pill: self.pillBy$id[tw.$id] }
		})

		// terms[] from state will not contain blank tw
		// insert an element without a tw, to show the blank prompt for selecting new terms
		// tw.$id is needed to know which pill div needs to be re-rendered once a term is selected or replaced,
		// this helps maintain the visual order of the pills
		data.push({ tw: { $id: getTw$id() } })

		const terms = self.dom.terms.selectAll(':scope>.sja-data-download-term').data(data, d => d.tw?.$id)
		terms.exit().remove()
		terms.each(self.renderTerm)
		terms.enter().append('div').attr('class', 'sja-data-download-term').each(self.addTerm)
	}

	self.addTerm = async function (d) {
		const div = select(this)
			// allow to show blank prompt in a new line, where all selected terms are in one row
			.style('display', d.tw?.term ? 'inline-block' : 'block')
			.style('width', 'fit-content')
			.style('margin', '10px')
			.style('padding', '5px')

		d.pill = await self.getNewPill(div, d)
		await d.pill.main({
			term: d.tw?.term,
			q: d.tw?.q,
			filter: self.state.termfilter.filter,
			activeCohort: self.state.activeCohort,
			numericEditMenuVersion: ['continuous', 'discrete']
		})
	}

	self.renderTerm = async function (d) {
		// this should not happen, even empty terms have a pill
		if (!d.pill) throw `no pill on update renderTerm()`

		select(this).style('display', d.tw.term ? 'inline-block' : 'block')

		await d.pill.main({
			term: d.tw?.term,
			q: d.tw.q,
			filter: self.state.termfilter.filter,
			activeCohort: self.state.activeCohort
		})
	}
}

function setInteractivity(self) {
	self.download = async () => {
		const header = ['sample']
		for (const tw of self.config.terms) {
			if (tw.term.type == 'condition') {
				header.push(`${tw.term.name}_event (0=censored, 1=grade ${tw.q.breaks[0]}-5, 2=non-${tw.term.name} death)`) // TODO: should retrieve from dataset
				header.push(`${tw.term.name}_time (years from diagnosis to event)`) // TODO: should retrieve from dataset
			} else if (tw.term.snps) {
				for (const s of tw.term.snps) {
					// {snpid, rsid, }
					header.push(s.snpid)
				}
			} else {
				header.push(tw.term.name)
			}
		}
		const rows = [header]
		for (const s of self.activeSamples) {
			// {sample:'integer', sampleName:str, <termId>:{} }

			// sample name as 1st col
			const row = [s.sampleName || self.data.refs.bySampleId[s.sample]]

			for (const tw of self.config.terms) {
				if (!s[tw.$id]) row.push('')
				else {
					if (tw.term.type == 'condition') {
						row.push(s[tw.$id].key, s[tw.$id].value)
					} else if (tw.term.snps) {
						for (const snp of tw.term.snps) {
							row.push(s[tw.$id]?.[snp.snpid] || '.')
						}
					} else {
						const v = tw.term.values?.[s[tw.$id].key] || s[tw.$id]
						row.push(v.label || v.key)
					}
				}
			}
			rows.push(row)
		}

		const matrix = rows.map(row => row.join('\t')).join('\n')
		const a = document.createElement('a')
		document.body.appendChild(a)
		a.addEventListener(
			'click',
			function () {
				a.download = 'cohortData.txt'
				a.href = URL.createObjectURL(new Blob([matrix], { type: 'text/tab-separated-values' }))
				document.body.removeChild(a)
			},
			false
		)
		a.click()
		self.app.vocabApi.trackDsAction({
			action: 'download',
			details: {
				terms: self.config.terms.map(tw => (!('id' in tw.term) ? tw.term.name : tw.term.id)),
				filter: self.state.termfilter.filter
			}
		})
	}
}

let _ID_ = 1
export async function getPlotConfig(opts, app) {
	// app = {vocabApi}
	const id = 'id' in opts ? opts.id : `_DATADOWNLOAD_${_ID_++}`
	const config = { id, terms: [] }

	copyMerge(config, opts)
	for (const tw of config.terms) {
		await fillTermWrapper(tw, app.vocabApi)
	}

	return config
}
