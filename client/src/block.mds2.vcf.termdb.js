import * as common from '#shared/common.js'
import * as client from './client'
import { scaleOrdinal, scaleLinear } from 'd3-scale'
import { schemeCategory10 } from 'd3-scale-chromatic'
import { schemeCategory20 } from '#common/legacy-d3-polyfill'
import { axisLeft } from 'd3-axis'
import { filterInit } from '#filter'
import { appInit } from '../termdb/app'

/*
obj{}
.mds{label}
.genome{}
.tip
.termfilter[]
.dom{}
	.row_filter
	.row_message
	.row_control
	.row_details
	.svg
.svg{}
	.ymax
	.axis_g
	.yscale
	.hoverdots
	.image
.ssid
.tmpfile


********************** EXPORTED
termdb_bygenotype
make_phewas
********************** INTERNAL
get_ssid_by_onevcfm
make_phewas_ui
run_phewas
phewas_svg
update_axis

*/

export async function make_phewas(plotdiv, m, tk, block) {
	/*
phewas and also precompute
official track only
*/

	// sample session id
	const { ssid, groups } = await get_ssid_by_onevcfm(m, tk.mds.label, block.genome.name)

	const div = plotdiv.append('div')
	const wait = div.append('div')

	try {
		// the run object
		const obj = {
			ssid,
			tip: tk.legend.tip,
			mds: tk.mds,
			genome: block.genome,
			termfilter: {
				filter: may_addfilter4phewas(tk)
			},
			dom: {}
		}

		make_phewas_ui(obj, div, tk)

		await run_phewas(obj)
		wait.remove()
	} catch (e) {
		wait.text('Error: ' + (e.message || e))
		if (e.stack) console.log(e.stack)
	}
}

function may_addfilter4phewas(tk) {
	/* to init phewas,
may add a filter to restrict samples
*/
	if (tk.vcf && tk.vcf.numerical_axis && tk.vcf.numerical_axis.in_use && tk.vcf.numerical_axis.inuse_AFtest) {
		// using AFtest, find the first termdb group and use
		const af = tk.vcf.numerical_axis.AFtest
		const tdbgrp = af.groups.find(i => i.is_termdb)
		if (tdbgrp) {
			return tdbgrp.filterApi.getNormalRoot()
		}
	}
	// no filter is added, see if cohort selection is in use
	if (tk.mds && tk.mds.termdb && tk.mds.termdb.selectCohort) {
		const s = tk.mds.termdb.selectCohort
		return {
			type: 'tvslst',
			join: '',
			in: true,
			lst: [
				{
					type: 'tvs',
					tag: 'cohortFilter',
					renderAs: 'htmlSelect',
					selectOptionsFrom: 'selectCohort',
					tvs: {
						term: JSON.parse(JSON.stringify(s.term)),
						values: s.values[0].keys.map(i => {
							return { key: i }
						})
					}
				}
			]
		}
	}
}

function get_args(obj) {
	const lst = [
		'genome=' + obj.genome.name,
		'dslabel=' + obj.mds.label,
		'ssid=' + obj.ssid,
		'phewas=1',
		'intendwidth=' + obj.svg.intendwidth,
		'axisheight=' + obj.svg.axisheight,
		'groupnamefontsize=' + obj.svg.groupnamefontsize,
		'dotradius=' + obj.svg.dotradius,
		'groupxspace=' + obj.svg.groupxspace,
		'leftpad=' + obj.svg.leftpad,
		'rightpad=' + obj.svg.rightpad,
		'toppad=' + obj.svg.toppad,
		'bottompad=' + obj.svg.bottompad,
		'devicePixelRatio=' + (window.devicePixelRatio > 1 ? window.devicePixelRatio : 1)
	]
	if (obj.termfilter.filter) lst.push('filter=' + encodeURIComponent(JSON.stringify(obj.termfilter.filter)))
	return lst
}

async function run_phewas(obj) {
	obj.dom.svg.selectAll('*').remove()
	const data = await client.dofetch2('/termdb?' + get_args(obj).join('&'))
	if (data.error) throw data.error
	if (!data.tmpfile) throw 'data.tmpfile missing'
	obj.tmpfile = data.tmpfile
	obj.svg.ymax = data.maxlogp
	obj.dom.filter_says.text('n=' + data.numberofsamples)
	phewas_svg(data, obj)
}

function make_phewas_ui(obj, div, tk) {
	// vertical layers
	obj.dom.row_filter = div.append('div').style('margin-bottom', '5px')
	obj.dom.row_message = div.append('div')
	obj.dom.row_control = div.append('div').style('margin', '10px 0px')
	obj.dom.svg = div.append('svg')
	obj.dom.row_details = div.append('div')
	obj.svg = {
		intendwidth: 800,
		axisheight: 300,
		groupnamefontsize: 16,
		dotradius: 2,
		groupxspace: 3,
		leftpad: 2,
		rightpad: 2,
		toppad: 20,
		bottompad: 10
	}

	{
		// filter
		obj.dom.row_filter
			.append('div')
			.style('display', 'inline-block')
			.text('FILTER')
			.style('font-size', '.7em')
			.style('opacity', 0.5)

		filterInit({
			vocab: {
				route: 'termdb',
				genome: obj.genome.name,
				dslabel: obj.mds.label
			},
			holder: obj.dom.row_filter.append('div').style('display', 'inline-block').style('margin', '0px 10px'),
			termdbConfig: obj.mds.termdb,
			callback: async f => {
				obj.termfilter.filter = f
				await run_phewas(obj)
			}
		}).main(obj.termfilter.filter)

		obj.dom.filter_says = obj.dom.row_filter.append('div').style('display', 'inline-block')
	}

	// controls
	{
		const input = obj.dom.row_control
			.append('input')
			.attr('type', 'number')
			.style('width', '150px')
			.attr('placeholder', 'Set Y axis max')
			.on('keyup', async event => {
				if (!client.keyupEnter(event)) return
				const s = input.property('value')
				if (!s) return
				const v = Number(s)
				if (v <= 0) {
					window.alert('Max value must be above 0')
					return
				}
				obj.svg.ymax = v
				input.property('value', '').property('disabled', true).attr('placeholder', 'Loading...')
				const lst = get_args(obj)
				lst.push('update=1')
				lst.push('file=' + obj.tmpfile)
				lst.push('max=' + obj.svg.ymax)
				const data = await client.dofetch2('/termdb?' + lst.join('&'))
				obj.svg.image.attr('xlink:href', data.src)
				update_axis(data, obj)
				input.property('disabled', false).attr('placeholder', 'Set Y axis max')
			})
	}
}

function phewas_svg(data, obj) {
	////////////// message
	obj.dom.row_message.text(
		data.testcount +
			' attributes tested, ' +
			data.hoverdots.length +
			' attributes with p-value <= 0.05, ' +
			'Max -log10(p-value) is ' +
			obj.svg.ymax
	)

	////////////// message

	////////////// svg
	const axiswidth = 80
	const xpad = 5
	obj.dom.svg.attr('width', axiswidth + xpad + data.canvaswidth)

	{
		// group labels define svg height
		let maxgrouplabheight = 0
		for (const g of data.grouplabels) {
			obj.dom.svg
				.append('g')
				.attr('transform', 'translate(' + (axiswidth + xpad + g.x) + ',' + g.y + ')')
				.append('text')
				.attr('font-size', data.groupnamefontsize)
				.text(g.name)
				.attr('dominant-baseline', 'central')
				.attr('transform', 'rotate(90)')
				.each(function () {
					maxgrouplabheight = Math.max(maxgrouplabheight, this.getBBox().width)
				})
				.attr('class', 'sja_svgtext2')
				.on('click', () => {
					get_group(g.name)
				})
		}
		obj.dom.svg.attr('height', data.canvasheight + maxgrouplabheight)
	}

	const g0 = obj.dom.svg.append('g')

	// axis
	obj.svg.yscale = scaleLinear()
	obj.svg.axis_g = g0.append('g').attr('transform', 'translate(' + axiswidth + ',' + obj.svg.toppad + ')')

	// axis label
	g0.append('g')
		.attr('transform', 'translate(10,' + (obj.svg.toppad + obj.svg.axisheight / 2) + ')')
		.append('text')
		.text('-Log10(p-value)')
		.attr('text-anchor', 'middle')
		.attr('dominant-baseline', 'central')
		.attr('transform', 'rotate(-90)')

	// plot
	const g = g0.append('g').attr('transform', 'translate(' + (axiswidth + xpad) + ',0)')
	obj.svg.image = g
		.append('image')
		.attr('width', data.canvaswidth)
		.attr('height', data.canvasheight)
		.attr('xlink:href', data.src)

	obj.svg.hoverdots = g
		.append('g')
		.attr('transform', 'translate(0,' + obj.svg.toppad + ')')
		.selectAll()
		.data(data.hoverdots)
		.enter()
		.append('g')
	obj.svg.hoverdots
		.append('circle')
		.attr('r', obj.svg.dotradius)
		.attr('fill', 'red')
		.on('mouseover', (event, d) => {
			console.log(d)
			obj.tip.clear()
			const div = obj.tip.d.append('div').style('margin', '10px')
			div.append('div').text(d.term.name)
			if (d.parent_name) {
				div
					.append('div')
					.style('font-size', '.7em')
					.style('opacity', '.5')
					.text('of ' + d.parent_name)
			}
			const table = div.append('table').style('margin', '10px 0px')
			{
				const tr = table.append('tr').style('font-size', '.7em').style('opacity', 0.5)
				tr.append('td')
				tr.append('td').text('REF/REF')
				tr.append('td').text('REF/ALT')
				tr.append('td').text('ALT/ALT')
			}
			{
				const tr = table.append('tr')
				tr.append('td').text(d.group1label)
				tr.append('td').text(d.table[0])
				tr.append('td').text(d.table[2])
				tr.append('td').text(d.table[4])
			}
			{
				const tr = table.append('tr')
				tr.append('td').text(d.group2label)
				tr.append('td').text(d.table[1])
				tr.append('td').text(d.table[3])
				tr.append('td').text(d.table[5])
			}
			div.append('div').html('<span style="opacity:.5;font-size:.8em">P-value:</span> ' + d.pvalue)
			obj.tip.show(d.clientX, d.clientY)
		})
		.on('mouseout', () => {
			obj.tip.hide()
		})

	update_axis(data, obj)

	async function get_group(name) {
		// get list of categories for a group by clicking on label
		obj.dom.row_details.selectAll('*').remove()
		const wait = obj.dom.row_details.append('div').text('Loading...')
		const arg = [
			'genome=' + obj.genome.name,
			'dslabel=' + obj.mds.label,
			'file=' + obj.tmpfile,
			'phewas=1',
			'getgroup=' + name
		]
		const data2 = await client.dofetch2('/termdb?' + arg.join('&'))
		wait.remove()
		const table = obj.dom.row_details.append('table')
		const tr = table.append('tr')
		tr.append('th').text('Term')
		tr.append('th').text('Case')
		tr.append('th').text('Control')
		tr.append('th').text('P-value')
		for (const i of data2.categories) {
			const tr = table.append('tr')
			tr.append('td').text(i.term.name)
			{
				const sum = i.table[0] + i.table[1]
				const barsvg = client.fillbar(null, { f: sum > 0 ? i.table[0] / sum : 0 })
				tr.append('td').html(
					i.group1label +
						' ' +
						barsvg +
						' <span style="font-size:.7em;opacity:.5">ALT/REF</span> ' +
						i.table[0] +
						' / ' +
						i.table[1]
				)
			}
			{
				const sum = i.table[2] + i.table[3]
				const barsvg = client.fillbar(null, { f: sum > 0 ? i.table[2] / sum : 0 })
				tr.append('td').html(
					i.group2label +
						' ' +
						barsvg +
						' <span style="font-size:.7em;opacity:.5">ALT/REF</span> ' +
						i.table[2] +
						' / ' +
						i.table[3]
				)
			}
			const td = tr.append('td').text(i.pvalue)
			if (i.pvalue <= 0.05) td.style('color', 'red')
		}
	}
}

function update_axis(data, obj) {
	obj.svg.yscale.domain([obj.svg.ymax, 0]).range([0, obj.svg.axisheight])
	client.axisstyle({
		axis: obj.svg.axis_g.call(axisLeft().scale(obj.svg.yscale)),
		fontsize: 12,
		showline: true
	})
	obj.svg.hoverdots.attr(
		'transform',
		d => 'translate(' + d.x + ',' + (d.logp >= obj.svg.ymax ? 0 : obj.svg.yscale(d.logp)) + ')'
	)
}

function get_ssid_by_onevcfm(m, dslabel, genome) {
	/*
using the genotype of one variant from the vcf file
divide samples to groups
record it in a temp file at cache
and get the file name
use the file name as a session in termdb
*/
	const arg = {
		dslabel: dslabel,
		genome: genome,
		m: {
			chr: m.chr,
			pos: m.pos,
			ref: m.ref,
			alt: m.alt
		},
		trigger_ssid_onevcfm: true
	}

	return client.dofetch('mds2', arg).then(data => {
		if (data.error) throw data.error
		return data
	})
}

export async function termdb_bygenotype(plotdiv, m, tk, block) {
	/*
not in use

launch termdb by the genotype of one vcf variant

official track only
*/

	// sample session id
	const { ssid, groups } = await get_ssid_by_onevcfm(m, tk.mds.label, block.genome.name)

	// assign a color for each group, show color legend
	const row = plotdiv.append('div').style('margin', '10px')
	const f = scaleOrdinal(schemeCategory10)
	for (const name in groups) {
		groups[name].color = f(name)
		// un-comment these rows as needed
		row
			.append('div')
			.style('font-size', '.7em')
			.style('color', 'white')
			.style('display', 'inline-block')
			.style('background', groups[name].color)
			.style('padding', '2px 4px')
			.text(groups[name].size)
		row
			.append('div')
			.style('display', 'inline-block')
			.style('padding', '1px 5px')
			.style('margin-right', '5px')
			.text(name)
	}

	const opt = {
		state: {
			vocab: {
				route: 'termdb',
				dslabel: tk.mds.label,
				genome: block.genome.name
			},
			/*
		 	TODO: may need to handle a cohort filter option in an optional termdb app filter component 
		  termfilter: {
				filter: [{type: 'tvs', renderAs: 'htmlSelect', tvs: {...}}]
		  },
			***/
			ssid: {
				chr: m.chr, // chr and pos needed for computing AF with respect to sex & par
				pos: m.pos,
				mutation_name: m.mname,
				ssid,
				groups
			}
		},
		holder: plotdiv,
		barchart: {
			bar_click_opts: []
		}
	}
	if (tk.sample_termfilter) {
		// just use a single filter, no race grp restriction
		opt.state.termfilter = {
			filter: JSON.parse(JSON.stringify(tk.sample_termfilter))
		}
	}
	appInit(opt)
}
