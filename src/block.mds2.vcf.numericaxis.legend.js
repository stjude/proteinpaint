import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import * as client from './client'
import * as common from './common'
import {init,add_searchbox_4term} from './mds.termdb'
import {
	may_setup_numerical_axis,
	get_axis_label,
	get_axis_label_termdb2groupAF,
	get_axis_label_ebgatest
	} from './block.mds2.vcf.numericaxis'




/*

********************** EXPORTED
may_create_vcflegend_numericalaxiss
********************** INTERNAL
showmenu_numericaxis
__update_legend
update_legend_by_infokey
update_legend_by_termdb2groupAF
update_legend_by_ebgatest
create_group_legend
update_terms_div
*/




export function may_create_vcflegend_numericalaxis( tk, block ) {
/*
run only upon initiating track
*/
	if( !tk.vcf ) return
	const nm = tk.vcf.numerical_axis
	if( !nm ) return

	const row = tk.legend.table.append('tr')

	// td1
	row
		.append('td')
		.style('text-align','right')
		.style('opacity',.3)
		.text('Numerical axis')

	// td2
	const td = row.append('td')
	// contains a table to make sure things are in one row

	const tr = td.append('table').append('tr')

	const menubutton = tr
		.append('td')
		.style('vertical-align', 'middle')
		.append('button')
		.style('margin','0px 10px')

	// following menubutton, show settings folder

	const settingholder = tr
		.append('td')

	const update_legend_func = __update_legend( menubutton, settingholder, tk, block )

	update_legend_func()

	menubutton.on('click', ()=> {
		showmenu_numericaxis( menubutton, tk, block, update_legend_func )
	})
}



async function showmenu_numericaxis ( menubutton, tk, block, update_legend_func ) {
/* called upon clicking the menubutton
show menu for numerical axis, under menubutton
*/
	tk.legend.tip.clear()
	const menudiv = tk.legend.tip.d

	const nm = tk.vcf.numerical_axis

	if( nm.info_keys ) {
		for(const key of nm.info_keys) {
			if( nm.inuse_infokey && key.in_use ) {
				// using this info key right now, do not show it in menu
				continue
			}
			let name = key.key
			if( tk.info_fields ) {
				const i = tk.info_fields.find( i=> i.key == key.key )
				if(i) name = i.label
			}
			menudiv.append('div')
				.text( name )
				.attr('class','sja_menuoption')
				.on('click', ()=>{
					// selected an info key
					nm.inuse_termdb2groupAF = false
					nm.inuse_ebgatest = false
					nm.inuse_infokey = true
					nm.info_keys.forEach( i=> i.in_use=false )
					key.in_use = true
					update()
				})
		}
	}

	if( nm.termdb2groupAF &&  !nm.inuse_termdb2groupAF ) {
		// show this option when the data structure is available and is not in use
		menudiv.append('div')
			.style('margin-top','10px')
			.attr('class','sja_menuoption')
			.text( get_axis_label_termdb2groupAF( tk ) )
			.on('click', ()=>{
				nm.inuse_infokey = false
				nm.inuse_ebgatest = false
				nm.inuse_termdb2groupAF = true
				update()
			})
	}

	if( nm.ebgatest && !nm.inuse_ebgatest ) {
		// show this option when the data structure is available and is not in use
		menudiv.append('div')
			.style('margin-top','10px')
			.attr('class','sja_menuoption')
			.text( get_axis_label_ebgatest( tk ) )
			.on('click', ()=>{
				nm.inuse_infokey = false
				nm.inuse_termdb2groupAF = false
				nm.inuse_ebgatest = true
				update()
			})
	}

	// all contents for the menu created
	tk.legend.tip.showunder( menubutton.node() )

	async function update() {
		tk.legend.tip.hide()
		update_legend_func()
		menubutton.node().disabled = true
		await tk.load()
		menubutton.node().disabled = false
	}
}




function __update_legend ( menubutton, settingholder, tk, block ) {

	return () => {

		/*
		returned function to be called at two occasions:
		1. at initiating legend options
		2. after changing menu option

		no need to call this at customizing details for an axis type (AF cutoff, change terms etc)

		will update menubutton content,
		and settingholder content
		but will not update track
		*/

		may_setup_numerical_axis( tk )
		menubutton.html( get_axis_label(tk) + ' &#9660;' )

		settingholder.selectAll('*').remove()

		const nm = tk.vcf.numerical_axis
		if( !nm.in_use ) {
			// not in use
			return
		}

		if( nm.inuse_infokey ) {
			// do nothing
			//update_legend_by_infokey( settingholder, tk, block )
			return
		}

		if( nm.inuse_termdb2groupAF ) {
			update_legend_by_termdb2groupAF( settingholder, tk, block )
			return
		}

		if( nm.inuse_ebgatest ) {
			update_legend_by_ebgatest( settingholder, tk, block )
			return
		}

		throw 'do not know what is in use for numerical axis'
		// exceptions are caught
	}
}






function update_legend_by_termdb2groupAF ( settingholder, tk, block ) {

	create_group_legend(settingholder, tk.vcf.numerical_axis.termdb2groupAF.group1, tk, block)
	create_group_legend(settingholder, tk.vcf.numerical_axis.termdb2groupAF.group2, tk, block)

}


function update_legend_by_ebgatest( settingholder, tk, block ) {
	
	create_group_legend(settingholder, tk.vcf.numerical_axis.ebgatest, tk, block)

	// a place to show the population average
	const row = settingholder.append('div')
	row.append('div')
		.style('display','inline-block')
		.style('margin','0px 10px')
		.style('font-size','.8em')
		.style('opacity',.5)
		.text('Average admixture:')
	tk.vcf.numerical_axis.ebgatest.div_populationaverage = row.append('div').style('display','inline-block')
}


function create_group_legend(setting_div, group, tk, block){
/*
group{}
	.terms[]

will attach div_numbersamples to group{}
*/
	// console.log(tk)	
	// Group div
    const group_div = setting_div
        .append('div')
        .style('display', 'block')
        .style('margin','5px 10px')
		.style('padding','3px 10px')
		.style('border','solid 1px')
		.style('border-color','#d4d4d4')


	if( group.name ) {
		group_div.append('div')
			.style('display', 'inline-block')
			.style('opacity',.5)
			.style('font-size','.8em')
			.style('margin-right','10px')
			.text(group.name)
	}

	group.div_numbersamples = group_div.append('div')
		.style('display', 'inline-block')
		.style('opacity',.5)
		.style('font-size','.8em')
		.text('Loading...')

	const terms_div = group_div.append('div')
		.style('display','inline-block')
	
	// display term and category
	update_terms_div(terms_div, group, tk, block)

	const tip = tk.legend.tip

	// add new term
	const add_term_btn = group_div.append('div')
		.attr('class','sja_menuoption')
		.style('display','inline-block')
		.style('padding','2px 7px')
		.style('margin-left','10px')
		.style('border-radius','6px')
		.style('background-color', '#4888BF')
		.style('color','#fff')
		.html('&#43;')
		.on('mouseover',()=>{
			add_term_btn
				.style('background-color','#6c9bca') // change to light backgorund on hover
		})
		.on('mouseout',()=>{
			add_term_btn
				.style('background-color','#4888bf')
		})
		.on('click',async ()=>{
			
			tip.clear()
			.showunder( add_term_btn.node() )

			const errdiv = tip.d.append('div')
				.style('margin-bottom','5px')
				.style('color','#C67C73')

			const treediv = tip.d.append('div')

			// a new object as init() argument for launching the tree with modifiers
	            const obj = {
	                genome: block.genome,
	                mds: tk.mds,
	                div: treediv,
	                default_rootterm: {},
					modifier_barchart_selectbar: {
						callback: result => {
							tip.hide()
							add_term(result)
						}
					}
	            }
	            init(obj)
		})

	async function add_term(result){

		// Add new term to group.terms
		for(let i=0; i < result.terms.length; i++){
			const bar_term = result.terms[i]
			const new_term = {
				values: [bar_term.value],
				term: {
					id: bar_term.term.id,
					iscategorical: bar_term.term.iscategorical,
					name: bar_term.term.name
				} 
			}
			group.terms.push(new_term)
		}
		
		// // update the group div with new terms
		may_settoloading_termgroup( group )
		update_terms_div(terms_div, group, tk, block)
		await tk.load()
	}
}

function update_terms_div(terms_div, group, tk, block){
	terms_div.selectAll('*').remove()

	const tip = tk.legend.tip

	for(const [i, term] of group.terms.entries()){

		const term_name_btn = terms_div.append('div')
			.style('display','inline-block')
			.style('border-radius','6px 0 0 6px')
			.style('background-color', '#4888BF')
			.style('color','#fff')
			.style('padding','7px 6px 5px 6px')
			.style('margin-left', '5px')
			.style('font-size','.7em')
			.text(term.term.name)
			.style('text-transform','uppercase')
			.on('mouseover',()=>{
				term_name_btn
					.style('background-color','#6c9bca')
					.style('cursor','default')
			})
			.on('mouseout',()=>{
				term_name_btn
				.style('background-color','#4888bf')
			})
			.on('click',async ()=>{
		
				tip.clear()
				.showunder( term_name_btn.node() )
	
				const treediv = tip.d.append('div')
	
				// a new object as init() argument for launching the tree with modifiers
	            const obj = {
	                genome: block.genome,
	                mds: tk.mds,
	                div: treediv,
	                default_rootterm: {},
					modifier_barchart_selectbar: {
						callback: result => {
							tip.hide()
							replace_term(result, i)
						}
					}
	            }
	            init(obj)
			})

		const condition_btn = terms_div.append('div')
			.style('display','inline-block')
			.style('color','#fff')
			.style('background-color','#eeeeee')
			.style('font-size','.7em')
			.style('padding','7px 6px 5px 6px')
			.on('mouseover',()=>{
				condition_btn
					.style('background-color', term.isnot ? '#734a93' : '#337273') // change to light backgorund on hover
					.style('cursor','default')
			})
			.on('mouseout',()=>{
				condition_btn
					.style('background-color', term.isnot ? '#511e78' : '#015051')
			})

		if(term.term.iscategorical){
			condition_btn
				.text(term.isnot ? 'IS NOT' : 'IS')
				.style('background-color', term.isnot ? '#511e78' : '#015051')
				.on('click',()=>{

					tip.clear()
						.showunder( condition_btn.node() )

					tip.d.append('div')
						.style('font-size','.7em')
						.style('color','#fff')
						.style('padding','5px')
						.text(term.isnot ? 'IS' : 'IS NOT')
						.style('background-color', term.isnot ? '#015051' : '#511e78')
						.on('click', async()=>{
							tip.hide()
							group.terms[i].isnot = term.isnot ? false : true
							may_settoloading_termgroup( group )
							update_terms_div(terms_div, group, tk, block)
				            await tk.load()
						})
				})
		} else {
			// range label is not clickable
			condition_btn.text('RANGE')
		}

		const term_value_div = terms_div.append('div')
			.style('display','inline-block')

		if( term.term.iscategorical ) {
			
			for (let j=0; j<term.values.length; j++){
				const term_value_btn = term_value_div.append('div')
					.style('display','inline-block')
					.style('font-size','1em')
					.style('padding','3px 4px 3px 4px')
					.style('margin-right','1px')
					.style('background-color', '#4888BF')
					.style('color','#fff')
					.text(term.values[j])
					.on('mouseover',()=>{
						term_value_btn
							.style('background-color','#6c9bca')
							.style('cursor','default')
					})
					.on('mouseout',()=>{
						term_value_btn
							.style('background-color','#4888bf') // change to light backgorund on hover
					})
					.on('click', async ()=>{
						tip.clear()
							.showunder( term_value_btn.node() )

						const wait = tip.d.append('div').text('Loading...')

						const arg = {
							genome: block.genome.name,
							dslabel: tk.mds.label, 
							getcategories: 1,
							samplecountbyvcf: 1, // quick n dirty solution, to count using vcf samples
							termid : term.term.id
						}

						try {
							const data = await client.dofetch( 'termdb', arg )
							if(data.error) throw data.error
							wait.remove()

							const list_div = tip.d.append('div')
								.style('display','block')

							for (const category of data.lst){
								const row = list_div.append('div')

								row.append('div')
									.style('font-size','.7em')
									.style('color','white')
									.style('display','inline-block')
									.style('background','#1f77b4')
									.style('padding','2px 4px')
									.text(category.samplecount)

								row.append('div')
									.style('display','inline-block')
									.style('padding','1px 5px')
									.style('margin-right','5px')
									.text(category.label)

								if( group.terms[i].values.includes(category.value )) {
									// from the list
									row.style('padding','5px 10px')
										.style('margin','1px')
										.style('color','#999')
									continue
								}

								row
									.attr('class','sja_menuoption')
									.on('click',async ()=>{
										tip.hide()

										group.terms[i].values[j] = category.value

										may_settoloading_termgroup( group )

										update_terms_div(terms_div, group, tk, block)
							            await tk.load()
									})
							}
						} catch(e) {
							wait.text( e.message || e )
						}
					})

					// 'OR' button in between values
					if(j<term.values.length-1){
						term_value_div.append('div')
							.style('display','inline-block')
							.style('color','#fff')
							.style('background-color','#4888BF')
							.style('margin-right','1px')
							.style('padding','7px 6px 5px 6px')
							.style('font-size','.7em')
							.style('text-transform','uppercase')
							.text('or')
					}else{
						// '+' button at end of all values to add to list of values
						const add_value_btn = term_value_div.append('div')
							.style('display','inline-block')
							.style('color','#fff')
							.style('background-color','#4888BF')
							.style('margin-right','1px')
							.style('padding','3px 5px')
							.style('text-transform','uppercase')
							.html('&#43;')
							.on('mouseover',()=>{
								add_value_btn
									.style('background-color','#6c9bca')
									.style('cursor','default')
							})
							.on('mouseout',()=>{
								add_value_btn
									.style('background-color','#4888bf') // change to light backgorund on hover
							})
							.on('click', async ()=>{
								tip.clear()
									.showunder( add_value_btn.node() )
		
								const wait = tip.d.append('div').text('Loading...')
		
								const arg = {
									genome: block.genome.name,
									dslabel: tk.mds.label, 
									getcategories: 1,
									termid : term.term.id
								}
		
								try {
									const data = await client.dofetch( 'termdb', arg )
									if(data.error) throw data.error
									wait.remove()
		
									const list_div = tip.d.append('div')
										.style('display','block')
		
									for (const category of data.lst){
										const row = list_div.append('div')
		
										row.append('div')
											.style('font-size','.7em')
											.style('color','white')
											.style('display','inline-block')
											.style('background','#1f77b4')
											.style('padding','2px 4px')
											.text(category.samplecount)
		
										row.append('div')
											.style('display','inline-block')
											.style('padding','1px 5px')
											.style('margin-right','5px')
											.text(category.label)
		
										if( group.terms[i].values.includes(category.value)) {
											// the same
											row.style('padding','5px 10px')
												.style('margin','1px')
												.style('color','#999')
											continue
										}
		
										row
											.attr('class','sja_menuoption')
											.on('click',async ()=>{
												tip.hide()
		
												group.terms[i].values.push(category.value)
		
												may_settoloading_termgroup( group )
		
												update_terms_div(terms_div, group, tk, block)
									            await tk.load()
											})
									}
								} catch(e) {
									wait.text( e.message || e )
								}
							})
					}
			}

		} else if( term.term.isinteger || term.term.isfloat ) {
			// TODO numerical term, print range in value button and apply the suitable click callback

		}

		// button with 'x' to remove term2
		const term_remove_btn = terms_div.append('div')
		.style('display','inline-block')
		.style('padding','3px 6px 3px 4px')
		.style('border-radius','0 6px 6px 0')
		.style('background-color', '#4888BF')
		.style('color','#fff')
		.html('&#215;')
		.on('mouseover',()=>{
			term_remove_btn
				.style('background-color','#6c9bca') // change to light backgorund on hover
		})
		.on('mouseout',()=>{
			term_remove_btn
				.style('background-color','#4888bf')
		})
		.on('click',async ()=>{
			group.terms.splice(i, 1)
			may_settoloading_termgroup( group )
			update_terms_div(terms_div, group, tk, block)
            await tk.load()
		})
	}
	
	async function replace_term(result, term_replce_index){

		// create new array with updated terms
		let new_terms = []

		for(const [i, term] of group.terms.entries()){

			// replace the term by index of clicked term
			if(i == term_replce_index){
				for(const [j, bar_term] of result.terms.entries()){
					const new_term = {
						values: [bar_term.value],
						term: {
							id: bar_term.term.id,
							iscategorical: bar_term.term.iscategorical,
							name: bar_term.term.name
						} 
					}
					new_term.isnot  = term.isnot ? true : false
					new_terms.push(new_term)
				}
			}else{
				new_terms.push(term)
			}
		}

		// assing new terms to group
		group.terms = new_terms
		
		// // update the group div with new terms
		may_settoloading_termgroup( group )
		update_terms_div(terms_div, group, tk, block)
		await tk.load()
	}
}


function may_settoloading_termgroup ( group ) {
	if( group.div_numbersamples ) group.div_numbersamples.text('Loading...')
	if(group.div_populationaverage) {
		group.div_populationaverage.selectAll('*').remove()
		group.div_populationaverage.append('div').text('Loading...')
	}
}


