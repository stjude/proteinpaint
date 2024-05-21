import { getCompInit, copyMerge } from '#rx'
import { multiInit } from '../rx'
import { topBarInit } from './controls.btns'
import { configUiInit } from './controls.config'
import { dofetch3 } from '#common/dofetch'

class BrainMRI {
	constructor(opts) {
		this.opts = opts
		this.type = 'brainMRI'
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
					const imgElement = holder.select('div[id="sjpp_brainMRI_holder_div"] img').node()
					const downloadImgName = 'brainMRI'
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
		const configInputsOptions = []
		const mandatoryConfigInputOptions = [
			{
				label: 'Sagittal',
				type: 'number',
				chartType: 'brainMRI',
				settingsKey: 'brainImageL',
				title: 'Sagittal',
				min: 0,
				max: 192
			},
			{
				label: 'Coronal',
				type: 'number',
				chartType: 'brainMRI',
				settingsKey: 'brainImageF',
				title: 'Coronal',
				min: 0,
				max: 228
			},
			{
				label: 'Axial',
				type: 'number',
				chartType: 'brainMRI',
				settingsKey: 'brainImageT',
				title: 'Axial',
				min: 0,
				max: 192
			}
		]
		configInputsOptions.push(...mandatoryConfigInputOptions)
		return configInputsOptions
	}

	async main() {
		const settings = this.state.settings
		this.isOpen = settings.brainMRI.isOpen

		const holder = this.opts.holder
		holder.select('div[id="sjpp_brainMRI_holder_div"]').remove()
		const pngDiv = holder.append('div').attr('id', 'sjpp_brainMRI_holder_div').style('display', 'inline-block')

		const appState = this.app.getState()

		for (const name in this.features) {
			this.features[name].update({ state: this.state, appState })
		}

		const body = {
			genome: appState.genome,
			dslabel: appState.dslabel,
			NIdata: { dataType: appState.args.queryKey, sample: appState.args.sampleName + '.nii' },
			l: settings.brainMRI.brainImageL,
			f: settings.brainMRI.brainImageF,
			t: settings.brainMRI.brainImageT
		}
		const data = await dofetch3('mds3', { body })
		if (data.error) throw data.error
		const dataUrl = await data.text()

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
					brainMRI: { isOpen: !isOpen }
				}
			}
		})
	}
}

export const brainMRI = getCompInit(BrainMRI)
export const componentInit = brainMRI

export async function getPlotConfig(opts) {
	const settings = {
		brainMRI: { brainImageL: 76, brainImageF: 116, brainImageT: 80 }
	}
	const config = { chartType: 'brainMRI', settings }
	return copyMerge(config, opts)
}
