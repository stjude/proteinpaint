import { scaleLinear } from 'd3-scale'
import { axisLeft, axisRight } from 'd3-axis'
import * as client from './client'
import { basecolor } from '#shared/common.js'

export function bampilefromtemplate(tk, template) {
	if (!tk.fineheight) {
		tk.fineheight = 200
	}
	if (!tk.allheight) {
		tk.allheight = 100
	}
	if (!tk.midpad) {
		tk.midpad = 15
	}
	if (!tk.fineymax) {
		tk.fineymax = 50
	}
}

export function bampilemaketk(tk, block) {
	tk.img = tk.glider.append('image').on('click', event => {
		if (!tk.link) return
		// if tk.link is provided, will work
		if (block.exonsf < 1) return
		const x = event.clientX - block.svg.node().getBoundingClientRect().left - block.leftheadw - block.lpad
		const [ridx, pos] = block.pxoff2region(x)
		const chr = block.rglst[ridx].chr
		const link = tk.link.replace('__CHR__', chr).replace('__POS__', pos + 1)
		window.open(link)
	})

	tk.allaxis = tk.gleft.append('g')
	tk.fineaxis = tk.gleft.append('g').attr('transform', 'translate(0,' + (tk.allheight + tk.midpad) + ')')

	tk.config_handle = block.maketkconfighandle(tk).on('click', event => {
		configpanel(tk, block)
	})
}

export function bampileload(tk, block) {
	block.tkcloakon(tk)
	const par = [
		'genome=' + block.genome.name,
		'fineheight=' + tk.fineheight,
		'allheight=' + tk.allheight,
		'midpad=' + tk.midpad,
		'fineymax=' + tk.fineymax,
		'regionspace=' + block.regionspace,
		'width=' + block.width,
		'rglst=' + JSON.stringify(block.tkarg_rglst())
	]
	if (tk.usegrade) par.push('usegrade=' + tk.usegrade)
	if (tk.file) par.push('file=' + tk.file)
	else par.push('url=' + tk.url)
	client
		.dofetch2('tkbampile?' + par.join('&'))
		.then(data => {
			if (data.error) throw { message: data.error }

			if (data.allgrades) {
				tk.grades = data.allgrades
				tk.usegrade = data.usegrade
				// show controls
			}
			tk.img
				.attr('width', block.width)
				.attr('height', tk.allheight + tk.midpad + tk.fineheight)
				.attr('xlink:href', data.src)
			tk.allaxis.selectAll('*').remove()
			if (data.allmax) {
				const scale = scaleLinear().domain([0, data.allmax]).range([tk.allheight, 0])
				client.axisstyle({
					axis: tk.allaxis.call(axisRight().scale(scale).ticks(4)),
					color: 'black',
					showline: true
				})
			}
			const scale = scaleLinear().domain([0, tk.fineymax]).range([tk.fineheight, 0])
			client.axisstyle({
				axis: tk.fineaxis.call(axisLeft().scale(scale)),
				color: 'black',
				showline: true
			})
		})
		.catch(err => {
			if (err.stack) console.log(err.stack)
			return err.message
		})
		.then(errmsg => {
			tk.height_main = tk.toppad + tk.allheight + tk.midpad + tk.fineheight + tk.bottompad
			block.tkcloakoff(tk, { error: errmsg })
			block.block_setheight()
		})
}

function configpanel(tk, block) {
	tk.tkconfigtip.clear().showunder(tk.config_handle.node())
	const holder = tk.tkconfigtip.d

	if (tk.grades) {
		const table = holder.append('table').style('margin-bottom', '10px')
		for (const g of tk.grades) {
			const tr = table.append('tr')
			tr.append('td').html(g == tk.usegrade ? '&#10004;' : '')
			tr.append('td')
				.text(g)
				.classed('sja_menuoption', true)
				.on('click', event => {
					tk.usegrade = g
					bampileload(tk, block)
					tk.tkconfigtip.hide()
				})
		}
	} else {
		holder.append('div').style('margin', '10px').text('No grades yet.')
	}
	// read depth cutoff
	{
		const row = holder.append('div').style('margin-bottom', '10px')
		row.append('div').text('Read depth cutoff:').style('font-size', '.8em')
		const input = row
			.append('input')
			.attr('size', 5)
			.on('keyup', event => {
				if (event.code != 'Enter') return
				const s = event.target.value
				if (!s) return
				const v = Number.parseInt(s)
				if (Number.isNaN(v)) return
				if (v <= 0) return
				tk.fineymax = v
				bampileload(tk, block)
			})
		row
			.append('button')
			.text('Set')
			.style('margin-left', '3px')
			.on('click', event => {
				const s = input.property('value')
				if (!s) return
				const v = Number.parseInt(s)
				if (Number.isNaN(v)) return
				if (v <= 0) return
				tk.fineymax = v
				bampileload(tk, block)
			})
	}
	for (const nt in basecolor) {
		const row = holder.append('div').style('margin-bottom', '3px')
		row
			.append('div')
			.style('width', '12px')
			.style('height', '12px')
			.style('display', 'inline-block')
			.style('background-color', basecolor[nt])
			.style('margin-right', '10px')
		row.append('span').text(nt)
	}
}
