import type Arc from '#plots/disco/arc/Arc.ts'

export default class Ring<T extends Arc> {
	width: number

	innerRadius: number
	outerRadius: number

	elements: Array<T>

	constructor(innerRadius: number, width: number, elements: Array<T>) {
		this.innerRadius = innerRadius
		this.outerRadius = innerRadius + width
		this.width = width
		this.elements = elements
	}
}
