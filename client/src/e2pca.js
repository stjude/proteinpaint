import { json as d3json } from 'd3-fetch'
import * as d3axis from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { interpolatePlasma } from 'd3-scale-chromatic'
import { interpolateRgb } from 'd3-interpolate'
import { select as d3select, selectAll as d3selectAll } from 'd3-selection'
import * as client from './client'

/*
a pca analysis can be done for single cell rna-seq, where the pc1/pc2 values is calculated for each cell

make a scatterplot of the cells, one dot for each cell
then color the dots by relative expression level of a given gene across all cells

e2pca_inputui()
e2pca_plot()
e2pca_genesearchui()

*/

const dullcolor = '#ccc'

export function e2pca_inputui(hostURL, jwt) {
	const pane = client.newpane({ x: 100, y: 100 })
	pane.header.text('PCA - expression plot')
	const butrow = pane.body.append('div').style('margin', '20px')
	const div = pane.body.append('div').style('margin', '20px')
	const ta_pca = butrow
		.append('input')
		.attr('size', 30)
		.attr('placeholder', 'PCA/SNE matrix file path')
		.style('margin', '10px')
		.property('value', 'xiang/sep20/set1')
	const ta_db = butrow
		.append('input')
		.attr('size', 30)
		.attr('placeholder', 'numerical db file path')
		.style('margin', '10px')
		.property('value', 'xiang/sep20/set1.db')
	//const ta_gene=butrow.append('input').attr('size',10).attr('placeholder','gene').style('margin','10px').property('value','UMI')
	butrow
		.append('button')
		.text('Submit')
		.on('click', () => {
			div.selectAll('*').remove()
			const filepca = ta_pca.property('value')
			if (filepca == '') {
				div.text('No PCA file')
				return
			}
			const filedb = ta_db.property('value')
			if (filedb == '') {
				div.text('No db file')
				return
			}
			d3json(hostURL + '/textfile').post(JSON.stringify({ file: filepca, jwt: jwt }), data => {
				if (data.error) {
					div.text('Error getting file: ' + data.error)
					return
				}

				const [err, numdata2plot] = e2pca_plot({
					holder: div,
					text: data.text
				})
				if (err) {
					client.sayerror(div, err)
					return
				}

				e2pca_genesearchui({
					holder: div.append('div'),
					numdata2plot: numdata2plot,
					hostURL: hostURL,
					jwt: jwt,
					obj: {
						dbfile: filedb
					}
				})
			})
		})
	butrow
		.append('button')
		.text('Clear')
		.on('click', () => {
			ta_pca.property('value', '')
			ta_db.property('value', '')
		})
	butrow
		.append('span')
		.style('padding-left', '10px')
		.html(
			'<a href=https://docs.google.com/document/d/1Midt0rYs1iIJveUMjeng9si3q31YelcNe_PI3Njce9E/edit?usp=sharing target=_blank>Help</a>'
		)
}

export function e2pca_plot(arg) {
	/*
accepts sample tsne data, creates the plot
return [err, numdata2plot]
where numdata2plot scopes sample circles for coloring by gene numeric value

.holder
.toprow (for storing buttons)
.obj 
	.colorscale
		.from
		.to
.text, 3 columns
	1. sample
	2. pc 1
	3. pc 2
.mdanno
	.annotation {}
		k: sample
		v: {}
			k: term key
			v: term value
	.metadata {}
		k: term key
		v: {}
			.label
			.values {}
				k: value key
				v: {}
					.label
					.color
*/

	const samples = []

	const lines = arg.text.split(/\r?\n/)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (!line) continue
		const l = line.split('\t')

		const samplename = l[0]

		const x = Number.parseFloat(l[1])
		const y = Number.parseFloat(l[2])
		if (Number.isNaN(x)) {
			return ['invalid x value at line ' + (i + 1)]
		}
		if (Number.isNaN(y)) {
			return ['invalid y value at line ' + (i + 1)]
		}
		const s = {
			sample: samplename,
			x: x,
			y: y
		}

		if (arg.mdanno) {
			/*
		follows cohort.patientannotation
		*/
			if (arg.mdanno.annotation[samplename]) {
				s.attr = []
				for (const termkey in arg.mdanno.annotation[samplename]) {
					if (arg.mdanno.mdh[termkey]) {
						const valuekey = arg.mdanno.annotation[samplename][termkey]
						if (arg.mdanno.mdh[termkey].values[valuekey]) {
							s.attr.push({
								k: arg.mdanno.mdh[termkey].label,
								v: arg.mdanno.mdh[termkey].values[valuekey].label
							})
						} else {
							s.attr.push({
								k: arg.mdanno.mdh[termkey].label,
								v: valuekey
							})
						}
					} else {
						s.attr.push({
							k: termkey,
							v: 'unknown term key'
						})
					}
				}
			}
		}
		samples.push(s)
	}

	if (samples.length == 0) {
		return ['no samples']
	}

	// done parsing sample-value
	// interpolate takes value range [0,1]
	let value2color
	if (arg.obj && arg.obj.colorscale && arg.obj.colorscale.from && arg.obj.colorscale.to) {
		value2color = interpolateRgb(arg.obj.colorscale.from, arg.obj.colorscale.to)
	} else {
		value2color = interpolatePlasma
	}

	let minx = samples[0].x,
		maxx = samples[0].x,
		miny = samples[0].y,
		maxy = samples[0].y
	for (const s of samples) {
		minx = Math.min(minx, s.x)
		maxx = Math.max(maxx, s.x)
		miny = Math.min(miny, s.y)
		maxy = Math.max(maxy, s.y)
	}

	const svgholder = arg.holder.append('div').style('display', 'inline-block')

	const menu = new client.Menu({ padding: '5px' })

	const svg = svgholder.append('svg')
	let toppad = 30,
		bottompad = 50,
		leftpad = 100,
		rightpad = 30,
		vpad = 20,
		width = 500,
		height = 500
	const xaxisg = svg.append('g')
	const yaxisg = svg.append('g')
	const dotg = svg.append('g')
	const dots = dotg
		.selectAll()
		.data(samples)
		.enter()
		.append('g')
	const circles = dots
		.append('circle')
		.attr('fill', '#aaa')
		.attr('stroke', 'none')
		.on('mouseover', (event, d) => {
			event.target.setAttribute('stroke', 'white')
			menu.clear()
			menu.show(event.clientX, event.clientY)
			const lst = [{ k: 'name', v: d.sample }]
			if (d.value != undefined) {
				lst.push({ k: 'value', v: d.value })
			}
			if (d.attr) {
				for (const v of d.attr) {
					lst.push(v)
				}
			}

			client.make_table_2col(menu.d, lst)
		})
		.on('mouseout', (event, d) => {
			event.target.setAttribute('stroke', 'none')
			menu.hide()
		})

	if (arg.obj) {
		// register circle selection to business object
		arg.obj.circles = circles
	}

	const xscale = scaleLinear().domain([minx, maxx])
	const yscale = scaleLinear().domain([miny, maxy])

	function resize() {
		const radius = 3
		bottompad = width / 20 + 20
		svg.attr('width', leftpad + vpad + width + rightpad).attr('height', toppad + height + vpad + bottompad)
		xaxisg.attr('transform', 'translate(' + (leftpad + vpad) + ',' + (toppad + height + vpad) + ')')
		yaxisg.attr('transform', 'translate(' + leftpad + ',' + toppad + ')')
		dotg.attr('transform', 'translate(' + (leftpad + vpad) + ',' + toppad + ')')
		xscale.range([0, width])
		yscale.range([height, 0])
		client.axisstyle({
			axis: xaxisg.call(d3axis.axisBottom().scale(xscale)),
			color: 'black',
			fontsize: width / 40,
			showline: true
		})
		client.axisstyle({
			axis: yaxisg.call(d3axis.axisLeft().scale(yscale)),
			color: 'black',
			fontsize: height / 40,
			showline: true
		})
		dots.attr('transform', d => 'translate(' + xscale(d.x) + ',' + yscale(d.y) + ')')
		circles.attr('r', radius)
	}
	resize()

	const underdiv = svgholder.append('div').style('position', 'relative')

	// svg export
	{
		const row = arg.toprow || underdiv
		row
			.append('button')
			.style('margin-right', '20px')
			.text('SVG')
			.on('click', () => client.to_svg(svg.node(), 'plot'))
	}

	// legend
	const legendholder = underdiv.append('div').style('margin', '10px 10px 10px 30px')
	//.style('display','inline-block')

	if (arg.obj) {
		arg.obj.legendholder = legendholder
	}

	// drag resize
	underdiv
		.append('div')
		.style('position', 'absolute')
		.style('right', '0px')
		.style('top', '0px')
		.attr('class', 'sja_clbtext')
		.text('drag to resize')
		.on('mousedown', event => {
			event.preventDefault()
			const b = d3select(document.body)
			const x = event.clientX
			const y = event.clientY
			const w0 = width
			const h0 = height
			b.on('mousemove', event => {
				width = w0 + event.clientX - x
				height = h0 + event.clientY - y
				resize()
			})
			b.on('mouseup', event => {
				b.on('mousemove', null).on('mouseup', null)
			})
		})

	let usezscore = false

	const numdata2plot = (data, genename) => {
		/*
	accepts numeric data for samples, fill circle color and legend

	data [ {.sample, .value} ]
	*/

		const sample2data = new Map()
		let maxv = data[0].value,
			minv = data[0].value
		for (const i of data) {
			sample2data.set(i.sample, i.value)
			maxv = Math.max(maxv, i.value)
			minv = Math.min(minv, i.value)
		}

		let mean, std
		if (usezscore) {
			mean = data.reduce((i, j) => i + j.value, 0) / data.length
			std = Math.sqrt(data.reduce((i, j) => i + Math.pow(j.value - mean, 2), 0) / data.length)
			console.log(mean, std)
			minv = maxv = 0
			data.forEach(i => {
				const zscore = (i.value - mean) / std
				minv = Math.min(minv, zscore)
				maxv = Math.max(maxv, zscore)
			})
		}

		circles.attr('fill', d => {
			if (sample2data.has(d.sample)) {
				let v = sample2data.get(d.sample)
				d.value = v
				if (usezscore) {
					v = (v - mean) / std
					d.value = v
				}
				/*
			breaks when minv=0
			d.value=Math.log(v/minv)/Math.log(maxv/minv)
			*/
				//d.value = Math.log(v-minv) / Math.log(maxv-minv)

				const scalev = (v - minv) / (maxv - minv)

				return value2color(scalev)
			}
			d.value = undefined
			return dullcolor
		})

		// move colored dots to foreground
		dots.each(function(d) {
			if (d.value != undefined) {
				this.parentNode.appendChild(this)
			}
		})

		legendholder.selectAll('*').remove()
		legendholder.append('span').html(genename + '&nbsp;')
		legendholder.append('span').html('min: ' + minv + '&nbsp;')
		const colorlst = []
		for (let i = 0; i <= 1; i += 0.1) {
			colorlst.push(value2color(i))
		}
		legendholder
			.append('div')
			.style('display', 'inline-block')
			.style('width', '150px')
			.style('height', '20px')
			.style('background', 'linear-gradient(to right,' + colorlst.join(',') + ')')
			.style('border', 'solid 1px ' + dullcolor)
		legendholder.append('span').html('&nbsp;max: ' + maxv)

		// z-score
		const row = legendholder.append('div').style('margin-top', '10px')
		const id = Math.random().toString()
		row
			.append('input')
			.attr('type', 'checkbox')
			.style('margin-right', '10px')
			.property('checked', usezscore)
			.attr('id', id)
			.on('change', () => {
				usezscore = !usezscore
				numdata2plot(data, genename)
			})
		row
			.append('label')
			.attr('for', id)
			.text('apply Z-score')
	}
	return [null, numdata2plot]
}

export function e2pca_genesearchui(arg) {
	/*
	.holder
	.hostURL
	.numdata2plot
	.callback
	.obj
		.dbfile

	resulting gene expression data will be attached to .obj
	*/

	const geneta = arg.holder
		.append('input')
		.attr('placeholder', 'search gene')
		.attr('padding-right', '20px')
	const genesearchsays = arg.holder.append('span')

	geneta.on('keyup', event => {
		genesearchsays.text('')
		if (event.code != 'Enter') return
		const gene = geneta.property('value')
		if (!gene) return
		geneta.property('value', '')

		d3json(arg.hostURL + '/dbdata').post(
			JSON.stringify({ db: arg.obj.dbfile, tablename: 'data', keyname: 'gene', key: gene.toLowerCase(), jwt: arg.jwt }),
			data => {
				if (data.error) {
					genesearchsays.text('error getting data: ' + data.error)
					return
				}
				if (!data.rows) {
					genesearchsays.text('.rows missing')
					return
				}
				if (data.rows.length == 0) {
					genesearchsays.text('no match for ' + gene)
					return
				}

				/*
			register search term & results to the e2pca object
			for use by boxploting in cohort
			*/
				arg.obj.expressiondata = data.rows
				arg.obj.searchedgene = gene

				arg.numdata2plot(data.rows, gene)

				if (arg.callback) {
					arg.callback()
				}
			}
		)
	})
}
