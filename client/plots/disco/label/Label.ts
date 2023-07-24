import Arc from '../arc/Arc'
import Line from './Line'
import MutationTooltip from '#plots/disco/label/MutationTooltip'
import FusionTooltip from '#plots/disco/fusion/FusionTooltip'

export default interface Label extends Arc {
	readonly angle: number
	readonly value: number
	readonly transform: string
	readonly textAnchor: string
	readonly ccAngle: number
	readonly line: Line
	readonly isPrioritized: boolean
	mutationsTooltip?: Array<MutationTooltip>
	fusionTooltip?: Array<FusionTooltip>
}
