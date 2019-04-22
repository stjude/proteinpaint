const path = require('path')
const utils = require('./utils')
const vcf = require('../src/vcf')
const common = require('../src/common')



/*
********************** EXPORTED
handle_vcfbyrange
handle_ssidbyonem
handle_getcsq
********************** INTERNAL
parseline_termdb2groupAF
parseline_termdb2groupAF_onegroup
*/


const serverconfig = __non_webpack_require__('./serverconfig.json')




exports.handle_ssidbyonem =  async ( q, genome, ds, result ) => {
/*
ssid: sample set id
get ssid by one m from vcf
*/
	if(ds.iscustom) throw 'custom ds not allowed'
	const tk = ds.track.vcf
	if(!tk) throw 'ds.track.vcf missing'
	if(!q.m) throw 'q.m missing'

	// query for this variant
	const coord = (tk.nochr ? q.m.chr.replace('chr','') : q.m.chr)+':'+(q.m.pos+1)+'-'+(q.m.pos+1)

	let m
	await utils.get_lines_tabix( [ tk.file, coord ], tk.dir, (line)=>{
		const [e,mlst,e2] = vcf.vcfparseline( line, tk )
		for(const m2 of mlst) {
			if( m2.pos==q.m.pos && m2.ref==q.m.ref && m2.alt==q.m.alt ) {
				m = m2
				return
			}
		}
	})

	if( !m ) throw 'variant not found'

	// divide samples by genotype
	const rr = [], // hom ref
		ra = [], // het
		aa = [] // hom alt
	for(const sample of m.sampledata) {
		if(!sample.genotype ) continue
		const hasref = sample.genotype.indexOf(q.m.ref)!=-1
		const hasalt = sample.genotype.indexOf(q.m.alt)!=-1
		if(hasref) {
			if(hasalt) ra.push(sample.sampleobj.name)
			else rr.push(sample.sampleobj.name)
		} else {
			if(hasalt) aa.push(sample.sampleobj.name)
		}
	}
	const filename = Math.random().toString()
	result.ssid = filename
	result.groups = {}
	const lines = []
	if( rr.length ) {
		const k = 'Homozygous reference'
		result.groups[k] = { size:rr.length }
		lines.push(k+'\t'+rr.join(','))
	}
	if( ra.length ) {
		const k = 'Heterozygous'
		result.groups[k] = { size:ra.length }
		lines.push(k+'\t'+ra.join(','))
	}
	if( aa.length ) {
		const k='Homozygous alternative'
		result.groups[k] = { size:aa.length }
		lines.push(k+'\t'+aa.join(','))
	}
	await utils.write_file( path.join(serverconfig.cachedir, 'ssid', filename ), lines.join('\n') )
}




exports.handle_vcfbyrange = async ( q, genome, ds, result ) => {
/*
for range query

ds is either official or custom
*/
	if(!q.rglst) throw '.rglst[] missing'

	const tk0 = ds.track.vcf
	if(!tk0) throw 'ds.track.vcf missing'

	// temporary vcf tk object, may with altered .samples[]
	const vcftk = {
		info: tk0.info,
		format: tk0.format,
		samples: tk0.samples
	}

	// different modes of query
	const [
		mode_range_variantonly,
		slicecolumnindex,
		mode_range_termdb2groupAF,
		columnidx_group1,
		columnidx_group2
		] = vcf_getquerymode( q, vcftk, ds )

	//console.log(columnidx_group1.length, columnidx_group2.length)

	if( mode_range_variantonly || mode_range_termdb2groupAF ) {
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

			let mlst

			if( mode_range_variantonly ) {

				if( slicecolumnindex ) {
					// TODO do slicing, parse reduced line with samples, and decide if the variant exist in the sliced samples
				} else {
					// no sample filtering, do not look at sample, just the variant
					const newline = line.split( '\t', 8 ).join('\t')
					const [e,mlst2,e2] = vcf.vcfparseline( newline, vcftk )
					mlst = mlst2
				}
			} else if( mode_range_termdb2groupAF ) {

				mlst = parseline_termdb2groupAF( line, columnidx_group1, columnidx_group2, vcftk )
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

					if( q.numerical_info_cutoff ) {
						let v
						if( m.info ) {
							v = m.info[ q.numerical_info_cutoff.key ]
						}
						if( !Number.isFinite( v )) {
							if( m.altinfo ) {
								v = m.altinfo[ q.numerical_info_cutoff.key ]
							}
						}
						if(Number.isFinite( v )) {
							if( q.numerical_info_cutoff.side == '<' ) {
								if( v >= q.numerical_info_cutoff.value ) return
							} else if( q.numerical_info_cutoff.side == '<=' ) {
								if( v > q.numerical_info_cutoff.value ) return
							} else if( q.numerical_info_cutoff.side == '>' ) {
								if( v <= q.numerical_info_cutoff.value ) return
							} else {
								if( v < q.numerical_info_cutoff.value ) return
							}
						} else {
							return
						}
					}

					if( m.csq ) {
						// not to release the whole csq, only to show number of interpretations
						m.csq_count = m.csq.length
						delete m.csq
					}
					delete m._m
					delete m.vcf_ID
					delete m.sampledata

					if( tk0.nochr ) m.chr = 'chr'+m.chr


					r.variants.push(m)
				}
			}
		})
	}

	vcfbyrange_collect_result( result, q.rglst )
}



function vcf_getquerymode ( q, vcftk, ds ) {

	if( q.termdb2groupAF ) {
		return [
			false,
			false,
			true,
			vcf_getcolumnidx_termdbgroup( q.termdb2groupAF.group1.terms, ds, vcftk.samples ),
			vcf_getcolumnidx_termdbgroup( q.termdb2groupAF.group2.terms, ds, vcftk.samples )
		]
	}

	return [
		true,
		false,
		false,
		false,
		false
	]
	/*
	slicecolumnindex
	in case of sample filtering
	from tk0.samples[], decide samples to keep
	update that to vcftk.samples
	and get the column indices for these samples for slicing
	*/
}



function vcf_getcolumnidx_termdbgroup ( terms, ds, vcfsamples ) {
/*
a sample must meet all term conditions
*/
	const usesampleidx = []
	for( const [i, sample] of vcfsamples.entries() ) {
		const sanno = ds.cohort.annotation[ sample.name ]
		if(!sanno) continue
		
		let match=true
		for(const t of terms ) {
			const t0 = ds.cohort.termdb.termjson.map.get( t.term_id )
			if( !t0 ) {
				continue
			}
			if( t0.iscategorical ) {
				if( sanno[ t.term_id ] != t.value ) {
					match=false
					break
				}
			}
		}
		if(match) {
			usesampleidx.push( i )
		}
	}
	return usesampleidx
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




exports.handle_getcsq =  async ( q, genome, ds, result ) => {
/*
get csq from one variant
*/
	const tk = ds.track.vcf
	if(!tk) throw 'ds.track.vcf missing'
	if(!q.m) throw 'q.m missing'

	// query for this variant
	const coord = (tk.nochr ? q.m.chr.replace('chr','') : q.m.chr)+':'+(q.m.pos+1)+'-'+(q.m.pos+1)

	await utils.get_lines_tabix( [ tk.file, coord ], tk.dir, (line)=>{
		const [e,mlst,e2] = vcf.vcfparseline( line, tk )
		for(const m2 of mlst) {
			if( m2.pos==q.m.pos && m2.ref==q.m.ref && m2.alt==q.m.alt ) {
				result.csq = m2.csq
				return
			}
		}
	})
}





function parseline_termdb2groupAF ( line, columnidx_group1, columnidx_group2, vcftk ) {
	const l = line.split('\t')
	const samples = vcftk.samples
	delete vcftk.samples

	const alleles = [ l[3], ...l[4].split(',') ]

	const g1 = parseline_termdb2groupAF_onegroup( alleles, l, columnidx_group1 )
	const g2 = parseline_termdb2groupAF_onegroup( alleles, l, columnidx_group2 )
	if( g1.allref && g2.allref ) {
		return
	}

	const [e,mlst,e2] = vcf.vcfparseline( l.slice(0,8).join('\t'), vcftk )

	for(const m of mlst) {
		let g1AF,
			g2AF
		{
			const ref = g1.alleles.get( m.ref ) || 0
			const alt = g1.alleles.get( m.alt ) || 0
			g1AF = (ref+alt==0) ? 0 : alt/(ref+alt)
		}
		{
			const ref = g2.alleles.get( m.ref ) || 0
			const alt = g2.alleles.get( m.alt ) || 0
			g2AF = (ref+alt==0) ? 0 : alt/(ref+alt)
		}
		m.AF2group = [ g1AF, g2AF ]
	}

	vcftk.samples = samples

	return mlst
}



function parseline_termdb2groupAF_onegroup ( alleles, l, columnidx ) {
	let allref = true

	const allele2count = new Map()
	// k: allele, v: count
	for(const a of alleles) {
		allele2count.set( a, 0 )
	}

	for(const i of columnidx ) {
		if(!l[9+i]) continue
		const gt = l[9+i].split(':')[0]
		if(gt=='.') continue
		gt.split( gt.indexOf('/')==-1 ? '|' : '/' ).forEach( s=> {
			const i = Number.parseInt(s)
			if(Number.isNaN(i)) return
			const allele = alleles[ i ]
			if(!allele) return
			if(i!=0) {
				allref = false
			}
			allele2count.set( allele, 1 + allele2count.get(allele) )
		})
	}
	return {
		allref,
		alleles: allele2count
	}
}
