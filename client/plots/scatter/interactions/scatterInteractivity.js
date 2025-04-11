import { filterJoin, getFilterItemByTag } from '#filter'
import { renderTable } from '../../../dom/table.ts'
import { Menu } from '#dom/menu'
import { getFilter } from '../../../mass/groups.js'
import {
	addPlotMenuItem,
	showTermsTree,
	addMatrixMenuItems,
	openSummaryPlot,
	addNewGroup,
	getSamplelstTW
} from '../../../mass/groups.js'
import { newSandboxDiv } from '../../../dom/sandbox.ts'
import { getId } from '#mass/nav'
import { searchSampleInput } from '../../sampleView.js'

export class ScatterInteractivity {
	constructor(scatter) {
		this.scatter = scatter
		this.view = scatter.view
		this.model = scatter.model
	}

	showText(event, text) {
		self.dom.tooltip.clear()
		self.dom.tooltip.d.style('padding', '5px').text(text)
		self.dom.tooltip.show(event.clientX, event.clientY, true, false)
	}

	openSampleView(sample) {
		self.dom.tooltip.hide()
		self.onClick = false
		self.app.dispatch({
			type: 'plot_create',
			id: getId(),
			config: {
				chartType: 'sampleView',
				sample: { sampleId: sample.sampleId, sampleName: sample.sample }
			}
		})
		self.dom.tip.hide()
	}

	async openMetArray(sample) {
		self.dom.tooltip.hide()
		self.onClick = false

		sample.sample_id = sample.sample
		for (const k in self.state.termdbConfig.queries.singleSampleGenomeQuantification) {
			const sandbox = newSandboxDiv(self.opts.plotDiv)
			sandbox.header.text(sample.sample_id)
			const ssgqImport = await import('../../plot.ssgq.js')
			await ssgqImport.plotSingleSampleGenomeQuantification(
				self.state.termdbConfig,
				self.state.vocab.dslabel,
				k,
				sample,
				sandbox.body.append('div').style('margin', '20px'),
				self.app.opts.genome
			)
		}
		self.dom.tip.hide()
	}

	async openDiscoPlot(sample) {
		self.dom.tooltip.hide()
		self.onClick = false

		sample.sample_id = sample.sample
		const sandbox = newSandboxDiv(self.opts.plotDiv)
		sandbox.header.text(sample.sample_id)
		const discoPlotImport = await import('../../plot.disco.js')
		discoPlotImport.default(
			self.state.termdbConfig,
			self.state.vocab.dslabel,
			sample,
			sandbox.body,
			self.app.opts.genome
		)
	}

	async openLollipop(label) {
		self.dom.tooltip.hide()
		self.onClick = false
		const sandbox = newSandboxDiv(self.opts.plotDiv || select(self.opts.holder.node().parentNode))
		sandbox.header.text(label)
		const arg = {
			holder: sandbox.body.append('div').style('margin', '20px'),
			genome: self.app.opts.genome,
			nobox: true,
			query: label,
			tklst: [
				{
					type: 'mds3',
					dslabel: self.app.opts.state.vocab.dslabel,
					filter0: self.state.termfilter.filter0,
					filterObj: structuredClone(self.state.termfilter.filter)
				}
			]
		}
		const _ = await import('#src/block.init')
		await _.default(arg)
	}

	async changeColor(key, color) {
		const tw = self.config.colorTW
		if (!tw.term.values) tw.term.values = {}
		if (!tw.term.values[key]) tw.term.values[key] = {}
		tw.term.values[key].color = color
		await self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { colorTW: tw }
		})
	}

	async changeShape(key, shape) {
		const tw = self.config.shapeTW
		if (!tw.term.values) tw.term.values = {}
		if (!tw.term.values[key]) tw.term.values[key] = {}
		tw.term.values[key].shape = shape
		await self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { shapeTW: tw }
		})
	}

	async searchSample(e) {
		if (!this.searchMenu) {
			this.searchMenu = new Menu({ padding: '3px' })
			this.samplesData = await this.app.vocabApi.getSamplesByName({
				filter: self.state.termfilter.filter
			})
			const callback = sampleName => {
				// if (this.samplesData[sampleName]) {
				// 	const samples = getSamplesRelated(this.samplesData, sampleName)
				// 	const samplelsttw = getSamplelstTWFromIds(samples.map(s => s.sampleId))
				// 	self.addToFilter(samplelsttw)
				// }
			}
			searchSampleInput(this.searchMenu.d, this.samplesData, self.state.termdbConfig.hasSampleAncestry, callback, str =>
				self.filterSamples(str)
			)
		}
		this.searchMenu.show(e.clientX, e.clientY, false)
	}

	filterSamples(str) {
		this.filterSampleStr = str
		self.render()
	}

	getCategoryInfo(d, category) {
		if (!(category in d)) return ''
		return d[category]
	}

	addToFilter(samplelstTW) {
		const filterUiRoot = getFilterItemByTag(self.state.termfilter.filter, 'filterUiRoot')
		const filter = filterJoin([filterUiRoot, getFilter(samplelstTW)])
		filter.tag = 'filterUiRoot'
		self.app.dispatch({
			type: 'filter_replace',
			filter
		})
	}

	showTable(group, x, y, addGroup) {
		let rows = []
		const columns = []
		const first = group.items[0]
		if ('sample' in first) columns.push(formatCell('Sample', 'label'))
		if (self.config.colorTW) columns.push(formatCell(self.config.colorTW.term.name, 'label'))

		if (self.config.shapeTW) columns.push(formatCell(self.config.shapeTW.term.name, 'label'))
		let info = false
		for (const item of group.items) {
			const row = []
			if ('sample' in item) row.push(formatCell(item.sample))
			if (self.config.colorTW) row.push(formatCell(self.getCategoryInfo(item, 'category')))
			if (self.config.shapeTW) row.push(formatCell(self.getCategoryInfo(item, 'shape')))
			if ('info' in item) {
				info = true
				const values = []
				for (const [k, v] of Object.entries(item.info)) values.push(`${k}: ${v}`)
				row.push(formatCell(values.join(', ')))
			}
			rows.push(row)
		}
		if (info) columns.push(formatCell('Info', 'label'))

		self.dom.tip.clear()
		const div = self.dom.tip.d.append('div').style('padding', '5px')
		const headerDiv = div.append('div').style('margin-top', '5px')

		const groupDiv = headerDiv
			.append('div')
			.html('&nbsp;' + group.name)
			.style('font-size', '0.9rem')
			.on('click', () => {
				const isEdit = groupDiv.select('input').empty()
				if (!isEdit) return
				groupDiv.html('')
				const input = groupDiv
					.append('input')
					.attr('value', group.name)
					.on('change', async () => {
						const name = input.node().value
						if (name) self.renameGroup(group, name)
						else input.node().value = group.name
						groupDiv.html('&nbsp;' + group.name)
					})
				input.node().focus()
				input.node().select()
			})
		const tableDiv = div.append('div')
		const buttons = []
		if (addGroup) {
			const addGroupCallback = {
				text: 'Add to a group',
				callback: indexes => {
					const items = []
					for (const i of indexes) items.push(self.selectedItems[i].__data__)
					const group = {
						name: `Group ${self.config.groups.length + 1}`,
						items,
						index: self.config.groups.length
					}
					const filter = getFilter(getSamplelstTW([group]))
					addNewGroup(self.app, filter, self.state.groups)
				}
			}
			buttons.push(addGroupCallback)
		} else {
			const deleteSamples = {
				text: 'Delete samples',
				callback: indexes => {
					group.items = group.items.filter((elem, index, array) => !(index in indexes))
					this.showTable(group, x, y, addGroup)
				}
			}
			buttons.push(deleteSamples)
		}
		renderTable({
			rows,
			columns,
			div: tableDiv,
			showLines: true,
			maxWidth: columns.length * '15' + 'vw',
			maxHeight: '35vh',
			buttons,
			selectAll: true
		})

		self.dom.tip.show(x, y, false, false)
		function formatCell(column, name = 'value') {
			let dict = {}
			dict[name] = column
			return dict
		}
	}

	async renameGroup(group, newName) {
		const i = self.config.groups.findIndex(group => group.name == newName)
		if (i != -1) alert(`Group named ${newName} already exists`)
		else
			await self.app.dispatch({
				type: 'rename_group',
				index: group.index,
				newName
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
