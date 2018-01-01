import * as client from './client'
import {invalidcoord} from './coord'


/*
build a sample by feature matrix

primarily, retrieve feature values from mds

to allow retrieving features from custom tracks, e.g. chip-seq peaks
*/

export function init(cfg, debugmode) {

	cfg.legendtable = cfg.holder.append('table')
	cfg.svg = cfg.holder.append('svg')

	const err = validateconfig(cfg)
	if(err) {
		client.sayerror(cfg.holder, err)
		return
	}

	if(debugmode) window.cfg = cfg


	getfeatures(cfg)
}



function validateconfig(cfg) {
	if(cfg.dslabel) {
		// accessing a native ds
		cfg.mds = cfg.genome.datasets[cfg.dslabel]
		if(!cfg.mds) return 'invalid dataset name: '+cfg.dslabel
		if(!cfg.mds.isMds) return 'improper dataset: '+cfg.dslabel
	} else {

		return 'custom track not yet supported'

	}

	if(cfg.limitsamplebyeitherannotation) {
		if(!Array.isArray(cfg.limitsamplebyeitherannotation)) return 'limitsamplebyeitherannotation must be an array'
		for(const anno of cfg.limitsamplebyeitherannotation) {
			if(!anno.key) return '.key missing from an element of limitsamplebyeitherannotation'
			if(!anno.value) return '.value missing from an element of limitsamplebyeitherannotation'
		}
	}

	if(!cfg.rowspace) cfg.rowspace=1
	if(!cfg.colspace) cfg.colspace=1
	if(!cfg.rowlabspace) cfg.rowlabspace=5
	if(!cfg.collabspace) cfg.collabspace=5
	if(!cfg.rowlabticksize) cfg.rowlabticksize=5
	if(!cfg.collabticksize) cfg.collabticksize=5


	// features
	if(!cfg.features) return 'missing features[]'
	if(!Array.isArray(cfg.features)) return 'features must be an array'
	for(const feature of cfg.features) {

		const err = validatefeature( feature, cfg )
		feature.id = Math.random().toString()
		if(err) return err
	}

	return null
}




function validatefeature( f, cfg) {

	const tr = cfg.legendtable.append('tr')

	if(f.isgenevalue) {
		if(!f.genename) return '.genename missing for isgenevalue feature'
		f.label = f.genename+' expression'
		
		tr.append('td')
			.text(f.label)
			.style('color','#858585')
			.style('text-align','right')
		f.legendholder = tr.append('td')

		if(!f.width) {
			f.width = 20
		}
		if(!f.color) {
			f.color = '#095873'
		}

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
		return
	}

	return 'type unknown for one feature'
}




function feature2arg(f) {
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
}



function getfeatures(cfg) {

	// TODO allow updating data for select features

	// TODO server-side clustering on select features to determine sample hierarchy

	const arg={
		jwt: cfg.jwt,
		genome: cfg.genome.name,
		dslabel: cfg.mds.label,
		limitsamplebyeitherannotation: cfg.limitsamplebyeitherannotation,
		features: cfg.features.map( feature2arg )
	}

	fetch(new Request(cfg.hostURL+'/samplematrix',{
		method:'POST',
		body:JSON.stringify(arg)
	}))
	.then(data=>{return data.json()})
	.then(data=>{

		if(data.error) throw({message:data.error})

		for(const dat of data.results) {
			for(const f of cfg.features) {
				if(f.id == dat.id) {
					// matches
					f.items = dat.items
					prepfeaturedata( f )
					break
				}
			}
		}

		draw_all(cfg)

		// TODO allow updating data
	})
	.catch(err=>{
		client.sayerror( cfg.holder, err.message )
		if(err.stack) console.log(err.stack)
	})
}



function draw_all( cfg ) {

	cfg.svg.selectAll('*').remove()
	const svgg = cfg.svg.append('g')

	const name2sample = new Map()
	// k: sample name
	// v: {}, may allow additional attributes for further grouping of samples

	for(const feature of cfg.features) {

		if(feature.isgenevalue) {

			for(const item of feature.items) {
				if(!name2sample.has(item.sample)) {
					name2sample.set(item.sample, {})
				}
			}

		} else {
			alert('unknown feature type from cfg.data')
		}
	}

	let samplelst = []

	{
		// sort samples by chosen cfg.feature
		for(const [n,sample] of name2sample) {
			sample.height = 14
			sample.name = n
			samplelst.push( sample )
		}
	}


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

			feature.g = svgg.append('g')
				.attr('transform','translate('+ (x+feature.width/2) +',-'+(cfg.collabspace+cfg.collabticksize)+')') // feature.g shift to center
			x+= feature.width + cfg.colspace

			feature.g.append('text')
				.attr('font-family', client.font)
				.attr('font-size', feature.width-2)
				.attr('dominant-baseline','central')
				.attr('transform','rotate(-90)')
				.text(feature.label)
				.each(function(){
					featurenamemaxwidth = Math.max( featurenamemaxwidth, this.getBBox().width )
				})
			feature.g.append('line')
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

			drawcell( sample, feature, cell)
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




function prepfeaturedata( f){
	/*
	prepare feature data for rendering
	updates legend
	*/
	if(f.isgenevalue) {

		// gene-level expression value, get max value
		f.scale = {
			auto:1,
			maxv:0,
			minv:0
		}
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
}




function drawcell(sample,feature,g) {
	/*
	draw a cell
	*/
	const item = feature.items.find( i=> i.sample == sample.name )
	if(!item) {
		return
	}

	if(feature.isgenevalue) {
		const rect = g.append('rect')
			.attr('width', feature.width)
			.attr('height', sample.height)
			.attr('fill', feature.color)
		if(item.value < feature.scale.maxv) {
			rect.attr('fill-opacity', item.value/feature.scale.maxv)
		}
		return
	}
}
