import * as client from './client'
import * as common from './common'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {render} from './mds.termdb.plot'
import {may_makebutton_crosstabulate} from './mds.termdb.crosstab'

/*

init() accepts following triggers:
- show term tree starting with default terms, at terms show graph buttons
- show term tree, for selecting a term (what are selectable?), no graph buttons

init accepts obj{}
.genome{}
.mds{}
.div

obj has triggers
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
print_one_term
may_make_term_foldbutton
may_make_term_graphbuttons
term_addbutton_barchart


Notes:
* as it is called "termdb", use "term" rather than "node", to increase consistency


server returns json objects as terms, which are from the termjson table



planned features:
* launch this vocabulary tree on a variant; limit patients to those carrying alt alleles of this variant


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
const crosstab_btn = obj.crosstab_btn
	window.obj = obj // for testing
	obj.errdiv = obj.div.append('div')
	obj.treediv = obj.div.append('div')
	obj.tip = new client.Menu({padding:'5px'})
	obj.div.on('click.tdb', ()=>{
		// the plot.button_row in mds.termdb.plot2 and
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

	try {

		if(!obj.genome) throw '.genome{} missing'
		if(!obj.mds) throw '.mds{} missing'

		// if all queries are handled at termdb route, can use this closure to simplify
		obj.do_query = (arg) => {
			arg.genome = obj.genome.name
			arg.dslabel = obj.mds.label
			return client.dofetch('termdb', arg)
		}

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

	const data = await obj.do_query( {
		default_rootterm: 1
	})
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
		// barchart button

		may_list_genotypecount_peritem( term, row, row_graph, obj )

		term_addbutton_barchart( term, row, row_graph, obj )

		may_enable_crosstabulate( term, row,  obj )
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
		.attr('class','sja_button')
		.text('BARCHART')

	const div = row_graph.append('div')
		.style('border','solid 1px #ccc')
		.style('border-radius','5px')
		.style('margin','10px')
		.style('padding','10px')
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
			button.attr('class','sja_button_open')
		} else {
			client.disappear(div)
			button.attr('class','sja_button_fold')
		}

		if( term.graph.barchart.dom.loaded ) return

		button.text('Loading')

		const arg = {
			barchart: {
				id: term.id
			}
		}
		/// modifier
		if( obj.modifier_ssid_barchart ) {
			arg.ssid = obj.modifier_ssid_barchart.ssid
		}

		try {
			const data = await obj.do_query( arg )
			if(data.error) throw data.error
			if(!data.lst) throw 'no data for barchart'

			// make barchart
			const plot = {
				holder: div,
				genome: obj.genome.name,
				dslabel: obj.mds.label,
				items: data.lst,
				unannotated: data.unannotated,
				boxplot: data.boxplot, // available for numeric terms
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

				// this doesn't work
				plot.term2 = {name:'genotype'}

			}

			render( plot, obj )
		} catch(e) {
			client.sayerror( div, e.message || e)
			if(e.stack) console.log(e.stack)
		}

		button.text('BARCHART')
		term.graph.barchart.dom.loaded=true
	})
}




function may_list_genotypecount_peritem ( term, row, row_graph, obj ) {

	if( !obj.modifier_ssid_barchart ) return

	// similar to barchart, but show a list instead, for each item, display number of samples per genotype

	const button = row.append('div')
		.style('font-size','.8em')
		.style('margin-left','20px')
		.attr('class','sja_button')
		.text('LIST')

	const div = row_graph.append('div')
		.style('border','solid 1px #ccc')
		.style('border-radius','5px')
		.style('margin','10px')
		.style('padding','10px')
		.style('display','none')

	let loaded=false,
		loading=false

	button.on('click', async ()=>{

		if(div.style('display') == 'none') {
			client.appear(div, 'inline-block')
			button.attr('class','sja_button_open')
		} else {
			client.disappear(div)
			button.attr('class','sja_button_fold')
		}

		if( loaded || loading ) return

		loading=true

		button.text('Loading')

		const arg = {
			ssid: obj.modifier_ssid_barchart.ssid,
			barchart: {
				id: term.id
			}
		}

		try {
			const data = await obj.do_query( arg )
			if(data.error) throw data.error
			if(!data.lst) throw 'no data for barchart'

			const table = div.append('table')
			for(const item of data.lst) {

				if(!item.lst) continue

				const tr = table.append('tr')
				tr.append('td')
					.style('text-align','right')
					.html( item.lst.map( i=>
						// {label,value}
						'<span style="background:'+obj.modifier_ssid_barchart.groups[i.label].color+';color:white;font-size:.8em;padding:2px">'+i.value+'</span>'
						).join('')
					)
				tr.append('td').text( item.label )
			}


		} catch(e) {
			client.sayerror( div, e.message || e)
			if(e.stack) console.log(e.stack)
		}

		loaded=true
		loading=false
		button.text('LIST')
	})
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
		term1: term1,
		button_row: row,
		obj: obj,
		callback: result=>{

			/* got result
			.term2{}
			.items[]
			._button
			*/

			// display result through barchart button
			term1.graph.barchart.dom.loaded=true
			term1.graph.barchart.dom.div.selectAll('*').remove()
			client.appear( term1.graph.barchart.dom.div, 'inline-block' )
			term1.graph.barchart.dom.button
				.style('background','#ededed')
				.style('color','black')

			const plot = {
				obj: obj,
				genome: obj.genome.name,
				dslabel: obj.mds.label,
				holder: term1.graph.barchart.dom.div,
				term: term1,
				term2: result.term2,
				items: result.items,
				default2showtable: true, // a flag for barchart to show html table view by default,
				term2_displaymode: 'table'
			}
			render( plot, obj )
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

		// parameter for getting children terms
		const param = {
			get_children: {
				id: arg.term.id
			}
		}
		if( arg.modifier_ssid_onterm ) {
			param.get_children.ssid = arg.modifier_ssid_onterm.ssid
		}

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
