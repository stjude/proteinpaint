import {init,add_searchbox_4term} from './mds.termdb'
import * as client from './client'
import {event as d3event} from 'd3-selection'


export function may_makebutton_crosstabulate( arg ) {
/*

not in use

add button for cross-tabulating

arg{}
.term1{}
	.id
.button_row <div>
.obj
.callback()

to generate a tree for selecting term2
then do cross tabulation
then pass term2 and crosstab result to callback
*/
	if( !arg.term1 ) throw 'term1{} missing'
	if( !arg.obj ) throw 'obj{} missing'
	if( !arg.callback ) throw 'callback() missing'

	// currently defaults this to barchart-equipped terms
	if( !arg.term1.graph || !arg.term1.graph.barchart ) return

	// click button to show term tree
	// generate a temp obj for running init()

	const button = arg.button_row
		.append('div')
		.style('display','inline-block')
		.style('margin-left','20px')
		.style('padding','3px 5px')
		.style('font-size','.8em')
		.style('display', arg.obj && arg.obj.modifier_ssid_barchart ? 'none' : 'inline-block')
		.attr('class','sja_menuoption')
		.text('CROSSTAB')


	button.on('click',()=>{

		arg.obj.tip.clear()
			.showunder( button.node() )

		const errdiv = arg.obj.tip.d.append('div')
			.style('margin-bottom','5px')
			.style('color','#C67C73')

		// this function will be used for both tree and search
		const term2_selected_callback = arg.callback 

		add_searchbox_4term( arg.obj, arg.obj.tip.d, term2_selected_callback )

		const treediv = arg.obj.tip.d.append('div')
		const disable_terms = arg.term2 ? new Set([ arg.term1.id, arg.term2.id ]) : new Set([ arg.term1.id ])

		// a new object as init() argument for launching the tree
		// with modifiers
		const obj = {
			genome: arg.obj.genome,
			mds: arg.obj.mds,
			div: treediv,
			default_rootterm: {},
			term2_displaymode: 'table',
			modifier_click_term: {
				disable_terms,
				callback: term2_selected_callback 
			},
			termfilter: {no_display:true}
		}

		init( obj )
	})

	return button
}

export function may_trigger_crosstabulate( arg, btn ) {
	arg.obj.tip.clear()
			.showunder( btn )

	const errdiv = arg.obj.tip.d.append('div')
		.style('margin-bottom','5px')
		.style('color','#C67C73')

	// this function will be used for both tree and search
	const term2_selected_callback = arg.callback

	add_searchbox_4term( arg.obj, arg.obj.tip.d, term2_selected_callback )

	const treediv = arg.obj.tip.d.append('div')
	const disable_terms = arg.term2 ? new Set([ arg.term1.id, arg.term2.id ]) : new Set([ arg.term1.id ])
	
	// a new object as init() argument for launching the tree
	// with modifiers
	const obj = {
		genome: arg.obj.genome,
		mds: arg.obj.mds,
		div: treediv,
		default_rootterm: {},
		modifier_click_term: {
			disable_terms,
			callback: term2_selected_callback
		},
		termfilter: {no_display:true}
	}

	init(obj)
}
