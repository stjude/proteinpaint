/*** 
	all GDC methods meant to be attached to a
	pp-react wrapper instance
***/

/*
	return runproteinpaint argument to render 
	a lolliplot track
*/

const basepath = '/auth/api/custom/proteinpaint'

export function getLolliplotTrack() {
	// host in gdc is just a relative url path,
	// using the same domain as the GDC portal where PP is embedded
	const host = 'basepath' in this.props ? this.props.basepath : basepath

	const arg = {
		host,
		genome: 'hg38', // hardcoded for gdc
		//gene: data.gene,
		loggedin: this.props.loggedin,
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC'
			}
		]
	}

	// get the gene transcript from the URL pathname and
	// the set_id from within the URL "filter" parameter
	const params = this.getUrlParams()
	if (params.gene) {
		arg.gene2canonicalisoform = params.gene
	}
	if (params.filters) {
		arg.tracks[0].filter0 = params.filters
	}

	return arg
}
