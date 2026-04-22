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

		case 'DEinput':
			return await import(`./DEinput.ts`)

		case 'dictionary':
			return await import(`./dictionary.js`)

		case 'differentialAnalysis':
			return await import(`./diffAnalysis/DifferentialAnalysis.ts`)

		case 'Disco':
			return await import('./disco/Disco.ts')

		case 'dmr':
			return await import('./dmr/DmrPlot.ts')

		case 'DziViewer':
			return await import(`./dziviewer/DziViewer.ts`)

		case 'GeneExpInput':
			return await import(`./GeneExpInput.ts`)

		case 'genomeBrowser':
			return await import('./gb/GB.ts')

		case 'grin2':
			return await import('./grin2/grin2')

		case 'gsea':
			return await import(`./gsea.js`)

		case 'report':
			return await import(`././report/report.ts`)

		case 'runChart2': //See frequencyChart
		case 'frequencyChart':
			return await import(`./runChart2/RunChart2.ts`)

		case 'profileBarchart':
			return await import('./profile/profileBarchart.ts')

		case 'profileBarchart2':
			return await import('./profile/barchart2.ts')

		case 'profileForms':
			return await import('./profile/profileForms.ts')

		case 'profilePlot':
			return await import('./profile/profilePlot.ts')

		case 'profilePolar':
			return await import('./profile/polar.ts')

		case 'profilePolar2':
			return await import('./profile/polar2.ts')

		case 'profileRadar':
			return await import('./profile/profileRadar.ts')

		case 'profileRadar2':
			return await import('./profile/radar2.ts')

		case 'profileRadarFacility':
			return await import('./profile/profileRadarFacility.ts')

		case 'profileRadarFacility2':
			return await import('./profile/radarFacility2.ts')

		case 'proteinView':
			return await import(`./proteinView.ts`)

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

		case 'summarizeMutationCnv':
			return await import(`./summarizeMutationCnv.ts`)

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

		case 'WSISamplesPlot':
			return await import('./wsisamples/WsiSamplesPlot.ts')

		case 'WSIViewer':
			return await import('./wsiviewer/WSIViewer.ts')

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
