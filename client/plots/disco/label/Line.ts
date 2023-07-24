import Point from './Point'

export default class Line {
	color: string
	points = new Array<Point>()

	constructor(points: Array<Point>, color: string) {
		this.points = points
		this.color = color
	}
}
