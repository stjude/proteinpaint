export default function formatPlotData(_plots) {
	const plots = structuredClone(_plots)

	for (const plot of plots) {
		const expCells = plot.expCells.sort((a, b) => a.geneExp - b.geneExp)
		plot.cells = [...plot.noExpCells, ...expCells]
		const clusters = new Set(plot.cells.map(c => c.category))

		plot.clusters = Array.from(clusters).sort((a: any, b: any) => {
			const num1 = parseInt(a.split(' ')[1])
			const num2 = parseInt(b.split(' ')[1])
			return num1 - num2
		})
	}
	return plots
}
