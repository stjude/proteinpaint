import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import * as client from './client'
import * as common from './common'
import * as mds2 from './block.mds2'
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
			menudiv.append('div')
				.text(
					(tk.mds && tk.mds.mutationAttribute && tk.mds.mutationAttribute.attributes[ key.key ])
					?
					tk.mds.mutationAttribute.attributes[ key.key ].label
					:
					key.key
				)
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
		await mds2.loadTk( tk, block )
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
			update_legend_by_infokey( settingholder, tk, block )
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



function update_legend_by_infokey ( settingholder, tk, block ) {
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

	const tip = new client.Menu({padding:'5px'})
	
	// add new term
	const add_term_btn = group_div.append('div')
	.attr('class','sja_menuoption')
	.style('display','inline-block')
	.style('padding','3px 5px')
	.style('margin-left','10px')
	.style('background-color', '#cfe2f3ff')
	.html('&#43;')
	.on('click',()=>{
		
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
				callback: callback_add(errdiv)
			}
            }
            init(obj)
	})
}

function update_terms_div(terms_div, group, tk, block){

	terms_div.selectAll('*').remove()

	const tip = new client.Menu({padding:'5px'})

	for(const [i, term] of group.terms.entries()){
		const term_btn = terms_div.append('div')
		.attr('class','sja_menuoption')
		.style('display','inline-block')
		.style('padding','3px 5px')
		.style('margin-left','10px')
		.style('background-color', '#cfe2f3ff')
		.html(
			term.term.name
			+' <span style="background-color:#aaa;color:white;font-size:.7em;padding:3px">'
			+(term.isnot ? 'IS NOT' : 'IS')
			+'</span> '
			+ term.value
			)
		.on('click',()=>{
		
			tip.clear()
			.showunder( term_btn.node() )

			const treediv = tip.d.append('div')

			// a new object as init() argument for launching the tree with modifiers
            const obj = {
                genome: block.genome,
                mds: tk.mds,
                div: treediv,
                default_rootterm: {},
				modifier_barchart_selectbar: {
					callback: callback_replace()
				}
            }
            init(obj)
		})
		
		// button with 'x' to remove term2
		terms_div.append('div')
		.attr('class','sja_menuoption')
		.style('display','inline-block')
		.style('margin-left','1px')
		.style('padding','3px 5px')
		.style('background-color', '#cfe2f3ff')
		.html('&#215;')
		.on('click',async ()=>{
			group.terms.splice(i, 1)
			group.div_numbersamples.text('Loading...')
			if(group.div_populationaverage) {
				group.div_populationaverage.text('Loading...')
			}
			update_terms_div(terms_div, group)
            await mds2.loadTk( tk, block )
		})
	}
}

function callback_add(errdiv){
	//TODO
}

function callback_replace(){
	//TODO
}
