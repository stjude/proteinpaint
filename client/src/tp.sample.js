import * as common from '#shared/common.js'
import * as client from './client'
import { select as d3select } from 'd3-selection'
import { duplicate as svduplicate } from '#shared/bulk.sv.js'
import blocklazyload from './block.lazyload'

export default function (cohort, ds2clst, butt, folder, hostURL) {
	const ds2dtlst = {}
	let dscount = 0
	if (ds2clst) {
		// regroup by dt
		for (const dsname in ds2clst) {
			dscount++
			const tmp = {}
			for (const i of ds2clst[dsname]) {
				tmp[common.mclass[i.key].dt] = 1
			}
			const lst = []
			for (const k in tmp) {
				lst.push(Number.parseInt(k))
			}
			ds2dtlst[dsname] = lst
		}
	}
	let patientnum = 0
	for (const k in cohort.p2st) {
		patientnum++
	}
	if (patientnum == 0) {
		return
	}

	const patientlabel = cohort.individual_label_name ? cohort.individual_label_name.toUpperCase() : 'INDIVIDUAL'
	const labelnum = cohort.individual_label_num ? cohort.individual_label_num : patientnum
	butt
		.html(labelnum + ' <span style="font-size:70%">' + patientlabel + (labelnum > 1 ? 'S' : '') + '</span>')
		.attr('aria-label', 'A table of an ' + patientlabel.toLowerCase() + ' by variant categories.')

	const butrow = folder.append('div').style('padding', '10px 0px')
	butrow
		.append('input')
		.attr('size', 12)
		.attr('placeholder', 'Find ' + patientlabel.toLowerCase())
		.on('keyup', event => {
			let pname = event.target.value
			if (pname.length == 0) {
				for (const n in cohort.patientset) {
					for (const i of cohort.patientset[n].trlst) {
						i.style('display', 'table-row')
					}
				}
				event.target.nextSibling.style.display = 'none'
				return
			}
			pname = pname.toUpperCase()
			for (const n in cohort.patientset) {
				const s = n.toUpperCase().indexOf(pname) == -1 ? 'none' : 'table-row'
				for (const i of cohort.patientset[n].trlst) {
					i.style('display', s)
				}
			}
			event.target.nextSibling.style.display = 'inline'
		})
	butrow
		.append('button')
		.text('Show all')
		.style('display', 'none')
		.style('font-size', '80%')
		.on('click', event => {
			event.target.style.display = 'none'
			event.target.previousSibling.value = ''
			for (const n in cohort.patientset) {
				for (const i of cohort.patientset[n].trlst) {
					i.style('display', 'table-row')
				}
			}
		})
	butrow
		.append('a')
		.attr('href', 'https://docs.google.com/document/d/1buFKS9CN6HNjdFKNh1sJwULeJESQ7ftZntF52dpjFrY/edit?usp=sharing')
		.attr('target', '_blank')
		.style('padding-left', '10px')
		.text('Help')
	const scrolltable = folder
		.append('div')
		.style('border', 'solid 1px #ccc')
		.style('padding', '10px')
		.style('resize', 'vertical')
		.style('overflow-y', 'scroll')
		.style('height', 100 + Math.min(300, patientnum * 20) + 'px')
		.append('table')
		.style('border-spacing', '1px')
		.style('border-collapse', 'separate')
	const impspace = 'solid 10px white'
	// tr 1
	const tr1 = scrolltable.append('tr')
	tr1.append('td').attr(
		'colspan',
		1 + // numerator
			1 + // patient
			1 + // sample
			(cohort.patientannotation ? cohort.patientannotation.metadata.length : 0) +
			cohort.assaylst.length
	)
	for (const dsname in ds2dtlst) {
		tr1
			.append('td')
			.attr('colspan', ds2dtlst[dsname].length)
			.style('border-bottom', dscount > 1 ? 'solid 1px black' : '')
			.style('border-right', dscount > 1 ? impspace : '')
			.style('font-size', '70%')
			.style('text-align', 'center')
			.text(dscount > 1 ? cohort.dsset[dsname].label : '')
	}
	// tr 2
	const tr2 = scrolltable.append('tr').style('background-color', '#d9d9d9')
	tr2.append('td')
	tr2.append('td').style('vertical-align', 'bottom').style('font-size', '.8em').text(patientlabel)
	tr2.append('td').style('vertical-align', 'bottom').style('font-size', '.8em').text('SAMPLE')
	/*
if(cohort.patientannotation) {
	for(const m of cohort.patientannotation.metadata) {
		tr2.append('td')
		.style('font-size','.8em')
		.text(m.label)
	}
}
*/
	for (const i of cohort.assaylst) {
		tr2
			.append('td')
			.classed('sja_clbtext', true)
			.style('font-size', '.8em')
			.style('height', '80px')
			.style('white-space', 'nowrap')
			.append('div')
			.text(i.name)
			.style('transform', 'translate(0px,25px) rotate(-90deg)')
			.style('width', '25px')
	}
	for (const dsname in ds2dtlst) {
		let td
		for (const dt of ds2dtlst[dsname]) {
			td = tr2
				.append('td')
				.classed('sja_clbtext', true)
				.style('font-size', '80%')
				.style('height', '80px')
				.style('white-space', 'nowrap')
				.append('div')
				.text(common.dt2label[dt])
				.style('transform', 'translate(0px,25px) rotate(-90deg)')
				.style('width', '25px')
		}
		if (dscount > 1) {
			td.style('border-right', impspace)
		}
	}
	const pnlst = []
	for (const n in cohort.p2st) {
		pnlst.push(n)
	}
	pnlst.sort((a, b) => {
		let sna = 0,
			snb = 0
		for (const n in cohort.p2st[a]) {
			sna++
		}
		for (const n in cohort.p2st[b]) {
			snb++
		}
		if (sna != snb) {
			return snb - sna
		}
		return 0
	})

	let counter = 0
	for (const patientname of pnlst) {
		/** patient object **/
		const cfg = cohort.patientset[patientname]

		const stlst = []
		for (const k in cfg.samples) {
			stlst.push(k)
		}
		if (stlst.length == 0) {
			const tr = scrolltable.append('tr').classed('sja_tr', true)
			// td1
			tr.append('td').style('font-size', '.7em').text(++counter)
			// td2
			tr.append('td').style('color', '#858585').text(patientname)
			let colcount = 1 + cohort.assaylst.length
			for (const k in ds2dtlst) {
				colcount += ds2dtlst[k].length
			}
			tr.append('td')
				.attr('colspan', colcount)
				.style('color', '#aaa')
				.style('font-size', '.7em')
				.style('padding-left', '10px')
				.text('No sample')
			cfg.trlst.push(tr)
			continue
		}
		stlst.sort()
		for (let i = 0; i < stlst.length; i++) {
			/** sample object **/
			const sample = cfg.samples[stlst[i]]
			const tr = scrolltable.append('tr').classed('sja_tr', true)
			cfg.trlst.push(tr)
			if (i == 0) {
				tr.append('td').attr('rowspan', stlst.length).style('font-size', '.7em').text(++counter)
				tr.append('td').attr('rowspan', stlst.length).text(patientname)
			}
			sample.handle = tr
				.append('td')
				.append('div')
				.classed('sja_opaque8', true)
				.style('border', 'solid 1px black')
				.style('padding', '1px 5px')
				.style('font-size', '.8em')
				.style('cursor', 'default')
				.style('background-color', 'white')
				.text(stlst.length == 1 ? (stlst[0].toLowerCase() == patientname.toLowerCase() ? 'show' : stlst[0]) : stlst[i])
				.on('click', () => {
					if (sample.pane) {
						if (sample.pane.style('display') == 'block') {
							client.flyindi(sample.pane, sample.handle)
							sample.handle.style('background-color', '#858585').style('color', 'white')
							sample.pane.style('display', 'none')
						} else {
							sample.handle.style('background-color', '#ccc').style('color', 'black')
							sample.pane.style('display', 'block')
							client.flyindi(sample.handle, sample.pane)
						}
					} else {
						sample.handle.style('background-color', '#ccc')
						sample_init(sample, hostURL)
					}
				})
			for (const as of cohort.assaylst) {
				let found = false
				for (const tk of sample.tktemplate) {
					if (tk.id == as.id) found = true
				}
				tr.append('td')
					.style('text-align', 'center')
					.html(found ? '&#10003;' : '')
			}
			for (const dsname in ds2dtlst) {
				let td
				for (const dt of ds2dtlst[dsname]) {
					let count = 0
					if (sample.dsset && sample.dsset[dsname]) {
						if (dt == common.dtsv || dt == common.dtfusionrna) {
							// for sv/fusion, avoid duplicating count of same event in this sample
							const strset = new Set()
							for (const m of sample.dsset[dsname]) {
								if (m.dt == dt) {
									strset.add(JSON.stringify(m.pairlst))
								}
							}
							count += strset.size
						} else {
							for (const m of sample.dsset[dsname]) {
								if (m.dt == dt) count++
							}
						}
					}
					td = tr.append('td')
					if (count > 0) {
						td.style('text-align', 'center')
							.append('span')
							.classed('sja_mcdot', true)
							.style('background-color', '#858585')
							.html(count == 1 ? '&nbsp;' : count)
					}
				}
				if (dscount > 1) {
					td.style('border-right', impspace)
				}
			}
		}
	}
}

function sample_init(sample, hostURL) {
	return
	const genome = sample.cohort.genome
	const pane = client.newpane({
		x: 10,
		y: 100,
		close: () => {
			client.flyindi(pane.pane, sample.handle)
			pane.pane.style('display', 'none')
			sample.handle.style('background-color', '#858585').style('color', 'white')
		}
	})
	sample.pane = pane.pane
	pane.header.text(
		(sample.sample ? sample.sample + ' ' : '') +
			(sample.patientname ? sample.patientname + ' ' : '') +
			(sample.sampletype || '')
	)
	const row1 = pane.body.append('div').style('margin', '20px')
	let maxchrlen = 0
	for (const k in genome.majorchr) {
		maxchrlen = Math.max(maxchrlen, genome.majorchr[k])
	}
	const chrpxsf = Math.max(800, document.body.clientWidth - 300) / maxchrlen
	for (const chr in genome.majorchr) {
		const chrholder = pane.body
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin', '20px')
		const arg = {
			genome: genome,
			holder: chrholder,
			dogtag: chr,
			hostURL: hostURL,
			chr: chr,
			start: 1,
			stop: genome.majorchr[chr],
			tklst: []
		}
		if (sample.dsset) {
			arg.mset = []
			for (const dsname in sample.dsset) {
				const mlst = []
				const svpairlstset = new Set()
				for (const m of sample.dsset[dsname]) {
					switch (m.dt) {
						case common.dtsnvindel:
						case common.dtitd:
						case common.dtdel:
						case common.dtnloss:
						case common.dtcloss:
							if (m.chr && m.chr == chr) {
								mlst.push(m)
							}
							break
						case common.dtsv:
						case common.dtfusionrna:
							let hit = false
							if (m.pairlst) {
								const j = JSON.stringify(m.pairlst)
								if (svpairlstset.has(j)) {
									break
								}
								svpairlstset.add(j)
								for (const pair of m.pairlst) {
									if (pair.a && pair.a.chr && pair.a.chr == chr) {
										hit = true
									}
									if (pair.b && pair.b.chr && pair.b.chr == chr) {
										hit = true
									}
								}
							}
							if (hit) {
								mlst.push(svduplicate(m))
							}
							break
					}
				}
				if (mlst.length > 0) {
					arg.mset.push({
						name: dsname,
						mlst: mlst
					})
				}
			}
		}
		if (sample.tktemplate && sample.tktemplate.length > 0) {
			for (const t of sample.tktemplate) {
				const t2 = {}
				for (const k in t) {
					if (typeof t[k] == 'object') {
						t2[k] = {}
						for (const m in t[k]) {
							t2[k][m] = t[k][m]
						}
					} else {
						t2[k] = t[k]
					}
				}
				t2.hidden = true
				arg.tklst.push(t2)
			}
		}
		blocklazyload(arg)
	}
}
