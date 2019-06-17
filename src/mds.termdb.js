import * as client from './client'
import * as common from './common'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {init as plot_init} from './mds.termdb.plot'
import {validate_termvaluesetting} from './mds.termdb.termvaluesetting'
import * as termvaluesettingui from './mds.termdb.termvaluesetting.ui'


/*

init() accepts following triggers:
- show term tree starting with default terms, at terms show graph buttons
- show term tree, for selecting a term (what are selectable?), no graph buttons

init accepts obj{}
.genome{}
.mds{}
.div


triggers
obj.default_rootterm{}


modifiers, for modifying the behavior/display of the term tree
attach to obj{}
** modifier_click_term
	when this is provided, will allow selecting terms, do not show graph buttons
** modifier_ssid_barchart
** modifier_barchart_selectbar
** modifier_ssid_onterm






********************** EXPORTED
init()
showtree4selectterm
********************** INTERNAL
show_default_rootterm
	display_searchbox
	may_display_termfilter
	print_one_term
		may_make_term_foldbutton
		may_apply_modifier_click_term
		may_apply_modifier_barchart_selectbar
		may_make_term_graphbuttons
			term_addbutton_barchart
				make_barplot
*/





const tree_indent = '30px',
	label_padding = '5px 3px 5px 1px',
	graph_leftpad = '10px'


export async function init ( obj ) {
/*
obj{}:
.genome {}
.mds{}
.div
.default_rootterm{}
... modifiers
*/
	if( obj.debugmode ) window.obj = obj

	obj.dom = {
		div: obj.div
	}
	delete obj.div
	obj.dom.errdiv = obj.dom.div.append('div')
	obj.dom.searchdiv = obj.dom.div.append('div').style('display','none')
	obj.dom.termfilterdiv = obj.dom.div.append('div').style('display','none')
	obj.dom.treediv = obj.dom.div.append('div')
		.style('display','inline-block')
		.append('div')
	obj.tip = new client.Menu({padding:'5px'})
	obj.dom.div.on('click.tdb', ()=>{
		// the plot.button_row in mds.termdb.plot and
		// individual buttons in the term tree captures
		// the click event, so stopPropagation in here 
		// does not affect those event handlers/callbacks 
		d3event.stopPropagation()
		if (d3event.target.innerHTML == "CROSSTAB" || d3event.target.className == "crosstab-btn") return
		// since the click event is not propagated to body,
		// handle the tip hiding here since the body.click
		// handler in client.js Menu will not be triggered
		obj.tip.hide()
	})
	// simplified query
	obj.do_query = (args) => {
		const lst = [ 'genome='+obj.genome.name+'&dslabel='+obj.mds.label ]
		// maybe no need to provide term filter at this query
		return client.dofetch2( '/termdb?'+lst.join('&')+'&'+args.join('&') )
	}

	try {
		if(!obj.genome) throw '.genome{} missing'
		if(!obj.mds) throw '.mds{} missing'

		// handle triggers

		if( obj.default_rootterm ) {
			await show_default_rootterm( obj )
			return
		}

		// to allow other triggers

	} catch(e) {
		obj.dom.errdiv.text('Error: '+ (e.message||e) )
		if(e.stack) console.log(e.stack)
		return
	}
}



async function show_default_rootterm ( obj ) {
/* for showing default terms, as defined by ds config

also for showing term tree, allowing to select certain terms

*/

	display_searchbox( obj )

	may_display_termfilter( obj )

	may_display_selected_groups(obj)
	may_display_selected_groups(obj)

	const data = await obj.do_query(["default_rootterm=1"])
	if(data.error) throw 'error getting default root terms: '+data.error
	if(!data.lst) throw 'no default root term: .lst missing'

	// show root nodes

	for(const i of data.lst) {
		const arg = {
			row: obj.dom.treediv.append('div'),
			term: i,
		}
		print_one_term( arg, obj )
	}
}




function may_display_termfilter ( obj ) {
/* when the ui is not displayed, will not allow altering filters and callback-updating
*/

	if(obj.termfilter && obj.termfilter.terms) {
		if(!Array.isArray(obj.termfilter.terms)) throw 'filter_terms[] not an array'
		validate_termvaluesetting( obj.termfilter.terms )
	}

	if( !obj.termfilter || !obj.termfilter.show_top_ui ) {
		// do not display ui, and do not collect callbacks
		return
	}

	obj.termfilter.callbacks = []
	if(!obj.termfilter.terms) obj.termfilter.terms = []

	// make ui
	const div = obj.dom.termfilterdiv
		.style('display','block')
		.append('div')
		.style('display','inline-block')
		.style('border','solid 1px #ddd')
		.style('padding','7px')
		.style('margin-bottom','10px')
	div.append('div')
		.style('display','inline-block')
		.style('margin','0px 5px')
		.text('FILTER')
		.style('opacity','.5')
		.style('font-size','.8em')
	termvaluesettingui.display(
		div,
		obj.termfilter,
		obj.mds,
		obj.genome,
		false,
		// callback when updating the filter
		() => {
			for(const fxn of obj.termfilter.callbacks) {
				fxn()
			}
		} 
	)
}


function may_display_selected_groups(obj){
	
	if(!obj.selected_groups) return

	if(obj.selected_groups.length > 0){

		obj.groupCallbacks = []
		
		// selected group button
		obj.selected_group_div = obj.dom.termfilterdiv.append('div')
			.attr('class','sja_filter_tag_btn')
			.style('display','inline-block')
			.style('padding','6px')
			.style('margin','0px 10px')
			.style('border-radius','6px')
			.style('background-color','#00AB66')
			.style('color','#fff')
			.text('Selected '+ obj.selected_groups.length +' Group' + (obj.selected_groups.length > 1 ?'s':''))
			.on('click',()=>{
				make_selected_group_tip()
			})
	}

	function make_selected_group_tip(){

		// const tip = obj.tip // not working, creating new tip
		const tip = new client.Menu({padding:'0'})
		tip.clear()
		tip.showunder( obj.selected_group_div.node() )

		const table = tip.d.append('table')
			.style('border-spacing','5px')
			.style('border-collapse','separate')

		// one row for each group
		for( const [i, group] of obj.selected_groups.entries() ) {
		
			const tr = table.append('tr')
			const td1 = tr.append('td')

			td1.append('div')
				.attr('class','sja_filter_tag_btn')
				.text('Group '+(i+1))
				.style('white-space','nowrap')
				.style('color','#000')
				.style('padding','6px')
				.style('margin','3px 5px')
				.style('font-size','.7em')
				.style('text-transform','uppercase')
				
			group.dom = {
				td2: tr.append('td'),
				td3: tr.append('td').style('opacity',.5).style('font-size','.8em'),
				td4: tr.append('td')
			}
			
			termvaluesettingui.display(
				group.dom.td2, 
				group, 
				obj.mds, 
				obj.genome, 
				false,
				// callback when updating the groups
				() => {
					for(const fxn of obj.groupCallbacks) {
							fxn()
					}
				}
			)
			
			// TODO : update 'n=' by group selection 
			// group.dom.td3.append('div')
			//  .text('n=?, view stats')

			// 'X' button to remove gorup
			group.dom.td4.append('div')
				.attr('class','sja_filter_tag_btn')
				.style('padding','2px 6px 2px 6px')
				.style('display','inline-block')
				.style('margin-left','7px')
				.style('border-radius','6px')
				.style('background-color','#fa5e5b')
				.html('&#215;') 
				.on('click',()=>{
					
					// remove group and update tip and button
					obj.selected_groups.splice(i,1)
					
					if(obj.selected_groups.length == 0){
						obj.selected_group_div.style('display','none')
						tip.hide()
					}
					else{
						make_selected_group_tip()
					}
				})
		}

		const tr_gp = table.append('tr')
		const td_gp = tr_gp.append('td')
			.attr('colspan',4)
			.attr('align','center')
			.style('padding','0')

		td_gp.append('div')
			.attr('class','sja_filter_tag_btn')
			.style('display','inline-block')
			.style('height','100%')
			.style('width','96%')
			.style('padding','4px 10px')
			.style('margin-top','10px')
			.style('border-radius','3px')
			.style('background-color','#eee')
			.style('color','#000')
			.text('Perform Association Test in GenomePaint')
			.style('font-size','.8em')
	}
}


function print_one_term ( arg, obj ) {
/* print a term, in the term tree
for non-leaf term, show the expand/fold button
upon clicking button, to retrieve children and make recursive call to render children

arg{}
.row <DIV>
.term{}
.flicker

and deal with modifiers
try to keep the logic clear
*/

	const term = arg.term

	/* a row for:
	[+] [term name] [graph button]
	*/
	const row = arg.row.append('div')
		.attr('class','sja_tr2')
	// another under row, for adding graphs
	const row_graph = arg.row.append('div')

	// if [+] button is created, will add another row under row for showing children
	may_make_term_foldbutton( arg, row, obj )

	// if be able to apply these modifiers, can just exist and not doing anything else
	if( may_apply_modifier_click_term( obj, term, row ) ) return
	if( may_apply_modifier_barchart_selectbar( obj, term, row, row_graph ) ) return

	// term name
	const label = row
		.append('div')
		.style('display','inline-block')
		.style('padding', label_padding)
		.text( term.name )
	if(arg.flicker) {
		label.style('background-color','yellow')
			.transition()
			.duration(2000)
			.style('background-color','transparent')
	}

	// term function buttons, including barchart, and cross-tabulate

	may_make_term_graphbuttons( term, row, row_graph, obj )
}



function may_apply_modifier_barchart_selectbar ( obj, term, row, row_graph ) {
	if(!obj.modifier_barchart_selectbar) return false
	/*
	for a term equipped with graph.barchart{}, allow to click the term and directly show the barchart
	*/
	row.append('div')
		.style('display','inline-block')
		.style('padding','5px')
		.style('margin-left','5px')
		.text(term.name)
	if(!term.graph || !term.graph.barchart) {
		// no chart, this term is not clickable
		return true
	}
	term_addbutton_barchart ( term, row, row_graph, obj )
	return true
}



function may_apply_modifier_click_term ( obj, term, row ) {
	if( !obj.modifier_click_term ) return false
	/*
	a modifier to be applied to namebox
	for clicking box and collect this term and done
	will not show any other buttons
	*/

	const namebox = row.append('div')
		.style('display','inline-block')
		.style('padding','5px')
		.style('margin-left','5px')
		.text(term.name)

	if( obj.modifier_click_term.disable_terms && obj.modifier_click_term.disable_terms.has( term.id ) ) {

		// this term is disabled, no clicking
		namebox.style('opacity','.5')

	} else if(term.isleaf) {

		// enable clicking this term
		namebox
			.attr('class', 'sja_menuoption')
			.on('click',()=>{
				obj.modifier_click_term.callback( term )
			})
	}
	return true
}



function may_make_term_graphbuttons ( term, row, row_graph, obj ) {
/*
if term.graph{} is there, make a button to trigger it
allow to make multiple buttons
*/
	if(!term.graph) {
		// no graph
		return
	}


	if(term.graph.barchart) {
		term_addbutton_barchart( term, row, row_graph, obj )
	}


	// to add other graph types
}






function term_addbutton_barchart ( term, row, row_graph, obj ) {
/*
click button to launch barchart for a term

there may be other conditions to apply, e.g. patients carrying alt alleles of a variant
such conditions may be carried by obj

*/
	const button = row.append('div')
		.style('font-size','.8em')
		.style('margin-left','20px')
		.style('display','inline-block')
		.style('border-radius','5px')
		.attr('class','sja_menuoption')
		.text('VIEW')

	const div = row_graph.append('div')
		.style('border-left','solid 1px #aaa')
		.style('margin-left', graph_leftpad)
		.style('display','none')

	let loaded =false,
		loading=false

	button.on('click', async ()=>{
		if(div.style('display') == 'none') {
			client.appear(div, 'inline-block')
			button.style('border','none')
		} else {
			client.disappear(div)
			button.style('border','solid 1px #555')
		}
		if( loaded || loading ) return
		button.text('Loading')
		loading=true
		make_barplot( obj, term, div, ()=> {
			button.text('VIEW')
			loaded=true
			loading=false
		})
	})
}





function make_barplot ( obj, term, div, callback ) {
	// make barchart
	const plot = {
		obj,
		holder: div,
		genome: obj.genome.name,
		dslabel: obj.mds.label,
		term: term
	}

	if( obj.modifier_ssid_barchart ) {
		const g2c = {}
		for(const k in obj.modifier_ssid_barchart.groups) {
			g2c[ k ] = obj.modifier_ssid_barchart.groups[k].color
		}
		plot.mutation_lst = [
			{
				mutation_name: obj.modifier_ssid_barchart.mutation_name,
				ssid: obj.modifier_ssid_barchart.ssid,
				genotype2color: g2c
			}
		]
		plot.overlay_with_genotype_idx = 0
	}
	plot_init( plot, callback )
}









function may_make_term_foldbutton ( arg, buttonholder, obj ) {
/*
may show expand/fold button for a term
modifiers available from arg also needs to be propagated to children

arg{}
	.term
	.row
		the parent of buttonholder for creating the div for children terms
	possible modifiers

buttonholder: div in which to show the button, term label is also in it
*/

	if(arg.term.isleaf) {
		// is leaf term, no button
		return
	}

	let children_loaded = false, // whether this term has children loaded already
		isloading = false

	// row to display children terms
	const childrenrow = arg.row.append('div')
		.style('display','none')
		.style('padding-left', tree_indent)

	const button = buttonholder.append('div')
		.style('display','inline-block')
		.style('font-family','courier')
		.attr('class','sja_menuoption')
		.text('+')

	button.on('click',()=>{

		if(childrenrow.style('display') === 'none') {
			client.appear(childrenrow)
			button.text('-')
		} else {
			client.disappear(childrenrow)
			button.text('+')
		}

		if( children_loaded ) return

		// to load children terms, should run only once
		const wait = childrenrow.append('div')
			.text('Loading...')
			.style('opacity',.5)
			.style('margin','3px 0px')

		const param = [ 'get_children=1&tid='+arg.term.id ] // not adding ssid here
		obj.do_query( param )
		.then(data=>{
			if(data.error) throw data.error
			if(!data.lst || data.lst.length===0) throw 'error getting children'
			wait.remove()
			// got children
			for(const cterm of data.lst) {
				print_one_term(
					{
						term: cterm,
						row: childrenrow,
					},
					obj
				)
			}
		})
		.catch(e=>{
			wait
				.text( e.message || e)
				.style('color','red')
			if(e.stack) console.log(e.stack)
		})
		.then( ()=>{
			children_loaded = true
			client.appear( childrenrow )
			button.text('-')
		})
	})
}







function display_searchbox ( obj ) {
/* show search box at top of tree
display list of matching terms in-place below <input>
term view shows barchart
barchart is shown in-place under term and in full capacity
*/
	const div = obj.dom.searchdiv
		.style('display','block')
		.append('div')
		.style('display','inline-block')
	const input = div
		.append('input')
		.attr('type','search')
		.style('width','100px')
		.style('display','block')
		.attr('placeholder','Search')

	if( obj.modifier_click_term ) {
		// selecting term, set focus to the box
		input.node().focus()
	}

	const table = div
		.append('div')
		.style('border-left','solid 1px #85B6E1')
		.style('margin','2px 0px 10px 10px')
		.style('padding-left','10px')
		.append('table')
		.style('border-spacing','0px')
		.style('border-collapse','separate')

	// TODO debounce

	input.on('keyup', async ()=>{

		table.selectAll('*').remove()

		const str = input.property('value')
		// do not trim space from input, so that 'age ' will be able to match with 'age at..' but not 'agedx'

		if( str==' ' || str=='' ) {
			// blank
			return
		}
		try {
			// query
			const data = await obj.do_query( ['findterm='+str] )
			if(data.error) throw data.error
			if(!data.lst || data.lst.length==0) throw 'No match'

			if( obj.modifier_click_term ) {
				searchresult2clickterm( data.lst )
				return
			}

			// show full terms with graph/tree buttons
			for(const term of data.lst) {
				const tr = table.append('tr')
					.attr('class','sja_tr2')
				tr.append('td')
					.style('opacity','.6')
					.text(term.name)
				const td = tr.append('td') // holder for buttons
					.style('text-align','right')
				if( term.graph && term.graph.barchart ) {
					makeviewbutton( term, td )
				}
				maketreebutton( term, td )
			}
		} catch(e) {
			table.append('tr').append('td')
				.style('opacity',.5)
				.text(e.message || e)
			if(e.stack) console.log(e.stack)
		}
	})

	// helpers
	function searchresult2clickterm ( lst ) {
		for(const term of lst) {
			const div = table.append('tr')
				.append('td')
				.append('div')
				.text(term.name)
			if( term.graph ) {
				// only allow selecting for graph-enabled ones
				div.attr('class','sja_menuoption')
				.style('margin','1px 0px 0px 0px')
				.on('click',()=> obj.modifier_click_term.callback( term ) )
			} else {
				div.style('padding','5px 10px')
				.style('opacity',.5)
			}
		}
	}
	function makeviewbutton ( term, td ) {
		const tr_hidden = table.append('tr')
			.style('display','none')
		let loading=false,
			loaded =false
		const viewbutton = td.append('div') // view button
			.style('display','inline-block')
			.attr('class','sja_menuoption')
			.style('zoom','.8')
			.style('margin-right','10px')
			.text('VIEW')
		viewbutton.on('click',()=>{
			if( tr_hidden.style('display')=='none' ) {
				tr_hidden.style('display','table-row')
			} else {
				tr_hidden.style('display','none')
			}
			if(loaded || loading) return
			viewbutton.text('Loading...')
			loading=true
			const div = tr_hidden.append('td')
				.attr('colspan',3)
				.append('div')
				.style('border-left','solid 1px #aaa')
				.style('margin-left',graph_leftpad)
			make_barplot( obj, term, div, ()=>{
				loading=false
				loaded=true
				viewbutton.text('VIEW')
			})
		})
	}
	function maketreebutton ( term, td ) {
		const span = td.append('span')
			.style('font-size','.8em')
			.attr('class','sja_clbtext')
			.text('TREE')
		span.on('click', async ()=>{
			span.text('Loading...')
			const data = await obj.do_query(['treeto='+term.id])
			if(!data.levels) throw 'levels[] missing'
			table.selectAll('*').remove()
			obj.dom.treediv.selectAll('*').remove()
			let currdiv = obj.dom.treediv
			for(const [i,level] of data.levels.entries()) {
				let nextdiv
				for(const term of level.terms) {
					const row = currdiv.append('div')
					if(term.id == level.focusid) {
						// term under focus
						if(i==data.levels.length-1) {
							// last level
							print_one_term( {term,row,flicker:true}, obj )
						} else {
							// before last level, manually print it
							row.attr('class','sja_tr2')
							row.append('div') // button
								.style('display','inline-block')
								.style('font-family','courier')
								.attr('class','sja_menuoption')
								.text('-')
								.on('click',()=>{
									nextdiv.style('display', nextdiv.style('display')=='none'?'block':'none')
								})
							row.append('div')
								.style('display','inline-block')
								.style('padding',label_padding)
								.text(term.name)
							nextdiv = currdiv.append('div')
								.style('padding-left',tree_indent)
						}
					} else {
						// a sibling
						print_one_term( {term,row}, obj )
					}
				}
				currdiv = nextdiv
			}
		})
	}
}



export function showtree4selectterm ( arg, button ) {
/*
arg{}
.obj
.term1
.term2
.callback
*/
	arg.obj.tip.clear()
		.showunder( button )
	const disable_terms = arg.term2 ? new Set([ arg.term1.id, arg.term2.id ]) : new Set([ arg.term1.id ])
	const obj = {
		genome: arg.obj.genome,
		mds: arg.obj.mds,
		div: arg.obj.tip.d.append('div'),
		default_rootterm: {},
		modifier_click_term: {
			disable_terms,
			callback: arg.callback
		}
	}
	init(obj)
}

export function menuoption_add_filter ( obj, tvslst ) {
/*
obj: the tree object
tvslst: an array of 1 or 2 term-value setting objects
     this is to be added to the obj.termfilter.terms[]
	 if barchart is single-term, tvslst will have only one element
	 if barchart is two-term overlay, tvslst will have two elements, one for term1, the other for term2
*/
}
export function menuoption_select_to_gp ( obj, tvslst ) {
}
export function menuoption_select_group_add_to_cart ( obj, tvslst ) {
}
