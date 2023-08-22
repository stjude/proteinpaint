import Settings from '#plots/disco/Settings.ts'

export default class CnvColorProvider {
	static getColor(value: number, settings: Settings) {
		const cnv = settings.cnv
		const gainCapped = settings.cnv.capping
		const lossCapped = -1 * settings.cnv.capping
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
