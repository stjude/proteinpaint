import {event as d3event} from 'd3-selection'
import * as client from './client'
import {legend_newrow} from './block.legend'
import * as common from './common'



/*
********************** EXPORTED
may_create_variantfilter
********************** INTERNAL
display_all_activefilters
display_one_activefilter
display_categorical_filter
display_flag_filter
display_numeric_filter
menu_list_all_variantfilter
configure_one_infofield
count_hiddencategories
*/


export function may_create_variantfilter ( tk, block ) {
/*
called upon initiating the track
variant filters by both info fields and variantcase_fields
*/
	if(!tk.info_fields && !tk.variantcase_fields) return
	tk.legend.variantfilter = {}

	const tr = tk.legend.table.append('tr')
	tr.append('td')
		.style('text-align','right')
		.style('opacity',.3)
		.text('Variant Filters')

	const tr2 = tr.append('td')
		.style('padding-left','5px')
		.append('table')
		.append('tr')

	// button to list inactive filters
	tk.legend.variantfilter.button = tr2
		.append('td')
		.append('div')
		.style('display','inline-block')
		.attr('class','sja_menuoption')
		.text('+')
		.style('border-radius','3px')
		.style('border','solid 1px #ddd')
		.on('click',()=>{
			menu_list_all_variantfilter( tk, block )
		})

	tk.legend.variantfilter.holder = tr2.append('td').style('padding-left','10px')

	display_all_activefilters( tk, block )
}



function display_one_activefilter ( tk, i, block ) {
/*
display one info field
i is an element from tk.info_fields[]
add it as a new element to the holder
allow interacting with it, to update settings of i, and update track
*/
	const row = tk.legend.variantfilter.holder
		.append('div')
		.style('margin-top','5px')
	
	row.append('div')
		.style('display','inline-block')
		.style('border-radius','6px 0 0 6px')
		.style('background-color', '#ddd')
		.style('color','#000')
		.style('padding','6px 6px 6px 6px')
		.style('margin-left', '5px')
		.style('margin-right','1px')
		.style('font-size','.7em')
		.style('text-transform','uppercase')
		.text(i.label)

	const active_filter_div = row.append('div')
		.style('display','inline-block')

	if( i.iscategorical ) {

		// categorical category filter
		display_categorical_filter(tk, i, active_filter_div, row)

	} else if( i.isinteger || i.isfloat ) {

		// numerical category filter
		display_numeric_filter(tk, i, active_filter_div, row)

	} else if( i.isflag ) {
		display_flag_filter(tk, i, active_filter_div, row)
	} else {
		throw 'unknown info type'
	}

	// 'x' button to remove filter
	let loading=false
	row.append('div')
		.attr('class','sja_filter_tag_btn')
		.style('border-radius','0 6px 6px 0')
		.style('background-color', '#ddd')
		.style('padding','2px 6px 4px 6px')
		.style('margin-right','1px')
		.style('color','#000')
		.html('&#215;')
		.on('click', async ()=>{
			if(loading) return
			loading=true
			d3event.target.innerHTML = 'deleting...'
			delete i.isactivefilter
			if(i.iscategorical) {
				delete i.unannotated_ishidden
				for(const v of i.values) delete v.ishidden
			} else if(i.isflag) {
				delete i.remove_yes
				delete i.remove_no
			}
			await tk.load()
			row.remove()
		})
}




function menu_show_categorical_filter ( i, td, update ) {

	td.selectAll('*').remove()

	for(const v of i.values ) {

		const cell = td.append('div')
			.style('display','inline-block')
			.style('padding','2px 10px')
			.attr('class','sja_clb')

		cell.append('div')
			.attr('class','sja_mcdot')
			.style('display','inline-block')
			.style('background', '#aaa')
			.style('padding','2px 3px')
			.text(i._data ? i._data.value2count[v.key] : '')

		const label = cell.append('div')
			.style('display','inline-block')
			.style('padding','2px 5px')
			.style('text-decoration', v.ishidden ? 'line-through' : 'none' )
			.text(v.label)

		cell.on('click',async ()=>{
			label.text('Loading...')
			v.ishidden = !v.ishidden
			await update()
			menu_show_categorical_filter(i,td,update)
		})
	}

	if(i._data.unannotated_count){

		const cell = td.append('div')
			.style('display','inline-block')
			.style('padding','2px 10px')
			.attr('class','sja_clb')

		cell.append('div')
			.attr('class','sja_mcdot')
			.style('display','inline-block')
			.style('background', '#aaa')
			.style('padding','2px 3px')
			.text( i._data ? i._data.unannotated_count : 0 )

		const label = cell.append('div')
			.style('display','inline-block')
			.style('padding','2px 5px')
			.style('text-decoration', i.unannotated_ishidden ? 'line-through' : 'none' )
			.text('Unannotated')

		cell.on('click', async ()=>{
			label.text('Loading...')
			i.unannotated_ishidden = !i.unannotated_ishidden
			await update()
			menu_show_categorical_filter(i,td,update)
		})
	}
}




function menu_list_all_variantfilter ( tk, block ) {
/*
click plus button
list all variant filters in the menu of the plus button
*/	
	const tip = tk.legend.tip
	tip.clear()

	const filter_table = tip.d.append('table')
		.style('border-spacing','5px')
		.style('border-collapse','separate')

	if(tk.info_fields) {
		for(const i of tk.info_fields) {

			const tr = filter_table.append('tr')

			tr.append('td')
				.style('padding','5px')
				.style('text-align','right')
				.style('opacity',.5)
				.text(i.label)

			const td = tr.append('td')
				.style('padding','5px')

			if( i.iscategorical ) {

				menu_show_categorical_filter( i, td,
					async ()=>{
						i.isactivefilter =
							(
								i.values.reduce((x,y)=>x+y.ishidden?1:0,0)
								+ (i.unannotated_ishidden?1:0)
							) > 0
						await tk.load()
						display_all_activefilters(tk, block)
					}
				)

			} else if( i.isinteger || i.isfloat ) {

				menu_show_numeric_filter(i, td)

			} else if( i.isflag ) {

				menu_show_flag_filter(i, td)

			}else{

				throw 'unknown info type'
			}
		}
	}

	if(tk.variantcase_fields) {
	}

	tk.legend.tip.showunder( tk.legend.variantfilter.button.node() )





	function menu_show_numeric_filter(i, filter_terms_td){

		filter_terms_td.selectAll('*').remove()

		const x = '<span style="font-family:Times;font-style:italic">x</span>'

		const start_input = filter_terms_td.append('input')
			.attr('type','number')
			.attr('value',i.range.start)
			.style('width','60px')
			.on('keyup', async ()=>{
				if(!client.keyupEnter()) return
				start_input.property('disabled',true)
				await apply()
				start_input.property('disabled',false)
			})

		// select operator from dropdown to set start value relation
		const startselect = filter_terms_td.append('select')
		.style('margin-left','10px')

		startselect.append('option')
			.html('&le;')
		startselect.append('option')
			.html('&lt;')
		startselect.append('option')
			.html('&#8734;')

		startselect.node().selectedIndex =
			i.range.startunbounded ? 2 :
			i.range.startinclusive ? 0 : 1

		filter_terms_td.append('div')
			.style('display','inline-block')
			.style('padding','3px 10px')
			.html(x)

		// select operator from dropdown to set end value relation
		const stopselect = filter_terms_td.append('select')
			.style('margin-right','10px')

		stopselect.append('option')
			.html('&le;')
		stopselect.append('option')
			.html('&lt;')
		stopselect.append('option')
			.html('&#8734;')

		stopselect.node().selectedIndex =
			i.range.stopunbounded ? 2 :
			i.range.stopinclusive ? 0 : 1

		const stop_input = filter_terms_td.append('input')
			.attr('type','number')
			.style('width','60px')
			.attr('value',i.range.stop)
			.on('keyup', async ()=>{
				if(!client.keyupEnter()) return
				stop_input.property('disabled',true)
				await apply()
				stop_input.property('disabled',false)
			})

		const apply_checkbox_div = filter_terms_td.append('div')
			.style('display','inline-block')
			.style('padding','3px 10px')
			.style('font-size','.8em')
			.text('Apply')
		
		
		const apply_checkbox = apply_checkbox_div.append('input')
			.attr('type','checkbox')
			.style('font-size','1em')
			.style('margin','0 10px')

		if(i.isactivefilter){
			apply_checkbox.property('checked',true)
		}

		const update_btn = filter_terms_td.append('div')
			.attr('class','sja_menuoption')
			.style('display','inline-block')
			.style('font-size','.8em')
			.style('margin-left','5px')
			.style('padding','3px 5px')
			.text('Update')
			.on('click',()=>{
				apply()
			})

		async function apply () {

			try {
				if(apply_checkbox.node().checked == false) {
					i.isactivefilter = false
				}else{
					i.isactivefilter = true
					i.htmlspan = filter_terms_td.append('div')
						.style('display','none')
				}

				if(startselect.node().selectedIndex==2 && stopselect.node().selectedIndex==2) throw 'Both ends can not be unbounded'

				const start = startselect.node().selectedIndex==2 ? null : Number( start_input.node().value )
				const stop  = stopselect.node().selectedIndex==2  ? null : Number( stop_input.node().value )
				if( start!=null && stop!=null && start>=stop ) throw 'start must be lower than stop'

				if( startselect.node().selectedIndex == 2 ) {
					i.range.startunbounded = true
					delete i.range.start
				} else {
					delete i.range.startunbounded
					i.range.start = start
					i.range.startinclusive = startselect.node().selectedIndex == 0
				}
				if( stopselect.node().selectedIndex == 2 ) {
					i.range.stopunbounded = true
					delete i.range.stop
				} else {
					delete i.range.stopunbounded
					i.range.stop = stop
					i.range.stopinclusive = stopselect.node().selectedIndex == 0
				}
				await tk.load()
				menu_list_all_variantfilter(tk, block)
				display_all_activefilters(tk, block)
			} catch(e) {
				window.alert(e)
			}
		}
	}

	function menu_show_flag_filter(i, filter_terms_td){
		const yes_flag_div = filter_terms_td.append('div')
			.style('display','inline-block')
			.style('padding','3px 10px')
			.on('click',async ()=>{
				i.remove_yes =  i.remove_yes ? false : true
				i.remove_no =  i.remove_no ? false : true
				await tk.load()
				menu_list_all_variantfilter(tk, block)
				display_all_activefilters(tk, block)
			})

		const yes_count = yes_flag_div.append('div')
			.attr('class','sja_mcdot')
			.style('display','inline-block')
			.style('background', '#aaa')
			.style('padding','2px 3px')
			.text(i._data ? i._data.count_yes : 0)

		const yes_div = yes_flag_div.append('div')
			.style('display','inline-block')
			.style('background', '#fff')
			.style('padding','4px 5px')
			.text('Yes')

		
		const no_flag_div = filter_terms_td.append('div')
			.style('display','inline-block')
			.style('padding','3px 10px')
			.on('click',async ()=>{
				i.remove_yes =  i.remove_yes ? false : true
				i.remove_no =  i.remove_no ? false : true
				await tk.load()
				menu_list_all_variantfilter(tk, block)
				display_all_activefilters(tk, block)
			})

		const no_count = no_flag_div.append('div')
			.attr('class','sja_mcdot')
			.style('display','inline-block')
			.style('background', '#aaa')
			.style('padding','2px 3px')
			.text(i._data ? i._data.count_no : 0)

		const no_div = no_flag_div.append('div')
			.style('display','inline-block')
			.style('background', '#fff')
			.style('padding','4px 5px')
			.text('No')

		if(i.remove_no){
			no_div.style('text-decoration','line-through')
		}else{
			yes_div.style('text-decoration','line-through')
		}
	}
}




function display_all_activefilters ( tk, block ) {
/*
display/update all active filters
*/

	tk.legend.variantfilter.holder.selectAll('*').remove()

	if( tk.info_fields ) {
		for(const i of tk.info_fields) {
			if(!i.isfilter) continue
			if(i.isactivefilter) {
				display_one_activefilter( tk, i, block )
			}
		}
	}
	if( tk.variantcase_fields ) {
		console.log('to list active variantcase fields')
	}
}




function configure_one_infofield ( i, tk, block ) {

	// for categorical field, to catch categories selected to be hidden
	let hiddencategories

	const div = tk.legend.tip.d.append('div')
		.style('margin','5px')

	if( i.iscategorical ) {
		// TODO display all categories
		hiddencategories = new Set()
	} else {
		// show range setter
	}

	tk.legend.tip.d.append('div')
		.attr('class','sja_menuoption')
		.text('APPLY')
		.on('click', async ()=>{

			if( hiddencategories ) {
				if(hiddencategories.size==0) return
				for(const v of i.values) {
					if(hiddencategories.has(v.key)) {
						v.ishidden=true
					}
				}
			} else {
			}

			i.isactivefilter = true
			display_one_activefilter( tk, i, block )
			tk.legend.tip.hide()
			await tk.load()
		})
}




function display_categorical_filter ( tk, i, active_filter_div, row ) {
// display the business part of a categorical filter except the delete button

	active_filter_div.selectAll('*').remove()
	const tip = tk.legend.tip

	for(const v of i.values ) {

		if(v.ishidden) {
			v.htmlspan = active_filter_div.append('div')
				.attr('class','sja_filter_tag_btn')
				.style('background-color', '#ddd')
				.style('padding','3px 6px 5px 6px')
				.style('margin-right','1px')
				.style('font-size','.9em')
				.style('color','#000')
				.text(
					(i._data ? '('+i._data.value2count[v.key]+') ' : '')
					+v.label
				)
				.style('text-decoration','line-through')
				.on('click',async ()=>{
					delete v.ishidden
					v.htmlspan.text('Loading...')
					await tk.load()
					if( count_hiddencategories(i) == 0 ) {
						delete i.isactivefilter
						row.remove()
					} else {
						// must call this function since may toggle visibility of + button
						display_categorical_filter(tk,i,active_filter_div,row)
					}
				})
		}
	}

	if( i.unannotated_ishidden ) {
		i.unannotated_htmlspan = active_filter_div.append('div')
			.attr('class','sja_filter_tag_btn')
			.style('background-color', '#ddd')
			.style('padding','3px 6px 5px 6px')
			.style('margin-right','1px')
			.style('font-size','.9em')
			.style('color','#000')
			.text( (i._data ? '('+i._data.unannotated_count+') ' : '')+'Unannotated' )
			.style('text-decoration','line-through')
			.on('click',async ()=>{
				delete i.unannotated_ishidden
				i.unannotated_htmlspan.text('Loading...')
				await tk.load()
				if( count_hiddencategories(i) == 0 ) {
					delete i.isactivefilter
					row.remove()
				} else {
					display_categorical_filter(tk,i,active_filter_div,row)
				}
			})
	}

	// '+' button to add filter for same category, only if visible terms exist
	if( count_hiddencategories(i) <= i.values.length ) {
		const add_filter_btn = active_filter_div.append('div')
			.attr('class','sja_filter_tag_btn')
			.style('background-color', '#ddd')
			.style('color','#000')
			.style('padding','2px 6px 4px 6px')
			.style('margin-right','1px')
			.html('&#43;')
			.on('click',()=>{
				tip.clear()
					.showunder( add_filter_btn.node() )

				const list_div = tip.d.append('div')
					.style('display','block')

				for(const v of i.values ) {

					if(!v.ishidden) {
						const tip_row = list_div.append('div')
							.attr('class','sja_menuoption')

						tip_row.append('div')
							.style('display','inline-block')
							.style('padding','1px 5px')
							.text(
								(i._data ? '('+i._data.value2count[v.key]+') ' : '')
								+v.label
							)

						tip_row.on('click',async ()=>{
								tip.hide()
								v.ishidden = true
								display_categorical_filter(tk, i, active_filter_div, row)
								await tk.load()
							})
					}
				}

				if(i._data.unannotated_count && !i.unannotated_ishidden){
					const tip_row = list_div.append('div')
						.attr('class','sja_menuoption')

					tip_row.append('div')
						.style('display','inline-block')
						.style('padding','1px 5px')
						.text( (i._data ? '('+i._data.unannotated_count+') ' : '')+'Unannotated' )
						
					tip_row.on('click',async ()=>{
						tip.hide()
						i.unannotated_ishidden = true
						display_categorical_filter(tk, i, active_filter_div, row)
						await tk.load()
					})
				}
		})
	}
}





function display_numeric_filter(tk, i, active_filter_div, row){

	active_filter_div.selectAll('*').remove()

	const numeric_div = active_filter_div.append('div')
		.attr('class','sja_filter_tag_btn')
		.style('background-color', '#ddd')
		.style('color','#000')
		.style('padding','3px 6px 4px 6px')
		.style('margin-right','1px')
		.style('font-size','.9em')

	numeric_div.selectAll('*').remove()

	const x = '<span style="font-family:Times;font-style:italic">x</span>'
	if( i.range.startunbounded ) {
		numeric_div.html(x+' '+(i.range.stopinclusive?'&le;':'&lt;')+' '+i.range.stop)
	} else if( i.range.stopunbounded ) {
		numeric_div.html(x+' '+(i.range.startinclusive?'&ge;':'&gt;')+' '+i.range.start)
	} else {
		numeric_div.html(
			i.range.start
			+' '+(i.range.startinclusive?'&le;':'&lt;')
			+' '+x
			+' '+(i.range.stopinclusive?'&le;':'&lt;')
			+' '+i.range.stop
		)
	}

	i.htmlspan = numeric_div.append('div')
		.style('display','inline-block')
		.style('background-color', '#ddd')
		.style('color','#000')
		.style('padding-left','3px')
		.text( i._data ? '('+i._data.filteredcount+' filtered)' : '')

	numeric_div.on('click', ()=>{

		const tip = tk.legend.tip
		tip.clear()

		const equation_div = tip.d.append('div')
			.style('display','block')
			.style('padding','3px 5px')

		const start_input = equation_div.append('input')
			.attr('type','number')
			.attr('value',i.range.start)
			.style('width','60px')
			.on('keyup', async ()=>{
				if(!client.keyupEnter()) return
				start_input.property('disabled',true)
				await apply()
				start_input.property('disabled',false)
			})

		// to replace operator_start_div
		const startselect = equation_div.append('select')
		.style('margin-left','10px')

		startselect.append('option')
			.html('&le;')
		startselect.append('option')
			.html('&lt;')
		startselect.append('option')
			.html('&#8734;')

		startselect.node().selectedIndex =
			i.range.startunbounded ? 2 :
			i.range.startinclusive ? 0 : 1

		equation_div.append('div')
			.style('display','inline-block')
			.style('padding','3px 10px')
			.html(x)

		// to replace operator_end_div
		const stopselect = equation_div.append('select')
			.style('margin-right','10px')

		stopselect.append('option')
			.html('&le;')
		stopselect.append('option')
			.html('&lt;')
		stopselect.append('option')
			.html('&#8734;')

		stopselect.node().selectedIndex =
			i.range.stopunbounded ? 2 :
			i.range.stopinclusive ? 0 : 1

		const stop_input = equation_div.append('input')
			.attr('type','number')
			.style('width','60px')
			.attr('value',i.range.stop)
			.on('keyup', async ()=>{
				if(!client.keyupEnter()) return
				stop_input.property('disabled',true)
				await apply()
				stop_input.property('disabled',false)
			})

		tip.d.append('div')
			.attr('class','sja_menuoption')
			.style('text-align','center')
			.text('APPLY')
			.on('click', ()=>{
				tip.hide()
				apply()
			})

		// tricky: only show tip when contents are filled, so that it's able to detect its dimention and auto position itself
		tip.showunder( numeric_div.node() )

		async function apply () {
			try {
				if(startselect.node().selectedIndex==2 && stopselect.node().selectedIndex==2) throw 'Both ends can not be unbounded'

				const start = startselect.node().selectedIndex==2 ? null : Number( start_input.node().value )
				const stop  = stopselect.node().selectedIndex==2  ? null : Number( stop_input.node().value )
				if( start!=null && stop!=null && start>=stop ) throw 'start must be lower than stop'

				if( startselect.node().selectedIndex == 2 ) {
					i.range.startunbounded = true
					delete i.range.start
				} else {
					delete i.range.startunbounded
					i.range.start = start
					i.range.startinclusive = startselect.node().selectedIndex == 0
				}
				if( stopselect.node().selectedIndex == 2 ) {
					i.range.stopunbounded = true
					delete i.range.stop
				} else {
					delete i.range.stopunbounded
					i.range.stop = stop
					i.range.stopinclusive = stopselect.node().selectedIndex == 0
				}
				i.htmlspan.text('Loading...')
				await tk.load()
				display_numeric_filter(tk, i, active_filter_div, row)
			} catch(e) {
				window.alert(e)
			}
		}
	})
}



function display_flag_filter(tk, i, active_filter_div, row){

	active_filter_div.selectAll('*').remove()

	i.htmlspan = active_filter_div.append('div')
		.attr('class','sja_filter_tag_btn')
		.style('background-color', '#ddd')
		.style('color','#000')
		.style('padding','3px 6px 5px 6px')
		.style('margin-right','1px')
		.style('font-size','.9em')
		.style('text-decoration','line-through')
		.text(
			(i._data ? '('+(i.remove_yes?i._data.count_yes:i._data.count_no)+') ' : '')
			+ (i.remove_no ? 'No' : 'Yes')
		)
		.on('click', async ()=>{
			i.remove_no = !i.remove_no
			i.remove_yes = !i.remove_yes
			i.htmlspan.text('Loading...')
			await tk.load()
			display_flag_filter(tk, i, active_filter_div, row)
		})
		return

	const cell = active_filter_div.append('div')
		.attr('class','sja_filter_tag_btn')
		.style('background-color', '#ddd')
		.style('color','#000')
		.style('padding','3px 6px 5px 6px')
		.style('margin-right','1px')
		.style('font-size','.9em')
		.on('click', async ()=>{
			i.remove_no = !i.remove_no
			i.remove_yes = !i.remove_yes
			i.htmlspan.text('Loading...')
			await tk.load()
			display_flag_filter(tk, i, active_filter_div, row)
		})

	cell.append('div')
		.style('display','inline-block')
		.style('background-color', '#ddd')
		.style('color','#000')
		.style('padding-left','3px')
		.style('text-decoration','line-through')
		.text( i.remove_no ? 'No' : 'Yes' )

	i.htmlspan = cell.append('div')
		.style('display','inline-block')
		.style('background-color', '#ddd')
		.style('color','#000')
		.style('padding-left','3px')
	if(i._data) {
		i.htmlspan.text('('+(i.remove_yes?i._data.count_yes:i._data.count_no)+' filtered)')
	}
}




function count_hiddencategories ( i ) {
// i is one of tk.info_fields[]
	let c = i.unannotated_ishidden ? 1 : 0
	for(const v of i.values) {
		if(v.ishidden) c++
	}
	return c
}
