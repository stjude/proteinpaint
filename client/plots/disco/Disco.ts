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

export default class Disco {
	private discoInteractions: DiscoInteractions

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
		this.discoInteractions = new DiscoInteractions(this)

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
			this.discoInteractions.downloadClickListener,
			this.discoInteractions.prioritizeGenesCheckboxListener
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
