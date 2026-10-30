import type { Ribbon } from 'd3'
import type FusionSubgroup from './FusionSubgroup.ts'

export default class Fusion implements Ribbon {
	source: FusionSubgroup
	target: FusionSubgroup
	genes: string
	count: number
	endpts: string
	dt: number
	/** optional image file prefix of the event */
	eventImage?: string

	constructor(
		source: FusionSubgroup,
		target: FusionSubgroup,
		genes: string,
		count: number,
		endpts: string,
		dt: number,
		eventImage?: string
	) {
		this.source = source
		this.target = target
		this.genes = genes
		this.count = count
		this.endpts = endpts
		this.dt = dt
		this.eventImage = eventImage
	}
}
