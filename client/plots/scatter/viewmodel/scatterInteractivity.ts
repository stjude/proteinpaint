import { filterJoin, getFilterItemByTag } from '#filter'
import { Menu } from '#dom/menu'
import { getFilter } from '../../../mass/groups.js'
import { newSandboxDiv } from '../../../dom/sandbox.ts'
import { getId } from '#mass/nav'
import { searchSampleInput } from '../../sampleView.js'
import type { Scatter } from '../scatter.js'
import { select } from 'd3-selection'
export class ScatterInteractivity {
	scatter: Scatter
	view: any
	searchMenu: any
	samplesData: any
	shapeTW: any
	colorTW: any
	shapeSelector: any

	constructor(scatter: Scatter) {
		this.scatter = scatter
		this.view = scatter.view
		document.addEventListener('scroll', () => {
			if (!this.scatter.vm?.scatterTooltip?.onClick) this.scatter.view.dom.tooltip.hide()
		})
		select('.sjpp-output-sandbox-content').on('scroll', () => {
			if (!this.scatter.vm?.scatterTooltip?.onClick) this.view.dom.tooltip.hide()
		})
	}

	showText(event, text) {
		this.view.dom.tooltip.clear()
		this.view.dom.tooltip.d.style('padding', '5px').text(text)
		this.view.dom.tooltip.show(event.clientX, event.clientY, true, false)
	}

	openSampleView(sample) {
		this.view.dom.tooltip.hide()
		this.scatter.vm.scatterTooltip.onClick = false
		this.scatter.app.dispatch({
			type: 'plot_create',
			id: getId(),
			config: {
				chartType: 'sampleView',
				sample: { sampleId: sample.sampleId, sampleName: sample.sample }
			}
		})
		this.view.dom.tip.hide()
	}

	async openMetArray(sample) {
		this.view.dom.tooltip.hide()
		this.scatter.vm.scatterTooltip.onClick = false

		sample.sample_id = sample.sample
		for (const k in this.scatter.state.termdbConfig.queries.singleSampleGenomeQuantification) {
			const sandbox = newSandboxDiv(this.scatter.opts.plotDiv)
			sandbox.header.text(sample.sample_id)
			const ssgqImport = await import('../../plot.ssgq.js')
			await ssgqImport.plotSingleSampleGenomeQuantification(
				this.scatter.state.termdbConfig,
				this.scatter.state.vocab.dslabel,
				k,
				sample,
				sandbox.body.append('div').style('margin', '20px'),
				this.scatter.app.opts.genome
			)
		}
		this.view.dom.tip.hide()
	}

	async openDiscoPlot(sample) {
		this.view.dom.tooltip.hide()
		this.scatter.vm.scatterTooltip.onClick = false

		sample.sample_id = sample.sample
		const sandbox = newSandboxDiv(this.scatter.opts.plotDiv)
		sandbox.header.text(sample.sample_id)
		const discoPlotImport = await import('../../plot.disco.js')
		discoPlotImport.default(
			this.scatter.state.termdbConfig,
			this.scatter.state.vocab.dslabel,
			sample,
			sandbox.body,
			this.scatter.app.opts.genome
		)
	}

	async openLollipop(label) {
		this.view.dom.tooltip.hide()
		this.scatter.vm.scatterTooltip.onClick = false
		const sandbox = newSandboxDiv(this.scatter.opts.plotDiv || select(this.scatter.opts.holder.node().parentNode))
		sandbox.header.text(label)
		const arg = {
			holder: sandbox.body.append('div').style('margin', '20px'),
			genome: this.scatter.app.opts.genome,
			nobox: true,
			query: label,
			tklst: [
				{
					type: 'mds3',
					dslabel: this.scatter.app.opts.state.vocab.dslabel,
					filter0: this.scatter.state.termfilter.filter0,
					filterObj: structuredClone(this.scatter.state.termfilter.filter)
				}
			]
		}
		const _ = await import('#src/block.init')
		await _.default(arg)
	}

	async searchSample(e) {
		if (!this.searchMenu) {
			this.searchMenu = new Menu({ padding: '3px' })
			this.samplesData = await this.scatter.app.vocabApi.getSamplesByName({
				filter: this.scatter.state.termfilter.filter
			})
			const callback = sampleName => {
				if (this.samplesData[sampleName]) {
					// 	const samples = getSamplesRelated(this.samplesData, sampleName)
					// 	const samplelsttw = getSamplelstTWFromIds(samples.map(s => s.sampleId))
					// 	this.addToFilter(samplelsttw)
				}
			}
			searchSampleInput(
				this.searchMenu.d,
				this.samplesData,
				this.scatter.state.termdbConfig.hasSampleAncestry,
				callback,
				str => this.filterSamples(str)
			)
		}
		this.searchMenu.show(e.clientX, e.clientY, false)
	}

	filterSamples(str) {
		this.scatter.model.filterSampleStr = str
		this.scatter.vm.render()
	}

	addToFilter(samplelstTW) {
		const filterUiRoot = getFilterItemByTag(this.scatter.state.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([filterUiRoot, getFilter(samplelstTW)])
		filter.tag = 'filterUiRoot'
		this.scatter.app.dispatch({
			type: 'filter_replace',
			filter
		})
	}
}

export function downloadImage(imageURL) {
	const link = document.createElement('a')
	// If you don't know the name or want to use
	// the webserver default set name = ''
	link.setAttribute('download', 'image')
	document.body.appendChild(link)
	link.click()
	link.remove()
	link.href = imageURL
	link.click()
	link.remove()
}
