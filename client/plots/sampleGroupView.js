import { getCompInit, copyMerge } from '#rx'
import { MassDict } from './dictionary.js'
import { getTermValue } from '../termdb/tree.js'

class SampleGroupView extends MassDict {
	constructor(opts) {
		super(opts)
		this.type = 'sampleGroupView'
		this.dom.treeDiv.style('position', 'relative')
		this.dom.sampleDiv = this.dom.treeDiv.insert('div')
	}

	async init(appState) {
		await super.init(appState)
		const config = appState.plots.find(p => p.id === this.id)
		const label = this.dom.sampleDiv
			.insert('label')
			.attr('for', 'select')
			.style('vertical-align', 'top')
			.html('&nbsp;Samples:')

		this.select = this.dom.sampleDiv
			.append('select')
			.property('multiple', true)
			.style('margin', '0px 5px')
			.attr('id', 'select')
		this.select
			.selectAll('option')
			.data(config.samples)
			.enter()
			.append('option')
			.attr('value', d => d.sampleId)
			.html((d, i) => d.sampleName)
		this.select.on('change', e => {
			const options = this.select.node().options
			const samples = []
			for (const option of options)
				if (option.selected) {
					const sampleId = Number(option.value)
					const sampleName = config.samples.find(s => s.sampleId == sampleId).sampleName
					const sample = { sampleId, sampleName }
					samples.push(sample)
				}
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { samples } })
		})

		this.dom.sampleDiv
			.insert('button')
			.text('Download data')
			.style('vertical-align', 'top')
			.on('click', e => {
				this.downloadData()
			})
	}

	getState(appState) {
		let state = super.getState(appState)
		const config = appState.plots?.find(p => p.id === this.id)
		state.samples = config?.samples
		state.hasVerifiedToken = this.app.vocabApi.hasVerifiedToken()
		state.tokenVerificationPayload = this.app.vocabApi.tokenVerificationPayload

		return state
	}

	async main() {
		super.main()
		if (this.mayRequireToken()) return
		if (this.dom.header) {
			let title = 'Samples ' + this.state.samples.map(s => s.sampleName).join(', ')
			if (title.length > 100) title = title.substring(0, 100) + '...'
			this.dom.header.html(title)
		}
	}

	async downloadData() {
		const filename = `samples.tsv`
		let lines = ''
		for (const sample of this.state.samples) {
			lines += `Sample ${sample.sampleName}\n\n`
			this.sampleData = await this.app.vocabApi.getSingleSampleData({ sampleId: sample.sampleId })
			for (const id in this.sampleData) {
				const term = this.sampleData[id].term
				let value = getTermValue(term, this.sampleData)
				if (value == null) continue
				lines += `${term.name}\t${value}\n`
			}
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
