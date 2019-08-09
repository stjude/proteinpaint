const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const termdbsql = require('./termdb.sql')
const createCanvas = require('canvas').createCanvas
const termdb = require('./termdb')



/*
********************** EXPORTED
trigger
update_image
********************** INTERNAL
do_precompute
	get_samplefilter4termtype
	helper_rows2categories
	helper_conditiongroups2categories
get_numsample_pergenotype
get_maxlogp
plot_canvas
*/


const serverconfig = __non_webpack_require__('./serverconfig.json')

const minimum_total_sample = 10




export async function trigger ( q, res, ds ) {
/*
q{}
.ssid
*/
	if(!ds.cohort) throw 'ds.cohort missing'
	if(!ds.cohort.termdb) throw 'cohort.termdb missing'
	if(!ds.cohort.termdb.phewas) throw 'not allowed on this dataset'

	if( q.precompute ) {
		// detour
		if(!serverconfig.debugmode) throw 'precomputing is only allowed on a dev server'
		await do_precompute( q, res, ds )
		return
	}

	if(!q.ssid) throw 'ssid missing'
	const [sample2gt, genotype2sample] = await utils.loadfile_ssid( q.ssid )
	// sample2gt: {sample:gt}
	// genotype2sample: Map {gt: Set(samples)}


	// from vcf file, total number of samples per genotype
	const het0  = genotype2sample.get(utils.genotype_types.het).size || 0
	const href0 = genotype2sample.get(utils.genotype_types.href).size || 0
	const halt0 = genotype2sample.get(utils.genotype_types.halt).size || 0


	const tests = []
	/* collect tests across all terms, one for each category
	.term: {id,name}
	.category: name of the category
	.q: {}
		term type-specific parameter on how the categories are synthesized
		https://docs.google.com/document/d/18Qh52MOnwIRXrcqYR43hB9ezv203y_CtJIjRgDcI42I/edit#heading=h.ljho28ohkqr8
	.table: [ contigency table ]
	*/

	const result = {
		minimum_total_sample,
		skipped_byminimumsample: 0
	}
	// to be sent to client

	for(const cacherow of ds.cohort.termdb.q.getcategory2vcfsample()) {
		/************** each cached row is one term
		.group_name
		.term_id
		.parent_name
		.q{}
		.categories{}
		*/

		const term = termdb.copy_term( ds.cohort.termdb.q.termjsonByOneid( cacherow.term_id ) )

		for(const category of cacherow.categories) {

			/************ each category a case
			.group1label
			.group2label
			.group1lst
			.group2lst
			*/

			// number of samples by genotype in case
			const [ het, halt, href ] = get_numsample_pergenotype( sample2gt, category.group1lst )

			// number of samples by genotype in control
			let het2, halt2, href2

			if( category.group2lst ) {
				[ het2, halt2, href2 ] = get_numsample_pergenotype( sample2gt, category.group2lst )
			} else {
				het2 = het0-het
				halt2 = halt0-halt
				href2 = href0-href
			}

			tests.push({
				term,
				group_name: cacherow.group_name,
				parent_name: cacherow.parent_name,
				group1label: category.group1label,
				group2label: category.group2label,
				q: q.term1_q,
				table: [ 
					het + 2* halt, // case alt
					het + 2* href, // case ref
					het2 + 2* halt2, // ctrl alt
					het2 + 2* href2, // ctrl ref
				]
			})
		}
	}

	result.testcount = tests.length

	///////// fisher
	{
		const lines = []
		for(let i=0; i<tests.length; i++) {
			lines.push( i +'\t'+ tests[i].table.join('\t'))
		}
		const tmpfile = path.join(serverconfig.cachedir,Math.random().toString())
		await utils.write_file( tmpfile, lines.join('\n') )
		const pfile = await utils.run_fishertest( tmpfile )
		const text = await utils.read_file( pfile )
		const pvalues = []
		for(const line of text.trim().split('\n')) {
			const l = line.split('\t')
			const p = Number.parseFloat(l[5])
			pvalues.push(p)
		}
		fs.unlink(tmpfile,()=>{})
		fs.unlink(pfile,()=>{})

		// fdr
		const fdr = await utils.run_fdr( pvalues )
		for(const [i,p] of fdr.entries()) {
			tests[i].pvalue = p
		}
	}

	get_maxlogp( tests, result )

	const groups = group_categories( tests )
	result.tmpfile = await write_resultfile( groups )
	plot_canvas( tests, result )

	{
		// collect hover-dots above cutoff
		const cutoff = 0.05
		result.hoverdots = tests.filter( i=> i.pvalue <= cutoff )
	}

	res.send( result )
}




async function do_precompute ( q, res, ds ) {
/*
for precomputing
programmatically generate list of samples for each category of a term

use get_rows()
- categorical: no config
- numerical: use default binning scheme
- condition: hardcoded scheme
*/

	//////////// optional sample filter by term type
	const [ condition_samplelst ] = get_samplefilter4termtype(ds)

	// text rows to be loaded to db table
	const rows = []

	for(const {group_name, term} of ds.cohort.termdb.q.getAlltermsbyorder()) {
		if(!term.graph) continue

		let parentname = ''
		{
			const t = ds.cohort.termdb.q.getTermParent( term.id )
			if(t) parentname = t.name
		}

		//////////// prep query for this term
		const qlst = []
		if( term.iscategorical ) {
			qlst.push( { ds, term1_id: term.id } )
		} else if( term.isfloat || term.isinteger ) {
			qlst.push( { ds, term1_id: term.id } )
		} else if( term.iscondition ) {
			// for both leaf and non-leaf
			// should only use grades as bars to go along with termdb.comparison_groups
			qlst.push({
				ds,
				term1_id: term.id,
				term1_q: {bar_by_grade:true,value_by_max_grade:true}
			})
			/*
			if( !term.isleaf ) {
				// for non-leaf, test subcondition by computable grade
				qlst.push({
					ds,
					term1_id: term.id,
					term1_q: {bar_by_children:true,value_by_computable_grade:true}
				})
			}
			*/
		} else {
			throw 'unknown term type'
		}

		for(const q of qlst) {

			//////////// run query for this term
			const re = termdbsql.get_rows( q )

			const categories = []
			/* a category {}
			      .group1label
				  .group2label
				  .group1lst[]
				  .group2lst[]
			   list of control samples (group2lst)is optional
			   may only be used for condition terms since they may have type-specific filter
			*/

			if( term.iscategorical || term.isinteger || term.isfloat ) {

				categories.push(
					...helper_rows2categories( re.lst, term )
				)

			} else if( term.iscondition ) {
				if( ds.cohort.termdb.patient_condition && ds.cohort.termdb.patient_condition.comparison_groups ) {
					// predefined comparison groups
					categories.push(
						...helper_conditiongroups2categories( re.lst )
					)
				} else {
					// no predefined group, treat like regular category
					categories.push(
						...helper_rows2categories( re.lst, term )
					)
				}

				if( condition_samplelst ) {
					// there are filters for condition terms restricting samples of a control set, must create list of control samplesfor each category
					for(const c of categories) {
						if( c.group2lst) {
							// already has control, filter it
							c.group2lst = c.group2lst.filter( s=> condition_samplelst.indexOf(s)!=-1 )
						} else {
							// no control yet
							const set = new Set(c.group1lst)
							c.group2lst = condition_samplelst.filter( s=> !set.has(s) )
						}
					}
				}

			} else {
				throw 'unknown term type'
			}


			// log
			for(const c of categories) {
				console.log( c.group1lst.length + (c.group2lst? '/'+c.group2lst.length : '') + '\t'+c.group1label+'\t'+term.name )
			}

			/* columns
			1. group name
			2: term id
			3: parent name
			4: term setting
			5: list of categories
			*/
			rows.push(group_name+'\t'+term.id+'\t'+parentname+'\t'+JSON.stringify(q.term1_q)+'\t'+JSON.stringify(categories))
		}
	}

	const filename = await utils.write_tmpfile( rows.join('\n') )
	res.send({filename})


	///////////// helper

	function helper_rows2categories ( rows, term ) {
		// simply use .key1 as category, to summarize into list of samples by categories
		const key2cat = new Map()
		for(const row of rows) {
			if( ds.track && ds.track.vcf && ds.track.vcf.sample2arrayidx) {
				if(!ds.track.vcf.sample2arrayidx.has( row.sample )) {
					// not a sample in vcf
					continue
				}
			}
			const category = row.key1
			if(!key2cat.has(category)) {
				let label = category
				if(term.values) label = term.values[category] ? term.values[category].label : category
				key2cat.set(category, {
					group1label: label,
					group2label: 'All others',
					group1lst: [],
				} )
			}
			key2cat.get(category).group1lst.push(row.sample)
		}
		return [...key2cat.values()]
	}
	function helper_conditiongroups2categories ( rows ) {
	/* with predefined comparison groups in ds
	*/
		const categories = []
		for(const groupdef of ds.cohort.termdb.patient_condition.comparison_groups) {
			// divide samples from rows into two groups based on group definition

			// groupdef.group1 is required
			const group1lst = []
			const group2lst = []
			for(const row of rows) {
				const grade = Number( row.key1 ) // should be safe to assume key1 is grade
				if( groupdef.group1.has( grade ) ) {
					group1lst.push( row.sample )
					continue
				}
				if( groupdef.group2 && groupdef.group2.has(grade) ) {
					group2lst.push( row.sample )
				}
			}

			if( group1lst.length == 0) {
				// nothing in group1, skip
				console.log('Empty group1: '+groupdef.group1label)
				continue
			}

			categories.push( {
				group1label: groupdef.group1label,
				group2label: groupdef.group2label,
				group1lst,
				group2lst: (group2lst.length ? group2lst : undefined)
			} )
		}
		return categories
	}
}







export async function update_image ( q, res ) {
	const str = await utils.read_file( path.join(serverconfig.cachedir, q.file) )
	const lst = str.trim().split(' ')
		.map(i=>{ return {logp: Number(i)} })
	const result = {
		maxlogp: Number(q.max)
	}
	plot_canvas( lst, result )
	res.send( result )
}




function get_maxlogp ( tests, result ) {
// set actual max for returning to client
	let m = 0
	for(const t of tests) {
		t.logp = -Math.log10( t.pvalue )
		m = Math.max( m, t.logp)
	}
	result.maxlogp = m
}



function plot_canvas ( tests, result ) {
	const plotwidth = 800,
		axisheight = 400,
		dotradius = 2,
		leftpad = dotradius,
		rightpad = dotradius,
		toppad = 100,
		bottompad = 100,
		fillcolor = 'black'
	const canvaswidth = leftpad+plotwidth+rightpad,
		canvasheight = toppad+axisheight+bottompad
	const canvas = createCanvas( canvaswidth, canvasheight )
	const ctx = canvas.getContext('2d')

	const shiftx = plotwidth / tests.length
	let x = 0

	ctx.fillStyle = fillcolor

	for(const test of tests) {
		const h = result.maxlogp == 0 ? 0
			: test.logp>=result.maxlogp ? axisheight
			: axisheight*test.logp/result.maxlogp
		ctx.beginPath()
		ctx.arc(x, toppad + axisheight-h, dotradius, 0, 2*Math.PI)
		ctx.fill()
		test.x = x
		x += shiftx
	}

	result.canvaswidth = canvaswidth
	result.canvasheight = canvasheight
	result.toppad = toppad
	result.bottompad = bottompad
	result.axisheight = axisheight
	result.dotradius = dotradius
	result.src = canvas.toDataURL()
}



function get_samplefilter4termtype ( ds ) {
/* when a sample filter is provided for a type of term
must restrict to these samples for the term
only used for precomputing, not for on the fly
*/
	let condition_samples = null

	if( ds.cohort.termdb.phewas.samplefilter4termtype ) {
		if( ds.cohort.termdb.phewas.samplefilter4termtype.condition ) {
			const samples = termdbsql.get_samples( ds.cohort.termdb.phewas.samplefilter4termtype.condition.tvslst, ds )
			if( ds.track && ds.track.vcf && ds.track.vcf.sample2arrayidx) {
				// must also restrict to vcf samples
				condition_samples = []
				for(const s of samples) {
					if(ds.track.vcf.sample2arrayidx.has( s )) condition_samples.push(s)
				}
			} else {
				condition_samples = samples
			}
		}
		// filters for other term types
	}
	return [ condition_samples ]
}




function get_numsample_pergenotype ( sample2gt, samples ) {
/*
*/
	const gt2count = new Map()
	// k: gt, v: #samples
	for(const sample of samples) {
		const genotype = sample2gt[ sample ]
		if(!genotype) {
			// no genotype, may happen when there's no sequencing coverage at this variant for this sample
			continue
		}
		gt2count.set( genotype, 1+(gt2count.get(genotype) || 0) )
	}
	return [
		gt2count.get(utils.genotype_types.het) || 0,
		gt2count.get(utils.genotype_types.halt) || 0,
		gt2count.get(utils.genotype_types.href) || 0
	]
}



function group_categories ( tests ) {
	const k2lst = new Map()
	for(const i of tests) {
		if(!k2lst.has(i.group_name)) k2lst.set(i.group_name, [])
		k2lst.get(i.group_name).push( i )
	}
	const lst = []
	for(const [k,o] of k2lst) {
		lst.push({
			group_name: k,
			categories: o
		})
	}
	return lst
}

function write_resultfile ( groups ) {
	const lines = []
	for(const g of groups) {
		lines.push( g.group_name +'\t'+ g.categories.map(i=>i.pvalue).join(' ') )
	}
	return utils.write_tmpfile( lines.join('\n'))
}
