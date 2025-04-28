import type Arc from '#plots/disco/arc/Arc.ts'
import type Line from './Line.ts'
import type MutationTooltip from '#plots/disco/label/MutationTooltip.ts'
import type FusionTooltip from '#plots/disco/fusion/FusionTooltip.ts'
import type CnvTooltip from '#plots/disco/cnv/CnvTooltip.ts'

export default interface Label extends Arc {
	readonly angle: number
	readonly value: number
	readonly transform: string
	readonly textAnchor: string
	readonly ccAngle: number
	readonly line: Line
	readonly isPrioritized: boolean
	readonly chr: string
	start: number
	stop: number
	mutationsTooltip?: Array<MutationTooltip>
	fusionTooltip?: Array<FusionTooltip>
	cnvTooltip?: Array<CnvTooltip>
}
