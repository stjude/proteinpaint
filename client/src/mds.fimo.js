import * as client from './client'
import { axisTop } from 'd3-axis'
import { scaleLinear } from 'd3-scale'

/*



obj{}:
.genome {}
.fimo_thresh
.minabslogp    min abs log p
.flankspan     bp
.gain/losscolor
.motifrowheight
.m{}
	.chr
	.pos
	.ref
	.alt
.div<>
.svg<>
.legend{}
.callback_once()
.gene2position{}     for current list of factors

.factor_profiles[ {} ]
	.name
	.headerg<>
	.leftpad
	.width
	.motifs[ {} ]
		.motif    ---> one of data.items[]
		.g
		.boxplot{}
			.out[]
	=== PROFILE TYPE ===
	.isgenevalue
		.mdslabel
		.querykey
		.samplegroup_attrlst[{}]
			.k
			.kvalue
		.axisg<>
		.gene2result{}
	=== OTHER TYPE ===



data{} returned by /fimo
.refseq   nt sequence
.refstart
.refstop
.items[{}]
	.loss/gain   BOOL
	.pvalue
	.name           factor name
	.logpvaluediff
	.attr{}
	.gene   from .attr.gene
	.start
	.stop
	.strand +/-
	.g<>
	.layer1_g<>
	.layer2_g<>
	.bgbox<>
	.coverbox<>



********************** EXPORTED
init()
********************** INTERNAL
show_result()
draw_motif_simplified()
load_factorprofile
load_factorprofile_genevalue
load_factorprofile_genevalueonesample
factorprofile_genevalue_onegene_loadboxplot
*/

// header height, for all panels
// this may be dynamic as certain profile may increase it
const headerheight = 80

const headerunderpad = 5

export async function init(obj) {
	/*
	 */
	window.obj = obj

	obj.errdiv = obj.div.append('div')

	try {
		init_ui(obj)
		await do_query(obj)
	} catch (e) {
		obj.errdiv.text(e.message || e)
		if (e.stack) console.log(e.stack)
	}
}

function init_ui(obj) {
	// set attr
	obj.motifrowheight = 16
	obj.gaincolor = 'red'
	obj.losscolor = 'blue'
	obj.flankspan = 15
	if (!obj.fimo_thresh) obj.fimo_thresh = 1e-3
	if (!obj.minabslogp) obj.minabslogp = 1

	obj.tip = new client.Menu()

	const table = obj.div
		.append('table')
		.style('border-spacing', '3px')
		.style('border-collapse', 'separate')
		.style('margin', '10px')

	// flank bp len
	{
		const tr = table.append('tr')
		tr.append('td').text('Flanking sequence (#nt)')
		const td = tr.append('td')
		td.append('input')
			.attr('type', 'number')
			.style('margin', '0px 10px')
			.style('width', '100px')
			.property('value', obj.flankspan)
			.on('keyup', event => {
				if (!client.keyupEnter(event)) return
				const v = Number.parseInt(event.target.value)
				if (v < 10) {
					window.alert('Enter integer above 10')
					return
				}
				if (v == obj.flankspan) return
				obj.flankspan = v
				do_query(obj)
			})
		td.append('span').style('font-size', '0.7em').style('opacity', 0.5).text('Press ENTER to update')
	}
	// p thresh
	{
		const tr = table.append('tr')
		tr.append('td').text('P-value cutoff')
		const td = tr.append('td')
		td.append('input')
			.attr('type', 'number')
			.style('margin', '0px 10px')
			.style('width', '100px')
			.property('value', obj.fimo_thresh)
			.on('keyup', event => {
				if (!client.keyupEnter(event)) return
				const v = Number.parseFloat(event.target.value)
				if (v <= 0) {
					window.alert('Enter a p value between 0 to 1')
					return
				}
				if (v == obj.fimo_thresh) return
				obj.fimo_thresh = v
				do_query(obj)
			})
		td.append('span').style('font-size', '0.7em').style('opacity', 0.5).text('Press ENTER to update')
	}

	// minimum logp for display
	{
		const tr = table.append('tr')
		tr.append('td').text('Minimum log10 p-value difference')
		const td = tr.append('td')
		td.append('input')
			.attr('type', 'number')
			.style('margin', '0px 10px')
			.style('width', '100px')
			.property('value', obj.minabslogp)
			.on('keyup', event => {
				if (!client.keyupEnter(event)) return
				const v = Number.parseFloat(event.target.value)
				if (v <= 0) {
					window.alert('Enter a number above 0')
					return
				}
				if (v == obj.minabslogp) return
				obj.minabslogp = v
				do_query(obj)
			})
		td.append('span').style('font-size', '0.7em').style('opacity', 0.5).text('Press ENTER to update')
	}

	// dom
	obj.wait = obj.div.append('div')
	obj.svg = obj.div.append('svg')
	obj.dynamic_g = obj.svg.append('g') // all dynamic components rendered after loading data
	obj.legend = {}
	obj.legend.logpvaluediv = obj.div.append('div')

	may_init_factorprofiles(obj)
}

function may_init_factorprofiles(obj) {
	if (!obj.factor_profiles) return
	if (!Array.isArray(obj.factor_profiles)) throw 'factor_profiles is not array'
	for (const profile of obj.factor_profiles) {
		if (!profile.name) throw 'name missing for a profile'
		if (!profile.leftpad) profile.leftpad = 20
		if (!profile.width) profile.width = 300

		profile.headerg = obj.svg.append('g')
		profile.textlabel = profile.headerg
			.append('text')
			.text(profile.name)
			.attr('x', profile.width / 2)
			.attr('text-anchor', 'middle')
			.attr('y', -30)

		if (profile.isgenevalue) {
			profile.color = 'green'
			profile.axisg = profile.headerg.append('g')
			continue
		}
		if (profile.isgenevalueonesample) {
			if (!profile.samplename) throw 'samplename missing for isgenevalueonesample'
			profile.barcolor = '#62945B'
			profile.axisg = profile.headerg.append('g')
			continue
		}
		throw 'unknown profile type'
	}
}

function do_query(obj) {
	client.appear(obj.wait.text('Loading...'))
	obj.dynamic_g.selectAll('*').remove()

	const arg = {
		genome: obj.genome.name,
		m: obj.m,
		fimo_thresh: obj.fimo_thresh,
		flankspan: obj.flankspan,
		minabslogp: obj.minabslogp
	}

	return client
		.dofetch('fimo', arg)
		.then(data => {
			if (data.error) throw 'Error: cannot do motif finding: ' + data.error

			if (obj.callback_once) {
				obj.callback_once()
				delete obj.callback_once
			}

			if (!data.items || data.items.length == 0) throw 'Found no motif change due to this mutation'

			obj.wait.style('display', 'none')

			// get gene name
			for (const m of data.items) {
				if (m.attr) {
					m.gene = m.attr['Transcription factor']
				} else {
					m.gene = m.name
				}
			}

			return show_result(data, obj)
		})
		.catch(e => {
			obj.wait.style('display', 'block').text(e.message || e)
			if (e.stack) console.log(e.stack)
		})
}

async function show_result(data, obj) {
	/*
draw motif line up against ref sequence
if expression is available, draw placeholder for each factor and query
*/

	draw_motif_simplified(data, obj)

	// update factor profile when motifs are added/removed
	if (obj.factor_profiles) {
		await get_gene_position(data, obj)

		// expand svg width
		let width = Number.parseInt(obj.svg.attr('width'))

		for (const profile of obj.factor_profiles) {
			profile.headerg.attr('transform', 'translate(' + (width + profile.leftpad) + ',' + headerheight + ')')

			// for this profile, every motif gets a holder
			// even if two motifs are of same factor
			profile.motifs = []
			for (const motif of data.items) {
				const pg = motif.layer1_g.append('g').attr('transform', 'translate(' + (width + profile.leftpad) + ',0)')
				profile.motifs.push({
					motif: motif,
					g: pg,
					message: pg.append('text').text('Loading...').attr('dominant-baseline', 'central').attr('fill', '#ccc')
				})
			}

			width += profile.leftpad + profile.width

			obj.svg.attr('width', width + 5)

			await load_factorprofile(obj, profile)

			// extend row bg/cover box width
			for (const m of data.items) {
				m.bgbox.attr('width', width)
				m.coverbox.attr('width', width)
			}
		}
	}
}

function draw_motif_simplified(data, obj) {
	/*
	 */

	const ntwidth = 14 // basepair width
	const motifgraphwidth = ntwidth * data.refseq.length
	const ntfontsize = 16
	const rulerheight = 30

	/*
	// plot ruler
	{
		const g = obj.svg.append('g')
			.attr('transform','translate('+(ntwidth/2)+','+rulerheight+')')
		const fontsize = 14 // axis lab
		let w
		g.append('text')
			.text(data.refstart)
			.attr('font-size', fontsize)
			.each(function(){
				w = this.getBBox().width
			})
			.remove()
		client.axisstyle({
			axis: g.call(
				axisTop().scale(
					scaleLinear().domain([data.refstart, data.refstop]).range([ 0, motifgraphwidth - ntwidth ])
				)
				.ticks( Math.floor( motifgraphwidth / (w+30) ) )
			),
			showline: 1,
			fontsize: fontsize
		})
	}

	// plot nt
	{
		const g = obj.svg.append('g')
			.attr('transform','translate(0,'+(rulerheight+ntfontsize)+')')
		for(let i=0; i<data.refseq.length; i++) {
			g.append('text')
				.text(data.refseq[i])
				.attr('font-size',ntfontsize)
				.attr('x', ntwidth*(i+.5) )
				.attr('text-anchor','middle')
		}
	}
	*/

	// instead of ruler, plot mutation
	{
		const x = (obj.m.pos - data.refstart + 0.5) * ntwidth
		const g = obj.dynamic_g.append('g').attr('transform', 'translate(' + x + ',' + headerheight + ')')
		g.append('rect')
			.attr('x', -ntwidth / 2)
			.attr('y', -10)
			.attr('width', ntwidth)
			.attr('height', 10)
			.attr('fill', '#666')
		g.append('text')
			.attr('y', -15)
			.attr('text-anchor', 'middle')
			.text(obj.m.chr + ':' + obj.m.pos + ' ' + obj.m.ref + '>' + obj.m.alt)
	}

	// cumulative height
	let svgheight = headerheight + headerunderpad

	const rowspace = 1

	const g = obj.dynamic_g.append('g').attr('transform', 'translate(0,' + svgheight + ')')

	// each motif
	for (const [i, motif] of data.items.entries()) {
		// at vertical center
		motif.g = g.append('g').attr('transform', 'translate(0,' + (obj.motifrowheight * (i + 0.5) + rowspace * i) + ')')

		// layer 1: row background, motif bar, factor profiles
		motif.layer1_g = motif.g.append('g')

		// layer 2: mouse over
		motif.layer2_g = motif.g.append('g')

		// bg box to flicker by mouse over and stretch across all profile panels
		motif.bgbox = motif.layer1_g
			.append('rect')
			.attr('y', -obj.motifrowheight / 2)
			.attr('width', motifgraphwidth)
			.attr('height', obj.motifrowheight)
			.attr('fill', 'white')

		const x = (motif.start - data.refstart) * ntwidth
		const w = (Math.min(motif.stop, data.refstop) - motif.start) * ntwidth

		// motif color by change

		// motif box
		motif.layer1_g
			.append('rect')
			.attr('x', x)
			.attr('y', -obj.motifrowheight / 2)
			.attr('width', w)
			.attr('height', obj.motifrowheight)
			.attr('fill', motif.gain ? obj.gaincolor : obj.losscolor)
			.attr('fill-opacity', motif.logpvaluediff / (motif.gain ? data.valuemax : data.valuemin))

		// tf name
		let str
		if (motif.strand == '+') {
			str = '>  ' + motif.name + '  >'
		} else {
			str = '<  ' + motif.name + '  <'
		}
		motif.layer1_g
			.append('text')
			.text(str)
			.attr('x', x + w / 2)
			.attr('dominant-baseline', 'central')
			.attr('text-anchor', 'middle')
			.attr('stroke', 'white')
			.attr('stroke-width', 3)
			.attr('font-size', obj.motifrowheight - 3)
			.attr('font-family', client.font)
			.style('white-space', 'pre')
		motif.layer1_g
			.append('text')
			.text(str)
			.attr('x', x + w / 2)
			.attr('dominant-baseline', 'central')
			.attr('text-anchor', 'middle')
			.attr('font-size', obj.motifrowheight - 3)
			.attr('font-family', client.font)
			.style('white-space', 'pre')

		motif.coverbox = motif.layer2_g
			.append('rect')
			.attr('y', -obj.motifrowheight / 2)
			.attr('width', motifgraphwidth)
			.attr('height', obj.motifrowheight)
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
			.on('mouseover', event => {
				motif.bgbox.attr('fill', '#f9fabd')
				motif_tooltip(motif, obj, event)
			})
			.on('mouseout', () => {
				motif.bgbox.attr('fill', 'white')
				obj.tip.hide()
			})
	}

	svgheight += (rowspace + obj.motifrowheight) * data.items.length + 20

	make_legend(data, obj)

	obj.svg.attr('width', motifgraphwidth).attr('height', svgheight)
}

function motif_tooltip(motif, obj, event) {
	obj.tip.clear()
	if (motif.attr) {
		obj.tip.d.append('div').text('MOTIF').style('font-weight', 'bold')
		const lst1 = [
			{ k: 'P-values', v: htmlpvalue(motif, obj) },
			{ k: 'Strand', v: motif.strand }
		]
		client.make_table_2col(obj.tip.d, lst1)

		obj.tip.d.append('div').text('FACTOR').style('font-weight', 'bold')
		const lst2 = []
		for (const k in motif.attr) {
			lst2.push({ k: k, v: motif.attr[k] })
		}
		client.make_table_2col(obj.tip.d, lst2)
	} else {
		const lst = [
			{ k: 'TF', v: motif.name },
			{ k: 'P-values', v: htmlpvalue(motif, obj) },
			{ k: 'Strand', v: motif.strand }
		]
		client.make_table_2col(obj.tip.d, lst)
	}
	obj.tip.show(event.clientX, event.clientY)
}

function htmlpvalue(m, obj) {
	return (
		(m.pvalue_ref == undefined
			? '<span style="opacity:.5;padding:2px"><span style="font-size:.7em">REF</span> not found</span>'
			: '<span style="background-color:' +
			  obj.losscolor +
			  ';padding:2px;color:white;"><span style="font-size:.7em">REF</span> ' +
			  m.pvalue_ref +
			  '</span>') +
		'<br>' +
		(m.pvalue_alt == undefined
			? '<span style="opacity:.5;padding:2px"><span style="font-size:.7em">ALT</span> not found</span>'
			: '<span style="background-color:' +
			  obj.gaincolor +
			  ';padding:2px;color:white;"><span style="font-size:.7em">ALT</span> ' +
			  m.pvalue_alt +
			  '</span>')
	)
}

function make_legend(data, obj) {
	obj.legend.logpvaluediv.selectAll('*').remove()

	const leftpad = 50,
		axistickh = 4,
		fontsize = 12,
		barw = 55,
		barh = 20

	obj.legend.logpvaluediv.append('span').text('Log10 p-value difference')

	const svg = obj.legend.logpvaluediv
		.append('svg')
		.attr('width', (leftpad + barw) * 2)
		.attr('height', fontsize + axistickh + barh)

	// axis
	const axisg = svg.append('g').attr('transform', 'translate(' + leftpad + ',' + (fontsize + axistickh) + ')')
	client.axisstyle({
		axis: axisg.call(
			axisTop()
				.scale(
					scaleLinear()
						.domain([data.valuemin, 0, data.valuemax])
						.range([0, barw, barw * 2])
				)
				.tickValues([data.valuemin, 0, data.valuemax])
				.tickSize(axistickh)
		)
	})

	const gain_id = Math.random().toString()
	const loss_id = Math.random().toString()

	const defs = svg.append('defs')
	{
		// loss
		const grad = defs.append('linearGradient').attr('id', loss_id)
		grad.append('stop').attr('offset', '0%').attr('stop-color', obj.losscolor)
		grad.append('stop').attr('offset', '100%').attr('stop-color', 'white')
	}
	{
		// gain
		const grad = defs.append('linearGradient').attr('id', gain_id)
		grad.append('stop').attr('offset', '0%').attr('stop-color', 'white')
		grad.append('stop').attr('offset', '100%').attr('stop-color', obj.gaincolor)
	}

	svg
		.append('rect')
		.attr('x', leftpad)
		.attr('y', fontsize + axistickh)
		.attr('width', barw)
		.attr('height', barh)
		.attr('fill', 'url(#' + loss_id + ')')

	svg
		.append('rect')
		.attr('x', leftpad + barw)
		.attr('y', fontsize + axistickh)
		.attr('width', barw)
		.attr('height', barh)
		.attr('fill', 'url(#' + gain_id + ')')

	svg
		.append('text')
		.attr('x', leftpad - 5)
		.attr('y', fontsize + axistickh + barh / 2)
		.attr('font-family', client.font)
		.attr('font-size', fontsize)
		.attr('text-anchor', 'end')
		.attr('dominant-baseline', 'central')
		.attr('fill', 'black')
		.text('Loss')
	svg
		.append('text')
		.attr('x', leftpad + barw * 2 + 5)
		.attr('y', fontsize + axistickh + barh / 2)
		.attr('font-family', client.font)
		.attr('font-size', fontsize)
		.attr('dominant-baseline', 'central')
		.attr('fill', 'black')
		.text('Gain')
}

async function get_gene_position(data, obj) {
	obj.gene2position = {}
	const factornames = new Set()
	for (const m of data.items) {
		factornames.add(m.gene)
	}
	for (const genename of factornames) {
		const pos = await get_one_gene_position(genename, obj)
		if (pos) {
			obj.gene2position[genename] = pos
		}
	}
}

function get_one_gene_position(genename, obj) {
	return client.dofetch('genelookup', { genome: obj.genome.name, input: genename, deep: 1 }).then(data => {
		if (!data.gmlst) return null
		const loci = client.gmlst2loci(data.gmlst)
		return loci[0]
		// ignore multiple loci
	})
}

function load_factorprofile(obj, profile) {
	if (profile.isgenevalue) {
		return load_factorprofile_genevalue(obj, profile)
	}
	if (profile.isgenevalueonesample) {
		return load_factorprofile_genevalueonesample(obj, profile)
	}
	throw 'unknown profile type'
}

async function load_factorprofile_genevalueonesample(obj, profile) {
	// get value for each gene for a sample

	const arg = {
		genome: obj.genome.name,
		genes: [],
		sample: profile.samplename
	}
	if (profile.mdslabel) {
		arg.dslabel = profile.mdslabel
		arg.querykey = profile.querykey
		if (profile.samplegroup_attrlst) {
			arg.getgroup = profile.samplegroup_attrlst
		}
	} else {
		arg.iscustom = 1
		arg.file = profile.file
		arg.url = profile.url
		arg.indexURL = profile.indexURL
	}
	for (const g in obj.gene2position) {
		const r = obj.gene2position[g]
		arg.genes.push({
			gene: g,
			chr: r.chr,
			start: r.start,
			stop: r.stop
		})
	}
	return client
		.dofetch('mdsgenevalueonesample', arg)
		.then(data => {
			if (data.error) throw data.error
			// defaults message of all genes to no data
			// for any gene with data, will remove message
			for (const m of profile.motifs) {
				m.message.text('No data')
			}
			if (data.nodata) return
			if (!data.result) throw 'error'
			// bar plot
			let min = 0,
				max = 0
			for (const g in data.result) {
				min = Math.min(min, data.result[g])
				max = Math.max(max, data.result[g])
			}
			const scale = scaleLinear().domain([min, max]).range([0, profile.width])

			client.axisstyle({
				axis: profile.axisg.call(axisTop().scale(scale).ticks(4)),
				showline: 1
			})

			for (const m of profile.motifs) {
				const v = data.result[m.motif.gene]
				if (Number.isFinite(v)) {
					// this gene has valid value
					m.message.text('')
					m.g
						.append('rect')
						.attr('y', -obj.motifrowheight / 2)
						.attr('width', Math.max(1, scale(v)))
						.attr('height', obj.motifrowheight)
						.attr('shape-rendering', 'crispEdges')
						.attr('fill', profile.barcolor)
				}
			}

			profile.textlabel
				.attr('x', profile.width / 2)
				.attr('text-anchor', 'middle')
				.attr('y', -30)
		})
		.catch(e => {
			if (e.stack) console.log(e.stack)
			client.appear(obj.wait.text(e.message || e))
		})
}

async function load_factorprofile_genevalue(obj, profile) {
	// get data for each uniq factor

	profile.gene2result = new Map()
	// k: gene name
	// v: boxplot data

	for (const gene in obj.gene2position) {
		const data = await factorprofile_genevalue_onegene_loadboxplot(obj, profile, gene)

		if (data) {
			// has valid data for this factor
			factorprofile_genevalue_onegene_makeboxplot(obj, profile, gene, data)

			// collect data so far
			profile.gene2result.set(gene, data)

			// update scale based on collected data
			factorprofile_genevalue_updatescale(obj, profile)
		}
	}

	factorprofile_genevalue_finish(obj, profile)
}

function factorprofile_genevalue_onegene_makeboxplot(obj, profile, gene, data) {
	// plot boxplot for all motifs of this gene

	if (data.nodata) return

	for (const m of profile.motifs) {
		if (m.motif.gene != gene) continue
		m.boxplot = {
			out: []
		}

		if (data.w1 != undefined) {
			// has valid values for boxplot, could be missing
			m.boxplot.hline = m.g.append('line').attr('stroke', profile.color).attr('shape-rendering', 'crispEdges')
			m.boxplot.linew1 = m.g.append('line').attr('stroke', profile.color).attr('shape-rendering', 'crispEdges')
			m.boxplot.linew2 = m.g.append('line').attr('stroke', profile.color).attr('shape-rendering', 'crispEdges')
			m.boxplot.box = m.g
				.append('rect')
				.attr('fill', 'white')
				.attr('stroke', profile.color)
				.attr('shape-rendering', 'crispEdges')
			m.boxplot.linep50 = m.g.append('line').attr('stroke', profile.color).attr('shape-rendering', 'crispEdges')
		}
		// outliers
		if (data.out) {
			for (const d of data.out) {
				const circle = m.g.append('circle').attr('stroke', profile.color).attr('fill', 'white').attr('fill-opacity', 0)
				m.boxplot.out.push({
					value: d.value,
					circle: circle
				})
			}
		}
	}
}

function factorprofile_genevalue_updatescale(obj, profile) {
	// calls every time boxplot data is loaded for a gene
	let min = 0,
		max = 0
	for (const g of profile.gene2result.values()) {
		min = Math.min(min, g.min)
		max = Math.max(max, g.max)
	}

	const scale = scaleLinear().domain([min, max]).range([0, profile.width])

	const h = obj.motifrowheight - 2

	for (const [g, r] of profile.gene2result) {
		for (const m of profile.motifs) {
			if (m.motif.gene != g) continue

			const bp = m.boxplot
			if (!bp) continue

			if (bp.hline) {
				const w1 = scale(r.w1)
				const w2 = scale(r.w2)
				const p25 = scale(r.p25)
				const p50 = scale(r.p50)
				const p75 = scale(r.p75)
				bp.hline.transition().attr('x1', w1).attr('x2', w2)
				bp.linew1
					.transition()
					.attr('x1', w1)
					.attr('x2', w1)
					.attr('y1', -h / 2)
					.attr('y2', h / 2)
				bp.linew2
					.transition()
					.attr('x1', w2)
					.attr('x2', w2)
					.attr('y1', -h / 2)
					.attr('y2', h / 2)
				bp.box
					.transition()
					.attr('x', p25)
					.attr('y', -h / 2)
					.attr('width', p75 - p25)
					.attr('height', h)
				bp.linep50
					.transition()
					.attr('x1', p50)
					.attr('x2', p50)
					.attr('y1', -h / 2)
					.attr('y2', h / 2)
			}
			for (const d of bp.out) {
				d.circle
					.transition()
					.attr('cx', scale(d.value))
					.attr('r', h / 3)
			}
		}
	}

	client.axisstyle({
		axis: profile.axisg.transition().call(axisTop().scale(scale).ticks(4)),
		showline: 1
	})
}

function factorprofile_genevalue_onegene_loadboxplot(obj, profile, gene) {
	const r = obj.gene2position[gene]
	const arg = {
		genome: obj.genome.name,
		gene: gene,
		chr: r.chr,
		start: r.start,
		stop: r.stop,
		getgroup2boxplot: 1
	}
	if (profile.mdslabel) {
		arg.dslabel = profile.mdslabel
		arg.querykey = profile.querykey
		if (profile.samplegroup_attrlst) {
			arg.getgroup = profile.samplegroup_attrlst
		}
	} else {
		arg.iscustom = 1
		arg.file = profile.file
		arg.url = profile.url
		arg.indexURL = profile.indexURL
	}
	return client
		.dofetch('mdsgeneboxplot', arg)
		.then(data => {
			if (data.error) throw 'Error: ' + data.error
			if (data.nodata) throw 'No data'
			// hide message for motifs of this gene
			for (const m of profile.motifs) {
				if (m.motif.gene == gene) {
					m.message.text('')
				}
			}
			return data
		})
		.catch(e => {
			// update message for motifs of this gene
			if (e.stack) console.log(e.stack)
			for (const m of profile.motifs) {
				if (m.motif.gene == gene) {
					m.message.text(e.message || e)
				}
			}
		})
}

function factorprofile_genevalue_finish(obj, profile) {
	// update sample size
	let n = 0
	for (const g of profile.gene2result.values()) {
		n = Math.max(n, g.n)
	}
	profile.textlabel
		.text(profile.name + ' (n=' + n + ')') // update name showing n
		.attr('x', profile.width / 2)
		.attr('text-anchor', 'middle')
		.attr('y', -30)
}
