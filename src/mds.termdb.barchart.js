import * as client from './client'
import * as common from './common'
import {axisLeft} from 'd3-axis'
import {format as d3format} from 'd3-format'
import {scaleLinear,scaleOrdinal,schemeCategory10,scaleLog,schemeCategory20} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import { stringify } from 'querystring'; // what's this?
import {init} from './mds.termdb'



/*
make bachart for data from a term

*/



export function barchart_make ( arg ) {
/*

.items[]
	server returned data
	[0] item name
	[1] count
.holder
.obj
.term{}
	.id
	.graph.barchart{}
		provides predefined chart customization, to be implemented:
		- fixed y scale
		- log scale

*/


	//constant variables
	let barheight=300,
	barwidth=20,
	space=5,
	axisheight=barheight+5,
	barspace=2,
	maxlabelwidth=0,
	maxvalue=0

	const items_len = arg.items.length

	// initiate holders

	const button_row = arg.holder.append('div')
		.style('margin','10px 0px')

	const legend_div = arg.holder.append('div')
		.style('margin','10px 0px')

	const svg = arg.holder.append('svg')


	// initiate label to bar mapping
	const label2bar = new Map()
	// k: label of this term
	// v: <g>




	// button - scale toggle
	
	button_row.append('span')
		.text('Y Axis - Log Scale')
	
	const scale_btn = button_row.append('input')
		.attr('type', 'checkbox')

	// button - cross tabulate
	addbutton_crosstabulate({
		term: arg.term,
		button_row: button_row,
		obj: obj,
		plot:{
			svg: svg,
			label2bar: label2bar,
			legend_div: legend_div,
		}
	})


	const axisg=svg.append('g')

	// set y axis min/max scale
	const [yscale_min, yscale_max] = set_yscale( arg )

	// also derive label font size
	const label_fontsize = 15

	const max_label_height = get_max_labelheight( arg, label_fontsize, svg  )

	// set y axis height

	const yaxis_width = 70

	/* plot vertical bars
	each bar has equal width
	set bar width based on number of data points to make it comfortable
	plot item labels under bar, with 45. rotation
	*/
	
	// define svg height and width
	const svg_width = items_len*(barwidth+barspace)+(space*2)+yaxis_width,
	svg_height = axisheight+max_label_height+space
	svg.attr('width', svg_width)
	.attr('height', svg_height)


	// Y axis
	axisg.attr('transform','translate('+yaxis_width+','+space+')')
		.call(axisLeft().scale(
			scaleLinear().domain([yscale_max,0]).range([0,barheight])
			)
			.tickFormat(d3format('d'))
		)
	client.axisstyle({
		axis:axisg,
		showline:true,
		fontsize:barwidth*.8,
		color:'black'
	})

	// console.log(arg)
	// Y axis scale toggle 

	scale_btn.on('click',()=>{ 
			if (d3select('.scale_switch').property('checked') == false){
				axisg.attr('transform','translate('+yaxis_width+','+space+')')
				.call(axisLeft().scale(
					scaleLinear().domain([yscale_max,0]).range([0,barheight])
					)
					.tickFormat(d3format('d'))
				)
			} else {
				axisg.attr('transform','translate('+yaxis_width+','+space+')')
				.call(axisLeft().scale(
					scaleLog().domain([yscale_max,1]).range([0,barheight])
					)
					.ticks(10, d3format('d'))
				)
			}
			client.axisstyle({
				axis:axisg,
				showline:true,
				fontsize:barwidth*.8,
				color:'black'
			})
		})

	// barplot design

	let x=yaxis_width+space
	const sf=barheight/yscale_max

	for(let i=0; i<items_len; i++) {
		const j=arg.items[i]

		// X axis
		svg.append('text')
		.text(j['label'])
		.attr("transform", "translate("+ (x+barwidth/2) +","+ (axisheight+4) +") rotate(-65)")
		.attr('text-anchor','end')
		.attr('font-size',label_fontsize)
		.attr('font-family',client.font)
		.attr('dominant-baseline','central')
		

		// bars for barplot
		const g = svg.append('g')
			.attr('transform','translate('+(x+barwidth/2)+','+axisheight+')')

		label2bar.set( j.label, g )

		g.append('rect')
			.attr('x', -barwidth/2)
			.attr('y', -(sf * j.value))
			.attr('width',barwidth)
			.attr('height', sf * j.value)
			.attr('fill','#901739')

		x+=barwidth+barspace
	}

}



function set_yscale ( arg ) {
/* determine y axis range
*/
	/* TODO if term predefines y scale, return it
	if( arg.term.graph.barchart.fixedyscale) {
		return arg.term.graph.barchart.fixedyscale
	}
	*/


	// get min/max from bar numeric values
	let min = arg.items[0]['value'],
		max = min
	for( let i of arg.items ) {
		min = Math.min( min, i['value'] )
		max = Math.max( max, i['value'] )
	}


	// if min >0, then set min to 0
	if( min >= 0 ) return [ 0, max ]

	// if max < 0, then set max to 0
	if( max <= 0 ) return [ min, 0 ]

	// remaining case should be min<0, max>0
	return [ min, max ]
}



function get_max_labelheight ( arg, fontsize, svg ) {

	let textwidth = 0

	for(const i of arg.items) {
		svg.append('text')
			.text( i['label'] )
			.attr('font-family', client.font)
			.attr('font-size', fontsize)
			.each( function() {
				textwidth = Math.max( textwidth, this.getBBox().width )
			})
			.remove()
	}

	return textwidth
}



function addbutton_crosstabulate ( arg ) {
/*
add button for cross-tabulating
currently defaults this to barchart-equipped terms
later may define a specific rule for enabling cross-tabulating

.term
.button_row
.obj
.plot{}

*/

	const term1 = arg.term

	if(!term1.graph || !term1.graph.barchart ) return

	const button = arg.button_row.append('div')
		.style('display','inline-block')
		.style('margin-left','20px')
		.attr('class','sja_menuoption')
		.text('CROSSTAB')

	// click button to show term tree
	// generate a temp obj for running init()

	button.on('click',()=>{

		arg.obj.tip.clear()
			.showunder( button.node() )

		const treediv = arg.obj.tip.d.append('div')
		const errdiv = arg.obj.tip.d.append('div')

		const obj2 = {
			genome: arg.obj.genome,
			mds: arg.obj.mds,
			div: treediv,
			default_rootterm: {
				// add click handler as the modifier to tree display
				modifier_click_term: (term2) => {
					// term2 is selected
					if(term2.id == term1.id) {
						window.alert('Cannot select the same term')
						return
					}
					arg.obj.tip.hide()

					crosstabulate_2terms( {
						term1: {
							id: term1.id
						},
						term2: {
							id: term2.id
						},
						obj: arg.obj
					})
					.then( data=>{
						const arg2 = {
							items: data.lst,
							obj: arg.obj,
						}
						for(const k in arg.plot) arg2[k] = arg.plot[k]
						plot_stackbar( arg2 )
					})
					.catch(e=>{
						window.alert( e.message || e)
						if(e.stack) console.log(e.stack)
					})
				}
			},
		}

		init( obj2 )
	})
}



function plot_stackbar ( arg ) {
/*
.items[ {} ]
	.label
	.lst[]
		.label
		.value
.obj
.label2bar
.legend_div
*/
	console.log( arg.items )

	// to get 
	const term2values = new Set()
	for(const i of arg.items) {
		for(const j of i.lst) {
			term2values.add( j.label )
		}
	}

	let term2valuecolor
	if( term2values.size > 10 ) {
		term2valuecolor = scaleOrdinal( schemeCategory20 )
	} else {
		term2valuecolor = scaleOrdinal( schemeCategory10 )
	}

	//

}




function crosstabulate_2terms ( arg ) {
/*
.term1{}
.term2{}
.obj{}

for numeric term:
	if is based on custom binning, must return the binning scheme

return promise
*/
	const param = {
		crosstab2term: 1,
		term1:{
			id: arg.term1.id
		},
		term2:{
			id: arg.term2.id
		},
		genome: arg.obj.genome.name,
		dslabel: arg.obj.mds.label
	}
	return client.dofetch('termdb', param)
	.then(data=>{
		if(data.error) throw 'error cross-tabulating: '+data.error
		console.log(data.lst)
		return data.lst
	})
}

