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

	// create_group_legend(settingholder, tk.vcf.numerical_axis.termdb2groupAF.group1, tk, block)
	// create_group_legend(settingholder, tk.vcf.numerical_axis.termdb2groupAF.group2, tk, block)
	make_termvalueselection_ui(settingholder, tk.vcf.numerical_axis.termdb2groupAF.group1, tk, block.genome)
	make_termvalueselection_ui(settingholder, tk.vcf.numerical_axis.termdb2groupAF.group2, tk, block.genome)

}


function update_legend_by_ebgatest( settingholder, tk, block ) {
	
	// create_group_legend(settingholder, tk.vcf.numerical_axis.ebgatest, tk, block)
	make_termvalueselection_ui(settingholder, tk.vcf.numerical_axis.ebgatest, tk, block.genome)

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
