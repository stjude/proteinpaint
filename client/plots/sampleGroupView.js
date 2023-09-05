import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#termdb/app'
import { MassDict } from './dictionary.js'

class SampleGroupView {
	constructor(opts) {
		this.type = 'sampleGroupView'
		const mainDiv = opts.holder.append('div').style('padding', '20px')
		const treeDiv = mainDiv.insert('div').style('display', 'inline-block').style('vertical-align', 'top')
		this.dom = {
			mainDiv,
			treeDiv,
			header: opts.header
		}
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		this.sampleId2Name = await this.app.vocabApi.getAllSamples()
		this.trees = []
		const allSamples = Object.entries(this.sampleId2Name)
		for (const sample of config.samples) {
			const div = this.dom.mainDiv.insert('div').style('display', 'inline-block').style('vertical-align', 'top')
			const state = this.getState(appState)
			state.sample = sample
			const tree = await appInit({
				vocabApi: this.app.vocabApi,
				holder: div,
				state,
				tree: {
					click_term: _term => {
						const term = _term.term || _term
						this.app.dispatch({
							type: 'plot_create',
							config: {
								chartType: term.type == 'survival' ? 'survival' : 'summary',
								term: _term.term ? _term : 'id' in term ? { id: term.id, term } : { term }
							}
						})

						this.app.dispatch({
							type: 'plot_delete',
							id: this.id
						})
					}
				}
			})
			this.trees.push(tree)
		}
	}

	getState(appState) {
		let state = {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			selectdTerms: appState.selectedTerms,
			customTerms: appState.customTerms,
			termdbConfig: appState.termdbConfig
		}
		const config = appState.plots?.find(p => p.id === this.id)
		state.samples = config?.samples
		state.hasVerifiedToken = this.app.vocabApi.hasVerifiedToken()
		state.tokenVerificationPayload = this.app.vocabApi.tokenVerificationPayload

		return state
	}

	async main() {
		if (this.mayRequireToken()) return
		if (this.dom.header) {
			let title = 'Samples ' + this.state.samples.map(s => s.sampleName).join(', ')
			if (title.length > 100) title = title.substring(0, 100) + '...'
			this.dom.header.html(title)
		}
	}

	async downloadData() {
		const filename = `${this.state.sample.sampleName}.tsv`
		this.sampleData = await this.app.vocabApi.getSingleSampleData({ sampleId: this.state.sample.sampleId })
		let lines = ''
		for (const id in this.sampleData) {
			const term = this.sampleData[id].term
			let value = this.getTermValue(term)
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

export const sampleGroupViewInit = getCompInit(SampleGroupView)
export const componentInit = sampleGroupViewInit

export function getPlotConfig(opts, app) {
	// currently, there are no configurations options for
	// the dictionary tree; may add appearance, styling options later
	const config = {}
	// may apply overrides to the default configuration
	return copyMerge(config, opts)
}
