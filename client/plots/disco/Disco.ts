import { getCompInit } from '#rx'
import { DiscoRenderer } from './DiscoRenderer'
import { DiscoInteractions } from './interactions/DiscoInteractions'
import { ViewModelMapper } from './viewmodel/ViewModelMapper'
import LegendRenderer from './legend/LegendRenderer'
import ChromosomesRenderer from './chromosome/ChromosomesRenderer'
import LabelsRenderer from './label/LabelsRenderer'
import discoDefaults from './defaults'
import NonExonicSnvRenderer from './snv/NonExonicSnvRenderer'
import SnvRenderer from './snv/SnvRenderer'
import LohRenderer from './loh/LohRenderer'
import CnvRenderer from './cnv/CnvRenderer'
import IRenderer from './IRenderer'
import { RingType } from './ring/RingType'
import Settings from './Settings'

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
		return appState.plots.find(p => p.id === this.id)
	}

	async main(): Promise<void> {
		const settings: Settings = this.state.settings
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
