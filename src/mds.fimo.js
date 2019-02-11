import * as client from './client'
import * as common from './common'
import {axisTop} from 'd3-axis'
import {scaleLinear,scaleOrdinal,schemeCategory10} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'



/*
obj:
.genome {}
.m{}
	.pos
.expression{}
.div

data{} returned by /fimo



********************** EXPORTED
init()
********************** INTERNAL

*/






export function init ( obj ) {
/*
*/

	init_ui( obj )

	do_query( obj )
}




function init_ui ( obj ) {

	// set attr
	obj.motifrowheight = 16
	obj.gaincolor = 'red'
	obj.losscolor = 'blue'

	obj.div.append('div')
		.text(obj.m.chr+':'+obj.m.pos+' '+obj.m.ref+'>'+obj.m.alt)

	// controls

	// dom
	obj.wait = obj.div.append('div')
	obj.svg = obj.div.append('svg')
	obj.legend = {}
	obj.legend.logpvaluediv = obj.div.append('div')
}




function do_query ( obj ) {

	client.appear( obj.wait.text('Loading...') )

	const arg = {
		genome: obj.genome.name,
		m: obj.m,
		fimo_thresh: obj.fimo_thresh
	}
	client.dofetch('fimo', arg)
	.then(data=>{
		if(data.error) {
			obj.wait.text('Cannot do motif finding: '+data.error)
			return
		}
		client.disappear( obj.wait )

		obj.svg.selectAll('*')
			.remove()
		show_result( data, obj )
	})
}


function show_result ( data, obj ) {
/*
draw motif line up against ref sequence
if expression is available, draw placeholder for each factor and query
*/
	
	draw_motif_simplified( data, obj )

}


function draw_motif_simplified ( data, obj ) {
/*
data{}
.refseq
.refstart
.refstop
.items[{}]
	.loss/gain
	.logpvaluediff
	.name
	.start
	.stop
	.strand
*/

	const ntwidth = 14 // basepair width
	const motifgraphwidth = ntwidth * data.refseq.length
	const ntfontsize = 16
	const rulerheight = 30

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

	// cumulative height
	let svgheight = rulerheight + ntfontsize + 5

	const rowspace = 1

	const g = obj.svg.append('g')
		.attr('transform','translate(0,'+svgheight+')')

	// vertical highlight m
	g.append('rect')
		.attr('x', (obj.m.pos-data.refstart)*ntwidth)
		.attr('width', ntwidth)
		.attr('height', data.items.length * (obj.motifrowheight+rowspace) )
		.attr('fill','#8DFC85')

	// each motif
	for(const [i, motif] of data.items.entries()) {

		motif.g = g.append('g')
			.attr('transform','translate(0,'+( obj.motifrowheight * (i+.5) + rowspace*i )+')')

		const x = (motif.start-data.refstart)*ntwidth
		const w = (motif.stop-motif.start) * ntwidth

		// motif color by change

		// box
		motif.g.append('rect')
			.attr('x',x)
			.attr('y', -obj.motifrowheight/2 )
			.attr('width', w)
			.attr('height', obj.motifrowheight)
			.attr('fill',  motif.gain ? obj.gaincolor : obj.losscolor )
			.attr('fill-opacity', motif.logpvaluediff / (motif.gain ? data.valuemax : data.valuemin ) )

		// tf name
		motif.g.append('text')
			.text( motif.name )
			.attr('x', x+w/2)
			.attr('dominant-baseline','central')
			.attr('text-anchor','middle')
			.attr('stroke','white')
			.attr('stroke-width',3)
			.attr('font-size', obj.motifrowheight-3)
			.attr('font-family',client.font)
		motif.g.append('text')
			.text( motif.name )
			.attr('x', x+w/2)
			.attr('dominant-baseline','central')
			.attr('text-anchor','middle')
			.attr('font-size', obj.motifrowheight-3)
			.attr('font-family',client.font)
	}


	svgheight += (rowspace+obj.motifrowheight)*data.items.length + 20

	make_legend( data, obj )

	obj.svg.attr('width', motifgraphwidth )
		.attr('height', svgheight )
}




function make_legend ( data, obj ) {

	obj.legend.logpvaluediv.selectAll('*').remove()

	const leftpad = 50,
		axistickh = 4,
		fontsize = 12,
		barw = 55,
		barh=20

	obj.legend.logpvaluediv.append('span')
		.text('Log10 p-value difference')

	const svg = obj.legend.logpvaluediv
		.append('svg')
		.attr('width', (leftpad+barw)*2)
		.attr('height',fontsize+axistickh+barh)

	// axis
	const axisg = svg.append('g')
		.attr('transform','translate('+leftpad+','+(fontsize+axistickh)+')')
	client.axisstyle({
		axis: axisg.call(
			axisTop().scale(
				scaleLinear().domain([data.valuemin, 0, data.valuemax])
				.range([0, barw, barw*2] )
			)
			.tickValues([data.valuemin, 0, data.valuemax])
			.tickSize( axistickh )
		)
	})

	const gain_id = Math.random().toString()
	const loss_id = Math.random().toString()

	const defs = svg.append('defs')
	{
		// loss
		const grad = defs.append('linearGradient')
			.attr('id', loss_id)
		grad.append('stop')
			.attr('offset','0%')
			.attr('stop-color', obj.losscolor)
		grad.append('stop')
			.attr('offset','100%')
			.attr('stop-color', 'white')
	}
	{
		// gain
		const grad = defs.append('linearGradient')
			.attr('id', gain_id)
		grad.append('stop')
			.attr('offset','0%')
			.attr('stop-color', 'white')
		grad.append('stop')
			.attr('offset','100%')
			.attr('stop-color', obj.gaincolor)
	}

	svg.append('rect')
		.attr('x',leftpad)
		.attr('y',fontsize+axistickh)
		.attr('width', barw)
		.attr('height',barh)
		.attr('fill', 'url(#'+loss_id+')')

	svg.append('rect')
		.attr('x', leftpad+barw)
		.attr('y',fontsize+axistickh)
		.attr('width', barw)
		.attr('height',barh)
		.attr('fill', 'url(#'+gain_id+')')

	svg.append('text')
		.attr('x',leftpad-5)
		.attr('y',fontsize+axistickh+barh/2)
		.attr('font-family',client.font)
		.attr('font-size',fontsize)
		.attr('text-anchor','end')
		.attr('dominant-baseline','central')
		.attr('fill','black')
		.text('Loss')
	svg.append('text')
		.attr('x', leftpad+barw*2+5)
		.attr('y',fontsize+axistickh+barh/2)
		.attr('font-family',client.font)
		.attr('font-size',fontsize)
		.attr('dominant-baseline','central')
		.attr('fill','black')
		.text('Gain')
}
