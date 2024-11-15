import { getCompInit, copyMerge } from '#rx'
import { controlsInit } from './controls'
import { dofetch3 } from '#common/dofetch'
import { renderTable } from '../dom/table.ts'
import svgLegend from '#dom/svg.legend'
import { scaleLinear } from 'd3-scale'
import { Menu } from '#dom/menu'
import { rgb } from 'd3-color'
class BrainImaging {
	constructor(opts) {
		this.opts = opts
		this.type = 'brainImaging'
		setInteractivity(this)
	}

	async init(appState) {
		const state = this.getState(appState)
		const holder = this.opts.holder
		if (this.opts.header)
			this.opts.header
				.style('padding-left', '7px')
				.style('color', 'rgb(85, 85, 85)')
				.html(`Brain Imaging: ${state.config.queryKey}/${state.config.selectedSampleFileNames.join(' ')}`)
		const controlsHolder = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const rightDiv = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const headerHolder = rightDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('padding', '10px')
		const contentHolder = rightDiv.append('div').style('vertical-align', 'top')
		const table = contentHolder.append('table').style('border-collapse', 'collapse')
		const headerTr = table.append('tr')
		const contentTr = table.append('tr').style('background-color', 'black')
		const tdL = contentTr.append('td')
		const tdF = contentTr.append('td')
		const tdT = contentTr.append('td')
		const legendHolder = contentHolder.append('svg').style('width', '100%').on('mouseup', this.legendLabelMouseup)
		const legendMenu = new Menu({ padding: '0px' })

		this.dom = {
			headerHolder,
			contentHolder,
			headerTr,
			tdL,
			tdF,
			tdT,
			imagesF: [],
			imagesL: [],
			imagesT: [],
			legendHolder,
			legendMenu
		}
		this.addSliders(state.config.settings.brainImaging)

		const configInputsOptions = this.getConfigInputsOptions(state)

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: controlsHolder,
				inputs: configInputsOptions
			})
		}
		this.components.controls.on('downloadClick.brainImaging', () => {
			const urls = []
			for (const category in this.dataUrlL) urls.push(this.dataUrlL[category].url)
			for (const category in this.dataUrlF) urls.push(this.dataUrlF[category].url)
			for (const category in this.dataUrlT) urls.push(this.dataUrlT[category].url)
			console.log(urls)
			this.downloadImage(urls)
		})
		this.legendRenderer = svgLegend({ holder: this.dom.legendHolder })
	}

	addSliders(settings) {
		const tr = this.dom.headerTr
		let td = tr.append('td')
		td.append('label').attr('for', 'saggital').text('Sagittal:')
		this.dom.saggitalSlider = td
			.append('input')
			.attr('id', 'saggital')
			.attr('type', 'range')
			.attr('min', 0)
			.attr('max', 192)
			.attr('value', settings.brainImageL)
			.on('change', e => {
				this.editBrainImage('brainImageL', e.target.value)
			})
		this.dom.saggitalInput = td
			.append('input')
			.attr('type', 'number')
			.attr('min', 0)
			.attr('max', 192)
			.attr('value', settings.brainImageL)
			.on('change', e => {
				this.editBrainImage('brainImageL', e.target.value)
			})
			.style('vertical-align', 'top')

		td = tr.append('td')

		td.append('label').attr('for', 'coronal').text('Coronal:')
		this.dom.coronalSlider = td
			.append('input')
			.attr('type', 'range')
			.attr('min', 0)
			.attr('max', 228)
			.attr('value', settings.brainImageF)
			.on('change', e => {
				this.editBrainImage('brainImageF', e.target.value)
			})
		this.dom.coronalInput = td
			.append('input')
			.attr('type', 'number')
			.attr('min', 0)
			.attr('max', 192)
			.attr('value', settings.brainImageF)
			.on('change', e => {
				this.editBrainImage('brainImageF', e.target.value)
			})
			.style('vertical-align', 'top')

		td = tr.append('td')

		td.append('label').attr('for', 'axial').text('Axial:')
		this.dom.axialSlider = td
			.append('input')
			.attr('id', 'axial')
			.attr('type', 'range')
			.attr('min', 0)
			.attr('max', 192)
			.attr('value', settings.brainImageT)
			.on('change', e => {
				this.editBrainImage('brainImageT', e.target.value)
			})
		this.dom.axialInput = td
			.append('input')
			.attr('type', 'number')
			.attr('min', 0)
			.attr('max', 192)
			.attr('value', settings.brainImageT)
			.on('change', e => {
				this.editBrainImage('brainImageT', e.target.value)
			})
	}

	editBrainImage(key, value) {
		if (!value) return
		const settings = { [key]: Number(value) }

		this.app.dispatch({ type: 'plot_edit', id: this.id, config: { settings: { brainImaging: settings } } })
	}

	downloadImage(dataUrls) {
		for (const dataUrl of dataUrls) {
			const downloadImgName = 'brainImaging'
			const a = document.createElement('a')
			document.body.appendChild(a)

			a.addEventListener(
				'click',
				() => {
					// Download the image
					a.download = downloadImgName + '.png'
					a.href = dataUrl
					document.body.removeChild(a)
				},
				false
			)
			a.click()
		}
	}

	getConfigInputsOptions(state) {
		if (state.config.selectedSampleFileNames.length == 1) return []
		const mandatoryConfigInputOptions = [
			{
				label: 'Divide by',
				type: 'term',
				chartType: 'brainImaging',
				configKey: 'divideByTW',
				title: 'Categories to divide by',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['discrete']
			},
			{
				label: 'Color by',
				type: 'term',
				chartType: 'brainImaging',
				configKey: 'overlayTW',
				title: 'Categories to color the samples',
				vocabApi: this.app.vocabApi,
				numericEditMenuVersion: ['discrete']
			}
		]
		return mandatoryConfigInputOptions
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const previousConfig = this.state?.config

		const overlayOrDivideByChange =
			JSON.stringify(config.overlayTW) !== JSON.stringify(previousConfig?.overlayTW) ||
			JSON.stringify(config.divideByTW) !== JSON.stringify(previousConfig?.divideByTW)

		const legendFilterChange = JSON.stringify(previousConfig?.legendFilter) !== JSON.stringify(config.legendFilter)
		const updateL =
			config.settings.brainImaging.brainImageL != this.settings?.brainImageL ||
			overlayOrDivideByChange ||
			legendFilterChange
		const updateF =
			config.settings.brainImaging.brainImageF != this.settings?.brainImageF ||
			overlayOrDivideByChange ||
			legendFilterChange
		const updateT =
			config.settings.brainImaging.brainImageT != this.settings?.brainImageT ||
			overlayOrDivideByChange ||
			legendFilterChange

		return {
			config,
			dslabel: appState.vocab.dslabel,
			genome: appState.vocab.genome,
			RefNIdata: appState.termdbConfig.queries.NIdata[config.queryKey],
			updateL,
			updateF,
			updateT,
			overlayOrDivideByChange,
			legendFilterChange
		}
	}

	async main() {
		this.config = structuredClone(this.state.config) //to modify config on plot_edit
		this.settings = this.state.config.settings.brainImaging

		//settings may be edited by the slider or the input, so we update the sliders and inputs to reflect the current settings
		this.dom.saggitalSlider.node().value = this.settings.brainImageL
		this.dom.saggitalInput.node().value = this.settings.brainImageL
		this.dom.coronalSlider.node().value = this.settings.brainImageF
		this.dom.coronalInput.node().value = this.settings.brainImageF
		this.dom.axialSlider.node().value = this.settings.brainImageT
		this.dom.axialInput.node().value = this.settings.brainImageT

		const divideByTW = this.state.config.divideByTW
		const overlayTW = this.state.config.overlayTW
		if (this.state.updateL) {
			const body = {
				genome: this.state.genome,
				dslabel: this.state.dslabel,
				refKey: this.state.config.queryKey,
				l: this.settings.brainImageL,
				selectedSampleFileNames: this.state.config.selectedSampleFileNames,
				divideByTW,
				overlayTW,
				legendFilter: this.state.config.legendFilter
			}
			const data = await dofetch3('brainImaging', { body })
			this.legendValues = data.legend
			if (data.error) throw data.error

			this.dataUrlL = {}
			for (const [termV, result] of Object.entries(data.brainImage)) {
				this.dataUrlL[termV] = result
			}

			this.dom.tdL.selectAll('*').remove()
			this.dom.imagesL = []
			for (const [termV, result] of Object.entries(this.dataUrlL)) {
				if (divideByTW)
					this.dom.tdL
						.append('div')
						.attr('class', 'pp-chart-title')
						.style('text-align', 'center')
						.text(`${termV} (n=${result.catNum})`)
						.style('font-weight', '600')
						.style('color', 'white')
						.style('font-size', '24px')
						.style('margin-bottom', '5px')
						.style('margin-top', '5px')
						.style('display', 'block')
				const img = this.dom.tdL.append('div').append('img').attr('src', result.url)
				this.dom.imagesL.push(img)
			}
		}

		if (this.state.updateF) {
			const body = {
				genome: this.state.genome,
				dslabel: this.state.dslabel,
				refKey: this.state.config.queryKey,
				f: this.settings.brainImageF,
				selectedSampleFileNames: this.state.config.selectedSampleFileNames,
				divideByTW,
				overlayTW,
				legendFilter: this.state.config.legendFilter
			}
			const data = await dofetch3('brainImaging', { body })
			if (data.error) throw data.error

			this.dataUrlF = []
			for (const [termV, result] of Object.entries(data.brainImage)) {
				this.dataUrlF.push(result)
			}
			this.dom.tdF.selectAll('*').remove()
			this.dom.imagesF = []
			for (const [termV, result] of Object.entries(this.dataUrlF)) {
				if (divideByTW)
					this.dom.tdF
						.append('div')
						.attr('class', 'pp-chart-title')
						.style('text-align', 'center')
						.html('&nbsp;')
						.style('font-weight', '600')
						.style('font-size', '24px')
						.style('margin-bottom', '5px')
						.style('margin-top', '5px')
						.style('display', 'block')
				const img = this.dom.tdF.append('div').append('img').attr('src', result.url)
				this.dom.imagesF.push(img)
			}
		}
		if (this.state.updateT) {
			const body = {
				genome: this.state.genome,
				dslabel: this.state.dslabel,
				refKey: this.state.config.queryKey,
				t: this.settings.brainImageT,
				selectedSampleFileNames: this.state.config.selectedSampleFileNames,
				divideByTW,
				overlayTW,
				legendFilter: this.state.config.legendFilter
			}
			const data = await dofetch3('brainImaging', { body })
			if (data.error) throw data.error

			this.dataUrlT = []
			for (const [termV, result] of Object.entries(data.brainImage)) {
				this.dataUrlT.push(result)
			}

			this.dom.tdT.selectAll('*').remove()
			this.dom.imagesT = []
			for (const [termV, result] of Object.entries(this.dataUrlT)) {
				if (divideByTW)
					this.dom.tdT
						.append('div')
						.attr('class', 'pp-chart-title')
						.style('text-align', 'center')
						.html('&nbsp;')
						.style('font-weight', '600')
						.style('font-size', '24px')
						.style('margin-bottom', '5px')
						.style('margin-top', '5px')
						.style('display', 'block')
				const img = this.dom.tdT.append('div').append('img').attr('src', result.url)
				this.dom.imagesT.push(img)
			}
		}

		if (this.state.overlayOrDivideByChange || !this.legendItems || this.state.legendFilterChange) {
			// only render legends when it is the first time or when divideBy/Overlay terms changed.
			const legendItems = []
			for (const [label, v] of Object.entries(this.legendValues)) {
				const scale = scaleLinear(['white', v.color], [0, v.maxLength]).clamp(true)
				legendItems.push({
					text: label == 'default' ? 'Combined Intensity' : label,
					width: 100,
					scale,
					colors: ['white', v.color],
					domain: [0, v.maxLength],
					key: label,
					crossedOut: v.crossedOut
				})
			}
			this.legendItems = legendItems
			const legendRendererData = [
				{
					items: legendItems
				}
			]

			this.legendRenderer(legendRendererData, {
				settings: {
					fontsize: 16,
					iconh: 14,
					iconw: 14,
					dimensions: {
						xOffset: 0
					}
				}
			})
		}
	}
}

export function makeChartBtnMenu(holder, chartsInstance) {
	chartsInstance.dom.tip.clear()
	const menuDiv = holder.append('div')
	if (chartsInstance.state.termdbConfig.queries.NIdata) {
		for (const [refKey, ref] of Object.entries(chartsInstance.state.termdbConfig.queries.NIdata)) {
			const refDiv = menuDiv.append('div')

			const refOption = refDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(refKey)
				.on('click', async () => {
					refOption.attr('class', 'sja_menuoption_not_interactive')
					refOption.on('click', null)
					const body = {
						genome: chartsInstance.opts.vocab.genome,
						dslabel: chartsInstance.opts.vocab.dslabel,
						refKey,
						samplesOnly: true
					}
					const result = await dofetch3('brainImagingSamples', { body })
					const samples = result.samples

					const [rows, columns] = await getTableData(chartsInstance, samples, chartsInstance.state, refKey)

					const applybt = {
						text: 'APPLY',
						class: 'sjpp_apply_btn sja_filter_tag_btn',
						callback: indexes => {
							chartsInstance.dom.tip.hide()
							const selectedSampleFileNames = indexes.map(i => samples[i].sample + '.nii')
							const config = {
								chartType: 'brainImaging',
								queryKey: refKey,
								settings: {
									brainImaging: {
										brainImageL: ref.parameters.l,
										brainImageF: ref.parameters.f,
										brainImageT: ref.parameters.t
									}
								},
								selectedSampleFileNames
							}
							chartsInstance.app.dispatch({
								type: 'plot_create',
								config
							})
						}
					}

					renderTable({
						rows,
						columns,
						resize: true,
						singleMode: false,
						div: refDiv.append('div'),
						maxHeight: '40vh',
						buttons: [applybt]
					})
				})
		}
	}
}

export const brainImaging = getCompInit(BrainImaging)
export const componentInit = brainImaging

export async function getPlotConfig(opts) {
	const settings = {
		brainImaging: { brainImageL: 76, brainImageF: 116, brainImageT: 80 }
	}
	const config = { chartType: 'brainImaging', settings }
	return copyMerge(config, opts)
}

async function getTableData(self, samples, state, refKey) {
	const rows = []
	for (const sample of samples) {
		// first cell is sample name
		const row = [{ value: sample.sample }]

		// optional sample columns
		for (const c of state.termdbConfig.queries.NIdata[refKey].sampleColumns || []) {
			row.push({ value: sample[c.termid] })
		}
		rows.push(row)
	}

	// first column is sample and is hardcoded
	const columns = [{ label: 'Sample' }]

	// add in optional sample columns
	for (const c of state.termdbConfig.queries.NIdata[refKey].sampleColumns || []) {
		columns.push({
			label: (await self.app.vocabApi.getterm(c.termid)).name
		})
	}

	return [rows, columns]
}

function setInteractivity(self) {
	self.legendLabelMouseup = event => {
		const targetData = event.target.__data__
		if (!targetData || targetData.key == 'default') return
		const legendMenu = self.dom.legendMenu.clear()
		const legendMenuDiv = legendMenu.d.append('div')
		const legendFilter = self.state.config.legendFilter ? [...self.state.config.legendFilter] : []

		const legendFilterIndex = legendFilter.indexOf(targetData.key)

		if (legendFilterIndex !== -1 || legendFilter.length + 1 !== self.legendItems.length) {
			// only show the Hide option when the cat is not the last shown cat
			legendMenuDiv
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text(legendFilterIndex == -1 ? 'Hide' : 'Show')
				.on('click', () => {
					legendMenu.hide()
					if (legendFilterIndex == -1) legendFilter.push(targetData.key)
					else legendFilter.splice(legendFilterIndex, 1)

					self.app.dispatch({
						type: 'plot_edit',
						id: self.id,
						config: { legendFilter }
					})
				})
		}

		legendMenuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Show only')
			.on('click', () => {
				legendMenu.hide()
				const legendFilter = []
				for (const legendCat of self.legendItems) {
					if (legendCat.key !== targetData.key) legendFilter.push(legendCat.key)
				}
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: { legendFilter }
				})
			})

		legendMenuDiv
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.text('Show all')
			.on('click', () => {
				legendMenu.hide()
				self.app.dispatch({
					type: 'plot_edit',
					id: self.id,
					config: { legendFilter: [] }
				})
			})
		let color = self.state.config.overlayTW.term.values[targetData.key]?.color || 'red'
		color = rgb(color).formatHex() //so that the color is in the correct format to be shown in the input
		legendMenuDiv
			.append('div')
			.attr('class', 'sja_sharp_border')
			.style('padding', '0px 10px')
			.text('Color:')
			.append('input')
			.attr('type', 'color')
			.attr('value', color)
			.on('change', e => {
				self.changeColor(targetData.key, e.target.value)
			})
		legendMenu.showunder(event.target)
	}

	self.changeColor = async function (key, color) {
		const tw = self.config.overlayTW

		if (!(tw.term.type == 'geneVariant' && tw.q.type == 'values') && tw.term.values[key])
			tw.term.values[key].color = color
		else {
			if (!tw.term.values) tw.term.values = { [key]: {} }
			tw.term.values[key].color = color
		}

		await self.app.dispatch({
			type: 'plot_edit',
			id: self.id,
			config: { overlayTW: tw }
		})
	}
}
