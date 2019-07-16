const utils = require('./utils')
const vcf = require('../src/vcf')
const d3scale = require('d3-scale')
const termdbsql = require('./termdb.sql')




/*
********************** EXPORTED
handle_mafcovplot
********************** INTERNAL
*/

export async function handle_mafcovplot ( q, genome, ds, result ) {
	try {
		if(!ds.track) throw 'ds.track missing'
		const tk = ds.track.vcf
		if(!tk) throw 'ds.track.vcf missing'
		if(ds.iscustom ) {
			// custom track always enable plot?
			tk.plot_mafcov = {
				show_samplename:1
			}

		} else {
			if(!tk.plot_mafcov) throw 'maf-cov plot is not supported on this track'
			// TODO jwt access control
		}
		if( !q.m ) throw '.m{} missing'

		const coord = (tk.nochr ? q.m.chr.replace('chr','') : q.m.chr) + ':' +(q.m.pos+1)+'-'+(q.m.pos+1)
		let m

		await utils.get_lines_tabix( [ tk.file, coord ], tk.dir, (line)=>{

			const [e,mlst,e2] = vcf.vcfparseline( line, tk )
			for(const m2 of mlst) {

				//if( tk.nochr ) m.chr = 'chr'+m.chr
				if( m2.pos==q.m.pos && m2.ref==q.m.ref && m2.alt==q.m.alt ) {
					m = m2
					return
				}
			}
		})

		if( !m ) throw 'variant not found'

		// hardcoded to use AD

		// client side rendering
		result.plotgroups = mafcov_getdata4clientrendering ( m, tk )

		if( q.overlay_term ) {

			const tmp = termdbsql.get_rows( {
				ds,
				term1_id: q.overlay_term,
				term1_q: q.overlay_term_q
			})

			const category2color = d3scale.scaleOrdinal( d3scale.schemeCategory10)
			const categories = new Set()
			const sample2color = new Map()
			for(const i of tmp) {
				const category = i.key1
				categories.add( category )
				sample2color.set( i.sample, category2color(category) )
			}
			for(const plot of result.plotgroups ) {
				for(const o of plot.lst ) {
					o.sampleobj.color = sample2color.get( o.sampleobj.name ) || 'black'
				}
			}
			result.categories = []
			for(const c of categories) {
				result.categories.push({ color:category2color(c), label:c })
			}
		}


		// conditional, may do server-side rendering instead

	}catch(e) {
		result.error = e.message || e
	}
}




function mafcov_getdata4clientrendering ( m, tk ) {
	const plotgroups = []
	// make a separate plot for each group
	// e.g. germline and tumor of the same patient goes to either group
	// TODO implement that logic later


	// for the moment, all go to one group

	const group = {
		name:'?',
		lst:[]
	}
	for(const sample of m.sampledata) {
		const refcount = sample.AD[ m.ref ] || 0
		const altcount = sample.AD[ m.alt ] || 0
		const total = refcount+altcount
		const o = {
			mut: altcount,
			total: refcount+altcount,
			maf: (total==0 ? 0 : altcount/total)
		}
		if( tk.plot_mafcov.show_samplename ) {
			o.sampleobj = { name: sample.sampleobj.name }
		}

		group.lst.push(o)
	}

	plotgroups.push( group )
	return plotgroups
}
