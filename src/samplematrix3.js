import * as client from './client'
import {string2pos, invalidcoord} from './coord'
import {event as d3event} from 'd3-selection'
import * as common from './common'
import {scaleLinear,scaleOrdinal,schemeCategory10} from 'd3-scale'


/*
build a sample by feature matrix

primarily, retrieve feature values from mds

hardcoded: rows for samples, cols for features

JUMP __draw __menu
	__newattr places for adding new feature

****************** exposed methods (as called in sjcharts/src/dt.hm*.js)
.get_features()
.click_cell()

****************** internal use
.validate_config()
.validate_feature()
.error()
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
		this.tip  = new client.Menu({padding:'0px'})
		this.menu = new client.Menu({padding:'0px'})
		this.errdiv = this.holder.append('div')

		if(this.header) {
			this.holder.append('div')
				.style('margin-bottom','20px')
				.html(this.header)
		}

		this.buttonrow = this.holder.append('div')
			.style('text-align', 'left')
			.style('font-family', 'sans-serif')

		this.controlsDiv = this.holder.append('div')
			.style('text-align', 'left')
			.style('font-family', 'sans-serif')

		this.legendholder = this.holder.append('div')
			.style('text-align', 'center')
			.style('font-family', 'sans-serif')

		this.svgholder = this.holder.append('div') 

		Promise.all([
			this.setDtApp(),
			this.set_dataset(),
		])
		.then(()=>this.validate_config())
		.then(()=>this.get_features())
		.catch(err=>this.error(err))
	}

	error( err ) {
		client.sayerror(this.errdiv, typeof err=='string' ? err : err.message)
		if(err.stack) console.log(err.stack)
	}

	setDtApp() {
		return window.sjcharts.dtHm({
			appCaller: this, 
			holder: this.svgholder,
			buttonRow: this.buttonrow,
			controlsDiv: this.controlsDiv,
			legendHolder: this.legendholder,
			settings: {
				colw: 50,
			}
		})
		.then((dtApp)=>this.dtApp = dtApp)
	}

	set_dataset() {
		// Using a top level Promise.resolve simplifies exception handling
		// from throw(err), instead of having to return Promise.reject(err)
		// from every called functions within
		return Promise.resolve()
		.then(()=>{
			// official dataset
			if (!this.iscustom) {
				if(!this.dslabel) throw('not custom data but dslabel is missing')
				// accessing a native ds
				this.mds = this.genome.datasets[this.dslabel]
				if(!this.mds) throw('invalid dataset name: '+this.dslabel)
				if(!this.mds.isMds) throw('improper dataset: '+this.dslabel)
			}
			else {
				return this.init_customvcf()
			}
		})
	}

	init_customvcf() {
		/*
		if not loaded, will load header for a custom vcf track
		*/
		if (!this.iscustom) return Promise.resolve()
		if(!this.querykey2tracks) throw('---querykey2tracks missing for custom dataset')
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
		-- *** does the multiple promises below provide the fix? ***
		*/
		const promises=[]
		for(const key in this.querykey2tracks) {
			const tk = this.querykey2tracks[key]
			if(tk.type == common.tkt.mdsvcf) {
				if (!tk.info) {
					const arg = {
						file: tk.file,
						url: tk.url,
						indexURL: tk.indexURL
					}
					promises.push(
						client
						.dofetch('/vcfheader', arg)
						.then( data => {
							const [info,format,samples,errs]=vcfparsemeta(data.metastr.split('\n'))
							if(errs) throw('Error parsing VCF meta lines: '+errs.join('; '))
							tk.info = info
							tk.format = format
							tk.samples = samples
							tk.nochr = common.contigNameNoChr( this.genome, data.chrstr.split('\n'))
						})
					)
				}
			}
		}
		return promises	
	}

	validate_config() {
		/*
		only run once, upon init
		*/
		if(this.limitsamplebyeitherannotation) {
			if(!Array.isArray(this.limitsamplebyeitherannotation)) throw('limitsamplebyeitherannotation must be an array')
			//const tr = this.legendtable.append('tr')
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
	}

	get_features(featureset=null) {
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

		return client.dofetch('/samplematrix',arg).then(data=>{
			if(data.error) throw({message:data.error})
			for(const dat of data.results) {
				const f = this.features.find( f=> f.id==dat.id )
				if(!f) throw({message: 'feature not found: '+f.id });
				f.items = dat.items
			}
			this.gatherSamplesFromFeatureData()
			this.sortsamplesbyfeatures()
			this.dtApp.main(this.features,data)
		})
	}

	validate_feature( f ) {
		/*
		call when adding new feature
		also generates legend row for this feature
		returns promise
		*/

		f.id = Math.random().toString()

		//const tr = this.legendtable.append('tr')
		//f.legend_tr = tr

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

			if(!f.width) f.width=40
			if(!f.colorgain) f.colorgain = default_cnvgaincolor
			if(!f.colorloss) f.colorloss = default_cnvlosscolor

			return this.feature_parseposition_maygene(f,'CNV')
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
			/*
			tr.append('td')
				.text(f.label)
				.style('opacity',.5)
				.style('text-align','right')
			f.legendholder = tr.append('td')
			*/

			if(!f.width) f.width=40
			if(!f.color) f.color = default_lohcolor

			return this.feature_parseposition_maygene(f,'LOH')
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
			/*
			tr.append('td')
				.text(f.label)
				.style('opacity',.5)
				.style('text-align','right')
			f.legendholder = tr.append('td')
			*/

			if(!f.width) f.width=20
			if(!f.snvindel) f.snvindel = {}
			return this.feature_parseposition_maygene(f,'SNV/indel')
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
			return this.feature_parseposition_maygene(f,'ITD')
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
			return this.feature_parseposition_maygene(f,'SV/fusion')
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

			initfeature_polymutation( f )
			return this.feature_parseposition_maygene(f,'CNV/SV')
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

			initfeature_polymutation( f )
			return this.feature_parseposition_maygene(f,' mutation')
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
			return Promise.resolve()
		}

		// __newattr
		throw('unknown feature type in validating feature')
	}

	feature_parseposition_maygene(f,label='') {
		/*
		for position-based features
		only called by validate_feature()
		*/
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
				if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+(label ? ' '+label : '')
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
				client.sayerror(this.errdiv,'Multiple regions found for gene '+f.genename+'. Please specify a region in the feature.')
			}
			f.chr = regions[0].chr
			f.start = regions[0].start
			f.stop = regions[0].stop
			if(!f.label) f.label = f.chr+':'+f.start+'-'+f.stop+(label ? ' '+label : '')
		})
	}

	remove_feature(id) {
		const i = this.features.findIndex(f=>f.id==id)
		if (i==-1) return
		this.features.splice(i,1)
		this.gatherSamplesFromFeatureData()
		this.sortsamplesbyfeatures()
		this.dtApp.main()
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


		const uniformheight = Math.min(18, Math.max( 1, Math.ceil(800/name2sample.size) ) )

		this.samples = []

		for(const [n,sample] of name2sample) {
			sample.height = uniformheight
			sample.name = n
			this.samples.push( sample )
		}
	}

	click_cell( samplename, feature ) {
		/*
		browser view of single sample, to show whatever data's available from the dataset, irrespective of feature type
		feature provides view range

		some duplication from focus_singlesample(), on fetching assay track for requested sample
		since there is no block here, so cannot call the existing function

		*/

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
							name: samplename
						}
					}
					for(const k in tk) svcnvtk[k] = tk[k]
					break
				}
			}
		}
		if(!svcnvtk) throw('cannot find a svcnv tk')

		if(!this.iscustom) {
			this.render_block({svcnvtk}, feature)
		}
		else {
			if(!this.dslabel) throw('not custom but dslabel missing')
			// for official dataset, check for availability of assay track of this sample
			const par = {
				genome:this.genome.name,
				dslabel:this.dslabel,
				querykey: svcnvtk.querykey,
				gettrack4singlesample: samplename
			}
			
			client.dofetch( '/mdssvcnv', par)
			.then(data=>{
				if(data.error) throw 'Error checking for assay track: '+data.error
				this.render_block(data, feature)
			})
			.catch(err=>{
				window.alert( typeof(err)=='string' ? err : err.message )
				if(err.stack) console.log(err.stack)
			})
		}
	}

	render_block(data, feature) {
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
		blockarg.tklst.push( data.svcnvtk )
		if(data.tracks) {
			for(const t of data.tracks) blockarg.tklst.push( t )
		}
		import('./block.js').then(_=>{
			new _.Block( blockarg )
		})
	}

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
				hidden: f.cnv.hidden,
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
	// snvindel class color come from common.mclass
}

function ismutation_hideallclass(f) {
	f.cnv.hidden=true
	f.loh.hidden=true
	f.itd.hidden=true
	f.sv.hidden=true
	f.fusion.hidden=true
	f.snvindel.excludeclasses={}
	for(const k in common.mclass) {
		if(common.mclass[k].dt==common.dtsnvindel) f.snvindel.excludeclasses[k]=1
	}
}
