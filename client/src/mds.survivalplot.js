import * as client from './client'
import * as common from '#shared/common.js'
import { axisLeft, axisBottom } from 'd3-axis'
import { scaleLinear, scaleOrdinal } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { select as d3select, selectAll as d3selectAll } from 'd3-selection'

/*
obj:
.holder
.legendtable
.genome {}


********************** EXPORTED
init()
********************** INTERNAL
init_dataset_config
init_a_plot
	init_a_plot_filldefault
loadPlot
doPlot

*/

const radius = 3

export async function init(obj, holder, debugmode) {
	/*
obj{}
.genome
.mds

.plotlist[ {} ]
	optional, predefined sample sets, the same from embedding api
	when provided, will show plot rightaway and won't show controls
	.type
	.samplerule{}
		.full{}
			.byattr
		.set{}

when plotlist is missing, following will be used to set up control ui
thus to be made into samplerule.set{}

.geneexpression{}
	.gene{}
		.name/chr/start/stop

.mutation{}
	.anyornone
	.chr/start/stop

	providing following to apply a type of mutation in dividing sample
	.snvindel{}
	.cnv{}
	.loh{}
	.fusion{}
	.sv{}
	.itd{}
*/

	if (debugmode) {
		window.obj = obj
	}

	obj.plots = []

	obj.menu = new client.Menu({ padding: '5px' })
	obj.tip = new client.Menu({ padding: '5px' })

	obj.errordiv = holder.append('div').style('margin', '10px')

	obj.sayerror = e => {
		client.sayerror(obj.errordiv, typeof e == 'string' ? e : e.message)
		if (e.stack) console.log(e.stack)
	}

	///////////// following are tests

	obj.uidiv = holder.append('div').style('margin', '20px')
	obj.plotdiv = holder.append('div').style('margin', '20px')
	obj.legendtable = holder.append('table').style('border-spacing', '5px')

	/* quick fix button to download svg
-- the legend are not included in svg
*/
	holder
		.append('button')
		.text('SVG')
		.on('click', () => {
			client.to_svg(obj.plotlist[0].svg.node(), 'Survival')
		})

	try {
		await init_dataset_config(obj)
		/* got:
		.plottypes[]
		.samplegroupings[ {} ]
		*/

		if (!obj.plotlist) {
			obj.plotlist = []
		}
		if (!Array.isArray(obj.plotlist)) throw '.plotlist should be array'
		if (obj.plotlist.length == 0) {
			// init a default plot with just plot type, no other detail
			const p = {
				type: obj.plottypes[0].key
			}
			obj.plotlist.push(p)
		}
		for (const p of obj.plotlist) {
			init_a_plot(p, obj)
		}
	} catch (e) {
		if (e.stack) console.log(e.stack)
		obj.sayerror('Cannot make plot: ' + (e.message || e))
	}
}

function init_dataset_config(obj) {
	/* this step is essential
when attributes are available for defining full set, server returns counts for all sets for each attribute
shown as the dropdown menu
*/
	const par = {
		genome: obj.genome.name,
		dslabel: obj.mds.label,
		init: 1
	}
	return client.dofetch('mdssurvivalplot', par).then(data => {
		if (data.error) throw data.error
		if (!data.plottypes) throw 'plottypes[] missing'
		obj.plottypes = data.plottypes
		obj.samplegroupings = data.samplegroupings
	})
}

function init_a_plot(p, obj) {
	/*
init ui for a plot
push button to re-render
*/

	init_a_plot_filldefault(p, obj)

	// contains all pieces of this plot
	const div = obj.uidiv.append('div').style('margin', '20px')

	if (obj.plottypes.length > 1) {
		// multiple plot types, select one
		const s = div
			.append('div')
			.style('margin-bottom', '10px')
			.append('select')
			.on('change', event => {
				p.type = event.target.options[event.target.selectedIndex].value
			})
		for (const [i, t] of obj.plottypes.entries()) {
			s.append('option').text(t.name).property('value', t.key)
			if (t.key == p.type) {
				s.node().selectedIndex = i
			}
		}
	}

	if (obj.samplegroupings && !p.samplerule.full.immutable) {
		/*
		sample groupings is for setting samplerule.full

		[ {} ]
		.key
		.label
		.values[ {} ]
			.value
			.count
		*/

		const row = div.append('div').style('margin-bottom', '20px')
		const custom_input_row = div.append('div').style('display', 'none')
		row.append('span').html('Choose samples from&nbsp;').style('opacity', 0.5)

		// generate controls and set <select> according to what's defined in samplerule.full{}

		const attr2select = {}

		// selector for obj.samplegroupings
		const s = row
			.append('select')
			.style('margin-right', '5px')
			.on('change', event => {
				for (const k in attr2select) {
					attr2select[k].style('display', 'none')
				}
				const o = event.target.options[event.target.selectedIndex]
				custom_input_row.style('display', o.usesampleset ? 'block' : 'none')
				if (o.useall) {
					// user selects to use all samples
					p.samplerule.full.useall = 1
					delete p.samplerule.full.byattr
					return
				}
				if (o.usesampleset) {
					//user selects custom sampleset to be entered in inputbox
					delete p.samplerule.full.byattr
					delete p.samplerule.full.useall
					p.samplerule.full.usesampleset = 1
					show_sampleinput(p, custom_input_row)
					return
				}
				delete p.samplerule.full.useall
				p.samplerule.full.byattr = 1
				p.samplerule.key = o.key
				const s3 = attr2select[o.key]
				s3.style('display', 'inline')
				p.samplerule.full.value = s3.node().options[s3.node().selectedIndex].value
			})

		for (const [i, attr] of obj.samplegroupings.entries()) {
			s.append('option').text(attr.label).property('key', attr.key)

			const usingthisattr = p.samplerule.full.byattr && p.samplerule.full.key == attr.key
			if (usingthisattr) {
				// flip
				s.node().selectedIndex = i
			}

			const s2 = row.append('select').on('change', event => {
				p.samplerule.full.value = event.target.options[event.target.selectedIndex].value
			})

			attr2select[attr.key] = s2

			s2.style('display', usingthisattr ? 'inline' : 'none')

			for (const [j, v] of attr.values.entries()) {
				s2.append('option')
					.text(v.value + ' (n=' + v.count + ')')
					.property('value', v.value)
				if (usingthisattr && v.value == p.samplerule.full.value) {
					s2.node().selectedIndex = j
				}
			}
		}

		// option of using all samples
		s.append('option').text('all samples').property('useall', 1)
		if (p.samplerule.full.useall) {
			s.node().selectedIndex = obj.samplegroupings.length
		}

		// option of slecting custom samples set
		s.append('option').text('custom sampleset').property('usesampleset', 1)
	}

	show_dividerules(p, div)

	p.button = div
		.append('button')
		.text('Make plot')
		.on('click', () => {
			loadPlot(p, obj)
		})
	;(p.d = obj.plotdiv.append('div').style('margin', '20px')),
		(p.legend = {
			d_pvalue: p.d.append('div').style('margin', '10px'),
			d_samplefull: p.d.append('div').style('margin', '10px'),
			d_curves: p.d.append('div').style('margin', '10px')
		})

	p.svg = p.d.append('svg')
	p.resize_handle = p.d
		.append('div') // div containing the handle
		.append('div')
		.attr('class', 'sja_clbtext')
		.text('drag to resize')
		.style('float', 'right')

	if (p.renderplot) {
		loadPlot(p, obj)
	}
}

function init_a_plot_filldefault(p, obj) {
	// if missing, fill in default setting
	if (!p.type) {
		// just assign a default
		p.type = obj.plottypes[0].key
	}
	if (!p.samplerule) {
		p.samplerule = {}
	}
	if (!p.samplerule.full) {
		p.samplerule.full = {}
	}
	if (obj.samplegroupings) {
		// apply default setting if not set
		if (!p.samplerule.full.useall) {
			p.samplerule.full.byattr = 1
			if (!p.samplerule.full.key) {
				p.samplerule.full.key = obj.samplegroupings[0].key
				p.samplerule.full.value = obj.samplegroupings[0].values[0].value
			}
		}
	} else {
		// no sample grouping available for this mds
		p.samplerule.full.useall = 1
	}
	if (p.samplerule.set) {
		const st = p.samplerule.set // shorthand
		if (st.geneexpression) {
			/*
			divide samples by expression cutoff
			*/
			if (!st.bymedian && !st.byquartile) {
				// none of the methods is set -- use default
				st.bymedian = 1
			}
		}
	}
	if (!p.width) p.width = 500
	if (!p.height) p.height = 500
	if (!p.toppad) p.toppad = 10
	if (!p.rightpad) p.rightpad = 10
	if (!p.xaxispad) p.xaxispad = 10
	if (!p.yaxispad) p.yaxispad = 10
	if (!p.xaxish) p.xaxish = 40
	if (!p.yaxisw) p.yaxisw = 65
	if (!p.censorticksize) p.censorticksize = 6
	if (!p.tickfontsize) p.tickfontsize = 14
	if (!p.labfontsize) p.labfontsize = 15
}

function doPlot(plot, obj) {
	/*
	make one plot
	.samplesets[]
		.name
		.steps[]
			.x/y
			.censored[]
	*/
	const colorfunc = scaleOrdinal(schemeCategory10)

	const minx = 0 // min value is hardcoded
	let maxx = 0
	for (const curve of plot.samplesets) {
		curve.color = colorfunc(curve.name)
		for (const s of curve.steps) {
			maxx = Math.max(maxx, s.x)
		}
	}

	plot.svg.selectAll('*').remove()

	// curves
	const curves_g = plot.svg.append('g')
	for (const curve of plot.samplesets) {
		curve.path = curves_g.append('path').attr('stroke', curve.color).attr('fill', 'none')
		curve.ticks = curves_g.append('path').attr('stroke', curve.color).attr('fill', 'none')
	}

	// y axis
	const yaxis_g = plot.svg.append('g')
	const yaxis_scale = scaleLinear().domain([0, 1])
	const yaxis_lab_g = plot.svg.append('g')
	const yaxis_lab = yaxis_lab_g.append('text').text('Survival').attr('transform', 'rotate(-90)')

	// x axis
	const xaxis_g = plot.svg.append('g')
	const xaxis_scale = scaleLinear().domain([minx, maxx])
	const xaxis_lab = plot.svg
		.append('text')
		.attr('font-size', plot.labfontsize)
		.text(obj.plottypes.find(i => i.key == plot.type).timelabel)
		.attr('x', plot.yaxisw + plot.yaxispad + plot.width / 2)
		.attr('y', plot.toppad + plot.height + plot.xaxispad + plot.xaxish - 3)

	function resize() {
		curves_g.attr('transform', 'translate(' + (plot.yaxisw + plot.yaxispad) + ',' + plot.toppad + ')')
		for (const curve of plot.samplesets) {
			const ticks = []
			const pathd = ['M 0 0']
			for (const s of curve.steps) {
				pathd.push('H ' + (plot.width * s.x) / maxx)
				const y = plot.height * (s.y + s.drop)
				pathd.push('V ' + y)
				if (s.censored) {
					const y = plot.height * s.y
					for (const c of s.censored) {
						const x = (plot.width * c) / maxx
						ticks.push(
							'M ' +
								(x - plot.censorticksize / 2) +
								' ' +
								(y - plot.censorticksize / 2) +
								' l ' +
								plot.censorticksize +
								' ' +
								plot.censorticksize +
								' M ' +
								(x + plot.censorticksize / 2) +
								' ' +
								(y - plot.censorticksize / 2) +
								' l -' +
								plot.censorticksize +
								' ' +
								plot.censorticksize
						)
					}
				}
			}
			curve.path.attr('d', pathd.join(' '))
			if (ticks.length) {
				curve.ticks.attr('d', ticks.join(' '))
			}
		}

		yaxis_g.attr('transform', 'translate(' + plot.yaxisw + ',' + plot.toppad + ')')
		client.axisstyle({
			axis: yaxis_g.call(
				axisLeft()
					.scale(yaxis_scale.range([plot.height, 0]))
					.ticks(Math.floor(plot.height / (plot.tickfontsize + 20)))
			),
			showline: 1,
			fontsize: plot.tickfontsize
		})
		yaxis_lab_g.attr('transform', 'translate(' + plot.labfontsize + ',' + (plot.toppad + plot.height / 2) + ')')
		yaxis_lab.attr('font-size', plot.labfontsize)

		xaxis_g.attr(
			'transform',
			'translate(' + (plot.yaxisw + plot.yaxispad) + ',' + (plot.toppad + plot.height + plot.xaxispad) + ')'
		)
		let xticknumber
		xaxis_g
			.append('text')
			.text(maxx)
			.attr('font-size', plot.tickfontsize)
			.each(function () {
				xticknumber = Math.floor(plot.width / (this.getBBox().width + 30))
			})
			.remove()
		client.axisstyle({
			axis: xaxis_g.call(
				axisBottom()
					.scale(xaxis_scale.range([0, plot.width]))
					.ticks(xticknumber)
			),
			showline: 1,
			fontsize: plot.tickfontsize
		})
		xaxis_lab
			.attr('font-size', plot.labfontsize)
			.attr('x', plot.yaxisw + plot.yaxispad + plot.width / 2)
			.attr('y', plot.toppad + plot.height + plot.xaxispad + plot.xaxish - 3)

		plot.svg
			.attr('width', plot.yaxisw + plot.yaxispad + plot.width + plot.rightpad)
			.attr('height', plot.toppad + plot.height + plot.xaxispad + plot.xaxish)
	}
	resize()

	plot.resize_handle.on('mousedown', event => {
		event.preventDefault()
		const b = d3select(document.body)
		const x = event.clientX
		const y = event.clientY
		const w0 = plot.width
		const h0 = plot.height
		b.on('mousemove', () => {
			plot.width = w0 + event.clientX - x
			plot.height = h0 + event.clientY - y
			resize()
		})
		b.on('mouseup', () => {
			b.on('mousemove', null).on('mouseup', null)
		})
	})

	// legend
	if (Number.isFinite(plot.pvalue)) {
		plot.legend.d_pvalue.style('display', 'block').text('P-value: ' + plot.pvalue)
	} else {
		plot.legend.d_pvalue.style('display', 'none')
	}
	plot.legend.d_curves.selectAll('*').remove()
	for (const c of plot.samplesets) {
		plot.legend.d_curves
			.append('div')
			.style('margin', '3px')
			.html(
				'<span style="background:' +
					c.color +
					'">&nbsp;&nbsp;</span> ' +
					c.name +
					(c.pvalue == undefined ? '' : ', P-value: ' + c.pvalue)
			)
	}
}

function loadPlot(plot, obj) {
	plot.button.text('Loading...').attr('disabled', 1)

	const par = {
		genome: obj.genome.name,
		dslabel: obj.mds.label,
		type: plot.type,
		samplerule: plot.samplerule
	}

	client
		.dofetch('mdssurvivalplot', par)
		.then(data => {
			if (data.error) throw data.error
			if (!data.samplesets) throw 'samplesets[] missing'
			plot.samplesets = data.samplesets
			plot.pvalue = data.pvalue
			doPlot(plot, obj)
			if (plot.samplerule.set && plot.samplerule.set.mutation) {
				// update sample count
				if (plot.mutation_count.cnv) plot.mutation_count.cnv.html('(n=' + data.count_cnv + ')&nbsp;')
				if (plot.mutation_count.loh) plot.mutation_count.loh.html('(n=' + data.count_loh + ')&nbsp;')
				if (plot.mutation_count.snvindel) plot.mutation_count.snvindel.html('(n=' + data.count_snvindel + ')&nbsp;')
				if (plot.mutation_count.sv) plot.mutation_count.sv.html('(n=' + data.count_sv + ')&nbsp;')
				if (plot.mutation_count.fusion) plot.mutation_count.fusion.html('(n=' + data.count_fusion + ')&nbsp;')
				if (plot.mutation_count.itd) plot.mutation_count.itd.html('(n=' + data.count_itd + ')&nbsp;')
			}
		})
		.catch(e => {
			obj.sayerror(e)
		})
		.then(() => {
			plot.button.text('Update plot').attr('disabled', null)
		})
}

function show_dividerules(p, div) {
	/*
call during initing dom for a plot
TODO allow config for each rule, e.g. mutation filters
*/
	if (!p.samplerule.set) return

	const st = p.samplerule.set

	if (st.geneexpression) {
		/*
		divide samples by expression cutoff
		*/

		if (!st.bymedian && !st.byquartile) {
			// none of the methods is set -- use default
			st.bymedian = 1
		}

		const row = div.append('div').style('margin-bottom', '10px')
		row
			.append('span')
			.style('opacity', 0.5)
			.html('Divide samples by ' + st.gene + ' expression with&nbsp;')

		const s = row.append('select').on('change', event => {
			const o = event.target.options[event.target.selectedIndex]
			if (o.median) {
				p.samplerule.set.bymedian = 1
				delete p.samplerule.set.byquartile
				span_quartilecompare.style('display', 'none')
			} else if (o.quartile) {
				p.samplerule.set.byquartile = 1
				delete p.samplerule.set.bymedian
				span_quartilecompare.style('display', 'inline')
			}
		})

		s.append('option').text('median (group=2)').property('median', 1)
		s.append('option').text('quartile (group=4)').property('quartile', 1)

		// fix: <select> for quartile
		const span_quartilecompare = row.append('span').style('margin-left', '10px')
		span_quartilecompare.append('span').html('Compare each quartile against&nbsp;').style('opacity', 0.5)
		{
			const s = span_quartilecompare.append('select').on('change', event => {
				delete p.samplerule.set.against1st
				delete p.samplerule.set.against4th
				switch (event.target.selectedIndex) {
					case 0:
						break
					case 1:
						p.samplerule.set.against1st = 1
						break
					case 2:
						p.samplerule.set.against4th = 1
						break
				}
			})
			s.append('option').text('none')
			s.append('option').text('first quartile')
			s.append('option').text('fourth quartile')
			if (st.against1st) {
				s.node().selectedIndex = 1
			} else if (s.against4th) {
				s.node().selectedIndex = 2
			}
		}

		// option auto toggle
		if (st.bymedian) {
			s.node().selectedIndex = 0
			span_quartilecompare.style('display', 'none')
		} else if (st.byquartile) {
			s.node().selectedIndex = 1
			span_quartilecompare.style('display', 'inline')
		}
	}

	if (st.mutation) {
		/*
		divide samples by mutations
		*/

		p.mutation_count = {} // html place for showing # samples with each type of mutation, after data loaded

		if (st.snvindel) {
			const row = div.append('div').style('margin-bottom', '20px')

			p.mutation_count.snvindel = row.append('span')

			if (st.snvindel.name) {
				// name is the mutation, allow to choose whether to limit to this specific mutation

				row.append('span').html('SNV/indel&nbsp;')

				const s = row.append('select')
				s.append('option').text(st.snvindel.name).property('named', 1)
				s.append('option').text('any mutation at ' + st.chr + ':' + st.start)
			} else {
				// no mutation name
				row
					.append('span')
					.text('SNV/indel at ' + st.chr + ':' + (st.start == st.stop ? st.start : st.start + '-' + st.stop))
			}
		}
		if (st.cnv) {
			const row = div.append('div').style('margin-bottom', '20px')
			p.mutation_count.cnv = row.append('span')
			row
				.append('span')
				.html(
					'Copy number variation over ' +
						st.chr +
						':' +
						st.start +
						'-' +
						st.stop +
						' <span style="font-size:.7em">' +
						common.bplen(st.stop - st.start) +
						'</span>&nbsp;'
				)
		}
		if (st.loh) {
			const row = div.append('div').style('margin-bottom', '20px')
			p.mutation_count.loh = row.append('span')
			row
				.append('span')
				.html(
					'LOH over ' +
						st.chr +
						':' +
						st.start +
						'-' +
						st.stop +
						' <span style="font-size:.7em">' +
						common.bplen(st.stop - st.start) +
						'</span>&nbsp;'
				)
		}
		if (st.sv) {
			const row = div.append('div').style('margin-bottom', '20px')
			p.mutation_count.sv = row.append('span')
			row
				.append('span')
				.html('SV at ' + st.chr + ':' + (st.start == st.stop ? st.start : st.start + '-' + st.stop) + '&nbsp;')
		}
		if (st.fusion) {
			const row = div.append('div').style('margin-bottom', '20px')
			p.mutation_count.fusion = row.append('span')
			row
				.append('span')
				.html('Fusion at ' + st.chr + ':' + (st.start == st.stop ? st.start : st.start + '-' + st.stop) + '&nbsp;')
		}
		if (st.itd) {
			const row = div.append('div').style('margin-bottom', '20px')
			p.mutation_count.itd = row.append('span')
			row
				.append('span')
				.html(
					'ITD over ' +
						st.chr +
						':' +
						st.start +
						'-' +
						st.stop +
						' <span style="font-size:.7em">' +
						common.bplen(st.stop - st.start) +
						'</span>&nbsp;'
				)
		}
	}
}

function show_sampleinput(p, div) {
	let rendered_flag = div.selectAll('div').size()

	// return if input field already rendered
	if (rendered_flag) return

	const row = div.append('div').style('margin-bottom', '10px')

	const samplelist_div = row.append('div').style('margin-left', '20px')

	samplelist_div
		.append('div')
		.style('vertical-align', 'top')
		.style('display', 'inline-block')
		.style('opacity', 0.5)
		.html('Enter sample names<br>(one sample per line) &nbsp;')

	const sample_input = samplelist_div
		.append('textarea')
		.style('display', 'inline-block')
		.attr('cols', '20')
		.attr('rows', '10')
		.on('change', () => {
			// verify inputs and send it to serverside
			let sampleset = (p.samplerule.full.sampleset = [])
			const str = sample_input.property('value').trim()
			if (!str) return
			for (const sample of str.split('\n')) {
				sampleset.push(sample)
			}
		})
}
