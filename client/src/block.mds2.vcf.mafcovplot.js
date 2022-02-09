import { dofetch3 } from './common/dofetch'

/*
********************** EXPORTED
make_ui
********************** INTERNAL
do_plot
clientside_plot


obj{}

*/

export async function make_ui(holder, m, tk, block) {
	/*
call this function to generate/update plot
will include tk.vcf.plot_mafcov.overlay_term
*/

	// the governing object
	const obj = {
		d: {
			svgdiv: holder.append('div'),
			wait: holder.append('div')
		},
		m,
		tk,
		block,
		overlay_term: tk.vcf.plot_mafcov.overlay_term // optional
	}
	if (tk.mds && tk.mds.sample2bam) {
		obj.d.tempbbdiv = holder.append('div')
	}

	await do_plot(obj)
}

async function do_plot(obj) {
	/*
call this function to update plot
when overlay term is changed
*/

	const par = {
		genome: obj.block.genome.name,
		trigger_mafcovplot: 1,
		m: {
			chr: obj.m.chr,
			pos: obj.m.pos,
			ref: obj.m.ref,
			alt: obj.m.alt
		}
	}
	if (obj.tk.mds) {
		par.dslabel = obj.tk.mds.label
	} else {
		par.vcf = {
			file: obj.tk.vcf.file,
			url: obj.tk.vcf.url,
			indexURL: obj.tk.vcf.indexURL
		}
	}
	if (obj.overlay_term && obj.overlay_term.term) {
		par.overlay_term = obj.overlay_term.term.id
		par.overlay_term_q = obj.overlay_term.term.q
	}

	obj.d.wait.text('Loading...').style('display', 'block')

	try {
		const data = await dofetch3('mds2', { method: 'POST', body: JSON.stringify(par) })
		if (data.error) throw data.error

		// TODO if is server rendered image

		if (data.plotgroups) {
			clientside_plot(obj, data.plotgroups)
		}

		obj.d.wait.style('display', 'none')
	} catch (e) {
		obj.d.wait.text('ERROR: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

function clientside_plot(obj, plotgroups) {
	/*
	import plotter, then plot all groups
	each plot will return data point -> svg cross,
	so to enable mouse over a sample in one plot, and highlight samples from other plots of the same patient
	*/
	import('./old/plot.vaf2cov').then(plotter => {
		const name2sgp = {}

		obj.d.svgdiv.selectAll('*').remove()

		for (const g of plotgroups) {
			// may define how to plot each group

			let div = obj.d.svgdiv
				.append('div')
				.style('display', 'inline-block')
				.style('vertical-align', 'top')

			if (plotgroups.length > 1) {
				// more than 1 group, emphasis
				div
					.style('margin-right', '30px')
					.append('div')
					.style('margin-top', '10px')
					.style('padding', '3px 10px')
					.style('background-color', '#aaa')
					.style('color', 'white')
					.style('display', 'inline-block')
					.style('font-size', '.8em')
					.style('font-weight', 'bold')
					.text(g.name.toUpperCase())
				div = div.append('div').style('border', 'solid 1px #aaa')
			}

			const arg = {
				holder: div,
				data: g.lst,
				name: g.name,
				tip: obj.tk.tktip,
				automax: true,
				samplecolor: '#4888BF',
				mouseover: d => {
					if (!d.sampleobj) return
					for (const groupname in name2sgp) {
						if (groupname == g.name) continue
						name2sgp[groupname]
							.filter(d2 => {
								return d2.sampleobj.patient == d.sampleobj.patient
							})
							.each(d2 => {
								d2.crosshair1.attr('transform', 'scale(2.5)')
								d2.crosshair2.attr('transform', 'scale(2.5)')
							})
					}
				},
				mouseout: d => {
					if (!d.sampleobj) return
					for (const groupname in name2sgp) {
						if (groupname == g.name) continue
						name2sgp[groupname]
							.filter(d2 => {
								return d2.sampleobj.patient == d.sampleobj.patient
							})
							.each(d2 => {
								d2.crosshair1.attr('transform', 'scale(1)')
								d2.crosshair2.attr('transform', 'scale(1)')
							})
					}
				}
			}

			///////// XXX quick fix, should be deleted later
			if (obj.tk && obj.tk.mds && obj.tk.mds.sample2bam) {
				arg.click = d => {
					if (!d.sampleobj) return
					const file = obj.tk.mds.sample2bam[d.sampleobj.name]
					if (!file) return
					obj.d.tempbbdiv.selectAll('*').remove()
					import('./block').then(_ => {
						new _.Block({
							hostURL: sessionStorage.getItem('hostURL'),
							holder: obj.d.tempbbdiv,
							genome: obj.block.genome,
							nobox: true,
							chr: obj.m.chr,
							start: obj.m.pos - 30,
							stop: obj.m.pos + 30,
							nativetracks: [obj.block.genome.tracks.find(i => i.__isgene).name.toLowerCase()],
							tklst: [{ type: 'bam', name: d.sampleobj.name, file }],
							hlregions: [{ chr: obj.m.chr, start: obj.m.pos, stop: obj.m.pos }]
						})
					})
				}
			}

			name2sgp[g.name] = plotter.default(arg)
		}
	})
}
