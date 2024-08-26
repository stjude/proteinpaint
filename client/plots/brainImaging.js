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

	async init() {
		const holder = this.opts.holder
		const controlsHolder = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const topbar = controlsHolder.append('div')
		const config_div = controlsHolder.append('div')
		const configInputsOptions = this.getConfigInputsOptions()

		this.features = await multiInit({
			topbar: topBarInit({
				app: this.app,
				id: this.id,
				downloadHandler: () => {
					const imgElement = holder.select('div[id="sjpp_brainImaging_holder_div"] img').node()
					const downloadImgName = 'brainImaging'
					const a = document.createElement('a')
					document.body.appendChild(a)

					a.addEventListener(
						'click',
						() => {
							// Download the image
							a.download = downloadImgName + '.png'
							a.href = imgElement.src
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

		this.opts.holder.select('div[id="sjpp_brainImaging_holder_div"]').remove()
		const pngDiv = this.opts.holder
			.append('div')
			.attr('id', 'sjpp_brainImaging_holder_div')
			.style('display', 'inline-block')

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
		const data = await dofetch3('brainImaging', { body })
		if (data.error) throw data.error
		const dataUrl = await data.brainImage

		const img = new Image()
		img.onload = () => {
			pngDiv
				.append('img')
				.attr('width', img.width * 2)
				.attr('height', img.height * 2)
				.attr('src', dataUrl)
		}
		img.src = dataUrl
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
			label: (await self.app.vocabApi.getterm(c.termid)).name,
			width: '15vw'
		})
	}

	return [rows, columns]
}
