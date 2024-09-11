import { select as d3select, selectAll as d3selectAll } from 'd3-selection'
import { json as d3json } from 'd3-fetch'
import * as client from './client'
import * as common from '#shared/common'
import blockinit from './block.init'
import tp_getgeneexpression from './tp.gene.geneexpression'
import { Menu } from '../dom/menu'

const tip = new Menu()

export default function (cohort, ds2clst, butt, folder, defaulthide, host) {
	if (!ds2clst) return null
	const hostURL = host || ''

	const union = {}
	// always contain all genes
	// k: gene name, v: { mcount:0, isoform:{} }
	let genelst = []
	// mutable, build table according to its order
	// gene name only!
	for (const k in cohort.dsset) {
		for (const gn in cohort.dsset[k].bulkdata) {
			if (!(gn in union)) {
				union[gn] = { mcount: 0, isoform: {} }
				genelst.push(gn)
			}
			union[gn].mcount += cohort.dsset[k].bulkdata[gn].length
			for (const m of cohort.dsset[k].bulkdata[gn]) {
				const i = m.isoform
				if (!i) continue
				union[gn].isoform[i] = 1
			}
		}
	}
	let genelimit = Math.min(100, genelst.length)
	// FIXME hardcoded
	const noncodingclass = new Set(['Intron', 'P', 'S', 'E', common.mclassutr3, common.mclassutr5])
	const gene2import = {}
	const ds2import = {}
	let usenoncoding = true,
		// k: isoform, v: {}
		// k: dsname, v: {stat}
		// k: dsname
		importsilent = false

	butt
		.html(genelst.length + ' <span style="font-size:.8em">GENES</span>')
		.attr('aria-label', 'A summary table of gene by variant type, order by number of hits in descending order.')
	const errdiv = folder.append('div')
	const sayerror = m => {
		client.sayerror(errdiv, m)
	}

	// top row
	const toprow = folder.append('div').style('margin-bottom', '8px')
	toprow
		.append('button')
		.style('margin-right', '10px')
		.text('Configure')
		.on('click', () => {
			if (optiondiv.style('display') == 'block') {
				client.disappear(optiondiv)
			} else {
				client.appear(optiondiv)
			}
		})

	toprow
		.append('button')
		.style('margin-right', '10px')
		.text('Download')
		.on('click', () => {
			const txt = dotable()
			client.export_data('Gene summary', [{ text: txt }])
		})

	toprow
		.append('input')
		.attr('type', 'text')
		.attr('size', 10)
		.attr('placeholder', 'Find gene')
		.style('margin', '0px 20px 0px 5px')
		.on('keyup', event => {
			let n = event.target.value
			if (n == '') {
				tip.hide()
				return
			}
			if (cohort.geneToUpper) {
				n = n.toUpperCase()
			}
			if (event.code == 'Enter') {
				tip.hide()
				event.target.value = ''
				if (n in union) {
					paintgene(n)
				}
				return
			}
			const hit = []
			for (const gn in union) {
				if (gn.indexOf(n) == 0) {
					hit.push({ name: gn, count: union[gn].mcount })
				}
			}
			if (hit.length == 0) {
				tip.hide()
				return
			}
			hit.sort((a, b) => b.count - a.count)
			tip.clear().showunder(event.target)
			for (let i = 0; i < Math.min(30, hit.length); i++) {
				const n = hit[i].name
				const row = tip.d
					.append('div')
					.attr('class', 'sja_menuoption_y')
					.on('click', () => {
						paintgene(n)
					})
				row.append('span').text(n)
				row.append('span').style('font-size', '.7em').text(hit[i].count)
			}
		})
	toprow
		.append('a')
		.attr('href', 'https://docs.google.com/document/d/1NrH1H-FUWJtEKLk69V-k8uaYHOr9YO2obM9ZLZslEQ0/edit?usp=sharing')
		.attr('target', '_blank')
		.text('Help')
	const secondrow = folder.append('div').style('border', 'solid 1px #ccc').style('margin', '10px 0px')
	const optiondiv = secondrow.append('div').style('display', 'none').style('background-color', '#f1f1f1')
	const scrolltoppad = 140
	const scrollholder = secondrow
		.append('div')
		.style('padding-top', scrolltoppad + 'px')
		.style('position', 'relative')
	const scrolldiv = scrollholder
		.append('div')
		.style('overflow-y', 'scroll')
		.style('height', '400px')
		.style('resize', 'vertical')
	const table = scrolldiv.append('table').style('border-spacing', '1px').style('border-collapse', 'separate')

	// options
	const oprow1 = optiondiv.append('div').style('padding', '10px').style('border-bottom', 'dashed 1px #ccc')
	const oprow2 = optiondiv.append('div').style('padding', '10px').style('border-bottom', 'dashed 1px #ccc')
	const oprow3 = optiondiv.append('div').style('padding', '10px').style('border-bottom', 'dashed 1px #ccc')
	// option row1
	const gcsays = oprow1
		.append('span')
		.style('padding-right', '10px')
		.text('Showing ' + (genelimit < genelst.length ? 'top ' + genelimit + ' genes' : 'all genes'))
	oprow1
		.append('button')
		.text('more')
		.on('click', () => {
			genelimit = Math.min(genelst.length, genelimit + 10)
			gcsays.text('Showing ' + (genelimit < genelst.length ? 'top ' + genelimit : 'all genes'))
			dotable()
		})
	oprow1
		.append('button')
		.text('less')
		.on('click', () => {
			genelimit = Math.max(1, genelimit - 10)
			gcsays.text('Showing ' + (genelimit < genelst.length ? 'top ' + genelimit : 'all genes'))
			dotable()
		})
	// option row2
	oprow2.append('span').text('Show subset').style('padding-right', '10px')
	const genesetta = oprow2
		.append('textarea')
		.attr('rows', 1)
		.attr('cols', 20)
		.attr('placeholder', 'enter gene names')
		.style('margin-right', '10px')
	oprow2
		.append('button')
		.text('Submit')
		.on('click', () => {
			const v = genesetta.property('value').trim()
			if (v == '') return
			const lst = v.split(/[\s\t\n]+/),
				good = [],
				nomatch = []
			for (const s of lst) {
				if (s == '') continue
				const n = cohort.geneToUpper ? s.trim().toUpperCase() : s.trim()
				if (n in union) {
					good.push(n)
				} else {
					nomatch.push(s)
				}
			}
			if (nomatch.length) {
				sayerror('No match found for ' + nomatch.join(', '))
			}
			if (good.length == 0) return
			genelst = good
			genelimit = good.length
			dotable()
		})
	oprow2
		.append('button')
		.text('Use default')
		.on('click', () => {
			// to default gene list
			genelst = []
			for (const n in union) {
				genelst.push(n)
			}
			genelimit = Math.min(100, genelst.length)
			dotable()
		})
	// option row3
	oprow3.append('span').html('Noncoding mutation visibility:&nbsp;')
	const oprow3select = oprow3.append('select').on('change', () => {
		usenoncoding = !usenoncoding
		for (const dat of attrlst) {
			if (!dat.atlst) {
				// mutation class only in dataset
				continue
			}
			for (const at of dat.atlst) {
				if (!at.ismclass) continue
				if (usenoncoding) {
					at.hide = false
					continue
				}
				at.hide = noncodingclass.has(at.key)
			}
		}
		dotable()
	})
	oprow3select.append('option').text('show').attr('value', 'y')
	oprow3select.append('option').text('hide').attr('value', 'n')
	oprow3
		.append('p')
		.style('font-size', '.8em')
		.style('color', '#858585')
		.text('Including: silent, splice_region, exon, UTR, and intron.')

	const hassamplelst = []
	for (const k in cohort.dsset) {
		const d = cohort.dsset[k]
		if (d.hassample) {
			hassamplelst.push(d)
		}
	}
	// option row5
	if (hassamplelst.length) {
		const oprow5 = optiondiv.append('div').style('padding', '10px').style('border-bottom', 'dashed 1px #ccc')
		oprow5.append('span').html('Gene recurrence (# of samples for each gene):&nbsp;')
		for (const ds of hassamplelst) {
			oprow5
				.append('button')
				.text(hassamplelst.length == 1 ? 'show' : ds.label)
				.on('click', event => {
					const bars = []
					for (const gene of genelst) {
						const hash = {}
						let samplecount = 0
						if (gene in ds.bulkdata) {
							for (const m of ds.bulkdata[gene]) {
								if (!usenoncoding && noncodingclass.has(m.class)) return
								if (!(m.sample in hash)) {
									hash[m.sample] = 1
									samplecount++
								}
							}
						}
						bars.push({
							name: gene,
							size: samplecount
						})
					}
					const pos = event.target.getBoundingClientRect()
					barplot(bars, '#76B38C', 'Number of samples' + (usenoncoding ? '' : ', excluding noncoding mutations'), pos)
				})
		}
		// option row6
		const oprow6 = optiondiv.append('div').style('padding', '10px').style('border-bottom', 'dashed 1px #ccc')
		oprow6.append('span').html('Mutation burden (# mutations for each sample):&nbsp;')
		for (const ds of hassamplelst) {
			oprow6
				.append('button')
				.text(hassamplelst.length == 1 ? 'show' : ds.label)
				.on('click', event => {
					const samplehash = {}
					for (const g in ds.bulkdata) {
						for (const m of ds.bulkdata[g]) {
							const n = m.sample
							if (n) {
								if (!usenoncoding && noncodingclass.has(m.class)) continue
								if (!(n in samplehash)) {
									samplehash[n] = 0
								}
								samplehash[n]++
							}
						}
					}
					const bars = []
					for (const n in samplehash) {
						bars.push({
							name: n,
							size: samplehash[n]
						})
					}
					const pos = event.target.getBoundingClientRect()
					barplot(bars, '#76B38C', 'Mutation burden' + (usenoncoding ? '' : ', excluding noncoding mutations'), pos)
				})
		}
	}
	// option row7
	const oprow7 = optiondiv
		.append('div')
		.style('padding', '10px')
		.style('border-bottom', 'dashed 1px #ccc')
		.text('Click on a column header to rank genes.')
	// table columns
	const attrlst = [
		{
			label: 'Name',
			isgenename: true
		}
	]
	let firstsort = true
	let dscount = 0
	for (const dsname in cohort.dsset) {
		dscount++
		const thisds = {
			name: cohort.dsset[dsname].label,
			atlst: [
				{
					label: '# mutation',
					get: gn => {
						if (!(gn in cohort.dsset[dsname].bulkdata)) return 0
						if (usenoncoding) {
							return cohort.dsset[dsname].bulkdata[gn].length
						}
						let c = 0
						for (const i of cohort.dsset[dsname].bulkdata[gn]) {
							if (!noncodingclass.has(i.class)) c++
						}
						return c
					},
					rotate: true,
					descend: true,
					sort: firstsort
					//secondsort:true, // secondary, so to keep order persistant when sorting on classes with many genes having same number in sorted class
				}
			]
		}
		firstsort = false
		if (cohort.dsset[dsname].hassample) {
			thisds.atlst.push({
				label: '# sample',
				get: gn => {
					if (!(gn in cohort.dsset[dsname].bulkdata)) return 0
					const set = new Set()
					for (const m of cohort.dsset[dsname].bulkdata[gn]) {
						if (!usenoncoding && noncodingclass.has(m.class)) continue
						if (!m.sample) continue
						set.add(m.sample)
					}
					return set.size
				},
				rotate: true,
				descend: true
			})
		}
		for (const c of ds2clst[dsname]) {
			c.ismclass = true
			c.get = gn => {
				if (!(gn in cohort.dsset[dsname].bulkdata)) return 0
				let total = 0
				for (const m of cohort.dsset[dsname].bulkdata[gn]) {
					if (m.class == c.key) total++
				}
				return total
			}
			c.rotate = true
			c.descend = true
			thisds.atlst.push(c)
		}
		attrlst.push(thisds)
	}

	const dotable = () => {
		// imported data won't be reflected in attrlst
		let sortkey = null,
			sortkey2 = null
		for (const a of attrlst) {
			if (a.hide) continue
			if (a.atlst) {
				for (const b of a.atlst) {
					if (b.hide) continue
					if (b.sort) {
						sortkey = b
						continue
					}
					if (b.secondsort) {
						sortkey2 = b
						continue
					}
				}
				continue
			}
			if (a.sort) {
				sortkey = a
				continue
			}
			if (a.secondsort) {
				sortkey2 = a
			}
		}
		if (sortkey) {
			genelst.sort((a, b) => {
				// a/b is gene name
				if (sortkey.isgenename) {
					// no getter, directly sort on gene name
					if (a < b) {
						return sortkey.descend ? 1 : -1
					}
					return sortkey.descend ? -1 : 1
				}
				const i = sortkey.get(a),
					j = sortkey.get(b)
				if (typeof i == 'string') {
					if (i < j) {
						return sortkey.descend ? 1 : -1
					}
					return sortkey.descend ? -1 : 1
				}
				// numeric
				if (i == j) {
					if (sortkey2) {
						// second sort is currently numerical only
						const i2 = sortkey2.get(a),
							j2 = sortkey2.get(b)
						if (i2 == j2) {
							// get isoform for a and b so to look into import
							if (a in gene2import) {
								if (!(b in gene2import)) return -1
							} else if (b in gene2import) {
								return 1
							}
						} else {
							return j2 - i2
						}
					} else {
						// get isoform for a and b so to look into import
						if (a in gene2import) {
							if (!(b in gene2import)) return -1
						} else if (b in gene2import) {
							return 1
						}
					}
					// last resort, alphabetic order
					return a < b ? -1 : 1
				}
				return sortkey.descend ? j - i : i - j
			})
		}
		// count how many classes at total in each imported
		const importclass = {}
		let hasimport = false
		for (const dsname in ds2import) {
			hasimport = true
			const classcount = {}
			for (let i = 0; i < genelimit; i++) {
				const gene = genelst[i]
				if (gene in gene2import && dsname in gene2import[gene]) {
					for (const c in gene2import[gene][dsname].class) {
						if (!(c in classcount)) {
							classcount[c] = 0
						}
						classcount[c] += gene2import[gene][dsname].class[c]
					}
				}
			}
			const clst = []
			for (const c in classcount) {
				clst.push({
					class: c,
					n: classcount[c]
				})
			}
			clst.sort((a, b) => b.n - a.n)
			importclass[dsname] = clst
		}
		const impspace = 'solid 10px white'
		table.selectAll('*').remove()
		// tr 1, overspanning header
		const tr1 = table.append('tr')
		tr1
			.append('td') // numeritor
			.style('height', '0px')
			.style('padding', '0px')
		tr1
			.append('td') // gene name
			.style('height', '0px')
			.style('padding', '0px')
		for (const ds of attrlst) {
			if (!ds.atlst) continue
			let spannum = 0
			for (const a of ds.atlst) {
				if (!a.hide) spannum++
			}
			tr1
				.append('td')
				.attr('colspan', spannum)
				.style('text-align', 'center')
				.style('border-right', impspace)
				.append('div')
				.style('position', 'absolute')
				.style('top', '1px')
				.style('border-bottom', dscount > 1 ? 'solid 1px black' : '')
				.text(dscount > 1 ? ds.name : '')
		}
		for (const dsname in ds2import) {
			// 2 stands for #m, and #sample
			const td = tr1
				.append('td')
				.attr('colspan', 2 + importclass[dsname].length)
				.style('border-right', impspace)
				.append('div')
				.style('top', '2px')
				.style('position', 'absolute')
				.style('color', cohort.genome.datasets[dsname].color)
				.style('border-bottom', 'solid 1px ' + cohort.genome.datasets[dsname].color)
			td.append('span').text(
				cohort.genome.datasets[dsname].label +
					(ds2import[dsname].totalsample ? ', ' + ds2import[dsname].totalsample + ' total samples' : '')
			)
			td.append('div')
				.style('position', 'absolute')
				.style('right', '0px')
				.style('top', '-5px')
				.attr('class', 'sja_clb')
				.html('&#10005;')
				.on('click', () => {
					delete ds2import[dsname]
					for (const n in gene2import) {
						delete gene2import[n][dsname]
					}
					dotable()
				})
		}

		// collect table matrix for export
		const exportlines = []

		const exportheader = []

		// tr 2, header
		const tr2 = table.append('tr')
		tr2.append('td').style('height', '0px').style('padding', '0px')

		//exportheader.push('')

		for (const a of attrlst) {
			if (a.hide) continue
			let lst = []
			if (a.atlst) {
				lst = a.atlst
			} else {
				lst = [a]
			}
			let td
			for (const at of lst) {
				if (at.hide) continue
				td = tr2
					.append('td')
					.attr('class', 'sja_clbtext')
					.style('font-size', '.8em')
					.style('height', '0px')
					.style('padding', '0px')
					.style('color', at.color ? at.color : 'black')
					.style('white-space', 'nowrap')
				td.append('div')
					.html(
						at.rotate
							? at.sort
								? (at.descend ? '&#9664;' : '&#9654;') + ' ' + at.label
								: at.label
							: at.label + (at.sort ? ' ' + (at.descend ? '&#9662;' : '&#9652;') : '')
					)
					.style('position', 'absolute')
					.style('top', scrolltoppad - 25 + 'px')
					.style('transform', at.rotate ? 'translate(-3px,0px) rotate(-90deg)' : '')
					.style('width', at.rotate ? '25px' : 'auto')
					.on('click', () => {
						const ps = at.sort
						for (const a of attrlst) {
							if (a.atlst) {
								for (const b of a.atlst) {
									b.sort = false
								}
							} else {
								a.sort = false
							}
						}
						at.sort = true
						if (ps) {
							at.descend = !at.descend
						}
						dotable()
					})

				exportheader.push(at.label + (a.name ? '.' + a.name : ''))
			}
			td.style('border-right', impspace)
		}
		// imported ds header items
		for (const dsname in ds2import) {
			// # m count
			tr2
				.append('td')
				.style('font-size', '.8em')
				.style('height', '0px')
				.style('padding', '0px')
				.style('white-space', 'nowrap')
				.append('div')
				.html('# mutation')
				.style('position', 'absolute')
				.style('top', scrolltoppad - 25 + 'px')
				.style('transform', 'translate(-3px,0px) rotate(-90deg)')
				.style('width', '25px')

			exportheader.push(dsname + '.#mutation')

			// # sample
			tr2
				.append('td')
				.style('font-size', '.8em')
				.style('height', '0px')
				.style('padding', '0px')
				.style('white-space', 'nowrap')
				.append('div')
				.html('# sample')
				.style('position', 'absolute')
				.style('top', scrolltoppad - 25 + 'px')
				.style('transform', 'translate(-3px,0px) rotate(-90deg)')
				.style('width', '25px')

			exportheader.push(dsname + '.#sample')

			let td
			for (const cls of importclass[dsname]) {
				td = tr2
					.append('td')
					.style('font-size', '80%')
					.style('overflow-y', 'hidden')
					.style('height', '0px')
					.style('padding', '0px')
					.style('color', common.mclass[cls.class].color)
					.style('white-space', 'nowrap')
				td.append('div')
					.html(common.mclass[cls.class].label)
					.style('position', 'absolute')
					.style('top', scrolltoppad - 25 + 'px')
					.style('transform', 'translate(-3px,0px) rotate(-90deg)')
					.style('width', '25px')

				exportheader.push(dsname + '.' + common.mclass[cls.class].label)
			}
			if (td) {
				td.style('border-right', impspace)
			}
		}

		exportlines.push(exportheader.join('\t'))

		for (let i = 0; i < genelimit; i++) {
			const gene = genelst[i]

			const exportline = [gene]

			const tr = table.append('tr')
			tr.append('td')
				.text(i + 1)
				.style('font-size', '.7em')
				.style('text-align', 'right')
			for (const at of attrlst) {
				if (at.hide) continue
				if (at.isgenename) {
					tr.append('td')
						.text(genelst[i])
						.attr('class', 'sja_menuoption_y')
						.style('color', 'black')
						.style('display', 'table-cell')
						.on('click', () => {
							paintgene(genelst[i])
						})
					continue
				}
				// no testing?
				let td
				for (const bt of at.atlst) {
					if (bt.hide) continue
					td = tr.append('td').style('color', 'black').style('background-color', '#f1f1f1')
					const m = bt.get(gene)
					if (typeof m == 'number') {
						if (bt.color) {
							if (m > 0) {
								td.style('text-align', 'center')
									.append('span')
									.attr('class', 'sja_mcdot')
									.style('background-color', bt.color)
									.html(m > 1 ? m : '&nbsp;')
							} else {
								td.append('span').attr('class', 'sja_mcdot').style('margin', '0px 4px').html('&nbsp;')
							}
						} else {
							td.text(m)
						}
					} else {
						td.text(m)
					}

					exportline.push(m)
				}
				td.style('border-right', impspace)
			}
			for (const dsname in ds2import) {
				let sample = 0,
					total = 0,
					classsum = {},
					notexist = true,
					pending = false
				if (gene in gene2import) {
					const ipd = gene2import[gene][dsname]
					if (!ipd) continue
					notexist = false
					if (ipd.pending) {
						pending = true
						continue
					}
					sample += ipd.sample
					total += ipd.total
					for (const c in ipd.class) {
						if (!(c in classsum)) {
							classsum[c] = 0
						}
						classsum[c] += ipd.class[c]
					}
				}
				if (notexist) {
					tr.append('td').attr('colspan', 2 + importclass[dsname].length)
					continue
				}
				if (pending) {
					tr.append('td')
						.attr('colspan', 2 + importclass[dsname].length)
						.text('loading ...')
					continue
				}

				tr.append('td').text(total).style('background-color', '#f1f1f1')

				exportline.push(total)

				tr.append('td').text(sample).style('background-color', '#f1f1f1')

				exportline.push(sample)

				let td
				for (const cls of importclass[dsname]) {
					td = tr.append('td').style('text-align', 'center').style('background-color', '#f1f1f1')
					const _count = classsum[cls.class]
					if (_count) {
						td.append('span')
							.attr('class', 'sja_mcdot')
							.style('background-color', common.mclass[cls.class].color)
							.html(_count > 1 ? _count : '&nbsp;')
					} else {
						td.append('span').attr('class', 'sja_mcdot').style('margin', '0px 4px').html('&nbsp;')
					}

					exportline.push(_count)
				}
				td.style('border-right', impspace)
			}

			exportlines.push(exportline.join('\t'))
		}
		return exportlines.join('\n')
	}

	dotable()
	function paintgene(gene) {
		if (!(gene in union)) return
		tip.hide()
		const dslst = []
		for (const k in cohort.dsset) {
			dslst.push(k)
		}
		let pane
		for (const isoform in union[gene].isoform) {
			if (!pane) {
				pane = client.newpane({ x: 100, y: 100 })
			}
			blockinit({
				hostURL: hostURL,
				jwt: cohort.jwt,
				holder: pane.body,
				genome: cohort.genome,
				query: isoform,
				nopopup: true,
				dataset: dslst
			})
		}

		if (cohort.loadgeneexpressionfromofficialds) {
			tp_getgeneexpression({
				gene: gene,
				genome: cohort.genome.name,
				loadgeneexpressionfromofficialds: cohort.loadgeneexpressionfromofficialds,
				hostURL: cohort.hostURL,
				jwt: cohort.jwt,
				x: 1000,
				y: 80
			})
		}
	}
}

async function barplot(bars, color, label, pos) {
	const barplot = await import('./old/plot.barplot')
	return barplot.default(bars, color, label, pos)
}
