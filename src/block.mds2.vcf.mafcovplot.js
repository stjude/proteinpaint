import * as client from './client'


/*
********************** EXPORTED
show_mafcovplot
********************** INTERNAL
*/





export async function show_mafcovplot ( holder, m, tk, block ) {
/*
call this function to generate/update plot
will include tk.vcf.plot_mafcov.overlay_term
*/
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
	if( tk.vcf.plot_mafcov.overlay_term ) {
		par.overlay_term = tk.vcf.plot_mafcov.overlay_term.id
	}

	const wait = holder.append('div')

	try {
		const data = await client.dofetch('mds2',par)
		if(data.error) throw data.error

		// TODO if is server rendered image

		if( data.plotgroups ) {
			clientside_plot( data.plotgroups, holder, tk )
		}

		if( data.categories ) {
			for(const c of data.categories ) {
				const row = holder.append('div')
					.style('margin','4px')
				row.append('span')
					.style('background',c.color)
					.html('&nbsp;&nbsp;')
				row.append('span')
					.style('color',c.color)
					.html('&nbsp;'+c.label)
			}
		}

		wait.remove()
	}catch(e){
		wait.text('ERROR: '+(e.message||e))
		if(e.stack) console.log(e.stack)
	}
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
