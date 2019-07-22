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
AFtest_groupname
********************** INTERNAL
showmenu_numericaxis
__update_legend
	AFtest_makeui
		AFtest_updatesetting_bygroupselection
		AFtest_editgroupmenu
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






function AFtest_updatesetting_bygroupselection ( tk ) {
/*
update AFtest setting by group selection
will also flip <select>

call at:
1. end of AFtest_makeui
2. after changing population
   as different pops may allow termfilter or not

toggle following flags, do not alter doms:
1. population.adjust_race
2. af.testby_fisher, by_AFddiff
3. af.termfilter.inuse, disabled

*/
	const af = tk.vcf.numerical_axis.AFtest

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
			af.dom.testmethod_option_fisher.property('disabled',true)
		} else {
			// do not disable
			af.dom.testmethod_option_fisher.property('disabled',false)
		}
	}
	af.dom.testmethod_select.node().selectedIndex = af.testby_AFdiff ? 0 : 1

	if( af.termfilter ) {
		// termfilter available
		// if condition does not apply then turn off and disable
		af.termfilter.disabled = false
		if( !af.groups.find( i=> i.is_termdb ) ) {
			// no termdb group
			// must has at least one population that supports it
			if( !af.groups.find( i=> {
				if( i.is_population ) {
					const g = tk.populations.find(g=>g.key==i.key)
					if(g && g.termfilter) return i
				}
				return
			})) {
				// no pop either
				af.termfilter.inuse = false
				af.termfilter.disabled = true
			}
		}
		af.dom.termfilter_select.property('disabled', af.termfilter.disabled)
		af.dom.termfilter_select.node().selectedIndex = af.termfilter.inuse ? 1+af.termfilter.value_index : 0
	}
}




function AFtest_makeui ( settingholder, tk, block ) {
/*
make ui for AFtest in legend
attaches doms to af.dom{}, and group.dom{}
setting conflicts are resolved after doms are made
*/
	const af = tk.vcf.numerical_axis.AFtest
	af.dom = {}

	const table = settingholder.append('table') // 3 columns
		.style('border-spacing','5px')
		.style('border-collapse','separate')
		.style('border-left','solid 1px #ccc')

	// one row for each group
	for( const [i, group] of af.groups.entries() ) {
		group.dom = {}
		const tr = table.append('tr')
		group.dom.td1 = tr.append('td')
			.append('div')
			.attr('class','sja_filter_tag_btn')
			.text('GROUP '+(i+1))
			.style('white-space','nowrap')
			.style('border-radius','6px')
			.style('background-color', '#ddd')
			.style('color','#000')
			.style('padding','6px')
			.style('margin','3px 5px')
			.style('font-size','.7em')
			.on('click',()=>{
				AFtest_editgroupmenu(tk, block, group, settingholder)
			})

		group.dom.td2 = tr.append('td')
			.style('opacity',.5)
			.style('font-size','.8em')
			.style('white-space','nowrap')
		group.dom.td3 = tr.append('td')

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
		af.dom.testmethod_select = td.append('select')
			.on('change',()=>{
				af.testby_AFdiff=false
				af.testby_fisher=false
				const i = af.dom.testmethod_select.node().selectedIndex
				if(i==0) {
					af.testby_AFdiff=true
				} else if(i==1) {
					af.testby_fisher=true
				}
				// must call this to reset axis label after changing test method
				may_setup_numerical_axis(tk)
				tk.load()
			})
		af.dom.testmethod_select
			.append('option')
			.text('Value difference')
		af.dom.testmethod_option_fisher = af.dom.testmethod_select
			.append('option')
			.text('Fisher exact test')
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
		af.dom.termfilter_select = select
		if( af.termfilter.disabled ) {
			select.property('disabled',true)
		}
		select.append('option').text('No restriction')
		for(const v of af.termfilter.values) {
			select.append('option').text(v.label || v.key)
		}
	}

	AFtest_updatesetting_bygroupselection( tk )
}




function AFtest_editgroupmenu (tk, block, group, settingholder) {
/*
a menu for changing type/content of one group from AFtest

groupindex:
	array index of AFtest.groups[]

*/
	const af = tk.vcf.numerical_axis.AFtest
	const tip = tk.legend.tip.clear()

	const tabs = []

	if(tk.mds && tk.mds.termdb){
		tabs.push({
			label:'<span style="background:'+color_termdb+';border-radius:4px">&nbsp;&nbsp;</span> Clinical info',
			callback: async (div)=>{
				let filter = []
				if( tk.sample_termfilter ) {
					filter = JSON.parse(JSON.stringify(tk.sample_termfilter))
				}
				const v = may_get_param_AFtest_termfilter( tk )
				if(v) filter.push(v)
				const obj = {
					genome: block.genome,
					mds: tk.mds,
					div,
					default_rootterm: {},
					modifier_barchart_selectbar: {
						callback: (result) => {
							tip.hide()
							group.terms = result.terms
							delete group.key
							delete group.is_infofield
							delete group.is_population
							group.is_termdb = true
							_updatetk()
						}
					}
				}
				if(filter.length) obj.termfilter = {terms: filter}
				await termdbinit(obj)
			}
		})
	}

	if( af.allowed_infofields ){
		tabs.push({
			label:'<span style="background:'+color_infofield+';border-radius:4px">&nbsp;&nbsp;</span> Numerical value',
			callback: (div)=>{
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
			callback: (div)=>{
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

	tip.showunder( group.dom.td1.node() )

	async function _updatetk () {
		settingholder.selectAll('*').remove()
		AFtest_makeui(settingholder, tk, block)
		group.dom.td2.text('UPDATING...')
		may_setup_numerical_axis( tk )
		await tk.load()
		group.dom.td2.text( (group.is_termdb || group.is_population) ? 'ALLELE FREQUENCY OF' : 'VALUE OF' )
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

	const [select, btn] = client.make_select_btn_pair( holder )

	select.on('change',async()=>{
		const value = select.node().value
		const i = tk.info_fields.find( j=> j.key == value )
		group.key = value
		btn.html( (i ? i.label : value ) + '&nbsp; <span style="font-size:.7em">LOADING...</span>')
		await tk.load()
		btn.html( (i ? i.label : value) + ' &#9662;' )
		select.style('width', btn.node().offsetWidth+'px')
	})
	for( const i of tk.vcf.numerical_axis.AFtest.allowed_infofields ){
		const i2 = tk.info_fields.find( j=> j.key == i.key )
		select.append('option')
			.attr('value',i.key)
			.text( i2 ? i2.label : i.key )
	}
	select.node().value = group.key

	const f = tk.info_fields.find( j=> j.key == group.key )
	btn
		.style('color','#FFF')
		.style('border-radius','6px')
		.style('background-color', color_infofield)
		.style('padding','3px 6px 3px 6px')
		.style('margin-left', '5px')
		.html(f.label+' &#9662;')
	select.style('width', btn.node().offsetWidth+'px')
}






function AFtest_showgroup_population ( group, tk ) {
	const holder = group.dom.td3.append('span')

	const p = tk.populations.find(i=>i.key==group.key)
	const af = tk.vcf.numerical_axis.AFtest

	const [select, btn] = client.make_select_btn_pair( holder )

	select.on('change', async()=>{
		const value = select.node().value
		const p = tk.populations.find( i=>i.key == value )
		group.key = value
		group.allowto_adjust_race = p.allowto_adjust_race
		group.adjust_race = p.adjust_race
		update_adjust_race(adjust_race_div)
		AFtest_updatesetting_bygroupselection( tk )
		btn.html(p.label+' &nbsp;<span style="font-size:.7em">LOADING...</span>')
		await tk.load()
		btn.html( p.label+ (tk.populations.length>1 ? ' &#9662;':''))
		select.style('width', btn.node().offsetWidth+'px')
	})
	for( const p of tk.populations ){
		select.append('option')
			.attr('value',p.key)
			.text(p.label)
	}
	select.node().value = group.key

	btn
		.style('color','#FFF')
		.style('border-radius','6px')
		.style('background-color', color_population)
		.style('padding','3px 6px 3px 6px')
		.style('margin-left', '5px')
		.html( p.label+ (tk.populations.length>1 ? ' &#9662;':''))

	select.style('width', btn.node().offsetWidth+'px')

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




export function AFtest_groupname (tk, gi) {
	const g = tk.vcf.numerical_axis.AFtest.groups[gi]
	if(!g) throw 'index out of bound'
	if( g.is_infofield ) {
		const i = tk.info_fields.find( i=> i.key == g.key )
		return i ? i.label : g.key
	}
	if( g.is_population ) {
		const i = tk.populations.find( i=> i.key == g.key )
		return i ? i.label : g.key
	}
	if( g.is_termdb ) {
		const otherg = tk.vcf.numerical_axis.AFtest.groups[ gi==0 ? 1 : 0 ]
		if( otherg.is_termdb ) {
			// both termdb
			return 'Group '+(gi+1)
		}
		// only g is termdb
		const term1name = g.terms[0].term.name
		if( term1name.length <= 20 ) return term1name
		return term1name.substr(0,17)+'...'
	}
	throw 'unknown AFtest group type'
}
