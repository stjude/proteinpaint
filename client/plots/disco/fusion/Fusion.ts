import type { Ribbon } from 'd3'
import type FusionSubgroup from './FusionSubgroup.ts'

export default class Fusion implements Ribbon {
	source: FusionSubgroup
	target: FusionSubgroup
	genes: string
	count: number
	endpts: string
	dt: number

	constructor(
		source: FusionSubgroup,
		target: FusionSubgroup,
		genes: string,
		count: number,
		endpts: string,
		dt: number
	) {
		this.source = source
		this.target = target
		this.genes = genes
		this.count = count
		this.endpts = endpts
		this.dt = dt
	}
}
