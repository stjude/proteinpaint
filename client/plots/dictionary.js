import { getCompInit, copyMerge } from '#rx'
import { appInit } from '#termdb/app'

class MassDict {
	constructor(opts) {
		this.type = 'tree'
		const div = opts.holder.append('div')
		const sampleDiv = div.append('div').style('padding', '20px').style('display', 'none')
		const treeDiv = div.append('div').style('padding', '20px')

		const contentDiv = div.append('div').style('display', 'flex').style('align-items', 'start')
		this.dom = {
			sampleDiv,
			treeDiv,
			contentDiv,
			header: opts.header
		}
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		this.sample = config.sample

		if (this.sample.sampleId) {
			this.sampleId2Name = await this.app.vocabApi.getAllSamples()
			const samples = Object.entries(this.sampleId2Name)
			const div = this.dom.sampleDiv.style('display', 'block')
			div.insert('label').text('Sample:')

			this.select = div.append('select').style('margin', '0px 5px')
			this.select
				.selectAll('option')
				.data(samples)
				.enter()
				.append('option')
				.attr('value', d => d[0])
				.property('selected', d => d[0] == appState.sampleId)
				.html((d, i) => d[1])
			this.select.on('change', e => {
				const sampleId = this.select.property('value')
				const sample = this.sampleId2Name[sampleId]
				console.log(sampleId, sample)
				this.sampleDataByTermId = {}
				this.dataDownloaded = false
				this.app.dispatch({ type: 'plot_edit', id: this.id, config: { sample: { sampleId, sample } } })
			})

			div
				.insert('button')
				.text('Download')
				.on('click', e => {
					console.log(this.tree)
					this.downloadData()
				})
		}

		this.showContent = config.showContent
		this.tree = await appInit({
			vocabApi: this.app.vocabApi,
			holder: this.dom.treeDiv,
			state: this.getState(appState),
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

		if (this.sample && this.showContent) {
			this.dom.holder
				.style('min-width', '550px')
				.style('overflow', 'scroll')
				.attr('class', 'sjpp_hide_scrollbar')
				.style('border-right', '1px solid gray')

			this.dom.contentDiv
				.style('width', '60%')
				.style('min-height', '500px')
				.style('display', 'flex')
				.style('flex-direction', 'column')
				.style('justify-content', 'center')
				.style('border-left', '1px solid gray')
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			selectdTerms: appState.selectedTerms,
			customTerms: appState.customTerms,
			termdbConfig: appState.termdbConfig,
			sampleId: config.sample.sampleId,
			sampleName: config.sample.sample
		}
	}

	async main() {
		if (this.dom.header)
			this.dom.header.html(this.state.sampleName ? `${this.state.sampleName} Sample View` : 'Dictionary')
		this.tree.dispatch({
			type: 'app_refresh',
			state: this.state
		})
		if (this.sample && this.showContent) {
			if (this.state.termdbConfig.queries?.singleSampleMutation) {
				const div = this.dom.contentDiv.append('div')
				div.style('font-weight', 'bold').style('padding', '20px').text('Disco plot')
				const discoPlotImport = await import('./plot.disco.js')
				discoPlotImport.default(
					this.state.termdbConfig,
					this.state.vocab.dslabel,
					this.sample,
					this.dom.contentDiv.append('div'),
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
						this.sample,
						div.append('div'),
						this.app.opts.genome
					)
				}
			}
		}
	}
}

export const dictInit = getCompInit(MassDict)
export const componentInit = dictInit

export function getPlotConfig(opts, app) {
	// currently, there are no configurations options for
	// the dictionary tree; may add appearance, styling options later
	const config = {}
	// may apply overrides to the default configuration
	return copyMerge(config, opts)
}
