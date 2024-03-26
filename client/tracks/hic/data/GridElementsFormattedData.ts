export class GridElementsFormattedData {
	formatData(items: any, binpx: number, resolution: number) {
		const formattedData: number[][] = []
		for (const [xCoord, yCoord, value] of items) {
			const xPx = Math.floor(xCoord / resolution) * binpx
			const yPx = Math.floor(yCoord / resolution) * binpx

			formattedData.push([xPx, yPx, value])
		}

		return formattedData
	}
}
