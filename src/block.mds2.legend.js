import {event as d3event} from 'd3-selection'
import * as client from './client'
import {legend_newrow} from './block.legend'
import * as common from './common'
import {may_create_vcflegend_numericalaxis} from './block.mds2.vcf.numericaxis.legend'
import {may_create_variantfilter} from './block.mds2.legend.variantfilter'
import {make_radios, make_one_checkbox} from './dom'



/*
********************** EXPORTED
init
update
********************** INTERNAL
create_mclass
update_mclass
update_info_fields
*/


export function init ( tk, block ) {
/*
run only once, called by makeTk
*/
	if(!tk.legend) tk.legend = {}
	tk.legend.tip = new client.Menu({padding:'0px'})

	const [tr,td] = legend_newrow(block,tk.name)

	tk.tr_legend = tr // to be compatible with block.tk_remove()

	const table = td.append('table')
		.style('border-spacing','5px')
		.style('border-collapse','separate')

	tk.legend.table = table

	may_create_vcflegend_numericalaxis( tk, block )
	may_create_variantfilter( tk, block )
	create_mclass( tk )
	may_create_ldlegend( tk, block )
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
	if( data.AFtest_termdbgroup ) {
		let g = tk.vcf.numerical_axis.AFtest.groups[0]
		if( g.is_termdb ) {
			g.dom.samplehandle.text('n='+data.AFtest_termdbgroup[0].samplecount+', view stats')
			g.popsetaverage = data.AFtest_termdbgroup[0].popsetaverage // for displaying in tooltip
		}

		g = tk.vcf.numerical_axis.AFtest.groups[1]
		if( g.is_termdb ) {
			g.dom.samplehandle.text('n='+data.AFtest_termdbgroup[1].samplecount+', view stats')
			g.popsetaverage = data.AFtest_termdbgroup[1].popsetaverage // for displaying in tooltip
		}
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
				if( i.unannotated_htmlspan ) i.unannotated_htmlspan.text('('+(i._data.unannotated_count||0)+') Unannotated')
				for(const v of i.values) {
					if( v.htmlspan ) {
						v.htmlspan.text('('+(i._data.value2count[v.key]||0)+') '+v.label)
					}
				}
			} else if( i.isinteger || i.isfloat ) {
				if( i.htmlspan ) i.htmlspan.text('('+i._data.filteredcount+' filtered)')
			} else if( i.isflag ) {
				if( i.htmlspan ) i.htmlspan.text('('+(i.remove_yes?i._data.count_yes:i._data.count_no)+') '+(i.remove_no?'No':'Yes'))
			} else {
				throw 'unknown info type'
			}
		}
	}
}





function may_create_ldlegend ( tk, block ) {
	if(!tk.ld) return
	const row = tk.legend.table.append('tr')
	// td1
	row
		.append('td')
		.style('text-align','right')
		.style('opacity',.3)
		.text('LD')

	// td2
	const td = row.append('td')

	const table = td.append('table')
		.style('border-spacing','10px')
		.style('border-collapse','separate')
	/* one row per track
	col1. name
	col2. show/hide
	*/

/*
	const radios = make_radios({
		holder: td,
		styles:{margin:'0px'},
		options:[...tk.ld.tracks.map(i=>{return{label:'Overlay',value:i.name}}), {label:'No overlay',value:'no_overlay',checked:true}],
		callback: async (value)=>{
			if(value=='no_overlay') {
				delete tk.ld.overlaywith
			} else {
				tk.ld.overlaywith = value
			}
		}
	})
	*/

	for(const ld of tk.ld.tracks) {
		const tr = table.append('tr')
		// col1
		tr.append('td')
			.text(ld.name)
		// col2
		make_one_checkbox({
			holder: tr.append('td'),
			labeltext: 'Show',
			checked: ld.shown,
			callback: async ()=>{
				ld.shown = !ld.shown
				await tk.load()
			}
		})
	}

	// overlay
	{
		const div = td.append('div')
		div.append('span')
			.style('opacity',.5)
			.text('Overlay')
		const select = div.append('select')
			.style('margin','0px 10px')
			.on('input',()=>{
				const i = select.node().selectedIndex
				if(i==0) {
					delete tk.ld.overlaywith
				} else {
					tk.ld.overlaywith = tk.ld.tracks[i-1].name
				}
			})
		select.append('option').text('No overlay')
		for(const ld of tk.ld.tracks) {
			select.append('option')
				.text(ld.name)
		}
	}

}
