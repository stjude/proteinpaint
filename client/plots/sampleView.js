import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#termdb/app'
import { MassDict } from './dictionary.js'

class SampleView extends MassDict {
	constructor(opts) {
		super(opts)
		this.type = 'sampleView'
		const treeDiv = this.dom.treeDiv
		const sampleDiv = treeDiv.insert('div').style('display', 'none')
		let contentDiv = this.dom.mainDiv.insert('div').style('display', 'inline-block').style('vertical-align', 'top')
		contentDiv = contentDiv.insert('div').style('display', 'flex')
		this.dom = {
			mainDiv: this.dom.mainDiv,
			sampleDiv,
			treeDiv,
			contentDiv,
			header: opts.header
		}
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
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
			.text('Download')
			.on('click', e => {
				this.downloadData()
			})

		await super.init(appState)

		if (this.sample && this.showContent) {
			this.dom.treeDiv
				.style('min-width', '550px')
				.style('overflow', 'scroll')
				.attr('class', 'sjpp_hide_scrollbar')
				.style('border-right', '1px solid gray')

			this.dom.contentDiv
				//.style('width', '60%')
				.style('min-height', '500px')
				.style('flex-direction', 'column')
				.style('justify-content', 'center')
				.style('align-items', 'start')
				.style('border-left', '1px solid gray')
		}
	}

	getState(appState) {
		let state = super.getState(appState)
		const config = appState.plots?.find(p => p.id === this.id)
		state.sample = config?.sample || this.sample
		state.hasVerifiedToken = this.app.vocabApi.hasVerifiedToken()
		state.tokenVerificationPayload = this.app.vocabApi.tokenVerificationPayload

		return state
	}

	async main() {
		if (this.mayRequireToken()) return
		super.main()
		if (this.dom.header)
			this.dom.header.html(this.state.sample ? `${this.state.sample.sampleName} Sample View` : 'Dictionary')

		if (this.state.sample && this.showContent) {
			const sample = { sample_id: this.sample.sampleName }

			this.dom.contentDiv.selectAll('*').remove()
			if (this.state.termdbConfig.queries?.singleSampleMutation) {
				const div = this.dom.contentDiv
				div.append('div').style('font-weight', 'bold').style('padding-left', '20px').text('Disco plot')
				const discoPlotImport = await import('./plot.disco.js')
				discoPlotImport.default(
					this.state.termdbConfig,
					this.state.vocab.dslabel,
					sample,
					div.append('div'),
					this.app.opts.genome
				)
			}
			if (this.state.termdbConfig.queries.singleSampleGenomeQuantification) {
				for (const k in this.state.termdbConfig.queries.singleSampleGenomeQuantification) {
					const div = this.dom.contentDiv.append('div').style('padding', '20px')
					const label = k.match(/[A-Z][a-z]+|[0-9]+/g).join(' ')
					div.append('div').style('padding-bottom', '20px').style('font-weight', 'bold').text(label)
					const ssgqImport = await import('./plot.ssgq.js')
					await ssgqImport.plotSingleSampleGenomeQuantification(
						this.state.termdbConfig,
						this.state.vocab.dslabel,
						k,
						sample,
						div.append('div'),
						this.app.opts.genome
					)
				}
			}
		}
	}

	getTermValue(term) {
		let value = this.sampleData[term.id]?.value

		if (value == null || value == undefined) return null
		if (term.type == 'float' || term.type == 'integer')
			return value % 1 == 0 ? value.toString() : value.toFixed(2).toString()
		if (term.type == 'categorical') return term.values[value].label || term.values[value].key
		return null
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

export const sampleViewInit = getCompInit(SampleView)
export const componentInit = sampleViewInit

export function getPlotConfig(opts, app) {
	// currently, there are no configurations options for
	// the dictionary tree; may add appearance, styling options later
	const config = {}
	// may apply overrides to the default configuration
	return copyMerge(config, opts)
}
