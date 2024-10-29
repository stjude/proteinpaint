import { getCompInit, copyMerge, multiInit } from '#rx'
import { controlsInit } from './controls'
import { dofetch3 } from '#common/dofetch'
import { renderTable } from '../dom/table.ts'
import { debounce } from 'debounce'
const debounceDelay = 1000
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
		const debounceDelay = 1000
		const controlsHolder = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const rightDiv = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const headerHolder = rightDiv
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('padding', '10px')
		this.addSliders(headerHolder, debounceDelay, state.config.settings.brainImaging)
		this.contentHolder = rightDiv.append('div').style('vertical-align', 'top')

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

	addSliders(headerHolder, debounceDelay, settings) {
		headerHolder.append('label').attr('for', 'saggital').text('Sagittal:').style('vertical-align', 'top')
		headerHolder
			.append('input')
			.attr('id', 'saggital')
			.attr('type', 'range')
			.attr('min', 0)
			.attr('max', 192)
			.attr('value', settings.brainImageL)
			.style('width', '200px')
			.on('input', e => {
				const settings = { brainImageL: e.target.value }
				debounce(() => this.editBrainImage(settings), debounceDelay)()
			})

		headerHolder.append('label').attr('for', 'coronal').text('Coronal:').style('vertical-align', 'top')
		headerHolder
			.append('input')
			.attr('id', 'coronal')
			.attr('type', 'range')
			.attr('min', 0)
			.attr('max', 228)
			.attr('value', settings.brainImageF)
			.style('width', '200px')
			.on('input', e => {
				const settings = { brainImageF: e.target.value }
				debounce(() => this.editBrainImage(settings), debounceDelay)()
			})
		headerHolder.append('label').attr('for', 'axial').text('Axial:').style('vertical-align', 'top')
		headerHolder
			.append('input')
			.attr('id', 'axial')
			.attr('type', 'range')
			.attr('min', 0)
			.attr('max', 192)
			.attr('value', settings.brainImageT)
			.style('width', '200px')
			.on('input', e => {
				const settings = { brainImageT: e.target.value }
				debounce(() => this.editBrainImage(settings), debounceDelay)()
			})
	}

	editBrainImage(settings) {
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
		const settings = this.state.config.settings.brainImaging
		const body = {
			genome: this.state.genome,
			dslabel: this.state.dslabel,
			refKey: this.state.config.queryKey,
			l: settings.brainImageL,
			f: settings.brainImageF,
			t: settings.brainImageT,
			selectedSampleFileNames: this.state.config.selectedSampleFileNames
		}
		const data = await dofetch3('brainImaging', { body })
		if (data.error) throw data.error

		const dataUrl = await data.brainImage
		this.dataUrls = [dataUrl] //later on update with urls obtained after divide by is added, or for testing purposes use [dataUrl, dataUrl]
		this.images = []
		this.contentHolder.selectAll('*').remove()
		const width = this.state.RefNIdata.width
		const height = this.state.RefNIdata.height
		for (const dataUrl of this.dataUrls) {
			const image = this.contentHolder
				.append('div')
				.style('display', 'block')
				.style('vertical-align', 'top')
				.append('img')
				.style('border', '5px solid #aaa')
				.attr('src', dataUrl)
				.attr('width', width)
				.attr('height', height)
			this.images.push(image)
		}
	}

	getState(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		return {
			config,
			dslabel: appState.vocab.dslabel,
			genome: appState.vocab.genome,
			RefNIdata: appState.termdbConfig.queries.NIdata[config.queryKey]
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
