const utils = require('./utils')
const vcf = require('../src/vcf')




/*
********************** EXPORTED
handle_mafcovplot
********************** INTERNAL
*/

exports.handle_mafcovplot = async ( q, genome, ds, result ) => {
	try {
		if(!ds.track) throw 'ds.track missing'
		const tk = ds.track.vcf
		if(!tk) throw 'ds.track.vcf missing'
		if(ds.iscustom ) {
			// custom track always enable plot?
			tk.plot_mafcov = {
				show_samplename:1
			}

			await utils.init_one_vcf( tk, genome )

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

		if( m ) {

			// hardcoded to use AD

			// conditional, may do server-side rendering instead

			result.plotgroups = mafcov_getdata4clientrendering ( m, tk )

		} else {
			result.error = 'No match to '+q.m.chr+':'+(q.m.pos+1)+' '+q.m.ref+'>'+q.m.alt
		}

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
