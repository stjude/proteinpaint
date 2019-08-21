import * as client from './client'
import * as common from './common'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {init as plot_init} from './mds.termdb.plot'
import {init as controls_init, getFilterUi} from './mds.termdb.tree.controls'
import { debounce } from 'debounce'


/*
********************** EXPORTED
init()
********************** INTERNAL
show_default_rootterm
	display_searchbox
	may_display_termfilter
	print_one_term
		print_term_name
		may_make_term_foldbutton
		may_apply_modifier_click_term
		may_apply_modifier_barchart_selectbar
		may_make_term_graphbuttons
			term_addbutton_barchart
				make_barplot
*/

const tree_indent = '30px',
	label_padding = '5px 3px 5px 1px',
	graph_leftpad = '0px',
	button_radius = '5px'


/*
init() accepts following triggers:
- show term tree starting with default terms, at terms show graph buttons
- show term tree, for selecting a term (what are selectable?), no graph buttons

init accepts obj{}
.genome{}
.mds{}
.div
.termfilter{}
  .show_top_ui
  .callbacks[]
  .terms[]     // lst of tvs objects


triggers
obj.default_rootterm{}


modifiers, for modifying the behavior/display of the term tree
attach to obj{}
** modifier_click_term
  when this is provided, will allow selecting terms, do not show graph buttons
** modifier_ssid_barchart
** modifier_barchart_selectbar
*/

export async function init ( obj ) {
/*
obj{}:
.genome {}
.mds{}
.div
.default_rootterm{}
... modifiers
// optional lifecycle callbacks
callbacks: { 
  tree: {
    postRender: callback(obj) or [callback1, ...]
  },
  plot: {
    postRender: callback(plot) or [callback1, ...]
  },
  bar: {
    postClick: callback(termValue)
  }
}
*/
	if( obj.debugmode ) window.obj = obj
  
  // tracker for viewed/plotted terms, 
  // to trigger re-render on state update
  obj.components = {plots:[]}
  obj.expanded_term_ids = []

  obj.main = (updatedKeyVals={}) => {
    for(const key in updatedKeyVals) {
      obj[key] = updates[key]
    }
    // trigger all rendered sub-elements
    for(const name in obj.components) {
      if (Array.isArray(obj.components[name])) {
        // example: 1 or more component.plots 
        for(const component of obj.components[name]) {
          component.main()
        }
      } else {
        obj.components[name].main()
      }
    }
  }

  obj.button_radius = button_radius
  if (!obj.callbacks) obj.callbacks = {}
  // filter, cart
  controls_init(obj) 
  // create event bus for this tree obj
  obj.bus = client.get_event_bus(
    ['postRender'], 
    obj.callbacks && obj.callbacks.tree,
    obj
  )

	obj.dom = {div: obj.div}
	delete obj.div
	obj.dom.errdiv = obj.dom.div.append('div')
	obj.dom.searchdiv = obj.dom.div.append('div').style('display','none')
	obj.dom.termfilterdiv = obj.dom.div.append('div').style('display','none')
	obj.dom.cartdiv = obj.dom.div.append('div').style('display','none')
	obj.dom.treediv = obj.dom.div.append('div')
		.append('div')
		.style('display','inline-block')
		.append('div')
	obj.tip = new client.Menu({padding:'5px'})

  obj.components = {
    filter: getFilterUi(obj),
    plots: []
  }

	// simplified query
	obj.do_query = (args) => {
		const lst = [ 'genome='+obj.genome.name+'&dslabel='+obj.mds.label ]
		// maybe no need to provide term filter at this query
		return client.dofetch2( '/termdb?'+lst.join('&')+'&'+args.join('&') )
	}
	obj.showtree4selectterm = ( termidlst, button, callback ) => {
		// convenient function to be called in barchart config panel for selecting term2
		obj.tip.clear()
			.showunder( button )
		const obj2 = {
			genome: obj.genome,
			mds: obj.mds,
			div: obj.tip.d.append('div'),
			default_rootterm: {},
			modifier_click_term: {
				disable_terms: new Set( termidlst ),
				callback,
			}
		}
		init(obj2)
	}

	try {
		if(!obj.genome) throw '.genome{} missing'
		if(!obj.mds) throw '.mds{} missing'

		// handle triggers

		if( obj.default_rootterm ) {
			await show_default_rootterm( obj )
			// restore_view will delete params2restore key-value once
			restore_view(obj)
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
	obj.controls.components.cart.render(obj)

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

  obj.bus.emit('postRender')
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

	print_term_name( row, arg, term )

	if( may_apply_modifier_barchart_selectbar( obj, term, row, row_graph ) ) return


	// term function buttons, including barchart, and cross-tabulate

	may_make_term_graphbuttons( term, row, row_graph, obj )
}




function print_term_name ( row, arg, term ) {
	// term name
	const label = row
		.append('div')
		.style('display','inline-block')
		.style('padding', label_padding)
		.text( term.name )
	if(arg && arg.flicker) {
		label.style('background-color','yellow')
			.transition()
			.duration(4000)
			.style('background-color','transparent')
	}
	return label
}



function may_apply_modifier_barchart_selectbar ( obj, term, row, row_graph ) {
	if(!obj.modifier_barchart_selectbar) return false
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

	const namebox = print_term_name( row, null, term )

	if( obj.modifier_click_term.disable_terms && obj.modifier_click_term.disable_terms.has( term.id ) ) {

		// this term is disabled, no clicking
		namebox.style('opacity','.5')

	} else if(term.graph) {

		// enable clicking this term
		namebox
			.style('padding-left','8px')
			.style('padding-right','8px')
			.attr('class', 'sja_menuoption')
			.style('border-radius', button_radius)
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
	const button_div = row.append('div')
		.style('display','inline-block')

	const button = button_div.append('div')
		.style('font-size','.8em')
		.style('margin-left','20px')
		.style('display','inline-block')
		.style('border-radius',button_radius)
		.attr('class','sja_menuoption')
		.text('VIEW')

	const view_btn_line = button_div.append('div')
		.style('height','10px')
		.style('margin-left','45px')
		.style('border-left','solid 1px #aaa')
		.style('display','none')

	const div = row_graph.append('div')
		.style('border','solid 1px #aaa')
		.style('margin-bottom','10px')
		.style('display','none')

	const plot_loading_div = div.append('div')
		.style('padding','10px')
		.text('Loading...')
		.style('text-align','center')

	let loaded =false,
		loading=false

	button.on('click', async ()=>{
    const i = obj.expanded_term_ids.indexOf(term.id)
		if(div.style('display') == 'none') {
			client.appear(div, 'inline-block')
			view_btn_line.style('display','block')
      if (i==-1) obj.expanded_term_ids.push(term.id)
		} else {
			client.disappear(div)
			view_btn_line.style('display','none')
      obj.expanded_term_ids.splice(i, 1)
		}
		if( loaded || loading ) {
      plot_loading_div.text('').remove()
      return
    }
		button.style('border','solid 1px #aaa')
		loading=true
		make_barplot( obj, {term}, div, ()=> {
      plot_loading_div.text('').remove()
      loaded=true
      loading=false
    })
	})
}





function make_barplot ( obj, opts, div, callback ) {
/*
  make barchart, as default view
  opts {}
    .term    required
    .term2
    .term0
    .settings {}

*/
  if (!obj.callbacks) obj.callbacks = {}
  if (!obj.callbacks.plot) obj.callbacks.plot = {}
  if (!obj.callbacks.plot.postRender) obj.callbacks.plot.postRender = []
  if (callback) obj.callbacks.plot.postRender.push(callback)

  if (!obj.expanded_term_ids.includes(opts.term.id)) obj.expanded_term_ids.push(opts.term.id)

	const arg = Object.assign({
		obj,
		holder: div,
		genome: obj.genome.name,
		dslabel: obj.mds.label
	}, opts)

	if( obj.modifier_ssid_barchart ) {
		const g2c = {}
		for(const k in obj.modifier_ssid_barchart.groups) {
			g2c[ k ] = obj.modifier_ssid_barchart.groups[k].color
		}
		arg.mutation_lst = [
			{
				chr: obj.modifier_ssid_barchart.chr,
				mutation_name: obj.modifier_ssid_barchart.mutation_name,
				ssid: obj.modifier_ssid_barchart.ssid,
				genotype2color: g2c
			}
		]
		arg.overlay_with_genotype_idx = 0
	}
	
  const plot = plot_init( arg )
  obj.components.plots.push(plot)
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
		.attr('class','tree_search')
		.style('width','100px')
		.style('display','block')
		.attr('placeholder','Search')
	input.node().focus() // always focus

	const table = div
		.append('div')
		.style('border-left','solid 1px #85B6E1')
		.style('margin','2px 0px 10px 10px')
		.style('padding-left','10px')
		.append('table')
		.style('border-spacing','0px')
		.style('border-collapse','separate')

	input.on('input', debounce(tree_search, 300 ))

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
					.style('border-radius',button_radius)
					.on('click',()=> {
						obj.modifier_click_term.callback( term )
					})
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
			make_barplot( obj, {term}, div, ()=>{
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
							const row2 = row.append('div')
							const row_graph = row.append('div')
							row2.attr('class','sja_tr2')
							row2.append('div') // button
								.style('display','inline-block')
								.style('font-family','courier')
								.attr('class','sja_menuoption')
								.text('-')
								.on('click',()=>{
									const toshow = nextdiv.style('display')=='none'
									d3event.target.innerHTML = toshow ? '-' : '+'
									nextdiv.style('display', toshow ? 'block' : 'none')
								})
							print_term_name( row2, null, term )

							if( may_apply_modifier_barchart_selectbar( obj, term, row2, row_graph ) ) {
							} else {
								may_make_term_graphbuttons( term, row2, row_graph, obj )
							}

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

	async function tree_search(){

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
	}
}





function restore_view(obj) {
	if (!obj.params2restore) return
	const params = typeof obj.params2restore == 'object'
		? obj.params2restore
		: getUrlParams(obj.params2restore)
	delete obj.params2restore
	restore_plot(obj, params)
}

function getUrlParams(queryStr) {
	const params = {}
	queryStr.split('&').forEach(kv=>{
		const [key,val] = kv.split('=')
		params[key] = !val || isNaN(val) ? val : +val 
	})
	return params
}

function save_view() {
	/* To-Do: 

	If a user clicks a 'Save View' button,
	it will submit and cache the view settings as a json file
	in the server, which will return and notify the user
	with the view_id for future reference and to be opened via
	restore_view()

	*/
}

async function restore_plot(obj, params) {
  if (!params.term && !params.term1) return
	const restored_div = obj.dom.div.append('div')
		.style('margin', '20px')
		.style('padding', '10px 20px')
		.style('border', '1px solid #aaa')

  if (params.term1) params.term = params.term1

	if (typeof params.term == "object") {
		make_barplot( obj, params, restored_div)
	} else {
		const data = await obj.do_query( ['findterm='+params.term] );
		if (!data.lst.length) return;
		const term = data.lst.filter(d=>d.iscategorical || d.isfloat || d.isinteger || d.iscondition)[0]

		let term2, term0
		if (params.term2 && params.term2 != 'genotype') {
			const data = await obj.do_query( ['findterm='+params.term2] );
			if (data.lst.length) term2 = data.lst.filter(d=>d.iscategorical || d.isfloat || d.isinteger || d.iscondition)[0]
      if (term2.iscondition) term2.q = {}
		}
		if (params.term0) {
			const data = await obj.do_query( ['findterm='+params.term0] );
			if (data.lst.length) term0 = data.lst.filter(d=>d.iscategorical || d.isfloat || d.isinteger || d.iscondition)[0]
		}
	
		restored_div.append('h3').html('Restored View')
		make_barplot( obj, {
      term, 
      term2, 
      term0,
      settings: {
        bar: {
          overlay: term2 ? 'tree' : 'none',
          divideBy: term0 ? 'tree' : 'none',
        }
      }
    }, restored_div)
	}
}

