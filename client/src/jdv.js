import * as client from './client'
import { json as d3json } from 'd3-request'
import vcf2dstk from '#shared/vcf.tkconvert'
import getdefault_exonskipalt from './spliceevent.exonskip.getdefault'
import { bplen, exoncolor } from '#shared/common.js'
import { select as d3select } from 'd3-selection'
import blocklazyload from './block.lazyload'

/*
aberrant junctions and those that can be explained by dna variants
has been found by combined analysis of junction/dna vcf
load them here for manual review


MAJOR export:

jdvparseinput()
	render result



TODO

sort and filter the list

*/

const bar_exonskip = {
	width: 40,
	height: 12,
	fillbg: '#ededed',
	fill: '#990000'
}

const bar_competesite = {
	width: 40,
	height: 12,
	fillbg: '#ededed',
	fill: '#004D99'
}

export function jdvparseinput(jdv, holder) {
	/*
	called by embedding api
	*/
	jdv.holder = holder
	jdv.holder.style('display', 'inline-block')

	if (jdv.result) {
		// to show result for a single sample
		launchsample(jdv, jdv.result)
	}
	// cohort result?
}

function launchsample(jdv, spobj) {
	/*
	step 1
	launch a sample, junctions may be loaded or not
	*/

	if (!spobj.ui) {
		makesampleui(spobj, jdv)
	}

	if (spobj.tracks) {
		initblocktrack(jdv, spobj)
	}

	if (spobj.junctions) {
		// junction data already loaded for this sample
		showsample(jdv, spobj)
		return
	}

	serverquery4sample(jdv, spobj)
}

function initblocktrack(jdv, spobj) {
	// screen tracks, convert vcf to ds
	const lst = []
	for (const tk of spobj.tracks) {
		if (!tk.type) {
			client.sayerror(spobj.ui.errdiv, 'Missing type for one of the track')
			continue
		}
		if (tk.type == 'vcf') {
			const [err, dstk] = vcf2dstk({
				name: tk.name,
				file: tk.file,
				url: tk.url,
				indexURL: tk.indexURL
			})
			if (err) {
				client.sayerror(spobj.ui.errdiv, 'VCF track error: ' + err)
				continue
			}
			dstk.iscustom = true
			dstk.tkid = Math.random().toString()
			lst.push(dstk)
		} else {
			tk.tkid = Math.random().toString()
			lst.push(tk)
		}
	}
	if (lst.length) {
		// has custom track, add one gene track
		client.first_genetrack_tolist(jdv.genome, lst)
		const param = {
			hostURL: jdv.hostURL,
			jwt: jdv.jwt,
			holder: spobj.ui.column2,
			genome: jdv.genome,
			chr: jdv.genome.defaultcoord.chr,
			start: jdv.genome.defaultcoord.start,
			stop: jdv.genome.defaultcoord.stop,
			nobox: true,
			tklst: lst
		}
		blocklazyload(param).then(bb => {
			spobj.block = bb
		})
		/* this still created duplicated block
		import('./block').then(B=>{
			spobj.block = new B.Block(param)
		})
		*/
	}
}

function serverquery4sample(jdv, spobj) {
	/*
	step 2
	load junctions for a sample by calling server
	can be used to initiate a sample, or to load more data upon clicking button
	*/
	if (!spobj.junctions) {
		spobj.junctions = []
	}
	if (spobj.ui) {
		spobj.ui.loadbutton.attr('disabled', 1)
	}

	// haven't loaded junctions yet
	if (spobj.textfile) {
		// server-hosted text file, read first 100 lines
		d3json(jdv.hostURL + '/textfile').post(
			JSON.stringify({ file: spobj.textfile, from: spobj.junctions.length + 1, to: 100 }),
			data => {
				if (spobj.ui) {
					spobj.ui.loadbutton.attr('disabled', null)
				}
				parsesampletext(jdv, spobj, data)
			}
		)
	} else if (spobj.texturl) {
		// url-hosted text file
		// able to do the same??
	}
}

function parsesampletext(jdv, spobj, data) {
	/*
	step 2
	parse text data passed from server
	append parsed junctions to spobj.junction
	*/
	if (!data) {
		client.sayerror(jdv.holder, 'server error')
		return
	}
	if (data.error) {
		client.sayerror(jdv.holder, 'Error getting sample data: ' + data.error)
		return
	}
	if (!data.text) {
		client.sayerror(jdv.holder, 'no more data?')
		return
	}
	const text = data.text.trim()
	if (text == '') {
		return
	}
	const lines = text.split('\n')
	const invalidcoord = []
	const invalidjson = []
	const newjunctionlst = []
	for (const line of lines) {
		const l = line.split('\t')
		const j = {
			chr: l[0],
			start: Number.parseInt(l[1]),
			stop: Number.parseInt(l[2])
		}

		if (Number.isNaN(j.start) || Number.isNaN(j.stop)) {
			invalidcoord.push(line)
			continue
		}
		try {
			j.jd = JSON.parse(l[3])
		} catch (e) {
			invalidjson.push(line)
			continue
		}

		newjunctionlst.push(j)
	}
	if (invalidcoord.length) {
		client.sayerror(jdv.holder, invalidcoord.length + ' lines with invalid chr position')
	}
	if (invalidjson.length) {
		client.sayerror(jdv.holder, invalidcoord.length + ' lines with invalid chr position')
	}
	newjunction2table(spobj, newjunctionlst)
}

function showsample(jdv, spobj) {
	/*
	sample junction data have been loaded, make view
	*/
}

function newjunction2table(spobj, jlst) {
	/*
	for this sample,
	add new junctions to table
	spobj.ui must be available
	*/
	if (jlst.length == 0) {
		return
	}

	for (const j of jlst) {
		// only push here so that serial will work
		spobj.junctions.push(j)

		const tr = spobj.ui.listtable.append('tr').attr('class', 'sja_clb_gray')

		tr.on('click', () => click_junctiontableentry(j, spobj, tr))

		// TODO check sbobj for any filtering to see if to hide this row

		let td
		// 0
		tr.append('td').style('color', '#ccc').text(spobj.junctions.length)

		// 1 - junction pos
		tr.append('td')
			.style('font-size', '.8em')
			.html(
				j.chr +
					':' +
					(j.start + 1) +
					'-' +
					(j.stop + 1) +
					'<br><span style="color:#858585">' +
					bplen(j.stop - j.start) +
					'</span>'
			)

		// 2 - read count
		tr.append('td').style('color', '#aaa').text(j.jd.readcount)

		// 3 - gene
		tr.append('td').text(cellvalue_genename4junction(j.jd))

		// 4 - exon skip
		td = tr.append('td')
		if (j.jd.exonskip) {
			cellvalue_exonskip(td, j.jd.exonskip)
		} else {
			td.append('span').text('-').style('padding-right', '50px').style('color', '#ccc')
		}

		// 5 - j.start snv
		td = tr.append('td')
		if (j.jd.leftsnv || j.jd.rightsnv) {
			const look = j.jd.leftsnv || j.jd.rightsnv
			td.text(look.snv.ref + '/' + look.snv.mut)
		} else {
			td.append('span').text('-').style('padding-right', '50px').style('color', '#ccc')
		}

		// 6 - compete site
		td = tr.append('td')
		if (j.jd.leftcompete || j.jd.rightcompete) {
			cellvalue_competesite(td, j.jd.leftcompete || j.jd.rightcompete, j.jd.readcount)
		} else {
			td.append('span').text('-').style('padding-right', '50px').style('color', '#ccc')
		}

		// 7 - logo
		td = tr.append('td')
		junctiondiagram(td, j)
	}
	spobj.ui.listtable.node().appendChild(spobj.ui.loadtr.node())

	// new rows filled, check with spobj for any sorting TODO
}

function makesampleui(spobj, jdv) {
	/*
	make ui for a single sample
	*/
	const headerpad = '30px'

	// two columns: junction listing, browser view
	const container = jdv.holder.append('table')
	const tr0 = container.append('tr')
	const column1 = tr0.append('td').style('vertical-align', 'top')
	const column2 = tr0.append('td').style('vertical-align', 'top')

	const errdiv = column1.append('div').style('margin-bottom', '10px')

	const div = column1.append('div').style('padding-top', headerpad).style('position', 'relative')

	const scrollholder = div
		.append('div')
		.style('overflow-y', 'scroll')
		.style('height', '600px')
		.style('resize', 'vertical')

	const listtable = scrollholder.append('table').style('border-spacing', '2px').style('border-collapse', 'separate')

	const header = listtable.append('tr').style('font-size', '.8em')

	// 0 - id
	header.append('td')
	// 1 - junction pos
	header.append('td')
	// 2 - read count
	header.append('td').append('div').style('position', 'absolute').style('top', '1px').html('read<br>count')
	// 3 - gene
	header.append('td').append('div').style('position', 'absolute').style('top', '1px').text('gene')
	// 4 - exon skip
	header.append('td').append('div').style('position', 'absolute').style('top', '1px').html('exon<br>skipping')
	// 5 - j.start snv
	header.append('td').append('div').style('position', 'absolute').style('top', '1px').html('snv')
	// 6 - compete site
	header.append('td').append('div').style('position', 'absolute').style('top', '1px').html('competing<br>site')
	// 7 - logo
	header.append('td').append('div').style('position', 'absolute').style('top', '1px')

	// button to load more junctions
	const loadtr = listtable.append('tr')
	const loadbutton = loadtr
		.append('td')
		.attr('colspan', 7)
		.style('text-align', 'center')
		.append('button')
		.text('Load next 100 junctions')
		.on('click', () => {
			serverquery4sample(jdv, spobj)
		})

	spobj.ui = {
		container: container,
		errdiv: errdiv,
		listtable: listtable,
		loadtr: loadtr,
		loadbutton: loadbutton,
		column2: column2
	}
}

function cellvalue_genename4junction(j) {
	if (j.exonskip) {
		return j.exonskip[0].gene
	}
	let gene1
	if (j.exonleft) {
		gene1 = j.exonleft[0].gene
	}
	if (j.leftsnv) {
		gene1 = j.leftsnv.gene
	}
	if (j.leftcompete) {
		gene1 = j.leftcompete.gene
	}
	let gene2
	if (j.exonright) {
		gene2 = j.exonright[0].gene
	}
	if (j.rightsnv) {
		gene2 = j.rightsnv.gene
	}
	if (j.rightcompete) {
		gene2 = j.rightcompete.gene
	}
	if (gene1) {
		if (gene2) {
			if (gene1 == gene2) {
				return gene1
			}
			return gene1 + ', ' + gene2
		} else {
			return gene1
		}
	} else if (gene2) {
		return gene2
	} else {
		return '-'
	}
}

function cellvalue_exonskip(td, events) {
	const bardiv = td.append('div').style('display', 'inline-block').style('margin-right', '5px')
	client.fillbar(bardiv, { f: events[0].fraction }, bar_exonskip)
	// exon numbers
	td.append('span').html(
		'<span style="font-size:.7em;color:#ccc">EXON</span>' + events[0].skippedexon.map(i => i + 1).join(',')
	)
}

function cellvalue_competesite(td, competelst, noveljreadcount) {
	/*
	finding report is a list of competing sites, isoform-specific
	need to define which compete site to show by default
	*/

	const usecompete = selectOneCompeteSiteDef(competelst, noveljreadcount)

	phrase_competesite(td, usecompete, noveljreadcount)
}

function click_junctiontableentry(j, spobj, tr) {
	console.log(j)
	// clear highlight for all junctions
	for (const tr2 of spobj.ui.listtable.node().childNodes) {
		d3select(tr2).style('background-color', null)
	}
	tr.style('background-color', '#ffffcc')

	if (!spobj.block) {
		console.log('no block')
		return
	}

	// highlight current junction in the junction track
	for (const tk of spobj.block.tklst) {
		if (tk.type == client.tkt.junction) {
			tk.hljunctions = [{ chr: j.chr, start: j.start, stop: j.stop }]
			break
		}
	}

	const hlvariants = []
	if (j.jd.leftsnv) {
		const m = j.jd.leftsnv.snv
		hlvariants.push({ chr: m.chr, pos: m.pos, ref: m.ref, alt: m.mut })
	}
	if (j.jd.rightsnv) {
		const m = j.jd.rightsnv.snv
		hlvariants.push({ chr: m.chr, pos: m.pos, ref: m.ref, alt: m.mut })
	}
	const clst = j.jd.leftcompete || j.jd.rightcompete
	if (clst) {
		for (const c of clst) {
			if (c.snvatcompetesite) {
				const m = c.snvatcompetesite.snv
				hlvariants.push({ chr: m.chr, pos: m.pos, ref: m.ref, alt: m.mut })
			}
		}
	}
	for (const tk of spobj.block.tklst) {
		if (tk.type == client.tkt.ds) {
			if (hlvariants.length) {
				tk.hlvariants = hlvariants
			} else {
				delete tk.hlvariants
			}
			break
		}
	}

	const span = Math.ceil((j.stop - j.start) / 2)
	spobj.block.jump_1basedcoordinate(j.chr + ' ' + (j.start - span) + ' ' + (j.stop + span))
}

function selectOneCompeteSiteDef(competelst, noveljreadcount) {
	// select one definition to report from a list of compete sites
	let usecompete = competelst[0]
	for (let i = 1; i < competelst.length; i++) {
		const c2 = competelst[i]
		if (c2.competejunction) {
			if (usecompete.competejunction) {
				if (c2.competejunction.v > usecompete.competejunction.v) {
					usecompete = c2
				}
			} else {
				usecompete = c2
			}
		} else {
			if (!usecompete.competejunction) {
				if (c2.sitedist < usecompete.sitedist) {
					usecompete = c2
				}
			}
		}
	}
	return usecompete
}

function phrase_competesite(div, compete, noveljreadcount) {
	/*
	in the junction table, show logo for a compete site, isoform-level
	*/
	const bardiv = div.append('div').style('display', 'inline-block').style('margin-right', '5px')

	let fraction
	if (compete.competejunction) {
		fraction = noveljreadcount / (noveljreadcount + compete.competejunction.v)
	} else {
		// no canonical junction at compete site
		fraction = 1
	}
	client.fillbar(bardiv, { f: fraction }, bar_competesite)
	// exon
	div.append('span').html('<span style="font-size:.7em;color:#ccc">EXON</span>' + (compete.exonidx + 1) + '&nbsp;&nbsp')
	// distance
	div.append('span').html('<span style="font-size:.7em;color:#ccc">DIST</span>' + compete.sitedist + ' nt&nbsp;&nbsp')
}

function junctiondiagram(div, j) {
	/*
	 */
	if (j.jd.exonskip) {
		// exon skip logo
		const eventidx = getdefault_exonskipalt(j.jd.exonskip)
		const evt = j.jd.exonskip[eventidx]

		// isskipexon or isaltexon should be provided
		evt.isskipexon = true
		// temporary attributes
		evt.junctionB = {
			start: j.start,
			stop: j.stop,
			v: j.jd.readcount
		}
		evt.color = bar_exonskip.fill

		import('./spliceevent.exonskip.diagram').then(p => {
			p.default({
				event: evt,
				holder: div,
				nophrase: true
			})

			// remove temp attr
			delete evt.junctionB
			delete evt.color
		})

		return
	}

	if (j.jd.leftcompete || j.jd.rightcompete) {
		competesitediagram(div, j)
		return
	}
}

function competesitediagram(div, j) {
	/*
	draw diagram for one compete site definition

	check if aberrant splice site is exonic or intronic
	make horizontal space in exon/intron to print aberrant-compete site distance

	for exon-truncation:
		print truncated length (site distance) in white text
	for exon-exnension:
		draw hollow box with extended length (site distance) at the extended end of exon
	
	width of site distance (distlabelw) determine box width

	*/

	const leftcompete = j.jd.leftcompete ? selectOneCompeteSiteDef(j.jd.leftcompete, j.jd.readcount) : null
	const rightcompete = j.jd.rightcompete ? selectOneCompeteSiteDef(j.jd.rightcompete, j.jd.readcount) : null

	const exonwidth = 30 // width of part of exon without text
	const intronwidth = 30
	const color_truncateexon = '#00A352'

	const exonheight = 20
	const fontsize = exonheight - 1
	const distfontsize = exonheight - 5
	const junctionheight = 20
	const xpad = 10
	const ypad = 15

	const svg = div.append('svg')
	const g = svg.append('g').attr('transform', 'translate(' + xpad + ',' + ypad + ')')

	// aberrant-compete site distance
	// width of text label also determines box size
	const distlabel = (leftcompete || rightcompete).sitedist + ' nt'
	let distlabelw
	g.append('text')
		.text(distlabel)
		.attr('font-size', distfontsize)
		.attr('font-family', client.font)
		.each(function () {
			distlabelw = this.getBBox().width
		})
		.remove()
	const distlabelpad = 5

	// logical: aberrant site location
	let leftinexon = false // truncation
	let rightinexon = false
	let leftinintron = false // extension
	let rightinintron = false

	if (leftcompete) {
		// measure site dist text width
		if (j.start > leftcompete.pos) {
			// j.start intronic
			leftinintron = true
		} else {
			// j.start exonic
			leftinexon = true
		}
	} else {
		if (j.stop > rightcompete.pos) {
			// j.stop exonic
			rightinexon = true
		} else {
			// j.stop intronic
			rightinintron = true
		}
	}

	let x = 0
	// delineates normal intron start/stop x pos, for drawing junctions later
	let intronstart
	let intronstop

	// left exon
	g.append('rect')
		.attr('fill', exoncolor)
		.attr('stroke', exoncolor)
		.attr('x', x)
		.attr('y', junctionheight)
		.attr('width', exonwidth)
		.attr('height', exonheight)
		.attr('shape-rendering', 'crispEdges')

	// left exon number
	{
		let num
		if (leftcompete) {
			num = leftcompete.exonidx + 1
		} else {
			// compete site on right, j.start should match with exon boundary so check exonleft
			let exonleft = null
			if (j.jd.exonleft) {
				for (const e of j.jd.exonleft) {
					if (e.isoform == rightcompete.isoform) {
						exonleft = e
						break
					}
				}
			}
			if (exonleft) {
				num = exonleft.exonidx + 1
			} else {
				num = '?'
			}
		}
		g.append('text')
			.text('e' + num)
			.attr('text-anchor', 'middle')
			.attr('x', x + exonwidth / 2)
			.attr('y', junctionheight + exonheight / 2)
			.attr('fill', 'white')
			.attr('dominant-baseline', 'central')
			.attr('font-size', distfontsize)
			.attr('font-family', client.font)
	}
	x += exonwidth

	if (leftinexon) {
		// truncated part of exon with dist label
		g.append('rect')
			.attr('fill', color_truncateexon)
			.attr('stroke', color_truncateexon)
			.attr('x', x)
			.attr('y', junctionheight)
			.attr('width', distlabelw + distlabelpad * 2)
			.attr('height', exonheight)
			.attr('shape-rendering', 'crispEdges')
		g.append('text')
			.text(distlabel)
			.attr('text-anchor', 'middle')
			.attr('x', x + distlabelw / 2 + distlabelpad)
			.attr('y', junctionheight + exonheight / 2)
			.attr('fill', 'white')
			.attr('dominant-baseline', 'central')
			.attr('font-size', distfontsize)
			.attr('font-family', client.font)
		x += distlabelw + distlabelpad * 2
	}

	intronstart = x

	if (leftinintron || rightinintron) {
		// print site dist in intron
		// check if to print dist on left or right
		if (leftinintron) {
			// print on left, no change to x
		} else {
			// print on right
			x += intronwidth
		}
		// white hollow box for extended exon
		g.append('rect')
			.attr('fill', 'none')
			.attr('stroke', exoncolor)
			.attr('x', x)
			.attr('y', junctionheight)
			.attr('width', distlabelw + distlabelpad * 2)
			.attr('height', exonheight)
			.attr('shape-rendering', 'crispEdges')
		g.append('text')
			.text(distlabel)
			.attr('text-anchor', 'middle')
			.attr('x', x + distlabelw / 2 + distlabelpad)
			.attr('y', junctionheight + exonheight / 2)
			.attr('font-size', distfontsize)
			.attr('font-family', client.font)
			.attr('dominant-baseline', 'central')
		x += distlabelw + distlabelpad * 2

		if (leftinintron) {
			x += intronwidth
		}
	} else {
		x += intronwidth
	}

	intronstop = x

	// intron line
	g.append('line')
		.attr('x1', intronstart + (leftinintron ? distlabelw + distlabelpad * 2 : 0))
		.attr('y1', junctionheight + exonheight / 2)
		.attr('x2', intronstop - (rightinintron ? distlabelw + distlabelpad * 2 : 0))
		.attr('y2', junctionheight + exonheight / 2)
		.attr('stroke', exoncolor)
		.attr('shape-rendering', 'crispEdges')

	// right exon
	if (rightinexon) {
		// show truncated exon, with dist label
		g.append('rect')
			.attr('fill', color_truncateexon)
			.attr('stroke', color_truncateexon)
			.attr('x', x)
			.attr('y', junctionheight)
			.attr('width', distlabelw + distlabelpad * 2)
			.attr('height', exonheight)
			.attr('shape-rendering', 'crispEdges')
		g.append('text')
			.text(distlabel)
			.attr('text-anchor', 'middle')
			.attr('x', x + distlabelw / 2 + distlabelpad)
			.attr('y', junctionheight + exonheight / 2)
			.attr('fill', 'white')
			.attr('dominant-baseline', 'central')
			.attr('font-size', distfontsize)
			.attr('font-family', client.font)
		x += distlabelw + distlabelpad * 2
	}

	g.append('rect')
		.attr('fill', exoncolor)
		.attr('stroke', exoncolor)
		.attr('x', x)
		.attr('y', junctionheight)
		.attr('width', exonwidth)
		.attr('height', exonheight)
		.attr('shape-rendering', 'crispEdges')

	// right exon number
	{
		let num
		if (rightcompete) {
			num = rightcompete.exonidx + 1
		} else {
			// compete site on left, j.stop should match with exon boundary so check exonright
			let exonright = null
			if (j.jd.exonright) {
				for (const e of j.jd.exonright) {
					if (e.isoform == leftcompete.isoform) {
						exonright = e
						break
					}
				}
			}
			if (exonright) {
				num = exonright.exonidx + 1
			} else {
				num = '?'
			}
		}
		g.append('text')
			.text('e' + num)
			.attr('text-anchor', 'middle')
			.attr('x', x + exonwidth / 2)
			.attr('y', junctionheight + exonheight / 2)
			.attr('fill', 'white')
			.attr('dominant-baseline', 'central')
			.attr('font-size', distfontsize)
			.attr('font-family', client.font)
	}

	// aberrant junction line
	{
		let x1, x2
		if (leftinexon || leftinintron) {
			x2 = intronstop
			if (leftinexon) {
				x1 = intronstart - distlabelw - distlabelpad * 2
			} else {
				x1 = intronstart + distlabelw + distlabelpad * 2
			}
		} else {
			x1 = intronstart
			if (rightinintron) {
				x2 = intronstop - distlabelw - distlabelpad * 2
			} else {
				x2 = intronstop + distlabelw + distlabelpad * 2
			}
		}

		g.append('path')
			.attr('d', 'M' + x1 + ',' + junctionheight + 'L' + (x1 + x2) / 2 + ',0' + 'L' + x2 + ',' + junctionheight)
			.attr('stroke', bar_exonskip.fill)
			.attr('fill', 'none')
		// aberrant junction read count
		g.append('text')
			.text(j.jd.readcount)
			.attr('x', (x1 + x2) / 2)
			.attr('y', -1)
			.attr('text-anchor', 'middle')
			.attr('font-size', 12)
			.attr('fill', bar_exonskip.fill)
	}

	// normal junction
	{
		const line = g
			.append('path')
			.attr(
				'd',
				'M' +
					intronstart +
					',' +
					(junctionheight + exonheight) +
					'L' +
					(intronstart + intronstop) / 2 +
					',' +
					(junctionheight * 2 + exonheight) +
					'L' +
					intronstop +
					',' +
					(junctionheight + exonheight)
			)
			.attr('stroke', exoncolor)
			.attr('fill', 'none')
		const nj = (leftcompete || rightcompete).competejunction
		if (nj) {
			// has normal junction
			g.append('text')
				.text(nj.v)
				.attr('x', (intronstart + intronstop) / 2)
				.attr('y', junctionheight * 2 + exonheight + 1)
				.attr('text-anchor', 'middle')
				.attr('font-size', 12)
				.attr('dominant-baseline', 'hanging')
		} else {
			// no normal junction at competing site
			line.attr('stroke-dasharray', '3,3')
		}
	}

	svg
		.attr('width', xpad * 2 + exonwidth * 2 + intronwidth + distlabelw + distlabelpad * 2)
		.attr('height', ypad * 2 + junctionheight * 2 + exonheight)
}
