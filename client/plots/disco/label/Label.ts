import Arc from '#plots/disco/arc/Arc.ts'
import Line from './Line.ts'
import MutationTooltip from '#plots/disco/label/MutationTooltip.ts'
import FusionTooltip from '#plots/disco/fusion/FusionTooltip.ts'
import CnvTooltip from '#plots/disco/cnv/CnvTooltip.ts'

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
