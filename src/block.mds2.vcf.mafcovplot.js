import * as client from './client'


/*
********************** EXPORTED
may_show_mafcovplot
********************** INTERNAL
*/





export function may_show_mafcovplot ( holder, m, tk, block ) {
	const wait = holder.append('div')
		.text('Loading...')
	const par = {
		genome: block.genome.name,
		trigger_mafcovplot:1,
		m: {
			chr: m.chr,
			pos: m.pos,
			ref: m.ref,
			alt: m.alt
		}
	}
	if(tk.mds) {
		par.dslabel = tk.mds.label
	} else {
		par.vcf = {
			file: tk.vcf.file,
			url: tk.vcf.url,
			indexURL: tk.vcf.indexURL
		}
	}
	client.dofetch('mds2',par)
	.then(data=>{
		if(data.error) throw data.error
		wait.remove()



		// TODO if is server rendered image


		if( data.plotgroups ) {
			clientside_plot( data.plotgroups, holder, tk )
		}
	})
	.catch(e=>{
		wait.text('ERROR: '+(e.message||e))
		if(e.stack) console.log(e.stack)
	})
}







function clientside_plot ( plotgroups, holder, tk ) {
	/*
	import plotter, then plot all groups
	each plot will return data point -> svg cross,
	so to enable mouse over a sample in one plot, and highlight samples from other plots of the same patient
	*/
	import('./plot.vaf2cov').then(plotter => {

		const name2sgp = {}

		for(const g of plotgroups) {

			// may define how to plot each group

			let div  = holder.append('div')
				.style('display','inline-block')
				.style('vertical-align','top')

			if( plotgroups.length>1) {
				// more than 1 group, emphasis
				div
					.style('margin-right','30px')
					.append('div')
					.style('margin-top','10px')
					.style('padding','3px 10px')
					.style('background-color','#aaa')
					.style('color','white')
					.style('display','inline-block')
					.style('font-size','.8em')
					.style('font-weight','bold')
					.text(g.name.toUpperCase())
				div = div.append('div')
					.style('border','solid 1px #aaa')
			}


			const arg= {
				holder:div,
				data: g.lst,
				name: g.name,
				tip: tk.tktip,
				automax:true,
				samplecolor:'#4888BF',
				mouseover: d=>{
					if(!d.sampleobj) return
					for(const groupname in name2sgp) {
						if(groupname==g.name) continue
						name2sgp[groupname].filter( d2=> {

							return d2.sampleobj.patient==d.sampleobj.patient
						})
						.each( d2=>{
							d2.crosshair1.attr('transform','scale(2.5)')
							d2.crosshair2.attr('transform','scale(2.5)')
						})
					}
				},
				mouseout: d=>{
					if(!d.sampleobj) return
					for(const groupname in name2sgp) {
						if(groupname==g.name) continue
						name2sgp[groupname].filter( d2=> {

							return d2.sampleobj.patient==d.sampleobj.patient
						})
						.each( d2=>{
							d2.crosshair1.attr('transform','scale(1)')
							d2.crosshair2.attr('transform','scale(1)')
						})
					}
				}
			}

			name2sgp[ g.name ] = plotter.default(arg)
		}

	})
}
