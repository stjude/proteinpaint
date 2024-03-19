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
import CnvRenderer from './cnv/CnvRenderer.ts'
import IRenderer from './IRenderer.ts'
import { RingType } from './ring/RingType.ts'
import Settings from './Settings.ts'
import { multiInit } from '../../rx'
import { topBarInit } from '#plots/controls.btns.js'
import { configUiInit } from '#plots/controls.config.js'

export default class Disco {
	// following attributes are required by rx
	private type: string
	private opts: any
	private state: any
	private id: any
	private app: any
	constructor(opts: any) {
		this.type = 'Disco'
		this.opts = opts
	}

	getState(appState: any) {
		return appState.plots.find(p => p.id === this.id)
	}

	async main(): Promise<void> {
		// run this only when this.state{} is set; cannot do this step in constructor()
		const discoInteractions = new DiscoInteractions(this)

		const settings: Settings = this.state.settings

		const stateViewModelMapper = new ViewModelMapper(settings)
		const viewModel = stateViewModelMapper.map(this.app.getState())

		const holder = this.opts.holder
		holder.selectAll('*').remove()

		const topbar = holder.append('div')
		const config_div = holder.append('div')

		const displayedElementsCount =
			viewModel.settings.Disco.prioritizeGeneLabelsByGeneSets &&
			viewModel.settings.Disco.showPrioritizeGeneLabelsByGeneSets
				? viewModel.filteredSnvDataLength
				: viewModel.snvDataLength

		// TODO calculate viewModel.filteredSnvDataLength always

		const features = await multiInit({
			topbar: topBarInit({
				app: this.app,
				id: this.id,
				// TODO change the way svg is selected
				downloadHandler: () =>
					discoInteractions.downloadClickListener(holder.select('svg[data-testid="sjpp_disco_plot"]').node()),
				callback: () => this.toggleVisibility(settings.Disco.isOpen),
				isOpen: () => settings.Disco.isOpen,
				holder: topbar
			}),

			config: configUiInit({
				app: this.app,
				id: this.id,
				holder: config_div,
				isOpen: () => settings.Disco.isOpen,
				inputs: [
					{
						label: 'Cnv capping',
						type: 'number',
						chartType: 'Disco',
						settingsKey: 'cnvCapping',
						title: 'Cnv capping',
						min: 0
					},
					{
						boxLabel: '',
						label: `Only show mutations for ${viewModel.genesetName} genes (${displayedElementsCount} out of ${viewModel.snvDataLength})`,
						type: 'checkbox',
						chartType: 'Disco',
						settingsKey: 'prioritizeGeneLabelsByGeneSets',
						title: 'Only show mutations for Cancer Gene Census genes'
					}
				]
			})
		})

		const appState = this.app.getState()

		for (const name in features) {
			features[name].update({ state: this.state, appState })
		}

		const legendRenderer = new LegendRenderer(
			settings.Disco.cnvCapping,
			settings.label.fontSize
			// ,
			// discoInteractions.cappingClickCallback
		)

		const discoRenderer = new DiscoRenderer(
			this.getRingRenderers(settings, discoInteractions.geneClickListener),
			legendRenderer,
			discoInteractions.downloadClickListener,
			discoInteractions.prioritizeGenesCheckboxListener
		)

		discoRenderer.render(holder, viewModel)
	}

	getRingRenderers(settings: Settings, geneClickListener: (gene: string, mnames: Array<string>) => void) {
		const chromosomesRenderer = new ChromosomesRenderer(
			settings.padAngle,
			settings.rings.chromosomeInnerRadius,
			settings.rings.chromosomeInnerRadius + settings.rings.chromosomeWidth
		)
		const labelsRenderer = new LabelsRenderer(settings.label.animationDuration, geneClickListener)
		const nonExonicSnvRenderer = new NonExonicSnvRenderer(geneClickListener)
		const snvRenderer = new SnvRenderer(settings.rings.snvRingWidth, geneClickListener)
		const cnvRenderer = new CnvRenderer(settings.menu.padding)
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

export async function getPlotConfig(opts: any) {
	return {
		chartType: 'Disco',
		subfolder: 'disco',
		extension: 'ts',
		settings: discoDefaults(opts.overrides)
	}
}
