/*** 
	all GDC methods meant to be attached to a
	pp-react wrapper instance
***/

/*
	return runproteinpaint argument to render 
	a lolliplot track
*/
export function getLolliplotTrack() {
	// not sure yet what will be passed via localStorage or how
	const data = this.data // passed during instantiation, new ProteinPaint(data)
		? this.data
		: this.dataKey // attached to wrapper instance, PpReact.dataKey = dataKey
		? JSON.parse(localStorage.getItem(this.dataKey))
		: this.props.dataKey // passed as props, <ProteinPaint dataKey='' />
		? JSON.parse(localStorage.getItem(this.props.dataKey))
		: { host: 'https://' + window.location.host, basepath: '' }

	// simulate passing set_id via URL parameter
	const params = this.getUrlParams()
	const arg = {
		host: data.host + data.basepath,
		genome: 'hg38', // hardcoded for gdc
		gene: data.gene,
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC'
			}
		]
	}

	if (data.token) {
		arg.tracks[0].token = data.token
	}
	if (params.filters && params.filters.content[0].content.value[0].includes('set_id:')) {
		arg.tracks[0].set_id = params.filters.content[0].content.value[0]
	}
	if (params.gene) {
		arg.gene = params.gene
	}

	return arg
}
