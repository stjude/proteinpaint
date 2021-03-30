import * as client from './client'
import {select as d3select,event as d3event} from 'd3-selection'
import {scaleLinear} from 'd3-scale'
import {axisLeft} from 'd3-axis'
import {legend_newrow} from './block.legend'
import * as blockmds from './block.mds'
import {format as d3format} from 'd3-format'



/*
mds-cnv
	- make tk parts
	- load
	- render

filter always reloads
	- logratio values
	- sample annotation



JUMP __cohortfilter




*** cohortFilter

server makes summary for all samples in use, client generates legend accordingly, client doesn't keep catalog
TODO .isNumeric




********************** EXPORTED
loadTk()


********************** INTERNAL

makeTk()
configPanel()
addLoadParameter()

makeLegend_cohort()
showMenu_cohortFilter()


integrate other pieces of information from the same mds
- expression level of certain gene
- mutation status of certain gene or region

*/






const notAnnotatedLabel = 'Unannotated'
const labyspace=5




export function loadTk( tk, block ) {

	// unlike junction, won't reload child tk from parent

	block.tkcloakon(tk)
	block.block_setheight()

	if(tk.uninitialized) {
		makeTk(tk,block)
	}

	const par={
		jwt:block.jwt,
		genome:block.genome.name,
		rglst:block.tkarg_rglst(),
		regionspace:block.regionspace,
		dslabel:tk.mds.label,
		querykey:tk.querykey,
		gain:{
			barheight:tk.gain.barheight,
			color:tk.gain.color,
			color2:tk.gain.color2
		},
		loss:{
			barheight:tk.loss.barheight,
			color:tk.loss.color,
			color2:tk.loss.color2
		},
	}

	addLoadParameter( par, tk )

	if(tk.uninitialized) {
		// only delete the flag here after adding load parameter
		// for custom track, it tells this is first time querying it, thus will modify parameter to retrieve list of samples from track header
		delete tk.uninitialized
	}

	const req=new Request(block.hostURL+'/mdscnv', {
		method:'POST',
		body:JSON.stringify(par)
	})
	fetch(req)
	.then(data=>{return data.json()})
	.then(data=>{
		tk.maxvalue=0
		if(data.error) throw({message:data.error})
		if(!data.src) throw({message:'.imgsrc missing'})
		tk.img
			.attr('width',block.width)
			.attr('height',tk.gain.barheight+tk.loss.barheight)
			.attr('xlink:href',data.src)

		if(data.maxvalue) {
			tk.maxvalue = data.maxvalue
		}

		block.tkcloakoff(tk, {})

		return {
			gain:data.gain,
			loss:data.loss,
			attributeSummary:data.attributeSummary,
			hierarchySummary:data.hierarchySummary
		}
	})
	.catch(obj=>{
		// error somewhere, no rendering
		tk.img.attr('width',1).attr('height',1)
		block.tkcloakoff(tk, {error:tk.name+': '+obj.message})
		if(obj.stack) {
			console.log(obj)
		}
		return obj.passover || {}
	})
	.then(obj=>{
		if(obj.gain && obj.gain.count) {
			//tk.label_gain.text( obj.gain.count+' gain, '+obj.gain.samplenumber+' sample'+(obj.gain.samplenumber>1?'s':''))
			tk.label_gain.text( obj.gain.count+' gain'+(obj.gain.count>1?'s':''))
		} else {
			tk.label_gain.text('no copy number gain')
		}
		if(obj.loss && obj.loss.count) {
			//tk.label_loss.text( obj.loss.count+' loss, '+obj.loss.samplenumber+' sample'+(obj.loss.samplenumber>1?'s':''))
			tk.label_loss.text( obj.loss.count+' loss'+(obj.loss.count>1?'es':''))
		} else {
			tk.label_loss.text('no copy number loss')
		}
		setAxis(tk)
		if(tk.parentTk) {
			// is subtrack, no legend
		} else {
			makeLegend_cohort(obj, tk, block)
		}
		tk.height_main = tk.toppad + tk.gain.barheight + tk.loss.barheight + tk.bottompad
		block.block_setheight()
		updateLabel(tk,block)
	})
}




function setAxis(tk) {
	if(!tk.maxvalue) {
		// no valid max value, either no data in view range or got error
		tk.gain.axis.selectAll('*').remove()
		tk.loss.axis.selectAll('*').remove()
		return
	}
	//tk.gain.axis
	tk.loss.axis.attr('transform','translate(0,'+tk.gain.barheight+')')
	client.axisstyle({
		axis:tk.gain.axis.call(
			axisLeft().scale(
				scaleLinear().domain([tk.maxvalue,0]).range([0,tk.gain.barheight])
			)
			.tickValues([0, tk.maxvalue])
			.tickFormat(d3format('d')) // only for # of samples
		),
		color:'black',
		showline:true
	})
	client.axisstyle({
		axis:tk.loss.axis.call(
			axisLeft().scale(
				scaleLinear().domain([0,tk.maxvalue]).range([0,tk.gain.barheight])
			)
			.tickValues([tk.maxvalue,0])
			.tickFormat(d3format('d')) // only for # of samples
		),
		color:'black',
		showline:true
	})
}





function addLoadParameter( par, tk ) {
	if(tk.valueCutoff) {
		par.valueCutoff=tk.valueCutoff
	}
	if(tk.bplengthUpperLimit) {
		par.bplengthUpperLimit=tk.bplengthUpperLimit
	}

	if(tk.permanentHierarchy) {

		par.permanentHierarchy = tk.permanentHierarchy
	} else {
		const a={}
		let hasfilter=false
		for(const k in tk.cohortFilter.hiddenAttr) {
			let count=0
			const b={}
			for(const k2 in tk.cohortFilter.hiddenAttr[k]) {
				count++
				b[k2]=1
			}
			if(count) {
				hasfilter=true
				a[k]=b
			}
		}
		if(hasfilter) {
			par.cohortHiddenAttr = a
		}
	}
}





function updateLabel(tk,block) {
	/*
	updates tk.leftLabelMaxwidth
	also adjusts label y offset since track height may change
	*/
	const labyspace=3

	let y=tk.gain.barheight/2
	if(tk.subhierarchylabel) {
		// upper half show 3 labels: tk, subhierarchy, gain
		tk.tklabel.attr('y',y-labyspace-block.labelfontsize)
		tk.subhierarchylabel.attr('y',y)
		tk.label_gain.attr('y',y+labyspace+block.labelfontsize)
	} else {
		// upper half show 2 labels
		tk.tklabel.attr('y',y-(labyspace+block.labelfontsize)/2)
		tk.label_gain.attr('y',y+(labyspace+block.labelfontsize)/2)
	}

	y=tk.gain.barheight+tk.loss.barheight/2
	if(tk.closelabel) {
		// lower half show 2 labels: loss, close
		tk.label_loss.attr('y',y-(labyspace+block.labelfontsize)/2)
		tk.closelabel.attr('y',y+(labyspace+block.labelfontsize)/2)
	} else {
		// lower half show 1 label
		tk.label_loss.attr('y',y)
	}

	const lst=[]
	tk.tklabel.each(function(){lst.push(this.getBBox().width)})
	tk.label_gain.each(function(){lst.push(this.getBBox().width)})
	tk.label_loss.each(function(){lst.push(this.getBBox().width)})
	if(tk.subhierarchylabel) {
		tk.subhierarchylabel.each(function(){lst.push(this.getBBox().width)})
	}

	tk.leftLabelMaxwidth = Math.max(...lst)
	block.setllabel()
}








////////////////  __cohortfilter




function makeLegend_cohort(result, tk, block) {
	/*
	identical to junction
	*/

	tk.cohortFilter.holderTable.selectAll('*').remove()
	if(result.attributeSummary) {
		makeLegend_cohort_attribute( result.attributeSummary, tk, block)
	}
	if(result.hierarchySummary) {
		
		if(!tk.cohortFilter.hierarchies) {
			tk.cohortFilter.hierarchies={keys:{}}
			for(const k in result.hierarchySummary) {
				tk.cohortFilter.hierarchies.keys[ k ] = {
					opennodeids: new Set()
				}
			}
		}

		blockmds.makeLegend_cohort_hierarchy({
			hash:result.hierarchySummary,
			tk:tk,
			block:block,
			makenodelabel: (node, row)=>{
				gainlosscountlabel(node, row, tk)
				const color = node.isleaf ? '#858585' : 'inherit'
				row.append('span')
					.style('margin-right','5px')
					.style('color', color)
					.text( node.label || node.name )
				if(node.totalCount) {
					if(node.gain) {
						row.append('span')
							.style('font-size','.7em')
							.style('color', tk.gain.color)
							.text( Math.ceil(100*node.gain/node.totalCount)+'%' )
					}
					if(node.loss) {
						row.append('span')
							.style('font-size','.7em')
							.style('color', tk.loss.color)
							.text( (node.gain ? ', ' : '')+Math.ceil(100*node.loss/node.totalCount)+'%' )
					}
				}
			},
			clicknode: (node, hierarchyname)=>{
				blockmds.showHideSubtrack_byHierarchyLevel(tk, block, {
					hierarchyname: hierarchyname, 
					levelidx: node.depth-1,
					valuekey: node.name,
					valuelabel: node.label,
					nodeid: node.id,
					}
				)
			}
		})
	}
}
		




function makeLegend_cohort_attribute( lst, tk, block) {
	/*
	lst [ attr ]
		.label
		.key
		.values[{}]
			.label
			.gain
			.loss
	*/
	for(const attr of lst) {
		const tr=tk.cohortFilter.holderTable.append('tr')
			.style('border-spacing','5px')
			.style('border-collapse','separate')
		// header, not clickable
		tr.append('td')
			.text(attr.label)
			.style('color','#858585')
		// values holder
		const td=tr.append('td')

		/* TODO
		if(attr.isNumeric) {
			continue
		}
		*/

		// following is categorical-only, must have .values[]
		for(const item of attr.values) {
			const div=td.append('div')
				.style('display','inline-block')
				.style('padding','10px')
				.attr('class','sja_clb')
				.on('click',()=>{
					showMenu_cohortFilter( tk, block, attr, item, div)
				})
			if(item.label) {
				div.property('title',item.label)
			}
			gainlosscountlabel(item, div, tk)
			div.append('span')
				.text(item.name)
		}
		// any hidden ones from this attr
		if(tk.cohortFilter.hiddenAttr[attr.key]) {
			for(const value in tk.cohortFilter.hiddenAttr[attr.key]) {
				const div=td.append('div')
					.style('display','inline-block')
					.style('padding','8px')
					.style('color','#858585')
					.attr('class','sja_clb')
					.style('text-decoration','line-through')
					.text(value)
					.on('click',()=>{
						showMenu_cohortFilter( tk, block, attr, {name:value}, div )
					})
			}
		}
	}
	// printed all shown attributes, need to print attributes hidden from previous selection, so user can show them back
	for(const key in tk.cohortFilter.hiddenAttr) {
		if(lst.findIndex(i=>i.key==key)!=-1) {
			// attribute with this key is already shown in legend
			continue
		}
		const tr=tk.cohortFilter.holderTable.append('tr')
			.style('border-spacing','5px')
			.style('border-collapse','separate')
		tr.append('td')
			.text(key)  // only key is known now, not label
			.style('color','#858585')
		// values holder
		const td=tr.append('td')
		for(const value in tk.cohortFilter.hiddenAttr[key]) {
			const div=td.append('div')
				.style('display','inline-block')
				.style('padding','8px')
				.style('color','#858585')
				.attr('class','sja_clb')
				.style('text-decoration','line-through')
				.text(value)
				.on('click',()=>{
					showMenu_cohortFilter( tk, block, {key:key}, {name:value}, div )
				})
		}
	}
}






function gainlosscountlabel(item, holder, tk) {
	const cell=holder.append('div')
		.style('display','inline-block')
		.style('margin-right','5px')
	if(item.gain) {
		cell.append('span')
			.style('padding','1px 3px')
			//.style('background','rgba('+c.r+','+c.g+','+c.b+',.3)')
			//.style('border-bottom','solid 2px '+tk.gain.color)
			.style('background',tk.gain.color)
			.style('color','white')
			.style('font-size','.8em')
			.text(item.gain)
	}
	if(item.loss) {
		cell.append('span')
			.style('padding','1px 3px')
			//.style('background','rgba('+c.r+','+c.g+','+c.b+',.3)')
			//.style('border-bottom','solid 2px '+tk.loss.color)
			.style('background',tk.loss.color)
			.style('color','white')
			.style('font-size','.8em')
			.text(item.loss)
	}
}





function showMenu_cohortFilter( tk, block, attr, item, div) {
	/*
	show menu on clicking on an item from a cohort attribute

	attr{}: one of ds.cohort.attributes[]
		.label
		.key    for checking against cohortFilter.hiddenAttr
		.values[] for stuff from view range
	item{}: the current item of attr.values[] 
		.name   for checking against cohortFilter.hiddenAttr[attr.key]
		.label
		.color
		.gain
		.loss
	div: button for this item
	*/
	const tip=tk.legendMenu
	tip.clear()
		.showunder(div.node())

	if(item.gain) {
		tip.d.append('div')
			.html('<span style="color:white;background:'+tk.gain.color+'">&nbsp;'+item.gain+'&nbsp;</span> sample'+(item.gain>1?'s':'')+' with copy number gain')
			.style('margin','10px')
			.style('font-size','.8em')
			.style('color','#858585')
	}
	if(item.loss) {
		tip.d.append('div')
			.html('<span style="color:white;background:'+tk.loss.color+'">&nbsp;'+item.loss+'&nbsp;</span> sample'+(item.loss>1?'s':'')+' with copy number loss')
			.style('margin','10px')
			.style('font-size','.8em')
			.style('color','#858585')
	}
	tip.d.append('div')
		.text( (item.label || item.name)+ (item.totalCount ? ', '+item.totalCount+' total' : '') )
		.style('margin','10px')
		.style('font-size','.8em')
		.style('color','#858585')

	if(tk.cohortFilter.hiddenAttr[attr.key] && tk.cohortFilter.hiddenAttr[attr.key][item.name]) {
		tip.d.append('div')
			.attr('class','sja_menuoption')
			.text('Show')
			.on('click',()=>{
				tip.hide()
				div.text('Loading ...')
				delete tk.cohortFilter.hiddenAttr[attr.key][item.name]
				loadTk( tk, block )
			})
	} else {
		tip.d.append('div')
			.attr('class','sja_menuoption')
			.text('Hide')
			.on('click',()=>{
				tip.hide()
				div.text('Loading ...')
				if(!tk.cohortFilter.hiddenAttr[attr.key]) {
					tk.cohortFilter.hiddenAttr[attr.key]={}
				}
				tk.cohortFilter.hiddenAttr[attr.key][item.name]=1
				loadTk( tk, block )
			})
	}

	tip.d.append('div')
		.attr('class','sja_menuoption')
		.text('Show only')
		.on('click',()=>{
			tip.hide()
			div.text('Loading ...')

			// must not clear keys, but preserve what user had already selected to be hidden

			if(!tk.cohortFilter.hiddenAttr[attr.key]) {
				tk.cohortFilter.hiddenAttr[attr.key]={}
			}
			for(const v of attr.values) {
				tk.cohortFilter.hiddenAttr[attr.key][v.name]=1
			}
			delete tk.cohortFilter.hiddenAttr[attr.key][item.name]
			loadTk( tk, block )
		})

	if(tk.cohortFilter.hiddenAttr[attr.key]) {
		// if any is hidden
		let count=0
		for(const k in tk.cohortFilter.hiddenAttr[attr.key]) {
			count++
		}
		if(count) {
			tip.d.append('div')
				.attr('class','sja_menuoption')
				.text('Show all')
				.on('click',()=>{
					tip.hide()
					div.text('Loading ...')
					delete tk.cohortFilter.hiddenAttr[attr.key]
					loadTk( tk, block )
				})
		}
	}
}



////////////////  __cohortfilter ENDS













/////////////  __maketk



function makeTk(tk, block) {

	if(tk.permanentHierarchy) {
		// is subtrack, show which hierarchy it represents
		// dummy name
		tk.subhierarchylabel = block.maketklefthandle( tk )
			.text( tk.permanentHierarchy.hierarchyname + ': '+tk.permanentHierarchy.valuelabel )
			.attr('class',null)
			.attr('fill','#858585')
	}
	tk.label_gain=block.maketklefthandle(tk)
		.on('click',()=>{
			// download
		})
	tk.label_loss=block.maketklefthandle(tk)
		.on('click',()=>{
			// download
		})

	if(tk.permanentHierarchy) {
		tk.closelabel = blockmds.subtrackclosehandle(tk, block)
	}

	// config
	tk.config_handle = block.maketkconfighandle(tk)
		.on('click', ()=>{
			configPanel(tk, block)
		})

	// legend 
	if(tk.parentTk) {
		// is subtrack, no legend
	} else {

		tk.legendMenu=new client.Menu({padding:'0px'})

		const [tr,td]=legend_newrow(block,tk.name)
		tk.tr_legend=tr
		tk.td_legend=td

		tk.cohortFilter = {
			holderTable: tk.td_legend.append('table'),
			hiddenAttr: {}
		}
		if(tk.mds.cohortHiddenAttr) {
			// dataset has hidden attributes by default for sample annotation, copy to hiddenAttr
			for(const k in tk.mds.cohortHiddenAttr) {
				tk.cohortFilter.hiddenAttr[k]={}
				for(const v in tk.mds.cohortHiddenAttr[k]) {
					tk.cohortFilter.hiddenAttr[k][v]=1
				}
			}
		}
	}
}










function downloadData(tk) {
	// not working
	const txt=[]
	if(tk.file || tk.url) {
		// single track
		if(tk.data) {
			txt.push('chromosome\tstart\tstop\tread_count'+(tk.categories ? '\ttype' : ''))
			for(const j of tk.data) {
				txt.push(j.chr+'\t'+j.start+'\t'+j.stop+'\t'+j.v+(tk.categories ? '\t'+j.type : ''))
			}
		}
	} else if(tk.tracks) {
		if(tk.data) {
			const header=['chromosome\tstart\tstop'+(tk.categories ? '\ttype' : '')]
			for(const t of tk.tracks) {
				const lst=[]
				if(t.patient) lst.push(t.patient)
				if(t.sampletype) lst.push(t.sampletype)
				if(lst.length==0) {
					lst.push(t.name)
				}
				header.push(lst.join(', '))
			}
			txt.push(header.join('\t'))
			for(const j of tk.data) {
				const lst=[j.chr+'\t'+j.start+'\t'+j.stop+(tk.categories ? '\t'+j.type : '')]
				const hash=new Map()
				for(const jsample of j.data) {
					hash.set(jsample.tkid,jsample.v)
				}
				for(const t of tk.tracks) {
					lst.push(hash.has(t.tkid) ? hash.get(t.tkid) : '')
				}
				txt.push(lst.join('\t'))
			}
		}
	}

	client.export_data(tk.name,[{label:'Splice junction',text:txt.join('\n')}])
}




function configPanel(tk, block) {
	tk.tkconfigtip.clear()
		.showunder(tk.config_handle.node())
	const holder=tk.tkconfigtip.d

	{
		const row=holder.append('div').style('margin-bottom','15px')
		row.append('span').html(tk.valueLabel+' cutoff&nbsp;')
		row.append('input')
			.property('value',tk.valueCutoff || 0)
			.attr('type','number')
			.style('width','50px')
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=d3event.target.value
				if(!v || v<0) {
					// invalid value, set to 0 to cancel
					v=0
				}
				if(v==0) {
					if(tk.valueCutoff) {
						// cutoff has been set, cancel and refetch data
						tk.valueCutoff=0
						loadTk(tk,block)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if(tk.valueCutoff) {
					// cutoff has been set
					if(tk.valueCutoff==v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						tk.valueCutoff=v
						loadTk(tk, block)
					}
				} else {
					// cutoff has not been set
					tk.valueCutoff=v
					loadTk(tk, block)
				}
			})
		row.append('div')
			.style('font-size','.7em').style('color','#858585')
			.html('Only shows CNV events with absolute '+tk.valueLabel+' no less than cutoff.<br>Set to 0 to cancel.')
	}

	// bp length upper limit (focal)
	{
		const row=holder.append('div').style('margin-bottom','15px')
		row.append('span')
			.html('CNV segment size limit&nbsp;')
		row.append('input')
			.property('value',tk.bplengthUpperLimit || 0)
			.attr('type','number')
			.style('width','80px')
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=d3event.target.value
				if(!v || v<0) {
					// invalid value, set to 0 to cancel
					v=0
				}
				if(v==0) {
					if(tk.bplengthUpperLimit) {
						// cutoff has been set, cancel and refetch data
						tk.bplengthUpperLimit=0
						loadTk(tk,block)
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if(tk.bplengthUpperLimit) {
					// cutoff has been set
					if(tk.bplengthUpperLimit==v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						tk.bplengthUpperLimit=v
						loadTk(tk, block)
					}
				} else {
					// cutoff has not been set
					tk.bplengthUpperLimit=v
					loadTk(tk, block)
				}
			})
		row.append('span').text('bp')
		row.append('div')
			.style('font-size','.7em').style('color','#858585')
			.html('Limit the CNV segment length to show only focal events.<br>Set to 0 to cancel.')
	}

	// height
	{
		const row=holder.append('div').style('margin-bottom','15px')
		row.append('span')
			.text('Track height')
		row.append('button')
			.html('&nbsp;&nbsp;+&nbsp;&nbsp;')
			.style('margin-left','10px')
			.on('click',()=>{
				tk.gain.barheight+=10
				tk.loss.barheight+=10
				loadTk(tk,block)
				block.block_setheight()
			})
		row.append('button')
			.html('&nbsp;&nbsp;-&nbsp;&nbsp;')
			.style('margin-left','5px')
			.on('click',()=>{
				if(tk.gain.barheight<=60) return
				tk.gain.barheight -=10
				tk.loss.barheight -=10
				loadTk(tk,block)
				block.block_setheight()
			})
	}

	// color
	{
		const row=holder.append('div').style('margin-bottom','1px')
		row.append('span')
			.html('Copy number gain&nbsp;')
		row.append('input')
			.attr('type','color')
			.property('value',tk.gain.color)
			.on('change',()=>{
				tk.gain.color=d3event.target.value
				loadTk(tk,block)
			})
		row.append('span').html('&nbsp;&nbsp;loss&nbsp;')
		row.append('input')
			.attr('type','color')
			.property('value',tk.loss.color)
			.on('change',()=>{
				tk.loss.color=d3event.target.value
				loadTk(tk,block)
			})
	}

	// end of config
}


/////////////  __maketk ENDS
