import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import * as client from './client'
import * as common from './common'
import {init,add_searchbox_4term} from './mds.termdb'
import {make_termvalueselection_ui} from './mds.termdb.termvaluesetting.ui'
import {
	may_setup_numerical_axis,
	get_axis_label,
	get_axis_label_AFtest,
	} from './block.mds2.vcf.numericaxis'




/*

********************** EXPORTED
may_create_vcflegend_numericalaxis
********************** INTERNAL
showmenu_numericaxis
__update_legend
update_legend_by_AFtest
make_infofiled_ui
make_population_ui
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
					nm.inuse_AFtest = false
					nm.inuse_infokey = true
					nm.info_keys.forEach( i=> i.in_use=false )
					key.in_use = true
					update()
				})
		}
	}

	if( nm.AFtest && !nm.inuse_AFtest ) {
		// show this option when the data structure is available and is not in use
		menudiv.append('div')
			.style('margin-top','10px')
			.attr('class','sja_menuoption')
			.text( get_axis_label_AFtest() )
			.on('click', ()=>{
				nm.in_use=true
				nm.inuse_infokey = false
				nm.inuse_AFtest = true
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
				nm.inuse_infokey=false
				nm.inuse_AFtest=false
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
/*
returned function to be called at two occasions:
1. at initiating legend options
2. after changing menu option

no need to call this at customizing details for an axis type (AF cutoff, change terms etc)

will update menubutton content,
and settingholder content
but will not update track
*/

	return () => {

		may_setup_numerical_axis( tk )
		menubutton.html( get_axis_label(tk) + ' &#9660;' )

		settingholder.selectAll('*').remove()

		const nm = tk.vcf.numerical_axis
		if( !nm.in_use ) {
			// not in use
			return
		}

		if( nm.inuse_infokey ) {
			// do not show any controls for info field
			return
		}

		if( nm.inuse_AFtest ) {
			update_legend_by_AFtest( settingholder, tk, block )
			return
		}

		throw 'do not know what is in use for numerical axis'
		// exceptions are caught
	}
}



function update_legend_by_AFtest ( settingholder, tk, block ) {
	// works for arbitrary number of groups
	const table = settingholder.append('table')
		.style('border-spacing','5px')
		.style('border-collapse','separate')
		.style('border-left','solid 1px #ccc')

	const af = tk.vcf.numerical_axis.AFtest

	// one row for each group
	for( const [i, g] of af.groups.entries() ) {
		const tr = table.append('tr')
		const group_td = tr.append('td')

		group_td.append('div')
			.attr('class','sja_filter_tag_btn')
			.text('Group '+(i+1))
			.style('border-radius','6px')
			.style('background-color', '#ddd')
			.style('color','#000')
			.style('padding','6px')
			.style('margin','3px 5px')
			.style('font-size','.7em')
			.style('text-transform','uppercase')
			.on('click',()=>{
				menu_edit_AFtest_groups(tk, block, group_td)
			})

		legend_show_onegroup_AFtest( tk, block, g, tr.append('td') )
	}

	// a row of controls
	{
		const tr = table.append('tr')
		const td = tr.append('td')
			.attr('colspan',2)

		td.append('div')
			.text('Test Method')
			.style('border-radius','6px')
			.style('display', 'inline-block')
			.style('color','#000')
			.style('padding','6px')
			.style('margin','3px 5px')
			.style('font-size','.7em')
			.style('text-transform','uppercase')

		const testmethod = td.append('select')
			.style('margin-right','5px')
			.on('change',()=>{
				af.testby_AFdiff=false
				af.testby_fisher=false
				const i = testmethod.node().selectedIndex
				if(i==0) {
					af.testby_AFdiff=true
				} else if(i==1) {
					af.testby_fisher=true
				}
				tk.load()
			})
		testmethod.append('option')
			.text('Allele frequency difference')
		testmethod.append('option')
			.text('Fisher exact test')
		testmethod.node().selectedIndex = af.testby_AFdiff ? 0 : 1

		// may allow race adjustment
		// if(af.allowto_adjust_race) {
		// 	const id = Math.random()
		// 	af.adjust_race_checkbox = td.append('input')
		// 		.attr('type','checkbox')
		// 		.attr('id',id)
		// 		.property('disabled', (!af.groups.find(i=>i.is_termdb) || !af.groups.find(i=>i.is_population)) )
		// 		.property('checked', af.adjust_race)
		// 		.on('change',()=>{
		// 			af.adjust_race = !af.adjust_race
		// 			tk.load()
		// 		})
		// 	td.append('label')
		// 		.html('&nbsp;Adjust race background')
		// 		.attr('class','sja_clbtext')
		// 		.attr('for',id)
		// }

		// {
			// const button = td.append('button')
			// 	.text('Edit groups')
			// 	.style('margin-right','5px')
			// 	.on('click',()=>{
			// 		tk.legend.tip.clear()
			// 		menu_edit_AFtest_groups( tk, tk.legend.tip.d )
			// 		tk.legend.tip.showunder( button.node() )
			// 	})
		// }

	}
}




function menu_edit_AFtest_groups (tk, block, group_td) {
	
	// for each group, allow to change to a different type: is_termdb is_infofield is_population
	// for is_termdb, allow to define exact term-value setting
	// for is_infofield, display <select> for choosing one of af.allowed_infofields[]
	// for is_population, display <select> for choosing one of tk.populations[]


	// a menu for changing type/content of AFtest groups
	const af = tk.vcf.numerical_axis.AFtest

	const tip = tk.legend.tip
	tip.clear()
	tip.showunder( group_td.node(), -65 )

	// display each group from af.groups
	const table = tip.d.append('table')
		.style('border-spacing','15px')
		.style('border-collapse','separate')
		.style('border-left','solid 1px #ccc')

	// one row for each group
	for( const [i, g] of af.groups.entries() ) {
		const tr = table.append('tr')
		const group_td = tr.append('td')

		group_td.append('div')
			.text('Group '+(i+1))
			.style('display','inline-block')
			.style('border-radius','6px')
			.style('color','#000')
			.style('padding','6px')
			.style('margin','3px 5px')
			.style('font-size','.7em')
			.style('text-transform','uppercase')

		group_td.append('div')
			.text('edit')
			.attr('class','sja_filter_tag_btn')
			.style('display','inline-block')
			.style('border-radius','6px')
			.style('background-color', '#ddd')
			.style('color','#000')
			.style('padding','6px')
			.style('margin','3px 5px')
			.style('font-size','.7em')
			.style('text-transform','uppercase')
			.on('click',()=>{

			})

		legend_show_onegroup_AFtest( tk, block, g, tr.append('td') )
	}

	tip.d.append('div')
		.attr('margin-top','15px')
		.attr('class','sja_menuoption')
		.style('text-align','center')
		.text('APPLY')
		.on('click', ()=>{
			tip.hide()
		})
}



function legend_show_onegroup_AFtest ( tk, block, group, holder ) {
// display one AFtest group in legend
	if( group.is_termdb ) {
		make_termvalueselection_ui( holder, group, tk.mds, block.genome, true,
			async ()=>{
				await tk.load()
			}
		)
		return
	}
	if( group.is_infofield ) {
		make_infofiled_ui(group, holder, tk)
		return
	}
	if( group.is_population ) {
		make_population_ui(group, holder, tk)
		return
	}
	holder.text('Cannot display group in legend: unknown group type')
}


function make_infofiled_ui(group, holder, tk){

	const f = tk.info_fields.find( j=> j.key == group.key )

	// Group div
	const group_div = holder.append('div')
        .style('display', 'block')
		.style('padding','3px 10px')

	group.div_value_info = group_div.append('div')
        .style('display', 'inline-block')
        .style('opacity',.5)
		.style('font-size','.8em')
		.style('width','152px')
		.style('text-align','right')
		.text('VALUE OF')
		
	const info_field_div = group_div.append('div')
		.style('display','inline-block')
		
	update_info_field(info_field_div)


	function update_info_field(info_field_div){

		info_field_div.selectAll('*').remove()
		
		//hidden select and options on top of info_field_btn
		const info_select = info_field_div.append('select')
			.style('padding','3px 6px 3px 6px')
			.style('position','absolute')
			.style('opacity',0)

		const af = tk.vcf.numerical_axis.AFtest

		for( const info_field of af.allowed_infofields ){

			const info = tk.info_fields.find( j=> j.key == info_field.key )

			info_select.append('option')
				.attr('value',info_field.key)
				.text(info.label)
		}

		info_select.node().value = f.key

		//info field button with selected info field
		const info_field_btn = info_field_div.append('div')
			// .attr('class','sja_filter_tag_btn')
			.style('color','#FFF')
			.style('border-radius','6px')
			.style('background-color', '#674EA7')
			.style('padding','3px 6px 3px 6px')
			.style('margin-left', '5px')
			.style('font-size','1em')
			.text(f.label)

		info_select.on('change',async()=>{
			
			//change value of button 
			const new_info = tk.info_fields.find( j=> j.key == info_select.node().value )
			info_field_btn.text(new_info.label)

			//update gorup and load tk
			group.key = new_info.key
			await tk.load()
		})
	}
}


function make_population_ui(group, holder, tk){
	
	const p = tk.populations.find(i=>i.key==group.key)

	// Group div
	const group_div = holder.append('div')
        .style('display', 'block')
		.style('padding','3px 10px')

	group.div_value_info = group_div.append('div')
        .style('display', 'inline-block')
        .style('opacity',.5)
        .style('font-size','.8em')
		.text('ALLELE FREQUENCY OF')
		
	const population_div = group_div.append('div')
		.style('display','inline-block')
		
	update_population(population_div)

	const af = tk.vcf.numerical_axis.AFtest

	// may allow race adjustment
	if(af.allowto_adjust_race) {

		const id = Math.random()
		af.adjust_race_checkbox = group_div.append('input')
			.attr('type','checkbox')
			.attr('id',id)
			.style('margin-left','10px')
			.property('disabled', (!af.groups.find(i=>i.is_termdb) || !af.groups.find(i=>i.is_population)) )
			.property('checked', af.adjust_race)
			.on('change',()=>{
				af.adjust_race = !af.adjust_race
				tk.load()
			})

		group_div.append('label')
			.html('&nbsp;Adjust race background')
			.attr('class','sja_clbtext')
			.attr('for',id)
	}

	function update_population(population_div){

		population_div.selectAll('*').remove()
		
		//hidden select and options on top of population_btn
		const population_select = population_div.append('select')
			.style('padding','3px 6px 3px 6px')
			.style('position','absolute')
			.style('opacity',0)

		for( const population of tk.populations ){
			population_select.append('option')
				.attr('value',population.value)
				.text(population.label)
		}

		population_select.node().value = p.key

		const population_btn = population_div.append('div')
			// .attr('class','sja_filter_tag_btn')
			.style('color','#FFF')
			.style('border-radius','6px')
			.style('background-color', '#A64D79')
			.style('padding','3px 6px 3px 6px')
			.style('margin-left', '5px')
			.style('font-size','1em')
			.style('z-index','-1')
			.text(p.label)

		population_select.on('change',async()=>{
			
			//change value of button 
			const new_population = tk.populations.find( i=>i.key == population_select.node().value )
			population_btn.text(new_population.label)

			//update gorup and load tk
			group.key = new_population.key
			await tk.load()
		})
	}
}