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
*/


const serverconfig = __non_webpack_require__('./serverconfig.json')

const minimum_total_sample = 10




export async function trigger ( q, res, tdb, ds ) {
/*
q{}
.ssid
*/
	if(!ds.cohort) throw 'ds.cohort missing'
	if(!ds.cohort.termdb) throw 'cohort.termdb missing'
	if(!ds.cohort.termdb.phewas) throw 'not allowed on this dataset'

	if(!q.ssid) throw 'ssid missing'
	const [sample2gt, genotype2sample] = await utils.loadfile_ssid( q.ssid )
	// sample2gt: {sample:gt}
	// genotype2sample: Map {gt: Set(samples)}


	//////////// work on sample filter by term type
	const [ totalcountbygenotype_condition ] = helper_get_samplefilter4termtype()


	// total number of samples with each genotype
	const het0 = genotype2sample.has( utils.genotype_types.het ) ? genotype2sample.get(utils.genotype_types.het).size : 0
	const href0 = genotype2sample.has( utils.genotype_types.href ) ? genotype2sample.get(utils.genotype_types.href).size : 0
	const halt0 = genotype2sample.has( utils.genotype_types.halt ) ? genotype2sample.get(utils.genotype_types.halt).size : 0


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


let i=0
	for(const term of ds.cohort.termdb.q.getAlltermsbyorder()) {
		if(!term.graph) continue
		//if(++i==60) break

		//////////// prep query for this term
		const qlst = []
		if( term.iscategorical ) {
			qlst.push( { ds, term1_id: term.id } )
		} else if( term.isfloat || term.isinteger ) {
			qlst.push( { ds, term1_id: term.id } )
		} else if( term.iscondition ) {
			// for both leaf and non-leaf
			qlst.push({
				ds,
				term1_id: term.id,
				term1_q: {bar_by_grade:true,value_by_max_grade:true}
			})
			if( !term.isleaf ) {
				// for non-leaf, test subcondition by computable grade
				qlst.push({
					ds,
					term1_id: term.id,
					term1_q: {bar_by_children:true,value_by_computable_grade:true}
				})
			}
		} else {
			throw 'unknown term type'
		}

		for(const q of qlst) {
			////////////// run query
			const re = termdbsql.get_rows( q )

			const category2gt2samples = new Map()
			// k: category (key1)
			// v: map{}
			//    k: gt
			//    v: sample set
			for(const i of re.lst) {
				const genotype = sample2gt[ i.sample ]
				if(!genotype) {
					// no genotype for this sample, drop
					continue
				}
				const category = i.key1
				if(!category2gt2samples.has(category)) category2gt2samples.set(category, new Map())
				if(!category2gt2samples.get(category).has( genotype )) category2gt2samples.get(category).set( genotype, new Set())
				category2gt2samples.get(category).get(genotype).add( i.sample )
			}


			for(const [category,o] of category2gt2samples) {

				/////////////// each category as a case

				const gt2size = new Map()
				// k: gt, v: number of samples
				let thiscatnumber = 0
				for(const [gt,s] of o) {
					gt2size.set(gt, s.size)
					thiscatnumber += s.size
				}
				/*
				if(thiscatnumber < minimum_total_sample) {
					result.skipped_byminimumsample++
					continue
				}
				*/

				// number of samples by genotype in case
				const het  = gt2size.get(utils.genotype_types.het) || 0
				const halt = gt2size.get(utils.genotype_types.halt) || 0
				const href = gt2size.get(utils.genotype_types.href) || 0
				// number of samples by genotype in control
				let het2, halt2, href2
				if( term.iscondition && totalcountbygenotype_condition ) {
					het2 = totalcountbygenotype_condition.het - het
					halt2 = totalcountbygenotype_condition.halt - halt
					href2 = totalcountbygenotype_condition.href - href
				} else {
					het2 = het0-het
					halt2 = halt0-halt
					href2 = href0-href
				}

				tests.push({
					term: termdb.copy_term( term ),
					category,
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
	result.tmpfile = await write_tmpfile( tests )
	plot_canvas( tests, result )

	{
		// collect hover-dots above cutoff
		const cutoff = 0.05
		result.hoverdots = tests.filter( i=> i.pvalue <= cutoff )
	}

	res.send( result )



	/////////////// helper

	function helper_get_samplefilter4termtype () {
	/* when a sample filter is provided for a type of term
	to recalculate total number of href/halt/het
	as the basis for generating control set

	otherwise use href0 from the complete set of samples in the vcf file
	*/
		let _condition = null
		// will set to {href,halt,het} if sample filter is on for condition term

		if( ds.cohort.termdb.phewas.samplefilter4termtype ) {
			if( ds.cohort.termdb.phewas.samplefilter4termtype.condition ) {
				const samples = new Set( termdbsql.get_samples( ds.cohort.termdb.phewas.samplefilter4termtype.condition.tvslst, ds ) )
				_condition = {
					het: 0,
					href: 0,
					halt: 0
				}
				if(genotype2sample.has( utils.genotype_types.het )) {
					for(const sample of genotype2sample.get(utils.genotype_types.het)) {
						if(samples.has(sample)) _condition.het++
					}
				}
				if(genotype2sample.has( utils.genotype_types.href )) {
					for(const sample of genotype2sample.get(utils.genotype_types.href)) {
						if(samples.has(sample)) _condition.href++
					}
				}
				if(genotype2sample.has( utils.genotype_types.halt )) {
					for(const sample of genotype2sample.get(utils.genotype_types.halt)) {
						if(samples.has(sample)) _condition.halt++
					}
				}
			}
		}
		return [ _condition ]
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


async function write_tmpfile ( tests ) {
	const tmp = Math.random().toString()
	await utils.write_file( path.join(serverconfig.cachedir, tmp), tests.map(i=>i.logp).join(' '))
	return tmp
}
