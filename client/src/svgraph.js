import { select as d3select, pointer } from 'd3-selection'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { rgb as d3rgb } from 'd3-color'
import * as d3force from 'd3-force'
import * as client from './client'
import * as coord from './coord'
import hm2legend from './hm2.legend'
import { dofetch3 } from '../common/dofetch'
import { Menu } from '#dom'
import { proteinDomainColorScale } from '#shared/common.js'

/*
argument:

.pairlst[{}]
	
	.a
	.b
		.gm - available gene model for one break end
			.pdomains[]
			.domain_hidden{}
*/

export default function (arg) {
	const outborder = '#ddd'
	const pairlst = arg.pairlst
	const genome = arg.genome
	const errdiv = arg.holder.append('div')
	const waitdiv = arg.holder.append('div')
	const tmp = arg.holder
		.append('div')
		.style('display', 'inline-block')
		.style('border', 'solid 1px ' + outborder)
	const svgdiv = tmp.append('div').style('margin', '10px')
	const buttdiv = tmp
		.append('div')
		.style('margin-top', '5px')
		.style('padding', '10px 20px')
		.style('background-color', '#ededed')
	const domaindiv = tmp.append('div').style('margin', '10px').style('display', 'none')
	const colormenu = new Menu({ padding: '10px' })

	function err(m) {
		client.sayerror(errdiv, m)
	}
	// any isoform not loaded yet
	const noset = new Set()
	const nolst = []
	for (const point of pairlst) {
		if (point.a.gm) {
			const n = point.a.gm.isoform
			if (genome.isoformcache.has(n)) {
				point.a.gm = genome.isoformmatch(n, point.a.chr, point.a.position)
			} else {
				noset.add(n)
				nolst.push(point.a)
			}
		}
		if (point.b.gm) {
			const n = point.b.gm.isoform
			if (genome.isoformcache.has(n)) {
				point.b.gm = genome.isoformmatch(n, point.b.chr, point.b.position)
			} else {
				noset.add(n)
				nolst.push(point.b)
			}
		}
	}
	if (noset.size == 0) {
		validate()
		return
	}

	const loadlst = []
	for (const n of noset) {
		loadlst.push(n)
	}

	dofetch3('isoformlst', { method: 'POST', body: JSON.stringify({ genome: genome.name, lst: loadlst }) })
		.then(data => {
			if (data.error) throw { message: data.error }
			for (const ilst of data.lst) {
				if (ilst[0]) {
					genome.isoformcache.set(ilst[0].isoform.toUpperCase(), ilst)
				}
			}
			const errlst = []
			for (const node of nolst) {
				const gm = genome.isoformmatch(node.gm.isoform, node.chr, node.position)
				if (!gm) {
					// gm is undefined, the node is turned to be intergenic
					errlst.push(node.gm.isoform)
					delete node.gm
				} else {
					node.gm = gm
				}
			}
			if (errlst.length) {
				err('invalid isoform: ' + errlst.join(','))
			}
			validate()
		})
		.catch(e => {
			err(e.message)
			if (e.stack) console.log(e.stack)
		})

	async function validate() {
		// validate break point annotation with gm
		/* if no strand, fill with the strand in gm
		must do this in svgraph, after loading isoform info
		cannot do this in show_dt_sv
	*/
		for (const point of pairlst) {
			if (point.a.strand == undefined) {
				point.a.strand = point.a.gm.strand
			}
			if (point.b.strand == undefined) {
				point.b.strand = point.b.gm.strand
			}
		}
		for (const p of pairlst) {
			let e = nodecheck(p.a)
			if (e) {
				return err(e)
			}
			e = nodecheck(p.b)
			if (e) {
				return err(e)
			}
		}
		// multi seg joining requirement
		for (let i = 1; i < pairlst.length; i++) {
			const curr = pairlst[i].a
			const prev = pairlst[i - 1].b
			if (curr.chr != prev.chr)
				return err('Error: mismatched chromosome at multi-seg breakpoint ' + i + ': ' + curr.chr + ' != ' + prev.chr)
			if (curr.strand != prev.strand) return err('Error: mismatched strand at multi-seg breakpoint ' + i)
			// make up when one has gm the other does not
			if (curr.gm) {
				if (prev.gm) {
					if (curr.gm.isoform != prev.gm.isoform) {
						return err(
							'Error: mismatched gene in two breakpoints: ' +
								prev.gm.symbol +
								' ' +
								prev.gm.isoform +
								', ' +
								curr.gm.symbol +
								' ' +
								curr.gm.isoform
						)
					}
				} else {
					prev.gm = curr.gm
					err('In multi-segment at ' + i + ", 5' breakpoint is joined to the same gene model of 3'")
					const t = coord.genomic2gm(prev.position, curr.gm, 5) /// XXX 5 is tempoff!! must remove later
					prev.exonbp = t.rnapos
					prev.codon = t.aapos
					prev.atintron = t.atintron
					prev.exon = t.atexon
					prev.atutr3 = t.atutr3
					prev.atutr5 = t.atutr5
					prev.atupstream = t.atupstream
					prev.atdownstream = t.atdownstream
				}
			} else {
				if (prev.gm) {
					curr.gm = prev.gm
					err('In multi-segment at ' + i + ", 3' breakpoint is joined to the same gene model of 5'")
					const t = coord.genomic2gm(curr.position, prev.gm, 5) /// XXX 5 is tempoff!! must remove later
					curr.exonbp = t.rnapos
					curr.codon = t.aapos
					curr.atintron = t.atintron
					curr.exon = t.atexon
					curr.atutr3 = t.atutr3
					curr.atutr5 = t.atutr5
					curr.atupstream = t.atupstream
					curr.atdownstream = t.atdownstream
				}
			}
		}
		// any isoform without protein domain info
		const noset = new Set()
		for (const point of pairlst) {
			if (point.a.gm && !point.a.gm.pdomains) {
				noset.add(point.a.gm.isoform)
			}
			if (point.b.gm && !point.b.gm.pdomains) {
				noset.add(point.b.gm.isoform)
			}
		}

		if (noset.size == 0) {
			new draw()
			return
		}

		const loadlst = []
		for (const n of noset) {
			loadlst.push(n)
		}
		waitdiv.style('margin', '5px').text('Loading protein domains ...')
		const datalst = await getPdomains(loadlst)

		for (const i of datalst) {
			const s = proteinDomainColorScale()
			for (const d of i.pdomains) {
				if (!d.color) {
					d.color = s(d.name + d.description)
				}
			}
			const n = i.name.toUpperCase()
			if (genome.isoformcache.has(n)) {
				for (const ii of genome.isoformcache.get(n)) {
					ii.pdomains = i.pdomains
					ii.domain_hidden = {}
				}
			}
		}
		new draw()
	}

	async function getPdomains(loadlst) {
		const data = await dofetch3('pdomain', {
			method: 'POST',
			body: JSON.stringify({ genome: genome.name, isoforms: loadlst })
		})
		if (data.error) throw data.error
		else waitdiv.remove()
		return data.lst
	}

	function draw() {
		// scaffolds
		const scaffold = []
		let scfid = 0
		for (let i = 0; i < pairlst.length; i++) {
			const point = pairlst[i]
			let scf
			if (i > 0) {
				// point.a joins previous scaffold
				scf = scaffold[scaffold.length - 1]
			}
			if (point.a.gm) {
				if (!scf) {
					scf = {
						gm: point.a.gm,
						strand: point.a.gm.strand,
						id: scfid++,
						name: point.a.name ? point.a.name : point.a.gm.name
					}
					if (point.a.gm.coding) {
						scf.aalen = point.a.gm.cdslen / 3
					} else {
						if (!point.a.gm.rnalen) {
							err('no aacount or rnalen for ' + point.a.gm.symbol + ' ' + point.a.gm.isoform)
							return
						}
						scf.bplen = point.a.gm.rnalen
					}
				}
				if (point.a.atutr3) {
					scf.utr3bp = point.a.atutr3.total
				}
				if (point.a.atutr5) {
					scf.utr5bp = point.a.atutr5.total
				}
				if (point.a.atupstream) {
					scf.upstream = Math.max(scf.upstream ? scf.upstream : 0, point.a.atupstream.off)
				}
				if (point.a.atdownstream) {
					scf.downstream = Math.max(scf.downstream ? scf.downstream : 0, point.a.atdownstream.off)
				}
			} else {
				if (!scf) {
					scf = {
						chr: point.a.chr,
						id: scfid++,
						start: point.a.position,
						stop: point.a.position,
						name: point.a.name ? point.a.name : point.a.chr
					}
				}
				scf.start = Math.min(scf.start, point.a.position)
				scf.stop = Math.max(scf.stop, point.a.position)
			}
			point.a.scfid = scf.id
			if (i == 0) {
				scaffold.push(scf)
			}
			if (point.interstitial) {
				scf = {
					nontemplate: true,
					id: scfid++
				}
				if (point.interstitial.aalen) {
					scf.aalen = point.interstitial.aalen
					scf.name = scf.aalen + ' AA insertion'
				} else if (point.interstitial.bplen) {
					scf.aalen = point.interstitial.bplen / 3
					scf.name = scf.bplen + ' bp insertion'
				}
				scaffold.push(scf)
				point.interstitial.scfid = scf.id
			}
			// always create new scaffold for point.b
			if (point.b.gm) {
				scf = {
					gm: point.b.gm,
					strand: point.b.gm.strand,
					id: scfid++,
					name: point.b.name ? point.b.name : point.b.gm.symbol
				}
				if (point.b.gm.coding) {
					scf.aalen = point.b.gm.cdslen / 3
				} else {
					if (!point.b.gm.rnalen) {
						err('no aacount or rnalen for ' + point.b.gm.symbol + ' ' + point.b.gm.isoform)
						return
					}
					scf.bplen = point.b.gm.rnalen
				}
				if (point.b.atutr3) {
					scf.utr3bp = point.b.atutr3.total
				}
				if (point.b.atutr5) {
					scf.utr5bp = point.b.atutr5.total
				}
				if (point.b.atupstream) {
					scf.upstream = Math.max(scf.upstream ? scf.upstream : 0, point.b.atupstream.off)
				}
				if (point.b.atdownstream) {
					scf.downstream = Math.max(scf.downstream ? scf.downstream : 0, point.b.atdownstream.off)
				}
			} else {
				scf = {
					chr: point.b.chr,
					id: scfid++,
					start: point.b.position,
					stop: point.b.position,
					name: point.b.name ? point.b.name : point.b.chr
				}
				scf.start = Math.min(scf.start, point.b.position)
				scf.stop = Math.max(scf.stop, point.b.position)
			}
			point.b.scfid = scf.id
			scaffold.push(scf)
		}
		// scaffold made
		for (const s of scaffold) {
			s.nodes = []
			s.clipid0 = Math.ceil(Math.random() * 100000)
			s.clipid = 'url(#' + s.clipid0 + ')'
		}
		/* for gm scaffold, make hard copy of gm
in case for the same gm twice appearred, each appearance should show domain from separate object but not shared, so that domain rect clipid can be distinguished
*/
		for (const s of scaffold) {
			if (!s.gm) continue
			const g = {
				name: s.gm.name,
				isoform: s.gm.isoform,
				codingstart: s.gm.codingstart,
				codingstop: s.gm.codingstop,
				strand: s.gm.strand,
				aaseq: s.gm.aaseq,
				exon: s.gm.exon,
				utr3: s.gm.utr3,
				utr5: s.gm.utr5,
				cdslen: s.gm.cdslen,
				pdomains: [],
				domain_hidden: s.gm.domain_hidden
			}
			if (s.gm.pdomains) {
				for (const a of s.gm.pdomains) {
					const b = {}
					for (const k in a) {
						b[k] = a[k]
					}
					g.pdomains.push(b)
				}
			}
			s.gm = g
		}

		// set1
		// set ideal y
		const connheight = 90,
			pad4 = 5,
			regionthick = 3
		for (const s of scaffold) {
			s.idealy = connheight * s.id + (pad4 + regionthick) * 2 * s.id
		}
		this.width = this.width0 = 400
		const dragwidth = 20,
			dragheight = 20,
			toppad = 70,
			bottompad = 70,
			proteinheight = 26,
			pad2 = 5,
			pad3 = 5,
			scffontsize = 15,
			nodefontsize = 13,
			descfontsize = 12,
			pad5 = 5,
			pad6 = 3,
			pad7 = 10
		// set3
		let height =
			toppad +
			bottompad +
			proteinheight * scaffold.length +
			(pad4 * 2 + regionthick * 2 + connheight) * (scaffold.length - 1)
		let leftpad = 40,
			rightpad = 40
		// height not changed by toggling
		// nodes
		const data = { nodes: [], links: [] }
		// nodes - make
		for (let i = 0; i < pairlst.length; i++) {
			const point = pairlst[i]
			const left = copynode(point.a, scaffold, data)
			left.x = this.width / 2
			left.y = height / 2
			let midleft = null,
				midright = null
			if (point.interstitial) {
				const _scf = scaffold[point.interstitial.scfid]
				midleft = {
					nontemplate: true,
					scfid: point.interstitial.scfid,
					softlink3: left,
					x: arg.quiet ? this.width / 2 : 0,
					y: arg.quiet ? _scf.idealy : height / 2
				}
				left.softlink5 = midleft
				data.nodes.push(midleft)
				_scf.nodes.push(midleft)
				midright = {
					nontemplate: true,
					scfid: point.interstitial.scfid,
					x: arg.quiet ? this.width / 2 : 0,
					y: arg.quiet ? _scf.idealy : height / 2
				}
				data.nodes.push(midright)
				_scf.nodes.push(midright)
				midleft.hardlink = midright
				midright.hardlink = midleft
			}
			const right = copynode(point.b, scaffold, data)
			right.x = this.width / 2
			right.y = height / 2
			if (midright) {
				midright.softlink5 = right
				right.softlink3 = midright
				// two links
				data.links.push({
					source: data.nodes.length - 4,
					target: data.nodes.length - 3
				})
				data.links.push({
					source: data.nodes.length - 2,
					target: data.nodes.length - 1
				})
			} else {
				left.softlink5 = right
				right.softlink3 = left
				// just one link
				data.links.push({
					source: data.nodes.length - 2,
					target: data.nodes.length - 1
				})
			}
			if (i > 0) {
				const prev = data.nodes[data.nodes.length - 3 - (point.interstitial ? 2 : 0)]
				// hard link, intact
				left.hardlink = prev
				prev.hardlink = left
			}
		}
		// nodes made
		/*
console.log(scaffold)
console.log(data)
*/

		// max physical span of scaffolds
		// should not be changed once set
		let gmmaxaa = 0, // no matter how many nodes on a gm
			chrmaxspan = 0 // determined by distance of nodes on a chr
		for (const scf of scaffold) {
			if (scf.gm) {
				scf.aatotal =
					(scf.aalen ? scf.aalen : scf.bplen / 3) +
					((scf.utr3bp ? scf.utr3bp : 0) +
						(scf.utr5bp ? scf.utr5bp : 0) +
						(scf.upstream ? scf.upstream : 0) +
						(scf.downstream ? scf.downstream : 0)) /
						3
				gmmaxaa = Math.max(gmmaxaa, scf.aatotal)
			} else if (scf.nontemplate) {
				gmmaxaa = Math.max(gmmaxaa, scf.aalen)
			} else {
				chrmaxspan = Math.max(chrmaxspan, scf.stop - scf.start)
			}
		}
		if (chrmaxspan == 0) {
			chrmaxspan = 1000
		}
		let chrsegml = 0 // chr segment max length
		for (const s of scaffold) {
			if (!s.gm && !s.nontemplate) {
				s.start -= chrmaxspan
				s.stop += chrmaxspan
				chrsegml = Math.max(chrsegml, s.stop - s.start)
			}
		}

		// set3
		// set scaffold scale each
		let maxgmpxwidth = this.width
		let maxchrpxwidth = this.width * 0.7
		for (const scf of scaffold) {
			if (scf.gm) {
				scf.pxwidth = (maxgmpxwidth * scf.aatotal) / gmmaxaa
				scf.scale = scaleLinear()
					.domain([0, scf.aatotal]) // 0-base
					.range([0, scf.pxwidth])
			} else if (scf.nontemplate) {
				scf.pxwidth = (maxgmpxwidth * scf.aalen) / gmmaxaa
				scf.scale = scaleLinear().domain([0, scf.aalen]).range([0, scf.pxwidth])
			} else {
				scf.pxwidth = (maxchrpxwidth * (scf.stop - scf.start)) / chrsegml
				scf.scale = scaleLinear().domain([scf.start, scf.stop]).range([0, scf.pxwidth])
			}
			// set relative x for nodes
			if (scf.nontemplate) {
				scf.nodes[0].xoff = 0
				scf.nodes[1].xoff = scf.pxwidth
				// no sorting nodes here
				continue
			}
			for (const n of scf.nodes) {
				if (!scf.gm) {
					n.xoff = scf.scale(n.position)
					continue
				}
				if (n.atupstream) {
					n.aaoff = (scf.upstream - n.atupstream.off) / 3
				} else if (n.atutr5) {
					n.aaoff = (scf.upstream ? scf.upstream / 3 : 0) + n.atutr5.off / 3
				} else if (n.atutr3) {
					n.aaoff =
						(scf.upstream ? scf.upstream / 3 : 0) +
						(scf.utr5bp ? scf.utr5bp / 3 : 0) +
						(scf.aalen ? scf.aalen : scf.bplen / 3) +
						n.atutr3.off / 3
				} else if (n.atdownstream) {
					n.aaoff =
						(scf.upstream ? scf.upstream / 3 : 0) +
						(scf.utr5bp ? scf.utr5bp / 3 : 0) +
						(scf.aalen ? scf.aalen : scf.bplen / 3) +
						(scf.utr3bp ? scf.utr3bp / 3 : 0) +
						n.atdownstream.off / 3
				} else {
					n.aaoff =
						(scf.upstream ? scf.upstream / 3 : 0) +
						(scf.utr5bp ? scf.utr5bp / 3 : 0) +
						(n.codon ? n.codon : n.exonbp / 3)
				}
				n.xoff = scf.scale(n.aaoff)
			}
			// reorder nodes on scaffold
			scf.nodes.sort((a, b) => {
				if (!scf.gm) return a.position - b.position
				if (a.atupstream) {
					if (b.atupstream) return a.atupstream.off - b.atupstream.off
					return -1
				}
				if (a.atutr5) {
					if (b.atupstream) return 1
					if (b.atutr5) return a.atutr5.off - b.atutr5.off
					return -1
				}
				if (a.atutr3) {
					if (b.atupstream || b.atutr5) return 1
					if (b.atutr3) return a.atutr3.off - b.atutr3.off
					if (b.atdownstream) return -1
					return 1
				}
				if (a.atdownstream) {
					if (b.atdownstream) return a.atdownstream.off - b.atdownstream.off
					return 1
				}
				// a is in gene body
				if (b.atupstream || b.atutr5) return 1
				if (b.atdownstream || b.atutr3) return -1
				if (a.exonbp) return a.exonbp - b.exonbp
				return a.codon - b.codon
			})
		}

		// link p domain to scaffold, has to be a better way
		for (const s of scaffold) {
			if (s.gm && s.gm.pdomains) {
				s.gm.pdomains.forEach(function (i) {
					i.__scf = s
				})
			}
		}
		// add hardlink to first and last node, only do this after scaffold pixel width is set
		data.nodes[0].hardlink = {}
		data.nodes[data.nodes.length - 1].hardlink = {}
		// set4
		const setheadtail = () => {
			let n = data.nodes[0]
			let scf = scaffold[n.scfid]
			// TODO detect if n is first node on 5' end of this scaffold, if so draw hard link with special mark
			if (scf.gm) {
				if (n.strand != scf.gm.strand) {
					// antisense
					n.hardlink.xoff = scf.pxwidth
				} else {
					n.hardlink.xoff = 0
				}
			} else {
				if (n.strand == '+') {
					n.hardlink.xoff = 0
				} else {
					n.hardlink.xoff = scf.pxwidth
				}
			}
			// last node hard link
			n = data.nodes[data.nodes.length - 1]
			scf = scaffold[n.scfid]
			// TODO detect if n is last node on 3' end of this scaffold
			if (scf.gm) {
				if (n.strand != scf.gm.strand) {
					// antisense
					n.hardlink.xoff = 0
				} else {
					n.hardlink.xoff = scf.pxwidth
				}
			} else {
				if (n.strand == '+') {
					n.hardlink.xoff = scf.pxwidth
				} else {
					n.hardlink.xoff = 0
				}
			}
		}
		setheadtail()

		const svg = svgdiv.append('svg')
		const g0 = svg.append('g')
		// size and offset will be set later

		const simulation = d3force.forceSimulation(data.nodes).force('link', d3force.forceLink().links(data.links))

		const scfg = g0.selectAll().data(scaffold).enter().append('g')
		const link = g0
			.selectAll()
			.data(data.links)
			.enter()
			.append('line')
			.attr('stroke', 'black')
			.attr('stroke-dasharray', '3,2')
		// component - node
		const node = g0.selectAll().data(data.nodes).enter().append('g')
		const nodelabel = node
			.filter(d => d.label)
			// no label for interstitial nodes
			.append('text')
			.text(d => d.label)
			.attr('font-family', client.font)
			.attr('font-size', nodefontsize)
			.attr('fill', 'black')
			.each(function (d) {
				d.labelwidth = this.getBBox().width
			})
		const nodelabel2 = node
			.filter(d => d.antisense)
			.append('text')
			.text('antisense')
			.attr('font-family', client.font)
			.attr('font-size', nodefontsize)
			.attr('fill', client.colorantisense)
			.each(function (d) {
				d.labelwidth = Math.max(this.getBBox().width, d.labelwidth)
			})
		// node label done, width impacts padding
		for (const d of data.nodes) {
			if (!d.labelwidth) {
				// interstitial nodes have no label
				continue
			}
			leftpad = Math.max(leftpad, d.labelwidth - d.xoff)
			rightpad = Math.max(rightpad, d.labelwidth - scaffold[d.scfid].pxwidth + d.xoff)
		}
		// set5
		const nodebar = node
			.append('rect')
			.attr('height', regionthick)
			.attr('fill', d => (d.antisense ? client.colorantisense : 'black'))
		// component - scaffold
		// set6
		const scftick = scfg
			.append('line')
			.attr('y1', (d, i) => (i % 2 == 0 ? -pad6 : proteinheight))
			.attr('stroke', 'black')
			.attr('stroke-opacity', 0)
			.attr('shape-rendering', 'crispEdges')
		const nontmp = scfg.filter(d => d.nontemplate)
		// set7
		nontmp
			.append('rect')
			.attr('clip-path', d => d.clipid)
			.attr('fill', 'black')
		const chrbar = scfg.filter(d => !d.gm && !d.nontemplate)
		// set8
		chrbar
			.append('rect')
			.attr('fill', 'white')
			.attr('clip-path', d => d.clipid)
		// set9
		const chrbarline1 = chrbar
			.append('line')
			.attr('clip-path', d => d.clipid)
			.attr('stroke', 'black')
		const chrbarline2 = chrbar
			.append('line')
			.attr('clip-path', d => d.clipid)
			.attr('stroke', 'black')
		/*
chrbar.filter(function(d){return d.pxwidth>d.labelwidth+10})
	.append('text')
	.text(function(d){return d.chr})
	.attr('x',function(d){return d.pxwidth/2})
	.attr({
		y:proteinheight/2,
		'font-size':scffontsize,
		'font-family':sja.font,
		fill:'black',
		'text-anchor':'middle',
		'dominant-baseline':'middle'
		})
		*/
		const protein = scfg.filter(d => d.gm)
		// set10
		const pupstream = protein
			.filter(d => d.upstream)
			.append('line')
			.attr('clip-path', d => d.clipid)
			.attr('stroke', '#545454')
			.attr('stroke-dasharray', '2,1')
		// set12
		const p5utr = protein
			.filter(d => d.utr5bp)
			.append('line')
			.attr('clip-path', d => d.clipid)
			.attr('stroke', '#858585')
		// set13
		const p3utr = protein
			.filter(d => d.utr3bp)
			.append('line')
			.attr('clip-path', d => d.clipid)
			.attr('stroke', '#858585')
		// set11
		const pdownstream = protein
			.filter(d => d.downstream)
			.append('line')
			.attr('clip-path', d => d.clipid)
			.attr('stroke', '#545454')
			.attr('stroke-dasharray', '2,1')
		// set14
		const pbg = protein
			.append('rect') // white bar for background
			.attr('clip-path', d => d.clipid)
			.attr('fill', 'white')
		// set15
		const allpdomain = protein
			.filter(d => d.gm.pdomains)
			.selectAll()
			.data(d => d.gm.pdomains)
			.enter()
			.append('rect')
			.attr('clip-path', d => d.__scf.clipid)
			.attr('fill', d => d.color)
		// set15exonboundary
		const exonboundary = protein
			.filter(d => d.gm.exon.length > 1)
			.selectAll()
			.data(d => {
				// uses rna bp length
				let cum = 0
				const lst = []
				let utr5len = 0
				if (d.gm.utr5) {
					for (const e of d.gm.utr5) {
						utr5len += e[1] - e[0]
					}
				}
				const cdslen = d.gm.cdslen || 0
				for (let i = 0; i < d.gm.exon.length - 1; i++) {
					const e = d.gm.exon[i]
					cum += e[1] - e[0]
					const boundary = {
						rnabp: cum,
						scf: d
					}
					if (cum < utr5len) {
						// in 5 utr
						if (d.utr5bp) {
							// show 5 utr
							boundary.utr5 = true
						} else {
							// no show 5 utr
							continue
						}
					} else if (cum > utr5len + cdslen) {
						// in 3 utr
						if (d.utr3bp) {
							// show 3 utr
							boundary.utr3 = true
						} else {
							// no show 3 utr
							continue
						}
					}
					if (!d.utr5bp) {
						// 5 utr not shown, subtract from rnabp
						boundary.rnabp = cum - utr5len
					}
					lst.push(boundary)
				}
				return lst
			})
			.enter()
			.append('line')
			.attr('clip-path', boundary => boundary.scf.clipid)
			.attr('stroke', 'black')
			.attr('stroke-dasharray', '3,2')
			.attr('shape-rendering', 'crispEdges')
			.attr('y1', boundary => {
				return boundary.utr5 || boundary.utr3 ? proteinheight / 4 : 0
			})
			.attr('y2', boundary => {
				return boundary.utr5 || boundary.utr3 ? (proteinheight * 3) / 4 : proteinheight
			})
		// set16
		const pbox = protein
			.append('rect')
			.attr('clip-path', d => d.clipid)
			.attr('stroke-dasharray', d => (d.bplen ? '4,2' : 'none'))
			.attr('fill', 'none')
			.attr('stroke', 'black')
		// right-side text label
		// set17
		const scflabel = scfg
			.append('text')
			.text(d => d.name)
			.attr('font-family', client.font)
			.attr('fill', 'black')
			.attr('font-size', scffontsize)
			.attr('dominant-baseline', 'central')
			.each(function (d) {
				d.chimericlabelw = d.labelwidth = this.getBBox().width
			})

		// scaffold label done, width impacts padding
		for (const s of scaffold) {
			rightpad = Math.max(rightpad, pad3 + s.labelwidth)
		}

		// set18
		const scflabel2 = scfg
			.filter(d => !d.nontemplate)
			.append('text')
			.attr('fill', '#858585')
			// visibility toggled by chimeric
			.attr('fill-opacity', 0)
			.attr('font-size', nodefontsize)
			.attr('font-family', client.font)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', d => (d.id % 2 == 0 ? 'auto' : 'hanging'))
			.text(d => {
				if (d.gm) {
					if (d.nodes.length == 1) {
						const n = d.nodes[0]
						let what
						if (n.atupstream) what = n.atupstream.off + ' bp upstream'
						else if (n.atdownstream) what = n.atdownstream.off + ' bp downstream'
						else if (n.atutr3) what = n.atutr3.off + " bp in 3' UTR"
						else if (n.atutr5) what = n.atutr5.off + " bp in 5' UTR"
						else {
							/*
					if(n.betweencodon) {
						if(n.softlink5) what=(n.codonsideN ? n.codon : n.codon+1)+' AA'
						else what=(n.codonsideN ? n.codon+1 : n.codon)+' AA'
					} else {
					}
					*/
							what = n.codon ? n.codon + ' AA' : n.exonbp + ' bp'
						}
						if (n.softlink5) return 'ends at ' + what
						return 'starts at ' + what
					}
					let n = d.nodes[0]
					let what1
					if (n.atupstream) what1 = n.atupstream.off + ' bp upstream'
					else if (n.atdownstream) what1 = n.atdownstream.off + ' bp downstream'
					else if (n.atutr3) what1 = n.atutr3.off + " bp in 3' UTR"
					else if (n.atutr5) what1 = n.atutr5.off + " bp in 5' UTR"
					else {
						if (n.betweencodon) {
							what1 = (n.codonsideN ? n.codon + 1 : n.codon) + ' AA'
						} else {
							what1 = n.exonbp ? n.exonbp + ' bp ' : n.codon + ' AA'
						}
					}
					n = d.nodes[1]
					let what2
					if (n.atupstream) what2 = n.atupstream.off + ' bp upstream'
					else if (n.atdownstream) what2 = n.atdownstream.off + ' bp downstream'
					else if (n.atutr3) what2 = n.atutr3.off + " bp in 3' UTR"
					else if (n.atutr5) what2 = n.atutr5.off + " bp in 5' UTR"
					else what2 = n.codon ? n.codon + ' AA' : n.exonbp + ' bp'
					return 'from ' + what1 + ' to ' + what2
				}
				if (d.nodes.length == 1) {
					const n = d.nodes[0]
					if (n.softlink5) return 'ends at ' + n.position + ' bp'
					return 'starts at ' + n.position + ' bp'
				}
				return 'from ' + d.nodes[0].position + ' bp to ' + d.nodes[1].position + ' bp'
			})
			.each(function (d) {
				d.chimericlabelw = Math.max(this.getBBox().width, d.chimericlabelw)
			})
		// set19
		const scflabel3 = scfg
			.filter(d => d.nodes[0].antisense)
			.append('text')
			.text('antisense')
			.attr('fill', client.colorantisense)
			// toggled visibility
			.attr('fill-opacity', 0)
			.attr('font-size', nodefontsize)
			.attr('font-family', client.font)
			.attr('text-anchor', 'middle')
			.attr('dominant-baseline', d => (d.id % 2 == 0 ? 'auto' : 'hanging'))
			.each(function (d) {
				d.chimericlabelw = Math.max(this.getBBox().width, d.chimericlabelw)
			})
		// set20
		const scfcliprect = scfg
			.append('defs')
			.append('clipPath')
			.attr('id', d => d.clipid0)
			.append('rect')
			.attr('x', 0)
			.attr('y', 0)
		// set21
		const scfkick = scfg
			.append('rect')
			.attr('clip-path', d => d.clipid)
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.on('mousemove', (event, d) => {
				if (!d.gm) {
					return
				}
				let aa = d.scale.invert(pointer(event)[0])
				let pstr = null
				const domainlst = []
				if (d.upstream) {
					if (aa * 3 < d.upstream) {
						pstr = Math.floor(aa * 3) + ' bp upstream of ' + d.name
					} else {
						aa -= d.upstream / 3
					}
				}
				if (!pstr) {
					if (d.utr5bp) {
						if (aa * 3 < d.utr5bp) {
							pstr = Math.floor(aa * 3) + " bp in 5' UTR of " + d.name
							//+', exon ' +sja.f.coord2exon({gm:d.gm,txoff:Math.floor(aa*3)})
						} else {
							aa -= d.utr5bp / 3
						}
					}
				}
				if (!pstr) {
					if (d.aalen) {
						if (aa <= d.aalen) {
							const i = Math.floor(aa)
							pstr = (d.gm.aaseq ? d.gm.aaseq[i] : 'amino acid ') + i + ' of ' + d.name
							//+', exon ' +sja.f.coord2exon({gm:d.gm,cdsoff:Math.floor(aa*3)})
							if (d.gm.pdomains) {
								for (const dm of d.gm.pdomains) {
									if (dm.start <= aa && dm.stop >= aa && !(dm.name + dm.description in d.gm.domain_hidden)) {
										domainlst.push(dm)
									}
								}
							}
						} else {
							aa -= d.aalen
						}
					} else {
						// no aalen
						if (aa * 3 < d.bplen) {
							pstr = Math.floor(aa * 3) + ' bp in ' + d.name
							//+', exon '+sja.f.coord2exon({gm:d.gm,txoff:Math.floor(aa*3)})
						}
						aa -= d.bplen / 3
					}
				}
				if (!pstr) {
					if (d.utr3bp) {
						if (aa * 3 < d.utr3bp) {
							pstr = Math.floor(aa * 3) + " bp in 3' UTR of " + d.name
							//+', exon '+ sja.f.coord2exon({gm:d.gm,utr3off:Math.floor(aa*3)})
						} else {
							aa -= d.utr3bp / 3
						}
					}
				}
				if (!pstr) {
					pstr = Math.floor(aa * 3) + ' bp downstream of ' + d.name
				}
				gsays.selectAll('*').remove()
				gsays
					.append('text')
					.text(pstr)
					.attr('dominant-baseline', 'hanging')
					.attr('font-family', client.font)
					.attr('font-size', descfontsize)
				let vsp = 5
				for (let i = 0; i < domainlst.length; i++) {
					const dg = gsays.append('g').attr('transform', 'translate(0,' + (descfontsize + vsp) * (i + 1) + ')')
					const dm = domainlst[i]
					const col = dm.color
					dg.append('rect')
						.attr('width', descfontsize)
						.attr('height', descfontsize)
						.attr('fill', col)
						.attr('stroke', d3rgb(col).darker(2).toString())
					let w
					dg.append('text')
						.text(dm.name)
						.attr('x', descfontsize + 5)
						.attr('dominant-baseline', 'hanging')
						.attr('font-family', client.font)
						.attr('font-size', descfontsize)
						.attr('fill', 'black')
						.each(function () {
							w = this.getBBox().width
						})
					dg.append('text')
						.text(dm.description)
						.attr('x', descfontsize + 5 + w + 5)
						.attr('dominant-baseline', 'hanging')
						.attr('font-family', client.font)
						.attr('font-size', descfontsize)
						.attr('fill', '#858585')
				}
				svg.attr(
					'height',
					height - bottompad + Math.max(bottompad, pad7 + (descfontsize + vsp) * (domainlst.length + 1))
				)
			})
			.on('mouseout', () => {
				gsays.selectAll('*').remove()
				svg.attr('height', height)
			})
		// component - tooltip
		const gsays = svg.append('g')
		// component - drag
		const drag = svg
			.append('text')
			.text('drag to resize')
			.attr('class', 'sja_svgtext')
			.attr('fill', 'black')
			.attr('font-size', 12)
			.attr('text-anchor', 'end')
			.on('mousedown', event => {
				const b = d3select(document.body)
				const x0 = event.clientX,
					y0 = event.clientY
				b.on('mousemove', event => {
					event.preventDefault()
					this.width = this.width0 + event.clientX - x0
					setpxsize()
					if (chimeric) {
						tochimeric(false)
					} else {
						simulation.restart()
					}
				})
				b.on('mouseup', () => {
					this.width0 = this.width
					b.on('mousemove', null).on('mouseup', null)
				})
			})
		const setpxsize = () => {
			// set1
			for (const s of scaffold) {
				s.idealy = connheight * s.id + (pad4 + regionthick) * 2 * s.id
			}
			// set2
			height =
				toppad +
				bottompad +
				proteinheight * scaffold.length +
				(pad4 * 2 + regionthick * 2 + connheight) * (scaffold.length - 1)
			simulation.force('x', d3force.forceX(this.width / 2)).force('y', d3force.forceY(height / 2))
			// set3
			maxgmpxwidth = this.width
			maxchrpxwidth = this.width * 0.7
			for (const scf of scaffold) {
				if (scf.gm) {
					scf.pxwidth = (maxgmpxwidth * scf.aatotal) / gmmaxaa
				} else if (scf.nontemplate) {
					scf.pxwidth = (maxgmpxwidth * scf.aalen) / gmmaxaa
				} else {
					scf.pxwidth = (maxchrpxwidth * (scf.stop - scf.start)) / chrsegml
				}
				scf.scale.range([0, scf.pxwidth])
				if (scf.nontemplate) {
					scf.nodes[1].xoff = scf.pxwidth
					continue
				}
				for (const n of scf.nodes) {
					if (!scf.gm) {
						n.xoff = scf.scale(n.position)
						continue
					}
					n.xoff = scf.scale(n.aaoff)
				}
			}
			// set4
			setheadtail()
			// set5
			nodebar
				.attr('x', d => Math.min(d.xoff, d.hardlink.xoff) - d.xoff)
				.attr('width', d => Math.abs(d.xoff - d.hardlink.xoff))
				.attr('y', d => {
					if (d.softlink5) return proteinheight + pad4
					return -pad4 - regionthick
				})
			// set6
			scftick.attr('y2', (d, i) => (i % 2 == 0 ? 0 : proteinheight + pad6))
			// set7
			nontmp
				.select('rect')
				.attr('width', d => d.pxwidth)
				.attr('height', proteinheight)
			// set8
			chrbar
				.select('rect')
				.attr('width', d => d.pxwidth)
				.attr('height', proteinheight)
			// set9
			chrbarline1.attr('x2', d => d.pxwidth)
			chrbarline2
				.attr('x2', d => d.pxwidth)
				.attr('y1', proteinheight)
				.attr('y2', proteinheight)
			// set10
			pupstream
				.attr('x2', d => d.scale(d.upstream / 3))
				.attr('y1', proteinheight / 2)
				.attr('y2', proteinheight / 2)
				.attr('stroke-width', proteinheight / 5)
			// set11
			pdownstream
				.attr('x1', d => {
					return d.scale(
						(d.upstream ? d.upstream / 3 : 0) +
							(d.utr5bp ? d.utr5bp / 3 : 0) +
							(d.aalen ? d.aalen : d.bplen / 3) +
							(d.utr3bp ? d.utr3bp / 3 : 0)
					)
				})
				.attr('x2', d => {
					return d.scale(
						(d.upstream ? d.upstream / 3 : 0) +
							(d.utr5bp ? d.utr5bp / 3 : 0) +
							(d.aalen ? d.aalen : d.bplen / 3) +
							(d.utr3bp ? d.utr3bp / 3 : 0) +
							d.downstream / 3
					)
				})
				.attr('y1', proteinheight / 2)
				.attr('y2', proteinheight / 2)
				.attr('stroke-width', proteinheight / 5)
			// set12
			p5utr
				.attr('x1', d => (d.upstream ? d.scale(d.upstream / 3) : 0))
				.attr('x2', d => d.scale(((d.upstream ? d.upstream : 0) + d.utr5bp) / 3))
				.attr('y1', proteinheight / 2)
				.attr('y2', proteinheight / 2)
				.attr('stroke-width', Math.floor(proteinheight / 2) + 0.5)
			// set13
			p3utr
				.attr('x1', d => {
					return d.scale(
						(d.upstream ? d.upstream / 3 : 0) + (d.utr5bp ? d.utr5bp / 3 : 0) + (d.aalen ? d.aalen : d.bplen / 3)
					)
				})
				.attr('x2', d => {
					return d.scale(
						(d.upstream ? d.upstream / 3 : 0) +
							(d.utr5bp ? d.utr5bp / 3 : 0) +
							(d.aalen ? d.aalen : d.bplen / 3) +
							(d.utr3bp ? d.utr3bp / 3 : 0)
					)
				})
				.attr('y1', proteinheight / 2)
				.attr('y2', proteinheight / 2)
				.attr('stroke-width', Math.floor(proteinheight / 2) + 0.5)
			// set14
			pbg
				.attr('x', d => {
					return d.scale((d.upstream ? d.upstream / 3 : 0) + (d.utr5bp ? d.utr5bp / 3 : 0))
				})
				.attr('width', d => d.scale(d.aalen ? d.aalen : d.bplen / 3) - d.scale(0))
				.attr('height', proteinheight)
			// set15
			allpdomain
				.attr('x', d => {
					const scf = d.__scf
					return scf.scale((scf.upstream ? scf.upstream / 3 : 0) + (scf.utr5bp ? scf.utr5bp / 3 : 0) + d.start)
				})
				.attr('width', d => {
					const scf = d.__scf
					return scf.scale(d.stop) - scf.scale(d.start)
				})
				.attr('height', proteinheight)
			// set15exonboundary
			exonboundary
				.attr('x1', boundary => {
					const scf = boundary.scf
					boundary.x = scf.scale((scf.upstream ? scf.upstream / 3 : 0) + boundary.rnabp / 3)
					return boundary.x
				})
				.attr('x2', boundary => {
					return boundary.x
				})
			// set16
			pbox
				.attr('x', d => {
					return d.scale((d.upstream ? d.upstream / 3 : 0) + (d.utr5bp ? d.utr5bp / 3 : 0))
				})
				.attr('width', d => d.scale(d.aalen ? d.aalen : d.bplen / 3) - d.scale(0))
				.attr('height', proteinheight)
			// set17
			scflabel.attr('x', d => d.pxwidth + pad3).attr('y', proteinheight / 2)
			// set18
			scflabel2.attr('y', d =>
				d.id % 2 == 0 ? -pad6 * 2 - scffontsize - pad6 : proteinheight + pad6 * 2 + scffontsize + pad6
			)
			// set19
			scflabel3.attr('y', d =>
				d.id % 2 == 0
					? -pad6 * 2 - scffontsize - pad6 - nodefontsize - pad6
					: proteinheight + pad6 * 2 + scffontsize + pad6 + nodefontsize + pad6
			)
			// set20
			scfcliprect.attr('height', proteinheight).attr('width', d => d.pxwidth + pad3 + d.labelwidth)
			// set21
			scfkick.attr('width', d => d.pxwidth).attr('height', proteinheight)
			svg.attr('width', this.width + leftpad + rightpad).attr('height', height)
			g0.attr('transform', 'translate(' + leftpad + ',' + toppad + ')')
			gsays.attr('transform', 'translate(' + leftpad + ',' + (height - bottompad + pad7) + ')')
			drag.attr('x', leftpad + this.width + rightpad - 5).attr('y', height - 7)
			// done setting pixel size
		}
		setpxsize()
		simulation
			.on('tick', () => {
				// set y by scaffold
				const scf2ymean = []
				for (const s of scaffold) {
					let sum = 0
					for (const d of s.nodes) {
						sum += d.y
					}
					scf2ymean[s.id] = sum / s.nodes.length
				}
				for (const scf of scaffold) {
					// scaffold y position can adjust and wobble
					let y = scf2ymean[scf.id]
					let changed = false
					if (y > scf.idealy) {
						y -= Math.min(15, y - scf.idealy)
						changed = true
					} else if (y < scf.idealy) {
						y += Math.min(15, scf.idealy - y)
						changed = true
					}
					if (changed) {
						scf2ymean[scf.id] = y
						for (const n of scf.nodes) {
							n.y = y
						}
					}
				}
				// in each scaffold, set x for nodes
				for (const scf of scaffold) {
					// use first node as left anchor
					const n0 = scf.nodes[0]
					if (n0.x < n0.xoff) {
						// left curb
						n0.x += Math.min(10, n0.xoff - n0.x)
					} else if (n0.x > this.width - scf.pxwidth + n0.xoff) {
						// right curb
						n0.x -= Math.min(10, n0.x - (this.width - scf.pxwidth + n0.xoff))
					}
					for (let i = 1; i < scf.nodes.length; i++) {
						scf.nodes[i].x = n0.x + (scf.nodes[i].xoff - n0.xoff)
					}
				}
				scfg.attr('transform', scf => 'translate(' + (scf.nodes[0].x - scf.nodes[0].xoff) + ',' + scf.nodes[0].y + ')')
				// scaffold position are set
				// set position for invisible nodes
				node.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
				nodelabel
					.attr('text-anchor', d => {
						if (d.softlink3) {
							return d.softlink3.x < d.x ? 'start' : 'end'
						}
						return d.softlink5.x < d.x ? 'start' : 'end'
					})
					.attr('y', d => {
						if (d.softlink3) return -pad4 - regionthick - pad2
						if (d.softlink5) return proteinheight + pad4 + regionthick + pad2
					})
					.attr('dominant-baseline', d => {
						if (d.softlink3) return 'auto'
						if (d.softlink5) return 'hanging'
					})
				nodelabel2
					.attr('text-anchor', d => {
						if (d.softlink3) return d.softlink3.x < d.x ? 'start' : 'end'
						return d.softlink5.x < d.x ? 'start' : 'end'
					})
					.attr('y', d => {
						if (d.softlink3) return -pad4 - regionthick - pad2 - nodefontsize - pad2 / 2
						if (d.softlink5) return proteinheight + pad4 + regionthick + pad2 + nodefontsize + pad2 / 2
					})
					.attr('dominant-baseline', d => {
						if (d.softlink3) return 'auto'
						if (d.softlink5) return 'hanging'
					})

				link
					.attr('x1', d => d.source.x)
					.attr('y1', d => d.source.y + proteinheight + pad4 + regionthick)
					.attr('x2', d => d.target.x)
					.attr('y2', d => {
						if (d.target.scfid == d.source.scfid) {
							return d.source.y + proteinheight + pad4 + regionthick
						}
						return d.target.y - pad4 - regionthick
					})
			})
			.restart()
		const dur = 500
		const tochimeric = slow => {
			// set chimeric sizes
			for (const scf of scaffold) {
				const n0 = scf.nodes[0]
				if (scf.nodes.length == 1) {
					scf.chimericwidth = Math.abs(n0.xoff - n0.hardlink.xoff)
				} else {
					let min = n0.xoff,
						max = n0.xoff
					for (const n of scf.nodes) {
						min = Math.min(min, n.xoff)
						max = Math.max(max, n.xoff)
					}
					scf.chimericwidth = max - min
				}
				let x = n0.xoff
				if (scf.nodes.length == 1) {
					x = Math.min(x, n0.hardlink.xoff)
				}
				scf.chimericmidx = x + scf.chimericwidth / 2
			}
			// chimeric horizontal position, neither label nor box should overlap, keep track of horizontal offset for top-label, middle-box, bottom-label
			// do this after making scaffold labels
			let topx = 0,
				midx = 0,
				botx = 0
			// stack mid box
			const labelspacing = pad5 * 2
			for (let i = 0; i < scaffold.length; i++) {
				const scf = scaffold[i]
				let thiscenterx = midx + pad5 * 2 + scf.chimericwidth / 2
				if (i % 2 == 0) {
					// label on top
					thiscenterx = Math.max(thiscenterx, topx + labelspacing + scf.chimericlabelw / 2)
					topx = thiscenterx + scf.chimericlabelw / 2
				} else {
					// bottom
					thiscenterx = Math.max(thiscenterx, botx + labelspacing + scf.chimericlabelw / 2)
					botx = thiscenterx + scf.chimericlabelw / 2
				}
				scf.chimericcenterx = thiscenterx
				// center x has been set
				midx = thiscenterx + scf.chimericwidth / 2
				// shear off x for positioning scaffold g
				const n0 = scf.nodes[0]
				let xshear = n0.xoff
				if (scf.nodes.length == 1) {
					xshear = Math.min(n0.xoff, n0.hardlink.xoff)
				}
				scf.chimericx = thiscenterx - scf.chimericwidth / 2 - xshear
			}
			// position
			scfcliprect
				.transition()
				.duration(slow ? dur : 0)
				.attr('x', d => {
					const n0 = d.nodes[0]
					if (d.nodes.length == 1) {
						return Math.min(n0.xoff, n0.hardlink.xoff)
					}
					let min = n0.xoff
					for (const n of d.nodes) {
						min = Math.min(min, n.xoff)
					}
					return min
				})
				.attr('width', d => d.chimericwidth)
			scflabel
				.attr('text-anchor', 'middle')
				.attr('x', d => d.chimericmidx)
				.attr('y', (d, i) => (i % 2 == 0 ? -pad6 * 2 : proteinheight + pad6 * 2))
				.attr('dominant-baseline', (d, i) => (i % 2 == 0 ? 'auto' : 'hanging'))
			nodelabel.attr('fill-opacity', 0)
			nodelabel2.attr('fill-opacity', 0)
			nodebar.attr('fill-opacity', 0)
			scftick
				.attr('stroke-opacity', 1)
				.attr('x1', d => d.chimericmidx)
				.attr('x2', d => d.chimericmidx)
			scflabel2.attr('fill-opacity', 1).attr('x', d => d.chimericmidx)
			scflabel3.attr('fill-opacity', 1).attr('x', d => d.chimericmidx)
			// all on same height
			const yset = (height - toppad * 2) / 2 - proteinheight / 2
			scfg
				.transition()
				.duration(slow ? dur : 0)
				.attr('transform', d => {
					// apply new position to nodes
					for (const n of d.nodes) {
						n.x = d.chimericx + n.xoff
						n.y = yset
					}
					return 'translate(' + d.chimericx + ',' + yset + ')'
				})
			node
				.transition()
				.duration(slow ? dur : 0)
				.attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
			link
				.transition()
				.duration(slow ? dur : 0)
				.attr('x1', d => {
					const s1 = scaffold[d.source.scfid]
					const s2 = scaffold[d.target.scfid]
					d.chimericx = (s1.chimericcenterx + s1.chimericwidth / 2 + s2.chimericcenterx - s2.chimericwidth / 2) / 2
					return d.chimericx
				})
				.attr('x2', d => d.chimericx)
				.attr('y1', yset)
				.attr('y2', yset + proteinheight)
			// set new width to svg based on offset of last scaffold
			const s = scaffold[scaffold.length - 1]
			const w2 = s.chimericcenterx + Math.max(s.chimericlabelw / 2, s.chimericwidth / 2)
			svg
				.transition()
				.duration(slow ? dur : 0)
				.attr('width', leftpad + w2 + rightpad)
			drag
				.transition()
				.duration(slow ? dur : 0)
				.attr('x', leftpad + w2 + rightpad - dragwidth)
			// end of tochimeric
		}
		let chimeric = false
		buttdiv
			.append('button')
			.text('Toggle chimeric view')
			.on('click', () => {
				chimeric = !chimeric
				if (chimeric) {
					simulation.stop()
					tochimeric(true)
					return
				}
				scfcliprect
					.transition()
					.duration(dur)
					.attr('x', 0)
					.attr('width', d => d.pxwidth + pad3 + d.labelwidth)
				scflabel
					.attr('text-anchor', 'start')
					.attr('dominant-baseline', 'central')
					.attr('x', d => d.pxwidth + pad3)
					.attr('y', proteinheight / 2)
				nodelabel.attr('fill-opacity', 1)
				nodelabel2.attr('fill-opacity', 1)
				nodebar.attr('fill-opacity', 1)
				scftick.attr('stroke-opacity', 0)
				scflabel2.attr('fill-opacity', 0)
				scflabel3.attr('fill-opacity', 0)
				svg
					.transition()
					.duration(dur)
					.attr('width', leftpad + this.width + rightpad)
				drag
					.transition()
					.duration(dur)
					.attr('x', leftpad + this.width + rightpad - dragwidth)
				simulation.alpha(0.3).restart()
			})
		const dgmlst = []
		for (const s of scaffold) {
			if (s.gm && s.gm.pdomains) {
				dgmlst.push(s)
			}
		}
		if (dgmlst.length) {
			let pdmshown = false
			buttdiv
				.append('button')
				.text('Protein domains')
				.on('click', () => {
					if (!pdmshown) {
						pdmshown = true
						for (const scf of dgmlst) {
							const d = domaindiv.append('div').style('margin-bottom', '10px').style('padding', '10px')
							d.append('div')
								.style('margin-bottom', '10px')
								.html(scf.gm.name + ' ' + scf.gm.isoform)
								.append('div')
							const lst = client.getdomaintypes(scf.gm)
							for (const e of lst) {
								const d2 = d.append('div')
								const cbox = d2
									.append('div')
									.style('display', 'inline-block')
									.style('padding', '2px 3px')
									.style('border', 'solid 1px ' + e.stroke)
									.style('font-family', 'Courier')
									.style('margin-right', '10px')
									.style('background-color', e.fill)
									.style('cursor', 'default')
									.html('&nbsp;')
									.on('click', event => {
										if (scf.gm.domain_hidden[e.key]) {
											delete scf.gm.domain_hidden[e.key]
										} else {
											scf.gm.domain_hidden[e.key] = 1
										}
										allpdomain
											.filter(d => d.__scf.clipid == scf.clipid && d.name + d.description == e.key)
											.transition()
											.attr('height', () => {
												if (e.key in scf.gm.domain_hidden) {
													event.target.innerHTML = '&times;'
													return 0
												}
												event.target.innerHTML = '&nbsp;'
												return proteinheight
											})
									})
								const colorbtn = d2
									.append('input')
									.attr('type', 'color')
									.style('display', 'none')
									.property('value', e.fill)
								d2.append('span')
									.text(e.name)
									.attr('class', 'sja_clbtext2')
									.style('margin-right', '5px')
									.property('title', 'Click to edit color of this domain')
									.on('click', event => {
										colormenu.clear().showunder(event.target)
										const input = colormenu.d
											.append('input')
											.attr('type', 'text')
											.property('value', e.fill)
											.style('width', '100px')
											.on('keyup', event => {
												if (!client.keyupEnter(event)) return
												const v = event.target.value.trim()
												if (!v) return
												cbox.style('background', v)
												allpdomain
													.filter(d => d.__scf.clipid == scf.clipid && d.name + d.description == e.key)
													.transition()
													.attr('fill', v)
												scf.gm.pdomains.forEach(d => {
													if (d.name + d.description == e.key) {
														d.color = v
													}
												})
											})
											.node()
										input.focus()
										input.select()
										colormenu.d
											.append('div')
											.style('margin-top', '10px')
											.style('opacity', 0.5)
											.style('font-size', '.8em')
											.html('To change the color of this domain,<br>type in a new color and press ENTER.')
									})
								d2.append('span').text(e.description).style('font-size', '.7em').style('color', '#858585')
							}
						}
					}
					if (domaindiv.style('display') == 'none') {
						client.appear(domaindiv)
					} else {
						client.disappear(domaindiv)
					}
				})
		}

		buttdiv
			.append('button')
			.text('SVG')
			.on('click', () => {
				const lst = scaffold.map(a => a.name)
				const legendG = svg.append('g').style('font-family', 'Arial')
				let legendGrps = []

				// create legend group with items for use by legen renderer
				if (dgmlst.length) {
					for (const scf of dgmlst) {
						const grp = {
							text: scf.gm.name + ' ' + scf.gm.isoform,
							items: []
						}
						const lst = client.getdomaintypes(scf.gm)
						for (const e of lst) {
							if (!(e.key in scf.gm.domain_hidden)) {
								const text = [e.name, e.description] //.join(' '); console.log(text)
								if (text[1].length > 80) {
									text[1] = text[1].substr(0, 77) + '...'
								}
								grp.items.push({
									fill: e.fill,
									text: text
								})
							}
						}
						legendGrps.push(grp)
					}
				}
				const bbs = svg.node().getBBox()
				// configure a legend renderer function
				const legendRenderer = hm2legend(
					{
						legendontop: false,
						svgw: bbs.width,
						svgh: bbs.height,
						legendhangleft: false,
						titleline: true,
						legendpadleft: 10,
						legendfontsize: 12,
						legendlinesep: true,
						samplecount4legend: false,
						h: {
							legend: legendGrps
						},
						handlers: {
							legend: {
								mouseover: () => {}
							}
						}
					},
					d => d.fill,
					d => d.text,
					d => '#aaa'
				)
				// actually render the legend using the legendGrps data
				// legendG is just the holder created above
				legendRenderer(legendG)

				// compute dimensions for adjusting svg height
				const w = +svg.attr('width')
				const h = +svg.attr('height')
				const bbl = legendG.node().getBBox()
				svg.attr('width', w + bbl.width).attr('height', h + bbl.height + 10)

				drag.style('display', 'none')
				client.to_svg(svg.node(), lst.join('-'))
				drag.style('display', '')

				// remove legend and revert svg dimensions
				// after SVG download
				legendG.remove()
				svg.attr('width', w).attr('height', h)
			})
		buttdiv
			.append('a')
			.attr('href', 'https://docs.google.com/document/d/1LgcMk_p1qyPgFPQChy4sLlU9GDL6oahffP7jJfD8ZwE/edit?usp=sharing')
			.attr('target', '_blank')
			.text('Help')
			.style('padding-left', '10px')
		// end of draw
	}
}

function nodecheck(n) {
	if (n.gm) {
		if (!Number.isFinite(n.position)) {
			if (!Number.isFinite(n.rnaposition)) {
				if (!Number.isFinite(n.codon)) return 'no position provided genome/rna/codon'
				n.rnaposition = (n.gm.utr5 ? n.gm.utr5.reduce((i, j) => i + j[1] - j[0], 0) : 0) + n.codon * 3 - 1
			}
			if (!Number.isFinite(n.rnaposition)) return 'neither genomic or rna position given for node'
			n.position = coord.rna2gmcoord(n.rnaposition, n.gm)
			if (n.position == null) return 'cannot map rnaposition ' + n.rnaposition + ' to ' + n.gm.isoform
		}
		const t = coord.genomic2gm(n.position, n.gm, 5) // XXX tempoff must remove later
		n.exonbp = t.rnapos
		if (!Number.isFinite(n.codon)) n.codon = t.aapos
		n.atintron = t.atintron
		n.exon = t.atexon
		n.atutr3 = t.atutr3
		n.atutr5 = t.atutr5
		n.atupstream = t.atupstream
		n.atdownstream = t.atdownstream
	} else {
		// intergenic or no gene provided
		if (!n.chr || !n.position) {
			return 'missing genomic position for intergenic breakpoint'
		}
	}
	return false
}
function copynode(n, scaffold, data) {
	// validate
	const a = {}
	for (const k in n) {
		a[k] = n[k]
	}
	if (!a.gm) {
		a.label = a.chr + ':' + a.position
	} else if (a.atupstream) {
		a.label = a.atupstream.off + ' bp upstream'
	} else if (a.atdownstream) {
		a.label = a.atdownstream.off + ' bp downstream'
	} else if (a.atutr3) {
		if (a.atintron) {
			a.label = 'intron ' + a.atintron + ", 3' UTR"
		} else {
			a.label = "3' UTR" + (a.exon ? ', exon ' + a.exon : '')
		}
	} else if (a.atutr5) {
		if (a.atintron) {
			a.label = 'intron ' + a.atintron + ", 5' UTR"
		} else {
			a.label = "5' UTR" + (a.exon ? ', exon ' + a.exon : '')
		}
	} else if (a.atintron) {
		a.label = 'intron ' + a.atintron + (a.codon ? ', ' + a.codon + ' AA' : '')
		/*
			+(a.betweencodon ? 
				(a.codonsideN ? ', between '+a.codon+' and '+(a.codon+1)+' AA' :
					', between '+(a.codon-1)+' and '+a.codon+' AA')
				: (a.exonbp ? ', '+a.exonbp+' bp' : ', '+a.codon+' AA')
			)
			*/
	} else {
		a.label = (a.exon ? 'exon ' + a.exon + ', ' : '') + (a.codon ? a.codon + ' AA' : a.exonbp + ' bp')
	}
	if (a.strand && a.gm) {
		if (a.strand != a.gm.strand) {
			a.antisense = true
		}
	}
	data.nodes.push(a)
	scaffold[a.scfid].nodes.push(a)
	return a
}
