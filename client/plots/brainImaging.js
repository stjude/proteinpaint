import { getCompInit, copyMerge, multiInit } from '#rx'
import { topBarInit } from './controls.btns'
import { configUiInit } from './controls.config'
import { dofetch3 } from '#common/dofetch'
import { renderTable } from '../dom/table.ts'

class BrainImaging {
	constructor(opts) {
		this.opts = opts
		this.type = 'brainImaging'
		this.isOpen = true
	}

	async init(appState) {
		const holder = this.opts.holder
		const controlsHolder = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const topbar = controlsHolder.append('div')
		const config_div = controlsHolder.append('div')
		const configInputsOptions = this.getConfigInputsOptions()
		this.image = this.opts.holder
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.append('img')

		this.features = await multiInit({
			topbar: topBarInit({
				app: this.app,
				id: this.id,
				downloadHandler: () => {
					const canvas = document.createElement('canvas')
					const image = new Image()
					image.src = this.dataUrl
					canvas.width = this.width
					canvas.height = this.height

					// Get the canvas's 2D rendering context
					const ctx = canvas.getContext('2d')

					// Draw the image onto the canvas, scaling it to fit
					ctx.drawImage(image, 0, 0, this.width, this.height)

					// Convert the canvas to a data URL
					const dataUrl = canvas.toDataURL('image/png')

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
				},
				callback: () => this.toggleVisibility(this.isOpen),
				isOpen: () => this.isOpen,
				holder: topbar
			}),

			config: configUiInit({
				app: this.app,
				id: this.id,
				holder: config_div,
				isOpen: () => this.isOpen,
				inputs: configInputsOptions
			})
		})
	}

	getConfigInputsOptions() {
		const mandatoryConfigInputOptions = [
			{
				label: 'Sagittal',
				type: 'number',
				chartType: 'brainImaging',
				settingsKey: 'brainImageL',
				title: 'Sagittal',
				min: 0,
				max: 192
			},
			{
				label: 'Coronal',
				type: 'number',
				chartType: 'brainImaging',
				settingsKey: 'brainImageF',
				title: 'Coronal',
				min: 0,
				max: 228
			},
			{
				label: 'Axial',
				type: 'number',
				chartType: 'brainImaging',
				settingsKey: 'brainImageT',
				title: 'Axial',
				min: 0,
				max: 192
			}
		]
		return mandatoryConfigInputOptions
	}

	async main() {
		const settings = this.state.settings
		this.isOpen = settings.brainImaging.isOpen

		if (this.opts.header)
			this.opts.header
				.style('padding-left', '7px')
				.style('color', 'rgb(85, 85, 85)')
				.text(`Brain Imaging: ${this.state.queryKey}`)

		const appState = this.app.getState()

		for (const name in this.features) {
			this.features[name].update({ state: this.state, appState })
		}

		const body = {
			genome: appState.vocab.genome,
			dslabel: appState.vocab.dslabel,
			refKey: this.state.queryKey,
			l: settings.brainImaging.brainImageL,
			f: settings.brainImaging.brainImageF,
			t: settings.brainImaging.brainImageT,
			selectedSampleFileNames: this.state.selectedSampleFileNames
		}
		const firstTime = this.dataUrl == undefined
		if (this.dataUrl) this.image.attr('src', this.dataUrl) //keep the previous image while waiting for the new one
		const data = await dofetch3('brainImaging', { body })
		if (data.error) throw data.error
		this.dataUrl = await data.brainImage
		this.image.attr('src', this.dataUrl)

		if (firstTime) {
			//get image size to resize the image
			const image = new Image()
			image.src = this.dataUrl
			image.onload = () => {
				this.width = image.width * 2
				this.height = image.height * 2
				this.image.attr('width', this.width).attr('height', this.height)
			}
		}
	}

	getState(appState) {
		return appState.plots.find(p => p.id === this.id)
	}

	toggleVisibility(isOpen) {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.opts.id,
			config: {
				settings: {
					brainImaging: { isOpen: !isOpen }
				}
			}
		})
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
