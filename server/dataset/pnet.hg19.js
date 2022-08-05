// allow the reuse of this PNET dataset jsfile for other datasets
// like MB_meta_analysis by using updateAttr: [] items in the corresponding
// serverconfig dataset entry and by by exporting a dataset generator function
// instead of exporting a static object

module.exports = function() {
	// not using the usual 'common' argument, just want a fresh dataset object
	// to allow sharing this jsfile for overrides
	// and without having to share the same ds bootstrap object instance
	return {
		isMds: true,

		cohort: {
			allowedChartTypes: ['barchart', 'survival', 'matrix'],
			db: {
				file: 'files/hg19/pnet/clinical/db'
			},
			termdb: {
				allowedTermTypes: ['geneVariant']
			}
		}
	}
}
