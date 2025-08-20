export async function importPlot(chartType) {
	switch (chartType) {
		case 'survival':
			return await import(`./survival/survival.js`)

		default:
			return await import(`../plots/${chartType}.js`)
	}
}
