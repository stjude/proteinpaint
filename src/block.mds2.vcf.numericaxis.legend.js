import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import * as client from './client'
import * as common from './common'
import * as termdb from './mds.termdb'
import * as termvaluesettingui from './mds.termdb.termvaluesetting.ui'
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
		menu_edit_AFtest_onegroup
		legend_show_AFtest_onegroup
			legend_show_AFtest_onegroup_termdb
			legend_show_AFtest_onegroup_infofield
			legend_show_AFtest_onegroup_population
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
		menubutton.html( get_axis_label(tk) + ' &#9662;' )

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






function AFtest_adjustsettingbygroup ( af ) {
	if( af.groups[0].is_population && af.groups[1].is_population ) {
		// both groups are populations, do not adjust race
		af.groups[0].adjust_race=false
		af.groups[1].adjust_race=false
	} else {
		// not both are population
		const popgroup = af.groups.find(i=>i.is_population)
		if( popgroup ) {
			// has pop group
			if( popgroup.allowto_adjust_race ) {
				// allowed to adjust race
				popgroup.adjust_race = af.groups.find(i=>i.is_termdb) != undefined
			} else {
				delete popgroup.adjust_race
			}
		}
	}
	if( af.testby_fisher ) {
		// if using fisher test, do not allow info group
		if( af.groups.find(i=>i.is_infofield) ) {
			af.testby_fisher = false
			af.testby_AFdiff = true
		}
	}
}




function update_legend_by_AFtest ( settingholder, tk, block ) {
	// works for arbitrary number of groups

	const af = tk.vcf.numerical_axis.AFtest

	AFtest_adjustsettingbygroup( af )

	const table = settingholder.append('table')
		.style('border-spacing','5px')
		.style('border-collapse','separate')
		.style('border-left','solid 1px #ccc')

	// one row for each group
	for( const [i, group] of af.groups.entries() ) {
		const tr = table.append('tr')
		const td1 = tr.append('td')
		td1.append('div')
			.attr('class','sja_filter_tag_btn')
			.text('Group '+(i+1))
			.style('white-space','nowrap')
			.style('border-radius','6px')
			.style('background-color', '#ddd')
			.style('color','#000')
			.style('padding','6px')
			.style('margin','3px 5px')
			.style('font-size','.7em')
			.style('text-transform','uppercase')
			.on('click',()=>{
				menu_edit_AFtest_onegroup(tk, block, group, settingholder, d3event.target)
			})

		group.dom = {
			td2: tr.append('td').style('opacity',.5).style('font-size','.8em'),
			td3: tr.append('td'),
		}

		legend_show_AFtest_onegroup( tk, block, group )
	}

	// extra rows for controls
	{
		const tr = table.append('tr')
		const td = tr.append('td')
			.attr('colspan',3)

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
				may_setup_numerical_axis(tk)
				tk.load()
			})
		testmethod.append('option')
			.text('Value difference')
		const fisher_option = testmethod.append('option')
			.text('Fisher exact test')
		
		// if one of the groups is info_field then disable fisher test	
		if(af.groups.find(i=>i.is_infofield)){
			fisher_option.property('disabled','true')
		}
		testmethod.node().selectedIndex = af.testby_AFdiff ? 0 : 1
	}
}




function menu_edit_AFtest_onegroup (tk, block, group, settingholder, clickeddom) {
// a menu for changing type/content of one group from AFtest

	const af = tk.vcf.numerical_axis.AFtest

	const tip = tk.legend.tip.clear()
	const table_tr = tip.d.append('table')
		.style('margin','13px')
		.style('border-spacing','0px')
		.style('border-collapse','separate')
		.append('tr')

	const tabs_div = table_tr.append('td')
		.style('vertical-align','top')
		.style('padding','6px 0 6px 6px')

	const selection_div = table_tr.append('td')
		.style('vertical-align','top')
		.style('border-left','1px solid #ccc')
		.style('padding','6px')

	let termdb_tab, // tabs
		infofield_tab,
		population_tab,
		termdb_div, // div
		infofield_div,
		population_div,
		termdb_flag=false, // flags to show options for each tab
		infofield_flag=false,
		population_flag=false
	
	// detect termdb/info/population availability and show options
	// clinical dictionary tab	
	if(tk.mds){
		termdb_tab = make_one_tab('Clinical Dictionary','#4888BF',tabs_div)
		termdb_flag = true
		termdb_div = selection_div.append('div')
		const obj = {
			genome: block.genome,
			mds: tk.mds,
			div: termdb_div,
			default_rootterm: {},
			termfilter:{no_display:true},
			modifier_barchart_selectbar: {
				callback: (result) => {
					tip.hide()
					update_group_term(result, group)
					_updatetk()
				}
			}
		}
		termdb.init(obj)
	}

	// value field tab
	if( af.allowed_infofields ){
		infofield_tab = make_one_tab('Value field','#674EA7',tabs_div)
		if(!termdb_flag) infofield_flag=true
		infofield_div = selection_div.append('div')
		for( const i of af.allowed_infofields ){
			if( group.is_infofield && group.key==i.key ) {
				// group is currently this one
				continue
			}
			const info = tk.info_fields.find( j=> j.key == i.key )
			infofield_div.append('div')
				.attr('class','sja_menuoption')
				.text(info.label)
				.on('click', async()=>{
					tip.hide()
					delete group.is_termdb
					delete group.is_population
					group.is_infofield = true
					group.key = i.key
					_updatetk()
				})
		}
	}

	// poplulation tab
	if( tk.populations ) {
		population_tab = make_one_tab('Poplulation','#A64D79',tabs_div)
		if(!termdb_flag && !infofield_flag) population_flag=true
		population_div = selection_div.append('div')
		for( const population of tk.populations ){
			if( group.is_population && group.key==population.key ) {
				continue
			}
			population_div.append('div')
				.attr('class','sja_menuoption')
				.text(population.label)
				.on('click', async()=>{
					tip.hide()
					delete group.is_termdb
					delete group.is_infofield
					group.is_population = true
					group.key = population.key
					group.allowto_adjust_race = population.allowto_adjust_race
					group.adjust_race = population.adjust_race
					_updatetk()
				})
		}
	}

	update_selection_div()

	tip.showunder( clickeddom )


	// click on tab
	if(termdb_tab){
		termdb_tab.on('click', ()=>{
			termdb_flag = true
			infofield_flag = false
			population_flag = false
			update_selection_div()
		})
	}

	if(infofield_tab){
		infofield_tab.on('click', ()=>{
			infofield_flag = true
			termdb_flag = false
			population_flag = false
			update_selection_div()
		})
	}

	if(population_tab){
		population_tab.on('click', ()=>{
			population_flag = true
			termdb_flag = false
			infofield_flag = false
			update_selection_div()
		})
	}

	function update_selection_div(){
		if(termdb_tab){
			termdb_tab.classed('sja_menuoption', !termdb_flag)
			termdb_div.style('display', termdb_flag ?'block':'none')
		}
		if(infofield_tab){
			infofield_tab.classed('sja_menuoption', !infofield_flag)
			infofield_div.style('display', infofield_flag ?'block':'none')
		}
		if(population_tab){
			population_tab.classed('sja_menuoption', !population_flag)
			population_div.style('display', population_flag ?'block':'none')
		}
	}
	
	function make_one_tab(tab_name, tab_color, holder){

		const tab = holder.append('div')
			.style('display','block')
			.style('margin','0px 0px 1px 0px')
			.style('padding','4px 8px')

		tab.append('div')
			.style('display','inline-block')
			.style('width', '12px')
			.style('height', '12px')
			.style('background-color', tab_color)

		tab.append('div')
			.style('display','inline-block')
			.style('margin-left','10px')
			.text(tab_name)

		return tab
	}

	function update_group_term(result, group){

        // create new array with updated terms
		let new_terms = []
		// following should be moved to termvaluesettingui and be exported as a function
		for(const [j, bar_term] of result.terms.entries()){
			const new_term = {
				values: [{key: bar_term.value, label: bar_term.label}],
				term: {
					id: bar_term.term.id,
					name: bar_term.term.name
				} 
			}
			new_term.isnot = false

			if(bar_term.term.iscategorical) new_term.term.iscategorical = bar_term.term.iscategorical
			if(bar_term.term.isfloat) {
				new_term.term.isfloat = bar_term.term.isfloat
				new_term.range = bar_term.range
			}
			if(bar_term.term.isinteger) {
				new_term.term.isinteger = bar_term.term.isinteger
				new_term.range = bar_term.range
			}

			new_terms.push(new_term)
		}

		delete group.key
		delete group.is_infofield
		delete group.is_population
		group.is_termdb = true
		group.terms = new_terms
	}

	async function _updatetk () {
		settingholder.selectAll('*').remove()
		update_legend_by_AFtest(settingholder, tk, block)
		group.dom.td2.text('UPDATING...')
		may_setup_numerical_axis( tk )
		await tk.load()
		group.dom.td2.text( (group.is_termdb || group.is_population) ? 'ALLELE FREQUENCY OF' : 'VALUE OF' )
	}
}



function legend_show_AFtest_onegroup ( tk, block, group, tr ) {
/* display one AFtest group in legend
*/
	if( group.is_termdb ) {
		group.dom.td2.text('ALLELE FREQUENCY OF')
		legend_show_AFtest_onegroup_termdb(group, group.dom.td3, tk, block)
		return
	}
	if( group.is_infofield ) {
		group.dom.td2.text('VALUE OF')
		legend_show_AFtest_onegroup_infofield(group, group.dom.td3, tk)
		return
	}
	if( group.is_population ) {
		group.dom.td2.text('ALLELE FREQUENCY OF')
		legend_show_AFtest_onegroup_population(group, group.dom.td3, tk)
		return
	}
	group.dom.td3.text('Unknown group type!')
}




function legend_show_AFtest_onegroup_termdb ( group, holder, tk, block ) {
	termvaluesettingui.display(
		holder,
		group,
		tk.mds,
		block.genome,
		true,
		async ()=>{
			await tk.load()
		}
	)
	// n=? handle and for porting to term tree filter
	group.dom.samplehandle = holder.append('span')
	.style('margin-left','15px')
	.style('opacity','.6')
	.attr('class','sja_clbtext')
	.text('Loading...')
	.on('click',()=>{
		// click label to embed tree
		const filterlst = JSON.parse( JSON.stringify(group.terms) ) // apply terms of this group as filter
		if( tk.sample_termfilter ) {
			// apply this filter too
			for(const t of tk.sample_termfilter) filterlst.push( JSON.parse(JSON.stringify(t)) )
		}
		tk.legend.tip.clear()
			.showunder(group.dom.samplehandle.node())
		termdb.init({
			genome: block.genome,
			mds: tk.mds,
			div: tk.legend.tip.d,
			default_rootterm: {},
			termfilter:{
				terms: filterlst,
				no_display:true
			}
		})
	})
}




function legend_show_AFtest_onegroup_infofield (group, holder, tk){
// group is based on an info field

	const f = tk.info_fields.find( j=> j.key == group.key )

	const info_field_div = holder.append('div')
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
			.html(f.label+' &#9662;')

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






function legend_show_AFtest_onegroup_population ( group, holder, tk ){
	
	const p = tk.populations.find(i=>i.key==group.key)

	const population_div = holder.append('div')
		.style('display','inline-block')
		
	update_population(population_div)

	const af = tk.vcf.numerical_axis.AFtest
	const p_select = af.groups.find(i=>i.key==group.key)

	// may allow race adjustment
	if(p_select.allowto_adjust_race) {

		const id = Math.random()
		af.adjust_race_checkbox = holder.append('input')
			.attr('type','checkbox')
			.attr('id',id)
			.style('margin-left','10px')
			.property('disabled', (!af.groups.find(i=>i.is_termdb) || !af.groups.find(i=>i.is_population)) )
			.property('checked', p_select.adjust_race)
			.on('change',()=>{
				p_select.adjust_race = !p_select.adjust_race
				tk.load()
			})

		holder.append('label')
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
			.style('color','#FFF')
			.style('border-radius','6px')
			.style('background-color', '#A64D79')
			.style('padding','3px 6px 3px 6px')
			.style('margin-left', '5px')
			.style('font-size','1em')
			.style('z-index','-1')
			population_btn.html(p.label+ (tk.populations.length>1 ? ' &#9662;':''))

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
