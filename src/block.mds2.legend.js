import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import * as client from './client'
import {legend_newrow} from './block.legend'
import * as common from './common'
import {may_create_vcflegend_numericalaxis} from './block.mds2.vcf.numericaxis.legend'



/*
********************** EXPORTED
init
update
********************** INTERNAL
create_mclass
may_create_variantfilter
update_mclass
display_active_variantfilter_infofields
list_inactive_variantfilter
configure_one_infofield
*/


export function init ( tk, block ) {

	if(!tk.legend) tk.legend = {}
	tk.legend.tip = new client.Menu({padding:'0px'})

	const [tr,td] = legend_newrow(block,tk.name)

	const table = td.append('table')
		.style('border-spacing','5px')
		.style('border-collapse','separate')

	tk.legend.table = table

	may_create_vcflegend_numericalaxis( tk, block )
	may_create_variantfilter( tk, block )
	create_mclass( tk )
}





function create_mclass(tk) {
/*
list all mutation classes
attribute may have already been created with customization
legend.mclass{}
	.hiddenvalues
	.row
	.holder
*/
	if(!tk.legend.mclass) tk.legend.mclass = {}
	if(!tk.legend.mclass.hiddenvalues) tk.legend.mclass.hiddenvalues = new Set()

	tk.legend.mclass.row = tk.legend.table.append('tr')

	tk.legend.mclass.row
		.append('td')
		.style('text-align','right')
		.style('opacity',.3)
		.text('Mutation')

	tk.legend.mclass.holder = tk.legend.mclass.row.append('td')
}






export function update ( data, tk, block ) {
/*
data is returned by xhr
*/
	if( data.mclass2count ) {
		update_mclass( data.mclass2count, tk )
	}
	if( data.info_fields) {
		update_info_fields( data.info_fields, tk )
	}
}




function update_mclass ( mclass2count, tk ) {

	tk.legend.mclass.holder.selectAll('*').remove()

	const showlst = [],
		hiddenlst = []
	for(const k in mclass2count) {
		const v = { k: k, count: mclass2count[k] }
		if( tk.legend.mclass.hiddenvalues.has( k ) ) {
			hiddenlst.push(v)
		} else {
			showlst.push(v)
		}
	}
	showlst.sort((i,j)=>j.count-i.count)
	hiddenlst.sort((i,j)=>j.count-i.count)
	//tk.legend.mclass.total_count = classlst.reduce((a,b)=>a+b.count,0);

	for(const c of showlst) {
	/*
	k
	count
	*/

		let label,
			desc,
			color = '#858585'

		if( Number.isInteger( c.k ) ) {
			label = common.dt2label[ c.k ]
			if(c.dt==common.dtcnv) {
				desc = 'Copy number variation.'
			} else if(c.dt==common.dtloh) {
				desc = 'Loss of heterozygosity.'
			} else if(c.dt==common.dtitd) {
				color = common.mclass[ common.mclassitd ].color
				desc = 'Internal tandem duplication.'
			} else if(c.dt==common.dtsv) {
				desc = 'Structural variation of DNA.'
			} else if(c.dt==common.dtfusionrna) {
				desc = 'Fusion gene from RNA-seq.'
			}
		} else {
			label = common.mclass[ c.k ].label
			color = common.mclass[ c.k ].color
			desc = common.mclass[ c.k ].desc
		}

		const cell = tk.legend.mclass.holder.append('div')
			.attr('class', 'sja_clb')
			.style('display','inline-block')
			.on('click',()=>{

				tk.legend.tip.clear()
					.d.append('div')
					.attr('class','sja_menuoption')
					.text('Hide')
					.on('click',()=>{
						tk.legend.mclass.hiddenvalues.add( c.k )
						tk.legend.tip.hide()
						tk.load()
					})

				tk.legend.tip.d
					.append('div')
					.attr('class','sja_menuoption')
					.text('Show only')
					.on('click',()=>{
						for(const c2 of showlst) {
							tk.legend.mclass.hiddenvalues.add( c2.k )
						}
						tk.legend.mclass.hiddenvalues.delete( c.k )
						tk.legend.tip.hide()
						tk.load()
					})

				if(hiddenlst.length) {
					tk.legend.tip.d
						.append('div')
						.attr('class','sja_menuoption')
						.text('Show all')
						.on('click',()=>{
							tk.legend.mclass.hiddenvalues.clear()
							tk.legend.tip.hide()
							tk.load()
						})
				}

				tk.legend.tip.d
					.append('div')
					.style('padding','10px')
					.style('font-size','.8em')
					.style('width','150px')
					.text(desc)

				tk.legend.tip.showunder(cell.node())
			})

		cell.append('div')
			.style('display','inline-block')
			.attr('class','sja_mcdot')
			.style('background', color)
			.html( c.count>1 ? c.count : '&nbsp;')
		cell.append('div')
			.style('display','inline-block')
			.style('color',color)
			.html('&nbsp;'+label)
	}

	// hidden ones
	for(const c of hiddenlst) {

		let loading = false

		tk.legend.mclass.holder.append('div')
			.style('display','inline-block')
			.attr('class','sja_clb')
			.style('text-decoration','line-through')
			.style('opacity',.3)
			.text( 
				'('+c.count+') '
				+(Number.isInteger(c.k) ? common.dt2label[c.k] : common.mclass[c.k].label )
			)
			.on('click', async ()=>{

				if(loading) return
				loading = true
				tk.legend.mclass.hiddenvalues.delete( c.k )
				d3event.target.innerHTML = 'Updating...'
				await tk.load()
			})
	}
}








function may_create_variantfilter ( tk, block ) {
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
			list_inactive_variantfilter( tk, block )
		})

	tk.legend.variantfilter.holder = tr2.append('td').style('padding-left','10px')

	// display filters active by default
	if( tk.info_fields ) {
		for(const i of tk.info_fields) {
			if(!i.isfilter) continue
			if(i.isactivefilter) {
				display_active_variantfilter_infofields( tk, i, block )
			}
		}
	}
	if( tk.variantcase_fields ) {
		console.log('to list active variantcase fields')
	}
}



function display_active_variantfilter_infofields ( tk, i, block ) {
/*
i is an element from tk.info_fields[]
add it as a new element to the holder
allow interacting with it, to update settings of i, and update track
*/
	const row = tk.legend.variantfilter.holder
		.append('div')

	// this row should contain those nice-looking elements

	row.append('span')
		.style('margin-right','20px')
		.text(i.label)

	if( i.iscategorical ) {
		for(const v of i.values ) {
			if(v.ishidden) {
				v.htmlspan = row.append('span')
					.text(
						(i._data ? '('+i._data.value2count[v.key]+') ' : '')
						+v.label
					)
					.style('text-decoration','line-through')
			} else {
				delete v.htmlspan
			}
		}
		if( i.unannotated_ishidden ) {
			i.unannotated_htmlspan = row.append('span')
				.text( (i._data ? '('+i._data.unannotated_count+') ' : '')+'Unannotated' )
		} else {
			delete i.unannotated_htmlspan
		}
	} else {
		// numerical
		const span = row.append('span')
			.style('margin-right','10px')
		const x = '<span style="font-family:Times;font-style:italic">x</span>'
		if( i.range.startunbounded ) {
			span.html(x+' '+(i.range.stopinclusive?'&le;':'&lt;')+' '+i.range.stop)
		} else if( i.range.stopunbounded ) {
			span.html(x+' '+(i.range.startinclusive?'&ge;':'&gt;')+' '+i.range.start)
		} else {
			span.html(
				i.range.start
				+' '+(i.range.startinclusive?'&le;':'&lt;')
				+' '+x
				+' '+(i.range.stopinclusive?'&le;':'&lt;')
				+' '+i.range.stop
			)
		}
		i.htmlspan = row.append('span')
			.text( i._data ? '('+i._data.filteredcount+' filtered)' : '')
	}

	row.append('span')
		.text('delete')
		.style('margin-left','10px')
		.on('click', async ()=>{
			row.remove()
			delete i.isactivefilter
			await tk.load()
		})
}



function list_inactive_variantfilter ( tk, block ) {
/*
from info_fields and variantcase_fields
list inactive filters
*/
	tk.legend.tip.clear()
	if(tk.info_fields) {
		for(const i of tk.info_fields) {
			if(!i.isfilter || i.isactivefilter) continue
			tk.legend.tip.d
			.append('div')
			.text(i.label)
			.attr('class','sja_menuoption')
			.on('click',()=>{
				tk.legend.tip.clear()
				configure_one_infofield( i, tk, block )
			})
		}
	}
	if(tk.variantcase_fields) {
	}
	tk.legend.tip.showunder( tk.legend.variantfilter.button.node() )
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
			display_active_variantfilter_infofields( tk, i, block )
			tk.legend.tip.hide()
			await tk.load()
		})
}



function update_info_fields ( data, tk ) {
/*
data is data.info_fields{}
*/
	for(const key in data) {
		const i = tk.info_fields.find( i=> i.key == key )
		if(!i) {
			console.log('info field not found by key: '+key)
			continue
		}
		i._data = data[key]
		if( i.isactivefilter ) {
			// an active filter; update stats
			if( i.iscategorical ) {
				// update counts from htmlspan
				if( i.unannotated_htmlspan ) i.unannotated_htmlspan.text = '('+(i._data.unannotated_count||0)+') Unannotated'
				for(const v of i.values) {
					if( v.htmlspan ) {
						v.htmlspan.text('('+(i._data.value2count[v.key]||0)+') '+v.label)
					}
				}
			} else {
				i.htmlspan.text('('+i._data.filteredcount+' filtered)')
			}
		}
	}
}
