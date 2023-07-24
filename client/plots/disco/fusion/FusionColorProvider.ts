import { FusionLegend } from '#plots/disco/fusion/FusionLegend.ts'

export default class FusionColorProvider {
	static getColor(chrA: string, chrB: string) {
		if (chrA != chrB) {
			return FusionLegend.Interchromosomal.valueOf()
		} else {
			return FusionLegend.Intrachromosomal.valueOf()
		}
	}
}
