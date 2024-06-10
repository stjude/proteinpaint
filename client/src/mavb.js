import { select as d3select } from 'd3-selection'
import * as client from './client'
import { renderSandboxFormDiv } from '../dom/sandbox.ts'
import { scaleLinear } from 'd3-scale'
import * as d3axis from 'd3-axis'
import blocklazyload from './block.lazyload'
import { d3lasso } from '../common/lasso'

/*
differential gene expression viewer

ma: MA plot
v: Volcano plot
b: boxplot



************ mavb object **********
- hostURL
- jwt
- filename
- genome {}
- tracks []
- holder
- data []
- ma_dotarea
- vo_dotarea
- hastvalue
	if false, tvalue is missing
	otherwise, requires tvaluemin/max
- tvaluemin
- tvaluemax

*/

const hlcolor = '#ffa200'

const tip = new client.Menu()

export function mavbparseinput(mavb, sayerror, holder, jwt) {
	/*
	called by embedding api
	*/
	if (!mavb.dataname) {
		mavb.dataname = 'Differential expression'
	}
	if (mavb.input) {
		const textinput = mavb.input
		delete mavb.input
		const err = parseRaw(
			{
				genome: mavb.genome,
				filename: mavb.dataname,
				holder: holder,
				tracks: mavb.tracks,
				hostURL: mavb.hostURL,
				jwt: jwt
			},
			textinput.trim().split('\n')
		)
		if (err) {
			sayerror('Error with diferential gene expressionn data: ' + err)
		}
		return
	}
	let request
	if (mavb.url) {
		request = new Request(mavb.hostURL + '/urltextfile', {
			method: 'POST',
			body: JSON.stringify({ url: mavb.url, jwt: jwt })
		})
		delete mavb.url
	} else if (mavb.file) {
		request = new Request(mavb.hostURL + '/textfile', {
			method: 'POST',
			body: JSON.stringify({ file: mavb.file, jwt: jwt })
		})
		delete mavb.file
	} else {
		sayerror('neither .input nor .url given for MA-Volcano plot')
		return
	}
	const wait = holder
		.append('div')
		.style('margin', '20px')
		.style('color', '#aaa')
		.style('font-size', '1.5em')
		.text('Loading differential gene expression data ...')

	fetch(request)
		.then(data => {
			return data.json()
		})
		.then(data => {
			if (data.error) throw { message: data.error }
			if (!data.text) throw { message: 'no data loaded' }

			const err = parseRaw(
				{
					genome: mavb.genome,
					filename: mavb.dataname,
					holder: holder,
					tracks: mavb.tracks,
					hostURL: mavb.hostURL,
					jwt: jwt
				},
				data.text.trim().split('\n')
			)
			if (err) throw { message: 'Error with differential gene expression data: ' + err }
		})
		.catch(err => {
			sayerror(err.message)
			if (err.stack) console.log(err.stack)
		})
		.then(() => {
			wait.remove()
		})
}

export function mavbui(genomes, hostURL, jwt, holder, sandbox_header) {
	/*
	create GUI to collect user input
	*/
	let pane, inputdiv, gselect, filediv, saydiv, visualdiv
	if (holder !== undefined) [inputdiv, gselect, filediv, saydiv, visualdiv] = renderSandboxFormDiv(holder, genomes)
	else {
		;[pane, inputdiv, gselect, filediv, saydiv, visualdiv] = client.newpane3(100, 100, genomes)
		pane.header.text('Differential gene expression viewer')
		pane.body.style('margin', '10px')
	}
	inputdiv.append('div').style('margin-top', '30px').style('color', '#858585').html(`
		<p>Interactive MA and Volcano plot for exploring differentially expressed genes.</p>
		<a href=https://docs.google.com/document/d/1gEhywyMzMQRM10NFvsObw1yDSWxVY7pxYjsQ2-nd6x4/edit?usp=sharing target=_blank>File format</a>
		`)

	function cmt(t, red) {
		saydiv.style('color', red ? 'red' : 'black').text(t)
	}
	const fileui = () => {
		filediv.selectAll('*').remove()
		const input = filediv
			.append('input')
			.attr('type', 'file')
			.on('change', event => {
				const file = event.target.files[0]
				if (!file) {
					fileui()
					return
				}
				if (!file.size) {
					cmt('Invalid file ' + file.name)
					fileui()
					return
				}
				const reader = new FileReader()
				reader.onload = event => {
					const usegenome = gselect.options[gselect.selectedIndex].innerHTML
					const err = parseRaw(
						{
							genome: genomes[usegenome],
							filename: file.name,
							hostURL: hostURL,
							jwt: jwt,
							holder,
							sandbox_header
						},
						event.target.result.trim().split('\n')
					)
					if (err) {
						cmt(err, 1)
						fileui()
						return
					}
					if (pane) pane.pane.remove()
				}
				reader.onerror = function () {
					cmt('Error reading file ' + file.name, 1)
					fileui()
					return
				}
				reader.readAsText(file, 'utf8')
			})

		setTimeout(() => input.node().focus(), 1100)
	}
	fileui()
}

function parseRaw(mavb, lines) {
	/*
	see top for attributes
	*/
	if (mavb.tracks) {
		for (const t of mavb.tracks) {
			t.iscustom = true
		}
	}

	const [err, header] = parseHeader(lines[0].trim())
	if (err) {
		return err
	}
	mavb.hastvalue = header.includes('tvalue')

	const data = []

	let errpvalue = 0
	let errpvalueadj = 0
	let errlogfc = 0

	for (let i = 1; i < lines.length; i++) {
		const line = lines[i]
		if (line == '') continue
		if (line[0] == '#') continue
		const lst = line.trim().split('\t')
		const m = {}
		for (let j = 0; j < header.length; j++) {
			m[header[j]] = lst[j]
		}
		if (!m.gene) {
			return '(line ' + (i + 1) + ') missing gene'
		}
		m.gene = m.gene.replace(/"/g, '')

		if (!m.logfoldchange) {
			return '(line ' + (i + 1) + ') missing log fold change'
		}
		{
			const v = Number.parseFloat(m.logfoldchange)
			if (Number.isNaN(v)) {
				errlogfc++
				continue
				//return '(line '+(i+1)+') invalid value for log fold change: '+m.logfoldchange
			}
			m.logfoldchange = v
		}

		if (!m.averagevalue) {
			return '(line ' + (i + 1) + ') missing average value'
		}
		{
			const v = Number.parseFloat(m.averagevalue)
			if (Number.isNaN(v)) {
				return '(line ' + (i + 1) + ') invalid value for average value: ' + m.averagevalue
			}
			m.averagevalue = v
		}

		if (!m.pvalue) {
			errpvalue++
			continue
		} else {
			const v = Number.parseFloat(m.pvalue)
			if (Number.isNaN(v)) {
				// ignore lines with invalid p value e.g. NA
				errpvalue++
				continue
			}
			m.pvalue = v
		}

		if (m.pvalueadj) {
			const v = Number.parseFloat(m.pvalueadj)
			if (Number.isNaN(v)) {
				errpvalueadj++
				continue
			}
			m.pvalueadj = v
		}

		if (mavb.hastvalue) {
			if (!m.tvalue) {
				return '(line ' + (i + 1) + ') missing T value'
			}
			{
				const v = Number.parseFloat(m.tvalue)
				if (Number.isNaN(v)) {
					return '(line ' + (i + 1) + ') invalid value for T value: ' + m.tvalue
				}
				m.tvalue = v
			}
		}

		data.push(m)
	}
	if (data.length == 0) {
		return 'No valid data'
	}
	// good data ready
	if (mavb.holder == undefined) {
		const pane = client.newpane({ x: 100, y: 100 })
		pane.header.text(mavb.filename)
		mavb.holder = pane.body
	} else {
		mavb.holder.selectAll('*').remove()
		//Fix for rendering data correctly now that the mavb UI is in a div rather than consuming the entire sandbox and therefore not able to access the header
		if (mavb.sandbox_header !== undefined)
			mavb.holder.append('div').html('<span style="opacity:.5;font-size:.7em">FILE: </span> ' + mavb.filename)
	}
	mavb.data = data

	// errors?
	if (errlogfc + errpvalue + errpvalueadj > 0) {
		const div = mavb.holder.append('div').style('width', '800px')
		if (errlogfc) {
			client.sayerror(div, errlogfc + ' lines dropped for invalid log fold change value')
		}
		if (errpvalue) {
			client.sayerror(div, errpvalue + ' lines dropped for invalid P value')
		}
		if (errpvalueadj) {
			client.sayerror(div, errpvalueadj + ' lines dropped for invalid adjusted P value')
		}
	}

	render(mavb)

	return null
}

function parseHeader(line) {
	const lower = line.toLowerCase().split('\t')
	const header = line.split('\t')
	if (header.length <= 1) {
		return ['invalid file header']
	}
	const htry = (...lst) => {
		for (const i of lst) {
			const j = lower.indexOf(i)
			if (j != -1) return j
		}
		return -1
	}
	let i = htry('gene')
	if (i == -1) return ['gene missing from header']
	header[i] = 'gene'
	i = htry('logfc', 'log.foldchange')
	if (i == -1) return ['log.foldchange missing from header']
	header[i] = 'logfoldchange'
	i = htry('aveexpr', 'average.value')
	if (i == -1) return ['average.value missing from header']
	header[i] = 'averagevalue'

	i = htry('t', 't.value')
	if (i != -1) {
		header[i] = 'tvalue'
	}

	i = htry('p.value')
	if (i == -1) return ['p.value missing from header']
	header[i] = 'pvalue'
	i = htry('p.value.adjusted', 'adj.p.val', 'adjustedp-value(fdr)')
	if (i != -1) {
		header[i] = 'pvalueadj'
	}
	return [null, header]
}

function render(mavb) {
	// range of absolute(t value) for setting dot radius
	if (mavb.hastvalue) {
		let tmin = Math.abs(mavb.data[0].tvalue)
		let tmax = 0
		for (const d of mavb.data) {
			const v = Math.abs(d.tvalue)
			tmin = Math.min(tmin, v)
			tmax = Math.max(tmax, v)
		}
		mavb.tvaluemin = tmin
		mavb.tvaluemax = tmax
	}

	// MA plot

	const maplotdiv = mavb.holder
		.append('div')
		.style('display', 'inline-block')
		.style('vertical-align', 'top')
		.style('margin', '20px')

	const ma_svg = render_ma(maplotdiv, mavb)

	// volcano plot

	const voplotdiv = mavb.holder
		.append('div')
		.style('display', 'inline-block')
		.style('vertical-align', 'top')
		.style('margin', '20px')

	const vo_svg = render_volcano(voplotdiv, mavb)

	// bottom row

	const div3 = mavb.holder.append('div').style('margin', '20px')

	// row - 1
	const textarea = div3
		.append('textarea')
		.style('display', 'inline-block')
		.attr('rows', 5)
		.attr('cols', 10)
		.style('resize', 'both')
		.attr('placeholder', 'Enter genes, separate by space or newline')
	// row - 2
	const div31 = div3
		.append('div')
		.style('display', 'inline-block')
		.style('margin-left', '10px')
		.style('vertical-align', 'top')
	div31
		.append('button')
		.style('display', 'block')
		.text('Show gene labels')
		.on('click', event => {
			const str = textarea.property('value').trim()
			if (str == '') return
			const genes = new Set()
			for (const n of str.split(/[\s\n\t]+/)) {
				genes.add(n.toUpperCase())
			}
			if (genes.size == 0) return
			for (const d of mavb.data) {
				if (!d.ma_label && genes.has(d.gene.toUpperCase())) {
					hltoggle(d, mavb)
				}
			}
		})
	div31
		.append('button')
		.style('display', 'block')
		.text('Remove all labels')
		.on('click', event => {
			for (const d of mavb.data) {
				if (d.ma_label) {
					hltoggle(d, mavb)
				}
			}
		})
	div31
		.append('div')
		.style('margin-top', '10px')
		.style('color', '#858585')
		.style('font-size', '.8em')
		.html(
			'<span style="font-size:1.3em">TIP:</span> click circles to toggle highlight on genes;<br>drag to move a gene label around.'
		)
	// row - 3
	const div32 = div3
		.append('div')
		.style('display', 'inline-block')
		.style('margin-left', '30px')
		.style('vertical-align', 'top')
	div32
		.append('button')
		.text('Get MA plot')
		.style('display', 'block')
		.on('click', event => {
			client.to_svg(ma_svg.node(), 'MAplot')
		})
	div32
		.append('button')
		.text('Get volcano plot')
		.style('display', 'block')
		.on('click', event => {
			client.to_svg(vo_svg.node(), 'Volcano')
		})
}

function render_ma(holder, mavb) {
	/*
m {}
- gene
- logfoldchange
- averagevalue
- pvalue

add:
- ma_circle
*/
	const avlst = []
	let minlogfc = 0,
		maxlogfc = 0
	for (const d of mavb.data) {
		minlogfc = Math.min(minlogfc, d.logfoldchange)
		maxlogfc = Math.max(maxlogfc, d.logfoldchange)
		avlst.push(d.averagevalue)
	}

	avlst.sort((a, b) => a - b) // ascend
	const minav = avlst[0]
	const maxav = avlst[avlst.length - 1]

	let yaxisw,
		xaxish,
		width,
		height,
		xpad,
		ypad,
		boxh,
		toppad = 50,
		rightpad = 50,
		radius
	const svg = holder.append('svg')
	const yaxisg = svg.append('g')
	const xaxisg = svg.append('g')
	const xlab = svg.append('text').text('Average expression value').attr('fill', 'black').attr('text-anchor', 'middle')
	const ylab = svg.append('text').text('log2(fold change)').attr('fill', 'black').attr('text-anchor', 'middle')
	mavb.ma_dotarea = svg.append('g')
	const box = mavb.ma_dotarea
		.append('rect')
		.attr('stroke', '#ededed')
		.attr('fill', 'none')
		.attr('shape-rendering', 'crispEdges')

	const xscale = scaleLinear().domain([minav, maxav])
	const yscale = scaleLinear().domain([minlogfc, maxlogfc])
	// radius scale by range of abs(t-value)
	let radiusscale
	if (mavb.hastvalue) {
		radiusscale = scaleLinear().domain([mavb.tvaluemin, mavb.tvaluemax])
	}

	const dotg = mavb.ma_dotarea
		.selectAll()
		.data(mavb.data)
		.enter()
		.append('g')
		.each(function (d) {
			d.ma_g = this
		})
	const circle = dotg
		.append('circle')
		.attr('stroke', 'black')
		.attr('stroke-opacity', 0.2)
		.attr('stroke-width', 1)
		.attr('fill', hlcolor)
		.attr('fill-opacity', 0)
		.each(function (d) {
			d.ma_circle = this
		})
		.on('mouseover', circlemouseover)
		.on('mouseout', circlemouseout)
		.on('click', (event, d) => {
			circleclick(d, mavb, event.clientX, event.clientY)
		})

	const logfc0line = mavb.ma_dotarea.append('line').attr('stroke', '#ccc').attr('shape-rendering', 'crispEdges')

	// boxplot
	const bpg = svg.append('g')
	const bpthroughline = bpg.append('line').attr('stroke', hlcolor).attr('shape-rendering', 'crispEdges')
	const percentile05line = bpg.append('line').attr('stroke', hlcolor).attr('shape-rendering', 'crispEdges')
	const percentile95line = bpg.append('line').attr('stroke', hlcolor).attr('shape-rendering', 'crispEdges')
	const bpbox = bpg.append('rect').attr('fill', 'white').attr('stroke', hlcolor).attr('shape-rendering', 'crispEdges')
	const bpmedianline = bpg.append('line').attr('stroke', hlcolor).attr('shape-rendering', 'crispEdges')
	const avpercentile05 = avlst[Math.ceil(avlst.length * 0.05)]
	const avpercentile95 = avlst[Math.ceil(avlst.length * 0.95)]
	const avpercentile25 = avlst[Math.ceil(avlst.length * 0.25)]
	const avpercentile75 = avlst[Math.ceil(avlst.length * 0.75)]
	const avmedian = avlst[Math.ceil(avlst.length / 2)]

	function resize(w, h) {
		width = w
		height = h
		yaxisw = Math.max(50, width / 8)
		xaxish = Math.max(50, height / 8)
		radius = Math.max(width, height) / 80 // minimum radius
		const maxradius = radius * 3

		xscale.range([0, width])
		yscale.range([height, 0])
		if (radiusscale) radiusscale.range([radius, maxradius])

		circle.each(d => {
			d.ma_radius = radiusscale ? radiusscale(Math.abs(d.tvalue)) : radius
		})

		boxh = radius * 3

		xpad = Math.max(maxradius, width / 50)
		ypad = Math.max(maxradius, height / 50)
		yaxisg.attr('transform', 'translate(' + yaxisw + ',' + toppad + ')')
		xaxisg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (toppad + height + ypad + boxh + ypad) + ')')
		xlab.attr('x', yaxisw + xpad + width / 2).attr('y', toppad + height + ypad + boxh + ypad + xaxish - 5)
		ylab.attr('transform', 'translate(15,' + (toppad + height / 2) + ') rotate(-90)')
		mavb.ma_dotarea.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + toppad + ')')
		box.attr('width', width).attr('height', height)
		dotg.attr('transform', d => {
			return 'translate(' + xscale(d.averagevalue) + ',' + yscale(d.logfoldchange) + ')'
		})
		circle.attr('r', d => {
			return d.ma_radius
		})
		logfc0line.attr('x2', width).attr('y1', yscale(0)).attr('y2', yscale(0))

		bpg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (toppad + height + ypad) + ')')
		const p05 = xscale(avpercentile05),
			p25 = xscale(avpercentile25),
			p50 = xscale(avmedian),
			p75 = xscale(avpercentile75),
			p95 = xscale(avpercentile95)
		percentile05line.attr('x1', p05).attr('x2', p05).attr('y2', boxh)
		percentile95line.attr('x1', p95).attr('x2', p95).attr('y2', boxh)
		bpmedianline.attr('x1', p50).attr('x2', p50).attr('y2', boxh)
		bpbox
			.attr('x', p25)
			.attr('width', p75 - p25)
			.attr('height', boxh)
		bpthroughline
			.attr('x1', p05)
			.attr('x2', p95)
			.attr('y1', boxh / 2)
			.attr('y2', boxh / 2)

		svg.attr('width', yaxisw + xpad + width + rightpad).attr('height', toppad + height + ypad + boxh + ypad + xaxish)
		client.axisstyle({
			axis: yaxisg.call(d3axis.axisLeft().scale(yscale)),
			color: 'black',
			showline: true
		})
		client.axisstyle({
			axis: xaxisg.call(d3axis.axisBottom().scale(xscale)),
			color: 'black',
			showline: true
		})
	}
	resize(400, 400)

	// add lasso for ma plot
	// TODO: remove follow line after testing
	add_lasso(dotg.selectAll('circle'), svg, 'vo_circle')
	return svg
}

function render_volcano(holder, mavb) {
	/*
m {}
- gene
- logfoldchange
- averagevalue
- pvalue

add:
- vo_circle
*/
	let minlogfc = 0,
		maxlogfc = 0,
		minlogpv = 0,
		maxlogpv = 0
	for (const d of mavb.data) {
		minlogfc = Math.min(minlogfc, d.logfoldchange)
		maxlogfc = Math.max(maxlogfc, d.logfoldchange)
		if (d.pvalue == 0) {
			continue
		} else {
			const v = -Math.log(d.pvalue, 10)
			minlogpv = Math.min(minlogpv, v)
			maxlogpv = Math.max(maxlogpv, v)
		}
	}

	let yaxisw,
		xaxish,
		width,
		height,
		xpad,
		ypad,
		toppad = 50,
		rightpad = 50,
		radius
	const svg = holder.append('svg')
	const yaxisg = svg.append('g')
	const xaxisg = svg.append('g')
	const xlab = svg.append('text').text('log2(fold change)').attr('fill', 'black').attr('text-anchor', 'middle')
	const ylab = svg.append('text').text('-log(P value)').attr('fill', 'black').attr('text-anchor', 'middle')

	mavb.vo_dotarea = svg.append('g')

	const box = mavb.vo_dotarea
		.append('rect')
		.attr('stroke', '#ededed')
		.attr('fill', 'none')
		.attr('shape-rendering', 'crispEdges')
	const xscale = scaleLinear().domain([minlogfc, maxlogfc])
	const yscale = scaleLinear().domain([minlogpv, maxlogpv])
	let radiusscale
	if (mavb.hastvalue) radiusscale = scaleLinear().domain([mavb.tvaluemin, mavb.tvaluemax])
	const dotg = mavb.vo_dotarea
		.selectAll()
		.data(mavb.data)
		.enter()
		.append('g')
		.each(function (d) {
			d.vo_g = this
		})
	const circle = dotg
		.append('circle')
		.attr('stroke', 'black')
		.attr('stroke-opacity', 0.2)
		.attr('stroke-width', 1)
		.attr('fill', hlcolor)
		.attr('fill-opacity', 0)
		.each(function (d) {
			d.vo_circle = this
		})
		.on('mouseover', circlemouseover)
		.on('mouseout', circlemouseout)
		.on('click', (event, d) => {
			circleclick(d, mavb, event.clientX, event.clientY)
		})

	const logfc0line = mavb.vo_dotarea.append('line').attr('stroke', '#ccc').attr('shape-rendering', 'crispEdges')

	function resize(w, h) {
		width = w
		height = h
		yaxisw = Math.max(50, width / 8)
		xaxish = Math.max(50, height / 8)

		radius = Math.max(width, height) / 80
		const maxradius = radius * 3
		if (radiusscale) radiusscale.range([radius, maxradius])
		circle.each(d => {
			d.vo_radius = radiusscale ? radiusscale(Math.abs(d.tvalue)) : radius
		})

		xpad = Math.max(maxradius, width / 50)
		ypad = Math.max(maxradius, height / 50)
		yaxisg.attr('transform', 'translate(' + yaxisw + ',' + toppad + ')')
		xaxisg.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + (toppad + height + ypad) + ')')
		xlab.attr('x', yaxisw + xpad + width / 2).attr('y', toppad + height + ypad + xaxish - 5)
		ylab.attr('transform', 'translate(15,' + (toppad + height / 2) + ') rotate(-90)')
		mavb.vo_dotarea.attr('transform', 'translate(' + (yaxisw + xpad) + ',' + toppad + ')')
		box.attr('width', width).attr('height', height)
		xscale.range([0, width])
		yscale.range([height, 0])
		dotg.attr('transform', d => {
			return (
				'translate(' + xscale(d.logfoldchange) + ',' + yscale(d.pvalue == 0 ? maxlogpv : -Math.log(d.pvalue, 10)) + ')'
			)
		})
		circle.attr('r', d => {
			return d.vo_radius
		})
		logfc0line.attr('x1', xscale(0)).attr('x2', xscale(0)).attr('y2', height)

		svg.attr('width', yaxisw + xpad + width + rightpad).attr('height', toppad + height + ypad + xaxish)
		client.axisstyle({
			axis: yaxisg.call(d3axis.axisLeft().scale(yscale)),
			color: 'black',
			showline: true
		})
		client.axisstyle({
			axis: xaxisg.call(d3axis.axisBottom().scale(xscale)),
			color: 'black',
			showline: true
		})
	}
	resize(400, 400)

	if (mavb.data[0].pvalueadj != undefined) {
		// enable pvalue switching between adjusted and unadjusted
		const row = holder.append('div').style('margin', '20px')
		row.append('span').text('Select P value for Volcano plot:')
		const select = row
			.append('select')
			.style('margin-left', '5px')
			.on('change', event => {
				minlogpv = 0
				maxlogpv = 0
				const useun = select.node().selectedIndex == 0
				for (const d of mavb.data) {
					const pv = useun ? d.pvalue : d.pvalueadj
					if (pv == 0) continue
					const v = -Math.log(pv, 10)
					minlogpv = Math.min(minlogpv, v)
					maxlogpv = Math.max(maxlogpv, v)
				}
				yscale.domain([minlogpv, maxlogpv])
				client.axisstyle({
					axis: yaxisg.call(d3axis.axisLeft().scale(yscale)),
					color: 'black',
					showline: true
				})
				dotg.attr('transform', d => {
					const pv = useun ? d.pvalue : d.pvalueadj
					return 'translate(' + xscale(d.logfoldchange) + ',' + yscale(pv == 0 ? maxlogpv : -Math.log(pv, 10)) + ')'
				})
				ylab.text(useun ? '-log(P value)' : '-log(adjusted P value)')
			})
		select.append('option').text('Unadjusted P value')
		select.append('option').text('Adjusted P value')
	}

	// add lasso for volcano plot
	// TODO: remove follow line after testing
	add_lasso(dotg.selectAll('circle'), svg, 'ma_circle')
	return svg
}

// example of lasso function and usage
function add_lasso(selectable_items, svg, other_svg_item_key) {
	const lasso = d3lasso().items(selectable_items).targetArea(svg)

	function mavb_lasso_start() {
		// set all dots to initial state when lasso starts
		svg
			.selectAll('.possible')
			.style('fill-opacity', 0)
			.classed('not_possible', true)
			.classed('selected', false)
			.each(d => {
				d3select(d[other_svg_item_key]).attr('fill-opacity', 0)
			})

		// TODO: remove following commented code after review
		// here, there are many circles, so rather than applying style to add circles,
		// only previously selected circles are reverted back to normal
		// can use like following as well, for detail example see mds.scatterplot.js
		// lasso.items()
		// 	.style('fill-opacity', 0)
		// 	.classed('not_possible', true)
		// 	.classed('selected', false)
		// 	.each((d) =>{
		// 		d3select(d[other_svg_item_key]).attr('fill-opacity', 0)
		// 	})
	}

	function mavb_lasso_draw() {
		// Style the possible dots, when selected using lasso
		lasso
			.possibleItems()
			.style('fill-opacity', 0.9)
			.classed('not_possible', false)
			.classed('possible', true)
			.each(d => {
				d3select(d[other_svg_item_key]).attr('fill-opacity', 0.9)
			})
	}

	function mavb_lasso_end() {
		// do something, like show menu or open info panel for selected samples
	}

	// perform following custom drag events after original lasso drag events finish in lasso.js
	lasso.on('start', mavb_lasso_start).on('draw', mavb_lasso_draw).on('end', mavb_lasso_end)

	svg.call(lasso)
}

function circlemouseover(event, d) {
	tip.clear().show(event.clientX, event.clientY)
	const lst = [
		{ k: 'gene', v: d.gene },
		{ k: 'average value', v: d.averagevalue },
		{ k: 'log fold change', v: d.logfoldchange },
		{ k: 'P value', v: d.pvalue }
	]
	if (d.pvalueadj != undefined) {
		lst.push({ k: 'adjusted P value', v: d.pvalueadj })
	}
	if (d.tvalue != undefined) {
		lst.push({ k: 'T value', v: d.tvalue })
	}
	// rest of the attributes
	for (const k in d) {
		if (
			k == 'gene' ||
			k == 'averagevalue' ||
			k == 'logfoldchange' ||
			k == 'pvalue' ||
			k == 'pvalueadj' ||
			k == 'tvalue'
		) {
			continue
		}
		const v = d[k]
		if (typeof v != 'string') {
			continue
		}
		lst.push({ k: k, v: v })
	}

	client.make_table_2col(tip.d, lst)

	if (!d.ma_label) {
		d3select(d.ma_circle).attr('fill-opacity', 0.9)
		d3select(d.vo_circle).attr('fill-opacity', 0.9)
	}
}

function circlemouseout(event, d) {
	tip.hide()
	if (!d.ma_label) {
		d3select(d.ma_circle).attr('fill-opacity', 0)
		d3select(d.vo_circle).attr('fill-opacity', 0)
	}
}

function hltoggle(d, mavb) {
	if (d.ma_label) {
		// remove existing labels
		d.ma_label.remove()
		d.ma_labelbg.remove()
		d.ma_label = null
		d.vo_label.remove()
		d.vo_labelbg.remove()
		d.vo_label = null
		d3select(d.ma_circle).attr('fill-opacity', 0)
		d3select(d.vo_circle).attr('fill-opacity', 0)
		return
	}

	// to highlight this gene

	// move this gene to the top of the stack so it won't be blocked
	mavb.ma_dotarea.node().appendChild(d.ma_g)

	d.ma_labelbg = d3select(d.ma_g)
		.append('text')
		.text(d.gene)
		.attr('x', d.ma_radius + 5)
		.attr('y', 0)
		.attr('dominant-baseline', 'central')
		.attr('font-size', 14)
		.attr('font-family', client.font)
		.attr('fill', 'none')
		.attr('stroke', 'white')
		.attr('stroke-width', 3)
	d.ma_label = d3select(d.ma_g)
		.append('text')
		.text(d.gene)
		.attr('x', d.ma_radius + 5)
		.attr('y', 0)
		.attr('dominant-baseline', 'central')
		.attr('font-size', 14)
		.attr('fill', 'black')
		.attr('font-family', client.font)
		.on('mousedown', (event, d) => {
			labelmousedown(d.ma_label, d.ma_labelbg, event)
		})

	mavb.vo_dotarea.node().appendChild(d.vo_g)
	d.vo_labelbg = d3select(d.vo_g)
		.append('text')
		.text(d.gene)
		.attr('x', d.vo_radius + 5)
		.attr('y', 0)
		.attr('dominant-baseline', 'central')
		.attr('font-size', 14)
		.attr('font-family', client.font)
		.attr('fill', 'none')
		.attr('stroke', 'white')
		.attr('stroke-width', 3)
	d.vo_label = d3select(d.vo_g)
		.append('text')
		.text(d.gene)
		.attr('x', d.vo_radius + 5)
		.attr('y', 0)
		.attr('dominant-baseline', 'central')
		.attr('font-size', 14)
		.attr('fill', 'black')
		.attr('font-family', client.font)
		.on('mousedown', (event, d) => {
			labelmousedown(d.vo_label, d.vo_labelbg, event)
		})
	d3select(d.ma_circle).attr('fill-opacity', 0.8)
	d3select(d.vo_circle).attr('fill-opacity', 0.8)
}

function labelmousedown(label, labelbg, evt) {
	event.preventDefault()
	const labx = Number.parseFloat(label.attr('x'))
	const laby = Number.parseFloat(label.attr('y'))
	const x0 = evt.clientX
	const y0 = evt.clientY
	const body = d3select(document.body)
	body
		.on('mousemove', event => {
			label.attr('x', labx + event.clientX - x0).attr('y', laby + event.clientY - y0)
			labelbg.attr('x', labx + event.clientX - x0).attr('y', laby + event.clientY - y0)
		})
		.on('mouseup', event => {
			body.on('mousemove', null).on('mouseup', null)
		})
}

function circleclick(d, mavb, mousex, mousey) {
	if (mavb.tracks) {
		// have bigwig tracks
		if (!d.ma_label) {
			// this gene is not highlighted, will show the tracks
			const pane = client.newpane({ x: mousex + 20, y: mousey - 50 })
			pane.header.text(d.gene)
			showTracks(mavb, d.gene, pane.body)
		}
	}
	hltoggle(d, mavb)
}

function showTracks(mavb, gene, holder) {
	fetch(
		new Request(mavb.hostURL + '/genelookup', {
			method: 'POST',
			body: JSON.stringify({ deep: 1, input: gene, genome: mavb.genome.name, jwt: mavb.jwt })
		})
	)
		.then(data => {
			return data.json()
		})
		.then(data => {
			if (data.error) throw { message: data.error }
			if (!data.gmlst || data.gmlst.length == 0) throw { message: 'No genes can be found for ' + gene }

			const chr2pos = new Map()
			for (const m of data.gmlst) {
				if (!chr2pos.has(m.chr)) {
					chr2pos.set(m.chr, { chr: m.chr, start: m.start, stop: m.stop })
				}
				chr2pos.get(m.chr).start = Math.min(m.start, chr2pos.get(m.chr).start)
				chr2pos.get(m.chr).stop = Math.max(m.stop, chr2pos.get(m.chr).stop)
			}
			const coord = [...chr2pos][0][1]

			// create new tklst but don't push gene tracks in .tracks[]
			const tklst = [...mavb.tracks]
			client.first_genetrack_tolist(mavb.genome, tklst)

			// import block causes duplication
			blocklazyload({
				holder: holder,
				hostURL: mavb.hostURL,
				jwt: mavb.jwt,
				genome: mavb.genome,
				chr: coord.chr,
				start: coord.start,
				stop: coord.stop,
				tklst: tklst,
				nobox: true
			})
		})
		.catch(err => {
			client.sayerror(holder, err.message)
			if (err.stack) console.log(err.stack)
		})
}
