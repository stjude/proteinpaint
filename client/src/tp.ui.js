import * as client from './client'
import { init_bulk_flag } from '#shared/bulk'
import * as bulkui from './bulk.ui'
import * as common from '#shared/common'
import blocklazyload from './block.lazyload'
import blockinit from './block.init'

import tp_class from './tp.classes'
import tp_gene from './tp.gene'
import tp_sample from './tp.sample'
import tp_pathway from './tp.pathway'
import inithcmap from './hcmap'
import tp_e2pca from './tp.e2pca'
import tp_getgeneexpression from './tp.gene.geneexpression'
import { getsjcharts } from './getsjcharts'

/*

for generating the study HTML container
which has 2 pillars, left for trigger buttons (also shows stats about the dataset), right for actual apps
and show various apps depending on the data attributes

*/

export default async function tpui(cohort, holder, hostURL, app = { callbacks: { sjcharts: {} } }) {
	const debugmode = app.debugmode

	if (debugmode) {
		window.cohort = cohort
	}

	if (!('hostURL' in cohort)) cohort.hostURL = hostURL

	// cohort already has jwt

	// all data parsed
	if (cohort.headerhtml) {
		holder.append('div').html(cohort.headerhtml)
	}
	let personcount = 0
	for (const pn in cohort.p2st) {
		personcount++
		for (const st in cohort.p2st[pn]) {
			const s = cohort.p2st[pn][st]
			s.sampletype = st
			s.patientname = pn
			s.cohort = cohort
		}
	}
	const table = holder.append('table').style('margin-top', '20px')
	const tr0 = table.append('tr')

	// two pillar container, only used by makefolder
	cohort.__tdleft = tr0.append('td').style('vertical-align', 'top').style('padding-right', '20px')
	cohort.__tdright = tr0.append('td').style('vertical-align', 'top')

	if (cohort.hide_navigation) {
		cohort.__tdleft.style('display', 'none')
	}

	/*
// TODO from old pp, yet to be ported over
if(cohort.render) {
	sja.f.tpui_render(cohort,tdleft,tdright)
}
*/

	if (!cohort.hide_addnewfile) {
		// add new files
		// only allow adding new files when there is just one dataset??
		const [butt1, folder1] = makefolder(cohort)
		folder1.style('background-color', '#f4f4f4').style('margin', '0px 20px 20px 0px').style('padding', '20px')
		butt1.html('&#43; <span style="font-size:.8em">NEW FILE</span>')
		const saydiv = folder1.append('p')
		const filediv = folder1.append('div')
		const fileui = () => {
			filediv.selectAll('*').remove()
			filediv.append('span').html('Select data type&nbsp;')
			const typeselect = client.filetypeselect(filediv).style('margin-right', '20px')
			const butt = filediv
				.append('input')
				.attr('type', 'file')
				.on('change', event => {
					saydiv.text('')
					const file = event.target.files[0]
					if (!file) {
						fileui()
						return
					}
					if (file.size == 0) {
						saydiv.text('Wrong file: ' + file.name)
						fileui()
						return
					}
					const reader = new FileReader()
					reader.onload = event => {
						saydiv.text(file.name + ' loaded.')
						const flag = init_bulk_flag(cohort.genome.name)
						if (!flag) {
							saydiv.text('should not happen')
							fileui()
							return
						}

						const error0 = bulkui.content2flag(event.target.result, typeselect.node().selectedIndex, flag)

						if (error0) {
							saydiv.text('Error with ' + file.name + ': ' + error0)
							fileui()
							return
						}

						// new data goes to first dataset
						let ds = null
						for (const k in cohort.dsset) {
							ds = cohort.dsset[k]
							break
						}
						if (!ds) {
							saydiv.text('no dataset in cohort, this should not happen')
							fileui()
							return
						}

						// flag2thisds tells the data in flag will be appended to the given ds
						const error1 = bulkui.bulkin({
							flag: flag,
							cohort: cohort,
							flag2thisds: ds
						})
						if (error1) {
							saydiv.text('Error with ' + file.name + ': ' + error1)
							fileui()
							return
						}

						if (flag.good == 0) {
							saydiv.text(file.name + ': no data loaded')
							fileui()
							return
						}
						saydiv.text('')
						fileui()
						// good data ready
						holder.selectAll('*').remove()
						tpui(cohort, holder, hostURL)
					}
					reader.onerror = function () {
						saydiv.text('Error reading file ' + file.name)
						fileui()
						return
					}
					saydiv.text('Parsing file ' + file.name + ' ...')
					reader.readAsText(file, 'utf8')
				})
		}
		fileui()
	}

	const [butt2, folder2] = makefolder(cohort)
	const ds2clst = tp_class(cohort, butt2, folder2)

	const hassamplelst = []
	const hasdiseaselst = []
	for (const k in cohort.dsset) {
		const ds = cohort.genome.datasets[k]
		if (ds.hassample) {
			hassamplelst.push(k)
		}
		if (ds.hasdisease) {
			hasdiseaselst.push(k)
		}
	}

	if (ds2clst) {
		// has mlst from text files
		const [butt3, folder3] = makefolder(cohort, cohort.show_genetable)
		tp_gene(cohort, ds2clst, butt3, folder3, personcount > 0, hostURL)
	}

	let showheatmap = false

	if (hassamplelst.length || personcount > 0) {
		/*
	has samples
	migrate .p2st to .patientset
	*/
		cohort.patientset = {}
		for (const patient in cohort.p2st) {
			cohort.patientset[patient] = {
				trlst: [],
				samples: cohort.p2st[patient]
			}
		}

		/*if (!cohort.disable_sampletable) {
			// show sample table
			const [butt, folder] = makefolder(cohort, cohort.show_sampletable)
			tp_sample(cohort, ds2clst, butt, folder, hostURL)
		}*/

		// hm
		if (hassamplelst.length > 0 && !cohort.hardcodemap) {
			showheatmap = true
		}
	}

	if (cohort.show_heatmap) {
		showheatmap = true
	}
	let hm_main
	if (showheatmap) {
		const [hmbtn, hmdiv] = makefolder(cohort)
		hmbtn.text('HEATMAP').style('font-size', '.8em')
		const sjcharts = await getsjcharts()
		const appname = (cohort.name ? cohort.name + '.' : '') + 'hm'
		sjcharts.heatmap({
			cohort,
			hassamplelst,
			blockinit,
			debugmode,
			// sjcharts has its own d3 instance so it has to
			// re-select to bind the d3 'event' properly
			dom: {
				butt: hmbtn.node(),
				holder: hmdiv.node()
			},
			tp_getgeneexpression,
			show_heatmap: cohort.show_heatmap,
			// use a subnested sjcharts object to namespace its instances
			instanceTracker: app.instanceTracker && app.instanceTracker.sjcharts,
			callbacks:
				app.callbacks && app.callbacks.sjcharts && (app.callbacks.sjcharts[appname] || app.callbacks.sjcharts.hm)
		})
	}

	/*
if(cohort.variantgene) {
	sja.f.tpui_variantgene(cohort,cohort.variantgene,d3.select(tdleft[0]),d3.select(tdright[0]))
}
*/

	if (cohort.hardcodemap) {
		const [hmbut, hmdiv] = makefolder(cohort, cohort.show_hardcodemap)
		hmbut.text('HEATMAP').style('font-size', '.8em')
		for (const hcmap of cohort.hardcodemap) {
			const div = hmdiv.append('div').style('display', 'inline-block').style('margin-bottom', '20px')
			if (hcmap.name) {
				div.append('h3').text(hcmap.name)
			}
			inithcmap(hcmap, div)
		}
	}

	if (cohort.survivalJSON) {
		const [srvbut, srvdiv] = makefolder(cohort, cohort.show_hardcodemap)
		srvbut.text('SURVIVAL CURVE').style('font-size', '.8em').style('border-color', 'transparent')
		const sjcharts = await getsjcharts()
		sjcharts.survival({
			cohort,
			dom: {
				butt: srvbut.node(),
				holder: srvdiv.node()
			},
			// use a subnested sjcharts object to namespace its instances
			instanceTracker: app.instanceTracker && app.instanceTracker.sjcharts,
			callbacks: app.callbacks && app.callbacks.sjcharts && app.callbacks.sjcharts.sv
		})
	}

	/*if (ds2clst && !cohort.disable_genenetwork) {
		// has mlst
		const [butt, folder] = makefolder(cohort)
		butt
			.style('font-size', '.8em')
			.text('GENE NETWORK')
			.attr('aria-label', 'A force-directed graph of gene groups, shown with proportion of hits by diagnosis.')
		let loaded = false
		butt.on('click', () => {
			if (folder.style('display') == 'none') {
				butt.style('border-color', 'black')
				client.appear(folder)
			} else {
				butt.style('border-color', 'transparent')
				client.disappear(folder)
			}
			if (loaded) return
			loaded = true
			tp_pathway(cohort, folder)
		})
	}*/

	/*if (hasdiseaselst.length) {
		const [skbtn, skdiv] = makefolder(cohort)
		skbtn
			.style('font-size', '.8em')
			.text('RIBBON GRAPH')
			.attr('aria-label', 'A flow or Sankey diagram showing associated quantities by proportional ribbon widths.')
		const sjcharts = await getsjcharts()
		sjcharts.sankey({
			cohort,
			dom: {
				butt: skbtn.node(),
				holder: skdiv.node()
			},
			// use a subnested sjcharts object to namespace its instances
			instanceTracker: app.instanceTracker && app.instanceTracker.sjcharts,
			callbacks: app.callbacks && app.callbacks.sjcharts && app.callbacks.sjcharts.sk
		})
	}*/

	/*if (
		hasdiseaselst.length ||
		cohort.piebarJSON ||
		(cohort.heatmapJSON && cohort.heatmapJSON.samplegroup && cohort.heatmapJSON.samplegroup.length)
	) {
		const [piebtn, piediv] = makefolder(cohort)
		piebtn
			.style('font-size', '.8em')
			.text('PIE CHARTS')
			.attr(
				'title',
				'A sample group by gene group matrix of piecharts, with each pie wedge representing the number of hits by variant class.'
			)
		const sjcharts = await getsjcharts()
		sjcharts.piebar({
			cohort,
			dom: {
				butt: piebtn.node(),
				holder: piediv.node()
			},
			// use a subnested sjcharts object to namespace its instances
			instanceTracker: app.instanceTracker && app.instanceTracker.sjcharts,
			callbacks: app.callbacks && app.callbacks.sjcharts && app.callbacks.sjcharts.pb
		})
	}*/

	if (cohort.browserview) {
		const [butt, folder] = makefolder(cohort)
		butt.style('font-size', '.8em').text('BROWSER')
		let loaded = false
		butt.on('click', () => {
			if (folder.style('display') == 'none') {
				butt.style('border-color', 'black')
				client.appear(folder)
			} else {
				butt.style('border-color', 'transparent')
				client.disappear(folder)
			}
			if (loaded) return
			loaded = true
			const arg = {
				holder: folder,
				genome: cohort.genome,
				debugmode: debugmode,
				dogtag: cohort.genome.name,
				hostURL: hostURL,
				jwt: cohort.jwt,
				cohort: cohort,
				nobox: cohort.browserview.nobox,
				datasetqueries: cohort.browserview.datasetqueries,
				tklst: []
			}
			if (cohort.browserview.position) {
				// always true
				arg.chr = cohort.browserview.position.chr
				arg.start = cohort.browserview.position.start
				arg.stop = cohort.browserview.position.stop
			}
			// native track
			if (cohort.browserview.nativetracks) {
				arg.nativetracks = cohort.browserview.nativetracks
			}
			// custom track
			if (cohort.browserview.tracks) {
				for (const t of cohort.browserview.tracks) {
					arg.tklst.push(t)
				}
			}
			// assay track
			if (cohort.browserview.assays) {
				if (!cohort.assaylst) {
					console.error('assaylst not set!')
					cohort.assaylst = []
				}
				for (const assayname in cohort.browserview.assays) {
					const assayview = cohort.browserview.assays[assayname]
					if (!assayview.assayobj) {
						// assayobj should be defined
						continue
					}
					if (assayview.combined) {
						if (assayview.combinetk) {
							arg.tklst.push(assayview.combinetk)
						}
					} else {
						for (const pn in cohort.patientset) {
							for (const st in cohort.patientset[pn].samples) {
								for (const t of cohort.patientset[pn].samples[st].tktemplate) {
									if (t.id == assayview.assayobj.id) {
										arg.tklst.push(t)
									}
								}
							}
						}
					}
				}
			}
			if (cohort.browserview.defaultassaytracks) {
				const [err, lst] = cohort2assaytracks(cohort)
				if (err) {
					client.sayerror(holder, 'error with .defaultassaytracks: ' + err)
				} else {
					for (const t of lst) arg.tklst.push(t)
				}
			}

			for (const t of arg.tklst) {
				t.iscustom = true // important
			}

			blocklazyload(arg)
		})
		if (cohort.show_browser) {
			butt.node().click()
		}
	}

	if (cohort.e2pca) {
		const [butt, folder] = makefolder(cohort)
		butt.text(cohort.e2pca.label).style('font-size', '.8em')

		let loaded = false
		butt.on('click', () => {
			if (folder.style('display') == 'none') {
				butt.style('border-color', 'black')
				client.appear(folder)
			} else {
				butt.style('border-color', 'transparent')
				client.disappear(folder)
			}
			if (loaded) return
			loaded = true
			tp_e2pca(cohort, folder)
		})
		if (cohort.show_e2pca) {
			butt.node().click()
		}
	}

	/***** end of tpui *****/
}

function makefolder(cohort, show) {
	const butt = cohort.__tdleft
		.append('div')
		.attr('class', 'sja_menuoption')
		.style('margin-top', '10px')
		.style('white-space', 'nowrap')
	const folder = cohort.__tdright.append('div').style('padding-bottom', '20px')
	butt.on('click', () => {
		if (folder.style('display') == 'block') {
			client.disappear(folder)
			butt.style('border', 'solid 1px transparent')
		} else {
			butt.style('border', 'solid 1px #545454')
			client.appear(folder)
		}
	})
	if (show) {
		butt.style('border', 'solid 1px #545454')
		folder.style('display', 'block')
	} else {
		butt.style('border', 'solid 1px transparent')
		folder.style('display', 'none')
	}
	return [butt, folder]
}

function cohort2assaytracks(ct) {
	/*
	cohort.browserview.defaultassaytracks[]

	get the tklst from cohort.p2st
	*/

	if (!ct.browserview) return [null, []]
	if (!ct.browserview.defaultassaytracks) return [null, []]

	const tklst = []
	for (const t of ct.browserview.defaultassaytracks) {
		const p = ct.p2st[t.level1]
		if (!p) continue
		if (t.level2) {
			const p2 = p[t.level2]
			if (!p2) continue
			if (!p2.tktemplate) continue
			for (const tt of p2.tktemplate) {
				if (tt.assayname == t.assay) {
					tklst.push(tt)
					if (t.justone) {
						break
					}
				}
			}
		} else {
			// no level2, use all tk from p
			for (const st in p) {
				const p2 = p[st]
				if (p2.tktemplate) {
					for (const tt of p2.tktemplate) {
						if (tt.assayname == t.assay) {
							tklst.push(tt)
						}
					}
				}
			}
		}
	}
	return [null, tklst]
}
