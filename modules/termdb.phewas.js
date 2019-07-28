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

//const minimum_total_sample = 10




export async function trigger ( q, res, tdb, ds ) {
/*
q{}
.ssid
*/
	if(!q.ssid) throw 'ssid missing'
	const [sample2gt, genotype2sample] = await utils.loadfile_ssid( q.ssid )

	// total number of samples with each genotype
	const het0 = genotype2sample.has( utils.genotype_types.het ) ? genotype2sample.get(utils.genotype_types.het).size : 0
	const href0 = genotype2sample.has( utils.genotype_types.href ) ? genotype2sample.get(utils.genotype_types.href).size : 0
	const halt0 = genotype2sample.has( utils.genotype_types.halt ) ? genotype2sample.get(utils.genotype_types.halt).size : 0


	// collect tests across all terms, one for each category
	const tests = []


let i=0
	for(const t of ds.cohort.termdb.q.getallterms()) {
		const term = JSON.parse(t.jsondata)
		if(!term.graph) continue
		//if(++i==10) break

		//////////// prep query for this term
		const qlst = []
		if( term.iscategorical ) {
			qlst.push( { term1_id: t.id, ds } )
		} else if( term.isfloat || term.isinteger ) {
			qlst.push( { term1_id: t.id, ds } )
		} else if( term.iscondition ) {
			// may test other configs
			qlst.push({
				term1_id: t.id,
				ds,
				term1_q: {bar_by_grade:true,value_by_max_grade:true}
			})
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
				if(!genotype) continue
				const category = i.key1
				if(!category2gt2samples.has(category)) category2gt2samples.set(category, new Map())
				if(!category2gt2samples.get(category).has( genotype )) category2gt2samples.get(category).set( genotype, new Set())
				category2gt2samples.get(category).get(genotype).add( i.sample )
			}

			for(const [category,o] of category2gt2samples) {
				/////////////// each category as a case
				const gt2size = new Map()
				let thiscatnumber = 0
				for(const [gt,s] of o) {
					gt2size.set(gt, s.size)
					thiscatnumber += s.size
				}
				/*
				if(thiscatnumber < minimum_total_sample) {
					console.log('skip', category, thiscatnumber)
					continue
				}
				*/
				const het  = gt2size.get(utils.genotype_types.het) || 0
				const halt = gt2size.get(utils.genotype_types.halt) || 0
				const href = gt2size.get(utils.genotype_types.href) || 0
				const het2 = het0-het
				const halt2 = halt0-halt
				const href2 = href0-href

				tests.push({
					term: termdb.copy_term( term ),
					category,
					q: q.q,
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



	const result = { testcount: tests.length }
	get_maxlogp( tests, result )
	result.tmpfile = await write_tmpfile( tests )
	plot_canvas( tests, result )

	{
		// collect hover-dots above cutoff
		const cutoff = 0.05
		result.hoverdots = tests.filter( i=> i.pvalue <= cutoff )
	}

	res.send( result )
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
