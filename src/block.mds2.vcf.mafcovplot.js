import * as client from './client'
import {init as termdbinit} from './mds.termdb'


/*
********************** EXPORTED
make_ui
********************** INTERNAL
do_plot
show_legend
clientside_plot
*/





export async function make_ui ( holder, m, tk, block ) {
/*
call this function to generate/update plot
will include tk.vcf.plot_mafcov.overlay_term
*/

	const svgdiv = holder.append('div')
	const legenddiv = holder.append('div') // termdb handle and category color
	const obj = {
		svgdiv,
		legenddiv,
		m,
		tk,
		block,
		overlay_term: tk.vcf.plot_mafcov.overlay_term
	}
	await do_plot( obj )
}





async function do_plot ( obj ) {
/*
call this function to update plot
when overlay term is changed
*/

	const par = {
		genome: obj.block.genome.name,
		trigger_mafcovplot:1,
		m: {
			chr: obj.m.chr,
			pos: obj.m.pos,
			ref: obj.m.ref,
			alt: obj.m.alt
		}
	}
	if(obj.tk.mds) {
		par.dslabel = obj.tk.mds.label
	} else {
		par.vcf = {
			file: obj.tk.vcf.file,
			url: obj.tk.vcf.url,
			indexURL: obj.tk.vcf.indexURL
		}
	}
	if( obj.overlay_term ) par.overlay_term = obj.overlay_term.id

	const wait = obj.svgdiv
		.selectAll('*').remove()
		.append('div')
		.text('Loading...')

	try {
		const data = await client.dofetch('mds2',par)
		if(data.error) throw data.error

		// TODO if is server rendered image

		if( data.plotgroups ) {
			clientside_plot( obj, data.plotgroups )
		}

		show_legend( obj, data.categories )

		wait.remove()

	}catch(e){
		wait.text('ERROR: '+(e.message||e))
		if(e.stack) console.log(e.stack)
	}
}




function show_legend ( obj, categories ) {
// optional, only if has termdb
// categories[] is returned from xhr
	if( !obj.tk.mds || !obj.tk.mds.termdb ) return

	obj.legenddiv.selectAll('*').remove()

	const tr = obj.legenddiv.append('table')
		.style('border-spacing','5px')
		.style('border-collapse','separate')
		.append('tr')

	const termbutton = tr.append('td')
		.style('vertical-align','top')
		.append('div')
		.style('background','#4888BF')
		.style('border-radius','5px')
		.style('color','white')
		.style('padding','2px 5px')
		.style('font-size','.9em')
		.text( obj.overlay_term ? obj.overlay_term.name : 'Select a term' )
		.on('click',()=>{
			obj.tk.legend.tip.clear()
				.showunder(termbutton.node())
			termdbinit({
				genome: obj.block.genome,
				mds: obj.tk.mds,
				div: obj.tk.legend.tip.d,
				default_rootterm:true,
				modifier_click_term:{
					disable_terms: new Set([ obj.overlay_term.id ]),
					callback: (t)=>{
						obj.overlay_term = t
						do_plot( obj )
					}
				}
			})
		})

	if( categories ) {
		const td2 = tr.append('td')
		for(const c of categories ) {
			const row = td2.append('div')
				.style('margin-bottom','4px')
			row.append('span')
				.style('background',c.color)
				.html('&nbsp;&nbsp;')
			row.append('span')
				.style('color',c.color)
				.html('&nbsp;'+c.label)
		}
	}
}




function clientside_plot ( obj, plotgroups ) {
	/*
	import plotter, then plot all groups
	each plot will return data point -> svg cross,
	so to enable mouse over a sample in one plot, and highlight samples from other plots of the same patient
	*/
	import('./plot.vaf2cov').then(plotter => {

		const name2sgp = {}

		for(const g of plotgroups) {

			// may define how to plot each group

			let div  = obj.svgdiv.append('div')
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
				tip: obj.tk.tktip,
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
