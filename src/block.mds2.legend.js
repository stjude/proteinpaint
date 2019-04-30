import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import {event as d3event} from 'd3-selection'
import * as client from './client'
import {legend_newrow} from './block.legend'
import * as common from './common'
import * as mds2 from './block.mds2'
import {may_create_vcflegend_numericalaxis} from './block.mds2.vcf.numericaxis.legend'



/*
********************** EXPORTED
init
update
********************** INTERNAL
create_mclass
may_create_locusAttribute
may_create_termdb_population not used
update_mclass
update_locusAttribute
*/


export async function init ( tk, block ) {

	if(!tk.legend) tk.legend = {}
	tk.legend.tip = new client.Menu({padding:'0px'})

	const [tr,td] = legend_newrow(block,tk.name)

	const table = td.append('table')
		.style('border-spacing','5px')
		.style('border-collapse','separate')

	tk.legend.table = table

	may_create_vcflegend_numericalaxis( tk, block )
	create_mclass( tk )
	may_create_locusAttribute( tk )

	//await may_create_termdb_population( tk, block )
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
	const applychange = _applychange(tk,block)

	if( data.mclass2count ) {
		update_mclass( data.mclass2count, tk, applychange )
	}
	if( data.locusAttribute2count ) {
		update_locusAttribute( data.locusAttribute2count, tk, applychange )
	}
}




function update_mclass ( mclass2count, tk, applychange ) {

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
						applychange()
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
						applychange()
					})

				if(hiddenlst.length) {
					tk.legend.tip.d
						.append('div')
						.attr('class','sja_menuoption')
						.text('Show all')
						.on('click',()=>{
							tk.legend.mclass.hiddenvalues.clear()
							applychange()
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
			.on('click',()=>{

				if(loading) return
				loading = true

				tk.legend.mclass.hiddenvalues.delete( c.k )
				d3event.target.innerHTML = 'Updating...'
				applychange()
			})
	}
}





function update_locusAttribute ( locusAttribute2count, tk, applychange ) {
/*
TODO may be a generic function applied to locusAttribute alleleAttribute mutationAttribute
*/

	if( !tk.locusAttribute || !tk.locusAttribute.attributes) return

	for(const attrkey in tk.locusAttribute.attributes) {

		const attr = tk.locusAttribute.attributes[ attrkey ]
		attr.legend.holder.selectAll('*').remove()

		const showlst = [],
			hiddenlst = []

		if( locusAttribute2count[attrkey].unannotated_count) {
			const c = {
				isunannotated:true,
				count: locusAttribute2count[attrkey].unannotated_count
			}
			if( attr.unannotated_ishidden ) {
				hiddenlst.push(c)
			} else {
				showlst.push(c)
			}
		}
		for(const valuekey in locusAttribute2count[ attrkey ].value2count) {
			const c = {
				key: valuekey,
				count: locusAttribute2count[ attrkey ].value2count[ valuekey ]
			}
			if( attr.values[ valuekey ].ishidden ) {
				hiddenlst.push(c)
			} else {
				showlst.push(c)
			}
		}
		showlst.sort((i,j)=>j.count-i.count)
		hiddenlst.sort((i,j)=>j.count-i.count)

		for(const c of showlst) {
			// { key, count, isunannotated }

			const label = c.isunannotated ? 'Unannotated' : attr.values[ c.key ].name
			const color = '#858585'

			const cell = attr.legend.holder
				.append('div')
				.attr('class', 'sja_clb')
				.style('display','inline-block')
				.on('click',()=>{

					tk.legend.tip
						.clear()
						.d.append('div')
						.attr('class','sja_menuoption')
						.text('Hide')
						.on('click',()=>{
							if( c.isunannotated ) {
								attr.unannotated_ishidden = true
							} else {
								attr.values[ c.key ].ishidden = true
							}
							applychange()
						})

					tk.legend.tip.d
						.append('div')
						.attr('class','sja_menuoption')
						.text('Show only')
						.on('click',()=>{
							for(const c2 of showlst) {
								if(c2.isunannotated) {
									attr.unannotated_ishidden=true
								} else {
									attr.values[c2.key].ishidden=true
								}
							}
							if( c.isunannotated ) {
								delete attr.unannotated_ishidden
							} else {
								delete attr.values[c.key].ishidden
							}
							applychange()
						})

					if(hiddenlst.length) {
						tk.legend.tip.d
							.append('div')
							.attr('class','sja_menuoption')
							.text('Show all')
							.on('click',()=>{
								delete attr.unannotated_ishidden
								for(const k in attr.values) {
									delete attr.values[k].ishidden
								}
								applychange()
							})
					}

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
			// { key, count, isunannotated }

			const label = c.isunannotated ? 'Unannotated' : attr.values[ c.key ].name
			const color = '#858585'
			let loading = false

			attr.legend.holder.append('div')
				.style('display','inline-block')
				.attr('class','sja_clb')
				.style('text-decoration','line-through')
				.style('opacity',.3)
				.text( '('+c.count+') '+label )
				.on('click',()=>{

					if(loading) return
					loading = true

					if( c.isunannotated ) {
						delete attr.unannotated_ishidden
					} else {
						delete attr.values[c.key].ishidden
					}
					d3event.target.innerHTML = 'Updating...'
					applychange()
				})
		}
	}
}



function _applychange (tk,block) {
	return ()=>{
		tk.legend.tip.hide()
		mds2.loadTk(tk, block)
	}
}




async function may_create_termdb_population ( tk, block ) {
/*
not used
population group by termdb
applies to all type of data, not just vcf

*/

	if( !tk.samplegroups ) tk.samplegroups = []

	if( !tk.mds ) return
	if( !tk.mds.termdb ) return

	/*
	if the track is preconfigured to have sample groups
	initialize the groups here, async
	tk.groups = [ {ssid} ]
	*/

	const row = tk.legend.table.append('tr')

	// td1
	row
		.append('td')
		.style('text-align','right')
		.style('opacity',.3)
		.text('Population groups')

	// td2
	const td = row.append('td')
		.style('padding','10px')

	td.append('button')
		.text('Add filter')
		.on('click',()=>{
		})
}



function may_create_locusAttribute ( tk ) {
/*
list all mutation classes
attribute may have already been created with customization
legend.mclass{}
	.hiddenvalues
	.row
	.holder
*/
	if(!tk.locusAttribute || !tk.locusAttribute.attributes) return
	for(const k in tk.locusAttribute.attributes) {
		const attr = tk.locusAttribute.attributes[ k ]
		attr.legend = {}
		attr.legend.row = tk.legend.table.append('tr')
		attr.legend.row
			.append('td')
			.style('text-align','right')
			.style('opacity',.3)
			.text(attr.label)
		attr.legend.holder = attr.legend.row.append('td')
	}
}
