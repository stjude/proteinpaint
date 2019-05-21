import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import * as client from './client'
import * as common from './common'
import {init,add_searchbox_4term} from './mds.termdb'
import {make_termvalueselection_ui} from './mds.termdb.termvaluesetting.ui'
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
update_terms_div
__update_legend
update_legend_by_infokey
update_legend_by_termdb2groupAF
update_legend_by_ebgatest
create_group_legend
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
					nm.in_use=true
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
				nm.in_use=true
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
				nm.in_use=true
				nm.inuse_infokey = false
				nm.inuse_termdb2groupAF = false
				nm.inuse_ebgatest = true
				update()
			})
	}

	if( nm.in_use ) {
		// show cancel option
		menudiv.append('div')
			.style('margin-top','10px')
			.attr('class','sja_menuoption')
			.html('&times;&nbsp;&nbsp;Disable')
			.on('click', ()=>{
				nm.in_use = false
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

	const count_limit_vcf = true
	// create_group_legend(settingholder, tk.vcf.numerical_axis.termdb2groupAF.group1, tk, block)
	// create_group_legend(settingholder, tk.vcf.numerical_axis.termdb2groupAF.group2, tk, block)
	make_termvalueselection_ui(settingholder, tk.vcf.numerical_axis.termdb2groupAF.group1, tk.mds, block.genome, count_limit_vcf,
		async (terms_div)=>{
			await tk.load()
			update_filter(terms_div, tk.vcf.numerical_axis.termdb2groupAF.group1, tk, block)
		})
	make_termvalueselection_ui(settingholder, tk.vcf.numerical_axis.termdb2groupAF.group2, tk.mds, block.genome, count_limit_vcf,
		async (terms_div)=>{
			await tk.load()
			update_filter(terms_div, tk.vcf.numerical_axis.termdb2groupAF.group2, tk, block)
		})

}


function update_legend_by_ebgatest( settingholder, tk, block ) {
	
	const count_limit_vcf = true
	// create_group_legend(settingholder, tk.vcf.numerical_axis.ebgatest, tk, block)
	make_termvalueselection_ui(settingholder, tk.vcf.numerical_axis.ebgatest, tk.mds, block.genome, count_limit_vcf,
		async (terms_div)=>{
			await tk.load()
			update_filter(terms_div, tk.vcf.numerical_axis.ebgatest, tk, block)
	})

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


function update_filter(terms_div, group, tk, block) {

	terms_div.selectAll('*').remove()

	for(const [i, term] of group.terms.entries()){

		const tip = new client.Menu({padding:'0'})

		const term_name_btn = terms_div.append('div')
			.attr('class','sja_filter_tag_btn')
			.style('border-radius','6px 0 0 6px')
			.style('background-color', '#4888BF')
			.style('padding','7px 6px 5px 6px')
			.style('margin-left', '5px')
			.style('font-size','.7em')
			.text(term.term.name)
			.style('text-transform','uppercase')
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
			.attr('class','sja_filter_tag_btn')
			.style('background-color','#eeeeee')
			.style('font-size','.7em')
			.style('padding','7px 6px 5px 6px')

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
							update_filter(terms_div, group, tk, block)
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
					.attr('class','sja_filter_tag_btn')
					.style('font-size','1em')
					.style('padding','3px 4px 3px 4px')
					.style('margin-right','1px')
					.style('background-color', '#4888BF')
					.text(term.values[j].label)
					.on('click', async ()=>{

						tip.clear()

						const wait = tip.d.append('div').text('Loading...')
						tip.showunder( term_value_btn.node() )

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

							tip.d.append('div')
								.attr('class','sja_menuoption')
								.html('&times;&nbsp;&nbsp;Delete')
								.on('click', async ()=>{
									group.terms[i].values.splice(j,1)
									if(group.terms[i].values.length==0) {
										group.terms.splice(i,1)
									}
									tip.hide()
									may_settoloading_termgroup( group )
									update_filter(terms_div, group, tk, block)
									await tk.load()
								})

							for (const category of data.lst){

								if(term.values.find(v=>v.key == category.key)) continue

								tip.d.append('div')
									.html('<span style="font-size:.8em;opacity:.6">n='+category.samplecount+'</span> '+category.label)
									.attr('class','sja_menuoption')
									.on('click',async ()=>{
										// replace the old category with the new one
										tip.hide()
										group.terms[i].values[j] = {key:category.key,label:category.label}
										may_settoloading_termgroup( group )
										update_filter(terms_div, group, tk, block)
										await tk.load()
									})
							}

							tip.showunder( term_value_btn.node() )

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
							.attr('class','sja_filter_tag_btn')
							.style('background-color','#4888BF')
							.style('margin-right','1px')
							.style('padding','3px 5px')
							.style('text-transform','uppercase')
							.html('&#43;')
							.on('click', async ()=>{
								tip.clear()
		
								const wait = tip.d.append('div').text('Loading...')
								tip.showunder( add_value_btn.node() )
		
								const arg = {
									genome: block.genome.name,
									dslabel: tk.mds.label, 
									getcategories: 1,
									samplecountbyvcf: 1,
									termid : term.term.id
								}
		
								try {
									const data = await client.dofetch( 'termdb', arg )
									if(data.error) throw data.error
									wait.remove()
		
									for (const category of data.lst){
										if(term.values.find(v=>v.key == category.key)) continue
										tip.d.append('div')
											.html('<span style="font-size:.8em;opacity:.6">n='+category.samplecount+'</span> '+category.label)
											.attr('class','sja_menuoption')
											.on('click',async ()=>{
												group.terms[i].values.push({key:category.key,label:category.label})
												tip.hide()
												may_settoloading_termgroup( group )
												update_filter(terms_div, group, tk, block)
												await tk.load()
											})
									}
									tip.showunder( add_value_btn.node() )
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
		terms_div.append('div')
			.attr('class','sja_filter_tag_btn')
			.style('padding','3px 6px 3px 4px')
			.style('border-radius','0 6px 6px 0')
			.style('background-color', '#4888BF')
			.html('&#215;')
			.on('click',async ()=>{
				group.terms.splice(i, 1)
				may_settoloading_termgroup( group )
				update_filter(terms_div, group, tk, block)
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
						values: [{key: bar_term.value, label: bar_term.label}],
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
		update_filter(terms_div, group, tk, block)
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
