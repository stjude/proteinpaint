export async function importPlot(chartType, notFoundMessage = '') {
	// TODO: move to dynamic import of exact plot names here, instead of string-pattern,
	// so that the bundler does not have to guess code file extension, directory names and letter casing
	switch (chartType) {
		case 'AIProjectAdmin':
			return await import('./aiProjectAdmin/AIProjectAdmin.ts')

		case 'barchart':
			return await import(`./barchart.js`)

		case 'boxplot':
			return await import(`./boxplot/BoxPlot.ts`)

		case 'chat':
			return await import(`./chat/chat.ts`)

		case 'correlationVolcano':
			return await import(`./corrVolcano/CorrelationVolcano.ts`)

		/*// enable this when gb/GB.ts is ready to replace genomeBrowser.js
		case 'genomeBrowser':
			return await import('./gb/GB.ts')
			*/

		case 'differentialAnalysis':
			return await import(`./diffAnalysis/DifferentialAnalysis.ts`)

		case 'disco':
			return await import('./disco/Disco.ts')

		case 'grin2':
			return await import('./grin2/grin2')

		case 'sampleScatter':
			return await import(`./scatter/scatter.js`)

		case 'sc':
			return await import('./sc/SC.ts')

		case 'summarizeCnvGeneexp':
			return await import(`./summarizeCnvGeneexp.ts`)

		case 'summarizeGeneexpSurvival':
			return await import(`./summarizeGeneexpSurvival.ts`)

		case 'summarizeMutationDiagnosis':
			return await import(`./summarizeMutationDiagnosis.ts`)

		case 'summarizeMutationSurvival':
			return await import(`./summarizeMutationSurvival.ts`)

		case 'summaryInput':
			return await import(`./summaryInput.ts`)

		case 'summary':
			return await import(`./summary.ts`)

		case 'survival':
			return await import(`./survival/survival.js`)

		case 'table':
			return await import(`./table.js`)

		case 'violin':
			return await import(`./violin.js`)

		case 'volcano':
			return await import(`./volcano/Volcano.ts`)

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
