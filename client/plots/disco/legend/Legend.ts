import type SnvLegendElement from '#plots/disco/snv/SnvLegendElement.ts'
import type CnvLegend from '#plots/disco/cnv/CnvLegend.ts'
import type LohLegend from '#plots/disco/loh/LohLegend.ts'
import { CnvType } from '#plots/disco/cnv/CnvType.ts'
import type { DiscoInteractions } from '../interactions/DiscoInteractions'

export type MutationWaterfallLegend = {
	color: string
	onColorChange: (color: string) => void
}

export type FusionLegendCounts = {
	interchromosomal: number
	intrachromosomal: number
}

export default class Legend {
	snvTitle: string
	snvClassMap: Map<string, SnvLegendElement>

	cnvTitle: string
	cnvClassMap: Map<CnvType, CnvLegend>
	cnvPercentile: number
	cnvCutoffMode: string
	cnvCount: number

	lohTitle: string
	lohLegend?: LohLegend

	fusionTitle: string
	fusionLegend: boolean
	fusionLegendCounts: FusionLegendCounts
	cnvRenderingType: string

	discoInteractions: DiscoInteractions

	mutationWaterfallLegend?: MutationWaterfallLegend

	constructor(
		snvTitle: string,
		cnvTitle: string,
		lohTitle: string,
		fusionTitle: string,
		cnvPercentile: number,
		cnvCutoffmode: string,
		snvClassMap: Map<string, SnvLegendElement>,
		cnvClassMap: Map<CnvType, CnvLegend>,
		cnvRenderingType: string,
		fusionLegend: boolean,
		discoInteractions: DiscoInteractions,
		lohLegend?: LohLegend,
		mutationWaterfallLegend?: MutationWaterfallLegend,
		fusionLegendCounts: FusionLegendCounts = { interchromosomal: 0, intrachromosomal: 0 },
		cnvCount = 0
	) {
		this.snvTitle = snvTitle
		this.cnvTitle = cnvTitle
		this.lohTitle = lohTitle
		this.fusionTitle = fusionTitle
		this.cnvPercentile = cnvPercentile
		this.cnvCutoffMode = cnvCutoffmode
		this.cnvCount = cnvCount
		this.snvClassMap = snvClassMap
		this.cnvClassMap = cnvClassMap
		this.cnvRenderingType = cnvRenderingType
		this.lohLegend = lohLegend
		this.fusionLegend = fusionLegend
		this.fusionLegendCounts = fusionLegendCounts
		this.discoInteractions = discoInteractions
		this.mutationWaterfallLegend = mutationWaterfallLegend
	}

	legendCount(): number {
		const hasItd = this.cnvClassMap.has(CnvType.ITD)
		return (
			(this.snvClassMap.size > 0 ? 1 : 0) +
			(this.cnvCount > 0 ? 1 : 0) +
			(hasItd ? 1 : 0) +
			(this.lohLegend ? 1 : 0) +
			(this.fusionLegend ? 1 : 0) +
			(this.mutationWaterfallLegend ? 1 : 0)
		)
	}
}
