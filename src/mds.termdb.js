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

		if( obj.default_rootterm ) {
			await show_default_rootterm( obj )
			return
		}


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

	// expand/fold button, if the term is not leaf
	if( !term.isleaf ) {

		let children_loaded = false, // whether this term has children loaded already
			isloading = false

		// row to display children terms
		const crow = arg.row.append('div')
			.style('display','none')
			.style('padding-left', '30px')

		const button = row.append('div')
			.style('display','inline-block')
			.style('font-family','courier')
			.attr('class','sja_menuoption')
			.text('+')

		button.on('click',()=>{

			if(isloading) return // guard against repeated clicking while loading

			if(children_loaded) {
				// children has been loaded, toggle visibility
				if(crow.style('display') === 'none') {
					client.appear(crow)
					button.text('-')
				} else {
					client.disappear(crow)
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
							row: crow,
						},
						obj
					)
				}
			})
			.catch(e=>{
				crow.text( e.message || e)
				if(e.stack) console.log(e.stack)
			})
			.then( ()=>{
				isloading=false
				children_loaded = true
				client.appear( crow )
				button.text('-')
			})
		})
	}

	// term name
	row.append('div')
		.style('display','inline-block')
		.style('padding','5px 3px 5px 1px')
		.html( term.name )

	// term function buttons
}
