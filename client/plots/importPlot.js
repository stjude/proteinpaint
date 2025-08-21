export async function importPlot(chartType, notFoundMessage = '') {
	// TODO: move to dynamic import of exact plot names here, instead of string-pattern,
	// so that the bundler does not have to guess code file extension, directory names and letter casing
	switch (chartType) {
		case 'barchart':
			return await import(`./barchart.js`)

		case 'boxplot':
			return await import(`./boxplot/BoxPlot.js`)

		case 'sampleScatter':
			return await import(`./scatter/scatter.js`)

		case 'summarizeCnvGeneexp':
			return await import(`./summarizeCnvGeneexp.ts`)

		case 'summarizeGeneexpSurvival':
			return await import(`./summarizeGeneexpSurvival.ts`)

		case 'summarizeMutationDiagnosis':
			return await import(`./summarizeMutationDiagnosis.ts`)

		case 'summarizeMutationSurvival':
			return await import(`./summarizeMutationSurvival.ts`)

		case 'summary':
			return await import(`./summary.ts`)

		case 'survival':
			return await import(`./survival/survival.js`)

		case 'table':
			return await import(`./table.js`)

		case 'violin':
			return await import(`./violin.js`)

		default:
			// temporary option to force an error, to bypass the default filename matching
			if (notFoundMessage) throw notFoundMessage

			// TODO: should always throw here once all chart types are handled separately as cases;
			// the pattern matching below is problematic because:
			// - it matches non-plot code file names
			// - it assumes a non-typescript, .js file extension
			// - it doesn't handle plot code that are organized under its own subdirectory
			return await import(`../plots/${chartType}.js`)
	}
}
