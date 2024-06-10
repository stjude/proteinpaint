import { scaleTime, scaleLinear, scaleLog, scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import * as client from './client'
import { select as d3select } from 'd3-selection'
import { timeParse } from 'd3-time-format'
import { axisLeft, axisBottom } from 'd3-axis'
import { format as d3format } from 'd3-format'
import { renderSandboxFormDiv } from '../dom/sandbox.ts'

const zerovalue = 0.00001
let showcircle = true

let maflogscale = true

const tip = new client.Menu()

export default function maftimelineui(genomes, holder, sandbox_header) {
	let pane, inputdiv, gselect, filediv, saydiv, visualdiv
	if (holder !== undefined) [inputdiv, gselect, filediv, saydiv, visualdiv] = renderSandboxFormDiv(holder, genomes)
	else {
		;[pane, inputdiv, gselect, filediv, saydiv, visualdiv] = client.newpane3(100, 100, genomes)
		pane.header.text('MAF timeline plot')
	}
	inputdiv
		.append('p')
		.html(
			'<a href=https://docs.google.com/document/d/1WXlCVHLq_P2jGiRGJ55uzXCC6p-6Jqn7h406RUID_xo/edit?usp=sharing target=_blank>File format</a>'
		)
	inputdiv
		.append('p')
		.html('<a href=https://www.dropbox.com/s/940wfo6rd1ttlim/example.maftimeline?dl=0 target=_blank>Example file</a>')

	{
		// maf axis log scale
		const id = Math.random().toString()
		const p = inputdiv.append('p')
		p.append('input')
			.attr('type', 'checkbox')
			.attr('id', id)
			.property('checked', true)
			.style('margin-right', '5px')
			.on('change', () => {
				maflogscale = !maflogscale
			})
		p.append('label').attr('for', id).text('Y axis (MAF) log10 scale')
	}

	const fileui = () => {
		filediv.selectAll('*').remove()
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
					const lines = event.target.result.trim().split(/\r?\n/)
					const [err, header] = parseheader(lines[0].trim())
					if (err) {
						saydiv.text('File header error: ' + err)
						fileui()
						return
					}
					const badlines = []
					const data = {}
					let good = 0
					for (let i = 1; i < lines.length; i++) {
						if (lines[i] == '') continue
						if (lines[i][0] == '#') continue
						const m = parseline(i, lines[i], header, badlines, data)
						if (m) {
							good++
						}
					}
					if (badlines.length) {
						client.bulk_badline(header, badlines)
					}
					if (good == 0) {
						fileui()
						return
					}
					// good data ready
					let visual_holder
					if (pane) {
						client.disappear(pane.pane)
						const pane2 = client.newpane({ x: 100, y: 100, toshrink: true })
						pane2.header.html('<span style="opacity:.5;font-size:.7em">MAF TIMELINE</span> ' + file.name)
						visual_holder = pane2.body
					}
					// update sandbox panel header for landing page
					if (holder !== undefined) {
						//Fix for rendering data correctly now that the MAF UI is in a div rather than consuming the entire sandbox and therefore not able to access the header
						visual_holder = visualdiv.html('<span style="opacity:.5;font-size:.7em">MAF TIMELINE</span> ' + file.name)
						inputdiv.selectAll('*').remove()
						saydiv.text('')
					}
					render(data, header, visual_holder)
				}
				reader.onerror = function () {
					saydiv.text('Error reading file ' + file.name)
					fileui()
					return
				}
				saydiv.text('Parsing file ' + file.name + ' ...')
				reader.readAsText(file, 'utf8')
			})
		setTimeout(() => butt.node().focus(), 1100)
	}
	fileui()
}

function parseheader(line) {
	const header = line.toLowerCase().split('\t')
	if (header.length <= 1) return ['columns must be separated by tab']
	const htry = (...lst) => {
		for (const i of lst) {
			const j = header.indexOf(i)
			if (j != -1) return j
		}
		return -1
	}
	let i = htry('person', 'patient', 'caseid')
	if (i == -1) return ['person missing']
	header[i] = 'patient'
	i = htry('sample', 'sampleid')
	if (i == -1) return ['sample missing']
	header[i] = 'sample'
	i = htry('snv4')
	if (i == -1) return ['snv4 missing']
	header[i] = 'snv4'
	i = htry('date', 'dateofsample')
	if (i == -1) return ['date missing']
	header[i] = 'date'
	i = htry('mutant_readcount', 'mutantcount')
	if (i != -1) header[i] = 'mutant_readcount'
	i = htry('ref_readcount', 'refcount')
	if (i != -1) header[i] = 'ref_readcount'
	i = htry('total_readcount', 'coveragecount')
	if (i == -1) return ['total_readcount missing']
	header[i] = 'coverage'
	i = htry('maf')
	if (i == -1) return ['maf missing']
	header[i] = 'maf'
	i = htry('call_manual')
	if (i != -1) header[i] = 'call_manual'
	return [null, header]
}

function parseline(i, line, header, badlines, data) {
	const lst = line.split('\t')
	const m = {}
	for (let j = 0; j < header.length; j++) {
		m[header[j]] = lst[j]
	}
	if (!m.patient) {
		badlines.push([i, 'missing patient', lst])
		return
	}
	if (!data[m.patient]) {
		data[m.patient] = {
			snv4: {},
			show: false
		}
	}
	if (!m.snv4) {
		badlines.push([i, 'missing snv4', lst])
		return
	}
	if (!data[m.patient].snv4[m.snv4]) {
		data[m.patient].snv4[m.snv4] = {
			mutationname: m.snv4,
			samples: [],
			subidx: undefined
		}
	}
	if (m.gene) {
		data[m.patient].snv4[m.snv4].gene = m.gene
	}
	if (!m.maf) {
		badlines.push([i, 'missing maf', lst])
		return
	}
	let v = Number.parseFloat(m.maf)
	if (Number.isNaN(v)) {
		badlines.push([i, 'invalid maf', lst])
		return
	}
	if (v < zerovalue) {
		v = zerovalue
	}
	m.maf = v
	if (!m.coverage) {
		badlines.push([i, 'missing total_readcount', lst])
		return
	}
	if (m.call_manual && m.call_manual == 'wildtype') {
		m.maf = zerovalue
	}
	v = Number.parseInt(m.coverage)
	if (Number.isNaN(v)) {
		badlines.push([i, 'invalid total_readcount', lst])
		return
	}
	m.coverage = v
	let date
	if (m.date) {
		const f = timeParse('%m/%d/%Y')
		date = f(m.date)
		m.Date = m.date
	} else {
		badlines.push([i, 'missing date', lst])
		return
	}
	if (date == null) {
		badlines.push([i, 'cannot parse date', lst])
		return
	}
	m.date = date
	// sample is last step
	if (!m.sample) {
		badlines.push([i, 'missing sample', lst])
		return
	}
	data[m.patient].snv4[m.snv4].samples.push(m)
	return true
}

function render(data, header, holder) {
	const table = holder.append('table').style('margin', '20px')
	const tr1 = table.append('tr')
	let td = tr1.append('td').style('vertical-align', 'top').attr('rowspan', 2)
	td.append('button')
		.text('Toggle circle visibility')
		.on('click', () => {
			showcircle = !showcircle
			for (const n in data) {
				if (data[n].show) {
					data[n].handle.node().click()
					break
				}
			}
		})
	const patientholder = td.append('div').style('margin-top', '10px')
	const td1 = tr1.append('td').style('vertical-align', 'top')
	const graphholder = td1.append('div').style('display', 'inline-block')
	const controlholder = td1.append('div').style('display', 'inline-block').style('vertical-align', 'top')
	const tr2 = table.append('tr')
	const tiantable = tr2
		.append('td')
		.append('table')
		.style('border-spacing', '20px')
		.style('border-collapse', 'separate')
	const gtr1 = tiantable.append('tr')
	td = gtr1.append('td').style('vertical-align', 'top')
	td.append('div').text('Shared').style('font-size', '2em')
	const graph1holder = td.append('div').style('border', 'solid 1px black')
	td = gtr1.append('td').style('vertical-align', 'top')
	td.append('div').text('Rising').style('font-size', '2em')
	const graph2holder = td.append('div').style('border', 'solid 1px black')
	const gtr2 = tiantable.append('tr')
	td = gtr2.append('td').style('vertical-align', 'top')
	td.append('div').text('Falling').style('font-size', '2em')
	const graph3holder = td.append('div').style('border', 'solid 1px black')
	td = gtr2.append('td').style('vertical-align', 'top')
	td.append('div').text('R-only').style('font-size', '2em')
	const graph4holder = td.append('div').style('border', 'solid 1px black')
	//const matrixholder=tr.append('td').style('vertical-align','top')
	for (const patient in data) {
		const snvlst = []
		const colors = scaleOrdinal(schemeCategory10)
		for (const x in data[patient].snv4) {
			const snv = data[patient].snv4[x]
			snv.show = true
			snv.color = colors(snv.mutationname)
			snv.samples.sort((a, b) => a.date - b.date)
			for (const s of snv.samples) {
				s.color = snv.color
			}
			snvlst.push(snv)
		}
		const div = patientholder
			.append('div')
			.classed('sja_menuoption', true)
			.style('color', 'black')
			.text(patient)
			.on('click', () => {
				for (const pn in data) {
					data[pn].handle.style('color', 'black')
					data[pn].show = false
				}
				data[patient].handle.style('color', 'red')
				data[patient].show = true
				makegraph(snvlst, header, graphholder)
				makesubgraph(snvlst, graph1holder, graph2holder, graph3holder, graph4holder)
				makecontrol(snvlst, header, controlholder, graphholder, graph1holder, graph2holder, graph3holder, graph4holder)
				//makematrix(snvlst,header,matrixholder)
			})
		data[patient].handle = div
	}
	for (const n in data) {
		data[n].handle.node().click()
		break
	}
}

function makesubgraph(snvlst, g1, g2, g3, g4) {
	g1.selectAll('*').remove()
	g2.selectAll('*').remove()
	g3.selectAll('*').remove()
	g4.selectAll('*').remove()
	const l1 = []
	const l2 = []
	const l3 = []
	const l4 = []
	for (const snv of snvlst) {
		switch (snv.subidx) {
			case 1:
				l1.push(snv)
				break
			case 2:
				l2.push(snv)
				break
			case 3:
				l3.push(snv)
				break
			case 4:
				l4.push(snv)
				break
		}
	}
	if (l1.length) {
		makegraph(l1, null, g1, true)
	} else {
		g1.append('div').style('padding', '60px').style('background-color', '#ededed').text('no data')
	}
	if (l2.length) {
		makegraph(l2, null, g2, true)
	} else {
		g2.append('div').style('padding', '60px').style('background-color', '#ededed').text('no data')
	}
	if (l3.length) {
		makegraph(l3, null, g3, true)
	} else {
		g3.append('div').style('padding', '60px').style('background-color', '#ededed').text('no data')
	}
	if (l4.length) {
		makegraph(l4, null, g4, true)
	} else {
		g4.append('div').style('padding', '60px').style('background-color', '#ededed').text('no data')
	}
}

function makegraph(snvlst0, header, holder, issub) {
	holder.selectAll('*').remove()
	const samples = []
	const snvlst = []
	for (const snv of snvlst0) {
		if (!issub && !snv.show) continue
		snvlst.push(snv)
		for (const s of snv.samples) {
			samples.push(s)
		}
	}
	if (snvlst.length == 0) return
	let mindate = snvlst[0].samples[0].date
	let maxdate = snvlst[0].samples[0].date
	let maxmaf = snvlst[0].samples[0].maf
	let maxcoverage = snvlst[0].samples[0].coverage
	for (const snv of snvlst) {
		for (const s of snv.samples) {
			mindate = Math.min(mindate, s.date)
			maxdate = Math.max(maxdate, s.date)
			maxmaf = Math.max(maxmaf, s.maf)
			maxcoverage = Math.max(maxcoverage, s.coverage)
		}
	}
	const svg = holder.append('svg')
	// dimension
	const toppad = 30,
		rightpad = 200, // includes legend width
		yaxisw = 100,
		xaxish = 50
	let width = 600
	let height = 400
	let xpad, ypad, minradius
	// components
	const xaxisg = svg.append('g')
	const yaxisg = svg.append('g')
	const drag = svg
		.append('text')
		.text('drag to resize')
		.attr('class', 'sja_clb')
		.attr('text-anchor', 'end')
		.on('mousedown', event => {
			event.preventDefault()
			const x = event.clientX
			const y = event.clientY
			const w0 = width
			const h0 = height
			const body = d3select(document.body)
			body
				.on('mousemove', event => {
					setsize(w0 + event.clientX - x, h0 + event.clientY - y)
				})
				.on('mouseup', () => {
					body.on('mousemove', null).on('mouseup', null)
				})
		})
	const xscale = scaleTime().domain([mindate, maxdate])
	const yscale = (maflogscale ? scaleLog() : scaleLinear()).domain([zerovalue, 1])
	const rscale = scaleLinear().domain([1, maxcoverage])
	const g = svg.append('g')
	const lines = g
		.selectAll()
		.data(snvlst)
		.enter()
		.append('path')
		.attr('stroke', d => d.color)
		.attr('fill', 'none')
	let circles
	if (showcircle) {
		circles = g
			.selectAll()
			.data(samples)
			.enter()
			.append('circle')
			//.attr('stroke',d=>d.color) .attr('fill','none')
			.attr('fill', d => d.color)
			.attr('fill-opacity', 0.1)
			.on('mouseover', (event, d) => {
				event.target.setAttribute('fill-opacity', 0.4)
				tip.clear()
				tip.show(event.clientX, event.clientY)
				const lst = []
				for (const k in d) {
					if (k == 'color') continue
					if (k == 'gene') {
						lst.push({ k: 'gene', v: '<span style="color:' + d.color + '">' + d.gene + '</span>' })
						continue
					}
					if (k == 'date') continue
					if (k == 'url') {
						lst.push({ k: 'URL', v: '<a href=' + d.url + ' target=_blank>LINK</a>' })
						continue
					}
					lst.push({ k: k, v: d[k] })
				}
				client.make_table_2col(tip.d, lst)
			})
			.on('mouseout', event => {
				event.target.setAttribute('fill-opacity', 0.1)
			})
	}
	const legend = svg.append('g')
	// setsize
	const setsize = (w, h) => {
		width = w
		height = h
		minradius = 2
		const maxradius = Math.max(width, height) / 30
		xpad = maxradius
		ypad = maxradius
		rscale.range([Math.pow(minradius, 2), Math.pow(maxradius, 2)])
		xscale.range([0, width])
		yscale.range([height, 0])
		svg.attr('width', yaxisw + xpad + width + rightpad).attr('height', toppad + height + ypad + xaxish)
		xaxisg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (toppad + height + ypad) + ')')
		yaxisg.attr('transform', 'translate(' + yaxisw + ',' + toppad + ')')
		drag.attr('x', yaxisw + xpad + width).attr('y', toppad + height + ypad + xaxish - 4)
		client.axisstyle({
			axis: xaxisg.call(axisBottom().scale(xscale)),
			showline: true,
			color: 'black',
			fontsize: Math.max(12, Math.min(20, width / 100))
		})
		client.axisstyle({
			axis: yaxisg.call(
				axisLeft().scale(yscale).tickValues([1, 0.1, 0.01, 0.001, 0.0001, zerovalue]).tickFormat(d3format(' '))
			),
			showline: true,
			color: 'black',
			fontsize: Math.max(12, Math.min(20, height / 100))
		})
		g.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + toppad + ')')
		lines.attr('d', d => {
			const lst = []
			for (let i = 0; i < d.samples.length; i++) {
				const s = d.samples[i]
				lst.push((i == 0 ? 'M' : 'L') + ' ' + xscale(s.date) + ' ' + yscale(s.maf))
			}
			return lst.join(' ')
		})
		if (showcircle) {
			circles
				.attr('cx', d => xscale(d.date))
				.attr('cy', d => yscale(d.maf))
				.attr('r', d => Math.sqrt(rscale(d.coverage)))
		}
		legend.attr('transform', 'translate(' + (yaxisw + xpad + width + maxradius + 5) + ',' + toppad + ')')
		legend.selectAll('*').remove()
		let y = minradius
		if (showcircle) {
			legend.append('circle').attr('r', minradius).attr('cx', minradius).attr('cy', y).attr('fill', '#ccc')
			legend
				.append('text')
				.text(1)
				.attr('x', minradius * 2 + 10)
				.attr('y', y)
				.attr('font-size', 10)
				.attr('dominant-baseline', 'central')
			y += 5 + minradius + maxradius
			legend.append('circle').attr('r', maxradius).attr('cx', maxradius).attr('cy', y).attr('fill', '#ccc')
			legend
				.append('text')
				.text(maxcoverage)
				.attr('x', maxradius * 2 + 10)
				.attr('y', y)
				.attr('font-size', 15)
				.attr('dominant-baseline', 'central')
			y += 15 + maxradius
		}
		const fontsize = 12
		for (const snv of snvlst) {
			legend.append('line').attr('x2', 30).attr('y1', y).attr('y2', y).attr('stroke', snv.color)
			if (showcircle) {
				legend
					.append('circle')
					.attr('cx', 15)
					.attr('cy', y)
					.attr('r', 8)
					.attr('fill', snv.color)
					.attr('fill-opacity', 0.1)
			}
			legend
				.append('text')
				.text(snv.gene)
				.attr('dominant-baseline', 'central')
				.attr('font-size', fontsize)
				.attr('x', 30 + 10)
				.attr('y', y)
				.attr('fill', snv.color)
				.style('cursor', 'default')
				.on('mouseover', event => {
					event.target.setAttribute('font-weight', 'bold')
					lines.filter(d => d.mutationname == snv.mutationname).attr('stroke-width', 3)
				})
				.on('mouseout', event => {
					event.target.setAttribute('font-weight', 'normal')
					lines.filter(d => d.mutationname == snv.mutationname).attr('stroke-width', 1)
				})
			y += fontsize + 10
		}
	}
	setsize(width, height)

	holder
		.append('div')
		.style('text-align', 'right')
		.append('button')
		.text('SVG')
		.on('click', () => {
			client.to_svg(svg.node(), 'maf-timeline')
		})
}

/*
function makematrix(snvlst,header,holder) {
	holder.selectAll('*').remove()
	const timeformat=timeFormat('%B %Y')
	const table=holder.append('table')
	const headtr=table.append('tr')
	headtr.append('td') // gene
	for(const sample of snvlst[0].samples) {
		const td=headtr.append('td')
		td.text(timeformat(sample.date))
	}
	for(const snv of snvlst) {
		const tr=table.append('tr')
		tr.append('td').text(snv.gene)
		for(const sample of snv.samples) {
			tr.append('td').text(sample.maf)
		}
	}
}
*/

function makecontrol(snvlst, header, holder, graphholder, g1, g2, g3, g4) {
	holder.selectAll('*').remove()
	const table = holder.append('table')
	for (const snv of snvlst) {
		const tr = table.append('tr')
		const td1 = tr.append('td')
		td1.text(snv.gene).style('color', snv.color)
		const td2 = tr.append('td')
		const checkbox = td2.append('input').attr('type', 'checkbox').style('zoom', '150%').property('checked', snv.show)
		snv.checkbox = checkbox
		checkbox.on('change', event => {
			snv.show = event.target.checked
			makegraph(snvlst, header, graphholder)
		})
		const butt = td2
			.append('button')
			.style('margin-left', '5px')
			.text('Only')
			.on('click', () => {
				for (const s2 of snvlst) {
					s2.show = false
					s2.checkbox.property('checked', false)
				}
				snv.show = true
				snv.checkbox.property('checked', true)
				makegraph(snvlst, header, graphholder)
			})
		let cname = Math.random()
		const td11 = tr.append('td')
		const c1 = td11
			.append('input')
			.attr('type', 'checkbox')
			.attr('id', cname)
			.on('change', event => cchange(1, event.target))
		td11.append('label').html('&nbsp;shared').attr('for', cname)

		cname = Math.random()
		const td22 = tr.append('td')
		const c2 = td22
			.append('input')
			.attr('type', 'checkbox')
			.attr('id', cname)
			.on('change', event => cchange(2, event.target))
		td22.append('label').html('&nbsp;rising').attr('for', cname)

		cname = Math.random()
		const td33 = tr.append('td')
		const c3 = td33
			.append('input')
			.attr('type', 'checkbox')
			.attr('id', cname)
			.on('change', event => cchange(3, event.target))
		td33.append('label').html('&nbsp;falling').attr('for', cname)

		cname = Math.random()
		const td44 = tr.append('td')
		const c4 = td44
			.append('input')
			.attr('type', 'checkbox')
			.attr('id', cname)
			.on('change', event => cchange(4, event.target))
		td44.append('label').html('&nbsp;R-only').attr('for', cname)

		if (snv.subidx == 1) c1.property('checked', true)
		if (snv.subidx == 2) c2.property('checked', true)
		if (snv.subidx == 3) c3.property('checked', true)
		if (snv.subidx == 4) c4.property('checked', true)
		const cchange = (which, check) => {
			if (!check.checked) {
				snv.subidx = -1
			} else {
				snv.subidx = which
				//snv.show=true
				//checkbox.property('checked',true)
				if (which == 1) {
					c2.property('checked', false)
					c3.property('checked', false)
					c4.property('checked', false)
				} else if (which == 2) {
					c1.property('checked', false)
					c3.property('checked', false)
					c4.property('checked', false)
				} else if (which == 3) {
					c1.property('checked', false)
					c2.property('checked', false)
					c4.property('checked', false)
				} else {
					c1.property('checked', false)
					c2.property('checked', false)
					c3.property('checked', false)
				}
			}
			makesubgraph(snvlst, g1, g2, g3, g4)
		}
	}
}
