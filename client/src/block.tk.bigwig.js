import { scaleLinear } from 'd3-scale'
import * as d3axis from 'd3-axis'
import * as client from './client'
import { dofetch3 } from '#common/dofetch'
import { format as d3format } from 'd3-format'
import { makeNumericAxisConfig } from '#dom/numericAxis'

/*
FIXME
bigwigloadsubpanel should return promise and be tracked
*/

export function bigwigfromtemplate(tk, template) {
	tk.scale = {}
	if (template.scale) {
		for (const k in template.scale) {
			tk.scale[k] = template.scale[k]
		}
	} else {
		tk.scale.auto = 1
	}

	if (tk.normalize) {
	} else {
		// disable by default
		tk.normalize = {
			dividefactor: 1,
			disable: 1
		}
	}
	tk.barheight = template.height || 50
	tk.height_main = tk.toppad + tk.barheight + tk.bottompad
	if (!tk.ncolor) tk.ncolor = '#BD005E'
	if (!tk.ncolor2) tk.ncolor2 = '#5E00BD'
	if (!tk.pcolor) tk.pcolor = '#005EBD'
	if (!tk.pcolor2) tk.pcolor2 = '#FA7D00'
}

export function bigwigmaketk(tk, block) {
	tk.img = tk.glider.append('image')
	tk.tklabel.attr('y', tk.barheight / 2)

	tk.leftaxis = tk.gleft.append('g')

	tk.config_handle = block.maketkconfighandle(tk).on('click', () => {
		tk.tkconfigtip.clear().showunder(tk.config_handle.node())
		bigwigconfigpanel(tk, block, tk.tkconfigtip.d, () => bigwigload(tk, block))
	})
}

export async function bigwigload(tk, block) {
	/*
	called by change view range
	or updating any rendering style, e.g. height
	*/
	block.tkcloakon(tk)
	const par = block.tkarg_q(tk)
	if (tk.dotplotfactor) {
		par.dotplotfactor = tk.dotplotfactor
	}

	tk.height_main = tk.toppad + tk.barheight + tk.bottompad
	tk.img.attr('width', block.width).attr('height', tk.barheight)

	let errtext
	try {
		const data = await dofetch3('tkbigwig', { method: 'POST', body: JSON.stringify(par) })
		if (data.error) throw data.error
		if (!data.src) throw 'data.src missing'

		// in case height changed
		tk.tklabel.transition().attr('y', tk.barheight / 2)

		tk.img.attr('xlink:href', data.src)

		if (data.minv != undefined) {
			tk.scale.min = data.minv
		}
		if (data.maxv != undefined) {
			tk.scale.max = data.maxv
		}
		tk.leftaxis.selectAll('*').remove()

		if (data.nodata) {
			throw 'No data in view range'
			// won't update axis
		}

		// update axis
		const scale = scaleLinear().domain([tk.scale.min, tk.scale.max]).range([tk.barheight, 0])

		const axis = d3axis.axisLeft().scale(scale).tickValues([tk.scale.min, tk.scale.max])

		if (tk.integer4axis) {
			axis.tickFormat(d3format('d'))
		}

		client.axisstyle({
			axis: tk.leftaxis.call(axis),
			color: 'black',
			showline: true
		})
	} catch (err) {
		tk.img.attr('width', 0).attr('height', 0)
		if (err.stack) {
			// error
			console.log(err.stack)
		}
		errtext = typeof err == 'string' ? err : err.message
	} finally {
		block.tkcloakoff(tk, { error: errtext })
		block.block_setheight()

		// also load subpanels whenever main panel updates
		for (const panel of tk.subpanels) {
			bigwigloadsubpanel(tk, block, panel)
		}
	}
}

export async function bigwigloadsubpanel(tk, block, panel) {
	block.tkcloakon_subpanel(panel)
	const par = block.tkarg_q(tk)
	if (tk.dotplotfactor) {
		par.dotplotfactor = tk.dotplotfactor
	}
	par.width = panel.width
	par.rglst = [
		{
			chr: panel.chr,
			start: panel.start,
			stop: panel.stop,
			width: panel.width
		}
	]
	delete par.percentile
	delete par.autoscale

	panel.img.attr('width', panel.width).attr('height', tk.barheight)

	let errtext
	try {
		const data = await dofetch3('tkbigwig', { method: 'POST', body: JSON.stringify(par) })
		if (data.error) throw data.error
		panel.img.attr('xlink:href', data.src)
	} catch (err) {
		panel.img.attr('width', 0).attr('height', 0)
		if (err.stack) {
			// error
			console.log(err.stack)
		}
		errtext = typeof err == 'string' ? err : err.message
	} finally {
		block.tkcloakoff_subpanel(panel, { error: errtext })
	}
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
	config.pcolor.lab = config.pcolor.row.append('span').text('Positive value color').style('padding-right', '10px')
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
	config.ncolor.lab = config.ncolor.row.append('span').text('Negative value color').style('padding-right', '10px')
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
		config.pcolor2.lab = config.pcolor2.row.append('span').html('&ge;Max color').style('padding-right', '10px')
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
		config.ncolor2.lab = config.ncolor2.row.append('span').html('&le;Min color').style('padding-right', '10px')
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
		const setting = {}
		if (tk.scale.auto) {
			setting.auto = 1
		} else if (tk.scale.percentile) {
			setting.percentile = tk.scale.percentile
		} else {
			setting.fixed = { min: tk.scale.min, max: tk.scale.max }
		}
		makeNumericAxisConfig({
			holder: holder.append('div').style('margin-bottom', '15px'),
			setting,
			callback: s => {
				if (s.auto) {
					tk.scale.auto = 1
					loader(client.bwSetting.autoscale)
					return
				}
				if (s.fixed) {
					delete tk.scale.auto
					delete tk.scale.percentile
					tk.scale.max = s.fixed.max
					tk.scale.min = s.fixed.min
					loader(client.bwSetting.fixedscale)
					return
				}
				delete tk.scale.auto
				tk.scale.percentile = s.percentile
				loader(client.bwSetting.percentilescale)
			}
		})
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
		const input = config.dividefactor.row.append('input').attr('type', 'checkbox').attr('id', id)
		if (!tk.normalize.disable) {
			input.property('checked', 1)
		}
		config.dividefactor.row.append('label').html('&nbsp;Apply normalization').attr('for', id)

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
		folder.append('div').text('Enter a value above zero').style('font-size', '.7em').style('color', '#858585')
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
