import { event as d3event } from 'd3-selection'
import * as client from './client'
import { axisLeft } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { rgb as d3rgb } from 'd3-color'
import * as expressionstat from './block.mds.expressionstat'

/*

expression rank track
single-sample mode for mds & custom data, all samples in the same file
requires .sample as 


Yu's ase & outlier analysis result is built-in but optional


*/

const labyspace = 5

export function loadTk(tk, block) {
	block.tkcloakon(tk)
	block.block_setheight()

	if (tk.uninitialized) {
		makeTk(tk, block)
		delete tk.uninitialized
	}

	// list of regions to load data from, including bb.rglst[], and bb.subpanels[]
	const regions = []

	for (let i = block.startidx; i <= block.stopidx; i++) {
		const r = block.rglst[i]
		regions.push({
			chr: r.chr,
			start: r.start,
			stop: r.stop,
			width: r.width
		})
	}

	if (block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for (const [idx, r] of block.subpanels.entries()) {
			regions.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				subpanelidx: idx
			})
		}
	}

	tk.regions = regions

	// check rank for each region

	const tasks = []

	for (const r of regions) {
		const arg = {
			jwt: block.jwt,
			genome: block.genome.name,
			rglst: [{ chr: r.chr, start: r.start, stop: r.stop }],
			sample: tk.sample
		}
		if (tk.iscustom) {
			arg.iscustom = 1
			arg.file = tk.file
			arg.url = tk.url
			arg.indexURL = tk.indexURL
		} else {
			arg.dslabel = tk.mds.label
			arg.querykey = tk.querykey
			arg.attributes = tk.attributes
		}
		tasks.push(
			client.dofetch('/mdsexpressionrank', arg).then(data => {
				if (data.error) throw { message: data.error }
				if (data.result && data.result.length > 0) {
					r.items = data.result
				}
				tk.totalsamples = data.samplecount
				return
			})
		)
	}

	Promise.all(tasks)

		.then(() => {
			// any data?
			if (!tk.regions.find(r => r.items)) throw { message: 'no data in view range' }
		})

		.catch(err => {
			if (err.stack) {
				console.log(err.stack)
			}
			return err.message
		})
		.then(errmsg => {
			renderTk(tk, block)
			block.tkcloakoff(tk, { error: errmsg })
		})
}

function renderTk(tk, block) {
	tk.glider.selectAll('*').remove()
	for (const p of tk.subpanels) {
		p.glider
			.attr('transform', 'translate(0,0)') // it may have been panned
			.selectAll('*')
			.remove()
	}

	let minv = null,
		maxv

	if (tk.showrank) {
		minv = 0
		maxv = 100
	} else {
		for (const r of tk.regions) {
			if (!r.items) continue
			for (const i of r.items) {
				if (minv == null) {
					minv = maxv = i.thisvalue
				} else {
					minv = Math.min(minv, i.thisvalue)
					maxv = Math.max(maxv, i.thisvalue)
				}
			}
		}
		if (minv > 0) minv = 0
		else if (maxv < 0) maxv = 0
	}

	const scale = bar_plot_y(minv, maxv, tk.barheight)

	// render
	for (const r of tk.regions) {
		if (!r.items) continue

		// where to create new shapes
		const g = r.subpanelidx != undefined ? tk.subpanels[r.subpanelidx].glider : tk.glider

		for (const i of r.items) {
			const startcoord = Math.max(r.start, i.start)
			const stopcoord = Math.min(r.stop, i.stop)

			let x1, x2 // px position

			if (r.subpanelidx != undefined) {
				// subpanel cannot be reverse
				x1 = (startcoord - r.start) * r.exonsf
				x2 = (stopcoord - r.start) * r.exonsf
			} else {
				// main panel can be reverse, so need to bother with this
				const a = block.seekcoord(r.chr, startcoord)[0]
				const b = block.seekcoord(r.chr, stopcoord)[0]
				if (!a || !b) continue
				x1 = Math.min(a.x, b.x)
				x2 = Math.max(a.x, b.x)
			}

			const [y, h] = scale(tk.showrank ? i.rank : i.thisvalue)

			expressionstat.measure(i, tk.gecfg)
			const barcolor = expressionstat.ase_color(i, tk.gecfg)

			const tt = d3rgb(barcolor)
			const fillcolor = 'rgba(' + tt.r + ',' + tt.g + ',' + tt.b + ',.2)'

			// plot bar for this item
			const ig = g.append('g').attr('transform', 'translate(' + x1 + ',0)')
			ig.append('line')
				.attr('x2', Math.max(2, x2 - x1))
				.attr('stroke', barcolor)
				.attr('stroke-width', 1)
				.attr('shape-rendering', 'crispEdges')
				.attr('y1', i.rank > 0 ? y : y + h)
				.attr('y2', i.rank > 0 ? y : y + h)
			ig.append('rect')
				.attr('y', y)
				.attr('width', Math.max(2, x2 - x1))
				.attr('height', h)
				.attr('fill', fillcolor)
				.attr('shape-rendering', 'crispEdges')
				.on('mouseover', () => {
					d3event.target.setAttribute('stroke', barcolor)
					tk.tktip.clear().show(d3event.clientX, d3event.clientY)

					const lst = [
						{ k: 'gene', v: i.gene },
						{ k: 'rank', v: client.ranksays(i.rank) },
						{ k: tk.gecfg.datatype || 'actual value', v: i.thisvalue }
					]

					const table = client.make_table_2col(tk.tktip.d, lst).style('margin', '0px')

					{
						const tr = table.append('tr')
						const td = tr.append('td').attr('colspan', 3)
						td.text(i.chr + ':' + i.start + '-' + i.stop)
					}

					expressionstat.showsingleitem_table(i, tk.gecfg, table)
				})
				.on('mouseout', () => {
					tk.tktip.hide()
					d3event.target.setAttribute('stroke', '')
				})
				.on('click', () => {
					const pane = client.newpane({ x: d3event.clientX, y: d3event.clientY })
					pane.header.text(i.gene + ' ' + tk.gecfg.datatype)

					const p = {
						gene: i.gene,
						chr: i.chr,
						start: i.start,
						stop: i.stop,
						holder: pane.body,
						genome: block.genome,
						jwt: block.jwt,
						hostURL: block.hostURL,
						sample: { name: tk.sample, value: i.thisvalue }
					}

					if (tk.iscustom) {
						p.file = tk.file
						p.url = tk.url
						p.indexURL = tk.indexURL
					} else {
						p.dslabel = tk.mds.label
						p.querykey = tk.querykey
					}

					import('./block.mds.geneboxplot').then(_ => {
						_.init(p)
					})
				})
		}
	}

	tk.rankaxis.label.text(tk.showrank ? 'Rank' : tk.gecfg.datatype || 'actual value')

	client.axisstyle({
		axis: tk.rankaxis.g.call(
			axisLeft()
				.scale(
					scaleLinear()
						.domain([minv, maxv])
						.range([tk.barheight, 0])
				)
				.tickValues([minv, maxv])
		),
		showline: true
	})

	set_height(tk, block)
}

function bar_plot_y(min, max, tkh) {
	// works for both raw value and zscore
	return v => {
		if (min < 0) {
			if (max <= 0) {
				// all negative, span is from 0 to min
				return [0, Math.max(1, (tkh * v) / min)]
			}
			// min <0, max>0
			const fs = tkh / (max - min)
			if (v > 0) return [fs * (max - v), Math.max(1, fs * v)]
			return [fs * max, Math.max(1, fs * -v)]
		}
		// min is 0
		const fs = tkh / max
		return [fs * (max - v), Math.max(1, fs * v)]
	}
}

function set_height(tk, block) {
	// call when track height updates
	tk.tklabel.attr('y', tk.barheight / 2 - block.labelfontsize / 2)
	tk.rankaxis.label.attr('y', tk.barheight / 2 + block.labelfontsize / 2)

	tk.height_main = tk.toppad + tk.barheight + tk.bottompad
	block.block_setheight()
}

function makeTk(tk, block) {
	if (!tk.sample) throw 'sample name missing'

	if (tk.dslabel) {
		/*
		this one is official tk,
		unfortunately if it is added from embedding, it will be flagged as custom
		*/
		delete tk.iscustom
	}

	if (tk.iscustom) {
		if (!tk.file && !tk.url) throw 'file or url missing for custom tk'
		if (!tk.gecfg) tk.gecfg = {}
	} else {
		// must set gecfg here to validate
		if (!tk.dslabel) throw 'dslabel missing for native track'
		if (!tk.querykey) throw 'querykey missing for native track'
		tk.mds = block.genome.datasets[tk.dslabel]
		if (!tk.mds) throw 'dataset not found: invalid value for dslabel'
		delete tk.dslabel
		tk.gecfg = tk.mds.queries[tk.querykey]
		if (!tk.gecfg) throw 'expression query not found: invalid value for querykey'
	}

	if (tk.datatype) {
		tk.gecfg.datatype = tk.datatype
		delete tk.datatype
	}

	if (!tk.barheight) tk.barheight = 60
	if (!('showrank' in tk)) tk.showrank = true

	if (!tk.gecfg.itemcolor) {
		tk.gecfg.itemcolor = 'green'
	}

	expressionstat.init_config(tk.gecfg)

	tk.rankaxis = {
		g: tk.gleft.append('g'),
		label: block.maketklefthandle(tk).attr('class', null)
	}

	tk.config_handle = block
		.maketkconfighandle(tk)
		.attr('y', 10 + block.labelfontsize)
		.on('click', () => {
			configPanel(tk, block)
		})
}

function configPanel(tk, block) {
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())

	{
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '15px')
		row.append('span').html('Height&nbsp;&nbsp;')
		row
			.append('input')
			.attr('size', 5)
			.property('value', tk.barheight)
			.on('keyup', () => {
				if (d3event.key != 'Enter') return
				const s = d3event.target.value
				if (s == '') return
				const v = Number.parseInt(s)
				if (Number.isNaN(v) || v <= 1) {
					alert('track height must be positive integer')
					return
				}
				tk.barheight = v
				renderTk(tk, block)
			})
	}

	{
		// rank/value toggle and ranking group printout are shown together
		const table = tk.tkconfigtip.d
			.append('table')
			.style('margin-bottom', '15px')
			.style('border-spacing', '5px')

		const radioname = Math.random()
		let rrank, rvalue

		{
			const tr = table.append('tr')
			tr.append('td').text('Show')
			const td = tr.append('td')

			rvalue = td
				.append('input')
				.attr('type', 'radio')
				.attr('name', radioname)
				.attr('id', radioname + 2)
				.on('change', () => {
					tk.showrank = false
					renderTk(tk, block)
				})
			td.append('label')
				.html('&nbsp;' + (tk.gecfg.datatype || 'actual value'))
				.attr('for', radioname + 2)
				.attr('class', 'sja_clbtext')
		}
		{
			const tr = table.append('tr')
			tr.append('td')
			const td = tr.append('td')
			rrank = td
				.append('input')
				.attr('type', 'radio')
				.attr('name', radioname)
				.attr('id', radioname + 1)
				.on('change', () => {
					tk.showrank = true
					renderTk(tk, block)
				})
			td.append('label')
				.html('&nbsp;Rank of a group of samples')
				.attr('for', radioname + 1)
				.attr('class', 'sja_clbtext')
				.style('margin-right', '10px')
			// details about ranking group
			const lst = []
			if (tk.attributes) {
				for (const a of tk.attributes) {
					lst.push({ k: a.label || a.k, v: a.fullvalue || a.kvalue })
				}
			}
			if (tk.totalsamples) {
				lst.push({ k: 'Total number of samples', v: tk.totalsamples + 1 })
			}
			if (lst.length) {
				client.make_table_2col(td, lst)
			}
		}

		if (tk.showrank) {
			rrank.property('checked', 1)
		} else {
			rvalue.property('checked', 1)
		}
	}

	{
	}
}
