const fs = require('fs')
const path = require('path')
const spawn = require('child_process').spawn
const utils = require('./utils')
const vcf = require('../src/vcf')
const common = require('../src/common')



/*
********************** EXPORTED
handle_vcfbyrange
handle_ssidbyonem
handle_getcsq
********************** INTERNAL
get_columnidx_byterms
get_querymode
query_vcf_applymode
parseline_termdb2groupAF
parseline_termdb2groupAF_onegroup
parseline_ebgatest
may_apply_chisqtest_ebgatest
vcfbyrange_collect_result
_m_is_filtered
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

	const querymode = get_querymode( q, vcftk, ds ) // this is critical

	query_vcf_applymode( querymode, vcftk, q )

	for(const r of q.rglst) {

		if( tk0.viewrangeupperlimit && (r.stop-r.start)>=tk0.viewrangeupperlimit ) {
			r.rangetoobig = 'Zoom in under '+common.bplen(tk0.viewrangeupperlimit)+' to view VCF data'
			continue
		}

		const mockblock = make_mockblock( r )
		const m_is_filtered = _m_is_filtered( q, result, mockblock )

		const coord = (tk0.nochr ? r.chr.replace('chr','') : r.chr)+':'+r.start+'-'+r.stop

		await utils.get_lines_tabix( [ tk0.file, coord ], tk0.dir, (line)=>{

			let mlst

			if( querymode.range_variantonly ) {

				if( querymode.slicecolumnindex ) {
					// TODO do slicing, parse reduced line with samples, and decide if the variant exist in the sliced samples
				} else {
					// no sample filtering, do not look at sample, just the variant
					const newline = line.split( '\t', 8 ).join('\t')
					const [e,mlst2,e2] = vcf.vcfparseline( newline, vcftk )
					mlst = mlst2.reduce(
						(uselst, m) => {
							if( m_is_filtered( m ) ) {
							} else {
								uselst.push(m)
							}
							return uselst
						},
						[]
					)
				}

			} else if( querymode.range_termdb2groupAF ) {

				mlst = parseline_termdb2groupAF( line, querymode.columnidx_group1, querymode.columnidx_group2, vcftk, m_is_filtered )

			} else if( querymode.range_ebgatest ) {

				mlst = parseline_ebgatest( line, querymode.columnidx, querymode.pop2average, vcftk, ds, m_is_filtered )
			}

			if( mlst ) {
				for(const m of mlst) {



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

	await may_apply_chisqtest_ebgatest( q.rglst, querymode )

	vcfbyrange_collect_result( result, q.rglst, querymode )
}



function get_querymode ( q, vcftk, ds ) {
/*
generate the "querymode" object that drives subsequent queries
*/

	if( q.termdb2groupAF ) {
		return {
			range_termdb2groupAF: true,
			columnidx_group1: get_columnidx_byterms( q.termdb2groupAF.group1.terms, ds, vcftk.samples ),
			columnidx_group2: get_columnidx_byterms( q.termdb2groupAF.group2.terms, ds, vcftk.samples ),
		}
	}
	if( q.ebgatest ) {
		// vcf header column idx for the current term
		const columnidx = get_columnidx_byterms( q.ebgatest.terms, ds, vcftk.samples )

		// to get population admix average for this subset of samples, initiate 0 for each population
		const pop2average = new Map()
		for(const p of q.ebgatest.populations) {
			pop2average.set(
				p.key,
				{
					infokey_AC: p.infokey_AC,
					infokey_AN: p.infokey_AN,
					average: 0
				}
			)
		}
		let poptotal = 0 // sum for all populations
		// sum up admix for everybody from this set
		for(const idx of columnidx) {
			const samplename = vcftk.samples[idx].name
			const anno = ds.cohort.annotation[ samplename ]
			if( !anno ) continue
			for(const p of q.ebgatest.populations) {
				const v = anno[ p.key ]
				if(!Number.isFinite(v)) continue
				pop2average.get( p.key ).average += v
				poptotal += v
			}
		}
		// after sum, make average
		for(const [k,v] of pop2average) {
			v.average /= poptotal
		}
		return {
			range_ebgatest: true,
			columnidx,
			pop2average
		}
	}

	return {
		range_variantonly: true
	}
	/*
	slicecolumnindex
	in case of sample filtering
	from tk0.samples[], decide samples to keep
	update that to vcftk.samples
	and get the column indices for these samples for slicing
	*/
}



function get_columnidx_byterms ( terms, ds, vcfsamples ) {
/*
a sample must meet all term conditions
*/
	const usesampleidx = []
	for( const [i, sample] of vcfsamples.entries() ) {
		const sanno = ds.cohort.annotation[ sample.name ]
		if(!sanno) continue

		// for AND, require all terms to match
		let alltermmatch = true
		for(const t of terms ) {
			const t0 = ds.cohort.termdb.termjson.map.get( t.term_id )
			if( !t0 ) {
				continue
			}
			let thistermmatch
			if( t0.iscategorical ) {

				thistermmatch = t.isnot ? sanno[ t.term_id ] != t.value : sanno[ t.term_id ] == t.value

			} else if( t0.isinteger || t0.isfloat ) {
				// TODO
			}
			if( !thistermmatch ) {
				// not matching, end
				alltermmatch=false
				break
			}
		}
		if(alltermmatch) {
			usesampleidx.push( i )
		}
	}
	return usesampleidx
}





function vcfbyrange_collect_result ( result, rglst, querymode ) {
/*
done querying, collect result, also clear rglst which is shared by others

for specific type of query mode, send additional info
*/

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

	if( querymode.range_termdb2groupAF ) {
		result.group1numbersamples = querymode.columnidx_group1.length
		result.group2numbersamples = querymode.columnidx_group2.length
	} else if( querymode.range_ebgatest ) {
		result.numbersamples = querymode.columnidx.length
		result.populationaverage = []
		if( querymode.columnidx.length ) {
			for(const [k,v] of querymode.pop2average ) {
				result.populationaverage.push({
					key: k,
					v: v.average
				})
			}
		}
	}
}



function query_vcf_applymode ( querymode, vcftk, q ) {
/* at variant only mode, apply changes and prepare for querying
*/
	if( querymode.range_variantonly
		|| querymode.range_termdb2groupAF
		|| querymode.range_ebgatest
		) {

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
}



function make_mockblock ( r ) {
	if( r.usegm_isoform ) return {gmmode:'protein',usegm:{isoform:r.usegm_isoform}}
	return {}
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





function parseline_termdb2groupAF ( line, columnidx_group1, columnidx_group2, vcftk, m_is_filtered ) {
	const l = line.split('\t')

	const alleles = [ l[3], ...l[4].split(',') ]

	const g1 = parseline_termdb2groupAF_onegroup( alleles, l, columnidx_group1 )
	const g2 = parseline_termdb2groupAF_onegroup( alleles, l, columnidx_group2 )
	if( g1.allref && g2.allref ) {
		return
	}

	const [e,mlst,e2] = vcf.vcfparseline( l.slice(0,8).join('\t'), vcftk )

	return mlst.reduce(
		(uselst,m) =>{

			if( m_is_filtered( m ) ) {
				// skip
			} else {

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
				uselst.push(m)
			}
			return uselst
		},
		[]
	)

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




function parseline_ebgatest ( line, columnidx, pop2average, vcftk, ds, m_is_filtered ) {

	const l = line.split('\t')

	const alleles = [ l[3], ...l[4].split(',') ]

	const g = parseline_termdb2groupAF_onegroup( alleles, l, columnidx )
	const [e,mlst,e2] = vcf.vcfparseline( l.slice(0,8).join('\t'), vcftk )

	return mlst.reduce(
		(uselst, m) => {
			if( m_is_filtered( m ) ) {
				// skip
			} else {

				const refcount = g.alleles.get( m.ref ) || 0
				const altcount = g.alleles.get( m.alt ) || 0
				// get control population allele count, for the current variant
				let controltotal = 0
				const pop2control = new Map()
				for(const [k,v] of pop2average) {
					const AC = parseline_ebgatest_getkey( m, v.infokey_AC )
					const AN = parseline_ebgatest_getkey( m, v.infokey_AN )
					pop2control.set( k, { AC, AN })
					controltotal += AN
				}
				// adjust control population based on pop2average
				let ACadj = 0,
					ANadj = 0
				for( const [k,v] of pop2control ) {
					const AN2 = controltotal * pop2average.get(k).average
					const AC2 = AN2 == 0 ? 0 : v.AC * AN2 / v.AN
					ACadj += AC2
					ANadj += AN2
				}
				m.ebga = {
					line: m.chr+'.'+m.pos+'.'+m.ref+'.'+m.alt+'\t'+altcount+'\t'+refcount+'\t'+ACadj+'\t'+(ANadj-ACadj),
					table: [altcount, refcount, ACadj, ANadj-ACadj]
				}
				uselst.push(m)
			}
			return uselst
		},
		[]
	)
}



function parseline_ebgatest_getkey ( m, key ) {
	// for either AC or AN, it could be in info or altinfo
	if( m.info ) {
		const v = m.info[ key ]
		if( v ) return Number.parseInt(v)
	}
	if( m.altinfo ) {
		const v = m.altinfo[ key ]
		if( v ) return Number.parseInt(v)
	}
	return 0
}



async function may_apply_chisqtest_ebgatest ( rglst, querymode ) {
	if(!querymode.range_ebgatest) return
	if(querymode.columnidx.length==0) return
	const lines = []
	const mlst = {}
	for(const r of rglst) {
		if(r.variants) {
			for(const m of r.variants) {
				if(m.ebga) {
					lines.push(m.ebga.line)
					mlst[ m.ebga.line.split('\t',1)[0] ] = m
					delete m.ebga.line
				}
			}
		}
	}
	const tmpfile = path.join(serverconfig.cachedir,Math.random().toString())
	await utils.write_file( tmpfile, lines.join('\n') )
	//const pfile = await run_chisqtest( tmpfile )
	const pfile = await run_fishertest( tmpfile )
	const text = await utils.read_file( pfile )
	for(const line of text.trim().split('\n')) {
		const l = line.split('\t')
		const m = mlst[ l[0] ]
		if( m ) {
			const v = Number.parseFloat(l[5])
			m.ebga.pvalue = v
			m.ebga.lpvalue = Number.isNaN(v) ? 0 : -Math.log10(v)
		}
	}
	fs.unlink(tmpfile,()=>{})
	fs.unlink(pfile,()=>{})
}



function run_chisqtest( tmpfile ) {
	const pfile = tmpfile+'.pvalue'
	return new Promise((resolve,reject)=>{
		const sp = spawn('Rscript',['utils/chisq.R',tmpfile,pfile])
		sp.on('close',()=> resolve(pfile))
		sp.on('error',()=> reject(error))
	})
}
function run_fishertest( tmpfile ) {
	const pfile = tmpfile+'.pvalue'
	return new Promise((resolve,reject)=>{
		const sp = spawn('Rscript',['utils/fisher.R',tmpfile,pfile])
		sp.on('close',()=> resolve(pfile))
		sp.on('error',()=> reject(error))
	})
}




function _m_is_filtered ( q, result, mockblock ) {

	return m => {
		let todrop = false

		if( q.info_fields ) {
			for(const i of q.info_fields) {
				const re = result.info_fields[ i.key ]

				// get info field value
				let value=undefined
				if( m.info ) value = m.info[i.key]
				if(value==undefined && m.altinfo) value = m.altinfo[i.key]

				if( i.iscategorical ) {
					if(value==undefined) {
						re.unannotated_count = 1 + (re.unannotated_count||0)
						if(i.unannotated_ishidden) {
							todrop=true
						}
						continue
					}
					re.value2count[ value ] = 1 + (re.value2count[value]||0)
					if( i.hiddenvalues[ value ] ) {
						todrop=true
					}

				} else if( i.isnumerical ) {

					// test start
					if( !i.range.startunbounded ) {
						if( i.range.startinclusive ) {
							if( value < i.range.start ) todrop=true
						} else {
							if( value <= i.range.start ) todrop=true
						}
					}
					// test stop
					if( !i.range.stopunbounded ) {
						if( i.range.stopinclusive ) {
							if( value > i.range.stop ) todrop=true
						} else {
							if( value >= i.range.stop ) todrop=true
						}
					}
					if( todrop ) re.filteredcount++
				}
			}
		}

		// final step is mclass
		if( todrop ) {
			// this variant has been filtered, do not add to mclass counter
			return true
		}

		common.vcfcopymclass( m, mockblock )

		// m.class is decided, add to counter
		result.mclass2count[m.class] = ( result.mclass2count[m.class] || 0 ) + 1

		// if to drop this variant
		if( q.hidden_mclass && q.hidden_mclass.has(m.class) ) {
			todrop=true
		}

		return todrop
	}
}
