import { scaleLinear } from 'd3-scale'
import { axisLeft, axisRight } from 'd3-axis'
import * as client from './client'
import { make_radios } from '#dom'

/*
follows bigwig track, main & subpanel rendered separately
*/

function makeTk(tk, block) {
	tk.img = tk.glider.append('image')
	if (!tk.dotsize) {
		tk.dotsize = 1
	}

	if (!tk.coveragemax) {
		tk.coveragemax = 100
	}

	if (!tk.vafheight) {
		tk.vafheight = 50
	}
	if (!tk.coverageheight) {
		tk.coverageheight = 30
	}
	if (!tk.rowspace) {
		tk.rowspace = 5
	}

	tk.tklabel.attr('y', 20)

	// left side axes
	tk.Tvafaxis = tk.gleft.append('g')
	tk.Nvafaxis = tk.gleft.append('g')
	tk.aiaxis = tk.gleft.append('g')
	// left labels
	tk.label_tumor = tk.gleft
		.append('text')
		.attr('font-family', client.font)
		.attr('font-size', block.labelfontsize)
		.attr('dominant-baseline', 'central')
		.attr('text-anchor', 'end')
		.attr('x', block.tkleftlabel_xshift)
		.attr('fill-opacity', 0.6)
		.text('Tumor')
	tk.label_germline = tk.gleft
		.append('text')
		.attr('font-family', client.font)
		.attr('font-size', block.labelfontsize)
		.attr('dominant-baseline', 'central')
		.attr('text-anchor', 'end')
		.attr('x', block.tkleftlabel_xshift)
		.attr('fill-opacity', 0.6)
		.text('Germline')
	tk.label_ai = tk.gleft
		.append('text')
		.attr('font-family', client.font)
		.attr('font-size', block.labelfontsize)
		.attr('dominant-baseline', 'central')
		.attr('text-anchor', 'end')
		.attr('x', block.tkleftlabel_xshift)
		.attr('fill-opacity', 0.6)
		.text('abs(T-G)')
	// right side axes
	tk.Tcovaxis = tk.gright.append('g')
	tk.Ncovaxis = tk.gright.append('g')
	// right labels
	tk.label_tumorcoverage = tk.gright
		.append('text')
		.attr('font-family', client.font)
		.attr('font-size', block.labelfontsize)
		.attr('dominant-baseline', 'central')
		.attr('x', 10)
		.attr('fill-opacity', 0.6)
		.text('T coverage')
	tk.label_germlinecoverage = tk.gright
		.append('text')
		.attr('font-family', client.font)
		.attr('font-size', block.labelfontsize)
		.attr('dominant-baseline', 'central')
		.attr('x', 10)
		.attr('fill-opacity', 0.6)
		.text('G coverage')

	tk.config_handle = block.maketkconfighandle(tk).on('click', event => {
		tk.tkconfigtip.clear().showunder(tk.config_handle.node())
		configPanel(tk, block)
	})
}

function tkarg(tk, block, width, rglst) {
	const lst = [
		'rglst=' + JSON.stringify(rglst || block.tkarg_rglst()),
		'genome=' + block.genome.name,
		'regionspace=' + block.regionspace,
		'width=' + (width || block.width),
		'coveragemax=' + tk.coveragemax,
		'gtotalcutoff=' + tk.gtotalcutoff,
		'gmafrestrict=' + tk.gmafrestrict,
		'vafheight=' + tk.vafheight,
		'coverageheight=' + tk.coverageheight,
		'rowspace=' + tk.rowspace,
		'dotsize=' + tk.dotsize,
		'devicePixelRatio=' + (window.devicePixelRatio > 1 ? window.devicePixelRatio : 1)
	]
	if (tk.file) {
		lst.push('file=' + tk.file)
	} else {
		lst.push('url=' + tk.url)
		if (tk.indexURL) lst.push('indexURL=' + tk.indexURL)
	}
	return lst.join('&')
}

export function loadTk(tk, block) {
	// load main part of track

	if (tk.uninitialized) {
		makeTk(tk, block)
		delete tk.uninitialized
	}

	block.tkcloakon(tk)

	client
		.dofetch2('tkaicheck?' + tkarg(tk, block))
		.then(data => {
			if (data.error) throw { message: data.error }

			const imgh = tk.vafheight * 3 + tk.rowspace * 4 + tk.coverageheight * 2

			tk.height_main = tk.toppad + imgh + tk.bottompad
			tk.img.attr('width', block.width).attr('height', imgh).attr('xlink:href', data.src)

			if (data.coveragemax) {
				tk.coveragemax = data.coveragemax
			}

			if (!data.nodata) {
				const scale = scaleLinear().domain([0, 1]).range([tk.vafheight, 0])

				let y = 0
				client.axisstyle({
					axis: tk.Tvafaxis.attr('transform', 'translate(0,' + y + ')').call(
						axisLeft().scale(scale).tickValues([0, 1])
					),
					color: 'black',
					showline: true
				})
				tk.label_tumor.attr('y', y + (tk.vafheight * 3) / 4)

				y = tk.vafheight + tk.rowspace + tk.coverageheight + tk.rowspace
				client.axisstyle({
					axis: tk.Nvafaxis.attr('transform', 'translate(0,' + y + ')').call(
						axisLeft().scale(scale).tickValues([0, 1])
					),
					color: 'black',
					showline: true
				})
				tk.label_germline.attr('y', y + tk.vafheight / 2)

				y = 2 * (tk.vafheight + tk.rowspace + tk.coverageheight + tk.rowspace)
				client.axisstyle({
					axis: tk.aiaxis.attr('transform', 'translate(0,' + y + ')').call(axisLeft().scale(scale).tickValues([0, 1])),
					color: 'black',
					showline: true
				})
				tk.label_ai.attr('y', y + tk.vafheight / 2)

				const scale2 = scaleLinear().domain([0, tk.coveragemax]).range([tk.coverageheight, 0])

				y = tk.vafheight + tk.rowspace
				client.axisstyle({
					axis: tk.Tcovaxis.attr('transform', 'translate(0,' + y + ')').call(
						axisRight().scale(scale2).tickValues([0, tk.coveragemax])
					),
					color: 'black',
					showline: true
				})
				tk.label_tumorcoverage.attr('y', y + tk.coverageheight / 2)

				y = 2 * (tk.vafheight + tk.rowspace) + tk.coverageheight + tk.rowspace
				client.axisstyle({
					axis: tk.Ncovaxis.attr('transform', 'translate(0,' + y + ')').call(
						axisRight().scale(scale2).tickValues([0, tk.coveragemax])
					),
					color: 'black',
					showline: true
				})
				tk.label_germlinecoverage.attr('y', y + tk.coverageheight / 2)
			}
			return null
		})
		.catch(obj => {
			tk.img.attr('width', 1).attr('height', 1)
			if (obj.stack) {
				// error
				console.log(obj.stack)
			}
			return obj.message
		})
		.then(errtext => {
			block.tkcloakoff(tk, { error: errtext })
			block.block_setheight()

			// also load subpanels whenever main panel updates
			for (const panel of tk.subpanels) {
				loadTksubpanel(tk, block, panel)
			}
		})
}

export function loadTksubpanel(tk, block, panel) {
	block.tkcloakon_subpanel(panel)
	const par = tkarg(tk, block, panel.width, [
		{
			chr: panel.chr,
			start: panel.start,
			stop: panel.stop,
			width: panel.width
		}
	])

	client
		.dofetch2('tkaicheck?' + par)
		.then(data => {
			if (data.error) throw { message: data.error }

			panel.img
				.attr('width', panel.width)
				.attr('height', tk.vafheight * 3 + tk.rowspace * 4 + tk.coverageheight * 2)
				.attr('xlink:href', data.src)
			return null
		})
		.catch(obj => {
			panel.img.attr('width', 1).attr('height', 1)
			if (obj.stack) {
				// error
				console.log(obj.stack)
			}
			return obj.message
		})
		.then(errtext => {
			block.tkcloakoff_subpanel(panel, { error: errtext })
		})
}

function configPanel(tk, block) {
	tk.tkconfigtip.clear()

	// height
	{
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '15px')
		row.append('span').html('Coverage max:&nbsp;')
		row
			.append('input')
			.attr('type', 'number')
			.style('width', '60px')
			.property('value', tk.coveragemax)
			.on('keyup', event => {
				if (!client.keyupEnter(event)) return
				const s = event.target.value
				if (s == '') return
				const v = Number.parseInt(s)
				if (Number.isNaN(v) || v <= 1) {
					alert('coverage max must be positive integer')
					return
				}
				tk.coveragemax = v
				loadTk(tk, block)
			})
	}
	// dot size
	{
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '15px')
		row.append('span').html('Marker dot size:&nbsp;')
		make_radios({
			holder: row,
			options: [
				{ label: '1 pixel', value: 1, checked: tk.dotsize == 1 },
				{ label: '2 pixels', value: 2, checked: tk.dotsize == 2 },
				{ label: '3 pixels', value: 3, checked: tk.dotsize == 3 }
			],
			callback: v => {
				tk.dotsize = v
				loadTk(tk, block)
			},
			styles: {
				'margin-right': '5px'
			}
		})
	}
	// gtotalcutoff
	{
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '15px')
		row.append('span').html('Filter markers by minimum total germline coverage:&nbsp;')
		row
			.append('input')
			.attr('type', 'number')
			.style('width', '60px')
			.property('value', tk.gtotalcutoff || 0)
			.on('keyup', event => {
				if (!client.keyupEnter(event)) return
				const s = event.target.value
				if (s == '') return
				const v = Number.parseInt(s)
				if (Number.isNaN(v) || v < 0) {
					alert('coverage max must be non-negative integer')
					return
				}
				if (v == tk.gtotalcutoff) return
				tk.gtotalcutoff = v
				loadTk(tk, block)
			})
		row.append('div').style('font-size', '.7em').style('opacity', 0.5).text('Set to 0 to use all markers')
	}
	// gmafrestrict
	{
		const row = tk.tkconfigtip.d.append('div').style('margin-bottom', '15px')
		row.append('span').html('Filter markers by narrowing range of germline B-allele fraction:&nbsp;')
		row
			.append('input')
			.attr('type', 'number')
			.style('width', '60px')
			.property('value', tk.gmafrestrict || 0)
			.on('keyup', event => {
				if (!client.keyupEnter(event)) return
				const s = event.target.value
				if (s == '') return
				const v = Number.parseFloat(s)
				if (Number.isNaN(v) || v < 0 || v > 0.5) {
					alert('Must enter a value between 0 and 0.5')
					return
				}
				if (tk.gmafrestrict == v) return
				tk.gmafrestrict = v
				loadTk(tk, block)
				configPanel(tk, block)
			})
		row
			.append('div')
			.style('font-size', '.7em')
			.style('opacity', 0.5)
			.text(
				(tk.gmafrestrict
					? 'Keeping markers with BAF range ' + tk.gmafrestrict + ' to ' + (1 - tk.gmafrestrict) + '. '
					: '') + 'Set to 0 to use all markers'
			)
	}
}
