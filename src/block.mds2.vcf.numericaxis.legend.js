import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import * as client from './client'
import * as common from './common'
import {init as termdbinit} from './mds.termdb'
import {display as tvs_display} from './mds.termdb.termvaluesetting.ui'
import {
	may_setup_numerical_axis,
	get_axis_label,
	get_axis_label_AFtest,
	may_get_param_AFtest_termfilter
	} from './block.mds2.vcf.numericaxis'




/*

********************** EXPORTED
may_create_vcflegend_numericalaxis
********************** INTERNAL
showmenu_numericaxis
__update_legend
	AFtest_makeui
		AFtest_update_flag
		menu_edit_AFtest_onegroup
		AFtest_showgroup
			AFtest_showgroup_termdb
			AFtest_showgroup_infofield
			AFtest_showgroup_population
*/


// hardcoded colors
const color_infofield = '#674EA7'
const color_population = '#A64D79'
const color_termdb = '#4888BF'




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
			AFtest_makeui( settingholder, tk, block )
			return
		}

		throw 'do not know what is in use for numerical axis'
		// exceptions are caught
	}
}






function AFtest_update_flag ( af ) {
/*
after selecting groups,
update AFtest setting flags based on what groups are selected

toggle following flags, do not alter doms:
- population.adjust_race
- af.testby_fisher
- af.testby_AFdiff
- af.termfilter.inuse
*/
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
	if( af.termfilter ) {
		// termfilter available
		// if condition does not apply then turn off and disable
		af.termfilter.disabled = false
		if( !af.groups.find( i=> i.is_termdb ) ) {
			// no termdb group
			// must has at least one population that supports it
			if( !af.groups.find( i=>{ if(i.is_population && i.termfilter) return i }) ) {
				// no pop either
				af.termfilter.inuse = false
				af.termfilter.disabled = true
			}
		}
	}
}




function AFtest_makeui ( settingholder, tk, block ) {
/*
make ui for AFtest in legend
do not alter any flags, as they are handled in AFtest_update_flag
*/

	const af = tk.vcf.numerical_axis.AFtest

	AFtest_update_flag( af )

	const table = settingholder.append('table') // 3 columns
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

		AFtest_showgroup( tk, block, group )
	}

	// row for test method
	{
		const tr = table.append('tr')
		const td = tr.append('td').attr('colspan',3)
		td.append('span')
			.text('TEST METHOD')
			.style('padding','6px')
			.style('margin','3px 5px')
			.style('font-size','.7em')
		const select = td.append('select')
			.on('change',()=>{
				af.testby_AFdiff=false
				af.testby_fisher=false
				const i = select.node().selectedIndex
				if(i==0) {
					af.testby_AFdiff=true
				} else if(i==1) {
					af.testby_fisher=true
				}
				// must call this to reset axis label after changing test method
				may_setup_numerical_axis(tk)
				tk.load()
			})
		select.append('option').text('Value difference')
		{
			const o = select.append('option').text('Fisher exact test')
			// fisher test option will be disabled if there is info field
			if( af.groups.find(i=> i.is_infofield) ) {
				o.property('disabled',true)
			}
		}
		select.node().selectedIndex = af.testby_AFdiff ? 0 : 1
	}

	if( af.termfilter ) {
		// termfilter: row with <select> for restricting to a category
		const tr = table.append('tr')
		const td = tr.append('td').attr('colspan',3)
		td.append('span')
			.text('RESTRICT TO')
			.style('padding','6px')
			.style('margin','3px 5px')
			.style('font-size','.7em')
		const select = td.append('select')
			.on('change', async ()=>{
				const i = select.node().selectedIndex
				if(i==0) {
					af.termfilter.inuse=false
				} else {
					af.termfilter.inuse=true
					af.termfilter.value_index = i-1
				}
				/*
				must remake any termdb group
				as legend update() will not remake AFtest ui,
				and the tvs ui scopes tvslst and will not update unless made anew
				*/
				for(const g of af.groups) {
					if( g.is_termdb ) {
						g.dom.td3.selectAll('*').remove()
						AFtest_showgroup_termdb(g, tk, block)
					}
				}
				select.property('disabled',true)
				await tk.load()
				select.property('disabled',false)
			})
		if( af.termfilter.disabled ) {
			select.property('disabled',true)
		}
		select.append('option').text('No restriction')
		for(const v of af.termfilter.values) {
			select.append('option').text(v.label || v.key)
		}
		select.node().selectedIndex = af.termfilter.inuse ? 1+af.termfilter.value_index : 0
	}
}




function menu_edit_AFtest_onegroup (tk, block, group, settingholder, clickeddom) {
// a menu for changing type/content of one group from AFtest

	const af = tk.vcf.numerical_axis.AFtest
	const tip = tk.legend.tip.clear()

	const tabs = []

	if(tk.mds && tk.mds.termdb){
		tabs.push({
			label:'<span style="background:'+color_termdb+';border-radius:4px">&nbsp;&nbsp;</span> Clinical info',
			callback: async (div)=>{
				const obj = {
					genome: block.genome,
					mds: tk.mds,
					div,
					default_rootterm: {},
					modifier_barchart_selectbar: {
						callback: (result) => {
							tip.hide()
							update_group_term(result, group)
							_updatetk()
						}
					}
				}
				if( tk.sample_termfilter ) {
					obj.termfilter = {
						terms: JSON.parse(JSON.stringify(tk.sample_termfilter))
					}
				}
				await termdbinit(obj)
			}
		})
	}

	if( af.allowed_infofields ){
		tabs.push({
			label:'<span style="background:'+color_infofield+';border-radius:4px">&nbsp;&nbsp;</span> Numerical value',
			show_immediate: (div)=>{
				for( const i of af.allowed_infofields ){
					if( group.is_infofield && group.key==i.key ) {
						// group is currently this one
						continue
					}
					const info = tk.info_fields.find( j=> j.key == i.key )
					div.append('div')
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
		})
	}

	if( tk.populations ) {
		tabs.push({
			label:'<span style="background:'+color_population+';border-radius:4px">&nbsp;&nbsp;</span> Population',
			show_immediate: (div)=>{
				for( const population of tk.populations ){
					if( group.is_population && group.key==population.key ) {
						continue
					}
					div.append('div')
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
		})
	}


	client.tab2box( tip.d.append('div').style('margin','13px'), tabs )
	for(const t of tabs) {
		if(t.show_immediate) t.show_immediate( t.box )
	}

	tip.showunder( clickeddom )

	async function _updatetk () {
		settingholder.selectAll('*').remove()
		AFtest_makeui(settingholder, tk, block)
		group.dom.td2.text('UPDATING...')
		may_setup_numerical_axis( tk )
		await tk.load()
		group.dom.td2.text( (group.is_termdb || group.is_population) ? 'ALLELE FREQUENCY OF' : 'VALUE OF' )
	}


	function update_group_term(result, group){

        // create new array with updated terms
		let new_terms = []

		for(const [i, bar_term] of result.terms.entries()){
			new_terms.push(bar_term)
		}

		delete group.key
		delete group.is_infofield
		delete group.is_population
		group.is_termdb = true
		group.is_infofield = false
		group.is_population = false

		group.terms = new_terms
	}
}



function AFtest_showgroup ( tk, block, group ) {
/* display one AFtest group in legend
*/
	if( group.is_termdb ) {
		group.dom.td2.text('ALLELE FREQUENCY OF')
		AFtest_showgroup_termdb(group, tk, block)
		return
	}
	if( group.is_infofield ) {
		group.dom.td2.text('VALUE OF')
		AFtest_showgroup_infofield(group, tk)
		return
	}
	if( group.is_population ) {
		group.dom.td2.text('ALLELE FREQUENCY OF')
		AFtest_showgroup_population(group, tk)
		return
	}
	group.dom.td3.text('Unknown group type!')
}




function AFtest_showgroup_termdb ( group, tk, block ) {
	const tvslst = []
	if( tk.sample_termfilter ) {
		tvslst.push( ...JSON.parse(JSON.stringify(tk.sample_termfilter)) )
	}
	const v = may_get_param_AFtest_termfilter( tk )
	if( v ) tvslst.push(v)

	tvs_display(
		group.dom.td3,
		group,
		tk.mds,
		block.genome,
		tvslst,
		async ()=>{
			await tk.load()
		}
	)

	// "n=?, view stats" handle and for porting to term tree filter
	group.dom.samplehandle = group.dom.td3
	.append('span')
	.style('margin-left','15px')
	.style('opacity','.6')
	.attr('class','sja_clbtext')
	.text('Loading...')
	.on('click',()=>{
		// click label to embed tree
		const filterlst = JSON.parse( JSON.stringify(group.terms) ) // apply terms of this group as filter
		filterlst.push( ...tvslst )
		if( tk.sample_termfilter ) {
			filterlst.push( ...JSON.parse(JSON.stringify(tk.sample_termfilter)) )
		}
		// must not reuse tvslst above as AFtest.termfilter may update
		const v = may_get_param_AFtest_termfilter( tk )
		if( v ) filterlst.push( v )

		tk.legend.tip.clear()
			.showunder(group.dom.samplehandle.node())
		termdbinit({
			genome: block.genome,
			mds: tk.mds,
			div: tk.legend.tip.d,
			default_rootterm: {},
			termfilter:{
				terms: filterlst,
			}
		})
	})
}




function AFtest_showgroup_infofield (group, tk) {
// group is based on an info field

	const holder = group.dom.td3.append('span')

	const f = tk.info_fields.find( j=> j.key == group.key )

	//hidden select and options
	const select = holder.append('select')
		.style('padding','3px 6px 3px 6px')
		.style('position','absolute')
		.style('opacity',0)
		.on('change',async()=>{
			const value = select.node().value
			const i = tk.info_fields.find( j=> j.key == value )
			group.key = value
			info_field_btn.html( (i ? i.label : value ) + '&nbsp; <span style="font-size:.7em">LOADING...</span>')
			await tk.load()
			info_field_btn.text( i ? i.label : value )
		})

	for( const i of tk.vcf.numerical_axis.AFtest.allowed_infofields ){
		const i2 = tk.info_fields.find( j=> j.key == i.key )
		select.append('option')
			.attr('value',i.key)
			.text( i2 ? i2.label : i.key )
	}

	select.node().value = group.key

	//info field button with selected info field
	const info_field_btn = holder.append('span')
		.style('color','#FFF')
		.style('border-radius','6px')
		.style('background-color', color_infofield)
		.style('padding','3px 6px 3px 6px')
		.style('margin-left', '5px')
		.html(f.label+' &#9662;')
}






function AFtest_showgroup_population ( group, tk ) {
	const holder = group.dom.td3.append('span')

	const p = tk.populations.find(i=>i.key==group.key)
	const af = tk.vcf.numerical_axis.AFtest

	const select = holder.append('select')
		.style('padding','3px 6px 3px 6px')
		.style('position','absolute')
		.style('opacity',0)
		.on('change', async()=>{
			const value = select.node().value
			const p = tk.populations.find( i=>i.key == value )
			group.key = value
			group.allowto_adjust_race = p.allowto_adjust_race
			group.adjust_race = p.adjust_race
			update_adjust_race(adjust_race_div)
			population_btn.html(p.label+' &nbsp;<span style="font-size:.7em">LOADING...</span>')
			await tk.load()
			population_btn.text(p.label)
		})

	for( const p of tk.populations ){
		select.append('option')
			.attr('value',p.key)
			.text(p.label)
	}

	select.node().value = group.key

	const population_btn = holder.append('span')
		.style('color','#FFF')
		.style('border-radius','6px')
		.style('background-color', color_population)
		.style('padding','3px 6px 3px 6px')
		.style('margin-left', '5px')

	population_btn.html( p.label+ (tk.populations.length>1 ? ' &#9662;':''))

	const adjust_race_div = holder.append('span')

	update_adjust_race(adjust_race_div)

	function update_adjust_race(adjust_race_div){

		adjust_race_div.selectAll('*').remove()

		const p = af.groups.find(i=>i.key==group.key)

		if(p.allowto_adjust_race) {
			const label = adjust_race_div.append('label')
			label.append('input')
				.attr('type','checkbox')
				.style('margin-left','10px')
				.property('disabled', (!af.groups.find(i=>i.is_termdb) || !af.groups.find(i=>i.is_population)) )
				.property('checked', p.adjust_race)
				.on('change', async ()=>{
					p.adjust_race = !p.adjust_race
					lab.html('&nbsp;Loading...')
					await tk.load()
					lab.html('&nbsp;Adjust race background')
				})
			const lab = label
				.append('span')
				.html('&nbsp;Adjust race background')
		}
	}
}
