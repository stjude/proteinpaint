/*** 
	all GDC methods meant to be attached to a
	pp-react wrapper instance
***/

/*
	return runproteinpaint argument to render 
	a lolliplot track
*/
export function getLolliplotTrack() {
	// assume for now that host, basepath, and optional token
	// are passed via localStorage
	const data = this.props.dataKey // passed as props, <ProteinPaint dataKey='' />
		? JSON.parse(this.window.localStorage.getItem(this.props.dataKey))
		: { host: 'https://' + this.window.location.host, basepath: '' }

	const arg = {
		host: data.host + data.basepath,
		genome: 'hg38', // hardcoded for gdc
		gene: data.gene,
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC',
				token: data.token // may be empty (undefined, null)
			}
		]
	}

	// get the gene transcript from the URL pathname and
	// the set_id from within the URL "filter" parameter
	const params = this.getUrlParams()
	if (params.gene) {
		arg.gene = params.gene
	}
	if (params.filters && params.filters.content[0].content.value[0].includes('set_id:')) {
		arg.tracks[0].set_id = params.filters.content[0].content.value[0]
	}

	return arg
}
