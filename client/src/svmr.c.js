import { select as d3select } from 'd3-selection'
import * as client from './client'
import { genomic2gm } from './coord'
import { bplen as bplength } from '#shared/common.js'
import * as unload from './svmr.unload'
import { scaleLinear } from 'd3-scale'
import { axisTop } from 'd3-axis'
import { Menu } from '../dom/menu'

const genomelimit = 10000 // bp distance
const knownprod_c = '#A702C4'
const tip = new Menu()

export default class {
	constructor(genome, atlst, items, filename, holder, hostURL, jwt) {
		window.svmr = this

		this.hostURL = hostURL
		this.jwt = jwt
		this.id = Math.random()
		this.items = items
		this.genome = genome
		this.filename = filename
		this.atlst = atlst
		;(this.cf_repeat = 0.7), (this.cf_reads = 2)
		this.cf_match = 40
		this.cf_ratio = 0.01
		this.expression = {}
		this.samples = []
		this.genelst = []
		this.elab2sample = {} // for detecting recurrence, only when geneA/B are valid

		if (!holder) {
			const pane = client.newpane({ x: 100, y: 100, toshrink: true })
			pane.header.append('span').style('color', '#858585').style('font-size', '.7em').html('Fusion Editor&nbsp;')
			pane.header.append('span').text(filename)
			holder = pane.body
		}
		this.holder = holder
		this.errdiv = holder.append('div').style('width', '500px').style('margin', '10px')
		const butrow = holder.append('div').style('margin', '20px').style('padding', '0px')
		this.buttgene = butrow
			.append('button')
			.text('Loading genes')
			.on('click', () => {
				if (genediv.style('display') == 'none') {
					client.appear(genediv)
				} else {
					client.disappear(genediv)
				}
			})
		this.buttsample = butrow
			.append('button')
			.text('Loading samples')
			.on('click', () => {
				if (this.ul.style('display') == 'none') {
					client.appear(this.ul)
				} else {
					client.disappear(this.ul)
				}
			})
		butrow
			.append('button')
			.text('Gene expression')
			.on('click', () => {
				if (this.expression.div.style('display') == 'none') {
					client.appear(this.expression.div)
				} else {
					client.disappear(this.expression.div)
				}
			})
		butrow
			.append('button')
			.text('Parameter cutoff')
			.on('click', () => {
				if (cutoffdiv.style('display') == 'none') {
					client.appear(cutoffdiv)
				} else {
					client.disappear(cutoffdiv)
				}
			})
		butrow
			.append('button')
			.text('Legend')
			.on('click', () => {
				if (legenddiv.style('display') == 'none') {
					client.appear(legenddiv)
				} else {
					client.disappear(legenddiv)
				}
			})
		butrow
			.append('button')
			.style('margin-right', '20px')
			.text('Export data')
			.on('click', event => {
				// in fact, using Major instead of HQ
				let single_hq = 0,
					multi_hq = 0,
					single_nhq = 0,
					multi_nhq = 0,
					itd_hq = 0,
					itd_nhq = 0,
					trunc_hq = 0,
					trunc_nhq = 0
				for (const sample of this.samples) {
					for (const egg of sample.egglst) {
						for (const eg of egg.lst) {
							if (eg.ismsg) {
								let hashq = false
								for (const i of eg.lst) {
									if (i.rating == 'Major') hashq = true
								}
								if (hashq) multi_hq++
								else multi_nhq++
							} else {
								for (const evt of eg.lst) {
									for (const p of evt.lst) {
										if (p.rating == 'Major') {
											if (p.isitd) itd_hq++
											else if (p.iscloss || p.isnloss) trunc_hq++
											else single_hq++
										} else {
											if (p.isitd) itd_nhq++
											else if (p.iscloss || p.isnloss) trunc_nhq++
											else single_nhq++
										}
									}
								}
							}
						}
					}
				}
				const d0 = tip.clear().showunder(event.target).d.append('div')
				const table = d0.append('table').style('border-spacing', '10px').style('border-collapse', 'separate')
				let tr = table.append('tr').style('color', '#858585')
				tr.append('td')
				tr.append('td').text('2-gene fusion')
				tr.append('td').text('Multi-gene fusion')
				tr.append('td').text('ITD')
				tr.append('td').text('Truncation')
				tr = table.append('tr')
				tr.append('td').text('Major').style('color', '#858585').style('text-align', 'right')
				tr.append('td').text(single_hq)
				tr.append('td').text(multi_hq)
				tr.append('td').text(itd_hq)
				tr.append('td').text(trunc_hq)
				tr = table.append('tr')
				tr.append('td').text('not Major').style('color', '#858585').style('text-align', 'right')
				tr.append('td').text(single_nhq)
				tr.append('td').text(multi_nhq)
				tr.append('td').text(itd_nhq)
				tr.append('td').text(trunc_nhq)
				let dd = d0.append('div').style('margin', '10px').text('Export fusions labeled as "Major"')
				dd.append('button')
					.style('margin', '10px')
					.text('Tabular format')
					.on('click', () => unload.svmr_export_text(this, true))
				dd.append('button')
					.style('margin', '10px')
					.text('JSON format')
					.on('click', () => unload.svmr_export_json(this, true))
				dd.append('button')
					.style('margin', '10px')
					.text('View in ProteinPaint')
					.on('click', () => unload.svmr_2pp(this, true))
				dd = d0.append('div').style('margin', '10px').text('Export all fusions')
				dd.append('button')
					.style('margin', '10px')
					.text('Tabular format')
					.on('click', () => unload.svmr_export_text(this, false))
				dd.append('button')
					.style('margin', '10px')
					.text('JSON format')
					.on('click', () => unload.svmr_export_json(this, false))
				dd.append('button')
					.style('margin', '10px')
					.text('View in ProteinPaint')
					.on('click', () => unload.svmr_2pp(this, false))
			})
		butrow
			.append('a')
			.attr('target', '_blank')
			.attr('href', 'https://docs.google.com/document/d/1DRVzE_WenG490eRYB7VGFOygtSqtF5L97rhK0HOUCNY/edit?usp=sharing')
			.text('Help')
		// expression
		this.expression.div = holder
			.append('div')
			.style('display', 'none')
			.style('margin', '20px')
			.style('padding', '20px')
			.style('border', 'dashed 1px #bbb')
		this.expression.prediv = this.expression.div.append('div')
		this.expression.prediv
			.append('div')
			.style('margin', '5px')
			.text('Load a file that includes gene expression data for current samples.')
		this.expression.prediv
			.append('div')
			.style('margin', '5px 5px 10px 5px')
			.style('font-size', '80%')
			.text('The first 3 columns of the file should be: 1) gene name, 2) expression value, 3) sample name')
		this.expression.input = this.expression.prediv
			.append('input')
			.attr('type', 'file')
			.on('change', event => {
				loadexpression(this, event.target.files[0])
			})
		this.expression.presays = this.expression.prediv.append('span').style('padding-left', '20px')
		this.expression.afterdiv = this.expression.div.append('div').style('display', 'none')
		// gene table
		const genediv = holder.append('div').style('display', 'none').style('margin', '20px')
		let d0 = genediv.append('div').style('display', 'inline-block').style('border', 'dashed 1px #bbb')
		this.genefilter = d0.append('div').style('background-color', '#ededed').style('padding', '10px 20px')
		let d01 = d0
			.append('div')
			.style('padding', '10px 20px')
			.style('overflow-y', 'scroll')
			.style('resize', 'vertical')
			.style('height', '300px')
		d01
			.append('div')
			.style('margin', '10px')
			.style('font-size', '70%')
			.text('Not included: read-through and intergenic events (including one or both sides).')
		this.genetable = d01.append('table')
		// cutoff
		const cutoffdiv = holder.append('div').style('display', 'none').style('margin', '20px')
		d0 = cutoffdiv
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '20px')
			.style('border', 'solid 1px #ededed')
		d0.append('span').style('padding', '0px 10px').text('Alert if:')
		d01 = d0.append('span').style('padding', '0px 10px')
		d01.append('span').html('chimeric reads &le;&nbsp;')
		d01
			.append('input')
			.attr('size', 3)
			.property('value', this.cf_reads)
			.on('change', event => {
				const v = Number.parseInt(event.target.value)
				if (Number.isNaN(v)) {
					return
				}
				this.cf_reads = v
			})
		d01 = d0.append('span').style('padding', '0px 10px')
		d01.append('span').html('repeat score &ge;&nbsp;')
		d01
			.append('input')
			.attr('size', 3)
			.property('value', this.cf_repeat)
			.on('change', event => {
				const v = Number.parseFloat(event.target.value)
				if (Number.isNaN(v)) {
					return
				}
				this.cf_repeat = v
			})
		d01 = d0.append('span').style('padding', '0px 10px')
		d01.append('span').html('contig bp length &le;&nbsp;')
		d01
			.append('input')
			.attr('size', 3)
			.property('value', this.cf_match)
			.on('change', event => {
				const v = Number.parseInt(event.target.value)
				if (Number.isNaN(v)) {
					return
				}
				this.cf_match = v
			})
		d01 = d0.append('span').style('padding', '0px 10px')
		d01.append('span').html('ratio &le;&nbsp;')
		d01
			.append('input')
			.attr('size', 3)
			.property('value', this.cf_ratio)
			.on('change', event => {
				const v = Number.parseFloat(event.target.value)
				if (Number.isNaN(v)) {
					return
				}
				this.cf_ratio = v
			})
		// legend
		const legenddiv = holder.append('div').style('display', 'none').style('margin', '20px')
		var h = 16
		legenddiv
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '10px')
			.style('border', 'solid 1px #ededed')
			.html(
				'<table style="margin:20px">' +
					'<tr><td><div style="display:inline-block;font-size:80%;color:white;background-color:' +
					client.colorinframe +
					';padding:2px 5px">IN</div></td><td>In-frame fusion</td></tr>' +
					'<tr><td><div style="display:inline-block;font-size:80%;color:white;background-color:' +
					client.coloroutframe +
					';padding:2px 5px">O</div></td><td>Out-of-frame fusion</td></tr>' +
					'<tr><td><div style="display:inline-block;font-size:80%;color:black;border:solid 1px black;padding:1px 3px">?</div></td><td>Intergenic fusion, or gene isoform not specified</td></tr>' +
					'</table>' +
					'<table style="margin:20px">' +
					'<tr><td>chr5 <span style="border:solid 1px black;padding:0px 10px;"></span>' +
					'-' +
					'<span style="border:solid 1px black;padding:0px 10px;"></span> chr5</td>' +
					'<td>Intra-chromosomal breakpoints</td></tr>' +
					'<tr><td><span style="color:red">chr5</span> <span style="border:solid 1px black;padding:0px 10px;"></span>' +
					'-' +
					'<span style="border:solid 1px black;padding:0px 10px;"></span> <span style="color:red">chr10</span></td>' +
					'<td>Inter-chromosomal breakpoints</td></tr>' +
					'</tr></table>' +
					'<table style="margin:20px">' +
					'<tr><td><div style="display:inline-block;border:solid 1px black;padding:2px 10px;font-size:70%">geneA</div>' +
					'-' +
					'<div style="display:inline-block;border:solid 1px black;padding:2px 10px;font-size:70%">geneB</div>' +
					'</td><td>Neither geneA nor geneB is known fusion partner</td>' +
					'</tr>' +
					'<tr><td><div style="display:inline-block;border:solid 1px black;padding:2px 10px;font-size:70%;font-weight:bold;">geneA</div>' +
					'-' +
					'<div style="display:inline-block;border:solid 1px black;padding:2px 10px;font-size:70%">geneB</div>' +
					'</td><td>GeneA is a known fusion partner</td>' +
					'</tr>' +
					'<tr><td><div style="display:inline-block;border:solid 1px black;padding:2px 10px;font-size:70%;font-weight:bold;">geneA</div>' +
					'-' +
					'<div style="display:inline-block;border:solid 1px black;padding:2px 10px;font-size:70%;font-weight:bold;">geneB</div>' +
					'</td><td>Both genes are known fusion partners, but they do not make a known fusion product.</td>' +
					'</tr>' +
					'<tr><td><div style="display:inline-block;border:solid 1px black;padding:2px 10px;font-size:70%;font-weight:bold;color:' +
					knownprod_c +
					'">geneA</div>' +
					'-' +
					'<div style="display:inline-block;border:solid 1px black;padding:2px 10px;font-size:70%;font-weight:bold;color:' +
					knownprod_c +
					'">geneB</div>' +
					'</td><td>A known fusion product</td>' +
					'</tr>' +
					'</table>' +
					'<table style="margin:20px">' +
					'<tr><td><div style="width:40px;height:16px;position:relative;">' +
					'<div style="position:absolute;right:0px;top:0px;width:20px;height:16px;background-color:' +
					client.colorbgleft +
					'"></div>' +
					'<div style="position:absolute;border:solid 1px black;width:100%;height:15px"></div>' +
					'</div>' +
					'</td>' +
					'<td>ratioA: for geneA, the ratio of chimeric reads over total reads</td></tr>' +
					'<tr><td><div style="width:40px;height:16px;position:relative;">' +
					'<div style="position:absolute;left:0px;top:0px;width:20px;height:16px;background-color:' +
					client.colorbgright +
					'"></div>' +
					'<div style="position:absolute;border:solid 1px black;width:100%;height:15px"></div>' +
					'</div>' +
					'</td>' +
					'<td>ratioB: for geneB, the ratio of chimeric reads over total reads</td></tr>' +
					'<tr><td><div style="width:40px;height:16px;border:solid 1px red;"></div></td><td>Antisense (reported strand is on the opposite of gene strand)</td></tr>' +
					'</table>'
			)

		this.ul = holder.append('ul') // root of tree

		/*
this.hassample=false
for(const i of atlst) {
	if(i.key=='sample') {
		this.hassample=true
	}
}
*/

		this.step_isoform(items)
	}
	// end of constructor

	err(m) {
		client.sayerror(this.errdiv, m)
	}

	step_isoform(items) {
		// get isoform info ready before showing table
		const newset = new Set()
		for (const item of items) {
			for (const i of item.pairs) {
				let n = i.a.isoform
				if (n && !this.genome.isoformcache.has(n.toUpperCase())) {
					newset.add(n)
				}
				n = i.b.isoform
				if (n && !this.genome.isoformcache.has(n.toUpperCase())) {
					newset.add(n)
				}
			}
		}
		if (newset.size == 0) {
			this.step_eat(items)
			return
		}
		const newisoform = []
		for (const n of newset) {
			newisoform.push(n)
		}
		const wait = this.holder
			.append('div')
			.style('margin', '20px')
			.text('Loading ' + newset.size + ' isoforms ...')

		// FIXME query small amount of isoforms at a time

		fetch(
			new Request(this.hostURL + '/isoformlst', {
				method: 'POST',
				body: JSON.stringify({ genome: this.genome.name, lst: newisoform, jwt: this.jwt })
			})
		)
			.then(data => {
				return data.json()
			})
			.then(data => {
				if (data.error) throw { message: 'Cannot load isoforms: ' + data.error }
				wait.remove()
				for (const ilst of data.lst) {
					if (ilst[0]) {
						this.genome.isoformcache.set(ilst[0].isoform, ilst)
					}
				}
				// invalid isoforms
				const isoformErr = []
				for (const k of newset) {
					if (!this.genome.isoformcache.has(k.toUpperCase())) {
						isoformErr.push(k)
					}
				}
				if (isoformErr.length) {
					this.err(
						isoformErr.length + ' invalid isoform' + (isoformErr.length > 1 ? 's' : '') + ': ' + isoformErr.join(', ')
					)
				}
				this.step_eat(items)
			})
			.catch(err => {
				this.err(err.message)
				if (err.stack) console.log(err.stack)
			})
	}

	step_eat(items) {
		// call after all isoforms loaded
		for (const prod of items) {
			prod.hook = {}
			// set .usepair for product using default isoform
			let use = null
			for (const p of prod.pairs) {
				let gm = this.genome.isoformmatch(p.a.isoform, prod.chrA, prod.posA)
				if (gm) {
					// replaces old geneA label!
					prod.geneA = gm.name
					p.a.isdefault = gm.isdefault
					if (Number.isNaN(p.a.codon) || p.a.codon < 0) {
						p.a.codon = undefined
						const a = genomic2gm(prod.posA, gm)
						if (a.atupstream) {
							p.a.atupstream = a.atupstream
						} else if (a.atdownstream) {
							p.a.atdownstream = a.atdownstream
						} else if (a.atutr3) {
							p.a.atutr3 = a.atutr3
						} else if (a.atutr5) {
							p.a.atutr5 = a.atutr5
						} else {
							p.a.codon = a.codon
						}
					}
				}
				gm = this.genome.isoformmatch(p.b.isoform, prod.chrB, prod.posB)
				if (gm) {
					prod.geneB = gm.name
					p.b.isdefault = gm.isdefault
					if (Number.isNaN(p.b.codon) || p.b.codon < 0) {
						p.b.codon = undefined
						const a = genomic2gm(prod.posB, gm)
						if (a.atupstream) {
							p.b.atupstream = a.atupstream
						} else if (a.atdownstream) {
							p.b.atdownstream = a.atdownstream
						} else if (a.atutr3) {
							p.b.atutr3 = a.atutr3
						} else if (a.atutr5) {
							p.b.atutr5 = a.atutr5
						} else {
							p.b.codon = a.codon
						}
					}
				}
				if (p.a.isdefault && p.b.isdefault) {
					if (!use) {
						// none selected yet
						use = p
					}
					if (p.inframe) {
						// in-frame, must choose, may override previous selected out-of frame pair
						use = p
					}
				}
			}
			if (use) {
				prod.usepair = use
			} else {
				prod.notes.push('No preferred isoform pair')
				prod.usepair = prod.pairs[0] // could be undefined
			}
			if (prod.usepair) {
				prod.usepair.inuse = true
			}
			// geneA/B label ready
			prod.eventlabel = (prod.geneA ? prod.geneA : prod.chrA) + '-' + (prod.geneB ? prod.geneB : prod.chrB)
		}
		// group by sample
		const tmp = {}
		const sampleless = {}
		let hassampleless = false
		for (const prod of items) {
			let n = prod.sample
			if (n) {
				if (!(n in tmp)) {
					tmp[n] = {}
				}
				if (!(prod.eventlabel in tmp[n])) {
					tmp[n][prod.eventlabel] = []
				}
				tmp[n][prod.eventlabel].push(prod)
			} else {
				hassampleless = true
				if (!(prod.eventlabel in sampleless)) {
					sampleless[prod.eventlabel] = []
				}
				sampleless[prod.eventlabel].push(prod)
			}
		}
		for (const sn in tmp) {
			this.samples.push({
				name: sn,
				events: tmp[sn]
			})
		}
		if (hassampleless) {
			this.samples.push({
				name: 'No name',
				events: sampleless
			})
		}
		this.buttsample.text(this.samples.length + ' sample' + (this.samples.length > 1 ? 's' : ''))
		// "samples" done
		// fill in event-to-sample recurrence
		for (const sample of this.samples) {
			// register event label to sample mapping
			for (const elab in sample.events) {
				if (!(elab in this.elab2sample)) {
					this.elab2sample[elab] = []
				}
				this.elab2sample[elab].push(sample)
			}
		}
		// foreach sample, gene to event
		for (const sample of this.samples) {
			sample.gene2events = {}
			for (const elab in sample.events) {
				for (const prod of sample.events[elab]) {
					const a = prod.geneA
					if (a) {
						if (!(a in sample.gene2events)) {
							sample.gene2events[a] = {}
						}
						sample.gene2events[a][elab] = 1
					}
					const b = prod.geneB
					if (b) {
						if (!(b in sample.gene2events)) {
							sample.gene2events[b] = {}
						}
						sample.gene2events[b][elab] = 1
					}
				}
			}
		}
		for (const sample of this.samples) {
			/* group - multi-seg */
			const newholder = []
			// multiple rounds, one rating grade each time
			for (const elab in sample.events) {
				for (const prod of sample.events[elab]) {
					if (prod.rating == 'HQ') msjoin(prod, newholder)
				}
			}
			for (const elab in sample.events) {
				for (const prod of sample.events[elab]) {
					if (prod.rating == 'LQ') msjoin(prod, newholder)
				}
			}
			for (const elab in sample.events) {
				for (const prod of sample.events[elab]) {
					if (prod.rating == 'RT') msjoin(prod, newholder)
				}
			}
			for (const elab in sample.events) {
				for (const prod of sample.events[elab]) {
					if (prod.rating == 'bad') msjoin(prod, newholder)
				}
			}
			// assign id to multi-seg groups
			let msgid = 0
			const msglst = [] // multi-seg groups only
			for (const lst of newholder) {
				if (lst.length > 1) {
					for (const prod of lst) {
						prod.msgid = msgid
					}
					msgid++
					msglst.push(lst)
				}
			}
			/* rating grades */
			const hqin = [], // in frame
				hqt = [], // truncation, including not in-frame fusion
				hqo = [], // others
				lqin = [],
				lqt = [],
				lqo = [],
				rtin = [],
				rtt = [],
				rto = [],
				badin = [],
				badt = [],
				bado = []
			// stuff multi-seg into grades
			for (const msg of msglst) {
				const thisset = []
				// survey through all events in a group, find the highest grade, assign this group to that grade
				let hqin3 = false,
					hqt3 = false,
					hqo3 = false,
					lqin3 = false,
					lqt3 = false,
					lqo3 = false,
					rtin3 = false,
					rtt3 = false,
					rto3 = false,
					badin3 = false,
					badt3 = false,
					bado3 = false
				for (const prod of msg) {
					thisset.push({ label: prod.eventlabel, lst: [prod] })
					const pair = prod.usepair
					if (prod.rating == 'HQ') {
						if (pair) {
							if (pair.inframe) hqin3 = true
							else hqt3 = true
						} else if (prod.isnloss || prod.iscloss) {
							hqt3 = true
						} else {
							hqo3 = true
						}
					} else if (prod.rating == 'LQ') {
						if (pair) {
							if (pair.inframe) lqin3 = true
							else lqt3 = true
						} else if (prod.isnloss || prod.iscloss) {
							lqt3 = true
						} else {
							lqo3 = true
						}
					} else if (prod.rating == 'RT') {
						if (pair) {
							if (pair.inframe) rtin3 = true
							else rtt3 = true
						} else if (prod.isnloss || prod.iscloss) {
							rtt3 = true
						} else {
							rto3 = true
						}
					} else {
						if (pair) {
							if (pair.inframe) badin3 = true
							else badt3 = true
						} else if (prod.isnloss || prod.iscloss) {
							badt3 = true
						} else {
							bado3 = true
						}
					}
				}
				// must only assign after going through all events
				if (hqin3) {
					hqin.push({ label: '', lst: thisset, ismsg: true })
				} else if (hqt3) {
					hqt.push({ label: '', lst: thisset, ismsg: true })
				} else if (hqo3) {
					hqo.push({ label: '', lst: thisset, ismsg: true })
				} else if (lqin3) {
					lqin.push({ label: '', lst: thisset, ismsg: true })
				} else if (lqt3) {
					lqt.push({ label: '', lst: thisset, ismsg: true })
				} else if (lqo3) {
					lqo.push({ label: '', lst: thisset, ismsg: true })
				} else if (rtin3) {
					rtin.push({ label: '', lst: thisset, ismsg: true })
				} else if (rtt3) {
					rtt.push({ label: '', lst: thisset, ismsg: true })
				} else if (rto3) {
					rto.push({ label: '', lst: thisset, ismsg: true })
				} else if (badin3) {
					badin.push({ label: '', lst: thisset, ismsg: true })
				} else if (badt3) {
					badt.push({ label: '', lst: thisset, ismsg: true })
				} else if (bado3) {
					bado.push({ label: '', lst: thisset, ismsg: true })
				} else {
					console.log('multi-seg group unclassfied? ' + key)
				}
			}
			/* group - reciprocal gene pairs */
			const genepairs = {}
			// k: master label, A-B, equivalent with B-A
			// v: {}
			//   k: actual label
			//   v: prod lst
			for (const elab in sample.events) {
				// to hold non-gene-pair products
				const hqin2 = [],
					hqt2 = [],
					hqo2 = [],
					lqin2 = [],
					lqt2 = [],
					lqo2 = [],
					rtin2 = [],
					rtt2 = [],
					rto2 = [],
					badin2 = [],
					badt2 = [],
					bado2 = []
				for (const prod of sample.events[elab]) {
					if (prod.msgid != undefined) {
						continue
					}
					if (prod.geneA && prod.geneB) {
						const key = prod.geneA + '-' + prod.geneB // A/B key
						let hash = genepairs[key]
						if (!hash) {
							// B/A key to match reciprocal event
							const key2 = prod.geneB + '-' + prod.geneA
							hash = genepairs[key2]
						}
						if (hash) {
							// is such hash
							if (!(key in hash)) {
								hash[key] = []
							}
							hash[key].push(prod)
						} else {
							genepairs[key] = {}
							genepairs[key][key] = [prod]
						}
						continue
					}
					// not a gene pair
					var pair = prod.usepair
					// directly to holder
					if (prod.rating == 'HQ') {
						if (pair) {
							if (pair.inframe) hqin2.push(prod)
							else hqt2.push(prod)
						} else if (prod.isnloss || prod.iscloss) {
							hqt2.push(prod)
						} else {
							hqo2.push(prod)
						}
					} else if (prod.rating == 'LQ') {
						if (pair) {
							if (pair.inframe) lqin2.push(prod)
							else lqt2.push(prod)
						} else if (prod.isnloss || prod.iscloss) {
							lqt2.push(prod)
						} else {
							lqo2.push(prod)
						}
					} else if (prod.rating == 'RT') {
						if (pair) {
							if (pair.inframe) rtin2.push(prod)
							else rtt2.push(prod)
						} else if (prod.isnloss || prod.iscloss) {
							rtt2.push(prod)
						} else {
							rto2.push(prod)
						}
					} else {
						if (pair) {
							if (pair.inframe) badin2.push(prod)
							else badt2.push(prod)
						} else if (prod.isnloss || prod.iscloss) {
							badt2.push(prod)
						} else {
							bado2.push(prod)
						}
					}
				}
				// fill-in any non-gene-pairs
				if (hqin2.length > 0) {
					hqin.push({ label: elab, lst: [{ label: elab, lst: hqin2 }] })
				} else if (hqt2.length > 0) {
					hqt.push({ label: elab, lst: [{ label: elab, lst: hqt2 }] })
				} else if (hqo2.length > 0) {
					hqo.push({ label: elab, lst: [{ label: elab, lst: hqo2 }] })
				} else if (lqin2.length > 0) {
					lqin.push({ label: elab, lst: [{ label: elab, lst: lqin2 }] })
				} else if (lqt2.length > 0) {
					lqt.push({ label: elab, lst: [{ label: elab, lst: lqt2 }] })
				} else if (lqo2.length > 0) {
					lqo.push({ label: elab, lst: [{ label: elab, lst: lqo2 }] })
				} else if (rtin2.length > 0) {
					rtin.push({ label: elab, lst: [{ label: elab, lst: rtin2 }] })
				} else if (rtt2.length > 0) {
					rtt.push({ label: elab, lst: [{ label: elab, lst: rtt2 }] })
				} else if (rto2.length > 0) {
					rto.push({ label: elab, lst: [{ label: elab, lst: rto2 }] })
				} else if (badin2.length > 0) {
					badin.push({ label: elab, lst: [{ label: elab, lst: badin2 }] })
				} else if (badt2.length > 0) {
					badt.push({ label: elab, lst: [{ label: elab, lst: badt2 }] })
				} else if (bado2.length > 0) {
					bado.push({ label: elab, lst: [{ label: elab, lst: bado2 }] })
				}
			}
			// for group of gene pairs, assign to rating grades
			for (const key in genepairs) {
				let hqin3 = false,
					hqt3 = false,
					hqo3 = false,
					lqin3 = false,
					lqt3 = false,
					lqo3 = false,
					rtin3 = false,
					rtt3 = false,
					rto3 = false,
					badin3 = false,
					badt3 = false,
					bado3 = false
				const thisset = []
				for (const elab in genepairs[key]) {
					const prodlst = genepairs[key][elab]
					if (prodlst.length == 1) {
						if (prodlst[0].msgid != undefined) {
							continue
						}
					}
					thisset.push({ label: elab, lst: prodlst })
					for (const prod of prodlst) {
						const pair = prod.usepair
						if (prod.rating == 'HQ') {
							if (pair) {
								if (pair.inframe) hqin3 = true
								else hqt3 = true
							} else if (prod.isnloss || prod.iscloss) {
								hqt3 = true
							} else {
								hqo3 = true
							}
						} else if (prod.rating == 'LQ') {
							if (pair) {
								if (pair.inframe) lqin3 = true
								else lqt3 = true
							} else if (prod.isnloss || prod.iscloss) {
								lqt3 = true
							} else {
								lqo3 = true
							}
						} else if (prod.rating == 'RT') {
							if (pair) {
								if (pair.inframe) rtin3 = true
								else rtt3 = true
							} else if (prod.isnloss || prod.iscloss) {
								rtt3 = true
							} else {
								rto3 = true
							}
						} else {
							if (pair) {
								if (pair.inframe) badin3 = true
								else badt3 = true
							} else if (prod.isnloss || prod.iscloss) {
								badt3 = true
							} else {
								bado3 = true
							}
						}
					}
				}
				if (hqin3) {
					hqin.push({ label: key, lst: thisset })
				} else if (hqt3) {
					hqt.push({ label: key, lst: thisset })
				} else if (hqo3) {
					hqo.push({ label: key, lst: thisset })
				} else if (lqin3) {
					lqin.push({ label: key, lst: thisset })
				} else if (lqt3) {
					lqt.push({ label: key, lst: thisset })
				} else if (lqo3) {
					lqo.push({ label: key, lst: thisset })
				} else if (rtin3) {
					rtin.push({ label: key, lst: thisset })
				} else if (rtt3) {
					rtt.push({ label: key, lst: thisset })
				} else if (rto3) {
					rto.push({ label: key, lst: thisset })
				} else if (badin3) {
					badin.push({ label: key, lst: thisset })
				} else if (badt3) {
					badt.push({ label: key, lst: thisset })
				} else if (bado3) {
					bado.push({ label: key, lst: thisset })
				}
			}
			sample.egglst = []
			sample.hqincount = 0
			sample.lqincount = 0
			if (hqin.length) {
				sample.egglst.push({
					htmlab:
						'HQ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="background-color:' +
						client.colorinframe +
						';color:white;padding:1px 3px;font-size:80%;">in-frame&nbsp;&nbsp;</span>',
					lst: hqin
				})
				sample.hqincount = hqin.reduce((i, j) => i + j.lst.length, 0)
			}
			if (hqt.length) {
				sample.egglst.push({
					htmlab:
						'HQ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="background-color:#E3C3C8;padding:1px 3px;font-size:80%;">truncation</span>',
					lst: hqt
				})
			}
			if (hqo.length) {
				sample.egglst.push({
					htmlab:
						'HQ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="background-color:#ccc;padding:1px 3px;font-size:80%;">others&nbsp;&nbsp;&nbsp;&nbsp;</span>',
					lst: hqo
				})
			}
			if (lqin.length) {
				sample.egglst.push({
					htmlab:
						'LQ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="background-color:' +
						client.colorinframe +
						';color:white;padding:1px 3px;font-size:80%;">in-frame&nbsp;&nbsp;</span>',
					lst: lqin
				})
				sample.lqincount = lqin.reduce((i, j) => i + j, 0)
			}
			if (lqt.length) {
				sample.egglst.push({
					htmlab:
						'LQ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="background-color:#E3C3C8;padding:1px 3px;font-size:80%;">truncation</span>',
					lst: lqt
				})
			}
			if (lqo.length) {
				sample.egglst.push({
					htmlab:
						'LQ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="background-color:#ccc;padding:1px 3px;font-size:80%;">others&nbsp;&nbsp;&nbsp;&nbsp;</span>',
					lst: lqo
				})
			}
			if (rtin.length) {
				sample.egglst.push({
					htmlab:
						'Read-through <span style="background-color:' +
						client.colorinframe +
						';color:white;padding:1px 3px;font-size:80%;">in-frame&nbsp;&nbsp;</span>',
					lst: rtin
				})
			}
			if (rtt.length) {
				sample.egglst.push({
					htmlab:
						'Read-through <span style="background-color:#E3C3C8;padding:1px 3px;font-size:80%;">truncation</span>',
					lst: rtt
				})
			}
			if (rto.length) {
				sample.egglst.push({
					htmlab:
						'Read-through <span style="background-color:#ccc;padding:1px 3px;font-size:80%;">others&nbsp;&nbsp;&nbsp;&nbsp;</span>',
					lst: rto
				})
			}
			if (badin.length) {
				sample.egglst.push({
					htmlab:
						'Bad&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="background-color:' +
						client.colorinframe +
						';color:white;padding:1px 3px;font-size:80%;">in-frame</span>',
					lst: badin
				})
			}
			if (badt.length) {
				sample.egglst.push({
					htmlab:
						'Bad&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="background-color:#E3C3C8;padding:1px 3px;font-size:80%;">truncation</span>',
					lst: badt
				})
			}
			if (bado.length) {
				sample.egglst.push({
					htmlab:
						'Bad&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span style="background-color:#ccc;padding:1px 3px;font-size:80%;">others&nbsp;&nbsp;&nbsp;&nbsp;</span>',
					lst: bado
				})
			}
		}
		// sort samples
		this.samples.sort((a, b) => {
			if (a.hqincount == b.hqincount) {
				return b.lqincount - a.lqincount
			}
			return b.hqincount - a.hqincount
		})
		// for each sample
		for (const sample of this.samples) {
			// for each egg (rating grade)
			for (const egg of sample.egglst) {
				// for each event group in an egg
				for (const eg of egg.lst) {
					// for each event
					for (const evt of eg.lst) {
						// sort products in an event
						evt.lst.sort((a, b) => {
							const pa = a.usepair,
								pb = b.usepair
							if (pa) {
								if (pb) {
									if (pa.inframe) {
										if (!pb.inframe) {
											return -1
										}
									} else {
										if (pb.inframe) {
											return 1
										}
									}
								} else {
									return -1
								}
							} else {
								if (pb) {
									return 1
								}
							}
							return b.score - a.score
						})
					}
				}
				// sort groups in an egg/rating grade
				egg.lst.sort((a, b) => {
					// by max score of products for each event group
					if (a.lst.length != b.lst.length) {
						return b.lst.length - a.lst.length
					}
					let scorea = 0
					for (const evta of a.lst) {
						for (const prod of evta.lst) {
							scorea = Math.max(scorea, prod.score)
						}
					}
					let scoreb = 0
					for (const evtb of b.lst) {
						for (const prod of evtb.lst) {
							scoreb = Math.max(scoreb, prod.score)
						}
					}
					return scoreb - scorea
				})
			}
			// assign product id for editing
			let prodid = 1
			for (const egg of sample.egglst) {
				for (const eg of egg.lst) {
					for (const evt of eg.lst) {
						for (const prod of evt.lst) {
							prod.prodid = prodid++
						}
					}
				}
			}
		}
		this.step_gene()
		this.step_table()
	}
	dogenefilter() {
		let va = this.gui.inputa.property('value')
		let vb = this.gui.inputb.property('value')
		if (va.length + vb.length == 0) {
			this.gui.says.text(
				'Showing ' + (this.genelst.length > 100 ? 100 : 'all') + ' of ' + this.genelst.length + ' pairs'
			)
			this.geneshow(this.genelst.length > 100 ? this.genelst.slice(0, 100) : this.genelst)
			return
		}
		va = va.length == 0 ? null : va.toLowerCase()
		vb = vb.length == 0 ? null : vb.toLowerCase()
		const uselst = []
		for (const g of this.genelst) {
			if (va) {
				if (!g.a) continue
				if (g.a.toLowerCase().indexOf(va) == -1) continue
			}
			if (vb) {
				if (!g.b) continue
				if (g.b.toLowerCase().indexOf(vb) == -1) continue
			}
			uselst.push(g)
		}
		this.gui.says.text('Showing ' + Math.min(100, uselst.length) + ' of ' + this.genelst.length + ' pairs')
		this.geneshow(uselst.length > 100 ? uselst.slice(0, 100) : uselst)
	}
	geneshow(lst) {
		this.genetable.selectAll('*').remove()
		const tr = this.genetable.append('tr').style('background-color', '#ededed').style('font-size', '.8em')
		tr.append('td').text('gene A')
		tr.append('td').text('gene B')
		tr.append('td').text('# sample')
		tr.append('td').text('rating')
		for (const evt of lst) {
			let color1 = 'black',
				color2 = 'black',
				weight1,
				weight2
			if (evt.ainter) {
				color1 = '#aaa'
				weight1 = 'normal'
			} else {
				const a = evt.samples[0].prodlst[0].hlgene
				if (a == 1 || a == 3 || a == 4) weight1 = 'bold'
				if (a == 4) color1 = knownprod_c
			}
			if (evt.binter) {
				color2 = '#aaa'
				weight2 = 'normal'
			} else {
				const a = evt.samples[0].prodlst[0].hlgene
				if (a == 2 || a == 3 || a == 4) weight2 = 'bold'
				if (a == 4) color2 = knownprod_c
			}
			const tr = this.genetable.append('tr').attr('class', 'sja_clb')
			tr.append('td').text(evt.a).style('color', color1).style('font-weight', weight1)
			tr.append('td').text(evt.b).style('color', color2).style('font-weight', weight2)
			const td = tr.append('td').text(evt.samples.length)
			tr.on('click', () => {
				const p = tr.node().getBoundingClientRect()
				const pane2 = client.newpane({ x: p.left + p.width + 10, y: p.top })
				pane2.header.text(evt.a + ' - ' + evt.b)
				const table = pane2.body.append('table')
				for (const sample of evt.samples) {
					const tr = table.append('tr')
					tr.append('td').style('vertical-align', 'top').style('padding-top', '5px').text(sample.name)
					const td = tr.append('td')
					for (const prod of sample.prodlst) {
						const logo = this.eventlogo([prod], td)
						logo.style('position', 'relative')
						logo
							.append('div')
							.style('position', 'absolute')
							.style('width', '100%')
							.style('height', '100%')
							.style('top', '0px')
							.style('left', '0px')
							.on('mouseover', event => {
								const p = event.target.getBoundingClientRect()
								tip.clear().show(p.left + p.width - 2, p.top - 30)
								this.showsvpairs({
									prodlst: [prod],
									holder: tip.d.append('div'),
									nodetail: true,
									sample: sample,
									eglst: null,
									showothersample: false
								})
							})
							.on('click', event => {
								const p = event.target.getBoundingClientRect()
								const pane = client.newpane({ x: p.left + p.width + 40, y: p.top - 60 })
								pane.header.text(sample.name)
								this.showsvpairs({
									prodlst: [prod],
									holder: pane.body
								})
							})
					}
				}
			})
			const hash = {}
			for (const smp of evt.samples) {
				const hash2 = {}
				for (const p of smp.prodlst) {
					hash2[p.rating] = 1
				}
				for (var n in hash2) {
					if (!(n in hash)) {
						hash[n] = 0
					}
					hash[n]++
				}
			}
			const lst = []
			for (const smp of ['HQ', 'LQ', 'RT', 'bad']) {
				if (hash[smp]) {
					lst.push(
						'<span style="border-radius:6px;background-color:#ededed;padding:1px 6px;font-size:80%">' +
							smp +
							(hash[smp] > 1 ? ' <span style="font-size:80%">' + hash[smp] + '</span>' : '') +
							'</span>'
					)
				}
			}
			tr.append('td').html(lst.join(' '))
		}
	}
	step_gene() {
		this.gui = {}
		this.genefilter.append('span').text('Filter:')
		this.gui.inputa = this.genefilter
			.append('input')
			.attr('size', 7)
			.attr('placeholder', 'gene A')
			.style('margin-left', '10px')
			.on('keyup', () => this.dogenefilter())
		this.gui.inputb = this.genefilter
			.append('input')
			.attr('size', 7)
			.attr('placeholder', 'gene B')
			.style('margin-left', '10px')
			.on('keyup', () => this.dogenefilter())
		this.genefilter
			.append('button')
			.style('margin-left', '10px')
			.text('Reset')
			.on('click', () => {
				this.gui.inputa.property('value', '')
				this.gui.inputb.property('value', '')
				this.dogenefilter()
			})
		this.gui.says = this.genefilter.append('span').style('padding-left', '20px')
		const events = {}
		const genes = new Set()
		for (const sample of this.samples) {
			for (const k in sample.events) {
				for (const prod of sample.events[k]) {
					// exclude events from showing in gene table
					if (!prod.geneA || !prod.geneB) continue
					if (prod.rating == 'RT') continue
					if (prod.geneA) {
						genes.add(prod.geneA)
					}
					if (prod.geneB) {
						genes.add(prod.geneB)
					}
					const n = (prod.geneA ? prod.geneA : '<' + prod.chrA) + ' - ' + (prod.geneB ? prod.geneB : '<' + prod.chrB)
					if (!(n in events)) {
						events[n] = {}
					}
					if (!(sample.name in events[n])) {
						events[n][sample.name] = []
					}
					events[n][sample.name].push(prod)
				}
			}
		}
		this.buttgene.text(genes.size + ' gene' + (genes.size > 1 ? 's' : ''))
		for (const k in events) {
			const tmp = k.split(' - ')
			const evt = { samples: [] }
			if (tmp[0][0] == '<') {
				evt.a = tmp[0].slice(1, tmp[0].length)
				evt.ainter = true
			} else {
				evt.a = tmp[0]
			}
			if (tmp[1][0] == '<') {
				evt.b = tmp[1].slice(1, tmp[1].length)
				evt.binter = true
			} else {
				evt.b = tmp[1]
			}
			for (const sn in events[k]) {
				evt.samples.push({ name: sn, prodlst: events[k][sn] })
			}
			this.genelst.push(evt)
		}
		this.genelst.sort((a, b) => {
			// sort by hq count
			let ca = 0
			for (const s of a.samples) {
				for (const p of s.prodlst) {
					if (p.rating == 'HQ') ca++
				}
			}
			let cb = 0
			for (const s of b.samples) {
				for (const p of s.prodlst) {
					if (p.rating == 'HQ') cb++
				}
			}
			return cb - ca
		})
		this.dogenefilter()
	}
	step_table() {
		this.eggbar = []
		this.ul.selectAll('*').remove()
		for (const sample of this.samples) {
			this.ul.append('li').style('font-weight', 'bold').style('color', '#545454').text(sample.name)
			sample.ul = this.ul.append('ul').style('margin-bottom', '10px')
			this.showsample(sample)
		}
	}
	showsample(sample) {
		sample.ul.selectAll('*').remove()
		for (const egg of sample.egglst) {
			// one egg: rating grade
			// count number of events
			const evtnum = egg.lst.reduce((i, j) => i + j.lst.length, 0)
			const li = sample.ul.append('li')
			const bar = li
				.append('div')
				.attr('class', 'sja_clb2')
				.html(egg.htmlab + ' ' + evtnum)
			bar.on('click', () => {
				for (const bar0 of this.eggbar) {
					bar0.style('background-color', '')
				}
				bar.style('background-color', 'yellow')
				const next = d3select(li.node().nextSibling)
				if (next.style('display') == 'none') {
					client.appear(next)
					egg.isopen = true
				} else {
					client.disappear(next)
					egg.isopen = false
				}
			})
			this.eggbar.push(bar)
			const div = sample.ul.append('div').style('margin', '10px')
			this.showevents(sample, egg.lst, div)
		}
	}

	showevents(sample, eglst, holder) {
		const svg = holder.append('svg')
		let rowh = 22,
			rowh2 = 15,
			rows = 13,
			fontsize = rowh - 3,
			fontsizeframe = 14,
			fontsizefeature = 10,
			hpad0 = 20,
			hpad = 10,
			vpad = 10,
			gvpad = 10,
			chrAw = 60,
			chrBw = 60,
			s1 = 10,
			s2 = 10,
			s3 = 10,
			s4 = 10,
			s5 = 5,
			s6 = 15,
			s7 = 13,
			eventlogow = 0,
			etw = 25,
			genesp = 12,
			geneAw = 0,
			geneBw = 0,
			recurw = 0,
			graphheight = 0
		for (const eg of eglst) {
			graphheight += rows
			if (eg.lst.length == 1) {
				graphheight += rowh
			} else {
				graphheight += vpad * 2 + (rowh + rows) * eg.lst.length + (rowh2 + rows) * (eg.lst.length - 1) + gvpad
			}
			for (const evt of eg.lst) {
				evt.svg = {} // tmp obj for rendering
				const prodlst = evt.lst
				const prod = prodlst[0]
				let labA, labB
				if (prod.geneA) {
					const t = prod.geneA.split(',')
					if (t.length > 2) {
						labA = t[0] + ',' + t[1] + '...'
					} else {
						labA = prod.geneA
					}
				} else {
					labA = ''
				}
				if (prod.geneB) {
					const t = prod.geneB.split(',')
					if (t.length > 2) {
						labB = t[0] + ',' + t[1] + '...'
					} else {
						labB = prod.geneB
					}
				} else {
					labB = ''
				}
				svg
					.append('text')
					.text(labA)
					.attr('font-size', fontsize)
					.attr('font-family', 'Courier')
					.each(function () {
						geneAw = Math.max(geneAw, this.getBBox().width)
					})
					.remove()
				svg
					.append('text')
					.text(labB)
					.attr('font-size', fontsize)
					.attr('font-family', 'Courier')
					.each(function () {
						geneBw = Math.max(geneBw, this.getBBox().width)
					})
					.remove()
				// event logo
				svg
					.append('text')
					.text(prod.rating)
					.attr('font-size', fontsize)
					.attr('font-family', 'Courier')
					.each(function () {
						evt.svg.ratingw = this.getBBox().width
					})
					.remove()
				evt.svg.framew = 22 // fixed
				evt.svg.typew = 60 // fixed
				if (prod.usepair) {
					evt.svg.frameword = prod.usepair.inframe ? 'IN' : 'O'
				} else {
					evt.svg.frameword = '?'
				}
				svg
					.append('text')
					.text(prod.featureA)
					.attr('font-size', fontsizefeature)
					.attr('font-family', client.font)
					.each(function () {
						evt.svg.featurew = this.getBBox().width
					})
					.remove()
				svg
					.append('text')
					.text(prod.featureB)
					.attr('font-size', fontsizefeature)
					.attr('font-family', client.font)
					.each(function () {
						evt.svg.featurew = Math.max(evt.svg.featurew, this.getBBox().width)
					})
					.remove()
				svg
					.append('text')
					.text(Math.floor(prod.score))
					.attr('font-size', fontsize)
					.attr('font-family', client.font)
					.each(function () {
						evt.svg.scorew = this.getBBox().width
					})
					.remove()
				evt.svg.logow = evt.svg.ratingw + evt.svg.framew + evt.svg.typew + evt.svg.featurew + evt.svg.scorew + s5 * 6
				eventlogow = Math.max(eventlogow, evt.svg.logow + (prodlst.length > 1 ? s4 + etw : 0))
				if (prod.geneA && prod.geneB) {
					const slst = this.elab2sample[evt.label]
					if (!slst) {
						evt.svg.recurtext = 'Recurrence check error'
						evt.svg.recurtextcolor = 'red'
					} else if (slst.length == 1) {
						evt.svg.recurtext = 'No recurrence'
						evt.svg.recurtextcolor = '#aaaaaa'
					} else {
						evt.svg.hasrecurrence = true
						evt.svg.recurtext = 'In ' + slst.length + ' samples'
						evt.svg.recurtextcolor = 'black'
					}
				} else {
					evt.svg.recurtext = 'Unknown recurrence'
					evt.svg.recurtextcolor = '#aaaaaa'
				}
				svg
					.append('text')
					.text(evt.svg.recurtext)
					.attr('font-size', fontsize - 4)
					.attr('font-family', client.font)
					.each(function () {
						evt.svg.recurw = this.getBBox().width
					})
					.remove()
				recurw = Math.max(recurw, evt.svg.recurw)
			}
		}
		geneAw += 10
		geneBw += 10
		graphheight += rows
		let ghandlew = 100
		let roww =
			chrAw +
			s1 +
			rowh +
			s7 +
			geneAw +
			genesp +
			s2 +
			genesp +
			geneBw +
			s7 +
			rowh +
			s1 +
			chrBw +
			s3 +
			eventlogow +
			s6 +
			recurw
		/****************************** render */
		svg.attr('width', hpad0 * 2 + hpad * 2 + roww + ghandlew).attr('height', graphheight)
		const g = svg.append('g').attr('transform', 'translate(' + hpad0 + ',0)')
		let y = 0
		for (const eg of eglst) {
			y += rows
			const g_eg = g.append('g').attr('transform', 'translate(0,' + y + ')')
			const groupheight =
				(rowh + rows) * eg.lst.length -
				rows +
				(eg.lst.length > 1 ? vpad * 2 : 0) +
				(eg.lst.length > 1 ? (rowh2 + rows) * (eg.lst.length - 1) : 0)
			if (eg.lst.length > 1) {
				// group box
				g_eg
					.append('rect')
					.attr('stroke', 'black')
					.attr('stroke-dasharray', eg.ismsg ? 'none' : '2,3')
					.attr('fill', 'none')
					.attr('width', roww + hpad * 2)
					.attr('height', groupheight)
					.attr('shape-rendering', 'crispEdges')
				if (eg.ismsg) {
					const g2 = g_eg.append('g').attr('transform', 'translate(' + (roww + hpad * 2) + ',0)')
					g2.append('rect')
						.attr('width', ghandlew)
						.attr('height', rowh)
						.attr('fill', '#858585')
						.attr('shape-rendering', 'crispEdges')
					g2.append('text')
						.text('multi-seg')
						.attr('x', 10)
						.attr('y', rowh / 2)
						.attr('font-size', rowh - 6)
						.attr('font-family', client.font)
						.attr('fill', 'white')
						.attr('dominant-baseline', 'middle')
					g2.append('rect')
						.attr('width', ghandlew)
						.attr('height', rowh)
						.attr('fill', 'white')
						.attr('fill-opacity', 0)
						.on('click', event => {
							const joinlst = []
							const idlst = []
							for (const evt of eg.lst) {
								const prod = evt.lst[0]
								idlst.push(prod.prodid)
								const p = {
									a: {
										chr: prod.chrA,
										position: prod.posA,
										strand: prod.ortA,
										name: prod.geneA ? prod.geneA : prod.chrA,
										ratio: prod.ratioA.toFixed(2),
										feature: prod.featureA,
										contiglen: prod.matchA,
										chimericreads: prod.readsA,
										repeatscore: prod.repeatA
									},
									b: {
										chr: prod.chrB,
										position: prod.posB,
										strand: prod.ortB,
										name: prod.geneB ? prod.geneB : prod.chrB,
										ratio: prod.ratioB.toFixed(2),
										feature: prod.featureB,
										contiglen: prod.matchB,
										chimericreads: prod.readsB,
										repeatscore: prod.repeatB
									},
									rating: prod.rating,
									score: Math.ceil(prod.score)
								}
								if (prod.usepair) {
									p.inframe = prod.usepair.inframe
									const x = prod.usepair.a
									p.a.gm = this.genome.isoformmatch(x.isoform, p.a.chr, p.a.position)
									p.a.codon = x.codon
									p.a.exon = x.exon
									p.a.atupstream = x.atupstream
									p.a.atdownstream = x.atdownstream
									p.a.atutr5 = x.atutr5
									p.a.atutr3 = x.atutr3
									const y = prod.usepair.b
									p.b.gm = this.genome.isoformmatch(y.isoform, p.b.chr, p.b.position)
									p.b.codon = y.codon
									p.b.exon = y.exon
									p.b.atupstream = y.atupstream
									p.b.atdownstream = y.atdownstream
									p.b.atutr5 = y.atutr5
									p.b.atutr3 = y.atutr3
									// interstitial
									let aalen = 0,
										bplen = 0
									if (x.contigaa && y.contigaa) {
										aalen = y.contigaa - x.contigaa - 1
									}
									if (x.contigbp && y.contigbp) {
										bplen = y.contigbp - x.contigbp - 1
									}
									if (aalen) {
										p.interstitial = { aalen: aalen }
									}
									if (bplen) {
										if (!p.interstitial) p.interstitial = {}
										p.interstitial.bplen = bplen
									}
								}
								joinlst.push(p)
							}
							const p = event.target.getBoundingClientRect()
							const pane = client.newpane({ x: p.left + 10, y: p.top + p.height + 10 })
							const div = pane.body.append('div').style('margin', '10px')
							div
								.append('span')
								.style('padding-right', '20px')
								.text('Product id: ' + idlst.join(', '))
							// break msg
							div
								.append('button')
								.style('margin-right', '10px')
								.text('Break')
								.on('click', () => {
									// find array index of group eg
									const eg2id = eg.lst.map(j => j.lst[0].prodid)
									let idx = 0
									for (; idx < eglst.length; idx++) {
										const eg2 = eglst[idx]
										if (eg2.ismsg) {
											const eg22id = eg2.lst.map(j => j.lst[0].prodid)
											if (eg22id.join(',') == eg2id.join(',')) {
												break
											}
										}
									}
									// break group
									delete eg.ismsg
									const oldlst = eg.lst
									eg.lst = [eg.lst[0]]
									for (let j = 1; j < oldlst.length; j++) {
										eglst.splice(idx, 0, {
											label: '',
											lst: [oldlst[j]]
										})
									}
									// remake graph
									svg.remove()
									this.showevents(sample, eglst, holder)
									// done
									pane.pane.remove()
								})
							// edit msg
							div
								.append('button')
								.text('Edit')
								.on('click', event => {
									const inputdom = document.createElement('input')
									div.node().insertBefore(inputdom, event.target)
									const buttdom = document.createElement('button')
									div.node().insertBefore(buttdom, event.target)
									div.node().removeChild(event.target)
									inputdom.focus()
									const input = d3select(inputdom)
									const butt = d3select(buttdom)
									input.attr('size', 10).style('margin', '0px 10px').property('value', idlst.join(','))
									butt.text('Apply').on('click', () => {
										const lst0 = inputdom.value.trim().split(',')
										const goodid = []
										for (const s of lst0) {
											if (!s) continue
											const j = Number.parseInt(s)
											if (Number.isNaN(j)) return alert('invalid id: ' + s)
											if (this.prodidisinvalid(j, sample)) return alert('invalid id ' + j)
											goodid.push(j)
										}
										if (goodid.length <= 1) return alert('must be at least 2 products')
										const newevtlst = []
										for (const id of goodid) {
											const lookprod = this.extractprod(id, sample)
											if (lookprod) {
												newevtlst.push({ label: lookprod.eventlabel, lst: [lookprod] })
											} else {
												return alert('unknown product id ' + id)
											}
										}
										if (newevtlst.length <= 1) return alert('less than 2 products cannot make a group')
										eglst.unshift({ lst: newevtlst, ismsg: true })
										// remake entire sample
										this.showsample(sample)
										// done
										pane.pane.remove()
									})
								})
							svtable({
								samplelst: [
									{
										pairlst: joinlst
									}
								],
								nosample: true,
								holder: pane.body
							})

							const par = {
								pairlst: joinlst,
								genome: this.genome,
								holder: pane.body,
								hostURL: this.hostURL,
								jwt: this.jwt
							}
							import('./svgraph').then(p => {
								p.default(par)
							})
						})
				}
				// end of event group business
			}
			const g_rows = g_eg
				.append('g')
				.attr('transform', 'translate(' + hpad + ',' + (eg.lst.length > 1 ? vpad : 0) + ')')
			let y1 = 0
			let evtid = 0
			const bgcolor = '#ededed'
			// collect event labels in this group, for subtracting out *this event* when showing external events
			const elabhash = {}
			for (const e of eg.lst) {
				elabhash[e.label] = 1
			}
			// collect shown gene names, shown genes won't display tips (ext events) to avoid duplication
			const showngenenotip = {}
			for (const evt of eg.lst) {
				const prodlst = evt.lst
				const prod = prodlst[0]
				const thispair = prod.usepair
				if (eg.lst.length > 1 && evtid > 0) {
					// marker in-the-middle row inside a group
					const g_row = g_rows
						.append('g')
						.attr('transform', 'translate(' + (chrAw + s1 + rowh + s7 + geneAw + genesp + s2 / 2) + ',' + y1 + ')')
					const text = g_row
						.append('text')
						.attr('fill', '#858585')
						.attr('font-size', rowh2)
						.attr('text-anchor', 'middle')
						.attr('font-family', client.font)
						.attr('y', rowh2 / 2)
						.attr('dominant-baseline', 'middle')
					if (eg.ismsg) {
						text.text(prod.mswhat ? prod.mswhat : 'No connection detail')
					} else {
						text.text('Reciprocal')
					}
					y1 += rowh2 + rows
				}
				const textcolor = prod.chrA == prod.chrB ? 'black' : client.colorctx
				const g_row = g_rows.append('g').attr('transform', 'translate(0,' + y1 + ')')
				// chr a
				g_row
					.append('text')
					.text(prod.chrA)
					.attr('x', chrAw)
					.attr('y', rowh / 2)
					.attr('font-size', fontsize - 4)
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'middle')
					.attr('fill', textcolor)
				const extevt = { a: null, b: null }
				if (prod.geneA) {
					if (prod.geneA in showngenenotip) {
						showngenenotip[prod.geneA] = 1
					} else {
						const lst = []
						for (const elab in sample.gene2events[prod.geneA]) {
							if (!(elab in elabhash)) {
								lst.push(elab)
							}
						}
						if (lst.length > 0) {
							extevt.a = { lst: lst }
							// gene a tip
							extevt.a.circle = g_row
								.append('circle')
								.attr('fill', 'white')
								.attr('stroke', 'black')
								.attr('cx', chrAw + s1 + rowh / 2)
								.attr('cy', rowh / 2)
								.attr('r', rowh / 2)
							if (lst.length > 1) {
								extevt.a.text = g_row
									.append('text')
									.text(lst.length)
									.attr('x', chrAw + s1 + rowh / 2)
									.attr('y', rowh / 2)
									.attr('text-anchor', 'middle')
									.attr('font-size', rowh2)
									.attr('dominant-baseline', 'middle')
									.attr('fill', 'black')
							}
							g_row
								.append('line')
								.attr('x1', chrAw + s1 + rowh)
								.attr('x2', chrAw + s1 + rowh + s7)
								.attr('y1', rowh / 2)
								.attr('y2', rowh / 2)
								.attr('stroke', 'black')
								.attr('shape-rendering', 'crispEdges')
						}
					}
				}
				// ratio a
				g_row
					.append('rect')
					.attr('fill', client.colorbgleft)
					.attr('x', chrAw + s1 + rowh + s7 + (geneAw + genesp) * (1 - prod.ratioA))
					.attr('width', (geneAw + genesp) * prod.ratioA)
					.attr('height', rowh)
					.attr('shape-rendering', 'crispEdges')
				let antisense = false
				if (thispair) {
					const thisn = thispair.a.isoform
					if (thisn) {
						const _gm = this.genome.isoformmatch(thisn, prod.chrA, prod.posA)
						if (_gm && _gm.strand != prod.ortA) {
							// gene a antisense
							antisense = true
						}
					}
				}
				// gene a box
				const boxa = g_row
					.append('rect')
					.attr('fill', 'none')
					.attr('stroke', antisense ? 'red' : 'black')
					.attr('shape-rendering', 'crispEdges')
					.attr('x', chrAw + s1 + rowh + s7)
					.attr('width', geneAw + genesp)
					.attr('height', rowh)
				// name a
				let labA
				if (prod.geneA) {
					const t = prod.geneA.split(',')
					if (t.length > 2) {
						labA = t[0] + ',' + t[1] + '...'
					} else {
						labA = prod.geneA
					}
				} else {
					labA = ''
				}
				// gene a label
				g_row
					.append('text')
					.text(labA)
					.attr('x', chrAw + s1 + rowh + s7 + geneAw)
					.attr('y', rowh / 2)
					.attr('font-size', fontsize)
					.attr('font-family', 'Courier')
					.attr(
						'font-weight',
						prod.hlgene ? (prod.hlgene == 1 || prod.hlgene == 3 || prod.hlgene == 4 ? 'bold' : 'normal') : 'normal'
					)
					.attr('fill', prod.hlgene ? (prod.hlgene == 4 ? knownprod_c : '#545454') : '#545454')
					.attr('text-anchor', 'end')
					.attr('dominant-baseline', 'central')
				// a-b conn
				g_row
					.append('line')
					.attr('x1', chrAw + s1 + rowh + s7 + geneAw + genesp)
					.attr('x2', chrAw + s1 + rowh + s7 + geneAw + genesp + s2)
					.attr('y1', rowh / 2)
					.attr('y2', rowh / 2)
					.attr('shape-rendering', 'crispEdges')
					.attr('stroke', 'black')
				// ratio b
				g_row
					.append('rect')
					.attr('fill', client.colorbgright)
					.attr('x', chrAw + s1 + rowh + s7 + geneAw + genesp + s2)
					.attr('width', (genesp + geneBw) * prod.ratioB)
					.attr('height', rowh)
					.attr('shape-rendering', 'crispEdges')
				antisense = false
				if (thispair) {
					const thisn = thispair.b.isoform
					if (thisn) {
						const _gm = this.genome.isoformmatch(thisn, prod.chrB, prod.posB)
						if (_gm && _gm.strand != prod.ortB) {
							// gene b antisense
							antisense = true
						}
					}
				}
				// gene b box
				const boxb = g_row
					.append('rect')
					.attr('fill', 'none')
					.attr('stroke', antisense ? 'red' : 'black')
					.attr('shape-rendering', 'crispEdges')
					.attr('x', chrAw + s1 + rowh + s7 + geneAw + genesp + s2)
					.attr('width', geneBw + genesp)
					.attr('height', rowh)
				// name b
				let labB
				if (prod.geneB) {
					let t = prod.geneB.split(',')
					if (t.length > 2) {
						labB = t[0] + ',' + t[1] + '...'
					} else {
						labB = prod.geneB
					}
				} else {
					labB = ''
				}
				// gene b label
				g_row
					.append('text')
					.text(labB)
					.attr('x', chrAw + s1 + rowh + s7 + geneAw + genesp + s2 + genesp)
					.attr('y', rowh / 2)
					.attr('font-size', fontsize)
					.attr('font-family', 'Courier')
					.attr(
						'font-weight',
						prod.hlgene ? (prod.hlgene == 2 || prod.hlgene == 3 || prod.hlgene == 4 ? 'bold' : 'normal') : 'normal'
					)
					.attr('fill', prod.hlgene ? (prod.hlgene == 4 ? knownprod_c : '#545454') : '#545454')
					.attr('dominant-baseline', 'central')
				if (prod.geneB) {
					if (prod.geneB in showngenenotip) {
					} else {
						showngenenotip[prod.geneB] = 1
						const lst = []
						for (const elab in sample.gene2events[prod.geneB]) {
							if (!(elab in elabhash)) {
								lst.push(elab)
							}
						}
						if (lst.length > 0) {
							extevt.b = { lst: lst }
							// gene b tip
							extevt.b.circle = g_row
								.append('circle')
								.attr('fill', 'white')
								.attr('stroke', 'black')
								.attr('cx', chrAw + s1 + rowh + s7 + geneAw + genesp + s2 + genesp + geneBw + s7 + rowh / 2)
								.attr('cy', rowh / 2)
								.attr('r', rowh / 2)
							if (lst.length > 1) {
								extevt.b.text = g_row
									.append('text')
									.text(lst.length)
									.attr('x', chrAw + s1 + rowh + s7 + geneAw + genesp + s2 + genesp + geneBw + s7 + rowh / 2)
									.attr('y', rowh / 2)
									.attr('text-anchor', 'middle')
									.attr('font-size', rowh2)
									.attr('dominant-baseline', 'middle')
									.attr('fill', 'black')
							}
							g_row
								.append('line')
								.attr('x1', chrAw + s1 + rowh + s7 + geneAw + genesp + s2 + genesp + geneBw)
								.attr('x2', chrAw + s1 + rowh + s7 + geneAw + genesp + s2 + genesp + geneBw + s7)
								.attr('y1', rowh / 2)
								.attr('y2', rowh / 2)
								.attr('stroke', 'black')
								.attr('shape-rendering', 'crispEdges')
						}
					}
				}
				// chr b
				g_row
					.append('text')
					.text(prod.chrB)
					.attr('x', chrAw + s1 + rowh + s7 + geneAw + genesp + s2 + genesp + geneBw + s7 + rowh + s1)
					.attr('y', rowh / 2)
					.attr('font-size', fontsize - 4)
					.attr('dominant-baseline', 'middle')
					.attr('fill', textcolor)
				// event logo
				let x = chrAw + s1 + rowh + s7 + geneAw + genesp + s2 + genesp + geneBw + s7 + rowh + s1 + chrBw + s3
				const x0 = x
				const logobg = g_row
					.append('rect')
					.attr('fill', 'white')
					.attr('stroke', '#858585')
					.attr('x', x)
					.attr('y', -1.5)
					.attr('width', evt.svg.logow)
					.attr('height', rowh + 2)
					.attr('rx', 5)
					.attr('ry', 5)
				x += s5
				prod.hook.mainRating = g_row
					.append('text')
					.text(prod.rating)
					.attr('font-size', fontsize)
					.attr('font-family', client.font)
					.attr('fill', '#858585')
					.attr('x', x)
					.attr('y', rowh / 2)
					.attr('dominant-baseline', 'middle')
				x += evt.svg.ratingw + s5
				prod.hook.mainFrame = {}
				prod.hook.mainFrame.bg = g_row
					.append('rect')
					.attr('x', x + 1)
					.attr('y', 3)
					.attr('width', evt.svg.framew)
					.attr('height', rowh - 7)
					.attr('shape-rendering', 'crispEdges')
				if (prod.usepair) {
					prod.hook.mainFrame.bg.attr('fill', prod.usepair.inframe ? client.colorinframe : client.coloroutframe)
				} else {
					prod.hook.mainFrame.bg.attr('fill', 'none').attr('stroke', 'black')
				}
				prod.hook.mainFrame.text = g_row
					.append('text')
					.text(evt.svg.frameword)
					.attr('font-size', fontsizeframe)
					.attr('font-family', client.font)
					.attr('fill', prod.usepair ? 'white' : 'black')
					.attr('x', x + 1 + evt.svg.framew / 2)
					.attr('text-anchor', 'middle')
					.attr('y', rowh / 2)
					.attr('dominant-baseline', 'middle')
				x += evt.svg.framew + s5
				prod.hook.mainType = g_row
					.append('text')
					.text(prod.type2)
					.attr('font-size', fontsize)
					.attr('font-family', client.font)
					.attr('fill', '#858585')
					.attr('x', x)
					.attr('y', rowh / 2)
					.attr('dominant-baseline', 'middle')
				x += evt.svg.typew + s5
				g_row
					.append('text')
					.text(prod.featureA)
					.attr('font-size', fontsizefeature)
					.attr('font-family', client.font)
					.attr('fill', 'black')
					.attr('x', x)
					.attr('y', rowh / 4)
					.attr('dominant-baseline', 'middle')
				g_row
					.append('text')
					.text(prod.featureB)
					.attr('font-size', fontsizefeature)
					.attr('font-family', client.font)
					.attr('fill', 'black')
					.attr('x', x)
					.attr('y', (rowh * 3) / 4)
					.attr('dominant-baseline', 'middle')
				x += evt.svg.featurew + s5
				g_row
					.append('text')
					.text(Math.floor(prod.score))
					.attr('font-size', fontsize)
					.attr('font-family', client.font)
					.attr('fill', '#858585')
					.attr('x', x)
					.attr('y', rowh / 2)
					.attr('dominant-baseline', 'middle')
				x += evt.svg.scorew + s5 + s4
				// logo kick
				g_row
					.append('rect')
					.attr('fill', 'white')
					.attr('fill-opacity', 0)
					.attr('stroke', 'none')
					.attr('x', x0)
					.attr('y', -1.5)
					.attr('width', evt.svg.logow)
					.attr('height', rowh + 2)
					.on('mouseover', () => {
						logobg.attr('stroke-width', '2')
						const d = tip.clear().showunder(logobg.node()).d.append('div')
						this.prodstat(prod, d)
					})
					.on('mouseout', () => {
						logobg.attr('stroke-width', '1')
						tip.hide()
					})
				if (prodlst.length > 1) {
					const logobg2 = g_row
						.append('rect')
						.attr('fill', 'none')
						.attr('stroke', '#858585')
						.attr('x', x)
						.attr('y', 3.5)
						.attr('width', etw)
						.attr('height', rowh - 4)
						.attr('rx', 5)
						.attr('ry', 5)
					g_row
						.append('text')
						.text(prodlst.length - 1)
						.attr('fill', 'black')
						.attr('font-size', fontsizefeature)
						.attr('font-family', client.font)
						.attr('x', x + etw / 2)
						.attr('y', 3.5 + (rowh - 3.5) / 2)
						.attr('text-anchor', 'middle')
						.attr('dominant-baseline', 'middle')
					g_row
						.append('rect')
						.attr('fill', 'white')
						.attr('fill-opacity', 0)
						.attr('x', x)
						.attr('y', 3.5)
						.attr('width', etw)
						.attr('height', rowh - 4)
						.on('mouseover', event => {
							logobg2.attr('stroke-width', '2')
							const table = tip
								.clear()
								.showunder(event.target)
								.d.append('table')
								.style('border-spacing', '10px')
								.style('border-collapse', 'separate')
							const tr1 = table.append('tr')
							const tr2 = table.append('tr')
							for (var k = 1; k < prodlst.length; k++) {
								this.eventlogo([prodlst[k]], tr1.append('td'))
								this.prodstat(prodlst[k], tr2.append('td'))
							}
						})
						.on('mouseout', () => {
							logobg2.attr('stroke-width', '1')
							tip.hide()
						})
				}
				// recurrence
				x =
					chrAw +
					s1 +
					rowh +
					s7 +
					geneAw +
					genesp +
					s2 +
					genesp +
					geneBw +
					s7 +
					rowh +
					s1 +
					chrBw +
					s3 +
					eventlogow +
					s6
				const text = g_row
					.append('text')
					.text(evt.svg.recurtext)
					.attr('font-size', fontsize - 4)
					.attr('font-family', client.font)
					.attr('fill', evt.svg.recurtextcolor)
					.attr('x', x)
					.attr('y', rowh / 2)
					.attr('dominant-baseline', 'middle')
				if (evt.svg.hasrecurrence) {
					text
						.attr('class', 'sja_svgtext2')
						.on('mouseover', event => {
							const p = event.target.getBoundingClientRect()
							tip.clear().show(p.left + p.width + 10, p.top - 15)
							const slst = this.elab2sample[evt.label]
							const dd = tip.d
							dd.append('div')
								.style('margin', '10px')
								.style('color', '#aaa')
								.text('This fusion is recurrent in other samples:')
							const table = dd.append('table').style('border-spacing', '10px').style('border-collapse', 'separate')
							for (const s of slst) {
								if (s.name == sample.name) {
									// self, no show
									continue
								}
								const tr = table.append('tr')
								tr.append('td').style('font-weight', 'bold').style('color', '#858585').text(s.name)
								this.eventlogo(s.events[evt.label], tr.append('td'))
							}
						})
						.on('mouseout', () => tip.hide())
				}
				// row kick
				g_row
					.append('rect')
					.attr('x', chrAw + s1 + rowh + s7)
					.attr('width', geneAw + genesp + s2 + genesp + geneBw)
					.attr('height', rowh)
					.attr('fill', 'white')
					.attr('fill-opacity', 0)
					.on('mouseover', event => {
						boxa.attr('stroke-width', 2)
						boxb.attr('stroke-width', 2)
						/* old behavior to remember the one under highlight and not to re-show tip on it
						if (evt.inview) return
						for (const eg2 of eglst) {
							for (const e2 of eg2.lst) {
								e2.inview = false
							}
						}
						evt.inview = true
						d3select(document.body).on('mousedown', () => (evt.inview = false))
						*/
						const p = event.target.getBoundingClientRect()
						tip.clear().show(p.left + p.width + s7 / 2, p.top - 30)
						this.showsvpairs({
							prodlst: evt.lst,
							holder: tip.d,
							nodetail: true,
							sample: sample,
							eglst: eglst,
							showothersample: true
						})
					})
					.on('mouseout', () => {
						tip.hide()
						boxa.attr('stroke-width', 1)
						boxb.attr('stroke-width', 1)
					})
					.on('click', event => {
						if (evt.inclick) {
							// shake
							return
						}
						evt.inclick = true
						const p = event.target.getBoundingClientRect()
						const pane3 = client.newpane({
							x: p.left + p.width + s7 + rowh + s1 + chrBw + s3 + eventlogow + s6 + recurw + 5,
							y: p.top - 100,
							close: function () {
								evt.inclick = false
								pane3.pane.remove()
							}
						})
						const prod = evt.lst[0]
						pane3.header.html(
							'<span style="padding:2px 4px;background-color:' +
								client.colorbgleft +
								';">' +
								(prod.geneA ? prod.geneA : prod.chrA) +
								'</span>' +
								'<span style="padding:2px 4px;background-color:' +
								client.colorbgright +
								';">' +
								(prod.geneB ? prod.geneB : prod.chrB) +
								'</span>'
						)
						this.showsvpairs({
							prodlst: evt.lst,
							holder: pane3.body
						})
					})
				// external events for a, kick
				if (extevt.a) {
					g_row
						.append('circle')
						.attr('cx', chrAw + s1 + rowh / 2)
						.attr('cy', rowh / 2)
						.attr('r', rowh / 2)
						.attr('fill', 'white')
						.attr('fill-opacity', 0)
						.on('mouseover', event => this.extevt_mover(extevt.a, event.target, sample))
						.on('mouseout', () => {
							this.extevt_mo(extevt.a)
							tip.hide()
						})
						.on('click', event => {
							this.extevt_c(extevt.a, event.target, sample)
						})
				}
				if (extevt.b) {
					g_row
						.append('circle')
						.attr('cx', chrAw + s1 + rowh + s7 + geneAw + genesp + s2 + genesp + geneBw + s7 + rowh / 2)
						.attr('cy', rowh / 2)
						.attr('r', rowh / 2)
						.attr('fill', 'white')
						.attr('fill-opacity', 0)
						.on('mouseover', event => this.extevt_mover(extevt.b, event.target, sample))
						.on('mouseout', () => {
							this.extevt_mo(extevt.b)
							tip.hide()
						})
						.on('click', event => this.extevt_c(extevt.b, event.target, sample))
				}
				y1 += rowh + rows
				evtid++
			}
			y += groupheight + (eg.lst.length > 1 ? gvpad : 0)
		}
		holder.style('display', 'none')
	}

	extevt_mover(ext, dom, sample) {
		ext.circle.attr('fill', '#858585')
		if (ext.text) {
			ext.text.attr('fill', 'white')
		}
		tip.clear().showunder(dom)
		tip.d.append('div').style('margin', '10px').style('color', '#aaa').text('Associated fusions from this sample:')
		this.extevt_table(ext.lst, tip.d, sample)
	}
	extevt_mo(ext) {
		ext.circle.attr('fill', 'white')
		if (ext.text) {
			ext.text.attr('fill', 'black')
		}
	}
	extevt_c(ext, dom, sample) {
		const p = dom.getBoundingClientRect()
		const pane = client.newpane({ x: p.left, y: p.top + p.height + 10 })
		this.extevt_table(ext.lst, pane.body, sample)
	}
	extevt_table(lst, holder, sample) {
		const table = holder.append('table').style('border-spacing', '10px').style('border-collapse', 'separate')
		for (const elab of lst) {
			const tr = table.append('tr')
			const prodlst = sample.events[elab]
			if (!prodlst) {
				tr.append('<td colspan=2 style="color:red">No products found for ' + elab + '</td>')
				continue
			}
			const prod = prodlst[0]
			tr.append('td')
				.style('text-align', 'right')
				.text(prod.geneA ? prod.geneA : prod.chrA)
			tr.append('td').text(prod.geneB ? prod.geneB : prod.chrB)
			this.eventlogo(prodlst, tr.append('td'))
		}
	}
	eventlogo(prodlst, holder) {
		const d = holder.append('div')
		if (!prodlst || prodlst.length == 0) {
			d.style('color', 'red').text('No products')
		} else {
			const p = prodlst[0]
			d.append('div')
				.style('display', 'inline-block')
				.style('padding', '2px 4px')
				.style('border', 'solid 1px #858585')
				.style('border-radius', '5px')
				.html(
					p.rating +
						'&nbsp;' +
						'<span style="font-size:70%;vertical-align:2px;' +
						(p.usepair
							? p.usepair.inframe
								? 'padding:2px 4px;background-color:' + client.colorinframe + ';color:white;">IN'
								: 'padding:2px 4px;background-color:' + client.coloroutframe + ';color:white;">O'
							: 'padding:1px 3px;border:solid 1px black;background-color:white;color:black;">?') +
						'</span>' +
						'&nbsp;<span style="color:#858585">' +
						p.type2 +
						'</span>&nbsp;' +
						'<div style="display:inline-block;font-size:70%;line-height:.9">' +
						p.featureA +
						'<br>' +
						p.featureB +
						'</div>' +
						'&nbsp;' +
						Math.floor(p.score)
				)
			if (prodlst.length > 1) {
				d.append('div')
					.style('display', 'inline-block')
					.style('margin-left', '10px')
					.style('padding', '2px 4px')
					.style('font-size', '.7em')
					.style('border', 'solid 1px #858585')
					.style('border-radius', 5)
					.text(prodlst.length - 1)
			}
		}
		return d
	}

	prodstat(prod, holder) {
		holder.append('p').text('Product id: ' + prod.prodid)
		const alertcolor = '#FFb3b3',
			bg = '#f1f1f1'
		const table = holder.append('table').style('border-spacing', '8px').style('border-collapse', 'separate')
		let tr = table.append('tr')
		tr.append('td')
		tr.append('td')
			.style('background-color', bg)
			.text(prod.geneA ? prod.geneA : prod.chrA)
		tr.append('td')
			.style('background-color', bg)
			.text(prod.geneB ? prod.geneB : prod.chrB)
		tr = table.append('tr')
		tr.append('td').style('font-size', '80%').style('background-color', bg).text('chimeric reads')
		tr.append('td')
			.style('padding', '5px')
			.style('background-color', prod.readsA <= this.cf_reads ? alertcolor : '')
			.text(prod.readsA)
		tr.append('td')
			.style('padding', '5px')
			.style('background-color', prod.readsB <= this.cf_reads ? alertcolor : '')
			.text(prod.readsB)
		tr = table.append('tr')
		tr.append('td').style('font-size', '80%').style('background-color', bg).text('ratio')
		tr.append('td')
			.style('padding', '5px')
			.style('background-color', prod.ratioA <= this.cf_ratio ? alertcolor : '')
			.text(Math.ceil(prod.ratioA * 100) + '%')
		tr.append('td')
			.style('padding', '5px')
			.style('background-color', prod.ratioB <= this.cf_ratio ? alertcolor : '')
			.text(Math.ceil(prod.ratioB * 100) + '%')
		tr = table.append('tr')
		tr.append('td').style('font-size', '80%').style('background-color', bg).text('contig length')
		tr.append('td')
			.style('padding', '5px')
			.style('background-color', prod.matchA <= this.cf_match ? alertcolor : '')
			.text(prod.matchA + ' bp')
		tr.append('td')
			.style('padding', '5px')
			.style('background-color', prod.matchB <= this.cf_match ? alertcolor : '')
			.text(prod.matchB + ' bp')
		tr = table.append('tr')
		tr.append('td').style('font-size', '80%').style('background-color', bg).text('repeat score')
		tr.append('td')
			.style('padding', '5px')
			.style('background-color', prod.repeatA >= this.cf_repeat ? alertcolor : '')
			.text(prod.repeatA)
		tr.append('td')
			.style('padding', '5px')
			.style('background-color', prod.repeatB >= this.cf_repeat ? alertcolor : '')
			.text(prod.repeatB)
	}

	showsvpairs(arg) {
		// individual pairs show separately
		const table = arg.holder.append('table').style('border-spacing', '10px').style('border-collapse', 'separate')
		const tr = table.append('tr')
		const _tr = table.append('tr')
		const expressiontd = _tr.append('td').attr('colspan', arg.prodlst.length)
		const tr2 = table.append('tr')
		// collect genes for showing expression
		const geneset = new Set()
		for (const prod of arg.prodlst) {
			if (prod.geneA) {
				geneset.add(prod.geneA)
			}
			if (prod.geneB) {
				geneset.add(prod.geneB)
			}
			const td = tr.append('td').style('vertical-align', 'top')
			// edit function
			if (arg.nodetail) {
				const div = td.append('div')
				div
					.append('span')
					.style('padding-right', '20px')
					.text('Product id: ' + prod.prodid)
				const ratingsl = div
					.append('select')
					.style('margin-right', '5px')
					.on('change', event => {
						const sl = event.target
						const newv = sl.options[sl.selectedIndex].innerHTML
						prod.rating = newv
						if (prod.hook.mainRating) {
							prod.hook.mainRating.text(newv)
						}
						if (prod.hook.lessRating) {
							prod.hook.lessRating.text(newv)
						}
					})
				const framesl = div
					.append('select')
					.style('margin-right', '5px')
					.on('change', event => {
						const sl = event.target
						const inframe = sl.options[sl.selectedIndex].innerHTML == 'in-frame'
						prod.usepair.inframe = inframe
						if (prod.hook.mainFrame) {
							prod.hook.mainFrame.text.text(inframe ? 'IN' : 'O')
							prod.hook.mainFrame.bg.attr('fill', inframe ? client.colorinframe : client.coloroutframe)
						}
						if (prod.hook.lessFrame) {
							prod.hook.lessFrame.html(
								inframe
									? '<span style="background-color:' +
											client.colorinframe +
											';color:white;padding:2px 3px;font-size:80%;white-space:nowrap">In frame</span>'
									: '<span style="background-color:' +
											client.coloroutframe +
											';color:white;padding:2px 3px;font-size:80%;white-space:nowrap">Out of frame</span>'
							)
						}
					})
				const typesl = div
					.append('select')
					.style('margin-right', '5px')
					.on('change', event => {
						const sl = event.target
						const i = sl.selectedIndex
						const newv = sl.options[i].innerHTML
						prod.type2 = newv
						if (prod.hook.mainType) {
							prod.hook.mainType.text(newv)
						}
						prod.iscloss = i == 0
						prod.isnloss = i == 1
						prod.isfusion = i == 2
						prod.isitd = i == 3
						prod.isuptss = i == 4
						prod.isother = i == 5
					})
				const effectsl = div
					.append('select')
					.style('margin-right', '5px')
					.on('change', event => {
						const sl = event.target
						const newv = sl.options[sl.selectedIndex].innerHTML
						prod.functioneffect = newv
					})
				div
					.append('button')
					.text('Create group')
					.on('click', event => {
						let dnew = document.createElement('div')
						div.node().insertBefore(dnew, event.target)
						d3select(event.target).remove()
						dnew = d3select(dnew)
						dnew.style('display', 'inline-block')
						if (!arg.eglst) {
							// this is showing recurrent event from other samples, not able to dig up eglst
							dnew.text('Cannot do it here: please go to sample ' + arg.sample.name)
							return
						}
						dnew
							.append('input')
							.attr('size', 10)
							.property('value', prod.prodid + ',')
						dnew
							.append('button')
							.style('margin', '0px 10px')
							.text('Apply')
							.on('click', event => {
								const lst0 = event.target.previousSibling.value.trim().split(',')
								const goodid = []
								for (const i of lst0) {
									const j = Number.parseInt(i)
									if (Number.isNaN(j)) return alert('invalid id ' + i)
									if (this.prodidisinvalid(j, arg.sample)) return alert('invalid id ' + j)
									goodid.push(j)
								}
								if (goodid.length <= 1) return alert('need at least 2 id')
								const newevtlst = []
								for (const i of goodid) {
									const thisprod = this.extractprod(i, arg.sample)
									if (thisprod) {
										newevtlst.push({ label: thisprod.eventlabel, lst: [thisprod] })
									} else {
										return alert('invalid id ' + i)
									}
								}
								if (newevtlst.length <= 1) return alert('less than 2 products cannot make a group')
								arg.eglst.unshift({ lst: newevtlst, ismsg: true })
								// remake entire sample
								this.showsample(arg.sample)
								// done
								tip.hide()
							})
					})
				// <select>
				ratingsl.append('option').text('HQ')
				ratingsl.append('option').text('LQ')
				ratingsl.append('option').text('RT')
				ratingsl.append('option').text('bad')
				ratingsl.append('option').text('Major')
				switch (prod.rating) {
					case 'HQ':
						ratingsl.property('selectedindex', 0)
						break
					case 'LQ':
						ratingsl.property('selectedIndex', 1)
						break
					case 'RT':
						ratingsl.property('selectedIndex', 2)
						break
					case 'bad':
						ratingsl.property('selectedIndex', 3)
						break
					case 'Major':
						ratingsl.property('selectedIndex', 4)
						break
					default:
						alert('unknown rating: ' + prod.rating)
				}
				framesl.append('option').text('in-frame')
				framesl.append('option').text('out-of-frame')
				if (!prod.usepair) {
					framesl.attr('disabled', 1)
				} else {
					framesl.property('selectedIndex', prod.usepair.inframe ? 0 : 1)
				}
				typesl.append('option').text('CLoss')
				typesl.append('option').text('NLoss')
				typesl.append('option').text('Fusion')
				typesl.append('option').text('ITD')
				typesl.append('option').text('upTSS')
				typesl.append('option').text('other')
				if (prod.iscloss) {
					typesl.property('selectedIndex', 0)
				} else if (prod.isnloss) {
					typesl.property('selectedIndex', 1)
				} else if (prod.isfusion) {
					typesl.property('selectedIndex', 2)
				} else if (prod.isitd) {
					typesl.property('selectedIndex', 3)
				} else if (prod.isuptss) {
					typesl.property('selectedIndex', 4)
				} else if (prod.isother) {
					typesl.property('selectedIndex', 5)
				} else {
					alert('unknown type2: ' + prod.type2)
				}
				// <select> done
				effectsl.append('option').text('unknown effect')
				effectsl.append('option').text('fusion gene')
				effectsl.append('option').text('truncation, activated oncogene')
				effectsl.append('option').text('truncation, loss-of-function')
				effectsl.append('option').text('truncation, no consequence')
				effectsl.append('option').text('ITD')
				switch (prod.functioneffect) {
					case undefined:
						effectsl.property('selectedIndex', 0)
						break
					case 'fusion gene':
						effectsl.property('selectedIndex', 1)
						break
					case 'truncation, activated oncogene':
						effectsl.property('selectedIndex', 2)
						break
					case 'truncation, loss-of-function':
						effectsl.property('selectedIndex', 3)
						break
					case 'truncation, no consequence':
						effectsl.property('selectedIndex', 4)
						break
					case 'ITD':
						effectsl.property('selectedIndex', 5)
						break
				}
			}
			const p = {
				a: {
					chr: prod.chrA,
					position: prod.posA,
					strand: prod.ortA,
					name: prod.geneA ? prod.geneA : prod.chrA,
					ratio: prod.ratioA.toFixed(2),
					feature: prod.featureA,
					contiglen: prod.matchA,
					chimericreads: prod.readsA,
					repeatscore: prod.repeatA
				},
				b: {
					chr: prod.chrB,
					position: prod.posB,
					strand: prod.ortB,
					name: prod.geneB ? prod.geneB : prod.chrB,
					ratio: prod.ratioB.toFixed(2),
					feature: prod.featureB,
					contiglen: prod.matchB,
					chimericreads: prod.readsB,
					repeatscore: prod.repeatB
				},
				rating: prod.rating,
				score: Math.ceil(prod.score),
				originalprod: prod
			}
			if (prod.usepair) {
				p.inframe = prod.usepair.inframe
				const x = prod.usepair.a
				p.a.gm = this.genome.isoformmatch(x.isoform, prod.chrA, prod.posA)
				p.a.codon = x.codon
				p.a.exon = x.exon
				p.a.atupstream = x.atupstream
				p.a.atdownstream = x.atdownstream
				p.a.atutr5 = x.atutr5
				p.a.atutr3 = x.atutr3
				const y = prod.usepair.b
				p.b.gm = this.genome.isoformmatch(y.isoform, prod.chrB, prod.posB)
				p.b.codon = y.codon
				p.b.exon = y.exon
				p.b.atupstream = y.atupstream
				p.b.atdownstream = y.atdownstream
				p.b.atutr5 = y.atutr5
				p.b.atutr3 = y.atutr3
				// interstitial
				let aalen = 0,
					bplen = 0
				if (x.contigaa && y.contigaa) {
					aalen = y.contigaa - x.contigaa - 1
				}
				if (x.contigbp && y.contigbp) {
					bplen = y.contigbp - x.contigbp - 1
				}
				if (aalen) {
					p.interstitial = { aalen: aalen }
				}
				if (bplen) {
					if (!p.interstitial) p.interstitial = {}
					p.interstitial.bplen = bplen
				}
			}
			svtable({
				samplelst: [
					{
						pairlst: [p]
					}
				],
				nosample: true,
				holder: td
			})

			const par = {
				pairlst: [p],
				genome: this.genome,
				holder: td,
				quiet: true,
				hostURL: this.hostURL,
				jwt: this.jwt
			}
			import('./svgraph').then(p => {
				p.default(par)
			})

			if (!arg.nodetail) {
				const td = tr2.append('td').style('font-size', '.8em').style('vertical-align', 'top')
				// custom attributes
				const lst = []
				for (const at of this.atlst) {
					if (!at.custom) continue
					const v = prod[at.key]
					lst.push({
						k: at.label,
						v: v == undefined ? '' : v
					})
				}
				client.make_table_2col(td, lst, 25)
				// isoform pairs
				prod.pairs.sort((a, b) => {
					if (a.inuse) return -1
					if (b.inuse) return 1
					return 0
				})
				const table0 = td.append('table')
				for (const pair of prod.pairs) {
					const tr = table0.append('tr')
					tr.append('td').html(
						(pair.inframe ? 'in-frame' : 'out-of-frame') +
							'<div style="font-size:70%">frame code: ' +
							pair.frame +
							'</div>'
					)
					const td = tr.append('td')
					const table = td
						.append('table')
						.style('margin-bottom', '20px')
						.style('border', pair.inuse ? 'solid 1px black' : '')
						.style('border-spacing', '10px')
						.style('border-collapse', 'separate')
					let _tr = table.append('tr').style('color', '#858585').style('font-size', '.7em')
					_tr.append('td').text('gene')
					_tr.append('td').text('isoform')
					_tr.append('td').text('gene position')
					_tr.append('td').text('exon')
					_tr.append('td').text('anchor')
					_tr.append('td').text('contig AA')
					_tr.append('td').text('contig bp')
					const tr1 = table.append('tr')
					const tr2 = table.append('tr')
					tr1.append('td').text(prod.geneA ? prod.geneA : prod.chrA)
					tr2.append('td').text(prod.geneB ? prod.geneB : prod.chrB)
					tr1.append('td').text(pair.a.isoform ? pair.a.isoform : '')
					tr2.append('td').text(pair.b.isoform ? pair.b.isoform : '')
					tr1
						.append('td')
						.text(
							pair.a.isoform
								? pair.a.codon != undefined
									? 'codon: ' + pair.a.codon
									: pair.a.atutr5
									? "5' UTR"
									: pair.a.atutr3
									? "3' UTR"
									: pair.a.atupstream
									? 'upstream'
									: 'downstream'
								: ''
						)
					tr2
						.append('td')
						.text(
							pair.b.isoform
								? pair.b.codon != undefined
									? 'codon: ' + pair.b.codon
									: pair.b.atutr5
									? "5' UTR"
									: pair.b.atutr3
									? "3' UTR"
									: pair.b.atupstream
									? 'upstream'
									: 'downstream'
								: ''
						)
					tr1.append('td').text(pair.a.exon ? pair.a.exon : '')
					tr2.append('td').text(pair.b.exon ? pair.b.exon : '')
					tr1.append('td').text(pair.a.anchor ? pair.a.anchor : '')
					tr2.append('td').text(pair.b.anchor ? pair.b.anchor : '')
					tr1
						.append('td')
						.html(pair.a.contigaa ? '<span style="color:#858585;font-size:70%">ends at</span> ' + pair.a.contigaa : '?')
					tr2
						.append('td')
						.html(
							pair.b.contigaa ? '<span style="color:#858585;font-size:70%">starts at</span> ' + pair.b.contigaa : '?'
						)
					tr1
						.append('td')
						.html(pair.a.contigbp ? '<span style="color:#858585;font-size:70%">ends at</span> ' + pair.a.contigbp : '?')
					tr2
						.append('td')
						.html(
							pair.b.contigbp ? '<span style="color:#858585;font-size:70%">starts at</span> ' + pair.b.contigbp : '?'
						)
				}
			}
		}
		if (!arg.sample) {
			// the current sample is not provided, won't try to find out samples with recurrent events
			return
		}
		const thislab = arg.prodlst[0].eventlabel
		const samplelst = this.elab2sample[thislab]
		const othersample = []
		if (samplelst) {
			for (const s of samplelst) {
				if (s.name != arg.sample.name) othersample.push(s)
			}
		}
		if (arg.showothersample && othersample.length > 0) {
			arg.holder
				.append('button')
				.style('display', 'block')
				.style('margin', '20px')
				.text('Show in ' + othersample.length + ' other sample' + (othersample.length > 1 ? 's' : ''))
				.on('click', event => {
					d3select(event.target).remove()
					for (const sample of othersample) {
						const prodlst = sample.events[thislab]
						if (!prodlst) {
							arg.holder
								.append('div')
								.style('margin', '20px')
								.style('color', 'red')
								.text('Error: no products for this event in ' + sample.name)
							continue
						}
						const table = arg.holder.append('table').style('margin-top', '20px').style('border', 'solid 1px #ccc')
						const tr = table.append('tr')
						tr.append('td').text(sample.name)
						const td = tr.append('td')
						this.showsvpairs({
							prodlst: prodlst,
							holder: td,
							nodetail: true,
							sample: sample,
							// FIXME: eglst info is hidden somewhere in sample.egglst
							eglst: null
						})
					}
				})
		}
		if (this.expression.genes && geneset.size > 0) {
			const table = expressiontd.append('table')
			const tr = table.append('tr')
			for (const gene of geneset) {
				const expd = this.expression.genes[gene]
				if (expd) {
					const div = tr
						.append('td')
						.style('vertical-align', 'top')
						.append('div')
						.style('display', 'inline-block')
						.style('margin-right', '20px')
						.style('border', 'solid 1px #ccc')
					div.append('div').style('background-color', '#ededed').style('padding', '10px').text(gene)
					if (arg.sample) {
						for (const v of expd) {
							if (v.sample == arg.sample.name) {
								v.ishighlight = true
								div
									.append('div')
									.style('padding', '10px')
									.style('font-size', '70%')
									.html('Expression in ' + arg.sample.name + ': <span style="font-size:150%">' + v.value + '</span>')
							} else {
								v.ishighlight = false
							}
						}
					}
					showgenevalues({
						data: this.expression.genes[gene],
						holder: div.append('div').style('margin', '10px'),
						width: 200,
						height: 200,
						namename: 'sample'
					})
				} else {
					tr.append('td')
						.style('vertical-align', 'top')
						.text('No expression data for ' + gene + '</td>')
				}
			}
		}
	}

	prodidisinvalid(id, sample) {
		for (const egg of sample.egglst) {
			for (const eg of egg.lst) {
				for (const e of eg.lst) {
					for (const p of e.lst) {
						if (p.prodid == id) return false
					}
				}
			}
		}
		return true
	}

	extractprod(id, sample) {
		let prod = null
		for (let n = 0; n < sample.egglst.length; n++) {
			const _egg = sample.egglst[n]
			for (let j = 0; j < _egg.lst.length; j++) {
				const _eg = _egg.lst[j]
				for (let k = 0; k < _eg.lst.length; k++) {
					const _evt = _eg.lst[k]
					for (let p = 0; p < _evt.lst.length; p++) {
						const p2 = _evt.lst[p]
						if (p2.prodid == id) {
							prod = p2
							_evt.lst.splice(p, 1)
							break
						}
					}
					if (prod) {
						if (_evt.lst.length == 0) {
							_eg.lst.splice(k, 1)
						}
						break
					}
				}
				if (prod) {
					if (_eg.lst.length == 0) {
						_egg.lst.splice(j, 1)
					} else {
						if (_eg.ismsg && _eg.lst.length == 1) {
							delete _eg.ismsg
						}
					}
					break
				}
			}
			if (prod) {
				if (_egg.lst.length == 0) {
					sample.egglst.splice(n, 1)
				}
				break
			}
		}
		return prod
	}
	// end of class
}

function msjoin(prod, newholder) {
	if (prod.isitd) return
	if (prod.sv_ort == '?') return
	var single = true
	var thispair = prod.usepair
	for (var i = 0; i < newholder.length; i++) {
		var tmplst = newholder[i]
		// test head
		var prod2 = tmplst[0]
		if (prod.chrB == prod2.chrA && prod.ortB == prod2.ortA) {
			if (testreadcount(prod, prod2)) {
				// compare isoform/codon position
				var thatpair = prod2.usepair
				if (thispair && thatpair && thispair.b.isoform && thispair.b.isoform == thatpair.a.isoform) {
					var p1 = thispair.b
					var p2 = thatpair.a
					var ahead = false
					if (p1.atutr5) {
						if (p2.codon != undefined) {
							ahead = true
							prod2.mswhat = "5' UTR to coding region"
						} else if (p2.atutr3) {
							ahead = true
							prod2.mswhat = "5' UTR to 3' UTR"
						} else if (p2.atutr5 && p1.atutr5.off < p2.atutr5.off) {
							ahead = true
							prod2.mswhat = p2.atutr5.off - p1.atutr5.off + " bp apart in 5' UTR"
						}
					} else if (p1.atutr3) {
						if (p2.atutr3 && p1.atutr3.off < p2.atutr3.off) {
							ahead = true
							prod2.mswhat = p2.atutr3.off - p1.atutr3.off + " bp apart in 3' UTR"
						}
					} else if (p1.codon != undefined) {
						if (p2.codon != undefined && p2.codon > p1.codon) {
							ahead = true
							prod2.mswhat = p2.codon - p1.codon + ' aa apart in protein'
						} else if (p2.atutr3) {
							ahead = true
							prod2.mswhat = "coding region to 3' UTR"
						}
					}
					if (ahead) {
						tmplst.unshift(prod)
						single = false
						break
					}
				}
				// compare by genomic pos, if upstream of head
				var dst = prod2.posA - prod.posB
				if ((prod.ortB == '+' && dst > 0 && dst < genomelimit) || (prod.ortB == '-' && dst < 0 && -dst < genomelimit)) {
					prod2.mswhat = Math.abs(dst) + ' bp apart on genome'
					tmplst.unshift(prod)
					single = false
					break
				}
			}
		}
		// test tail
		prod2 = tmplst[tmplst.length - 1]
		if (prod.chrA == prod2.chrB && prod.ortA == prod2.ortB) {
			if (testreadcount(prod2, prod)) {
				var thatpair = prod2.usepair
				if (thispair && thatpair && thispair.a.isoform && thispair.a.isoform == thatpair.b.isoform) {
					var p1 = thatpair.b
					var p2 = thispair.a
					var behind = false
					if (p1.atutr5) {
						if (p2.codon != undefined) {
							behind = true
							prod.mswhat = "5' UTR to coding region"
						} else if (p2.atutr3) {
							behind = true
							prod.mswhat = "5' UTR to 3' UTR"
						} else if (p2.atutr5 && p1.atutr5.off < p2.atutr5.off) {
							behind = true
							prod.mswhat = p2.atutr5.off - p1.atutr5.off + " bp apart in 5' UTR"
						}
					} else if (p1.atutr3) {
						if (p2.atutr3 && p1.atutr3.off < p2.atutr3.off) {
							behind = true
							prod.mswhat = p2.atutr3.off - p1.atutr3.off + " bp apart in 3' UTR"
						}
					} else if (p1.codon != undefined) {
						if (p2.codon != undefined && p2.codon > p1.codon) {
							behind = true
							prod.mswhat = p2.codon - p1.codon + ' aa apart in protein'
						} else if (p2.atutr3) {
							behind = true
							prod.mswhat = "coding region to 3' UTR"
						}
					}
					if (behind) {
						tmplst.push(prod)
						single = false
						break
					}
				}
				// if downstream of tail
				var dst = prod.posA - prod2.posB
				if (prod.ortA == '+' && dst > 0 && dst < genomelimit && prod.ortA == '-' && dst < 0 && -dst < genomelimit) {
					prod.mswhat = Math.abs(dst) + ' bp apart on genome'
					tmplst.push(prod)
					single = false
					break
				}
			}
		}
	}
	if (single) {
		newholder.push([prod])
	}
	function testreadcount(p1, p2) {
		if (!p1.usepair || !p1.usepair.inframe) return false
		if (!p2.usepair || !p2.usepair.inframe) return false
		// Another problem is too many multi-seg. Please use read count to filter out some artifacts. Following is an artifact multi-seg LINC00598- PLXNB2-MUC4. The number of reads are not comparable for these two segments. We should not connect these two. I suggest using 5 fold as threshold to connect segments.
		if (p1.readsB == 0 || p2.readsA == 0) return false
		var fold = p1.readsB / p2.readsA
		return fold >= 0.2 && fold <= 5
	}
}

function svtable(arg) {
	// sample level events
	const table = arg.holder.append('table').style('border-spacing', '10px').style('border-collapse', 'separate')
	const htr = table.append('tr').style('font-size', '70%').style('color', '#858585')
	const fields = [
		{ label: 'Feature', hide: true, get: a => a.feature },
		{ label: 'Ratio', hide: true, get: a => Math.ceil(a.ratio * 100) + '%' },
		{ label: 'Chimeric<br>reads', hide: true, get: a => a.chimericreads },
		{ label: 'Contig<br>length', hide: true, get: a => a.contiglen },
		{ label: 'Repeat<br>score', hide: true, get: a => a.repeatscore },
		{ label: 'Cicero<br>score', hide: true, atpair: true, get: a => a.score },
		{ label: 'Cicero<br>rating', israting: true, hide: true, atpair: true, get: a => a.rating }
	]
	for (const sample of arg.samplelst) {
		for (const p of sample.pairlst) {
			if (p.a.feature || p.b.feature) fields[0].hide = false
			if (typeof p.a.ratio == 'number' || typeof (p.b.ratio == 'number')) fields[1].hide = false
			if (typeof p.a.chimericreads == 'number' || typeof p.b.chimericreads == 'number') fields[2].hide = false
			if (typeof p.a.contiglen == 'number' || typeof p.b.contiglen == 'number') fields[3].hide = false
			if (typeof p.a.repeatscore == 'number' || typeof p.b.repeatscore == 'number') fields[4].hide = false
			if (typeof p.score == 'number') fields[5].hide = false
			if (p.rating) fields[6].hide = false
		}
	}
	// header
	if (!arg.nosample) {
		htr.append('td')
	}
	htr.append('td') // gene
	htr.append('td') // frame
	htr.append('td').html('Genomic<br>position') // coord
	htr.append('td').html('Genomic<br>dist.') //
	for (const f of fields) {
		if (f.hide) return
		htr.append('td').html(f.label)
	}
	for (const sample of arg.samplelst) {
		let tr = table.append('tr')
		if (!arg.nosample) {
			const td = tr.append('td').text(sample.sample)
			if (sample.pairlst.length > 1) {
				td.attr('rowspan', sample.pairlst.length)
			}
		}
		for (let i = 0; i < sample.pairlst.length; i++) {
			if (i > 0) {
				// new
				tr = table.append('tr')
			}
			const pair = sample.pairlst[i]
			// gene
			tr.append('td')
				.style('text-align', 'right')
				.html(
					'<span style="background-color:' +
						client.colorbgleft +
						';padding:2px 3px;font-size:80%">' +
						pair.a.name +
						'</span>' +
						'<span style="background-color:' +
						client.colorbgright +
						';padding:2px 3px;font-size:80%">' +
						pair.b.name +
						'</span>'
				)
			// frame
			const td = tr.append('td')
			if (pair.originalprod && pair.originalprod.hook.lessFrame) {
				pair.originalprod.hook.lessFrame = td
			}
			if (pair.inframe) {
				td.html(
					'<span style="background-color:' +
						client.colorinframe +
						';color:white;padding:2px 3px;font-size:80%;white-space:nowrap">In frame</span>'
				)
			} else {
				if (pair.a.gm || pair.b.gm) {
					td.html(
						'<span style="background-color:#858585;color:white;padding:2px 3px;font-size:80%;white-space:nowrap">Out of frame</span>'
					)
				} else {
					td.html(
						'<span style="border:solid 1px #858585;color:#858585;padding:1px 2px;font-size:80%;white-space:nowrap">no gene ?</span>'
					)
				}
			}
			// coord
			tr.append('td').html(
				'<div style="background-color:' +
					client.colorbgleft +
					';padding:1px 3px;font-size:70%;white-space:nowrap">' +
					pair.a.chr +
					':' +
					pair.a.position +
					' ' +
					pair.a.strand +
					'</div>' +
					'<div style="background-color:' +
					client.colorbgright +
					';padding:1px 3px;font-size:70%;white-space:nowrap">' +
					pair.b.chr +
					':' +
					pair.b.position +
					' ' +
					pair.b.strand +
					'</div>'
			)
			// dist
			tr.append('td').html(
				pair.a.chr == pair.b.chr
					? bplength(Math.abs(pair.a.position - pair.b.position))
					: '<span style="color:' + client.colorctx + '">CTX</span>'
			)
			for (const f of fields) {
				if (f.hide) continue
				const td = tr.append('td')
				if (f.israting && pair.originalprod && pair.originalprod.hook.lessRating) {
					pair.originalprod.hook.lessRating = td
				}
				if (f.atpair) {
					td.text(f.get(pair))
				} else {
					td.html(
						'<span style="background-color:' +
							client.colorbgleft +
							';padding:2px 3px;font-size:80%">' +
							f.get(pair.a) +
							'</span>' +
							'<span style="background-color:' +
							client.colorbgright +
							';padding:2px 3px;font-size:80%">' +
							f.get(pair.b) +
							'</span>'
					)
				}
			}
		}
	}
}

function loadexpression(svmr, file) {
	const genes = {}
	const ep = svmr.expression
	ep.genes = genes
	const reader = new FileReader()
	const chunksize = 4096
	let chunks = []
	let offset = 0
	reader.onloadend = e => {
		if (e.target.readyState != FileReader.DONE) return
		const chunk = e.target.result
		chunks.push(chunk)
		const isend = offset >= file.size
		process(isend)
		if (isend) {
			done()
		} else {
			offset += chunksize
			ep.presays.text('Reading file: ' + Math.ceil((offset / file.size) * 100) + '%')
			reader.readAsText(file.slice(offset, offset + chunksize))
		}
	}
	reader.readAsText(file.slice(0, chunksize))
	const hg = {},
		hs = {}
	let good = 0,
		bad = 0
	function process(isend) {
		const lines = chunks.join('').split('\n')
		for (let i = 0; i < lines.length - 1 - (isend ? 0 : 1); i++) {
			const l = lines[i].split('\t')
			if (l.length == 3) {
				const v = Number.parseFloat(l[1])
				if (Number.isNaN(v)) {
					bad++
				} else {
					good++
					hg[l[0]] = 1
					hs[l[2]] = 1
					if (!(l[0] in genes)) {
						genes[l[0]] = []
					}
					genes[l[0]].push({
						sample: l[2],
						value: v
					})
				}
			} else {
				bad++
			}
		}
		if (!isend) {
			chunks = [lines[lines.length - 1]]
		}
	}
	function done() {
		let genec = 0
		for (const n in hg) genec++
		let samplec = 0
		for (const n in hs) samplec++
		client.disappear(ep.prediv)
		client.appear(ep.afterdiv)
		ep.afterdiv.selectAll('*').remove()
		ep.afterdiv
			.append('div')
			.text(
				'Expression data loaded for ' +
					genec +
					' genes, ' +
					samplec +
					' samples, ' +
					good +
					' data points' +
					(bad > 0 ? ', ' + bad + ' bad lines' : '')
			)
		ep.afterdiv
			.append('button')
			.text('Delete')
			.style('margin', '20px')
			.on('click', () => {
				delete ep.genes
				ep.prediv.node().removeChild(ep.input.node())
				ep.input = ep.prediv
					.append('input')
					.attr('type', 'file')
					.on('change', event => {
						loadexpression(svmr, event.target.files[0])
					})
				ep.presays.text('')
				client.disappear(ep.afterdiv)
				client.appear(ep.prediv)
			})
	}
}

function showgenevalues(arg) {
	// arg.data: [ {sample:'xx', patient:, sampletype:, value:10.4}, ... ]
	const hlcolor = 'red'
	arg.data.sort((a, b) => {
		return b.value - a.value
	})
	let width = arg.width ? arg.width : 400,
		height = arg.height ? arg.height : 400
	let maxv = 0
	for (const v of arg.data) {
		maxv = Math.max(maxv, v.value)
	}
	let dotr // radius
	const xscale = scaleLinear().domain([0, maxv])
	const svg = arg.holder.append('svg')
	const axisg = svg.append('g')
	const dotg = svg.append('g')
	const dotset = dotg.selectAll().data(arg.data).enter().append('g')
	const dotcir = dotset
		.append('circle')
		.attr('fill', 'white')
		.attr('fill-opacity', 0)
		.attr('stroke', d => (d.ishighlight ? hlcolor : 'black'))
		.attr('stroke-opacity', d => (d.ishighlight ? 0.7 : 0.2))
		.on('mouseover', (event, d) => {
			event.target.setAttribute('transform', 'scale(1.5)')
			drag
				.text((d.sample ? d.sample : d.patient + ' ' + d.sampletype) + ' ' + d.value)
				.attr('fill', d.ishighlight ? hlcolor : 'black')
		})
		.on('mouseout', (event, d) => {
			event.target.setAttribute('transform', 'scale(1)')
			drag.text('drag to resize').attr('fill', 'black')
		})
	const drag = svg
		.append('text')
		.text('drag to resize')
		.attr('font-size', 12)
		.attr('class', 'sja_svgtext')
		.attr('font-family', client.font)
		.attr('text-anchor', 'end')
		.on('mousedown', event => {
			event.preventDefault()
			const x0 = event.clientX,
				y0 = event.clientY,
				width0 = width,
				height0 = height
			const b = d3select(document.body)
			b.on('mousemove', () => {
				width = width0 + event.clientX - x0
				height = height0 + event.clientY - y0
				sizing()
			}).on('mouseup', () => {
				b.on('mousemove', null).on('mouseup', null)
			})
		})
	function sizing() {
		dotr = Math.max(5, Math.min(width, height) / 40)
		const fontsize = Math.min(18, Math.max(12, dotr * 2)),
			ticksize = 5,
			axish = fontsize + ticksize + 5,
			axispad = dotr + 5,
			width2 = dotr * 3
		xscale.range([0, width])
		svg.attr('width', dotr * 2 + width + width2).attr('height', axish + axispad + height + dotr * 2)
		client.axisstyle({
			axis: axisg.attr('transform', 'translate(' + dotr * 2 + ',' + axish + ')').call(
				axisTop()
					.scale(xscale)
					.ticks(Math.min(10, Math.ceil(width / 50)))
			),
			fontsize: fontsize,
			color: 'black',
			showline: true
		})
		dotg.attr('transform', 'translate(' + dotr * 2 + ',' + (axish + axispad) + ')')
		dotset.attr('transform', (d, i) => {
			return 'translate(' + xscale(d.value) + ',' + (height * i) / arg.data.length + ')'
		})
		dotcir.attr('r', d => {
			return dotr * (d.ishighlight ? 1.5 : 1)
		})
		drag
			.attr('font-size', fontsize)
			.attr('x', dotr * 2 + width + width2 - 5)
			.attr('y', axish + axispad + height + dotr * 2 - 5)
	}
	sizing()
	/*
	this.highlighttoggle=function(sample) {
		if(!sample) return
		var thisd=null
		dotcir.attr('transform',function(d){
			if(d.sample==sample) {
				thisd=d
				return 'scale(1.5)'
			}
			return 'scale(1)'
		})
		if(thisd) {
			drag.text(thisd.sample+' '+thisd.value)
		} else {
			drag.text('drag to resize')
		}
	}
	*/
	return this
}
