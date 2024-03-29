import { scaleLinear } from 'd3-scale'
import * as d3axis from 'd3-axis'
import * as client from './client'
import { format as d3format } from 'd3-format'

export async function loadTk(tk, block) {
	/*
	 */

	block.tkcloakon(tk)
	block.block_setheight()

	const _finish = loadTk_finish_closure(tk, block) // function used at multiple places

	try {
		if (tk.uninitialized) {
			makeTk(tk, block)
			delete tk.uninitialized
		}

		await loadTk_do(tk, block)

		_finish({})
	} catch (e) {
		tk.height_main = 50
		_finish({ error: e.message || e })
		if (e.stack) console.log(e.stack)
		return
	}
}

function loadTk_finish_closure(tk, block) {
	return data => {
		block.tkcloakoff(tk, { error: data.error })
		block.block_setheight()
		block.setllabel()
	}
}

function makeTk(tk, block) {
	if (!tk.scale) tk.scale = {}
	if (Number.isFinite(tk.scale.min) && Number.isFinite(tk.scale.max)) {
	} else {
		tk.scale.auto = true
	}

	if (!Number.isFinite(tk.barheight)) tk.barheight = 100
	tk.height_main = tk.toppad + tk.barheight + tk.bottompad
	if (!tk.ncolor) tk.ncolor = '#BD005E'
	if (!tk.ncolor2) tk.ncolor2 = '#5E00BD'
	if (!tk.pcolor) tk.pcolor = '#005EBD'
	if (!tk.pcolor2) tk.pcolor2 = '#FA7D00'

	tk.leftaxis = tk.gleft.append('g')

	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		tk.tkconfigtip.clear().showunder(tk.config_handle.node())
		//bigwigconfigpanel(tk, block, tk.tkconfigtip.d, ()=>bigwigload(tk,block))
	})
}

export async function loadTk_do(tk, block) {
	/*
	called by change view range
	or updating any rendering style, e.g. height
	*/
	block.tkcloakon(tk)
	const par = block.tkarg_q(tk)
	par.rglst = rglst_quickfix(tk, block)
	par.genome = block.genome.name

	tk.height_main = tk.toppad + tk.barheight + tk.bottompad

	tk.glider.selectAll('*').remove()

	const data = await client.dofetch('tkbedgraphdot', par)
	if (data.error) throw data.error

	// in case height changed
	tk.tklabel.transition().attr('y', tk.barheight / 2)

	for (const r of data.rglst) {
		const img = tk.glider
			.append('g')
			.attr('transform', 'translate(' + r.xoff + ',' + tk.toppad + ')')
			.append('image')
			.attr('width', r.width)
			.attr('height', tk.barheight)
			.attr('xlink:href', r.img)
	}

	tk.leftaxis.selectAll('*').remove()

	if (data.nodata) {
		throw 'no data in view range'
		// won't update axis
	}

	if (data.minv != undefined) {
		tk.scale.min = data.minv
		tk.scale.max = data.maxv
	}

	// update axis
	const scale = scaleLinear()
		.domain([tk.scale.min, tk.scale.max])
		.range([tk.barheight, 0])

	const axis = d3axis
		.axisLeft()
		.scale(scale)
		.tickValues([tk.scale.min, tk.scale.max])

	if (tk.integer4axis) {
		axis.tickFormat(d3format('d'))
	}

	client.axisstyle({
		axis: tk.leftaxis.call(axis),
		color: 'black',
		showline: true
	})
}

export function bigwigconfigpanel(tk, block, holder, loader) {
	// provide hooks to each component, so that caller can choose to hide certain ones
	const config = {
		pcolor: {},
		ncolor: {},
		pcolor2: {},
		ncolor2: {},
		// .row
		// .lab

		dotplot: {},
		// .row

		dividefactor: {}
	}

	// height
	{
		const row = holder.append('div').style('margin-bottom', '15px')
		row.append('span').html('Height&nbsp;&nbsp;')
		row
			.append('input')
			.attr('size', 5)
			.property('value', tk.barheight)
			.on('keyup', event => {
				if (event.code != 'Enter') return
				const s = event.target.value
				if (s == '') return
				const v = Number.parseInt(s)
				if (Number.isNaN(v) || v <= 1) {
					alert('track height must be positive integer')
					return
				}
				tk.barheight = v
				loader(client.bwSetting.height)
			})
	}

	// pcolor
	config.pcolor.row = holder.append('div').style('margin-bottom', '15px')
	config.pcolor.lab = config.pcolor.row
		.append('span')
		.text('Positive value color')
		.style('padding-right', '10px')
	config.pcolor.row
		.append('input')
		.attr('type', 'color')
		.property('value', client.rgb2hex(tk.pcolor))
		.on('change', event => {
			tk.pcolor = event.target.value
			loader(client.bwSetting.pcolor)
		})

	// ncolor
	config.ncolor.row = holder.append('div').style('margin-bottom', '15px')
	config.ncolor.lab = config.ncolor.row
		.append('span')
		.text('Negative value color')
		.style('padding-right', '10px')
	config.ncolor.row
		.append('input')
		.attr('type', 'color')
		.property('value', client.rgb2hex(tk.ncolor))
		.on('change', event => {
			tk.ncolor = event.target.value
			loader(client.bwSetting.ncolor)
		})

	if (!tk.scale.auto) {
		// pcolor2
		config.pcolor2.row = holder.append('div').style('margin-bottom', '15px')
		config.pcolor2.lab = config.pcolor2.row
			.append('span')
			.html('&ge;Max color')
			.style('padding-right', '10px')
		config.pcolor2.row
			.append('input')
			.attr('type', 'color')
			.property('value', client.rgb2hex(tk.pcolor2))
			.on('change', event => {
				tk.pcolor2 = event.target.value
				loader(client.bwSetting.pcolor2)
			})
		// ncolor2
		config.ncolor2.row = holder.append('div').style('margin-bottom', '15px')
		config.ncolor2.lab = config.ncolor2.row
			.append('span')
			.html('&le;Min color')
			.style('padding-right', '10px')
		config.ncolor2.row
			.append('input')
			.attr('type', 'color')
			.property('value', client.rgb2hex(tk.ncolor2))
			.on('change', event => {
				tk.ncolor2 = event.target.value
				loader(client.bwSetting.ncolor2)
			})
	}

	// y-scale
	{
		const row = holder.append('div').style('margin-bottom', '15px')
		row.append('span').html('Y scale&nbsp;&nbsp;')
		const ss = row.append('select')
		const ssop1 = ss.append('option').text('automatic')
		const ssop2 = ss.append('option').text('fixed')
		const ssop3 = ss.append('option').text('percentile')
		ss.on('change', event => {
			const si = event.target.selectedIndex
			if (si == 0) {
				fixed.style('display', 'none')
				percentile.style('display', 'none')
				tk.scale.auto = 1
				loader(client.bwSetting.autoscale)
				return
			}
			if (si == 1) {
				fixed.style('display', 'block')
				percentile.style('display', 'none')
				return
			}
			fixed.style('display', 'none')
			percentile.style('display', 'block')
		})
		let usingfixed = false,
			usingperc = false
		if (tk.scale.auto) {
			ssop1.property('selected', 1)
		} else {
			if (tk.scale.percentile) {
				usingperc = true
				ssop3.property('selected', 1)
			} else {
				usingfixed = true
				ssop2.property('selected', 1)
			}
		}
		// y-scale fixed
		const fixed = row
			.append('div')
			.style('margin', '10px')
			.style('display', usingfixed ? 'block' : 'none')
		{
			const row1 = fixed.append('div')
			row1
				.append('span')
				.html('Max&nbsp;')
				.style('font-family', 'Courier')
				.style('font-size', '.9em')
			const max = row1.append('input').attr('size', 5)
			if (usingfixed) {
				max.property('value', tk.scale.max)
			}
			const row2 = fixed.append('div')
			row2
				.append('span')
				.html('Min&nbsp;')
				.style('font-family', 'Courier')
				.style('font-size', '.9em')
			const min = row2.append('input').attr('size', 5)
			if (usingfixed) {
				min.property('value', tk.scale.min)
			}
			row2
				.append('button')
				.text('Set')
				.style('margin-left', '5px')
				.on('click', () => {
					const s1 = max.property('value')
					if (s1 == '') {
						return
					}
					const v1 = Number.parseFloat(s1)
					if (Number.isNaN(v1)) {
						alert('invalid max value')
						return
					}
					const s2 = min.property('value')
					if (s2 == '') {
						return
					}
					const v2 = Number.parseFloat(s2)
					if (Number.isNaN(v2)) {
						alert('invalid min value')
						return
					}
					delete tk.scale.auto
					delete tk.scale.percentile
					tk.scale.max = v1
					tk.scale.min = v2
					loader(client.bwSetting.fixedscale)
				})
		}
		// y-scale percentile
		const percentile = row
			.append('div')
			.style('margin-top', '6px')
			.style('display', usingperc ? 'block' : 'none')
		{
			percentile
				.append('span')
				.html('Percentile&nbsp;')
				.style('font-family', 'Courier')
				.style('font-size', '.9em')
			const input = percentile.append('input').attr('size', 5)
			if (usingperc) {
				input.property('value', tk.scale.percentile)
			}
			const setpercentile = s => {
				if (s == '') return
				const v = Number.parseInt(s)
				if (Number.isNaN(v) || v <= 0 || v > 100) {
					alert('percentile should be integer within range 0-100')
					return
				}
				delete tk.scale.auto
				tk.scale.percentile = v
				loader(client.bwSetting.percentilescale)
			}
			input.on('keyup', event => {
				if (event.code != 'Enter') return
				setpercentile(input.property('value'))
			})
			percentile
				.append('button')
				.text('Set')
				.style('margin-left', '5px')
				.on('click', () => {
					setpercentile(input.property('value'))
				})
		}
	}

	// dot plot
	{
		config.dotplot.row = holder.append('div').style('margin-bottom', '15px')
		config.dotplot.row.append('span').html('Dot plot&nbsp;&nbsp;')
		const s = config.dotplot.row.append('select').on('change', event => {
			const i = event.target.selectedIndex
			if (i == 0) {
				delete tk.dotplotfactor
			} else {
				tk.dotplotfactor = Number.parseInt(event.target.options[i].innerHTML)
			}
			loader(i == 0 ? client.bwSetting.nodotplot : client.bwSetting.usedotplot)
		})
		let o = s.append('option').text('no')
		if (!tk.dotplotfactor) {
			o.property('selected', 1)
		}
		o = s.append('option').text('5')
		if (tk.dotplotfactor == 5) {
			o.property('selected', 1)
		}
		o = s.append('option').text('10')
		if (tk.dotplotfactor == 10) {
			o.property('selected', 1)
		}
		o = s.append('option').text('15')
		if (tk.dotplotfactor == 15) {
			o.property('selected', 1)
		}
		o = s.append('option').text('20')
		if (tk.dotplotfactor == 20) {
			o.property('selected', 1)
		}
	}

	// normalization using a divide-by factor
	config.dividefactor.row = holder.append('div')
	//.style('margin-bottom','15px')
	{
		const id = Math.random().toString()
		const input = config.dividefactor.row
			.append('input')
			.attr('type', 'checkbox')
			.attr('id', id)
		if (!tk.normalize.disable) {
			input.property('checked', 1)
		}
		config.dividefactor.row
			.append('label')
			.html('&nbsp;Apply normalization')
			.attr('for', id)

		const folder = config.dividefactor.row
			.append('div')
			.style('margin', '5px 10px 0px 20px')
			.style('display', tk.normalize.disable ? 'none' : 'block')
		folder.append('span').html('Divide raw value by&nbsp;')
		const factorinput = folder
			.append('input')
			.attr('type', 'number')
			.style('width', '60px')
			.property('value', tk.normalize.dividefactor)
			.on('keyup', event => {
				if (event.code != 'Enter' && event.code != 'NumpadEnter') return
				const v = event.target.value
				if (v <= 0) {
					// don't allow
					return
				}
				tk.normalize.dividefactor = v
				loader(client.bwSetting.usedividefactor)
			})
		folder
			.append('div')
			.text('Enter a value above zero')
			.style('font-size', '.7em')
			.style('color', '#858585')
		input.on('change', event => {
			if (event.target.checked) {
				client.appear(folder)
				delete tk.normalize.disable
				factorinput.property('value', tk.normalize.dividefactor)
				loader(client.bwSetting.usedividefactor)
				return
			}
			client.disappear(folder)
			tk.normalize.disable = 1
			loader(client.bwSetting.nodividefactor)
		})
	}
	return config
}

function rglst_quickfix(tk, block) {
	/*
this is just a quick fix, leaving to be resolved in P4
should be exported from client
*/
	let rglst = block.tkarg_rglst(tk) // note here: not tkarg_usegm
	if (block.usegm) {
		/* to merge par.rglst[] into one region
		this does not apply to subpanels
		*/
		const r = rglst[0]
		r.usegm_isoform = block.usegm.isoform
		for (let i = 1; i < rglst.length; i++) {
			const ri = rglst[i]
			r.width += ri.width + block.regionspace
			r.start = Math.min(r.start, ri.start)
			r.stop = Math.max(r.stop, ri.stop)
		}
		rglst = [r]
	}

	// append xoff to each r from block
	let xoff = 0
	for (const r of rglst) {
		r.xoff = 0
		xoff += r.width + block.regionspace
	}

	if (block.subpanels.length == tk.subpanels.length) {
		/*
		must wait when subpanels are added to tk
		this is only done when block finishes loading data for main tk
		*/
		for (const r of block.subpanels) {
			rglst.push({
				chr: r.chr,
				start: r.start,
				stop: r.stop,
				width: r.width,
				exonsf: r.exonsf,
				xoff: xoff
			})
			xoff += r.width + r.leftpad
		}
	}
	return rglst
}
