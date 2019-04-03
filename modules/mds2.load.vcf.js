const utils = require('./utils')
const vcf = require('../src/vcf')
const common = require('../src/common')




exports.handle_vcfbyrange = async ( q, genome, ds, result ) => {
/*
for range query

ds is either official or custom
*/
	if(!q.rglst) throw '.rglst[] missing'

	const tk0 = ds.track.vcf
	if(!tk0) throw 'ds.track.vcf missing'

	if( ds.iscustom ) {
		await utils.init_one_vcf( tk0, genome )
	}

	// temporary vcf tk object, may with altered .samples[]
	const vcftk = {
		info: tk0.info,
		format: tk0.format,
		samples: tk0.samples
	}

	// different modes of query
	let mode_range_variantonly = true
	let mode_singevariant = false

	let slicecolumnindex = null
	/* in case of sample filtering
	from tk0.samples[], decide samples to keep
	update that to vcftk.samples
	and get the column indices for these samples for slicing
	*/


	if( mode_range_variantonly ) {
		query_vcf_applymode_variantonly( vcftk, q )
	}


	for(const r of q.rglst) {

		if( tk0.viewrangeupperlimit && (r.stop-r.start)>=tk0.viewrangeupperlimit ) {
			r.rangetoobig = 'Zoom in under '+common.bplen(tk0.viewrangeupperlimit)+' to view VCF data'
			continue
		}

		const mockblock = make_mockblock( r )

		const coord = (tk0.nochr ? r.chr.replace('chr','') : r.chr)+':'+r.start+'-'+r.stop

		await utils.get_lines_tabix( [ tk0.file, coord ], tk0.dir, (line)=>{

			if( mode_range_variantonly ) {

				let mlst
				if( slicecolumnindex ) {
					// TODO do slicing, parse reduced line with samples, and decide if the variant exist in the sliced samples
				} else {
					// no sample filtering, do not look at sample, just the variant
					const newline = line.split( '\t', 8 ).join('\t')
					const [e,mlst2,e2] = vcf.vcfparseline( newline, vcftk )
					mlst = mlst2
				}

				if( mlst ) {
					for(const m of mlst) {

						common.vcfcopymclass( m, mockblock )

						// m.class is decided, add to counter
						result.mclass2count[m.class] = ( result.mclass2count[m.class] || 0 ) + 1

						// if to drop this variant
						if( q.hidden_mclass && q.hidden_mclass.has(m.class) ) {
							continue
						}


						delete m.csq
						delete m._m
						delete m.vcf_ID
						delete m.sampledata

						if( tk0.nochr ) m.chr = 'chr'+m.chr


						r.variants.push(m)
					}
				}
			}
		})
	}

	vcfbyrange_collect_result( result, q.rglst )
}






function vcfbyrange_collect_result ( result, rglst ) {
	// done querying, collect result, also clear rglst which is shared by others

	result.vcf = {
		rglst: []
	}
	for(const r of rglst) {
		const r2 = {
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width,
			reverse: r.reverse,
			xoff: r.xoff
		}
		result.vcf.rglst.push( r2 )
		if( r.rangetoobig ) {
			r2.rangetoobig = r.rangetoobig
			delete r.rangetoobig
		} else if( r.variants ) {
			r2.variants = r.variants
			delete r.variants
		} else if( r.canvas ) {
			r2.img = r.canvas.toDataURL()
			delete r.canvas
		}
	}
}



function query_vcf_applymode_variantonly ( vcftk, q ) {
/* at variant only mode, apply changes and prepare for querying
*/
	delete vcftk.samples // not to parse samples
	for(const r of q.rglst) {
		r.variants = []
		/* if r.variants[] is valid, store variants here
		if number of variants is above cutoff, render them into image
		in that case
		will create r.canvas
		render all current r.variants into canvas
		and delete r.variants
		so that subsequent variants will all be rendered into canvas
		canvas rendering will mimick client-side display
		*/
	}
}



function make_mockblock ( r ) {
	if( r.usegm_isoform ) return {gmmode:'protein',usegm:{isoform:r.usegm_isoform}}
	return {}
}



async function may_process_customtrack ( tk ) {
/*
if is url, will cache index
if is custom track, will parse header
*/
	if( tk.url ) {
		tk.dir = await app.cache_index_promise( tk.indexURL || tk.url+'.tbi' )
	}
}
