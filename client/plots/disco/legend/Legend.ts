import SnvLegendElement from '#plots/disco/snv/SnvLegendElement.ts'
import CnvLegend from '#plots/disco/cnv/CnvLegend.ts'
import LohLegend from '#plots/disco/loh/LohLegend.ts'
import { CnvType } from '#plots/disco/cnv/CnvType.ts'

export default class Legend {
	snvTitle: string
	snvClassMap: Map<string, SnvLegendElement>

	cnvTitle: string
	cnvClassMap: Map<CnvType, CnvLegend>

	lohTitle: string
	lohLegend?: LohLegend

	fusionTitle: string
	fusionLegend: boolean
	cnvRenderingType: string

	constructor(
		snvTitle: string,
		cnvTitle: string,
		lohTitle: string,
		fusionTitle: string,
		snvClassMap: Map<string, SnvLegendElement>,
		cnvClassMap: Map<CnvType, CnvLegend>,
		cnvRenderingType: string,
		fusionLegend: boolean,
		lohLegend?: LohLegend
	) {
		this.snvTitle = snvTitle
		this.cnvTitle = cnvTitle
		this.lohTitle = lohTitle
		this.fusionTitle = fusionTitle
		this.snvClassMap = snvClassMap
		this.cnvClassMap = cnvClassMap
		this.cnvRenderingType = cnvRenderingType
		this.lohLegend = lohLegend
		this.fusionLegend = fusionLegend
	}

	legendCount(): number {
		return (
			(this.snvClassMap.size > 0 ? 1 : 0) +
			(this.cnvClassMap.size > 0 ? 1 : 0) +
			(this.lohLegend ? 1 : 0) +
			(this.fusionLegend ? 1 : 0)
		)
	}
}
