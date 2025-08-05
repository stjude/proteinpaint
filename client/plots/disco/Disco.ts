import { getCompInit } from '#rx'
import { DiscoRenderer } from './DiscoRenderer.ts'
import { DiscoInteractions } from './interactions/DiscoInteractions.ts'
import { ViewModelMapper } from './viewmodel/ViewModelMapper.ts'
import LegendRenderer from './legend/LegendRenderer.ts'
import ChromosomesRenderer from './chromosome/ChromosomesRenderer.ts'
import LabelsRenderer from './label/LabelsRenderer.ts'
import discoDefaults from './defaults.ts'
import NonExonicSnvRenderer from './snv/NonExonicSnvRenderer.ts'
import SnvRenderer from './snv/SnvRenderer.ts'
import LohRenderer from './loh/LohRenderer.ts'
import CnvBarRenderer from './cnv/CnvBarRenderer.ts'
import type IRenderer from './IRenderer.ts'
import { RingType } from './ring/RingType.ts'
import type Settings from './Settings.ts'
import { multiInit } from '../../rx'
import { topBarInit } from '../controls.btns'
import { configUiInit } from '../controls.config'
import { CnvHeatmapRenderer } from '#plots/disco/cnv/CnvHeatmapRenderer.ts'
import type ViewModel from '#plots/disco/viewmodel/ViewModel.ts'
import { CnvRenderingType } from '#plots/disco/cnv/CnvRenderingType.ts'
import { InvalidDataUI } from '#dom'

export default class Disco {
	// following attributes are required by rx
	private type: string
	private opts: any
	private state: any
	private id: any
	private app: any
	private features: any
	private isOpen: boolean
	private discoInteractions: DiscoInteractions

	private stateViewModelMapper?: ViewModelMapper
	private viewModel?: ViewModel
	private recreateViewModel = false
	private errorDiv: any

	constructor(opts: any) {
		this.type = 'Disco'
		this.opts = opts
		this.isOpen = false
		this.discoInteractions = new DiscoInteractions(this)
	}

	async init() {
		const state = this.app.getState()
		const settings = state.plots.find(p => p.id === this.id).settings

		this.stateViewModelMapper = new ViewModelMapper(settings, this.discoInteractions)
		this.viewModel = this.stateViewModelMapper.map(state)

		const holder = this.opts.holder
		// Figure out why we need to set the background color here
		const controlsHolder = holder.append('div').style('display', 'inline-block').style('vertical-align', 'top')
		const topbar = controlsHolder.append('div')
		const config_div = controlsHolder.append('div')
		const configInputsOptions = this.getConfigInputsOptions(this.viewModel)

		this.features = await multiInit({
			topbar: topBarInit({
				app: this.app,
				id: this.id,
				// TODO change the way svg is selected
				downloadHandler: () =>
					this.discoInteractions.downloadClickListener(holder.select('svg[id="sjpp_disco_plot"]').node()),
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

		this.errorDiv = holder.append('div')
	}

	private getConfigInputsOptions(viewModel: ViewModel) {
		const configInputsOptions: Array<any> = []

		if (viewModel.settings.Disco.showPrioritizeGeneLabelsByGeneSets) {
			const filterMutationsGenesCheckbox = [
				{
					boxLabel: viewModel.genesetName,
					label: `Filter mutations`,
					type: 'checkbox',
					chartType: 'Disco',
					settingsKey: 'prioritizeGeneLabelsByGeneSets',
					title: `Only show mutations for ${viewModel.genesetName} genes`
				}
			]

			configInputsOptions.push(...filterMutationsGenesCheckbox)
		}

		if (viewModel.cnvMaxValue !== 0 || viewModel.cnvMinValue !== 0) {
			const cnvConfigInputOptions = [
				{
					boxLabel: '',
					label: 'CNV rendering type',
					type: 'radio',
					chartType: 'Disco',
					settingsKey: 'cnvRenderingType',
					title: 'CNV rendering type',
					options: [
						{ label: 'Heatmap', value: CnvRenderingType.heatmap },
						{ label: 'Bar', value: CnvRenderingType.bar }
					]
				}
			]
			configInputsOptions.push(...cnvConfigInputOptions)
		}

		const genomeChr = this.app.opts.state.args.genome.majorchr
		const chromosomeConfigOption = {
			label: 'Chromosomes',
			title: 'Chromosomes shown in the plot',
			type: 'multiCheckbox',
			chartType: 'Disco',
			settingsKey: 'hiddenChromosomes',
			style: {
				colNum: 4
			},
			options: Object.keys(genomeChr).map(c => ({ label: c, value: c })),
			processInput: (values: string[] = []) => {
				/** Show all chromosomes as checked by default but only
				 * save to the state hidden (unchecked) chromosomes.
				 * Allows for easier debugging, reduces user error when
				 * embedding, and code clarity. */
				const reverse = Object.keys(genomeChr).filter(c => !values.includes(c))
				return reverse
			}
		}

		configInputsOptions.push(chromosomeConfigOption)

		const dimensionOptions = [
			{
				label: 'Radius',
				title: 'Set the radius of the entire plot, between 300 and 1000 pixels.',
				type: 'number',
				chartType: 'Disco',
				settingsKey: 'radius',
				debounceInterval: 500,
				step: 25,
				min: 300,
				max: 1000
			},
			{
				label: 'Fusion opacity',
				title: 'Adjust opacity of fusion arcs, between 0 and 1',
				type: 'number',
				chartType: 'Disco',
				settingsKey: 'fusionOpacity',
				step: 0.01,
				min: 0,
				max: 1,
				debounceInterval: 500
			}
		]

		configInputsOptions.push(...dimensionOptions)

		return configInputsOptions
	}

	async main(): Promise<void> {
		// run this only when this.state{} is set; cannot do this step in constructor()
		const settings: Settings = this.state.settings

		this.isOpen = settings.Disco.isOpen

		if (this.recreateViewModel) {
			this.stateViewModelMapper = new ViewModelMapper(settings, this.discoInteractions)
			this.viewModel = this.stateViewModelMapper.map(this.app.getState())
		}
		this.recreateViewModel = true

		if (this.viewModel) {
			const holder = this.opts.holder
			// TODO change this
			holder.select('div[id="sjpp_disco_plot_holder_div"]').remove()
			const svgDiv = holder.append('div').attr('id', 'sjpp_disco_plot_holder_div').style('display', 'inline-block')

			// TODO calculate viewModel.filteredSnvDataLength always
			const appState = this.app.getState()

			for (const name in this.features) {
				this.features[name].update({ state: this.state, appState })
			}

			const legendRenderer = new LegendRenderer(this.viewModel.cappedCnvMaxAbsValue, settings.label.fontSize)

			const discoRenderer = new DiscoRenderer(
				this.getRingRenderers(this.viewModel.settings, this.viewModel, this.discoInteractions.geneClickListener),
				legendRenderer,
				this.app.opts.state.args.genome
			)

			discoRenderer.render(svgDiv, this.viewModel)

			if (this.viewModel.invalidDataInfo?.entries?.length) {
				InvalidDataUI.render(this.errorDiv, this.viewModel.invalidDataInfo)
			}
		}
	}

	getState(appState: any) {
		return appState.plots.find(p => p.id === this.id)
	}

	getRingRenderers(
		settings: Settings,
		viewModel: ViewModel,
		geneClickListener: (gene: string, mnames: Array<string>) => void
	) {
		const chromosomesRenderer = new ChromosomesRenderer(
			settings.padAngle,
			settings.rings.chromosomeInnerRadius,
			settings.rings.chromosomeInnerRadius + settings.rings.chromosomeWidth,
			settings.label.fontSize
		)
		const labelsRenderer = new LabelsRenderer(
			settings.label.animationDuration,
			settings.label.fontSize,
			geneClickListener
		)
		const nonExonicSnvRenderer = new NonExonicSnvRenderer(geneClickListener)
		const snvRenderer = new SnvRenderer(settings.rings.snvRingWidth, geneClickListener)
		const cnvRenderer =
			settings.Disco.cnvRenderingType === CnvRenderingType.heatmap
				? new CnvHeatmapRenderer(viewModel.positivePercentile, viewModel.negativePercentile)
				: new CnvBarRenderer()
		const lohRenderer = new LohRenderer()

		const renderersMap: Map<RingType, IRenderer> = new Map()
		renderersMap.set(RingType.CHROMOSOME, chromosomesRenderer)
		renderersMap.set(RingType.LABEL, labelsRenderer)
		renderersMap.set(RingType.NONEXONICSNV, nonExonicSnvRenderer)
		renderersMap.set(RingType.SNV, snvRenderer)
		renderersMap.set(RingType.CNV, cnvRenderer)
		renderersMap.set(RingType.LOH, lohRenderer)

		return renderersMap
	}

	toggleVisibility(isOpen: boolean) {
		this.app.dispatch({
			type: 'plot_edit',
			id: this.opts.id,
			config: {
				settings: {
					Disco: { isOpen: !isOpen }
				}
			}
		})
	}
}

export const discoInit = getCompInit(Disco)

export const componentInit = discoInit

export async function getPlotConfig(opts: any, app: any) {
	return {
		chartType: 'Disco',
		subfolder: 'disco',
		extension: 'ts',
		settings: discoDefaults(opts.overrides, app)
	}
}
