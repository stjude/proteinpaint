import {init,add_searchbox_4term} from './mds.termdb'
import * as client from './client'
import {event as d3event} from 'd3-selection'


export function may_makebutton_crosstabulate( arg ) {
/*
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
		const term2_selected_callback = make_term2_callback( arg, button, errdiv )

		add_searchbox_4term( arg.obj, arg.obj.tip.d, term2_selected_callback )

		const treediv = arg.obj.tip.d.append('div')

		// a new object as init() argument for launching the tree
		// with modifiers
		const obj = {
			genome: arg.obj.genome,
			mds: arg.obj.mds,
			div: treediv,
			default_rootterm: {},
			term2_displaymode: 'table',
			modifier_click_term: {
				// TODO when switching term2 while there is already a term2, add term2 id here also
				disable_terms: new Set([ arg.term1.id ]),
				callback: term2_selected_callback
			},
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
	const term2_selected_callback = make_term2_callback( arg, btn, errdiv )

	add_searchbox_4term( arg.obj, arg.obj.tip.d, term2_selected_callback )

	const treediv = arg.obj.tip.d.append('div')
	// a new object as init() argument for launching the tree
	// with modifiers
	const obj = {
		genome: arg.obj.genome,
		mds: arg.obj.mds,
		div: treediv,
		default_rootterm: {},
		modifier_click_term: {
			// TODO when switching term2 while there is already a term2, add term2 id here also
			disable_terms: new Set([ arg.term1.id ]),
			callback: term2_selected_callback
		},
	}

	init(obj)
}



function make_term2_callback ( arg, button, errdiv ) {
/*
a callback to handle the click on term2 in tree
as the modifier
also a closure with the arguments and buttons
*/
	return (term2) => {

		// term2 is selected
		if(term2.id == arg.term1.id) {
			errdiv.text('Cannot select the same term')
			return
		}

		cross_tabulate( {
			term1: {
				id: arg.term1.id
			},
			term2: {
				id: term2.id
			},
			obj: arg.obj
		})
		.then( data=>{

			if( data.error ) throw data.error
			if( !data.lst ) throw 'error doing cross-tabulation'

			// no error, can hide tip
			arg.obj.tip.hide()

			// update the plot data using the server-returned new data
			arg.callback( {
				items: data.lst,
				term2: term2,
				term2_order: data.term2_order,
			})
		})
		.catch(e=>{
			errdiv.text( e.message || e)
			if(e.stack) console.log(e.stack)
		})
	}
}





function cross_tabulate( arg ) {
/*
do cross-tabulation for two terms

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
		return data
	})
}
