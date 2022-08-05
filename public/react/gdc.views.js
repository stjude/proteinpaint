/*** 
	all GDC methods meant to be attached to a
	pp-react wrapper instance
***/

/*
	return runproteinpaint argument to render 
	a lolliplot track
*/

const basepath = '/'

export function getLolliplotTrack() {
	// host in gdc is just a relative url path,
	// using the same domain as the GDC portal where PP is embedded
	const host = 'basepath' in this.props ? this.props.basepath : basepath

	const arg = {
		host,
		genome: 'hg38', // hardcoded for gdc
		//gene: data.gene,
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC'
			}
		]
	}

	if (this.props.geneId) {
		arg.gene2canonicalisoform = this.props.geneId
	} else if (this.props.ssm_id) {
		arg.mds3_ssm2canonicalisoform = {
			dslabel: 'GDC',
			ssm_id: this.props.ssm_id
		}
	} else {
		arg.geneSearch4GDCmds3 = true
	}

	return arg
}

export function getTrackByType() {
	const host = 'basepath' in this.props ? this.props.basepath : basepath

	if (this.props.type == 'lolliplot') {
		const { geneId, filters } = this.props
		if (!geneId) {
			return {
				noheader: 1,
				geneSearch4GDCmds3: true
			}
		} else {
			const arg = {
				host,
				genome: 'hg38', // hardcoded for gdc
				//gene: data.gene,
				gene2canonicalisoform: geneId,
				tracks: [
					{
						type: 'mds3',
						dslabel: 'GDC'
					}
				]
			}

			if (filters) {
				arg.tracks[0].filter0 = this.props.filters
			}

			return arg
		}
	}
}

/*
export function getBamTrack() {
	// host in gdc is just a relative url path,
	// using the same domain as the GDC portal where PP is embedded
	const host = 'basepath' in this.props ? this.props.basepath : basepath

	const arg = {
		host,
		genome: 'hg38', // hardcoded for gdc
		//gene: data.gene,
		gdcbamslice:{
			uionly:true
		}
	}

	// 
}
*/
