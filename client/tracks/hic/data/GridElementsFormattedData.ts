export class GridElementsFormattedData {
	/**
	 * Format the data for the grid elements.
	 * @param items The data to format.
	 * @param binpx The bin size in pixels.
	 * @param resolution The resolution.
	 * @param isFirstChrX Whether the first chromosome is X. Used for chrpair view.
	 * @param isIntraChr Whether the data is intra-chromosomal. Used for chrpair view
	 * @returns The formatted data.
	 */
	formatData(view: string, items: any, binpx: number, resolution: number, isFirstChrX?: boolean, isIntraChr?: boolean) {
		const formattedData: number[][] = []
		for (const [xCoord, yCoord, value] of items) {
			const xPx = Math.floor(xCoord / resolution) * binpx
			const yPx = Math.floor(yCoord / resolution) * binpx
			if (view == 'genome') {
				if (isFirstChrX || isIntraChr) {
					const x = isFirstChrX ? xPx : yPx
					const y = isFirstChrX ? yPx : xPx
					formattedData.push([x, y, value])
					if (isIntraChr) {
						formattedData.push([y, x, value])
					}
				} else {
					formattedData.push([xPx, yPx, value])
				}
			}
			if (view == 'chrpair') {
				const x = isFirstChrX ? xPx : yPx
				const y = isFirstChrX ? yPx : xPx
				formattedData.push([x, y, value])
				if (isIntraChr) {
					formattedData.push([y, x, value])
				}
			}
		}
		return formattedData
	}
}
