import * as client from './client'
import { termsettingInit } from './common/termsetting'

/*
********************** EXPORTED
make_ui
********************** INTERNAL
do_plot
show_legend
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

	const legenddiv = holder
		.append('div') // termdb handle and category color
		.style('margin', '10px')
		.style('border-top', 'solid 1px #ccc')
		.style('padding-top', '10px')

	if (tk.mds && tk.mds.termdb) {
		// enable selecting term for overlaying
		const row = legenddiv.append('div').style('margin-bottom', '5px')

		row
			.append('div')
			.style('display', 'block')
			.style('margin-bottom', '10px')
			.html('Overlay term&nbsp;')

		const api = termsettingInit({
			$id: 'sja-pp-block-' + block.blockId + '-' + block.tklst.findIndex(t => t == tk) + '-mavcovplot',
			holder: row.append('div'),
			vocab: {
				route: 'termdb',
				genome: obj.block.genome.name,
				dslabel: obj.tk.mds.label
			},
			callback: data => {
				obj.overlay_term = data || {}
				api.main(obj.overlay_term)
				do_plot(obj)
			}
		})
		if (obj.overlay_term.term) {
			api.main(obj.overlay_term)
		}

		obj.d.term_legenddiv = row.append('div') // display categories after updating plot
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
		const data = await client.dofetch('mds2', par)
		if (data.error) throw data.error

		// TODO if is server rendered image

		if (data.plotgroups) {
			clientside_plot(obj, data.plotgroups)
		}

		show_legend(obj, data.categories)

		obj.d.wait.style('display', 'none')
	} catch (e) {
		obj.d.wait.text('ERROR: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

function show_legend(obj, categories) {
	// optional, only if has termdb
	// categories[] is returned from xhr
	obj.d.term_legenddiv.selectAll('*').remove()
	if (!obj.tk.mds || !obj.tk.mds.termdb || !categories) return
	let cats = categories

	// for numerical term sort the categories, and attach unannotated at the end of cats[]
	if (obj.overlay_term.type == 'integer' || obj.overlay_term.type == 'float') {
		let unannoated_cats = []
		for (const [i, cat] of categories.entries()) {
			if (isNaN(cat.label.split(' ')[0])) {
				unannoated_cats.push(categories.splice(i, 1)[0])
			}
		}
		cats = categories.sort((a, b) => (parseFloat(a.label.split(' ')[0]) > parseFloat(b.label.split(' ')[0]) ? 1 : -1))
		cats.push(...unannoated_cats)
	}

	for (const c of cats) {
		const row = obj.d.term_legenddiv.append('div').style('margin', '4px 0px')
		row
			.append('span')
			.style('background', c.color)
			.html('&nbsp;&nbsp;')
		row
			.append('span')
			.style('color', c.color)
			.html('&nbsp;' + c.label + '&nbsp;(n=' + c.count + ')')
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
