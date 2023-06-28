import { getCompInit } from '#rx'
import { DiscoRenderer } from './renderer/DiscoRenderer'
import { DiscoInteractions } from './interactions/DiscoInteractions'
import { ViewModelMapper } from './mapper/ViewModelMapper'
import LegendRenderer from './renderer/LegendRenderer'
import ChromosomesRenderer from './renderer/ChromosomesRenderer'
import LabelsRenderer from './renderer/LabelsRenderer'
import discoDefaults from './defaults.ts'
import NonExonicSnvRenderer from './renderer/NonExonicSnvRenderer'
import SnvRenderer from './renderer/SnvRenderer'
import LohRenderer from './renderer/LohRenderer'
import CnvRenderer from './renderer/CnvRenderer'
import IRenderer from './renderer/IRenderer'
import { RingType } from './viewmodel/RingType'
import Settings from '#plots/disco/Settings.ts'

export default class Disco {
	private type: string
	private discoInteractions: DiscoInteractions
	private opts: any

	private state: any
	private id: any
	private app: any

	constructor(opts: any) {
		this.type = 'Disco'
		this.opts = opts
		this.discoInteractions = new DiscoInteractions(this)
	}

	getState(appState: any) {
		return appState.plots.find((p) => p.id === this.id)
	}

	async main(): Promise<void> {
		const settings: Settings = this.state.settings
		console.log('this.state.settings', this.state.settings)
		const stateViewModelMapper = new ViewModelMapper(settings)
		const viewModel = stateViewModelMapper.map(this.app.getState())

		const holder = this.opts.holder
		holder.selectAll('*').remove()

		const legendRenderer = new LegendRenderer(
			settings.cnv.capping,
			settings.label.fontSize,
			this.discoInteractions.cappingClickCallback
		)
		const discoRenderer = new DiscoRenderer(
			this.getRingRenderers(settings, this.discoInteractions.geneClickListener),
			legendRenderer,
			this.discoInteractions.downloadClickListener
		)

		discoRenderer.render(holder, viewModel)
	}

	getRingRenderers(settings: Settings, geneClickListener: (gene: string, mname: string) => void) {
		const chromosomesRenderer = new ChromosomesRenderer(
			settings.padAngle,
			settings.rings.chromosomeInnerRadius,
			settings.rings.chromosomeInnerRadius + settings.rings.chromosomeWidth
		)
		const labelsRenderer = new LabelsRenderer(settings.label.animationDuration, geneClickListener)
		const nonExonicSnvRenderer = new NonExonicSnvRenderer(geneClickListener)
		const snvRenderer = new SnvRenderer(settings.rings.ringWidth, geneClickListener)
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
}

export const discoInit = getCompInit(Disco)

export const componentInit = discoInit

export async function getPlotConfig(opts: any) {
	return {
		chartType: 'Disco',
		subfolder: 'disco',
		extension: 'ts',
		settings: discoDefaults(opts.overrides),
	}
}
