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
		this.svg = this.holder.append('svg')

		this.validateconfig()
		.then(()=>{
			this.getfeatures()
		})
		.catch(err=>{
			this.error(err)
		})

		///////////// end of constructor
	}





	error( m ) {
		client.sayerror( this.errdiv, m )
	}




	validateconfig() {
		/*
		only run once, upon init
		*/

		return Promise.resolve().then(()=>{

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

			// last
			// any feature with gene to get position
			const genewithoutpos=new Set()
			for(const f of this.features) {
				if(f.isgenevalue || f.iscnv) {
					if(f.genename && !f.position && !f.chr) genewithoutpos.add(f.genename)
				}
			}
			if(genewithoutpos.size==0) return

			const tasks=[]
			for(const gene of genewithoutpos) {

				const q = fetch(new Request(this.hostURL+'/genelookup',{
					method:'POST',
					body:JSON.stringify({
						input:gene,
						genome:this.genome.name,
						jwt:this.jwt,
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
				for(const f of this.features) {
					if(f.isgenevalue || f.iscnv) {
						if(f.genename && !f.position && !f.chr) {
							if(!gene2coord[f.genename]) throw('unknown gene name: '+f.genename)
							if(gene2coord[f.genename].length>1) {
								client.sayerror(this.errdiv,'multiple regions found for gene '+f.genename+' you\'d better specify one in feature')
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

			for(const feature of this.features) {

				const err = this.validatefeature( feature )
				if(err) throw(err)
			}
		})
	}




	validatefeature( f ) {

		f.id = Math.random().toString()

		const tr = this.legendtable.append('tr')
		f.legend_tr = tr

		if(f.isgenevalue) {
			// numerical value per sample
			if(!f.genename) return '.genename missing for isgenevalue feature'
			f.label = f.genename+' expression'

			{
				const err = invalidcoord(this.genome, f.chr, f.start, f.stop)
				if(err) return 'position error for isgenevalue feature: '+err
			}

			if(this.dslabel) {
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
				const err = invalidcoord( this.genome, f.chr, f.start, f.stop)
				if(err) return 'position error for iscnv feature: '+err
			}
			if(this.dslabel) {
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

		if(f.isloh) {
			// loh with segmean
			{
				const err = invalidcoord( this.genome, f.chr, f.start, f.stop)
				if(err) return 'position error for isloh feature: '+err
			}
			if(this.dslabel) {
				// official
				if(!f.querykey) return '.querykey missing for isloh feature while loading from official dataset'
			} else {
				// to allow loading from custom track
			}
			if(!f.label && f.genename) {
				f.label = f.genename+' LOH'
			}
			if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+' LOH'
			tr.append('td')
				.text(f.label)
				.style('color','#858585')
				.style('text-align','right')
			f.legendholder = tr.append('td')

			if(!f.width) f.width=40
			f.coordscale = scaleLinear().domain([f.start,f.stop]).range([0, f.width]) // scale must be reset when coord/width changes
			if(!f.color) f.color = "black"
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
		if(f.issnvindel) {
			return
		}
		if(f.isgenevcf) {
			return
		}
		*/

		return 'type unknown for one feature'
	}






	getfeatures(featureset) {
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

		fetch(new Request(this.hostURL+'/samplematrix',{
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
		.catch(err=>{
			this.error(err.message)
			if(err.stack) console.log(err.stack)
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
	}










	/*********** __draw *****/



	drawMatrix() {

		this.svg.selectAll('*').remove()
		const svgg = this.svg.append('g')

		const name2sample = new Map()
		// k: sample name
		// v: {}, may allow additional attributes for further grouping of samples

		for(const feature of this.features) {

			if( feature.isgenevalue || feature.iscnv || feature.isloh ) {

				for(const item of feature.items) {
					if(!name2sample.has(item.sample)) {
						name2sample.set(item.sample, {})
					}
				}

			} else {
				alert('unknown feature type from this.data')
			}
		}

		const samplelst = []

		for(const [n,sample] of name2sample) {
			sample.height = 14
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

				this.drawCell( sample, feature, cell)
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




	drawCell(sample,feature,g) {
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
					this.showTip_cell( sample, feature )
				})
				.on('mouseout',()=>{
					d3event.target.setAttribute('stroke-opacity',0)
					this.tip.hide()
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
					this.showTip_cell( sample, feature )
				})
				.on('mouseout',()=>{
					d3event.target.setAttribute('stroke-opacity',0)
					this.tip.hide()
				})
			return
		}

		if(feature.isloh) {
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
			return
		}
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
	}


	tipContent_feature(f, holder) {
		holder.append('div')
			.text(f.label)
			.style('opacity',.5)
			.style('font-size','.7em')
			.style('margin','10px')

		if(f.isgenevalue || f.iscnv || f.isloh) {
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
							this.getfeatures([f])
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
							this.getfeatures([f])
						}
					} else {
						// cutoff has not been set
						f.valuecutoff=v
						this.getfeatures([f])
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
							this.getfeatures([f])
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
							this.getfeatures([f])
						}
					} else {
						// cutoff has not been set
						f.focalsizelimit=v
						this.getfeatures([f])
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
							this.getfeatures([f])
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
							this.getfeatures([f])
						}
					} else {
						// cutoff has not been set
						f.valuecutoff=v
						this.getfeatures([f])
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
							this.getfeatures([f])
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
							this.getfeatures([f])
						}
					} else {
						// cutoff has not been set
						f.focalsizelimit=v
						this.getfeatures([f])
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
			}

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
}
