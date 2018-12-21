import * as client from './client'
import {string2pos, invalidcoord} from './coord'
import {event as d3event} from 'd3-selection'
import * as common from './common'
import {scaleLinear,scaleOrdinal,schemeCategory10} from 'd3-scale'
import {showMenu_isgenevalue, showMenu_iscnv, showMenu_isloh, showMenu_ismutation} from './samplematrix.featuremenu'
import {vcfparsemeta} from './vcf'




/*
build a sample by feature matrix

primarily, retrieve feature values from mds

hardcoded: rows for samples, cols for features

JUMP __draw __menu
	__newattr places for adding new feature

****************** exposed methods (as in block.mds.svcnv.samplematrix.js)
.validate_feature()
.addnewfeature_update()
.error()

****************** internal use
.validate_config()
.get_features()
.update_singlefeature()
.draw_matrix()
.drawCell_ismutation
.drawCell_ismutation_symbolic
.prep_featuredata()
.make_legend()
.showTip_sample
.showTip_feature
.showTip_cell
.showMenu_feature
.gatherSamplesFromFeatureData
.click_cell
feature2arg()
initfeature_polymutation



TODO - retrieve features from assay tracks, using an assay type
*/


const saynovalue='na'
const default_cnvgaincolor = "#D6683C"
const default_cnvlosscolor = "#67a9cf"
const default_genevaluecolor = '#095873'
const default_lohcolor = '#858585'
const default_svcolor = '#858585'

const minheight2showname = 8


export class Samplematrix {
	/*
	init ui
	*/

	constructor( p ) {

		for(const k in p) {
			this[k] = p[k]
		}
		if(this.debugmode) window.smat = this
		this.tip  = new client.Menu({padding:'0px', hideXmute: 1, hideYmute: 1})
		this.menu = new client.Menu({padding:'0px'})
		this.errdiv = this.holder.append('div')

		init_controlui(this)

		if(this.header) {
			this.holder.append('div')
				.style('margin-bottom','20px')
				.html(this.header)
		}

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

			if(!this.iscustom) {

				// official dataset

				if(!this.dslabel) throw('not custom data but dslabel is missing')
				// accessing a native ds
				this.mds = this.genome.datasets[this.dslabel]
				if(!this.mds) throw('invalid dataset name: '+this.dslabel)
				if(!this.mds.isMds) throw('improper dataset: '+this.dslabel)
				return
			}

			// load from custom dataset: may cache vcf header

			if(!this.querykey2tracks) throw('querykey2tracks missing for custom dataset')

			let novalidtk=true
			for(const key in this.querykey2tracks) {
				// key is arbitrary
				const tk = this.querykey2tracks[ key ]
				if(!tk.file && !tk.url) throw('no file or url for a custom track by key '+key)
				if(!tk.type) throw('missing type for member track by key '+key)
				if(!common.validtkt( tk.type )) throw('invalid type for a member track: '+tk.type)
				novalidtk=false
			}
			if(novalidtk) throw('no custom tracks from querykey2tracks')

			/*
			for custom dataset, allows one vcf file
			FIXME may allow more than one
			if it comes from mdssvcnv/mdsgeneral, the vcf header has already been parsed
			otherwise, fetch header
			*/
			let vcftk
			for(const key in this.querykey2tracks) {
				const tk = this.querykey2tracks[key]
				if(tk.type == common.tkt.mdsvcf) {
					vcftk = tk
				}
			}

			if(!vcftk) {
				// no vcf track
				return
			}

			return this.may_init_customvcf(vcftk)

		})
		.then(()=>{

			if(this.limitsamplebyeitherannotation) {
				if(!Array.isArray(this.limitsamplebyeitherannotation)) throw('limitsamplebyeitherannotation must be an array')
				const tr = this.legendtable.append('tr')
				for(const anno of this.limitsamplebyeitherannotation) {
					if(!anno.key) throw('.key missing from an element of limitsamplebyeitherannotation')
					if(!anno.value) throw('.value missing from an element of limitsamplebyeitherannotation')
				}
				this.showlegend_limitsample()
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



	showlegend_limitsample() {
		if(!this.limitsamplebyeitherannotation) return
		// to show these in legend
	}




	feature_parseposition_maygene( f ) {
		/*
		for position-based features
		only called by validate_feature()
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
					throw('feature "'+f.label+'" position error: '+err)
				} else {
					// has valid position
					return
				}
			}

			if( !f.genename ) throw 'position required for a feature: no position or genename given'

			// fetch position by gene name
			return client.dofetch('/genelookup', {
				input:f.genename,
				genome:this.genome.name,
				deep:1
			})
			.then(data=>{
				if(data.error) throw data.error
				if(!data.gmlst || data.gmlst.length==0) throw 'no gene can be found for '+f.genename
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
				.style('opacity',.5)
				.style('text-align','right')
			f.legendholder = tr.append('td')

			if(!f.width) f.width = 20
			if(!f.color) f.color = default_genevaluecolor

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
				.style('opacity',.5)
				.style('text-align','right')
			f.legendholder = tr.append('td')

			if(!f.width) f.width=40
			if(!f.colorgain) f.colorgain = default_cnvgaincolor
			if(!f.colorloss) f.colorloss = default_cnvlosscolor

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
				.style('opacity',.5)
				.style('text-align','right')
			f.legendholder = tr.append('td')

			if(!f.width) f.width=40
			if(!f.color) f.color = default_lohcolor

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
				f.label = f.genename+' SNV/indel'
			}
			tr.append('td')
				.text(f.label)
				.style('opacity',.5)
				.style('text-align','right')
			f.legendholder = tr.append('td')

			if(!f.width) f.width=20
			if(!f.snvindel) f.snvindel = {}

			return this.feature_parseposition_maygene( f )
				.then(()=>{
					if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+' SNV/indel'
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
				.style('opacity',.5)
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

		if(f.issvfusion) {
			if(this.dslabel) {
				// official
				if(!f.querykey) throw('.querykey missing for issvfusion feature while loading from official dataset')
			} else {
				// to allow loading from custom track
			}
			if(!f.label && f.genename) {
				f.label = f.genename+' SV/fusion'
			}

			if(!f.width) f.width=20
			if(!f.color) f.color = default_svcolor

			tr.append('td')
				.text(f.label)
				.style('opacity',.5)
				.style('text-align','right')
			f.legendholder = tr.append('td')

			return this.feature_parseposition_maygene( f )
				.then(()=>{
					if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+' SV/fusion'
				})
		}

		if(f.issvcnv) {

			// loading from a single svcnv file, with multiple types of data

			if(this.dslabel) {
				// official
				if(!f.querykey) throw('.querykey missing for issvcnv feature while loading from official dataset')
			} else {
				// to allow loading from custom track
			}
			if(!f.label && f.genename) {
				f.label = f.genename+' CNV/SV'
			}

			tr.append('td')
				.text(f.label)
				.style('color','#858585')
				.style('text-align','right')
			f.legendholder = tr.append('td')

			initfeature_polymutation( f )

			return this.feature_parseposition_maygene( f )
				.then(()=>{
					if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+' CNV/SV'
				})
		}


		if(f.ismutation) {
			// loading from one or more files, svcnv or vcf, for multiple types of marks

			if(this.dslabel) {
				// official
				if(!f.querykeylst) throw('.querykeylst missing for ismutation feature')
				if(!Array.isArray(f.querykeylst)) throw('.querykeylst[] should be array for ismutation feature')
				if(f.querykeylst.length==0) throw('querykeylst[] empty array for ismutation feature')
			} else {
				// to allow loading from custom track
			}
			if(!f.label && f.genename) {
				f.label = f.genename+' mutation'
			}

			tr.append('td')
				.text(f.label)
				.style('opacity',.5)
				.style('text-align','right')
			f.legendholder = tr.append('td')

			initfeature_polymutation( f )

			return this.feature_parseposition_maygene( f )
				.then(()=>{
					if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+' mutation'
					/*
					scale must be reset when coord/width changes
					*/
					f.coordscale = scaleLinear().domain([f.start,f.stop]).range([0, f.width])
				})
		}


		if(f.issampleattribute) {
			if(!this.dslabel) throw('.dslabel missing: sampleattribute only works for official dataset')
			if(!f.key) throw('.key missing for issampleattribute feature')
			if(!f.label) f.label = f.key
			// allow this feature to be not available on client
			if(this.mds && this.mds.sampleAttribute && this.mds.sampleAttribute.attributes) {
				const registry = this.mds.sampleAttribute.attributes[ f.key ]
				if(registry) {
					f.values = registry.values
				}
			}
			if(!f.values) {
				f.values = {}
			}
			f.assignmissingcolor = scaleOrdinal(schemeCategory10)
			if(!f.width) f.width=20

			tr.append('td')
				.text(f.label)
				.style('opacity',.5)
				.style('text-align','right')
			f.legendholder = tr.append('td')

			return Promise.resolve()
		}


		// __newattr
		throw('unknown feature type in validating feature')

		})
	}






	get_features(featureset) {
		/*
		TODO server-side clustering on select features to determine sample hierarchy
		*/

		const arg={
			genome: this.genome.name,
			limitsamplebyeitherannotation: this.limitsamplebyeitherannotation,
			features: (featureset || this.features).map( feature2arg )
		}

		if(this.iscustom) {

			arg.iscustom=1
			arg.querykey2tracks = {}
			// only provide tracks from current feature set, so the bulky vcf object won't be sent when only the cnv feature is updated
			for( const f of arg.features ) {
				arg.querykey2tracks[ f.querykey ] = this.querykey2tracks[ f.querykey ]
			}

		} else {
			arg.dslabel = this.mds.label
		}

		return client.dofetch('/samplematrix',arg)
		.then(data=>{

			if(data.error) {
				/* something's wrong about this feature e.g. look range too big
				server refused to provide data
				still must assign empty array of items
				in order for other methods to work!
				*/
				for(const f0 of arg.features) {
					const f = this.features.find(f=> f.id==f0.id)
					if(f) f.items=[]
				}
				throw data.error
			}

			for(const dat of data.results) {
				const f = this.features.find( f=> f.id==dat.id )
				if(!f) throw 'feature not found: '+f.id

				f.items = dat.items
				this.prep_featuredata( f )
			}

			this.draw_matrix()
			this.make_legend()
		})
	}


	update_singlefeature(f) {
		/*
		update a single feature
		do not return promise
		*/

		this.get_features([f])
		.catch(err=>{
			if(typeof(err)=='string') {
				this.error(err)
			} else {
				this.error(err.message)
				if(err.stack) console.log(err.stack)
			}
		})
	}



	addnewfeature_update( f ) {
		/*
		add a new feature, get data, update and done
		no return promise
		*/

		this.features.push( f )

		this.validate_feature( f )
		.then(()=>{
			return this.get_features( [f] )
		})
		.catch(err=>{
			this.error( typeof(err)=='string' ? err : err.message )
			if(err.stack) console.log(err.stack)
		})
	}





	prep_featuredata( f ){
		/*
		after getting data from query
		prepare feature data for rendering
		*/
		if(f.isgenevalue) {

			// gene-level expression value, get max value
			// TODO other types of scaling
			f.scale.maxv=0
			f.scale.minv=0
			for(const i of f.items) {
				f.scale.maxv = Math.max(f.scale.maxv, i.value)
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
					loss.push(-i.value)
				}
			}
			const gmax = common.getMax_byiqr( gain, 0 )
			const lmax = common.getMax_byiqr( loss, 0 )
			f.maxabslogratio = Math.max(gmax, lmax)
			return
		}

		if(f.isloh) {
			const values = f.items.map(i=>i.segmean)
			f.minvalue = 0
			f.maxvalue = Math.max(...values)
			return
		}

		if(f.isvcf) {
			return
		}

		if(f.isitd) {
			return
		}

		if(f.issvfusion) {
			return
		}

		if(f.issvcnv || f.ismutation) {

			// compound

			const cnvgain=[], cnvloss=[] // cnv log2 ratio
			let lohmax=0

			for(const i of f.items) {

				if(i.dt == common.dtcnv) {
					if(i.value>0) {
						cnvgain.push(i.value)
					} else {
						cnvloss.push(-i.value)
					}
				} else if(i.dt == common.dtloh) {
					lohmax = Math.max( i.segmean, lohmax )
				}
			}

			if(cnvgain.length + cnvloss.length > 0) {
				const gmax = common.getMax_byiqr( cnvgain, 0 )
				const lmax = common.getMax_byiqr( cnvloss, 0 )
				f.cnv.maxabslogratio = Math.max(gmax, lmax)
			}

			if(lohmax) {
				f.loh.minvalue=0
				f.loh.maxvalue=lohmax
			}
			return
		}

		if(f.issampleattribute) {
			// set color for unknown value
			for(const i of f.items) {
				if(!f.values[i.value]) {
					// a unknown value, still support it
					f.values[i.value] = {
						name: i.value,
						color: f.assignmissingcolor( i.value )
					}
				}
			}
			return
		}

		// __newattr
		throw 'unknown feature type in preparing feature data'
	}



	make_legend() {
		/*
		after parsing data for each feature, and getting the total list of samples
		make legend for each feature
		*/
		for(const f of this.features) {

			const h = f.legendholder
			h.selectAll('*').remove()

			if(f.isgenevalue) {
				h.append('span').text(f.scale.minv)
				h.append('div')
					.style('margin','2px 10px')
					.style('display','inline-block')
					.style('width','100px')
					.style('height','15px')
					.style('background','linear-gradient( to right, white, '+f.color+')')
				h.append('span').text(f.scale.maxv)
				continue
			}

			if(f.iscnv) {
				h.append('span').html('Gain <span style="background:'+f.colorgain+';color:white;padding:1px 5px">'+f.maxabslogratio+'</span> &nbsp; '
					+'Loss <span style="background:'+f.colorloss+';color:white;padding:1px 5px">-'+f.maxabslogratio+'</span>'
					)
				continue
			}

			if(f.isloh) {
				h.append('span').text(f.minvalue)
				h.append('div')
					.style('margin','2px 10px')
					.style('display','inline-block')
					.style('width','100px')
					.style('height','15px')
					.style('background','linear-gradient( to right, white, '+f.color+')')
				h.append('span').text(f.maxvalue)
				continue
			}

			if(f.isvcf) {
				const classes = new Set()
				for(const m of f.items) {
					if(m.class) {
						classes.add(m.class)
					} else {
						//  no class?
					}
				}
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
				continue
			}

			if(f.isitd) {
				continue
			}

			if(f.issvfusion) {
				continue
			}

			if(f.issvcnv || f.ismutation) {

				const vcfclass2count = new Map() // k: class, v: sample count
				let itdcount=0
				let svcount=0
				let fusioncount=0

				for(const i of f.items) {

					if(i.dt == common.dtsnvindel) {

						if(i.class && i.sampledata) {
							if(!vcfclass2count.has(i.class)) {
								vcfclass2count.set( i.class, 0 )
							}
							vcfclass2count.set( i.class, vcfclass2count.get(i.class) + i.sampledata.length )
						} else {
							// ?
						}

					} else if(i.dt == common.dtitd) {
						itdcount++
					} else if(i.dt==common.dtsv) {
						svcount++
					} else if(i.dt==common.dtfusionrna) {
						fusioncount++
					}
				}

				if( vcfclass2count.size + itdcount + svcount + fusioncount > 0 ) {

					// put them in same row
					const row=h.append('div')
						.style('margin-bottom','5px')
						.style('white-space','nowrap')

					for(const [classname, count] of vcfclass2count) {
						const c = common.mclass[classname]
						const cell = row.append('div')
							.style('display','inline-block')
							.style('margin-right','20px')
						cell.append('span')
							.attr('class','sja_mcdot')
							.style('background', c.color)
							.text(count)
						cell.append('span')
							.text(c.label)
							.style('color', c.color)
					}
					if(itdcount) {
						const cell = row.append('div')
							.style('display','inline-block')
							.style('margin-right','20px')
						cell.append('span')
							.attr('class','sja_mcdot')
							.style('background', f.itd.color)
							.text(itdcount)
						cell.append('span')
							.text('ITD')
					}
					if(svcount) {
						const cell = row.append('div')
							.style('display','inline-block')
							.style('margin-right','20px')
						cell.append('span')
							.attr('class','sja_mcdot')
							.style('background', f.sv.color)
							.text(svcount)
						cell.append('span')
							.text('SV')
					}
					if(fusioncount) {
						const cell=row.append('div')
							.style('display','inline-block')
							.style('margin-right','20px')
						cell.append('span')
							.attr('class','sja_mcdot')
							.style('background', f.fusion.color)
							.text(fusioncount)
						cell.append('span')
							.text('Fusion')
					}
				}
				if(f.cnv.maxabslogratio!=undefined) {
					h.append('div')
						.style('margin-bottom','5px')
						.html(
							'CNV gain <span style="background:'+f.cnv.colorgain+';color:white;padding:1px 5px">'+f.cnv.maxabslogratio+'</span> &nbsp; '
							+'CNV loss <span style="background:'+f.cnv.colorloss+';color:white;padding:1px 5px">-'+f.cnv.maxabslogratio+'</span>'
						)
				}

				if(f.loh.maxvalue!=undefined) {
					const row = h.append('div')
						.style('margin-bottom','5px')
					row.append('span')
						.text('LOH seg.mean: '+f.loh.minvalue)
					row.append('div')
						.style('margin','2px 10px')
						.style('display','inline-block')
						.style('width','100px')
						.style('height','15px')
						.style('background','linear-gradient( to right, white, '+f.loh.color+')')
					row.append('span').text(f.loh.maxvalue)
				}
				continue
			}

/*
show legend for sampleattribute
sort samples by f.issampleattribute
*/
			if(f.issampleattribute) {
				const value2count = new Map()
				for(const sample of this.samples) {
					const anno = f.items.find( i=> i.sample == sample.name)
					if(anno) {
						value2count.set( anno.value, (value2count.get(anno.value) || 0)+1 )
					}
				}
				for(const [value, count] of value2count) {
					const cell = h.append('div')
						.style('display','inline-block')
						.style('margin-right','20px')
					cell.append('span')
						.attr('class','sja_mcdot')
						.style('background', f.values[value].color )
						.text(count)
					cell.append('span')
						.text( f.values[value].name )
				}
				continue
			}

			// __newattr
			throw 'unknown feature type in making legend'
		}
	}










	gatherSamplesFromFeatureData() {
		/*
		gather samples from feature data
		call after updating any feature, in draw_matrix()
		will set height for samples
		*/

		const name2sample = new Map()
		// k: sample name
		// v: {}, may allow additional attributes for further grouping of samples

		for(const feature of this.features) {

			if(feature.donotaddsample) {
				// not adding sample from this feature
				continue
			}



			if( feature.isgenevalue || feature.iscnv || feature.isloh || feature.isitd || feature.issvfusion || feature.issvcnv ) {

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

			} else if(feature.ismutation) {
				for(const m of feature.items) {
					if(m.dt==common.dtsnvindel) {
						if(!m.sampledata) continue
						for(const s of m.sampledata) {
							if(!name2sample.has( s.sampleobj.name )) {
								name2sample.set( s.sampleobj.name, {} )
							}
						}
					} else {
						if(!m.sample) continue
						if(!name2sample.has(m.sample)) {
							name2sample.set(m.sample, {})
						}
					}
				}

			} else if(feature.issampleattribute) {
				for(const i of feature.items) {
					if(!name2sample.has(i.sample)) {
						name2sample.set(i.sample, {})
					}
				}
			} else {
				// __newattr
				console.error('unknown feature type from this.data')
			}
		}

		// set equal height for all samples
		const uniformheight = Math.min(18, Math.max( 1, Math.ceil(800/name2sample.size) ) )

		this.samples = []

		for(const [n,sample] of name2sample) {
			sample.height = uniformheight
			sample.name = n
			this.samples.push( sample )
		}
	}




	/*********** __draw *****/



	draw_matrix() {

		this.svg.selectAll('*').remove()
		const svgg = this.svg.append('g')

		this.gatherSamplesFromFeatureData()

		this.sortsamplesbyfeatures()

		////// rows, g and label

		let samplenamemaxwidth = 0

		{
			let y=0
			for(const sample of this.samples) {

				sample.g = svgg.append('g')
					.attr('transform','translate(0,'+y+')')
				y += sample.height + this.rowspace

				if(sample.height >= minheight2showname) {
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
				}

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
		for(const sample of this.samples) {
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
				} else if(feature.issvfusion) {
					this.drawCell_issvfusion(sample,feature,cell)
				} else if(feature.issvcnv || feature.ismutation) {
					this.drawCell_ismutation(sample,feature,cell)
				} else if(feature.issampleattribute) {
					this.drawCell_issampleattribute(sample,feature,cell)
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
				this.samples.reduce((i,j)=>i+j.height,0) +
				this.samples.length * this.rowspace )
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
			.on('click',()=> {
				this.click_cell(sample, feature)
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
			.on('click',()=> {
				this.click_cell(sample, feature)
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
			.on('click',()=> {
				this.click_cell(sample, feature)
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
			.on('click',()=> {
				this.click_cell(sample, feature)
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
			.on('click',()=> {
				this.click_cell(sample, feature)
			})
	}

	drawCell_issampleattribute(sample,feature,g) {
		const item = feature.items.find( i=> i.sample == sample.name )
		if(!item) {
			drawEmptycell(sample, feature, g)
			return
		}
		g.append('rect')
			.attr('width', feature.width)
			.attr('height', sample.height)
			.attr('fill', feature.values[item.value].color)
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
			.on('click',()=> {
				this.click_cell(sample, feature)
			})
	}

	drawCell_issvfusion(sample,feature,g) {
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
			.on('click',()=> {
				this.click_cell(sample, feature)
			})
	}



	drawCell_ismutation(sample,feature,g) {
		/*
		for features ismutation & issvcnv

		drawing order:
		cnv/loh/itd > sv/fusion > snvindel

		*/

		const [ cnv, loh, itd, sv, fusion, snvindel ] = getitemforsample_compound( feature, sample )
		/*
		returns array for each data type
		if multiple items in an array, only use information from first item to draw!!
		*/

		if(cnv.length+loh.length+itd.length+sv.length+fusion.length+snvindel.length == 0) {
			drawEmptycell(sample, feature, g)
			return
		}

		// decide if to draw as symbolic
		let is_symbolic=false

		if(this.ismutation_allsymbolic) {
			is_symbolic=true
		} else if(this.ismutation_allnotsymbolic) {
			// not
		} else {
			// if height is too thin
			if(sample.height<=4) {
				is_symbolic=true
			}
		}


		if(is_symbolic) {

			// thin lines
			this.drawCell_ismutation_symbolic(sample,feature,g, cnv, loh, itd, sv, fusion, snvindel )

		} else {

			if(loh.length) {
				// draw loh as singlular filled-box at bottom
				for(const item of loh) {
					const x1 = feature.coordscale( Math.max(feature.start, item.start) )
					const x2 = feature.coordscale( Math.min(feature.stop, item.stop) )
					g.append('rect')
						.attr('x', x1)
						.attr('width', Math.max(1, x2-x1))
						.attr('height', sample.height)
						.attr('fill', feature.loh.color )
						.attr('fill-opacity', (item.segmean-feature.loh.minvalue) / (feature.loh.maxvalue-feature.loh.minvalue) )
						.attr('shape-rendering','crispEdges')
				}
			}

			if(cnv.length) {
				for(const item of cnv) {
					const x1 = feature.coordscale( Math.max(feature.start, item.start) )
					const x2 = feature.coordscale( Math.min(feature.stop, item.stop) )
					g.append('rect')
						.attr('x', x1)
						.attr('width', Math.max(1, x2-x1) )
						.attr('height', sample.height)
						.attr('fill',  item.value>0 ? feature.cnv.colorgain : feature.cnv.colorloss )
						.attr('fill-opacity', Math.abs(item.value)/feature.cnv.maxabslogratio)
						.attr('shape-rendering','crispEdges')
				}
			}
			if(itd.length) {
				for(const item of itd) {
					const x1 = feature.coordscale( Math.max(feature.start, item.start) )
					const x2 = feature.coordscale( Math.min(feature.stop, item.stop) )
					g.append('rect')
						.attr('x', x1)
						.attr('width', Math.max(1, x2-x1) )
						.attr('height', sample.height)
						.attr('fill', feature.itd.color )
						.attr('shape-rendering','crispEdges')
				}
			}
			if(sv.length) {
				// sv as feature-less circle
				g.append('circle')
					.attr('cx', feature.width/2 )
					.attr('cy', sample.height/2 )
					.attr('r', Math.min(feature.width, sample.height) /2 )
					.attr('stroke', feature.sv.color)
					.attr('fill', 'none')
			}
			if(fusion.length) {
				// fusion as feature-less circle
				g.append('circle')
					.attr('cx', feature.width/2 )
					.attr('cy', sample.height/2 )
					.attr('r', Math.min(feature.width, sample.height) /2 )
					.attr('stroke', feature.fusion.color)
					.attr('fill', 'none')
			}

			if(snvindel.length) {
				/*
				snvindel as cross
				color by m class
				if multiple variants, may use class of highest rank
				*/
				const m = snvindel[0]
				const g2 = g.append('g')
					.attr('transform','translate('+(feature.width/2)+','+(sample.height/2)+')')
				const color = common.mclass[ m.m.class ].color
				const w = Math.min(feature.width, sample.height)/2
				g2.append('line')
					.attr('x1', -w)
					.attr('x2', w)
					.attr('y1', -w)
					.attr('y2', w)
					.attr('stroke', 'white')
					.attr('stroke-width',3)
				g2.append('line')
					.attr('x1', -w)
					.attr('x2', w)
					.attr('y1', w)
					.attr('y2', -w)
					.attr('stroke', 'white')
					.attr('stroke-width',3)
				g2.append('line')
					.attr('x1', -w)
					.attr('x2', w)
					.attr('y1', -w)
					.attr('y2', w)
					.attr('stroke', color)
				g2.append('line')
					.attr('x1', -w)
					.attr('x2', w)
					.attr('y1', w)
					.attr('y2', -w)
					.attr('stroke', color)
			}
		}

		// cover
		g.append('rect')
			.attr('width', feature.width)
			.attr('height', sample.height)
			.attr('fill', 'white')
			.attr('fill-opacity', 0)
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
			.on('click',()=> {
				this.click_cell(sample, feature)
			})
	}



	drawCell_ismutation_symbolic(sample,feature,g, cnv, loh, itd, sv, fusion, snvindel) {
		/*
		symbolic rep
		must have data
		*/
		const lst = []
		if(cnv.length) {
			for(const i of cnv) {
				let k
				if(i.value>0) {
					k = { color: feature.cnv.colorgain }
				} else {
					k = {color:feature.cnv.colorloss}
				}
				k.opacity = Math.abs(i.value)/feature.cnv.maxabslogratio
				lst.push(k)
			}
		}
		if(loh.length) {
			for(const i of loh) {
				lst.push({
					color:feature.loh.color,
					opacity: (i.segmean-feature.loh.minvalue) / (feature.loh.maxvalue-feature.loh.minvalue)
					})
			}
		}
		if(itd.length) {
			for(const i of itd) {
				lst.push({color:feature.itd.color})
			}
		}
		if(sv.length) {
			for(const i of sv) {
				lst.push({color: feature.sv.color})
			}
		}
		if(fusion.length) {
			for(const i of fusion) {
				lst.push({color: feature.fusion.color})
			}
		}
		if(snvindel.length) {
			for(const i of snvindel) {
				lst.push({color: common.mclass[ i.m.class].color })
			}
		}
		const w = feature.width / lst.length
		let x=0
		for(const i of lst) {
			const r = g.append('rect')
				.attr('x', x)
				.attr('width', w)
				.attr('height', sample.height)
				.attr('fill', i.color )
				.attr('shape-rendering','crispEdges')
			if(i.opacity) r.attr('opacity', i.opacity)
			x+=w
		}
	}




	// __newattr draw cell for new feature

	/*********** __draw ends *****/





	click_cell( sample, feature ) {
		/*
		browser view of single sample, to show whatever data's available from the dataset, irrespective of feature type
		feature provides view range

		some duplication from focus_singlesample(), on fetching assay track for requested sample
		since there is no block here, so cannot call the existing function

		*/

		Promise.resolve().then(()=>{

			// not general track yet -- still need the svcnv track as trunk
			let svcnvtk
			if(this.iscustom) {
			} else {
				if(!this.mds) throw('not custom but .mds{} missing')
				for(const querykey in this.mds.queries) {
					const tk = this.mds.queries[ querykey ]
					if(tk.type == common.tkt.mdssvcnv) {
						// found svcnv from official, must keep the querykey, so build new object
						svcnvtk = {
							mds: this.mds,
							querykey: querykey,
							singlesample:{
								name: sample.name
							}
						}
						for(const k in tk) svcnvtk[k] = tk[k]
						break
					}
				}
			}
			if(!svcnvtk) throw('cannot find a svcnv tk')

			if(this.iscustom) {
				// no checking for custom data
				return { svcnvtk: svcnvtk }
			}

			if(!this.dslabel) throw('not custom but dslabel missing')

			// for official dataset, check for availability of assay track of this sample
			const par = {
				genome:this.genome.name,
				dslabel:this.dslabel,
				querykey: svcnvtk.querykey,
				gettrack4singlesample: sample.name
			}
			return client.dofetch( '/mdssvcnv', par)
			.then(data=>{
				if(data.error) throw 'Error checking for assay track: '+data.error
				return {
					svcnvtk: svcnvtk,
					tracks: data.tracks
				}
			})

		})
		.then( arg=>{

			const pane = client.newpane({x:100,y:100})
			const blockarg = {
				jwt: this.jwt,
				hostURL:this.hostURL,
				nobox:1,
				genome:this.genome,
				holder:pane.body,
				chr:feature.chr,
				start:feature.start,
				stop:feature.stop,
				tklst:[],
			}
			client.first_genetrack_tolist( this.genome, blockarg.tklst )
			blockarg.tklst.push( arg.svcnvtk )
			if(arg.tracks) {
				for(const t of arg.tracks) blockarg.tklst.push( t )
			}
			import('./block.js').then(_=>{
				new _.Block( blockarg )
			})

		})
		.catch(err=>{
			window.alert( typeof(err)=='string' ? err : err.message )
			if(err.stack) console.log(err.stack)
		})
	}





	/********** __menu and tooltip **********/


	showTip_feature(f) {
		this.tip.clear()
		this.tipContent_feature(f, this.tip.d)
		this.tip.showunder( d3event.target)
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
			.text('Remove this feature')
			.on('click',()=>{
				this.menu.hide()
				f.legend_tr.remove()
				this.features.splice( this.features.findIndex(i=>i.id==f.id), 1 )
				this.draw_matrix()
			})

		if(f.isgenevalue) return showMenu_isgenevalue( this, f )
		if(f.iscnv) return showMenu_iscnv( this, f, f )
		if(f.isloh) return showMenu_isloh( this, f, f )
		if(f.ismutation) return showMenu_ismutation( this, f )
		if(f.isitd) {
			// TODO
			return
		}
		if(f.issvfusion) {
			// TODO
			return
		}
		if(f.issvcnv) {
			// TODO
			return
		}
		if(f.issampleattribute) {
			// TODO
			return
		}
		// __newattr show menu for feature
	}


	tipContent_feature(f, holder) {
		// say something about a feature

		holder.append('div')
			.text(f.label)
			.style('opacity',.5)
			.style('font-size','.7em')
			.style('margin','10px')

		// __newattr
		if(f.isgenevalue || f.iscnv || f.isloh || f.isitd || f.issvfusion) {
			// single data type: show region
			holder.append('div')
				.html(f.chr+':'+f.start+'-'+f.stop+' &nbsp; '+common.bplen(f.stop-f.start))
				.style('font-size','.7em')
				.style('opacity',.5)
				.style('margin','0px 10px 10px 10px')
		} else if( f.issvcnv || f.ismutation ) {
			// compound data types: show region if no gene name
			if(!f.genename) {
				// no gene, show region
				holder.append('div')
					.html(f.chr+':'+f.start+'-'+f.stop+' &nbsp; '+common.bplen(f.stop-f.start))
					.style('font-size','.7em')
					.style('opacity',.5)
					.style('margin','0px 10px 10px 10px')
			}
		} else if(f.issampleattribute) {
			holder.append('div')
				.text(f.label)
		}

		if(f.isgenevalue) {
			holder.append('div')
				.text('Min: '+f.scale.minv+', max: '+f.scale.maxv)
				.style('font-size','.7em')
				.style('opacity',.5)
				.style('margin','0px 10px 10px 10px')
		}
	}








	showTip_sample(sample) {
		this.tip.clear()
			.d
			.append('div')
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

			if(f.issvfusion) {
				const items = f.items.filter( i=> i.sample==sample.name )
				let text
				if(items.length==0) {
					text = saynovalue
				} else {
					text = '<div style="background:'+f.color+';width:20px">&nbsp;</div>'
				}
				lst.push({k:f.label, v:text})
				continue
			}

			if(f.issvcnv) {
				continue
			}

			if(f.ismutation) {
				continue
			}

			if(f.issampleattribute) {
				const item = f.items.find(i => i.sample == sample.name)
				if(item) {
					lst.push({k:f.label, v: item.value})
				}
				continue
			}

			// __newattr
			console.error('sample tooltip: Unknown feature type')
		}

		client.make_table_2col(this.tip.d, lst)
		// show tip after filling it with html so that 
		// computed bounding width, height are accurate
		this.tip.show(d3event.clientX,d3event.clientY)
	}





	showTip_cell(sample, f) {
		/*
		a cell
		*/
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

		} else if(f.issvfusion) {

			const items = f.items.filter( i=> i.sample==sample.name )
			let text
			if(items.length==0) {
				text = saynovalue
			} else {
				const lst2 = items.map(i=>{
					return '<div>'+i.chrA+':'+i.posA+' - '+i.chrB+':'+i.posB+' '
						+'</div>'
				})
				text = lst2.join('')
			}
			lst.push({k:f.label, v:text})

		} else if(f.issvcnv || f.ismutation) {

			const [ cnv, loh, itd, sv, fusion, snvindel ] = getitemforsample_compound( f, sample )
			if(cnv.length) {
				lst.push({
					k: (f.genename||f.label)+' CNV',
					v: cnv.map( i=> {
						return '<div>'
							+'<span style="background:'+(i.value>0?f.cnv.colorgain:f.cnv.colorloss)+';color:white;padding:0px 3px">'+i.value+'</span> '
							+'<span style="font-size:.8em">'+i.chr+':'+i.start+'-'+i.stop+' &nbsp;&nbsp;'+common.bplen(i.stop-i.start)+'</span>'
							+'</div>'
					}).join('')
				})
			}
			if(loh.length) {
				lst.push({
					k: (f.genename||f.label)+' LOH',
					v: loh.map( i=>{
						return '<div>'
							+'<span style="background:'+f.loh.color+';color:white;padding:0px 3px">'+i.segmean+'</span> '
							+'<span style="font-size:.8em">'+i.chr+':'+i.start+'-'+i.stop+' &nbsp;&nbsp;'+common.bplen(i.stop-i.start)+'</span>'
							+'</div>'
					}).join('')
				})
			}
			if(itd.length) {
				lst.push({
					k: (f.genename||f.label)+' ITD',
					v: itd.map(i=>{
						return '<div style="font-size:.8em">'+i.chr+':'+i.start+'-'+i.stop+'</div>'
					}).join('')
				})
			}
			if(sv.length) {
				lst.push({
					k: (f.genename||f.label)+' SV',
					v: sv.map(i=>{
						return '<div>'+i.chrA+':'+i.posA+','+i.strandA+' &gt; '+i.chrB+':'+i.posB+','+i.strandB+'</div>'
					}).join('')
				})
			}
			if(fusion.length) {
				lst.push({
					k: (f.genename||f.label)+' fusion',
					v: fusion.map(i=>{
						return '<div>'+i.chrA+':'+i.posA+','+i.strandA+' &gt; '+i.chrB+':'+i.posB+','+i.strandB+'</div>'
					}).join('')
				})
			}
			if(snvindel.length) {
				lst.push({
					k: (f.genename||f.label)+' SNV/indel',
					v: snvindel.map(m=>{
						const c = common.mclass[m.m.class]
						return '<div>'
							+'<span style="color:'+c.color+'">'+(m.m.mname||'')+'</span> '
							+'<span style="font-size:.7em;opacity:.5">'+c.label+'</span>'
							+'</div>'
					}).join('')
				})
			}

		} else if(f.issampleattribute) {

			const item = f.items.find(i=>i.sample == sample.name)
			if(item) {
				lst.push({
					k: f.label,
					v: item.value
				})
			}

		} else {
			// __newattr
			console.error('cell tooltip: unknown feature type')
		}

		this.tip.clear()
		client.make_table_2col(this.tip.d, lst)
		// show tip after filling it with html so that 
		// computed bounding width, height are accurate
		this.tip.show(d3event.clientX,d3event.clientY)
	}

	/********** __menu ends **********/




	sortsamplesbyfeatures() {
		// check if sorting is enabled on any one of isgenevalue

		const sortbygenevalue = this.features.find( f => f.isgenevalue && f.sort )
		if(sortbygenevalue && sortbygenevalue.items) {
			const sample2value = new Map()
			for(const i of sortbygenevalue.items) {
				sample2value.set(i.sample, i.value)
			}
			this.samples.sort( (i,j)=>{
				const vi = sample2value.has(i.name) ? sample2value.get(i.name) : sortbygenevalue.missingvalue
				const vj = sample2value.has(j.name) ? sample2value.get(j.name) : sortbygenevalue.missingvalue
				return vj-vi // descending
			})
		}
	}



	may_init_customvcf(tk) {
		/*
		if not loaded, will load header for a custom vcf track
		*/
		if(tk.info) return

		const arg = {
			file: tk.file,
			url: tk.url,
			indexURL: tk.indexURL
		}
		return client.dofetch('/vcfheader', arg)
		.then( data => {
			const [info,format,samples,errs]=vcfparsemeta(data.metastr.split('\n'))
			if(errs) throw('Error parsing VCF meta lines: '+errs.join('; '))
			tk.info = info
			tk.format = format
			tk.samples = samples
			tk.nochr = common.contigNameNoChr( this.genome, data.chrstr.split('\n'))
		})
	}




	// end of class
}










function drawEmptycell(sample,feature,g) {
	if(sample.height<5) return
	g.append('line')
		.attr('x2',feature.width)
		.attr('y2',sample.height)
		.attr('stroke','#ededed')
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
			stop: f.stop,
			snvindel:{
				excludeclasses: f.snvindel.excludeclasses
			},
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
	if(f.issvfusion) {
		return {
			id:f.id,
			issvfusion:1,
			querykey:f.querykey,
			chr:f.chr,
			start: f.start,
			stop: f.stop
		}
	}

	if(f.issvcnv || f.ismutation) {
		const arg = {
			id:f.id,
			chr:f.chr,
			start: f.start,
			stop: f.stop,
			cnv: {
				hidden: f.cnv.hidden,
				valuecutoff: f.cnv.valuecutoff,
				focalsizelimit: f.cnv.focalsizelimit
			},
			loh: {
				hidden: f.loh.hidden,
				valuecutoff: f.loh.valuecutoff,
				focalsizelimit: f.loh.focalsizelimit
			},
			itd:{
				hidden: f.itd.hidden
			},
			sv:{
				hidden: f.sv.hidden
			},
			fusion:{
				hidden: f.fusion.hidden
			},
			snvindel:{
				excludeclasses: f.snvindel.excludeclasses
			}
		}

		if(f.issvcnv) {
			arg.issvcnv = 1
			arg.querykey = f.querykey
		} else {
			arg.ismutation = 1
			arg.querykeylst = f.querykeylst
		}
		return arg
	}
	if(f.issampleattribute) {
		return {
			id:f.id,
			issampleattribute:1,
			key: f.key
		}
	}

	// __newattr
	throw('unknown feature type in making request parameter')
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





function getitemforsample_compound( feature, sample ) {
	/*
	for feature "issvcnv" and "ismutation"
	works for all mutation data types, not including expression
	*/

	const cnv=[],
		loh=[],
		itd=[],
		sv=[],
		fusion=[],
		snvindel=[]

	for(const item of feature.items) {

		if(item.dt==common.dtsnvindel) {
			if(!item.sampledata) continue
			const m_sample = item.sampledata.find( s => s.sampleobj.name == sample.name )
			if(!m_sample) continue

			snvindel.push( {
				m: item,
				m_sample: m_sample
			})
			continue
		}

		// not snv/indel type

		if(item.sample != sample.name) continue

		if(item.dt==common.dtcnv) {
			cnv.push(item)
		} else if(item.dt==common.dtloh) {
			loh.push(item)
		} else if(item.dt==common.dtitd) {
			itd.push(item)
		} else if(item.dt==common.dtsv) {
			sv.push(item)
		} else if(item.dt==common.dtfusionrna) {
			fusion.push(item)
		} else {
			console.error('unknown dt: '+item.dt)
		}
	}
	return [ cnv, loh, itd, sv, fusion, snvindel ]
}




function initfeature_polymutation(f) {
	/*
	initialize feature for issvcnv and ismutation
	set defaults if not provided
	*/

	if(!f.width) f.width = 20

	if(!f.cnv) f.cnv = {}
	if(!f.cnv.valuecutoff) f.cnv.valuecutoff = 0.2
	if(!Number.isInteger(f.cnv.focalsizelimit)) f.cnv.focalsizelimit=2000000
	if(!f.cnv.colorgain) f.cnv.colorgain = default_cnvgaincolor
	if(!f.cnv.colorloss) f.cnv.colorloss = default_cnvlosscolor

	if(!f.loh) f.loh = {}
	if(!f.loh.valuecutoff) f.loh.valuecutoff = 0.1
	if(!Number.isInteger(f.loh.focalsizelimit)) f.loh.focalsizelimit=2000000
	if(!f.loh.color) f.loh.color = default_lohcolor

	if(!f.itd) f.itd = {}
	if(!f.itd.color) f.itd.color = common.mclass[ common.mclassitd ].color

	if(!f.sv) f.sv = {}
	if(!f.sv.color) f.sv.color = default_svcolor
	if(!f.fusion) f.fusion = {}
	if(!f.fusion.color) f.fusion.color = default_svcolor

	if(!f.snvindel) f.snvindel = {}
	if(!f.snvindel.excludeclasses) f.snvindel.excludeclasses = {}
	// snvindel class color come from common.mclass
}




function init_controlui(o) {
	/*
	init control ui, including legend, config
	*/

	const buttonrow = o.holder.append('div')
		.style('margin-bottom','5px')

	const folderdiv = o.holder.append('div')
		.style('margin-bottom','20px')


	// legend
	buttonrow.append('span')
		.style('margin-right','20px')
		.style('font-size','.8em')
		.text('LEGEND')
		.attr('class','sja_clbtext')
		.on('click',()=>{
			if(o.legendtable.style('display')=='none') {
				client.appear(o.legendtable)
			} else {
				client.disappear(o.legendtable)
			}
		})

	o.legendtable = folderdiv.append('table')
		.style('border-top','solid 1px #ededed')
		.style('border-bottom','solid 1px #ededed')
		.style('border-spacing','10px')
		.style('display','none')

	// config
	buttonrow.append('span')
		.style('margin-right','20px')
		.style('font-size','.8em')
		.text('CONFIG')
		.attr('class','sja_clbtext')
		.on('click',()=>{
			if(generalconfig.style('display')=='none') {
				client.appear(generalconfig)
			} else {
				client.disappear(generalconfig)
			}
		})

	const generalconfig = folderdiv.append('div')
		.style('border-top','solid 1px #ededed')
		.style('border-bottom','solid 1px #ededed')
		.style('display','none')

	{
		// symbolic mutation
		const row = generalconfig.append('div')
			.style('margin','5px')
		row.append('span').html('Show all mutation features as symbolic&nbsp;&nbsp;')
		row.append('button')
			.text('Yes')
			.on('click',()=>{
				o.ismutation_allsymbolic=true
				delete o.ismutation_allnotsymbolic
				o.draw_matrix()
			})
		row.append('button')
			.text('No')
			.on('click',()=>{
				delete o.ismutation_allsymbolic
				o.ismutation_allnotsymbolic=true
				o.draw_matrix()
			})
	}
}
