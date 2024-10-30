import { getCompInit, copyMerge, multiInit } from '#rx'
import { controlsInit } from './controls'
import { dofetch3 } from '#common/dofetch'
import { renderTable } from '../dom/table.ts'
class BrainImaging {
	constructor(opts) {
		this.opts = opts
		this.type = 'brainImaging'
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
		const table = contentHolder.append('table')
		const headerTr = table.append('tr')
		const contentTr = table.append('tr')
		const tdL = contentTr.append('td')
		const tdF = contentTr.append('td')
		const tdT = contentTr.append('td')

		this.dom = { headerHolder, contentHolder, headerTr, tdL, tdF, tdT, imagesF: [], imagesL: [], imagesT: [] }
		this.addSliders(state.config.settings.brainImaging)

		const configInputsOptions = this.getConfigInputsOptions()

		this.components = {
			controls: await controlsInit({
				app: this.app,
				id: this.id,
				holder: controlsHolder,
				inputs: configInputsOptions
			})
		}
		this.components.controls.on('downloadClick.brainImaging', () => this.downloadImage())
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

	downloadImage() {
		for (const dataUrl of this.dataUrls) {
			const canvas = document.createElement('canvas')
			const image = new Image()
			image.src = dataUrl
			canvas.width = this.width
			canvas.height = this.height

			// Get the canvas's 2D rendering context
			const ctx = canvas.getContext('2d')

			// Draw the image onto the canvas, scaling it to fit
			ctx.drawImage(image, 0, 0, this.width, this.height)

			// Convert the canvas to a data URL
			const dataUrlResized = canvas.toDataURL('image/png')

			const downloadImgName = 'brainImaging'
			const a = document.createElement('a')
			document.body.appendChild(a)

			a.addEventListener(
				'click',
				() => {
					// Download the image
					a.download = downloadImgName + '.png'
					a.href = dataUrlResized
					document.body.removeChild(a)
				},
				false
			)
			a.click()
		}
	}

	getConfigInputsOptions() {
		const mandatoryConfigInputOptions = [
			// {
			// 	label: 'Sagittal',
			// 	type: 'number',
			// 	chartType: 'brainImaging',
			// 	settingsKey: 'brainImageL',
			// 	title: 'Sagittal',
			// 	min: 0,
			// 	max: 192
			// },
			// {
			// 	label: 'Coronal',
			// 	type: 'number',
			// 	chartType: 'brainImaging',
			// 	settingsKey: 'brainImageF',
			// 	title: 'Coronal',
			// 	min: 0,
			// 	max: 228
			// },
			// {
			// 	label: 'Axial',
			// 	type: 'number',
			// 	chartType: 'brainImaging',
			// 	settingsKey: 'brainImageT',
			// 	title: 'Axial',
			// 	min: 0,
			// 	max: 192
			// }
		]
		return mandatoryConfigInputOptions
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const updateL = config.settings.brainImaging.brainImageL != this.settings?.brainImageL
		const updateF = config.settings.brainImaging.brainImageF != this.settings?.brainImageF
		const updateT = config.settings.brainImaging.brainImageT != this.settings?.brainImageT
		return {
			config,
			dslabel: appState.vocab.dslabel,
			genome: appState.vocab.genome,
			RefNIdata: appState.termdbConfig.queries.NIdata[config.queryKey],
			updateL,
			updateF,
			updateT
		}
	}

	async main() {
		this.settings = this.state.config.settings.brainImaging

		//settings may be edited by the slider or the input, so we update the sliders and inputs to reflect the current settings
		this.dom.saggitalSlider.node().value = this.settings.brainImageL
		this.dom.saggitalInput.node().value = this.settings.brainImageL
		this.dom.coronalSlider.node().value = this.settings.brainImageF
		this.dom.coronalInput.node().value = this.settings.brainImageF
		this.dom.axialSlider.node().value = this.settings.brainImageT
		this.dom.axialInput.node().value = this.settings.brainImageT
		if (this.state.updateL) {
			const body = {
				genome: this.state.genome,
				dslabel: this.state.dslabel,
				refKey: this.state.config.queryKey,
				l: this.settings.brainImageL,
				selectedSampleFileNames: this.state.config.selectedSampleFileNames
			}
			const data = await dofetch3('brainImaging', { body })
			if (data.error) throw data.error

			this.dataUrlL = [await data.brainImage]
			if (this.dom.imagesL.length != this.dataUrlL.length) {
				this.dom.tdL.selectAll('*').remove()
				this.dom.imagesL = []
				for (const url of this.dataUrlL) {
					const img = this.dom.tdL.append('img').style('border', '5px solid #aaa').attr('src', url)
					this.dom.imagesL.push(img)
				}
			} else for (const url of this.dataUrlL) this.dom.imagesL.forEach((img, i) => img.attr('src', url))
		}

		if (this.state.updateF) {
			const body = {
				genome: this.state.genome,
				dslabel: this.state.dslabel,
				refKey: this.state.config.queryKey,
				f: this.settings.brainImageF,
				selectedSampleFileNames: this.state.config.selectedSampleFileNames
			}
			const data = await dofetch3('brainImaging', { body })
			if (data.error) throw data.error

			this.dataUrlF = [await data.brainImage]
			if (this.dom.imagesF.length != this.dataUrlF.length) {
				this.dom.tdF.selectAll('*').remove()
				this.dom.imagesF = []
				for (const url of this.dataUrlF) {
					const img = this.dom.tdF.append('img').style('border', '5px solid #aaa').attr('src', url)
					this.dom.imagesF.push(img)
				}
			} else for (const url of this.dataUrlF) this.dom.imagesF.forEach((img, i) => img.attr('src', url))
		}
		if (this.state.updateT) {
			const body = {
				genome: this.state.genome,
				dslabel: this.state.dslabel,
				refKey: this.state.config.queryKey,
				t: this.settings.brainImageT,
				selectedSampleFileNames: this.state.config.selectedSampleFileNames
			}
			const data = await dofetch3('brainImaging', { body })
			if (data.error) throw data.error

			this.dataUrlT = [await data.brainImage]
			if (this.dom.imagesT.length != this.dataUrlT.length) {
				this.dom.tdT.selectAll('*').remove()
				this.dom.imagesT = []
				for (const url of this.dataUrlT) {
					const img = this.dom.tdT.append('img').style('border', '5px solid #aaa').attr('src', url)
					this.dom.imagesT.push(img)
				}
			} else for (const url of this.dataUrlT) this.dom.imagesT.forEach((img, i) => img.attr('src', url))
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
					const result = await dofetch3('brainImaging', { body })
					const samples = result.brainImage

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
