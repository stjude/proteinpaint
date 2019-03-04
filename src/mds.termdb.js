import * as client from './client'
import * as common from './common'
//import {axisTop} from 'd3-axis'
//import {scaleLinear,scaleOrdinal,schemeCategory10} from 'd3-scale'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'

/*



obj{}:
.genome {}
.mds{}
.div




********************** EXPORTED
init()
********************** INTERNAL



Notes:
* as it is called "termdb", use "term" rather than "node", to increase consistency


server returns json objects as terms, which are from the termjson table



planned features:
* launch this vocabulary tree on a variant; limit patients to those carrying alt alleles of this variant


*/







export async function init ( obj  ) {
/*
*/
window.obj = obj

	obj.errdiv = obj.div.append('div')

	obj.treediv = obj.div.append('div')

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
*/
	const arg = {
		genome: obj.genome.name,
		dslabel: obj.mds.label,
		default_rootterm: 1
	}
	const data = await client.dofetch( 'termdb', arg )
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
/* print a term
for non-leaf term, show the expand/fold button
upon clicking button, to retrieve children and make recursive call to render children

arg{}
.row <DIV>
.term{}
	.name
	.isleaf
	...
.isroot
*/

	const term = arg.term

	/* a row to show this term
	if the term is parent, will also contain the expand/fold button
	children to be shown in a separate row
	*/
	const row = arg.row.append('div')

	may_make_term_foldbutton( term, row, arg.row, obj )

	// term name
	row.append('div')
		.style('display','inline-block')
		.style('padding','5px 3px 5px 1px')
		.html( term.name )

	// term function buttons

	may_make_term_graphbutton( term, row, obj )
}



function may_make_term_graphbutton ( term, row, obj ) {
/*
if term.graph{} is there, make a button to trigger it
allow to make 
*/
	if(!term.graph) {
		// no graph
		return
	}


	if(term.graph.barchart) {
		term_graphbutton_barchart( term, row, obj )
	}

	// to add other graph types
}




function term_graphbutton_barchart ( term, row, obj ) {
/*
click button to launch barchart for a term

there may be other conditions to apply, e.g. patients carrying alt alleles of a variant
such conditions may be carried by obj
*/

	const button = row.append('button')
		.style('margin-left','20px')
		.style('font-size','.8em')
		.text('BARCHART')

	button.on('click',()=>{
		
	})
}



function may_make_term_foldbutton ( term, buttonholder, row, obj ) {
/*
may show expand/fold button for a term

buttonholder: div in which to show the button, term label is also in it
row: the parent of buttonholder for creating the div for children terms
*/

	if(term.isleaf) {
		// is leaf term, no button
		return
	}

	let children_loaded = false, // whether this term has children loaded already
		isloading = false

	// row to display children terms
	const childrenrow = row.append('div')
		.style('display','none')
		.style('padding-left', '30px')

	const button = buttonholder.append('div')
		.style('display','inline-block')
		.style('font-family','courier')
		.attr('class','sja_menuoption')
		.text('+')

	button.on('click',()=>{

		if(isloading) return // guard against repeated clicking while loading

		if(children_loaded) {
			// children has been loaded, toggle visibility
			if(childrenrow.style('display') === 'none') {
				client.appear(childrenrow)
				button.text('-')
			} else {
				client.disappear(childrenrow)
				button.text('+')
			}
			return
		}

		// to load children terms
		isloading = true

		const param = {
			genome: obj.genome.name,
			dslabel: obj.mds.label,
			get_children: {
				id: term.id
			}
		}
		client.dofetch('termdb', param)
		.then(data=>{
			if(data.error) throw data.error
			if(!data.lst || data.lst.length===0) throw 'error getting children'
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
			childrenrow.text( e.message || e)
			if(e.stack) console.log(e.stack)
		})
		.then( ()=>{
			isloading=false
			children_loaded = true
			client.appear( childrenrow )
			button.text('-')
		})
	})
}
