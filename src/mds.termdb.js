import * as client from './client'
import * as common from './common'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {init as plot_init} from './mds.termdb.plot'
import {may_makebutton_crosstabulate} from './mds.termdb.crosstab'
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
add_searchbox_4term
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
	obj.errdiv = obj.div.append('div')
	obj.searchdiv = obj.div.append('div').style('display','none')
	obj.termfilterdiv = obj.div.append('div').style('display','none')
	obj.treediv = obj.div.append('div')
		.style('display','inline-block')
		.append('div')
	obj.tip = new client.Menu({padding:'5px'})
	obj.div.on('click.tdb', ()=>{
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
		const lst = [ 'genome='+obj.genome.name, '&dslabel='+obj.mds.label ]
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
		obj.errdiv.text('Error: '+ (e.message||e) )
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

	const data = await obj.do_query(["default_rootterm=1"])
	if(data.error) throw 'error getting default root terms: '+data.error
	if(!data.lst) throw 'no default root term: .lst missing'

	// show root nodes

	for(const i of data.lst) {
		const arg = {
			row: obj.treediv.append('div'),
			term: i,
			isroot: 1,
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
	const div = obj.termfilterdiv
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
		obj.selected_group_div = obj.termfilterdiv.append('div')
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
	.name
	.isleaf
	...
.isroot

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
	row.append('div')
		.style('display','inline-block')
		.style('padding','5px 3px 5px 1px')
		.html( term.name )

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
		//may_enable_crosstabulate( term, row,  obj )
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
		.style('border','solid 1px #aaa')
		.style('border-radius','5px')
		.style('margin','10px 0px')
		.style('display','none')
		.style('position','relative')

	// these to be shared for crosstab function
	term.graph.barchart.dom = {
		button: button,
		loaded: false,
		div: div
	}

	button.on('click', async ()=>{

		if(div.style('display') == 'none') {
			client.appear(div, 'inline-block')
			//button.attr('class','sja_button_open')
			button.style('border','none')
		} else {
			client.disappear(div)
			//button.attr('class','sja_button_fold')
			button.style('border','solid 1px #555')
		}

		if( term.graph.barchart.dom.loaded ) return

		button.text('Loading')
		term.graph.barchart.dom.loaded=true
		make_barplot(
			obj,
			term,
			div,
			()=> button.text('VIEW')
		)
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






function may_enable_crosstabulate ( term1, row, obj ) {
/*
may enable a standalone crosstab button for a term in the tree
just a wrapper for may_makebutton_crosstabulate with its callback function

benefit of having this standalone button is that user having such need in mind will be able to find it directly,
rather than having to remember to click on the barchart button first, and get to crosstab from the barchart panel

for showing crosstab output, should show in barchart panel instead with the instrument panel
providing all the customization options
*/
	may_makebutton_crosstabulate( {
		obj,
		term1: term1,
		button_row: row,
		callback: term2=>{
			obj.tip.hide()

			// display result through barchart button
			term1.graph.barchart.dom.loaded=true
			term1.graph.barchart.dom.div.selectAll('*').remove()
			client.appear( term1.graph.barchart.dom.div, 'inline-block' )
			term1.graph.barchart.dom.button
				.style('background','#ededed')
				.style('color','black')

			const plot = {
				obj,
				genome: obj.genome.name,
				dslabel: obj.mds.label,
				holder: term1.graph.barchart.dom.div,
				term: term1,
				term2: term2,
				term2_displaymode: 'table',
				default2showtable: true,
				termfilter: obj.termfilter
			}
			plot_init( plot )
		}
	})
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
		.style('padding-left', '30px')

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




export function add_searchbox_4term ( obj, holder, callback ) {
/*
to be removed
add a search box to find term and run callback on it
*/

	const div = holder.append('div')
	const input = div.append('div')
		.append('input')
		.attr('type','text')
		.style('width','150px')
		.attr('placeholder','Search term')

	input.node().focus()

	const resultholder = div
		.append('div')
		.style('margin-bottom','10px')
		.style('display','inline-block')

	let lastterm = null

	// TODO keyup event listner needs debounce

	input.on('keyup', async ()=>{
		
		const str = input.property('value')
		// do not trim space from input, so that 'age ' will be able to match with 'age at..' but not 'agedx'

		if( str==' ' || str=='' ) {
			// blank
			resultholder.selectAll('*').remove()
			return
		}

		if( client.keyupEnter() ) {
			// pressed enter, if terms already found, use that
			if(lastterm) {
				callback( lastterm )
				return
			}
		}

		// query
		const par = { findterm: {
			str: str
		}}

		const data = await obj.do_query( par )

		if(data.error) {
			return
		}

		resultholder.selectAll('*').remove()
		if(!data.lst || data.lst.length==0) {
			resultholder.append('div')
				.text('No match')
				.style('opacity',.5)
			return
		}

		lastterm = data.lst[0]

		for(const term of data.lst) {
			resultholder.append('div')
				.attr('class','sja_menuoption')
				.text(term.name)
				.on('click',()=>{
					callback( term )
				})
		}
	})
}




function display_searchbox ( obj ) {
/*
*/
	const div = obj.searchdiv
		.style('display','block')
		.append('div')
		.style('display','inline-block')
	const input = div
		.append('input')
		.attr('type','search')
		.style('width','100px')
		.style('display','block')
		.attr('name','x')
		.attr('placeholder','Search')

	if( obj.modifier_click_term ) {
		// selecting term, set focus to the box
		input.node().focus()
	}

	const table = div.append('table')
		.style('border-spacing','0px')
		.style('border-collapse','separate')
		.style('margin-bottom','10px')

	let lastterm = null

	// TODO keyup event listner needs debounce

	input.on('keyup', async ()=>{
		
		const str = input.property('value')
		// do not trim space from input, so that 'age ' will be able to match with 'age at..' but not 'agedx'

		if( str==' ' || str=='' ) {
			// blank
			table.selectAll('*').remove()
			return
		}

		// query
		const data = await obj.do_query( ['findterm='+str] )

		if(data.error) {
			return
		}

		table.selectAll('*').remove()
		if(!data.lst || data.lst.length==0) {
			table.append('tr').append('td')
				.text('No match')
				.style('opacity',.5)
			return
		}

		lastterm = data.lst[0]

		for(const term of data.lst) {

			if( obj.modifier_click_term ) {
				// display term as a button to be selected
				table.append('tr')
					.append('td')
					.append('div')
					.attr('class','sja_menuoption')
					.text(term.name)
					.on('click',()=>{
						obj.modifier_click_term.callback( term )
					})
				continue
			}

			// not selecting term name, display additional buttons for each term
			const tr = table.append('tr')
				.attr('class','sja_tr2')
			tr.append('td').text(term.name)
			const td = tr.append('td') // holder for buttons
			if( term.graph && term.graph.barchart ) {
				td.append('div')
					.style('display','inline-block')
					.attr('class','sja_menuoption')
					.style('zoom','.8')
					.text('VIEW')
					.on('click',()=>{
						const p = client.newpane({x:100,y:100})
						p.header.text(term.name)
						const wait = p.body.append('div')
							.style('margin','20px')
							.text('Loading...')
						make_barplot( obj, term, p.body, ()=>wait.remove() )
					})
			}
			tr.append('td')
				.append('span')
				.text('TREE')
				.style('margin-left','10px')
				.style('font-size','.8em')
				.attr('class','sja_clbtext')
		}
	})
}
