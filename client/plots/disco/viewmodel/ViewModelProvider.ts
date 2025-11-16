import type Settings from '#plots/disco/Settings.ts'
import type Reference from '#plots/disco/chromosome/Reference.ts'
import Legend from '#plots/disco/legend/Legend.ts'
import FusionMapper from '#plots/disco/fusion/FusionMapper.ts'
import LohLegend from '#plots/disco/loh/LohLegend.ts'
import ViewModel from './ViewModel.ts'
import type DataMapper from '#plots/disco/data/DataMapper.ts'
import Ring from '#plots/disco/ring/Ring.ts'
import SnvArcsMapper from '#plots/disco/snv/SnvArcsMapper.ts'
import type SnvArc from '#plots/disco/snv/SnvArc.ts'
import type LohArc from '#plots/disco/loh/LohArc.ts'
import CnvArcsMapper from '#plots/disco/cnv/CnvArcsMapper.ts'
import type CnvArc from '#plots/disco/cnv/CnvArc.ts'
import LabelsMapper from '#plots/disco/label/LabelsMapper.ts'
import Labels from '#plots/disco/label/Labels.ts'
import NonExonicSnvArcsMapper from '#plots/disco/snv/NonExonicSnvArcsMapper.ts'
import LohArcMapper from '#plots/disco/loh/LohArcMapper.ts'
import Rings from '#plots/disco/ring/Rings.ts'
import { dtsnvindel } from '#shared/common.js'
import type { DiscoInteractions } from '../interactions/DiscoInteractions.ts'
import MutationWaterfallMapper from '#plots/disco/waterfall/MutationWaterfallMapper.ts'
import type MutationWaterfallPoint from '#plots/disco/waterfall/MutationWaterfallPoint.ts'

export default class ViewModelProvider {
	private settings: Settings
	private reference: Reference
	private sampleName: string
	private genesetName: string
	private dataMapper: DataMapper
	private discoInteractions: DiscoInteractions

	private nonExonicArcRing?: Ring<SnvArc> = undefined
	private snvArcsMapper?: SnvArcsMapper
	private snvArcRing?: Ring<SnvArc>
	private lohArcRing?: Ring<LohArc>
	private cnvArcsMapper?: CnvArcsMapper
	private cnvArcRing?: Ring<CnvArc>
	private mutationWaterfallRing?: Ring<MutationWaterfallPoint>

	constructor(
		settings: Settings,
		dataMapper: DataMapper,
		reference: Reference,
		sampleName: string,
		genesetName: string,
		discoInteractions: DiscoInteractions
	) {
		this.settings = settings
		this.dataMapper = dataMapper
		this.reference = reference
		this.sampleName = sampleName
		this.genesetName = genesetName
		this.discoInteractions = discoInteractions
	}

	map(data: Array<any>) {
		const dataHolder = this.dataMapper.map(data)

		const labelsMapper = new LabelsMapper(
			this.settings,
			this.sampleName,
			this.reference,
			dataHolder.cnvMaxPercentileAbs
		)

		const labelsData = labelsMapper.map(dataHolder.labelData, dataHolder.cnvData)

		const labelsRing = new Labels(this.settings, labelsData, dataHolder.hasPrioritizedGenes)

		const chromosomesRing = new Ring(
			this.settings.rings.chromosomeInnerRadius,
			this.settings.rings.chromosomeWidth,
			this.reference.chromosomes
		)

		const nonExonicSnvArcsMapper = new NonExonicSnvArcsMapper(
			dataHolder.nonExonicInnerRadius,
			this.settings.rings.nonExonicRingWidth,
			this.sampleName,
			this.reference
		)

		const nonExonicData = nonExonicSnvArcsMapper.map(dataHolder.nonExonicSnvData)

		if (nonExonicData.length > 0) {
			this.nonExonicArcRing = new Ring(
				dataHolder.nonExonicInnerRadius,
				this.settings.rings.nonExonicRingWidth,
				nonExonicData
			)
		}

		this.snvArcsMapper = new SnvArcsMapper(
			dataHolder.snvInnerRadius,
			this.settings.rings.snvRingWidth,
			this.sampleName,
			this.reference
		)
		const snvData = this.snvArcsMapper.map(dataHolder.snvRingDataMap)
		if (snvData.length > 0) {
			this.snvArcRing = new Ring(dataHolder.snvInnerRadius, this.settings.rings.snvRingWidth, snvData)
		}

		const lohMapper = new LohArcMapper(
			dataHolder.lohInnerRadius,
			this.settings.rings.lohRingWidth,
			this.sampleName,
			this.reference
		)
		const lohData = lohMapper.map(dataHolder.lohData)
		if (lohData.length > 0) {
			this.lohArcRing = new Ring(dataHolder.lohInnerRadius, this.settings.rings.lohRingWidth, lohData)
		}

		this.cnvArcsMapper = new CnvArcsMapper(
			dataHolder.cnvInnerRadius,
			this.settings.rings.cnvRingWidth,
			this.settings,
			this.sampleName,
			this.reference,
			dataHolder.percentilePositive,
			dataHolder.percentileNegative,
			dataHolder.cappedCnvMaxAbsValue,
			dataHolder.cnvMaxPercentileAbs,
			this.settings.cnv.unit,
			this.settings.Disco.cnvRenderingType
		)

		const cnvData = this.cnvArcsMapper.map(dataHolder.cnvData)
		if (cnvData.length > 0) {
			this.cnvArcRing = new Ring(dataHolder.cnvInnerRadius, this.settings.rings.cnvRingWidth, cnvData)
		}

		if (
			this.settings.Disco.mutationWaterfallPlot &&
			dataHolder.mutationWaterfallData?.length &&
			dataHolder.mutationWaterfallInnerRadius !== undefined &&
			(dataHolder.mutationWaterfallInnerRadius ?? 0) > 0 &&
			dataHolder.mutationWaterfallLogRange
		) {
			const mutationWaterfallMapper = new MutationWaterfallMapper(
				dataHolder.mutationWaterfallInnerRadius,
				this.settings.rings.mutationWaterfallRingWidth,
				this.reference,
				dataHolder.mutationWaterfallLogRange
			)

			const waterfallData = mutationWaterfallMapper.map(dataHolder.mutationWaterfallData)
			if (waterfallData.length > 0) {
				this.mutationWaterfallRing = new Ring(
					dataHolder.mutationWaterfallInnerRadius,
					this.settings.rings.mutationWaterfallRingWidth,
					waterfallData
				)
			}
		}

		const fusionMapper = new FusionMapper(dataHolder.fusionRadius, this.sampleName, this.reference)

		const fusions = fusionMapper.map(dataHolder.fusionData)

		let lohLegend: LohLegend | undefined

		if (this.settings.legend.lohLegendEnabled && dataHolder.lohMinValue && dataHolder.lohMaxValue) {
			lohLegend = new LohLegend(dataHolder.lohMinValue, dataHolder.lohMaxValue)
		}

		const legend = new Legend(
			this.settings.legend.snvTitle,
			this.settings.legend.cnvTitle,
			this.settings.legend.lohTitle,
			this.settings.legend.fusionTitle,
			this.settings.Disco.cnvPercentile,
			this.settings.Disco.cnvCutoffMode,
			this.snvArcsMapper ? this.snvArcsMapper.snvClassMap : new Map(),
			this.cnvArcsMapper ? this.cnvArcsMapper.cnvClassMap : new Map(),
			this.settings.Disco.cnvRenderingType,
			fusions.length > 0,
			this.discoInteractions,
			lohLegend
		)

		const rings = new Rings(
			labelsRing,
			chromosomesRing,
			this.nonExonicArcRing,
			this.snvArcRing,
			this.cnvArcRing,
			this.lohArcRing,
			this.mutationWaterfallRing
		)

		return new ViewModel(
			this.settings,
			rings,
			legend,
			fusions,
			dataHolder,
			this.genesetName,
			data.filter(i => i.dt == dtsnvindel).length
		)
	}
}
