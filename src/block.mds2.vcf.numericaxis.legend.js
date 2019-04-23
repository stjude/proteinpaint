import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import * as client from './client'
import * as common from './common'
import * as mds2 from './block.mds2'
import {may_setup_numerical_axis} from './block.mds2.vcf.numericaxis'








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

	const menubutton = td.append('button')
		.style('margin','0px 10px')

	// following menubutton, show settings folder

	const settingholder = td.append('div')
		.style('display','inline-block')

	const update_legend_func = __update_legend( menubutton, settingholder, tk, block )

	update_legend_func()

	menubutton.on('click', ()=> showmenu_numericaxis( menubutton, tk, block, update_legend_func ) )

		/*
		.on('change', async ()=>{

			const tt = d3event.target

			if( tt.selectedIndex == nm.info_keys.length ) {
				nm.in_use = false
			} else {
				for(const e of nm.info_keys) e.in_use=false
				nm.info_keys[ tt.selectedIndex ].in_use = true
				may_setup_numerical_axis( tk )
			}

			tt.disabled=true


			tt.disabled=false
			update_filteroption()
		})
		*/
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
			menudiv.append('div')
				.text(
					(tk.mds && tk.mds.mutationAttribute && tk.mds.mutationAttribute.attributes[ key.key ])
					?
					tk.mds.mutationAttribute.attributes[ key.key ].label
					:
					key.key
				)
				.attr('class','sja_menuoption')
				.on('click', async ()=>{
					// selected an info key
					tk.legend.tip.hide()
					nm.inuse_termdb2groupAF = false
					nm.inuse_infokey = true
					nm.info_keys.forEach( i=> i.in_use=false )
					key.in_use = true
					menubutton.node().disabled = true
					await mds2.loadTk( tk, block )
					menubutton.node().disabled = false
					update_legend_func()
				})
		}
	}

	if( nm.termdb2groupAF &&  !nm.inuse_termdb2groupAF ) {
		// show this option when the data structure is available and is not in use
		menudiv.append('div')
			.attr('class','sja_menuoption')
			.text('Two group comp') // TODO update text to make it more informative
			.on('click', async ()=>{
				tk.legend.tip.hide()
				nm.inuse_infokey = false
				nm.inuse_termdb2groupAF = true
				menubutton.node().disabled = true
				await mds2.loadTk( tk, block )
				menubutton.node().disabled = false
				update_legend_func()
			})
	}

	tk.legend.tip.showunder( menubutton.node() )
}




function __update_legend ( menubutton, settingholder, tk, block ) {

	return () => {

		/*
		returned function to be called at two occasions:
		1. at initiating legend options
		2. after changing menu option

		will update menubutton content,
		and settingholder content
		but will not update track
		*/

		settingholder.selectAll('*').remove()

		const nm = tk.vcf.numerical_axis
		if( !nm.in_use ) {
			// not in use
			return
		}

		if( nm.inuse_infokey ) {
			update_legend_by_infokey( menubutton, settingholder, tk, block )
			return
		}

		if( nm.inuse_termdb2groupAF ) {
			update_legend_by_termdb2groupAF( menubutton, settingholder, tk, block )
			return
		}

		throw 'do not know what is in use for numerical axis'
	}
}



function update_legend_by_infokey ( menubutton, settingholder, tk, block ) {
/*
dispatched by __update_legend
only updates legend
will not update track
*/
	const nm = tk.vcf.numerical_axis
	const key = nm.info_keys.find( i=> i.in_use )
	if(!key) {
		// should not happen
		return
	}
	menubutton.text(
		(tk.mds && tk.mds.mutationAttribute && tk.mds.mutationAttribute.attributes[ key.key ])
		?
		tk.mds.mutationAttribute.attributes[ key.key ].label
		:
		key.key
		)

	settingholder.append('span')
		.style('opacity',.5)
		.style('font-size','.8em')
		.html('APPLY CUTOFF&nbsp;')

	const sideselect = settingholder.append('select')
		.style('margin-right','3px')
		.on('change', async ()=>{
			const tt = d3event.target
			const side = tt.options[ tt.selectedIndex ].value
			if( side == 'no' ) {
				valueinput.style('display','none')
				key.cutoff.in_use = false
			} else {
				key.cutoff.in_use = true
				key.cutoff.side = side
				valueinput.style('display','inline')
			}
			tt.disabled = true
			await mds2.loadTk(tk, block)
			tt.disabled = false
		})

	const valueinput = settingholder.append('input')
		.attr('type','number')
		.style('width','80px')
		.on('keyup', async ()=>{
			if(client.keyupEnter()) {
				const tt = d3event.target
				const v = Number.parseFloat( tt.value )
				if(!Number.isNaN( v )) {
					key.cutoff.value = v
					tt.disabled=true
					await mds2.loadTk(tk, block)
					tt.disabled=false
				}
			}
		})
	// show default cutoff value; it maybe missing in custom track
	if( !Number.isFinite( key.cutoff.value ) ) {
		key.cutoff.value = ( key.max_value + key.min_value ) / 2
	}
	valueinput.property('value',key.cutoff.value)

	sideselect.append('option').attr('value','no').text('no')
	sideselect.append('option').attr('value','<').text('<')
	sideselect.append('option').attr('value','<=').text('<=')
	sideselect.append('option').attr('value','>').text('>')
	sideselect.append('option').attr('value','>=').text('>=')

	// initiate cutoff setting
	if( key.cutoff.in_use ) {
		// hardcoded index
		sideselect.node().selectedIndex = key.cutoff.side=='<' ? 1 : 
			key.cutoff.side=='<=' ? 2 :
			key.cutoff.side=='>' ? 3 : 4
		valueinput.property( 'value', key.cutoff.value )
	} else {
		sideselect.node().selectedIndex = 0
		valueinput.style('display','none')
	}
}




function update_legend_by_termdb2groupAF ( menubutton, settingholder, tk ) {

	menubutton.text('Two group comparison') // TODO update text

	settingholder.append('div').text('TODO') // TODO
}



