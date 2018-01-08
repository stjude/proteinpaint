import * as client from './client'
import {invalidcoord} from './coord'
import {event as d3event} from 'd3-selection'
import * as common from './common'
import {scaleLinear} from 'd3-scale'


/*
build a sample by feature matrix

primarily, retrieve feature values from mds

to allow retrieving features from custom tracks, e.g. chip-seq peaks

rows
	- samples, of same height
columsn
	- features
	- each has own width

JUMP __draw __menu


********************** INTERNAL
getfeatures()
*/




const saynovalue='na'



export function init(cfg, debugmode) {
	/*
	init ui
	*/

	if(debugmode) window.cfg = cfg
	cfg.tip  = new client.Menu({padding:'0px'})
	cfg.menu = new client.Menu({padding:'0px'})
	cfg.errdiv = cfg.holder.append('div')
	cfg.legendtable = cfg.holder.append('table')
	cfg.svg = cfg.holder.append('svg')

	validateconfig(cfg)
	.then(()=>{
		getfeatures(cfg)
	})
	.catch(err=>{
		client.sayerror(cfg.errdiv, err)
	})
}




function validateconfig(cfg) {

	return Promise.resolve().then(()=>{

		if(cfg.dslabel) {
			// accessing a native ds
			cfg.mds = cfg.genome.datasets[cfg.dslabel]
			if(!cfg.mds) throw('invalid dataset name: '+cfg.dslabel)
			if(!cfg.mds.isMds) throw('improper dataset: '+cfg.dslabel)
		} else {

			throw('missing dslabel (custom track not yet supported)')
		}

		if(cfg.limitsamplebyeitherannotation) {
			if(!Array.isArray(cfg.limitsamplebyeitherannotation)) throw('limitsamplebyeitherannotation must be an array')
			const tr = cfg.legendtable.append('tr')
			for(const anno of cfg.limitsamplebyeitherannotation) {
				if(!anno.key) throw('.key missing from an element of limitsamplebyeitherannotation')
				if(!anno.value) throw('.value missing from an element of limitsamplebyeitherannotation')
			}
		}

		if(!cfg.rowspace) cfg.rowspace=1
		if(!cfg.colspace) cfg.colspace=1
		if(!cfg.rowlabspace) cfg.rowlabspace=5
		if(!cfg.collabspace) cfg.collabspace=5
		if(!cfg.rowlabticksize) cfg.rowlabticksize=5
		if(!cfg.collabticksize) cfg.collabticksize=5


		// features
		if(!cfg.features) throw('missing features[]')
		if(!Array.isArray(cfg.features)) throw('features must be an array')

		// any feature with gene to get position
		const querygenes=new Set()
		for(const f of cfg.features) {
			if(f.isgenevalue || f.iscnv) {
				if(f.genename && !f.position && !f.chr) querygenes.add(f.genename)
				continue
			}
		}
		if(querygenes.size==0) return
		const tasks=[]
		for(const gene of querygenes) {

			const q = fetch(new Request(cfg.hostURL+'/genelookup',{
				method:'POST',
				body:JSON.stringify({
					input:gene,
					genome:cfg.genome.name,
					jwt:cfg.jwt,
					deep:1
				})
			}))
			.then(data=>{return data.json()})
			.then(data=>{
				if(data.error) throw(data.error)
				return [gene, data.gmlst]
			})
			tasks.push(q)
		}

		return Promise.all(tasks)
		.then(lst=>{
			const gene2coord = {}
			for(const [gene, gmlst] of lst) {
				if(!gene2coord[gene]) gene2coord[gene]=[]
				for(const gm of gmlst) {
					let nooverlap=true
					for(const region of gene2coord[gene]) {
						if(gm.chr==region.chr && Math.max(gm.start,region.start)<Math.min(gm.stop,region.stop)) {
							nooverlap=false
							region.start = Math.min(region.start, gm.start)
							region.stop = Math.max(region.stop, gm.stop)
							break
						}
					}
					if(nooverlap) {
						gene2coord[gene].push({
							chr:gm.chr, 
							start:gm.start,
							stop:gm.stop
						})
					}
				}
			}
			for(const f of cfg.features) {
				if(f.isgenevalue || f.iscnv) {
					if(f.genename && !f.position && !f.chr) {
						if(!gene2coord[f.genename]) throw('unknown gene name: '+f.genename)
						if(gene2coord[f.genename].length>1) {
							client.sayerror(cfg.errdiv,'multiple regions found for gene '+f.genename+' you\'d better specify one in feature')
						}
						const r = gene2coord[f.genename][0]
						f.chr = r.chr
						f.start=r.start
						f.stop = r.stop
					}
				}
			}
		})
	})
	.then(()=>{

		for(const feature of cfg.features) {
			const err = validatefeature( feature, cfg )
			feature.id = Math.random().toString()
			if(err) throw(err)
		}
	})
}




function validatefeature( f, cfg) {

	const tr = cfg.legendtable.append('tr')

	if(f.isgenevalue) {
		// numerical value per sample
		if(!f.genename) return '.genename missing for isgenevalue feature'
		f.label = f.genename+' expression'

		{
			const err = invalidcoord(cfg.genome, f.chr, f.start, f.stop)
			if(err) return 'position error for isgenevalue feature: '+err
		}

		if(cfg.dslabel) {
			// official
			if(!f.querykey) return '.querykey missing for isgenevalue feature while loading from official dataset'
		} else {
			// to allow loading from custom track
		}

		if(!f.scale) f.scale = {auto:1}

		if(f.missingvalue==undefined) f.missingvalue=0 // samples that don't have value for that gene

		tr.append('td')
			.text(f.label)
			.style('color','#858585')
			.style('text-align','right')
		f.legendholder = tr.append('td')

		if(!f.width) f.width = 20
		if(!f.color) f.color = '#095873'

		return
	}

	if(f.iscnv) {
		// cnv with log2ratio
		{
			const err = invalidcoord(cfg.genome, f.chr, f.start, f.stop)
			if(err) return 'position error for iscnv feature: '+err
		}
		if(cfg.dslabel) {
			// official
			if(!f.querykey) return '.querykey missing for iscnv feature while loading from official dataset'
		} else {
			// to allow loading from custom track
		}
		if(!f.label && f.genename) {
			f.label = f.genename+' CNV'
		}
		if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+' CNV'
		tr.append('td')
			.text(f.label)
			.style('color','#858585')
			.style('text-align','right')
		f.legendholder = tr.append('td')

		if(!f.width) f.width=40
		f.coordscale = scaleLinear().domain([f.start,f.stop]).range([0, f.width]) // scale must be reset when coord/width changes
		if(!f.colorgain) f.colorgain = "#D6683C"
		if(!f.colorloss) f.colorloss = "#67a9cf"
		return
	}

	/*
	if(f.issv) {
		return
	}
	if(f.isbw) {
		return
	}
	if(f.isannotation) {
		return
	}
	if(f.issnpvcf) {
		return
	}
	if(f.isgenevcf) {
		return
	}
	*/

	return 'type unknown for one feature'
}




function feature2arg(f) {
	/*
	convert feature to argument obj for getting data
	*/
	if(f.isgenevalue) {
		return {
			id:f.id,
			isgenevalue:1,
			querykey:f.querykey,
			genename:f.genename,
			chr:f.chr,
			start:f.start,
			stop:f.stop
		}
	}
	if(f.iscnv) {
		return {
			id:f.id,
			iscnv:1,
			querykey:f.querykey,
			chr:f.chr,
			start:f.start,
			stop:f.stop,
			valuecutoff:f.valuecutoff,
			focalsizelimit:f.focalsizelimit,
		}
	}
}



function getfeatures(cfg, featureset) {
	/*
	may update subset of features instead of all
	TODO server-side clustering on select features to determine sample hierarchy
	*/

	const arg={
		jwt: cfg.jwt,
		genome: cfg.genome.name,
		dslabel: cfg.mds.label,
		limitsamplebyeitherannotation: cfg.limitsamplebyeitherannotation,
		features: (featureset || cfg.features).map( feature2arg )
	}

	fetch(new Request(cfg.hostURL+'/samplematrix',{
		method:'POST',
		body:JSON.stringify(arg)
	}))
	.then(data=>{return data.json()})
	.then(data=>{

		if(data.error) throw({message:data.error})

		for(const dat of data.results) {
			const f = cfg.features.find( f=> f.id==dat.id )
			if(!f) throw({message: 'feature not found: '+f.id })

			f.items = dat.items
			prepFeatureData( f )
		}

		drawMatrix(cfg)
	})
	.catch(err=>{
		client.sayerror( cfg.holder, err.message )
		if(err.stack) console.log(err.stack)
	})
}





function prepFeatureData( f){
	/*
	after getting data from query
	prepare feature data for rendering
	also updates legend
	*/
	if(f.isgenevalue) {

		// gene-level expression value, get max value
		// TODO other types of scaling
		f.scale.maxv=0
		f.scale.minv=0
		for(const i of f.items) {
			f.scale.maxv = Math.max(f.scale.maxv, i.value)
		}

		{
			const h = f.legendholder
			h.selectAll('*').remove()
			h.append('span').text(f.scale.minv)
			h.append('div')
				.style('margin','2px 10px')
				.style('display','inline-block')
				.style('width','100px')
				.style('height','15px')
				.style('background','linear-gradient( to right, white, '+f.color+')')
			h.append('span').text(f.scale.maxv)
		}
		return
	}

	if(f.iscnv) {
		const gain=[],
			loss=[] // log2 ratio values for getting scale max
		for(const i of f.items) {
			if(i.value>0) {
				gain.push(i.value)
			} else {
				loss.push(i.value)
			}
		}
		const gmax = common.getMax_byiqr( gain, 0 )
		const lmax = -common.getMax_byiqr( loss, 0 )
		f.maxabslogratio = Math.max(gmax, lmax)
		{
			const h=f.legendholder
			h.selectAll('*').remove()
			h.append('span').html('Gain <span style="background:'+f.colorgain+';color:white;padding:1px 5px">'+f.maxabslogratio+'</span> &nbsp; '
				+'Loss <span style="background:'+f.colorloss+';color:white;padding:1px 5px">-'+f.maxabslogratio+'</span>'
				)
		}
		return
	}
}







/******** __draw *******/


function drawMatrix( cfg ) {

	cfg.svg.selectAll('*').remove()
	const svgg = cfg.svg.append('g')

	const name2sample = new Map()
	// k: sample name
	// v: {}, may allow additional attributes for further grouping of samples

	for(const feature of cfg.features) {

		if(feature.isgenevalue || feature.iscnv) {

			for(const item of feature.items) {
				if(!name2sample.has(item.sample)) {
					name2sample.set(item.sample, {})
				}
			}

		} else {
			alert('unknown feature type from cfg.data')
		}
	}

	const samplelst = []

	for(const [n,sample] of name2sample) {
		sample.height = 14
		sample.name = n
		samplelst.push( sample )
	}

	sortsamplesbyfeatures( samplelst, cfg )

	////// rows, g and label

	let samplenamemaxwidth = 0

	{
		let y=0
		for(const sample of samplelst) {

			sample.g = svgg.append('g')
				.attr('transform','translate(0,'+y+')')
			y += sample.height + cfg.rowspace

			sample.g.append('text')
				.attr('font-family',client.font)
				.attr('font-size', sample.height-2)
				.attr('text-anchor','end')
				.attr('dominant-baseline','central')
				.attr('x', -cfg.rowlabspace - cfg.rowlabticksize)
				.attr('y', sample.height/2 )
				.text( sample.name )
				.each(function(){
					samplenamemaxwidth = Math.max( samplenamemaxwidth, this.getBBox().width )
				})
				.attr('class','sja_clbtext')
				.on('mouseover',()=>{
					showTip_sample(sample, cfg)
				})
				.on('mouseout',()=>{
					cfg.tip.hide()
				})
			sample.g.append('line')
				.attr('x1', -cfg.rowlabticksize)
				.attr('y1', sample.height/2)
				.attr('y2', sample.height/2)
				.attr('stroke','black')
				.attr('shape-rendering','crispEdges')

			// may plot additional things in sample.g for decoration
		}
	}


	///// columns, label only

	let featurenamemaxwidth = 0

	{
		let x=0
		for(const feature of cfg.features) {

			const g = svgg.append('g')
				.attr('transform','translate('+ (x+feature.width/2) +',-'+(cfg.collabspace+cfg.collabticksize)+')') // feature.g shift to center
			x+= feature.width + cfg.colspace

			const label = g.append('text')
				.attr('font-family', client.font)
				.attr('font-size',  Math.min(16, feature.width-2) ) // font size should not get crazy big
				.attr('dominant-baseline','central')
				.attr('transform','rotate(-90)')
				.text(feature.label)
				.each(function(){
					featurenamemaxwidth = Math.max( featurenamemaxwidth, this.getBBox().width )
				})
				//.attr('class','sja_clbtext')
				.on('mouseover', ()=>{
					showTip_feature(feature, cfg)
				})
				.on('mouseout',()=>{
					cfg.tip.hide()
				})
				.on('click', ()=>{
					showMenu_feature(feature, cfg)
				})

			if(feature.isgenevalue) {
				label.attr('fill', feature.color)
			}

			g.append('line')
				.attr('y1', cfg.collabspace)
				.attr('y2', cfg.collabspace+cfg.collabticksize)
				.attr('stroke','black')
				.attr('shape-rendering','crispEdges')
		}
	}


	// cells
	for(const sample of samplelst) {
		let x=0
		for(const feature of cfg.features) {
			const cell = sample.g.append('g')
				.attr('transform', 'translate('+x+',0)')

			x += feature.width + cfg.colspace

			drawCell( sample, feature, cell)
		}
	}

	svgg.attr('transform','translate('
		+ (samplenamemaxwidth+cfg.rowlabspace+cfg.rowlabticksize)
		+ ',' 
		+ (featurenamemaxwidth+cfg.collabspace+cfg.collabticksize)
		+')')

	cfg.svg.attr('width',
			samplenamemaxwidth +
			cfg.rowlabspace + cfg.rowlabticksize +
			cfg.features.reduce((i,j)=>i+j.width,0) +
			cfg.features.length * cfg.colspace )
		.attr('height',
			featurenamemaxwidth+
			cfg.collabspace + cfg.collabticksize +
			samplelst.reduce((i,j)=>i+j.height,0) +
			samplelst.length * cfg.rowspace )
}




function drawCell(sample,feature,g) {
	/*
	draw a cell
	*/

	if(feature.isgenevalue) {
		const item = feature.items.find( i=> i.sample == sample.name )
		if(!item) {
			drawEmptycell(sample, feature, g)
			return
		}

		const rect = g.append('rect')
			.attr('width', feature.width)
			.attr('height', sample.height)
			.attr('fill', feature.color)
			.attr('stroke','#ccc')
			.attr('stroke-opacity',0)
			.attr('shape-rendering','crispEdges')
			.on('mouseover',()=>{
				d3event.target.setAttribute('stroke-opacity',1)
				showTip_cell( sample, feature, cfg )
			})
			.on('mouseout',()=>{
				d3event.target.setAttribute('stroke-opacity',0)
				cfg.tip.hide()
			})
		if(item.value < feature.scale.maxv) {
			rect.attr('fill-opacity', item.value/feature.scale.maxv)
		}
		return
	}

	if(feature.iscnv) {
		const items = feature.items.filter( i=> i.sample == sample.name )
		if(items.length==0) {
			drawEmptycell(sample, feature, g)
			return
		}
		for(const item of items) {
			const x1 = feature.coordscale( Math.max(feature.start, item.start) )
			const x2 = feature.coordscale( Math.min(feature.stop, item.stop) )
			g.append('rect')
				.attr('x', x1)
				.attr('width', Math.max(1, x2-x1) )
				.attr('height', sample.height)
				.attr('fill',  item.value>0 ? feature.colorgain : feature.colorloss )
				.attr('fill-opacity', Math.abs(item.value)/feature.maxabslogratio)
				.attr('shape-rendering','crispEdges')
		}
		g.append('rect')
			.attr('fill','white')
			.attr('fill-opacity',0)
			.attr('width', feature.width)
			.attr('height', sample.height)
			.attr('stroke','#ccc')
			.attr('stroke-opacity',0)
			.attr('shape-rendering','crispEdges')
			.on('mouseover',()=>{
				d3event.target.setAttribute('stroke-opacity',1)
				showTip_cell( sample, feature, cfg )
			})
			.on('mouseout',()=>{
				d3event.target.setAttribute('stroke-opacity',0)
				cfg.tip.hide()
			})
		return
	}
}



function drawEmptycell(sample,feature,g) {
	g.append('line')
		.attr('x2',feature.width)
		.attr('y2',sample.height)
		.attr('stroke','#ccc')
}




/******** __draw ends *******/





/********** __menu and tooltip **********/


function showTip_feature(f, cfg) {
	cfg.tip.showunder( d3event.target)
		.clear()
	tipContent_feature(f, cfg.tip.d)
}


function showMenu_feature(f, cfg) {
	/*
	hover over feature's name
	*/
	cfg.menu.showunder( d3event.target)
		.clear()
	tipContent_feature(f, cfg.menu.d)

	if(f.isgenevalue) {
		showMenu_isgenevalue(f,cfg)
		return
	}
	if(f.iscnv) {
		showMenu_iscnv(f,cfg)
		return
	}
}


function tipContent_feature(f, holder) {
	holder.append('div')
		.text(f.label)
		.style('opacity',.5)
		.style('font-size','.7em')
		.style('margin','10px')

	if(f.isgenevalue || f.iscnv) {
		// show region
		holder.append('div')
			.html(f.chr+':'+f.start+'-'+f.stop+' &nbsp; '+common.bplen(f.stop-f.start))
			.style('font-size','.7em')
			.style('opacity',.5)
			.style('margin','0px 10px 10px 10px')
	}

	if(f.isgenevalue) {
		holder.append('div')
			.text('Min: '+f.scale.minv+', max: '+f.scale.maxv)
			.style('font-size','.7em')
			.style('opacity',.5)
			.style('margin','0px 10px 10px 10px')
	}
}




function showMenu_isgenevalue(f,cfg) {
	cfg.menu.d.append('div')
		.attr('class','sja_menuoption')
		.text('Sort')
		.on('click',()=>{
			cfg.menu.hide()
			if(f.sort) {
				// already sorting with this one
				return
			}
			// sort with this one
			for(const f2 of cfg.features) {
				if(f2.isgenevalue) delete f2.sort
			}
			f.sort=1
			drawMatrix(cfg)
		})
}



function showMenu_iscnv(f,cfg) {
	// log2ratio cutoff
	{
		const row=cfg.menu.d.append('div')
			.style('margin','10px')
		row.append('span').html('CNV log2(ratio) cutoff&nbsp;')
		row.append('input')
			.property( 'value', f.valuecutoff || 0 )
			.attr('type','number')
			.style('width','50px')
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v=Number.parseFloat(d3event.target.value)
				if(!v || v<0) {
					// invalid value, set to 0 to cancel
					v=0
				}
				if(v==0) {
					if(f.valuecutoff) {
						// cutoff has been set, cancel and refetch data
						f.valuecutoff=0
						getfeatures(cfg,[f])
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if(f.valuecutoff) {
					// cutoff has been set
					if(f.valuecutoff==v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						f.valuecutoff=v
						getfeatures(cfg,[f])
					}
				} else {
					// cutoff has not been set
					f.valuecutoff=v
					getfeatures(cfg,[f])
				}
			})
		row.append('div')
			.style('font-size','.7em').style('color','#858585')
			.html('Only show CNV with absolute log2(ratio) no less than cutoff.<br>Set to 0 to cancel.')
	}

	// focal cnv
	{
		const row=cfg.menu.d.append('div')
			.style('margin','10px')
		row.append('span')
			.html('CNV segment size limit&nbsp;')
		row.append('input')
			.property('value', f.focalsizelimit || 0)
			.attr('type','number')
			.style('width','100px')
			.on('keyup',()=>{
				if(d3event.code!='Enter' && d3event.code!='NumpadEnter') return
				let v = Number.parseInt(d3event.target.value)
				if(!v || v<0) {
					// invalid value, set to 0 to cancel
					v=0
				}
				if(v==0) {
					if(f.focalsizelimit) {
						// cutoff has been set, cancel and refetch data
						f.focalsizelimit=0
						getfeatures(cfg,[f])
					} else {
						// cutoff has not been set, do nothing
					}
					return
				}
				// set cutoff
				if(f.focalsizelimit) {
					// cutoff has been set
					if(f.focalsizelimit==v) {
						// same as current cutoff, do nothing
					} else {
						// set new cutoff
						f.focalsizelimit=v
						getfeatures(cfg,[f])
					}
				} else {
					// cutoff has not been set
					f.focalsizelimit=v
					getfeatures(cfg,[f])
				}
			})
		row.append('span').text('bp')
		row.append('div')
			.style('font-size','.7em').style('color','#858585')
			.html('Limit the CNV segment length to show only focal events.<br>Set to 0 to cancel.')
	}
}



function showTip_sample(sample, cfg) {
	cfg.tip.show(d3event.clientX,d3event.clientY)
		.clear()

	const lst = []
	for(const f of cfg.features) {

		if(lst.length>10) {
			lst.push({k:'more',v:'...'})
			break
		}

		if(f.isgenevalue) {
			const v = f.items.find( i=> i.sample == sample.name )
			lst.push({k:f.label, v:(v ? v.value : saynovalue)})
			continue
		}

		if(f.iscnv) {
			const items = f.items.filter( i=> i.sample==sample.name )
			let text
			if(items.length==0) {
				text = saynovalue
			} else {
				const lst2 = items.map(i=>{
					return '<div>'+i.chr+':'+i.start+'-'+i.stop+' '
					+'<span style="font-size:.7em">'+common.bplen(i.stop-i.start)+'</span> '
					+'<span style="background:'+(i.value>0?f.colorgain:f.colorloss)+';color:white;padding:1px 5px">'+i.value+'</span>'
					+'</div>'
				})
				text = lst2.join('')
			}
			lst.push({k:f.label, v:text})
		}

	}
	client.make_table_2col(cfg.tip.d, lst)
}





function showTip_cell(sample, f, cfg) {
	/*
	a cell
	*/
	cfg.tip.show(d3event.clientX,d3event.clientY)
		.clear()

	const lst=[{ k:'sample', v:sample.name }]

	if(f.isgenevalue) {

		const v = f.items.find( i=> i.sample == sample.name )
		lst.push({k:f.label, v: (v ? v.value : saynovalue)})

	} else if(f.iscnv) {
		const items = f.items.filter( i=> i.sample==sample.name )
		let text
		if(items.length==0) {
			text = saynovalue
		} else {
			const lst2 = items.map(i=>{
				return '<div>'+i.chr+':'+i.start+'-'+i.stop+' '
					+'<span style="font-size:.7em">'+common.bplen(i.stop-i.start)+'</span> '
					+'<span style="background:'+(i.value>0?f.colorgain:f.colorloss)+';color:white;padding:1px 5px">'+i.value+'</span>'
					+'</div>'
			})
			text = lst2.join('')
		}
		lst.push({k:f.label, v:text})
	}

	client.make_table_2col(cfg.tip.d, lst)
}

/********** __menu ends **********/






function sortsamplesbyfeatures(samplelst, cfg) {

	// check if sorting is enabled on any one of isgenevalue
	const sortbygenevalue = cfg.features.find( f => f.isgenevalue && f.sort )
	if(sortbygenevalue && sortbygenevalue.items) {
		const sample2value = new Map()
		for(const i of sortbygenevalue.items) {
			sample2value.set(i.sample, i.value)
		}
		samplelst.sort( (i,j)=>{
			const vi = sample2value.has(i.name) ? sample2value.get(i.name) : sortbygenevalue.missingvalue
			const vj = sample2value.has(j.name) ? sample2value.get(j.name) : sortbygenevalue.missingvalue
			return vj-vi // descending
		})
	}

}
