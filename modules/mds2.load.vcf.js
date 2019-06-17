const fs = require('fs')
const path = require('path')
const spawn = require('child_process').spawn
const utils = require('./utils')
const vcf = require('../src/vcf')
const common = require('../src/common')
const validate_termvaluesetting = require('../src/mds.termdb.termvaluesetting').validate_termvaluesetting



/*
********************** EXPORTED
handle_vcfbyrange
handle_ssidbyonem
handle_getcsq
sample_match_termvaluesetting
********************** INTERNAL
get_columnidx_byterms
wrap_validate_termvaluesetting
set_querymode
query_vcf_applymode
getallelecount_samplegroup_vcfline
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

	set_querymode( q, vcftk, ds )

	query_vcf_applymode( vcftk, q )

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

			if( q.querymode.range_variantonly ) {

				if( q.querymode.slicecolumnindex ) {
					// TODO do slicing, parse reduced line with samples, and decide if the variant exist in the sliced samples
				} else {
					// no sample filtering, do not look at sample, just the variant
					const newline = line.split( '\t', 8 ).join('\t')
					const [e,mlst2,e2] = vcf.vcfparseline( newline, vcftk )
					mlst = []
					for(const m of mlst2) {
						if(!m_is_filtered(m)) mlst.push(m)
					}
				}
			} else if( q.querymode.range_AFtest ) {
				mlst = parseline_AFtest( line, q, vcftk, ds, m_is_filtered )
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

	await may_apply_fishertest( q )

	vcfbyrange_collect_result( result, q )
}



function set_querymode ( q, vcftk, ds ) {
/*
generate the "querymode" object that drives subsequent queries
*/

	q.querymode = {}

	if( q.AFtest ) {
		if(ds.iscustom) throw 'custom track does not support AFtest'
		for(const g of q.AFtest.groups) {
			if( g.is_infofield ) {
				continue
			}
			if(g.is_termdb) {
				wrap_validate_termvaluesetting(g.terms,'AFtest.group')
				g.columnidx = get_columnidx_byterms( g.terms, ds, vcftk.samples )
				continue
			}
			if(g.is_population) {
				if(!ds.track.populations) throw 'ds.track.populations missing'
				g.population = ds.track.populations.find(i=>i.key==g.key)
				if(!g.population) throw 'unknown population key: '+g.key
				continue
			}
			throw 'Cannot set query mode: unknown group type'
		}

		if( q.AFtest.testby_fisher ) {
			if( q.AFtest.groups.find( i=> i.is_infofield ) ) throw 'cannot do fisher test for an INFO field'
		}

		// after validating each single group, validate adjust race
		{
			const popg = q.AFtest.groups.find( i=> i.is_population )
			if( popg && popg.adjust_race ) {
				// need termdb group
				const tg = q.AFtest.groups.find( i=> i.is_termdb )
				if(!tg) throw 'cannot adjust race: termdb group missing'
				// compute pop average
				tg.pop2average = get_pop2average( 
					popg.population.sets,
					tg.columnidx,
					ds,
					vcftk
				)
			}
		}

		q.querymode.range_AFtest = true
		return
	}

	q.querymode.range_variantonly = true
	/*
	slicecolumnindex
	in case of sample filtering
	from tk0.samples[], decide samples to keep
	update that to vcftk.samples
	and get the column indices for these samples for slicing
	*/
}




function get_pop2average ( popsets, columnidx, ds, vcftk ) {
	// to get population admix average for this subset of samples, initiate 0 for each population
	const pop2average = new Map()
	for(const p of popsets) {
		pop2average.set(
			p.key,
			{
				infokey_AC: p.infokey_AC,
				infokey_AN: p.infokey_AN,
				average: 0
			}
		)
	}
	let poptotal = 0 // sum for all sets
	// sum up admix for everybody from this set
	for(const idx of columnidx) {
		const samplename = vcftk.samples[idx].name
		const anno = ds.cohort.annotation[ samplename ]
		if( !anno ) continue
		for(const p of popsets) {
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
	return pop2average
}




function get_columnidx_byterms ( terms, ds, vcfsamples ) {
/*
terms is a list, each ele is one term-value setting
a sample must meet all term conditions
*/
	const usesampleidx = []
	for( const [i, sample] of vcfsamples.entries() ) {
		const sanno = ds.cohort.annotation[ sample.name ]
		if(!sanno) continue
		if( sample_match_termvaluesetting( sanno, terms, ds ) ) {
			usesampleidx.push( i )
		}
	}
	return usesampleidx
}





function vcfbyrange_collect_result ( result, q ) {
/*
done querying, collect result, also clear rglst which is shared by others

for specific type of query mode, send additional info
*/

	result.vcf = {
		rglst: []
	}
	for(const r of q.rglst) {
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

	if( q.AFtest ) {
		// did adjustment, return back average admix
		const g = q.AFtest.groups.find(i=>i.is_termdb)
		if( g ) {
			result.AFtest_termdbgroup = {
				samplecount: g.columnidx.length
			}
			if( g.pop2average ) {
				result.AFtest_termdbgroup.popsetaverage = []
				for(const [k,v] of g.pop2average) {
					result.AFtest_termdbgroup.popsetaverage.push([k,v.average])
				}
			}
		}
	}
}



function query_vcf_applymode ( vcftk, q ) {
/* at variant only mode, apply changes and prepare for querying
*/
	if( q.querymode.range_variantonly || q.querymode.range_AFtest ) {

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






function parseline_AFtest ( line, q, vcftk, ds, m_is_filtered ) {
/*
there may be 2 or more groups
a group can be determined by termdb, or info field
*/
	const l = line.split('\t')
	const [e,mlst,e2] = vcf.vcfparseline( l.slice(0,8).join('\t'), vcftk )
	// get those passing filter
	const mlstpass = mlst.filter( m => !m_is_filtered( m ) )
	if( mlstpass.length == 0 ) {
		// stop, no need to parse samples
		return
	}
	const alleles = [ l[3], ...l[4].split(',') ]

	for( const m of mlstpass ) {

		const mgroups = AFtest_getdata_onem( l, m, alleles, q )

		// hardcoded to deal with 2 groups
		if( q.AFtest.testby_AFdiff ) {
			for(const g of mgroups) {
				if(g.is_infofield) {
					g.v = g.infofieldvalue
				} else if(g.is_termdb || g.is_population) {
					g.v = g.altcount / (g.refcount+g.altcount)
				} else {
					throw 'unknown group type'
				}
			}
			m.AFtest_group_values = [ mgroups[0].v, mgroups[1].v ]
			m.nm_axis_value = mgroups[0].v - mgroups[1].v // for axis
		} else if( q.AFtest.testby_fisher ) {
			m.contigencytable = [
				mgroups[0].altcount,
				mgroups[0].refcount,
				mgroups[1].altcount,
				mgroups[1].refcount
			]
			// collect table from all variants and run one test
		}

		// if adjusted race, for the population group, append the set2value to m
		{
			const g = q.AFtest.groups.find(i=>i.is_population)
			if(g && g.adjust_race ) {
				const g = mgroups.find( i=>i.is_population )
				// g must have set2value
				m.popsetadjvalue = []
				for(const [s,v] of g.set2value) {
					m.popsetadjvalue.push([ s, v.ACraw, v.ANraw-v.ACraw, Number.parseInt(v.ACadj), Number.parseInt(v.ANadj-v.ACadj) ])
				}
			}
		}
	}
	return mlstpass
}




function AFtest_getdata_onem ( l, m, alleles, q ) {
/*
AFtest
for one variant, get data for each group
return an array of same length and group typing of AFtest.groups[]
*/
	return q.AFtest.groups.reduce( (lst, g)=>{
		if( g.is_infofield ) {
			lst.push({
				is_infofield:true,
				infofieldvalue: get_infovalue( m, g )
			})
		} else if( g.is_termdb ) {
			const _ = getallelecount_samplegroup_vcfline( alleles, l, g.columnidx )
			lst.push({
				is_termdb:true,
				allref: _.allref,
				refcount: _.alleles.get( m.ref ) || 0,
				altcount: _.alleles.get( m.alt ) || 0,
			})
		} else if( g.is_population ) {
			const set2value = new Map()
			/*  k: population set key
				v: { ACraw, ANraw, ACadj, ANadj }
			*/
			for(const aset of g.population.sets) {
				set2value.set( aset.key,
					{
						ACraw: get_infovalue( m, {key:aset.infokey_AC,missing_value:0} ),
						ANraw: get_infovalue( m, {key:aset.infokey_AN,missing_value:0} )
					}
				)
			}
			// for a population group, if to adjust race
			let refcount=0, altcount=0
			if( g.adjust_race ) {
				[refcount,altcount] = AFtest_adjust_race(
					set2value,
					q.AFtest.groups.find( i=> i.is_termdb )
				)
			} else {
				// not adjust race, add up AC AN
				for(const v of set2value.values()) {
					altcount += v.ACraw
					refcount += v.ANraw - v.ACraw
				}
			}
			lst.push({
				is_population:true,
				refcount,
				altcount,
				set2value
			})
		} else {
			throw 'unknown group type'
		}
		return lst
	}, [] )
}



function AFtest_adjust_race ( set2value, group_termdb ) {
	if(!group_termdb) throw 'group_termdb missing'
	if(!group_termdb.pop2average) throw 'group_termdb.pop2average missing'
	let controltotal = 0
	for(const v of set2value.values()) {
		controltotal += v.ANraw
	}
	// adjust control population based on pop2average
	let ACadj = 0,
		ANadj = 0
	for( const [k,v] of set2value ) {

		// record adjusted value per set for sending back to client
		v.ANadj = controltotal * group_termdb.pop2average.get(k).average
		v.ACadj = v.ANadj == 0 ? 0 : v.ACraw * v.ANadj / v.ANraw

		ACadj += v.ACadj
		ANadj += v.ANadj
	}
	return [ ANadj-ACadj, ACadj ]
}






function get_infovalue ( m, f ) {
// field is {key,missing_value}
	if( m.info ) {
		const v = m.info[ f.key ]
		if( v!=undefined ) return v
	}
	if( m.altinfo ) {
		const v = m.altinfo[ f.key ]
		if( v!=undefined ) return v
	}
	return f.missing_value
}



async function may_apply_fishertest ( q ) {
	if(!q.querymode.range_AFtest) return
	if(!q.AFtest.testby_fisher) return
	const lines = []
	const mlst = {}
	for(const r of q.rglst) {
		if(r.variants) {
			for(const m of r.variants) {
				if(m.contigencytable) {
					const kstr = m.chr+'.'+m.pos+'.'+m.ref+'.'+m.alt
					lines.push( kstr +'\t'+m.contigencytable.join('\t'))
					mlst[ kstr ] = m
				}
			}
		}
	}
	if(lines.length==0) {
		// no data
		return
	}
	const tmpfile = path.join(serverconfig.cachedir,Math.random().toString())
	await utils.write_file( tmpfile, lines.join('\n') )
	const pfile = await run_fishertest( tmpfile )
	const text = await utils.read_file( pfile )
	for(const line of text.trim().split('\n')) {
		const l = line.split('\t')
		const m = mlst[ l[0] ]
		if( m ) {
			const v = Number.parseFloat(l[5])
			m.AFtest_pvalue = v
			m.nm_axis_value = Number.isNaN(v) ? 0 : -Math.log10(v) // for axis
		}
	}
	fs.unlink(tmpfile,()=>{})
	fs.unlink(pfile,()=>{})
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
		// ***warning*** down here, can only set todrop to true, must not set it to false...

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
					} else {
						re.value2count[ value ] = 1 + (re.value2count[value]||0)
						if( i.hiddenvalues[ value ] ) {
							todrop=true
						}
					}

				} else if( i.isnumerical ) {

					if( value == undefined ) {
						if( i.missing_value!=undefined ) value = i.missing_value
					}

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

				} else if( i.isflag ) {
					if( value ) {
						re.count_yes++
					} else {
						re.count_no++
					}
					if( (i.remove_yes && value) || (i.remove_no && !value) ) {
						todrop=true
					}
				} else {
					throw 'unknown info type'
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




function wrap_validate_termvaluesetting ( terms, where ) {
	validate_termvaluesetting(terms,where)
	for(const t of terms) {
		if(t.term.iscategorical) {
			// convert values[{key,label}] to set
			t.valueset = new Set( t.values.map(i=>i.key) )
		}
	}
}




function sample_match_termvaluesetting ( sanno, terms, ds ) {
/* for AND, require all terms to match
ds is for accessing patient_condition
*/

	let usingAND = true

	let numberofmatchedterms = 0

	for(const t of terms ) {

		const samplevalue = sanno[ t.term.id ]
		if(samplevalue==undefined) {
			// this sample has no anno for this term, do not count
			continue
		}

		let thistermmatch

		if( t.term.iscategorical ) {

			thistermmatch = t.valueset.has( samplevalue )

		} else if( t.term.isinteger || t.term.isfloat ) {

			let left, right
			if( t.range.startunbounded ) {
				left = true
			} else {
				if(t.range.startinclusive) {
					left = samplevalue >= t.range.start
				} else {
					left = samplevalue > t.range.start
				}
			}
			if( t.range.stopunbounded ) {
				right = true
			} else {
				if(t.range.stopinclusive) {
					right = samplevalue <= t.range.stop
				} else {
					right = samplevalue < t.range.stop
				}
			}
			thistermmatch = left && right
		} else if( t.term.iscondition ) {
			thistermmatch = test_sample_conditionterm( sanno, t, ds )
		} else {
			throw 'unknown term type'
		}

		if( t.isnot ) {
			thistermmatch = !thistermmatch
		}
		if( thistermmatch ) numberofmatchedterms++
	}

	if( usingAND ) {
		return numberofmatchedterms == terms.length
	}
	// using OR
	return numberofmatchedterms > 0
}
exports.sample_match_termvaluesetting = sample_match_termvaluesetting




function test_sample_conditionterm ( sample, tvs, ds ) {
/*
sample: ds.cohort.annotation[k]
tvs: a term-value setting object
	.term
	.range
ds
*/
	const _config = ds.cohort.termdb.patient_condition
	if(!_config) throw 'patient_condition missing'
	const term = ds.cohort.termdb.termjson.map.get( tvs.term.id )
	if(!term) throw 'unknown term id: '+tvs.term.id

	let eventlst = [] // list of events to be examined

	if( term.isleaf ) {
		// leaf, term id directly used for annotation
		const termvalue = sample[ tvs.term.id ]
		if(!termvalue) return false
		eventlst = termvalue[ _config.events_key ]
	} else {
		// not leaf , must go over all annotated attributes of this sample
		const find_id = range.child_id || tvs.term.id // if range.child_id is set, will limit to this instead
		for(const tid in sample) {
			const t = ds.cohort.termdb.termjson.map.get(tid)
			if(!t || !t.iscondition) continue
			if(t.conditionlineage.indexOf( find_id )!=-1) {
				// is from a child term
				eventlst.push( ...t[_config.events_key] )
			}
		}
	}
	if(eventlst.length==0) return false

	if( tvs.range.value_by_most_recent ) {
		const i = eventlst.reduce(
			(i, e)=>{
				const grade = e[_config.grade_key]
				if(_config.uncomputable_grades && _config.uncomputable_grades[grade]) return i
				const age = e[_config.age_key]
				if(i.age < age) return {grade,age}
				return i
			},
			{age:0}
		)
		return i.grade == tvs.range.grade
	}
	if( tvs.range.value_by_max_grade ) {
		const maxg = eventlst.reduce(
			(g,e)=>{
				const grade = e[_config.grade_key]
				if(_config.uncomputable_grades && _config.uncomputable_grades[grade]) return g
				return g<grade ? grade : g
			},
			0
		)
		return maxg == tvs.range.grade
	}
	throw 'unknown method for value_by'
}




function getallelecount_samplegroup_vcfline ( alleles, l, columnidx ) {
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
