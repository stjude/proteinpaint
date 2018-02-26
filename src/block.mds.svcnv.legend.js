import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import * as client from './client'
import {legend_newrow} from './block.legend'
import * as common from './common'
import {loadTk} from './block.mds.svcnv'


/*
exported:

makeTk_legend
may_legend_svchr
may_legend_mclass
may_legend_samplegroup
may_legend_mutationAttribute
*/


export function makeTk_legend(block, tk) {
	/*
	initiate legend
	*/
	const [tr,td] = legend_newrow(block,tk.name)
	tk.tr_legend = tr
	tk.td_legend = td

	const table = td.append('table')
		.style('border-spacing','5px')

	{
		const row = table.append('tr')
		tk.legend_mclass = {
			row:row,
			hidden: new Set(),
		}
		row.append('td')
			.style('text-align','right')
			.style('opacity',.5)
			.text('Mutation')
		tk.legend_mclass.holder = row.append('td')
	}

	// cnv/loh color scale showing in legend, only for multi-sample
	{
		const fontsize = 14
		const xpad = 15
		const barh = 20
		let leftpad = 50

		//// cnv color scale

		tk.cnvcolor.cnvlegend = {
			axistickh:4,
			barw:55
		}

		tk.cnvcolor.cnvlegend.row = table.append('tr')
		tk.cnvcolor.cnvlegend.row.append('td')
			.style('text-align','right')
			.style('opacity',.5)
			.text('CNV log2(ratio)')

		{
			const svg = tk.cnvcolor.cnvlegend.row
				.append('td')
				.append('svg')
				.attr('width', (leftpad+tk.cnvcolor.cnvlegend.barw)*2)
				.attr('height',fontsize+tk.cnvcolor.cnvlegend.axistickh+barh)

			tk.cnvcolor.cnvlegend.axisg = svg.append('g')
				.attr('transform','translate('+leftpad+','+(fontsize+tk.cnvcolor.cnvlegend.axistickh)+')')

			const gain_id = Math.random().toString()
			const loss_id = Math.random().toString()

			const defs = svg.append('defs')
			{
				// loss
				const grad = defs.append('linearGradient')
					.attr('id', loss_id)
				tk.cnvcolor.cnvlegend.loss_stop = grad.append('stop')
					.attr('offset','0%')
					.attr('stop-color', tk.cnvcolor.loss.str)
				grad.append('stop')
					.attr('offset','100%')
					.attr('stop-color', 'white')
			}
			{
				// gain
				const grad = defs.append('linearGradient')
					.attr('id', gain_id)
				grad.append('stop')
					.attr('offset','0%')
					.attr('stop-color', 'white')
				tk.cnvcolor.cnvlegend.gain_stop = grad.append('stop')
					.attr('offset','100%')
					.attr('stop-color', tk.cnvcolor.gain.str)
			}

			svg.append('rect')
				.attr('x',leftpad)
				.attr('y',fontsize+tk.cnvcolor.cnvlegend.axistickh)
				.attr('width', tk.cnvcolor.cnvlegend.barw)
				.attr('height',barh)
				.attr('fill', 'url(#'+loss_id+')')

			svg.append('rect')
				.attr('x', leftpad+tk.cnvcolor.cnvlegend.barw)
				.attr('y',fontsize+tk.cnvcolor.cnvlegend.axistickh)
				.attr('width', tk.cnvcolor.cnvlegend.barw)
				.attr('height',barh)
				.attr('fill', 'url(#'+gain_id+')')

			svg.append('text')
				.attr('x',leftpad-5)
				.attr('y',fontsize+tk.cnvcolor.cnvlegend.axistickh+barh/2)
				.attr('font-family',client.font)
				.attr('font-size',fontsize)
				.attr('text-anchor','end')
				.attr('dominant-baseline','central')
				.attr('fill','black')
				.text('Loss')
			svg.append('text')
				.attr('x', leftpad+tk.cnvcolor.cnvlegend.barw*2+5)
				.attr('y',fontsize+tk.cnvcolor.cnvlegend.axistickh+barh/2)
				.attr('font-family',client.font)
				.attr('font-size',fontsize)
				.attr('dominant-baseline','central')
				.attr('fill','black')
				.text('Gain')
		}


		//// loh color legend

		leftpad=20

		tk.cnvcolor.lohlegend = {
			axistickh:4,
			barw:55
		}

		tk.cnvcolor.lohlegend.row = table.append('tr')
		tk.cnvcolor.lohlegend.row.append('td')
			.style('text-align','right')
			.style('opacity',.5)
			.text('LOH seg.mean')

		{
			const svg = tk.cnvcolor.lohlegend.row
				.append('td')
				.append('svg')
				.attr('width', (leftpad+tk.cnvcolor.lohlegend.barw)*2)
				.attr('height',fontsize+tk.cnvcolor.lohlegend.axistickh+barh)

			tk.cnvcolor.lohlegend.axisg = svg.append('g')
				.attr('transform','translate('+leftpad+','+(fontsize+tk.cnvcolor.lohlegend.axistickh)+')')

			const loh_id = Math.random().toString()

			const defs = svg.append('defs')
			{
				const grad = defs.append('linearGradient')
					.attr('id', loh_id)
				grad.append('stop')
					.attr('offset','0%')
					.attr('stop-color', 'white')
				tk.cnvcolor.lohlegend.loh_stop = grad.append('stop')
					.attr('offset','100%')
					.attr('stop-color', tk.cnvcolor.loh.str)
			}

			svg.append('rect')
				.attr('x', leftpad)
				.attr('y',fontsize+tk.cnvcolor.lohlegend.axistickh)
				.attr('width', tk.cnvcolor.lohlegend.barw)
				.attr('height',barh)
				.attr('fill', 'url(#'+loh_id+')')
		}
	}

	if(tk.mutationAttribute && !tk.singlesample) {
		/*
		official only
		mutationAttribute is copied over from mds.queries
		initiate attributes used for filtering & legend display
		*/
		for(const key in tk.mutationAttribute.attributes) {
			const attr = tk.mutationAttribute.attributes[ key ]
			if(attr.filter) {

				attr.hidden = new Set()
				// k: key in mutationAttribute.attributes{}

				attr.value2count = new Map()
				/*
				k: key
				v: {
					totalitems: INT
					dt2count: Map( dt => count )
				}
				*/

				attr.legendrow = table.append('tr')
				attr.legendrow.append('td')
					.style('text-align','right')
					.style('opacity',.5)
					.text(attr.label)
				attr.legendholder = attr.legendrow.append('td')
			}
		}
	}



	if(!tk.singlesample && !tk.iscustom) {
		// official, multi-sample

		const row = table.append('tr')
			.style('display','none')
			.style('margin','10px')
		row.append('td')
			.style('text-align','right')
			.style('opacity',.5)
			.text('Cancer')
		tk.legend_samplegroup = {
			row: row,
			color: scaleOrdinal(schemeCategory20),
			holder: row.append('td'),
			hidden: new Set(),
		}
	}

	// sv chr color
	{
		const row = table.append('tr')
		tk.legend_svchrcolor={
			row:row,
			interchrs:new Set(),
			colorfunc: scaleOrdinal(schemeCategory20)
		}
		row.append('td')
			.style('text-align','right')
			.style('opacity',.5)
			.text('SV chromosome')
		tk.legend_svchrcolor.holder = row.append('td')
	}
}







export function may_legend_svchr(tk) {
	if(tk.legend_svchrcolor.interchrs.size==0) return
	tk.legend_svchrcolor.row.style('display','table-row')
	tk.legend_svchrcolor.holder.selectAll('*').remove()
	for(const chr of tk.legend_svchrcolor.interchrs) {
		const color=tk.legend_svchrcolor.colorfunc(chr)
		const d=tk.legend_svchrcolor.holder.append('div')
			.style('display','inline-block')
			.style('margin','3px 10px 3px 0px')
		d.append('div')
			.style('display','inline-block')
			.style('border-radius','10px')
			.style('padding','0px 10px')
			.style('border','solid 1px ' + color )
			.style('color', color )
			.style('font-size','.9em')
			.text(chr)
	}
}




export function may_legend_mclass(tk, block) {
	/*
	full or dense
	native or custom
	single or multi-sample
	always shown! both snvindel class & dt included (cnv/loh/sv/fusion/itd)
	*/

	tk.legend_mclass.holder.selectAll('*').remove()

	const classes = new Map()
	/*
	k: class
	v: {cname, count}
	if is snvindel class, key is class code e.g. "M"
	if not, key is dt
	*/

	// vcf classes
	if(tk.data_vcf) {
		for(const m of tk.data_vcf) {
			if(!classes.has( m.class )) {
				classes.set( m.class, {
					isvcf:1,
					cname:m.class,
					count:0
				} )
			}
			classes.get(m.class).count++
		}
	}
	// non-vcf classes
	if(tk.singlesample) {
		if(tk.data) {
			for(const i of tk.data) {
				if(!classes.has(i.dt)) {
					classes.set( i.dt, {
						dt: i.dt,
						count:0
					})
				}
				classes.get(i.dt).count++
			}
		}
	} else if(tk._data) {
		for(const g of tk._data) {
			for(const s of g.samples) {
				for(const i of s.items) {
					if(!classes.has(i.dt)) {
						classes.set( i.dt, {
							dt: i.dt,
							count:0
						})
					}
					classes.get(i.dt).count++
				}
			}
		}
	}

	const classlst = [ ...classes.values() ]
	classlst.sort( (i,j)=>j.count-i.count )

	for(const c of classlst) {

		let key,
			label,
			desc,
			color = '#858585'

		if(c.dt) {
			key = c.dt
			label = common.dt2label[ c.dt ]
			if(c.dt==common.dtcnv) desc = 'Copy number variation.'
			else if(c.dt==common.dtloh) desc = 'Loss of heterozygosity.'
			else if(c.dt==common.dtitd) {
				color = common.mclass[ common.mclassitd ].color
				desc = 'Internal tandem duplication.'
			} else if(c.dt==common.dtsv) desc = 'Structural variation of DNA.'
			else if(c.dt==common.dtfusionrna) desc = 'Fusion gene from RNA-seq.'
		} else {
			key = c.cname
			label = common.mclass[ c.cname ].label
			color = common.mclass[ c.cname ].color
			desc = common.mclass[c.cname].desc
		}

		const cell = tk.legend_mclass.holder.append('div')
			.attr('class', 'sja_clb')
			.style('display','inline-block')
			.on('click',()=>{
				tk.tip2.showunder(cell.node())
					.clear()

				tk.tip2.d.append('div')
					.attr('class','sja_menuoption')
					.text('Hide')
					.on('click',()=>{
						tk.legend_mclass.hidden.add(key)
						applychange()
					})

				tk.tip2.d.append('div')
					.attr('class','sja_menuoption')
					.text('Show only')
					.on('click',()=>{
						for(const c2 of classes.keys()) {
							tk.legend_mclass.hidden.add(c2)
						}
						tk.legend_mclass.hidden.delete(key)
						applychange()
					})

				if(tk.legend_mclass.hidden.size) {
					tk.tip2.d.append('div')
						.attr('class','sja_menuoption')
						.text('Show all')
						.on('click',()=>{
							tk.legend_mclass.hidden.clear()
							applychange()
						})
				}

				tk.tip2.d.append('div')
					.style('padding','10px')
					.style('font-size','.8em')
					.style('width','150px')
					.text(desc)
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

	// hidden
	for(const key of tk.legend_mclass.hidden) {
		tk.legend_mclass.holder.append('div')
			.style('display','inline-block')
			.attr('class','sja_clb')
			.style('text-decoration','line-through')
			.text( Number.isInteger(key) ? common.dt2label[key] : common.mclass[key].label )
			.on('click',()=>{
				tk.legend_mclass.hidden.delete( key )
				applychange()
			})
	}

	const applychange = ()=>{
		tk.tip2.hide()
		loadTk(tk, block)
	}
}




export function may_legend_samplegroup(tk, block) {
	if(!tk.legend_samplegroup) {
		// official only
		return
	}

	tk.legend_samplegroup.row.style('display','table-row')
	tk.legend_samplegroup.holder.selectAll('*').remove()

	const shownamegroups = []
	for(const g of tk._data) {
		if(g.name && g.name!='Unannotated') {
			shownamegroups.push(g)
		}
	}
	if(shownamegroups.length>0) {

		for(const g of shownamegroups) {

			const cell = tk.legend_samplegroup.holder.append('div')
				.style('display','inline-block')
				.attr('class','sja_clb')
				.on('click',()=>{
					tk.tip2.showunder(cell.node())
						.clear()
					if(tk.legend_samplegroup.hidden.has(g.name)) {
						tk.tip2.d.append('div')
							.attr('class','sja_menuoption')
							.text('Show')
							.on('click',()=>{
								tk.tip2.hide()
								tk.legend_samplegroup.hidden.delete( g.name )
								loadTk(tk,block)
							})
					} else {
						tk.tip2.d.append('div')
							.attr('class','sja_menuoption')
							.text('Hide')
							.on('click',()=>{
								tk.tip2.hide()
								tk.legend_samplegroup.hidden.add( g.name )
								loadTk(tk,block)
							})
					}
					tk.tip2.d.append('div')
						.attr('class','sja_menuoption')
						.text('Show only')
						.on('click',()=>{
							tk.tip2.hide()
							for(const g2 of tk._data) {
								if(g2.name && g2.name!='Unannotated') {
									tk.legend_samplegroup.hidden.add(g2.name)
								}
							}
							tk.legend_samplegroup.hidden.delete( g.name )
							loadTk(tk,block)
						})
					if(tk.legend_samplegroup.hidden.size) {
						tk.tip2.d.append('div')
							.attr('class','sja_menuoption')
							.text('Show all')
							.on('click',()=>{
								tk.tip2.hide()
								tk.legend_samplegroup.hidden.clear()
								loadTk(tk,block)
							})
					}
				})


			cell.append('div')
				.style('display','inline-block')
				.attr('class','sja_mcdot')
				.style('background', tk.legend_samplegroup.color(g.name) )
				.text(g.samples.length)
			cell.append('div')
				.style('display','inline-block')
				.style('color', tk.legend_samplegroup.color(g.name))
				.html('&nbsp;'+g.name)
		}
	}

	// hidden groups
	for(const name of tk.legend_samplegroup.hidden) {
		const cell = tk.legend_samplegroup.holder.append('div')
			.style('display','inline-block')
			.attr('class','sja_clb')
			.style('text-decoration','line-through')
			.text(name)
			.on('click',()=>{
				// directly click to show
				tk.legend_samplegroup.hidden.delete( name )
				loadTk(tk, block)
			})
	}
}



export function may_legend_mutationAttribute(tk, block) {
	/*
	official-only, multi-sample
	filtering by mutation attribute is done on server
	*/

	if(!tk.mutationAttribute) return
	if(tk.singlesample) {
		// multi-sample only
		return
	}

	// clear
	for(const key in tk.mutationAttribute.attributes) {
		const attr = tk.mutationAttribute.attributes[key]
		if(!attr.filter) continue
		attr.value2count.clear()
	}

	// count
	if(tk._data) {
		for(const g of tk._data) {
			for(const s of g.samples) {
				for(const i of s.items) {
					// won't count if i.mattr is undefined
					count_mutationAttribute( i.mattr, tk, i.dt )
				}
			}
		}
	}
	if(tk.data_vcf) {
		for(const m of tk.data_vcf) {
			if(m.dt==common.dtsnvindel) {
				if(!m.sampledata) continue
				for(const s of m.sampledata) {
					count_mutationAttribute( s, tk, m.dt )
				}
			} else {
				console.error('unknown dt: '+m.dt)
			}
		}
	}

	// show legend
	for(const key in tk.mutationAttribute.attributes) {
		const attr = tk.mutationAttribute.attributes[ key ]
		if(!attr.filter) continue

		if( attr.value2count.size + attr.hidden.size == 0 ) {
			// no value after counting, no hidden value either
			attr.legendrow.style('display','none')
		} else {
			attr.legendrow.style('display','table-row')
		}


		attr.legendholder.selectAll('*').remove()

		const lst = [ ...attr.value2count ]
		lst.sort( (i,j)=> j[1]-i[1] )

		for(const [valuestr, _o] of lst) {

			const printstr = attr.values[ valuestr ] ? attr.values[valuestr].label : valuestr

			const cell = attr.legendholder.append('div')
				.style('display','inline-block')
				.attr('class','sja_clb')
				.on('click',()=>{
					tk.tip2.showunder(cell.node())
						.clear()

					if(attr.hidden.has(valuestr)) {
						tk.tip2.d.append('div')
							.attr('class','sja_menuoption')
							.text('Show')
							.on('click',()=>{
								tk.tip2.hide()
								attr.hidden.delete( valuestr )
								loadTk(tk,block)
							})
					} else {
						tk.tip2.d.append('div')
							.attr('class','sja_menuoption')
							.text('Hide')
							.on('click',()=>{
								tk.tip2.hide()
								attr.hidden.add( valuestr )
								loadTk(tk,block)
							})
					}
					tk.tip2.d.append('div')
						.attr('class','sja_menuoption')
						.text('Show only')
						.on('click',()=>{
							tk.tip2.hide()
							for(const [vstr,c] of lst) {
								attr.hidden.add( vstr )
							}
							attr.hidden.delete( valuestr )
							loadTk(tk,block)
						})
					if(attr.hidden.size) {
						tk.tip2.d.append('div')
							.attr('class','sja_menuoption')
							.text('Show all')
							.on('click',()=>{
								tk.tip2.hide()
								attr.hidden.clear()
								loadTk(tk,block)
							})
					}

					// show by-dt count
					{
						const lst2 = [ ..._o.dt2count ]
						lst2.sort( (i,j) => j[1]-i[1] )

						const table = tk.tip2.d.append('div')
							.style('margin', '5px')
							.style('font-size', '.7em')
							.style('opacity',.8)
							.style('border-spacing','4px')
						for(const [dt, count] of lst2) {
							const tr = table.append('tr')
							tr.append('td')
								.text( common.dt2label[ dt ])
							tr.append('td')
								.text( count )
						}
					}
				})


			cell.append('div')
				.style('display','inline-block')
				.attr('class','sja_mcdot')
				.style('background', '#858585')
				.text( _o.totalitems )
			cell.append('span')
				.html('&nbsp;' + printstr )
		}

		if(attr.hidden.size) {
			for(const valuestr of attr.hidden) {
				const printstr = attr.values[ valuestr ] ? attr.values[valuestr].label : valuestr

				attr.legendholder.append('div')
					.style('display','inline-block')
					.attr('class','sja_clb')
					.style('text-decoration','line-through')
					.text(printstr)
					.on('click',()=>{
						attr.hidden.delete( valuestr )
						loadTk( tk, block )
					})
			}
		}
	}
}






function count_mutationAttribute( mattr, tk, itemdt ) {
	if(!mattr) {
		// the item does not have mattr, do not count
		return
	}

	for(const key in tk.mutationAttribute.attributes) {
		const attr = tk.mutationAttribute.attributes[key]
		if(!attr.filter) continue

		const value = mattr[ key ]

		if(value==undefined) {
			// not annotated, do not count
			continue
		}

		/*
		no longer acknowledge unannotated values
		if( value==undefined ) {
			// this item is not annotated, change its label to hardcoded
			value = common.not_annotated
		}
		*/

		// even if this value is not cataloged in attr.values{}, still record it for displaying
		if(!attr.value2count.has( value )) {
			attr.value2count.set( value, {
				totalitems: 0,
				dt2count: new Map()
			})
		}
		attr.value2count.get( value ).totalitems++

		if( !attr.value2count.get( value ).dt2count.has( itemdt ) ) {
			attr.value2count.get( value ).dt2count.set( itemdt, 0 )
		}

		attr.value2count.get( value ).dt2count.set( itemdt, attr.value2count.get( value ).dt2count.get( itemdt ) +1 )
	}
}
