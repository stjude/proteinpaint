const { useEffect, useRef, FC, createElement, useState } = window.React
const { render } = window.ReactDOM
const runproteinpaint = window.runproteinpaint

// !!! TODO: may determine basepath prop value at runtime !!!
const basepath = 'http://localhost:3000' // '/auth/api/custom/proteinpaint'

/*interface PpProps {
  track: string;
  basepath?: string;
  geneId?: string;
  gene2canonicalisoform?: string;
  ssm_id?: string;
  mds3_ssm2canonicalisoform?: mds3_isoform;
  geneSearch4GDCmds3?: boolean;
}*/

export const ProteinPaintWrapper = props => {
	//: FC<PpProps> = (props: PpProps) => {
	const [, updateState] = useState({})
	window.updateState = updateState
	const filter0 = JSON.parse(JSON.stringify(window.filter0 || {}))

	// to track reusable instance for mds3 skewer track
	/*** TODO: bam track should return reusable renderer???? ***/
	const ppRef = useRef()

	useEffect(async () => {
		const data =
			props.track == 'lolliplot'
				? getLolliplotTrack(props, filter0)
				: props.track == 'bam'
				? getBamTrack(props, filter0)
				: null

		if (!data) return
		const rootElem = divRef.current /*as HTMLElement*/

		rootElem.parentNode.parentNode.parentNode.style.backgroundColor = '#fff'
		const arg = Object.assign(
			{ holder: rootElem, noheader: true, nobox: true, hide_dsHandles: true },
			JSON.parse(JSON.stringify(data))
		)
		if (ppRef.current) {
			ppRef.current.update(arg)
		} else {
			const pp_holder = rootElem.querySelector('.sja_root_holder')
			if (pp_holder) pp_holder.remove()
			ppRef.current = await runproteinpaint(arg)
		}
	}, [props.gene2canonicalisoform, props.mds3_ssm2canonicalisoform, props.geneSearch4GDCmds3, filter0])

	const divRef = useRef()
	return createElement('div', { ref: divRef }, '')
}

/*interface Mds3Arg {
  host: string;
  genome: string;
  gene2canonicalisoform?: string;
  mds3_ssm2canonicalisoform?: mds3_isoform;
  geneSearch4GDCmds3?: boolean;
  tracks: Track[];
}

interface Track {
  type: string;
  dslabel: string;
}

interface mds3_isoform {
  ssm_id: string;
  dslabel: string;
}*/

function getLolliplotTrack(props /*: PpProps*/, filter0 /*: any*/) {
	// host in gdc is just a relative url path,
	// using the same domain as the GDC portal where PP is embedded
	const arg /*: Mds3Arg*/ = {
		host: props.basepath || basepath /*as string*/,
		genome: 'hg38', // hardcoded for gdc
		//gene: data.gene,
		tracks: [
			{
				type: 'mds3',
				dslabel: 'GDC',
				filter0
			}
		]
	}

	if (props.geneId) {
		arg.gene2canonicalisoform = this.props.geneId
	} else if (props.ssm_id) {
		arg.mds3_ssm2canonicalisoform = {
			dslabel: 'GDC',
			ssm_id: props.ssm_id
		}
	} else {
		arg.geneSearch4GDCmds3 = true

		/* arg.geneSearch4tk = {
      tracks:[ {type:'mds3', dslabel:'GDC'} ],
      foundGeneCallback:()=>{}
    }*/
	}

	return arg
}

/*interface BamArg {
  host: string;
  gdcbamslice: boolean;
}*/

function getBamTrack(props /*: PpProps*/, filter0 /*: any*/) {
	// host in gdc is just a relative url path,
	// using the same domain as the GDC portal where PP is embedded
	const arg /*: BamArg*/ = {
		host: props.basepath || basepath /*as string*/,
		gdcbamslice: true,
		filter0
	}

	return arg
}
