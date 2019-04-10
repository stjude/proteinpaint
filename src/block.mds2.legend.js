import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import * as client from './client'
import {legend_newrow} from './block.legend'
import * as common from './common'
import * as mds2 from './block.mds2'
import {may_setup_numerical_axis} from './block.mds2.vcf.numericaxis'



/*
********************** EXPORTED
init
update
********************** INTERNAL
create_mclass
create_vcflegend
update_mclass
update_vcflegend
*/


export function init ( tk, block ) {

	if(!tk.legend) tk.legend = {}

	const [tr,td] = legend_newrow(block,tk.name)

	const table = td.append('table')
		.style('border-spacing','5px')
		.style('border-collapse','separate')

	tk.legend.table = table

	create_mclass( tk )
	create_vcflegend( tk, block )
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
		.style('opacity',.5)
		.text('Mutation')

	tk.legend.mclass.holder = tk.legend.mclass.row.append('td')
}



function create_vcflegend( tk, block ) {
/*
vcf related legends
*/
	if( !tk.vcf ) return
	const nm = tk.vcf.numerical_axis
	if( !nm ) return

	const row = tk.legend.table.append('tr')

	// td1
	row
		.append('td')
		.style('text-align','right')
		.style('opacity',.5)
		.text('Numerical axis')

	// td2
	const td = row.append('td')
	if(!tk.legend.numerical_axis) tk.legend.numerical_axis = {}

	// a select box
	const select = td.append('select')
		.style('margin','0px 10px')
		.on('change',()=>{

			const i = select.property('selectedIndex')
			if( i == nm.info_keys.length ) {
				nm.in_use = false
			} else {
				for(const e of nm.info_keys) e.in_use=false
				nm.info_keys[ i ].in_use = true
				may_setup_numerical_axis( tk )
			}
			mds2.loadTk(tk, block)
		})

	for(const [idx,ele] of nm.info_keys.entries()) {
		select.append('option')
			.attr('value',idx)
			.text(
				tk.mds && tk.mds.mutationAttribute ?
					tk.mds.mutationAttribute.attributes[ ele.key ].label
					: ele.key
			)
	}
	/*
	select.append('option')
		.attr('value',-1)
		.text('Do not apply')
		*/
	if( nm.in_use ) {
		select.property('selectedIndex', nm.info_keys.findIndex( i=> i.in_use ) )
	} else {
		select.property('selectedIndex', nm.info_keys.length )
	}
}




export function update ( data, tk, block ) {
/*
data is returned by xhr
*/
	if( data.mclass2count ) {
		update_mclass( data.mclass2count, tk, block )
	}
	if( data.vcf ) {
		update_vcflegend( data.vcf, tk, block )
	}
}




function update_mclass ( mclass2count, tk, block ) {

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

				tk.tip2.clear()
					.d.append('div')
					.attr('class','sja_menuoption')
					.text('Hide')
					.on('click',()=>{
						tk.legend.mclass.hiddenvalues.add( c.k )
						applychange()
					})

				tk.tip2.d
					.append('div')
					.attr('class','sja_menuoption')
					.text('Show only')
					.on('click',()=>{
						for(const c2 of showlst) {
							tk.legend.mclass.hiddenvalues.add( c2.k )
						}
						tk.legend.mclass.hiddenvalues.delete( c.k )
						applychange()
					})

				if(hiddenlst.length) {
					tk.tip2.d
						.append('div')
						.attr('class','sja_menuoption')
						.text('Show all')
						.on('click',()=>{
							tk.legend.mclass.hiddenvalues.clear()
							applychange()
						})
				}

				tk.tip2.d
					.append('div')
					.style('padding','10px')
					.style('font-size','.8em')
					.style('width','150px')
					.text(desc)

				tk.tip2.showunder(cell.node())
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
			.on('click',()=>{

				if(loading) return
				loading = true

				tk.legend.mclass.hiddenvalues.delete( c.k )
				d3event.target.innerHTML = 'Updating...'
				applychange()
			})
	}

	const applychange = ()=>{
		tk.tip2.hide()
		mds2.loadTk(tk, block)
	}
}



function update_vcflegend ( data, tk, block ) {
}
