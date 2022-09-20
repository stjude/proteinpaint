module.exports = {
	isMds3: true,
	genome: 'hg38',

	// termdb as a generic interface
	// getters will be added to abstract the detailed implementations
	termdb: {
		dictionary: { dbFile: 'files/hg38/ALL-pharmacotyping/db.760'},
		termid2totalsize2: {}
	}
}