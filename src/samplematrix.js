import * as client from './client'
import {string2pos, invalidcoord} from './coord'
import {event as d3event} from 'd3-selection'
import * as common from './common'
import {scaleLinear} from 'd3-scale'


/*
build a sample by feature matrix

primarily, retrieve feature values from mds

hardcoded: rows for samples, cols for features

exposed methods (as in block.mds.svcnv.samplematrix.js)
.validate_feature()
.get_features()
.error()


TODO
- custom dataset
- retrieve features from assay tracks, using an assay type

rows
	- samples, of same height
columsn
	- features
	- each has own width

JUMP __draw __menu
__newattr places for adding new feature


*/




const saynovalue='na'



export class Samplematrix {
	/*
	init ui
	*/

	constructor( p ) {

		for(const k in p) {
			this[k] = p[k]
		}
		if(this.debugmode) window.smat = this
		this.tip  = new client.Menu({padding:'0px'})
		this.menu = new client.Menu({padding:'0px'})
		this.errdiv = this.holder.append('div')
		this.legendtable = this.holder.append('table')
			.style('margin-bottom','20px')
		this.svg = this.holder.append('svg')

		this.validate_config()
		.then(()=>{
			return this.get_features()
		})
		.catch(err=>{
			if(typeof(err)=='string') {
				this.error(err)
			} else {
				this.error(err.message)
				if(err.stack) console.log(err.stack)
			}
		})

		///////////// end of constructor
	}





	error( m ) {
		client.sayerror( this.errdiv, m )
	}




	validate_config() {
		/*
		only run once, upon init
		*/

		return Promise.resolve()
		.then(()=>{

			if(this.dslabel) {
				// accessing a native ds
				this.mds = this.genome.datasets[this.dslabel]
				if(!this.mds) throw('invalid dataset name: '+this.dslabel)
				if(!this.mds.isMds) throw('improper dataset: '+this.dslabel)
			} else {

				throw('missing dslabel (custom track not yet supported)')
			}

			if(this.limitsamplebyeitherannotation) {
				if(!Array.isArray(this.limitsamplebyeitherannotation)) throw('limitsamplebyeitherannotation must be an array')
				const tr = this.legendtable.append('tr')
				for(const anno of this.limitsamplebyeitherannotation) {
					if(!anno.key) throw('.key missing from an element of limitsamplebyeitherannotation')
					if(!anno.value) throw('.value missing from an element of limitsamplebyeitherannotation')
				}
			}

			if(!this.rowspace) this.rowspace=1
			if(!this.colspace) this.colspace=1
			if(!this.rowlabspace) this.rowlabspace=5
			if(!this.collabspace) this.collabspace=5
			if(!this.rowlabticksize) this.rowlabticksize=5
			if(!this.collabticksize) this.collabticksize=5


			// features
			if(!this.features) throw('missing features[]')
			if(!Array.isArray(this.features)) throw('features must be an array')

			const featuretasks = []
			for(const f of this.features) {
				featuretasks.push( this.validate_feature( f ) )
			}
			return Promise.all( featuretasks )
		})
	}




	feature_parseposition_maygene( f ) {
		/*
		for position-based features
		only called by when validating features
		*/
		return Promise.resolve()
		.then(()=>{

			if( f.position ) {
				// raw string
				const o = string2pos( f.position, this.genome )
				if(o) {
					f.chr = o.chr
					f.start = o.start
					f.stop = o.stop
				}
			}

			if( f.chr ) {
				// has predefined position
				const err = invalidcoord(this.genome, f.chr, f.start, f.stop)
				if(err) {
					throw('position error for feature: '+err)
				} else {
					// has valid position
					return
				}
			}

			if( !f.genename ) {
				throw('position required for a feature: no position or genename given')
			}

			// fetch position by gene name
			return fetch(new Request(this.hostURL+'/genelookup',{
				method:'POST',
				body:JSON.stringify({
					input:f.genename,
					genome:this.genome.name,
					jwt:this.jwt,
					deep:1
				})
			}))
			.then(data=>{return data.json()})
			.then(data=>{
				if(data.error) throw(data.error)
				if(!data.gmlst || data.gmlst.length==0) throw('no coordinate position can be found by gene '+f.genename)
				// data.gmlst isoforms could be from different positions
				const regions = []
				for(const gm of data.gmlst) {
					let nooverlap=true
					for(const region of regions) {
						if(gm.chr==region.chr && Math.max(gm.start,region.start)<Math.min(gm.stop,region.stop)) {
							nooverlap=false
							region.start = Math.min(region.start, gm.start)
							region.stop = Math.max(region.stop, gm.stop)
							break
						}
					}
					if(nooverlap) {
						regions.push({
							chr:gm.chr, 
							start:gm.start,
							stop:gm.stop
						})
					}
				}
				if(regions.length>1) {
					client.sayerror(this.errdiv,'multiple regions found for gene '+f.genename+' you\'d better specify one in feature')
				}
				f.chr = regions[0].chr
				f.start = regions[0].start
				f.stop = regions[0].stop
			})
		})
	}




	validate_feature( f ) {
		/*
		call when adding new feature
		also generates legend row for this feature
		returns promise
		*/

		return Promise.resolve()
		.then(()=>{

		f.id = Math.random().toString()

		const tr = this.legendtable.append('tr')
		f.legend_tr = tr

		if(f.isgenevalue) {
			/*
			numerical value per sample
			single mark
			*/
			if(!f.genename) throw('.genename missing for isgenevalue feature')
			f.label = f.genename+' expression'

			if(this.dslabel) {
				// official
				if(!f.querykey) throw('.querykey missing for isgenevalue feature while loading from official dataset')
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

			return this.feature_parseposition_maygene( f )
		}

		if(f.iscnv) {
			/*
			cnv with log2ratio
			"browser track"
			*/
			if(this.dslabel) {
				// official
				if(!f.querykey) throw('.querykey missing for iscnv feature while loading from official dataset')
			} else {
				// to allow loading from custom track
			}
			if(!f.label && f.genename) {
				f.label = f.genename+' CNV'
			}
			tr.append('td')
				.text(f.label)
				.style('color','#858585')
				.style('text-align','right')
			f.legendholder = tr.append('td')

			if(!f.width) f.width=40
			if(!f.colorgain) f.colorgain = "#D6683C"
			if(!f.colorloss) f.colorloss = "#67a9cf"

			return this.feature_parseposition_maygene( f )
				.then(()=>{
					if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+' CNV'
					/*
					scale must be reset when coord/width changes
					*/
					f.coordscale = scaleLinear().domain([f.start,f.stop]).range([0, f.width])
				})
		}

		if(f.isloh) {
			// loh with segmean
			if(this.dslabel) {
				// official
				if(!f.querykey) throw('.querykey missing for isloh feature while loading from official dataset')
			} else {
				// to allow loading from custom track
			}
			if(!f.label && f.genename) {
				f.label = f.genename+' LOH'
			}
			tr.append('td')
				.text(f.label)
				.style('color','#858585')
				.style('text-align','right')
			f.legendholder = tr.append('td')

			if(!f.width) f.width=40
			if(!f.color) f.color = "black"

			return this.feature_parseposition_maygene( f )
				.then(()=>{
					if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+' LOH'
					/*
					scale must be reset when coord/width changes
					*/
					f.coordscale = scaleLinear().domain([f.start,f.stop]).range([0, f.width])
				})
		}

		if(f.isvcf) {
			if(this.dslabel) {
				// official
				if(!f.querykey) throw('.querykey missing for isvcf feature while loading from official dataset')
			} else {
				// to allow loading from custom track
			}
			if(!f.label && f.genename) {
				f.label = f.genename+' LOH'
			}
			tr.append('td')
				.text(f.label)
				.style('color','#858585')
				.style('text-align','right')
			f.legendholder = tr.append('td')

			if(!f.width) f.width=20
			return this.feature_parseposition_maygene( f )
				.then(()=>{
					if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+' mutation'
				})
		}

		if(f.isitd) {
			if(this.dslabel) {
				// official
				if(!f.querykey) throw('.querykey missing for isitd feature while loading from official dataset')
			} else {
				// to allow loading from custom track
			}
			if(!f.label && f.genename) {
				f.label = f.genename+' ITD'
			}

			if(!f.width) f.width=20
			if(!f.color) f.color = common.mclass[ common.mclassitd ].color

			tr.append('td')
				.text(f.label)
				.style('color','#858585')
				.style('text-align','right')
			f.legendholder = tr.append('td')

			// itd legend is fixed, do not refresh with data loading
			f.legendholder.append('div')
				.style('width','20px')
				.html('&nbsp;')
				.style('background',f.color)

			return this.feature_parseposition_maygene( f )
				.then(()=>{
					if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+' ITD'
				})
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
		if(f.isgenevcf) {
			return
		}
		*/

		// __newattr
		throw('unknown feature type')

		})
	}






	get_features(featureset) {
		/*
		may update subset of features instead of all
		TODO server-side clustering on select features to determine sample hierarchy
		*/

		const arg={
			jwt: this.jwt,
			genome: this.genome.name,
			dslabel: this.mds.label,
			limitsamplebyeitherannotation: this.limitsamplebyeitherannotation,
			features: (featureset || this.features).map( feature2arg )
		}

		return fetch(new Request(this.hostURL+'/samplematrix',{
			method:'POST',
			body:JSON.stringify(arg)
		}))
		.then(data=>{return data.json()})
		.then(data=>{

			if(data.error) throw({message:data.error})

			for(const dat of data.results) {
				const f = this.features.find( f=> f.id==dat.id )
				if(!f) throw({message: 'feature not found: '+f.id })

				f.items = dat.items
				this.prepFeatureData( f )
			}

			this.drawMatrix()
		})
	}





	prepFeatureData( f ){
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

		if(f.isloh) {
			const values = f.items.map(i=>i.segmean)
			f.minvalue = 0
			f.maxvalue = Math.max(...values)
			{
				const h=f.legendholder
				h.selectAll('*').remove()
				h.append('span').text(f.minvalue)
				h.append('div')
					.style('margin','2px 10px')
					.style('display','inline-block')
					.style('width','100px')
					.style('height','15px')
					.style('background','linear-gradient( to right, white, '+f.color+')')
				h.append('span').text(f.maxvalue)
			}
			return
		}

		if(f.isvcf) {
			const classes = new Set()
			for(const m of f.items) {
				if(m.dt == common.dtsnvindel) {
					common.vcfcopymclass( m, {} ) // simulate block
				}
				classes.add(m.class)
			}

			{
				const h = f.legendholder
				h.selectAll('*').remove()
				for(const c of classes) {
					const cell = h.append('div')
						.style('display','inline-block')
						.style('margin-right','10px')
					cell.append('span')
						.style('background', common.mclass[c].color)
						.style('margin-right','2px')
						.html('&nbsp;&nbsp;&nbsp;')
					cell.append('span')
						.text(common.mclass[c].label)
						.style('color', common.mclass[c].color)
				}
			}
			return
		}

		if(f.isitd) {
			// do nothing
			return
		}

		// __newattr
		throw('unknown feature type in prepFeatureData')
	}










	/*********** __draw *****/



	drawMatrix() {

		this.svg.selectAll('*').remove()
		const svgg = this.svg.append('g')

		const name2sample = new Map()
		// k: sample name
		// v: {}, may allow additional attributes for further grouping of samples

		for(const feature of this.features) {

			if( feature.isgenevalue || feature.iscnv || feature.isloh || feature.isitd ) {

				for(const item of feature.items) {
					if(!name2sample.has(item.sample)) {
						name2sample.set(item.sample, {})
					}
				}

			} else if(feature.isvcf) {

				for(const m of feature.items) {
					if(m.dt==common.dtsnvindel) {
						if(!m.sampledata) continue
						for(const s of m.sampledata) {
							if(!name2sample.has( s.sampleobj.name )) {
								name2sample.set( s.sampleobj.name, {} )
							}
						}
					} else {
						console.error('unsupported dt from isvcf: '+m.dt)
					}
				}

			} else {
				alert('unknown feature type from this.data')
			}
		}

		const samplelst = []

		for(const [n,sample] of name2sample) {
			sample.height = 14  // XXX hardcoded height
			sample.name = n
			samplelst.push( sample )
		}

		this.sortsamplesbyfeatures( samplelst )

		////// rows, g and label

		let samplenamemaxwidth = 0

		{
			let y=0
			for(const sample of samplelst) {

				sample.g = svgg.append('g')
					.attr('transform','translate(0,'+y+')')
				y += sample.height + this.rowspace

				sample.g.append('text')
					.attr('font-family',client.font)
					.attr('font-size', sample.height-2)
					.attr('text-anchor','end')
					.attr('dominant-baseline','central')
					.attr('x', -this.rowlabspace - this.rowlabticksize)
					.attr('y', sample.height/2 )
					.text( sample.name )
					.each(function(){
						samplenamemaxwidth = Math.max( samplenamemaxwidth, this.getBBox().width )
					})
					.attr('class','sja_clbtext')
					.on('mouseover',()=>{
						this.showTip_sample(sample)
					})
					.on('mouseout',()=>{
						this.tip.hide()
					})
				sample.g.append('line')
					.attr('x1', -this.rowlabticksize)
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
			for(const feature of this.features) {

				const g = svgg.append('g')
					.attr('transform','translate('+ (x+feature.width/2) +',-'+(this.collabspace+this.collabticksize)+')') // feature.g shift to center
				x+= feature.width + this.colspace

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
						this.showTip_feature(feature)
					})
					.on('mouseout',()=>{
						this.tip.hide()
					})
					.on('click', ()=>{
						this.showMenu_feature(feature)
					})

				if(feature.isgenevalue) {
					label.attr('fill', feature.color)
				}

				g.append('line')
					.attr('y1', this.collabspace)
					.attr('y2', this.collabspace+this.collabticksize)
					.attr('stroke','black')
					.attr('shape-rendering','crispEdges')
			}
		}


		// cells
		for(const sample of samplelst) {
			let x=0
			for(const feature of this.features) {
				const cell = sample.g.append('g')
					.attr('transform', 'translate('+x+',0)')

				x += feature.width + this.colspace

				if(feature.isgenevalue) {
					this.drawCell_isgenevalue(sample,feature,cell)
				} else if(feature.iscnv) {
					this.drawCell_iscnv(sample,feature,cell)
				} else if(feature.isloh) {
					this.drawCell_isloh(sample,feature,cell)
				} else if(feature.isvcf) {
					this.drawCell_isvcf(sample,feature,cell)
				} else if(feature.isitd) {
					this.drawCell_isitd(sample,feature,cell)
				} else {
					// __newattr
					console.error('unknown feature type when drawing cell')
				}
			}
		}

		svgg.attr('transform','translate('
			+ (samplenamemaxwidth+this.rowlabspace+this.rowlabticksize)
			+ ',' 
			+ (featurenamemaxwidth+this.collabspace+this.collabticksize)
			+')')

		this.svg.attr('width',
				samplenamemaxwidth +
				this.rowlabspace + this.rowlabticksize +
				this.features.reduce((i,j)=>i+j.width,0) +
				this.features.length * this.colspace )
			.attr('height',
				featurenamemaxwidth+
				this.collabspace + this.collabticksize +
				samplelst.reduce((i,j)=>i+j.height,0) +
				samplelst.length * this.rowspace )
	}




	drawCell_isgenevalue(sample,feature,g) {
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
				this.showTip_cell( sample, feature )
			})
			.on('mouseout',()=>{
				d3event.target.setAttribute('stroke-opacity',0)
				this.tip.hide()
			})
		if(item.value < feature.scale.maxv) {
			rect.attr('fill-opacity', item.value/feature.scale.maxv)
		}
	}


	drawCell_iscnv(sample,feature,g) {
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
				this.showTip_cell( sample, feature )
			})
			.on('mouseout',()=>{
				d3event.target.setAttribute('stroke-opacity',0)
				this.tip.hide()
			})
	}

	drawCell_isloh(sample,feature,g) {
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
				.attr('fill',  feature.color )
				.attr('fill-opacity', (item.segmean-feature.minvalue)/feature.maxvalue)
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
				this.showTip_cell( sample, feature )
			})
			.on('mouseout',()=>{
				d3event.target.setAttribute('stroke-opacity',0)
				this.tip.hide()
			})
	}

	drawCell_isvcf(sample,feature,g) {
		const mlst = getitemforsample_vcf( feature, sample )

		if(mlst.length==0) {
			drawEmptycell(sample, feature, g)
			return
		}

		const class2count = new Map()
		for(const m of mlst) {
			if(!class2count.has(m.class)) {
				class2count.set(m.class,0)
			}
			class2count.set(m.class, class2count.get(m.class)+1)
		}
		let x=0
		for(const [cname, count] of class2count) {
			const span = (count/mlst.length) * feature.width
			g.append('rect')
				.attr('x', x)
				.attr('width', span)
				.attr('height', sample.height)
				.attr('fill', common.mclass[cname].color)
				.attr('shape-rendering','crispEdges')
			x += span
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
				this.showTip_cell( sample, feature )
			})
			.on('mouseout',()=>{
				d3event.target.setAttribute('stroke-opacity',0)
				this.tip.hide()
			})
	}

	drawCell_isitd(sample,feature,g) {
		const item = feature.items.find( i=> i.sample == sample.name )
		if(!item) {
			drawEmptycell(sample, feature, g)
			return
		}
		g.append('rect')
			.attr('width', feature.width)
			.attr('height', sample.height)
			.attr('fill', feature.color)
			.attr('stroke','#ccc')
			.attr('stroke-opacity',0)
			.attr('shape-rendering','crispEdges')
			.on('mouseover',()=>{
				d3event.target.setAttribute('stroke-opacity',1)
				this.showTip_cell( sample, feature )
			})
			.on('mouseout',()=>{
				d3event.target.setAttribute('stroke-opacity',0)
				this.tip.hide()
			})
	}

	/*********** __draw ends *****/










	/********** __menu and tooltip **********/


	showTip_feature(f) {
		this.tip.showunder( d3event.target)
			.clear()
		this.tipContent_feature(f, this.tip.d)
	}


	showMenu_feature( f ) {
		/*
		click feature label for menu options
		*/
		this.menu.showunder( d3event.target)
			.clear()
		this.tipContent_feature(f, this.menu.d)

		this.menu.d.append('div')
			.attr('class','sja_menuoption')
			.text('Remove')
			.on('click',()=>{
				this.menu.hide()
				f.legend_tr.remove()
				this.features.splice( this.features.findIndex(i=>i.id==f.id), 1 )
				this.drawMatrix()
			})

		if(f.isgenevalue) {
			this.showMenu_isgenevalue(f )
			return
		}
		if(f.iscnv) {
			this.showMenu_iscnv(f)
			return
		}
		if(f.isloh) {
			this.showMenu_isloh(f)
			return
		}
		if(f.isitd) {
			// nothing
			return
		}
		// __newattr
	}


	tipContent_feature(f, holder) {
		holder.append('div')
			.text(f.label)
			.style('opacity',.5)
			.style('font-size','.7em')
			.style('margin','10px')

		if(f.isgenevalue || f.iscnv || f.isloh || f.isitd) {
			// show region
			// __newattr
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




	showMenu_isgenevalue(f) {
		this.menu.d.append('div')
			.attr('class','sja_menuoption')
			.text('Sort')
			.on('click',()=>{
				this.menu.hide()
				if(f.sort) {
					// already sorting with this one
					return
				}
				// sort with this one
				for(const f2 of this.features) {
					if(f2.isgenevalue) delete f2.sort
				}
				f.sort=1
				this.drawMatrix()
			})
	}



	showMenu_iscnv(f) {
		// log2ratio cutoff
		{
			const row=this.menu.d.append('div')
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
							this.get_features([f])
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
							this.get_features([f])
						}
					} else {
						// cutoff has not been set
						f.valuecutoff=v
						this.get_features([f])
					}
				})
			row.append('div')
				.style('font-size','.7em')
				.style('opacity',.5)
				.html('Only show CNV with absolute log2(ratio) no less than cutoff.<br>Set to 0 to cancel.')
		}

		// focal cnv
		{
			const row=this.menu.d.append('div')
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
							this.get_features([f])
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
							this.get_features([f])
						}
					} else {
						// cutoff has not been set
						f.focalsizelimit=v
						this.get_features([f])
					}
				})
			row.append('span').text('bp')
			row.append('div')
				.style('font-size','.7em')
				.style('opacity',.5)
				.html('Limit the CNV segment length to show only focal events.<br>Set to 0 to cancel.')
		}
	}





	showMenu_isloh(f) {
		// segmean cutoff
		{
			const row=this.menu.d.append('div')
				.style('margin','10px')
			row.append('span').html('LOH segmean cutoff&nbsp;')
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
							this.get_features([f])
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
							this.get_features([f])
						}
					} else {
						// cutoff has not been set
						f.valuecutoff=v
						this.get_features([f])
					}
				})
			row.append('div')
				.style('font-size','.7em')
				.style('opacity',.5)
				.html('Only show LOH with segmean no less than cutoff.<br>Set to 0 to cancel.')
		}

		// focal cnv
		{
			const row=this.menu.d.append('div')
				.style('margin','10px')
			row.append('span')
				.html('LOH segment size limit&nbsp;')
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
							this.get_features([f])
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
							this.get_features([f])
						}
					} else {
						// cutoff has not been set
						f.focalsizelimit=v
						this.get_features([f])
					}
				})
			row.append('span').text('bp')
			row.append('div')
				.style('font-size','.7em')
				.style('opacity',.5)
				.html('Limit the LOH segment length to show only focal events.<br>Set to 0 to cancel.')
		}
	}





	showTip_sample(sample) {
		this.tip.show(d3event.clientX,d3event.clientY)
			.clear()

		this.tip.d.append('div')
			.text(sample.name)
			.style('padding','10px')
			.style('font-size','.7em')

		const lst = []
		for(const f of this.features) {

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
						+'<span style="font-size:.8em;background:'+(i.value>0?f.colorgain:f.colorloss)+';color:white;padding:1px 5px">'+i.value+'</span>'
						+'</div>'
					})
					text = lst2.join('')
				}
				lst.push({k:f.label, v:text})
				continue
			}

			if(f.isloh) {
				const items = f.items.filter( i=> i.sample==sample.name )
				let text
				if(items.length==0) {
					text = saynovalue
				} else {
					const lst2 = items.map(i=>{
						return '<div>'+i.chr+':'+i.start+'-'+i.stop+' '
						+'<span style="font-size:.7em">'+common.bplen(i.stop-i.start)+'</span> '
						+'<span style="font-size:.8em;background:'+f.color+';color:white;padding:1px 5px">'+i.segmean+'</span>'
						+'</div>'
					})
					text = lst2.join('')
				}
				lst.push({k:f.label, v:text})
				continue
			}

			if(f.isvcf) {
				const mlst = getitemforsample_vcf( f, sample )
				let text
				if(mlst.length==0) {
					text = saynovalue
				} else {
					text = mlst.map( m=>{
						return '<div><span style="color:'+common.mclass[m.class].color+'">'+m.mname+'</span> '
							+'<span style="font-size:.7em;opacity:.5">'+common.mclass[m.class].label+'</span>'
							+'</div>'
					}).join('')
				}
				lst.push({k:f.label, v: text} )
				continue
			}

			if(f.isitd) {
				const items = f.items.filter( i => i.sample==sample.name )
				let text
				if(items.length==0) {
					text = saynovalue
				} else {
					text = '<div style="background:'+f.color+';width:20px">&nbsp;</div>'
				}
				lst.push({k:f.label, v: text} )
				continue
			}

			// __newattr
			console.error('Unknown feature type')
		}

		client.make_table_2col(this.tip.d, lst)
	}





	showTip_cell(sample, f) {
		/*
		a cell
		*/
		this.tip.show(d3event.clientX,d3event.clientY)
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
						+'<span style="font-size:.8em;background:'+(i.value>0?f.colorgain:f.colorloss)+';color:white;padding:1px 5px">'+i.value+'</span>'
						+'</div>'
				})
				text = lst2.join('')
			}
			lst.push({k:f.label, v:text})

		} else if(f.isloh) {

			const items = f.items.filter( i=> i.sample==sample.name )
			let text
			if(items.length==0) {
				text = saynovalue
			} else {
				const lst2 = items.map(i=>{
					return '<div>'+i.chr+':'+i.start+'-'+i.stop+' '
						+'<span style="font-size:.7em">'+common.bplen(i.stop-i.start)+'</span> '
						+'<span style="font-size:.8em;background:'+f.color+';color:white;padding:1px 5px">'+i.segmean+'</span>'
						+'</div>'
				})
				text = lst2.join('')
			}
			lst.push({k:f.label, v:text})

		} else if(f.isvcf) {

			const mlst = getitemforsample_vcf( f, sample )
			let text
			if(mlst.length==0) {
				text = saynovalue
			} else {
				text = mlst.map( m=>{
					return '<div><span style="color:'+common.mclass[m.class].color+'">'+m.mname+'</span> '
						+'<span style="font-size:.7em;opacity:.5">'+common.mclass[m.class].label+'</span>'
						+'</div>'
				}).join('')
			}
			lst.push({k:f.label, v: text} )

		} else if(f.isitd) {

			const items = f.items.filter( i=> i.sample==sample.name )
			let text
			if(items.length==0) {
				text = saynovalue
			} else {
				const lst2 = items.map(i=>{
					return '<div>'+i.chr+':'+i.start+'-'+i.stop+' '
						+'</div>'
				})
				text = lst2.join('')
			}
			lst.push({k:f.label, v:text})
			
		} else {
			// __newattr
			console.error('unknown feature type')
		}


		client.make_table_2col(this.tip.d, lst)
	}

	/********** __menu ends **********/




	sortsamplesbyfeatures(samplelst) {

		// check if sorting is enabled on any one of isgenevalue
		const sortbygenevalue = this.features.find( f => f.isgenevalue && f.sort )
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

	// end of class
}










function drawEmptycell(sample,feature,g) {
	g.append('line')
		.attr('x2',feature.width)
		.attr('y2',sample.height)
		.attr('stroke','#ccc')
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
	if(f.isloh) {
		return {
			id:f.id,
			isloh:1,
			querykey:f.querykey,
			chr:f.chr,
			start:f.start,
			stop:f.stop,
			valuecutoff:f.valuecutoff,
			focalsizelimit:f.focalsizelimit,
		}
	}
	if(f.isvcf) {
		return {
			id:f.id,
			isvcf:1,
			querykey:f.querykey,
			chr:f.chr,
			start: f.start,
			stop: f.stop
		}
	}
	if(f.isitd) {
		return {
			id:f.id,
			isitd:1,
			querykey:f.querykey,
			chr:f.chr,
			start: f.start,
			stop: f.stop
		}
	}
	// __newattr
	throw('unknown feature type in feature2arg')
}



function getitemforsample_vcf( feature, sample ) {
	const mlst=[]
	for(const m of feature.items) {
		if(m.dt==common.dtsnvindel) {
			if(m.sampledata.findIndex( i=> i.sampleobj.name==sample.name)!=-1) {
				mlst.push(m)
			}
		} else {
			console.error('getitemforsample_vcf: unknown dt')
		}
	}
	return mlst
}
