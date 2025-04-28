import type Settings from '#plots/disco/Settings.ts'
import { CnvRenderingType } from '#plots/disco/cnv/CnvRenderingType.ts'

export default class CnvColorProvider {
	static getColor(value: number, settings: Settings, cnvMaxPercentileAbs = 0) {
		const cnv = settings.cnv
		const gainCapped =
			settings.Disco.cnvRenderingType == CnvRenderingType.heatmap ? settings.Disco.cnvCapping : cnvMaxPercentileAbs
		const lossCapped =
			settings.Disco.cnvRenderingType == CnvRenderingType.heatmap
				? -1 * settings.Disco.cnvCapping
				: -1 * cnvMaxPercentileAbs
		if (value < lossCapped) {
			return cnv.cappedLossColor
		} else if (value >= lossCapped && value <= 0) {
			return cnv.lossColor
		} else if (value > 0 && value <= gainCapped) {
			return cnv.ampColor
		} else {
			return cnv.cappedAmpColor
		}
	}
}
