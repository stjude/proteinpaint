export class GridElementsFormattedData {
	min: number
	max: number
	items: number[][]
	binpx: number
	resolution: number

	constructor(min: number, max: number, items: any, binpx: number, resolution: number) {
		this.min = min
		this.max = max
		this.items = items
		this.binpx = binpx
		this.resolution = resolution
	}

	formatData() {
		const formattedData: number[][] = []
		for (const [xCoord, yCoord, value] of this.items) {
			const xPx = Math.floor(xCoord / this.resolution) * 1
			const yPx = Math.floor(yCoord / this.resolution) * 1

			formattedData.push([xPx, yPx, value])
		}

		return formattedData
	}
}
