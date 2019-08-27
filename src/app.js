import 'babel-polyfill'
import {select as d3select,selectAll as d3selectAll,event as d3event} from 'd3-selection'
import {stratify} from 'd3-hierarchy'
import {scaleOrdinal,schemeCategory20} from 'd3-scale'
import * as client from './client'
import {findgenemodel_bysymbol} from './gene'
import 'normalize.css'
import './style.css'
import * as common from './common'
import {bulkui,bulkembed} from './bulk.ui'
import {stratinput} from './tree'
import {string2pos, invalidcoord} from './coord'
import {loadstudycohort} from './tp.init'
import {rgb as d3rgb} from 'd3-color'
import blockinit from './block.init'
import {getsjcharts}     from './getsjcharts'
import {debounce} from 'debounce'



/*

exports a global function runproteinpaint()
will be called for launching anything from pp
returns a promise that resolve to something e.g. block


********** INTERNAL

initgenome()
validate_oldds()
findgene2paint

********** loaders from parseembedthenurl()

launchblock()
launchgeneview()
launchfusioneditor()
launchmavb()
launch2dmaf()
launchhic()
launchsamplematrix()
launchmdssamplescatterplot
launchmdssurvivalplot
launch_fimo
launch_termdb
launch_singlecell

*/





// global values
let holder0,
	hostURL='',
	genomes,
	variantPageCall_snv,
	samplecart


/*
server emitted state, if true, will trigger globals e.g. window.bb
it needs to be set before launching any apps
*/
let debugmode=false



const error0=(m)=>{
	client.sayerror(holder0,m)
}


const headtip=new client.Menu({padding:'0px',offsetX:0,offsetY:0})
headtip.d.style('z-index', 5555)
// headtip must get a crazy high z-index so it can stay on top of all, no matter if server config has base_zindex or not


window.runproteinpaint=(arg)=>{
	if(arg.clear) {
		// for use by pecan
		d3selectAll('.sja_menu').remove()
		d3selectAll('.sja_pane').remove()
		return
	}
	// parse embedding arguments
	const holder= arg.holder ? d3select(arg.holder) : d3select(document.body)
	holder.style('font','1em Arial, sans-serif')
		.style('color','black')

	if(arg.host) {
		hostURL=arg.host
	}

	// store fetch parameters
	localStorage.setItem('hostURL', hostURL)
	if(arg.jwt) {
		localStorage.setItem('jwt',arg.jwt)
	}


	if(arg.variantPageCall_snv) {
		variantPageCall_snv=arg.variantPageCall_snv
	}
	if(arg.samplecart) {
		samplecart=arg.samplecart
	}

	if(arg.base_zindex) {
		/*
		dirty fix! to set base_zindex global in client.js
		done the same in /genomes
		*/
		client.newpane({setzindex:arg.base_zindex})
	}

	// load genomes
	return fetch( new Request(hostURL+'/genomes',{
		method:'POST',
		body:JSON.stringify({
			jwt: arg.jwt
		})
	}))
	.then(data=>{return data.json()})
	.then(data=>{
		if(data.error) throw({message:'Cannot get genomes: '+data.error})
		if(!data.genomes) throw({message:'no genome data!?'})

		if(data.base_zindex) {
			client.newpane({setzindex:data.base_zindex})
		}

		genomes=data.genomes

		if(data.debugmode) {
			debugmode=true
		}

		// genome data init
		for(const genomename in genomes) {
			const err=initgenome(genomes[genomename])
			if(err) {
				throw({message:'Error with '+genomename+' genome: '+err})
			}
		}

		let selectgenome // the <select> genome, should belong to this particular launch

		if(!arg.noheader) {
			selectgenome = makeheader( holder, data, arg.jwt )
		}

		if(arg.headerhtml) {
			holder.append('div').html(arg.headerhtml)
		}

		holder0=holder.append('div').style('margin','20px')

		return parseembedthenurl(arg, holder0, selectgenome)
	})
	.catch(err=>{
		holder.text(err.message)
		if(err.stack) console.log(err.stack)
	})
}



function makeheader(holder,obj, jwt) {
	/*
	holder
	obj: server returned data
	jwt: token
	*/
	const color=d3rgb(common.defaultcolor)
	const padw='13px'
	// head
	const row=holder.append('div')
	const headbox=row.append('div')
		.style('margin','10px')
		.style('padding-right','10px')
		.style('display','inline-block')
		.style('border','solid 1px rgba('+color.r+','+color.g+','+color.b+',.3)')
		.style('border-radius','5px')
		.style('background-color','rgba('+color.r+','+color.g+','+color.b+',.1)')
	const headinfo=row.append('div')
		.style('display','inline-block')
		.style('padding',padw)
		.style('font-size','.8em')
		.style('color',common.defaultcolor)
	if(obj.lastdate) {
		headinfo.append('div').text('Last updated: '+obj.lastdate)
	}
	if(obj.headermessage) {
		headinfo.append('div').html(obj.headermessage)
	}

	// 1
	headbox.append('div').text('ProteinPaint')
		.style('display','inline-block')
		.style('padding',padw)
		.style('color',common.defaultcolor)
		.style('font-weight','bold')

	// 2, search box
	const tip = new client.Menu({border:'',padding:'0px'})
	function entersearch () {
		// by pressing enter, if not gene will search snp
		d3selectAll('.sja_ep_pane').remove() // poor fix to remove existing epaint windows
		let str=input.property('value').trim()
		if(!str) return
		const hitgene=tip.d.select('.sja_menuoption')
		if(hitgene.size()>0 && hitgene.attr('isgene')) {
			str=hitgene.text()
		}
		findgene2paint( str, selectgenome.property('value'), jwt )
		input.property('value','')
		tip.hide()
	}
	function genesearch () {
		// any other key typing
		tip.clear().showunder(input.node())
		findgenelst(
			input.property('value'),
			selectgenome.property('value'),
			tip,
			jwt
		)
	}
	const debouncer = debounce(genesearch,300)
	const input=headbox.append('div')
		.style('display','inline-block')
		.style('padding',padw)
		.style('padding-right','5px')
		.append('input')
		.style('border','solid 1px '+common.defaultcolor)
		.style('padding','3px')
		.attr('size',20)
		.attr('placeholder','Gene, position, or SNP')
		.on('keyup', ()=>{
			if(client.keyupEnter()) entersearch()
			else debouncer()
		})
	input.node().focus()



	const selectgenome=headbox.append('div')
		.style('display','inline-block')
		.style('padding',padw)
		.style('padding-left','5px')
		.append('select').style('margin','1px 20px 1px 10px')
	for(const n in genomes) {
		selectgenome.append('option')
			.attr('n',n)
			.text(genomes[n].species+' '+n)
			.property('value',n)
	}

	headbox.append('span')
		.attr('class','sja_menuoption')
		.style('padding',padw)
		.style('border-radius','5px')
		.text('Apps')
		.on('click',()=>{
			appmenu( headbox, selectgenome, jwt )
		})
	headbox.append('span').classed('sja_menuoption',true).style('padding',padw).style('border-radius','5px').text('Help').on('click',()=>{
		const p=d3event.target.getBoundingClientRect()
		const div=headtip.clear()
			.show(p.left-50,p.top+p.height+5)
			.d
			.append('div')
			.style('padding','5px 20px')
		div.append('p').html('<a href=https://docs.google.com/document/d/1KNx4pVCKd4wgoHI4pjknBRTLrzYp6AL_D-j6MjcQSvQ/edit?usp=sharing target=_blank>Embed in your website</a>')
		div.append('p').html('<a href=https://drive.google.com/open?id=121SsSYiCb3NCU8jz0bF7UujFSN-1Y20b674dqa30iXE target=_blank>Make a Study View</a>')
		div.append('p').html('<a href=https://docs.google.com/document/d/1e0JVdcf1yQDZst3j77Xeoj_hDN72B6XZ1bo_cAd2rss/edit?usp=sharing target=_blank>URL parameters</a>')
		div.append('p').html('<a href=https://docs.google.com/document/d/1JWKq3ScW62GISFGuJvAajXchcRenZ3HAvpaxILeGaw0/edit?usp=sharing target=_blank>All tutorials</a>')
		div.append('p').html('<a href=https://groups.google.com/forum/#!forum/genomepaint target=_blank>User community</a>')
	})

	return selectgenome
}




function appmenu( headbox, selectgenome, jwt ) {
	/*
	headbox
	selectgenome: <select>
	*/

	const p=d3event.target.getBoundingClientRect()
	headtip.clear().show(p.left-50,p.top+p.height+5)
	{
		const ss=selectgenome.node()
		const genomename= ss.options[ss.selectedIndex].value
		const g=genomes[genomename]
		if(!g) {
			alert('Invalid genome name: '+genomename)
			return
		}
		headtip.d.append('div').attr('class','sja_menuoption').text(genomename+' genome browser').style('padding','20px').on('click',()=>{
			// showing default-looking browser
			headtip.hide()
			const p=headbox.node().getBoundingClientRect()
			const pane=client.newpane({x:p.left,y:p.top+p.height+10})
			pane.header.text(genomename+' genome browser')

			const par = {
				hostURL:hostURL,
				jwt: jwt,
				holder:pane.body,
				genome:g,
				chr:g.defaultcoord.chr,
				start:g.defaultcoord.start,
				stop:g.defaultcoord.stop,
				nobox:true,
				tklst:[],
				debugmode:debugmode,
			}
			client.first_genetrack_tolist( g, par.tklst )

			import('./block').then(b=>new b.Block( par ))
		})
	}
	headtip.d.append('div').attr('class','sja_menuoption').text('Load mutations from text files').style('padding','20px').on('click',()=>{
		headtip.hide()
		bulkui(p.left-100,p.top+p.height+5,genomes, hostURL, jwt)
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('View a study').style('padding','20px').on('click',()=>{
		headtip.hide()
		studyui(p.left-100,p.top+p.height+5,genomes, hostURL, jwt)
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('Fusion editor').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./svmr').then(p=>{
			p.svmrui(genomes, hostURL, jwt)
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('Junction-by-sample matrix display').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./block.tk.junction.textmatrixui').then(p=>{
			p.default(genomes, hostURL, jwt)
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('Differential gene expression viewer').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./mavb').then(p=>{
			p.mavbui(genomes, hostURL, jwt)
			return
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('MAF timeline plot').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./maftimeline').then(p=>{
			p.default(genomes)
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('2DMAF plot').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./2dmaf').then(p=>{
			p.d2mafui(genomes)
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('Mutation burden & spectrum').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./spectrum').then(p=>{
			p.default(genomes)
		})
	})
	headtip.d.append('div').attr('class','sja_menuoption').text('Expression to PCA map').style('padding-left','20px').on('click',()=>{
		headtip.hide()
		import('./e2pca').then(p=>{
			p.e2pca_inputui(hostURL, jwt)
		})
	})
}





function findgenelst( str, genome, tip, jwt ) {
	if(str.length<=1) {
		tip.d.selectAll('*').remove()
		return
	}
	const req=new Request(hostURL+'/genelookup',{
		method:'POST',
		body:JSON.stringify({
			input:str,
			genome:genome,
			jwt:jwt,
			})
	})
	fetch(req)
	.then(data=>{return data.json()})
	.then(data=>{
		if(data.error) throw(data.error)
		if(!data.hits) throw('.hits[] missing')
		for(const name of data.hits) {
			tip.d.append('div')
			.attr('class','sja_menuoption')
			.attr('isgene','1')
			.text(name)
			.on('click',()=>{
				tip.hide()
				findgene2paint(name,genome)
			})
		}
	})
	.catch(err=>{
		tip.d.append('div')
			.style('border','solid 1px red')
			.style('padding','10px')
			.text(err)
	})
}





function findgene2paint( str, genomename, jwt ) {
	const g=genomes[genomename]
	if(!g) {
		console.error('unknown genome '+genomename)
		return
	}
	holder0.selectAll('*').remove()
	const pos=string2pos(str,g)
	if(pos) {
		// input is coordinate, launch block
		const par = {
			hostURL:hostURL,
			jwt:jwt,
			holder:holder0,
			genome:g,
			chr:pos.chr,
			start:pos.start,
			stop:pos.stop,
			dogtag: genomename,
			allowpopup:true,
			tklst:[],
			debugmode:debugmode
		}
		client.first_genetrack_tolist( g, par.tklst )

		import('./block')
			.then(b=>new b.Block( par ))
			.catch(err=>{
				error0( err.message)
				console.log(err)
			})
		return
	}

	// input string is not coordinate, find gene match

	const par = {
		hostURL:hostURL,
		jwt:jwt,
		query:str,
		genome:g,
		holder:holder0,
		variantPageCall_snv:variantPageCall_snv,
		samplecart:samplecart,
		debugmode:debugmode
	}


	// add svcnv tk from url param
	const tmp = sessionStorage.getItem( 'urlp_mds' )
	if(tmp) {
		const l = tmp.split(',')
		if(l.length==2) {
			par.datasetqueries = [ { dataset: l[0], querykey: l[1] } ]
		}
	}

	blockinit( par )
}




function studyui(x,y) {
	const pane=client.newpane({x:x,y:y})
	pane.header.text('View a study')
	pane.body.style('padding','20px')
	pane.body.append('div')
		.style('color','#858585')
		.html('A study can organize various data for a cohort, and is hosted on this server.<br>To view, enter the path to the study\'s JSON config file.<br><a href=https://drive.google.com/open?id=121SsSYiCb3NCU8jz0bF7UujFSN-1Y20b674dqa30iXE target=_blank>Learn how to organize data in a study</a>.')
	const row=pane.body.append('div').style('margin-top','20px')
	const input=row.append('input')
		.style('margin-right','5px')
		.attr('size',15)
		.attr('placeholder','Study name')
	input.on('keyup',()=>{
			if(d3event.code!='Enter') return
			submit()
		})
		.node().focus()
	row.append('button')
		.text('Submit')
		.on('click',submit)
	row.append('button')
		.text('Clear')
		.on('click',()=>{
			input.property('value','').node().focus()
		})
	pane.body.append('p')
		.html('<a href=https://www.dropbox.com/s/psfzwkbg7v022ef/example_study.json?dl=0 target=_blank>Example study</a>')
	function submit() {
		const v=input.property('value')
		if(v=='') return
		input.property('value','')
		input.node().blur()
		const p2=client.newpane({x:100,y:100})
		p2.header.html('<span style="font-size:.7em">STUDY</span> '+v)
		p2.body.style('padding','0px 20px 20px 20px')
		loadstudycohort(
			genomes,
			v,
			p2.body,
			hostURL,
			null, // jwt
			false, // no show
			debugmode
			)
	}
}





function initgenome(g) {
	g.tkset=[]
	g.isoformcache=new Map()
	// k: upper isoform
	// v: [gm]
	g.junctionframecache=new Map()
	/*
	k: junction chr-start-stop
	v: Map
	   k: isoform
	   v: true/false for in-frame
	*/
	g.isoformmatch=(n2,chr,pos)=>{
		if(!n2) return null
		const n=n2.toUpperCase()
		if(!g.isoformcache.has(n)) return null
		const lst=g.isoformcache.get(n)
		if(lst.length==1) return lst[0]
		// multiple available
		if(!chr) {
			console.log('no chr provided for matching with '+n)
			return lst[0]
		}
		let gm=null
		for(const m of lst) {
			if(m.chr.toUpperCase()==chr.toUpperCase() && m.start<=pos && m.stop>=pos) {
				gm=m
			}
		}
		if(gm) return gm
		for(const m of lst) {
			if(m.chr.toUpperCase()==chr.toUpperCase()) return m
		}
		return null
	}
	g.chrlookup={}
	for(const nn in g.majorchr) {
		g.chrlookup[nn.toUpperCase()]={name:nn,len:g.majorchr[nn],major:true}
	}
	if(g.minorchr) {
		for(const nn in g.minorchr) {
			g.chrlookup[nn.toUpperCase()]={name:nn,len:g.minorchr[nn]}
		}
	}

	if(!g.tracks) {
		g.tracks = []
	}

	for(const t of g.tracks) {
		/*
		essential for telling if genome.tracks[] item is same as block.tklst[]
		*/
		t.tkid=Math.random().toString()
	}
	// validate ds info
	for(const dsname in g.datasets) {
		const ds=g.datasets[dsname]

		if(ds.isMds) {
			// nothing to validate for the moment
		} else {
			const e=validate_oldds(ds)
			if(e) {
				return '(old) official dataset error: '+e
			}
		}
	}
	return null
}




function validate_oldds(ds) {
	// old official ds
	if(ds.geneexpression) {
		if(ds.geneexpression.maf) {
			try{
				ds.geneexpression.maf.get=eval('('+ds.geneexpression.maf.get+')')
			} catch(e){
				return 'invalid Javascript for get() of expression.maf of '+ds.label
			}
		}
	}
	if(ds.cohort) {
		if(ds.cohort.raw && ds.cohort.tosampleannotation) {
			/*
			tosampleannotation triggers converting ds.cohort.raw to ds.cohort.annotation
			*/
			if(!ds.cohort.key4annotation) {
				return 'cohort.tosampleannotation in use by .key4annotation missing of '+ds.label
			}
			if(!ds.cohort.annotation) {
				ds.cohort.annotation={}
			}
			let nosample=0
			for(const a of ds.cohort.raw) {
				const sample = a[ds.cohort.tosampleannotation.samplekey]
				if(sample) {
					const b={}
					for(const k in a) {
						b[k]=a[k]
					}
					ds.cohort.annotation[sample] = b
				} else {
					nosample++
				}
			}
			if(nosample) return nosample+' rows has no sample name from sample annotation of '+ds.label
			delete ds.cohort.tosampleannotation
		}
		if(ds.cohort.levels) {
			if(ds.cohort.raw) {
				// to stratify
				// cosmic has only level but no cohort info, buried in snvindel
				const nodes=stratinput(ds.cohort.raw,ds.cohort.levels)
				ds.cohort.root=stratify()(nodes)
				ds.cohort.root.sum(i=>i.value)
			}
		}
		if(ds.cohort.raw) {
			delete ds.cohort.raw
		}
		ds.cohort.suncolor=scaleOrdinal(schemeCategory20)
	}
	if(ds.snvindel_attributes) {
		for(const at of ds.snvindel_attributes) {
			if(at.get) {
				try{
					at.get=eval('('+at.get+')')
				} catch(e){
					return 'invalid Javascript for getter of '+JSON.stringify(at)
				}
			} else if(at.lst) {
				for(const at2 of at.lst) {
					if(at2.get) {
						try{
							at2.get=eval('('+at2.get+')')
						} catch(e){
							return 'invalid Javascript for getter of '+JSON.stringify(at2)
						}
					}
				}
			}
		}
	}
	if(ds.stratify) {
		if(!Array.isArray(ds.stratify)) {
			return 'stratify is not an array in '+ds.label
		}
		for(const strat of ds.stratify) {
			if(!strat.label) {
				return 'stratify method lacks label in '+ds.label
			}
			if(strat.bycohort) {
				if(!ds.cohort) {
					return 'stratify method '+strat.label+' using cohort but no cohort in '+ds.label
				}
			} else {
				if(!strat.attr1) {
					return 'stratify method '+strat.label+' not using cohort but no attr1 in '+ds.label
				}
				if(!strat.attr1.label) {
					return '.attr1.label missing in '+strat.label+' in '+ds.label
				}
				if(!strat.attr1.k) {
					return '.attr1.k missing in '+strat.label+' in '+ds.label
				}
			}
		}
	}

	if(ds.url4variant) {
		// quick fix for clinvar
		for(const u of ds.url4variant) {
			u.makelabel = eval('('+u.makelabel+')')
			u.makeurl = eval('('+u.makeurl+')')
		}
	}

	// no checking vcfinfofilter
	// no population freq filter
}









function parseembedthenurl(arg, holder, selectgenome) {
	/*
	first, try to parse any embedding parameters
	quit in case of any blocking things
	after exhausting embedding options, try URL parameters

	arg: embedding param
	holder:
	selectgenome: <select>

	*/

	if(arg.genome && selectgenome) {
		// embedding argument specified genome, so flip the <select>
		for(let i=0; i<selectgenome.node().childNodes.length; i++) {
			if(selectgenome.node().childNodes[i].value == arg.genome) {
				selectgenome.property('selectedIndex',i)
				break
			}
		}
	}

	if(arg.singlecell) {
		launch_singlecell( arg.singlecell, holder )
		return
	}
	if(arg.display_termdb) {
		launch_termdb( arg.display_termdb, holder )
		return
	}

	if(arg.fimo) {
		launch_fimo( arg.fimo, holder )
		return
	}

	if(arg.mdssurvivalplot) {
		if(arg.genome) arg.mdssurvivalplot.genome = arg.genome
		launchmdssurvivalplot(arg.mdssurvivalplot, holder)
		return
	}

	if(arg.mdssamplescatterplot) {
		if(arg.genome) arg.mdssamplescatterplot.genome = arg.genome
		launchmdssamplescatterplot(arg.mdssamplescatterplot, holder)
		return
	}

	if(arg.samplematrix) {
		arg.samplematrix.jwt = arg.jwt
		launchsamplematrix( arg.samplematrix, holder )
		return
	}

	if(arg.hic) {
		arg.hic.jwt = arg.jwt
		launchhic( arg.hic, holder )
		return
	}

	if(arg.block) {
		// load this before study / studyview
		return launchblock(arg, holder)
	}

	if(arg.study) {
		// launch study-view through name of server-side configuration file (study.json)
		loadstudycohort(
			genomes,
			arg.study,
			holder,
			hostURL,
			arg.jwt,
			false, // no show
			debugmode
		)
		return
	}

	if(arg.studyview) {
		// launch study-view through an object
		const obj=arg.studyview
		obj.hostURL=arg.host
		const gn=obj.genome || arg.genome
		obj.genome=genomes[gn]
		obj.hostURL=hostURL
		obj.jwt = arg.jwt
		obj.holder=holder
		bulkembed(obj)
		return
	}

	if(arg.p) {
		// backward-compatible with old parameter name
		arg.gene=arg.p
		delete arg.p
	}
	if(arg.gene) {
		launchgeneview(arg, holder)
		return
	}

	if(arg.fusioneditor) {
		launchfusioneditor(arg, holder)
		return
	}

	if(arg.mavolcanoplot) {
		launchmavb(arg, holder)
		return
	}

	if(arg.twodmaf) {
		launch2dmaf(arg, holder)
		return
	}

/*
	if(arg.jdv) {
		launchjdv(arg.jdv, holder)
		return
	}
	*/

	if(arg.parseurl && location.search.length) {
		/*
		since jwt token is only passed from arg of runpp()
		so no way of sending it via url parameter, thus url parameter won't work when jwt is activated
		*/
		import('./app.parseurl').then(_=>{
			const err=_.default({
				genomes:genomes,
				hostURL:hostURL,
				variantPageCall_snv:variantPageCall_snv,
				samplecart:samplecart,
				holder:holder,
				selectgenome:selectgenome,
				debugmode:debugmode
			})
			if(err) {
				error0(err)
			}
		})
	}

	if (arg.project) {
		bulkui(0,0,genomes, hostURL)
	}
}




function launchmdssamplescatterplot(arg, holder) {
	if(!arg.genome) {
		error0('missing genome for mdssamplescatterplot')
		return
	}
	const genome = genomes[arg.genome]
	if(!genome) {
		error0('invalid genome for mdssamplescatterplot')
		return
	}
	arg.genome = genome
	if(!arg.dataset) {
		error0('missing dataset for mdssamplescatterplot')
		return
	}
	arg.mds = genome.datasets[arg.dataset]
	if(!arg.mds) {
		error0('invalid dataset for mdssamplescatterplot')
		return
	}
	arg.dslabel = arg.dataset
	delete arg.dataset
	import('./mds.samplescatterplot').then(_=>{
		_.init(arg, holder, debugmode)
	})
}



function launchmdssurvivalplot(arg, holder) {
	if(!arg.genome) {
		error0('missing genome for mdssurvivalplot')
		return
	}
	const genome = genomes[arg.genome]
	if(!genome) {
		error0('invalid genome for mdssurvivalplot')
		return
	}
	arg.genome = genome
	if(!arg.dataset) {
		error0('missing dataset for mdssurvivalplot')
		return
	}
	arg.mds = genome.datasets[arg.dataset]
	if(!arg.mds) {
		error0('invalid dataset for mdssurvivalplot')
		return
	}
	delete arg.dataset
	if(arg.plotlist) {
		for(const p of arg.plotlist) {
			// instruct this plot to be shown by default
			p.renderplot=1
		}
	}
	import('./mds.survivalplot').then(_=>{
		_.init(arg, holder, debugmode)
	})
}



function launch_termdb ( arg, holder ) {
	if(!arg.genome) {
		error0('missing genome for termdb')
		return
	}
	const genome = genomes[arg.genome]
	if(!genome) {
		error0('invalid genome for termdb')
		return
	}
	arg.genome = genome
	if(!arg.dslabel) {
		error0('missing dslabel for termdb')
		return
	}
	arg.mds = genome.datasets[ arg.dslabel ]
	if(!arg.mds) {
		error0('unknown dataset for termdb')
		return
	}
	arg.div = holder
	arg.debugmode = debugmode
	import('./mds.termdb').then(_=>{
		_.init(arg)
	})
}



function launch_fimo ( arg, holder ) {
	if(!arg.genome) {
		error0('missing genome for fimo')
		return
	}
	const genome = genomes[arg.genome]
	if(!genome) {
		error0('invalid genome for fimo')
		return
	}
	arg.genome = genome
	arg.div = holder
	import('./mds.fimo').then(_=>{
		_.init( arg )
	})
}



function launchhic(hic, holder) {
	if(!hic.genome) {
		error0('missing genome for hic')
		return
	}
	hic.genome = genomes[hic.genome]
	if(!hic.genome) {
		error0('invalid genome for hic')
		return
	}
	if(!hic.file) {
		error0('missing file for hic')
		return
	}
	hic.hostURL = hostURL
	hic.holder = holder
	import('./hic.straw').then(_=>{
		_.hicparsefile(hic, debugmode)
	})
}



function launchsamplematrix(cfg, holder) {
	if(!cfg.genome) {
		error0('missing genome for launching samplematrix')
		return
	}
	cfg.genome = genomes[cfg.genome]
	if(!cfg.genome) {
		error0('invalid genome for samplematrix')
		return
	}
	cfg.hostURL = hostURL
	cfg.holder = holder
	cfg.debugmode = debugmode
	// dynamic import works with static values, not expressions
	if (window.location.search.includes('smx=3')) {
		cfg.client = client
		cfg.common = common
		cfg.string2pos = string2pos
		cfg.invalidcoord = invalidcoord
		cfg.block = import('./block.js')
		getsjcharts(sjcharts => {
			sjcharts.dthm( cfg )
		})
	}
	else {
		import('./samplematrix').then(_=>{
			new _.Samplematrix(cfg)
		})
	}
}




function launchgeneview(arg, holder) {
	if(!arg.genome) {
		error0('Cannot embed: must specify reference genome')
		return
	}
	if(arg.tracks) {
		for(const t of arg.tracks) {
			t.iscustom=true
		}
	}
	const pa={
		jwt: arg.jwt,
		hostURL:hostURL,
		query:arg.gene,
		genome:genomes[arg.genome],
		holder:holder,
		variantPageCall_snv:variantPageCall_snv,
		samplecart:samplecart,
		debugmode:debugmode,
		datasetqueries: arg.datasetqueries,
		mset: arg.mset,
		tklst: arg.tracks,
		gmmode: arg.gmmode
	}
	let ds=null
	if(arg.dataset) {
		pa.dataset=arg.dataset.split(',')
		if(arg.hidedatasetexpression) {
			pa.hidedatasetexpression=true
		}
	}
	if(arg.hidegenecontrol) {
		pa.hidegenecontrol=true
	}
	if(arg.hidegenelegend) {
		pa.hidegenelegend=true
	}
	let hlaa=null
	if(arg.hlaachange) {
		hlaa=new Map()
		if(Array.isArray(arg.hlaachange)) {
			for(const s of arg.hlaachange) {
				if(s.name) {
					hlaa.set(s.name,s)
				}
			}
		} else {
			for(const s of arg.hlaachange.split(',')) {
				hlaa.set(s,false)
			}
		}
		if(hlaa.size) {
			pa.hlaachange=hlaa
		}
	}
	if(arg.hlvariants) {
		pa.hlvariants=arg.hlvariants
	}

	// TODO support tracks in block.init.js
	blockinit(pa)
}



async function launchblock(arg,holder) {
	/*
	launch genome browser, rather than gene-view
	may load a study file at same time, to add as .genome.tkset[]
	*/
	if(!arg.genome) {
		error0('Cannot embed: must specify reference genome')
		return
	}
	const genomeobj=genomes[arg.genome]
	if(!genomeobj) {
		error0('Invalid genome: '+arg.genome)
		return
	}

	if(arg.study) {
		/*
		try to load this study
		tracks to be added to .genome.tkset
		later to be loaded in the same browser panel

		FIXME asynchronized, won't be able to add tracks directly to current browser
		*/
		loadstudycohort(
			genomes,
			arg.study,
			holder,
			hostURL,
			arg.jwt,
			true, // no show
			debugmode
			)
	}
	if(arg.studyview) {
		// TODO
	}

	if(arg.tracks) {
		// tracks have to be labeled custom, even for smuggled native tracks
		for(const t of arg.tracks) {
			if( t.type == client.tkt.mds2 && t.dslabel ) {
				// is an official mds2, do not flag as custom
				continue
			}
			t.iscustom=true
		}
	}

	const blockinitarg = {
		genome:genomeobj,
		hostURL:hostURL,
		jwt: arg.jwt,
		holder:holder,
		nativetracks:arg.nativetracks,
		tklst: arg.tracks,
		debugmode:debugmode,
	}


	if(arg.width) {
		const v=Number.parseInt(arg.width)
		if(Number.isNaN(v)) return error0('browser width must be integer')
		blockinitarg.width=v
	}

	if(arg.subpanels) {
		if(!Array.isArray(arg.subpanels)) return error0('subpanels is not array')
		const lst=[]
		for(const r of arg.subpanels) {
			if(!r.chr) {
				error0('missing chr in one subpanel')
				continue
			}
			if(!r.start || !r.stop) {
				error0('missing start or stop in one subpanel')
				continue
			}
			if(!r.width) {
				// may decide by screen size
				r.width = 400
			}
			if(!r.leftpad) {
				r.leftpad = 5
			}
			lst.push(r)
		}
		if(lst.length) {
			blockinitarg.subpanels=lst
		}
	}

	if(arg.nobox) {
		blockinitarg.nobox=true
	} else {
		// show box
		blockinitarg.dogtag= arg.dogtag || arg.genome
	}
	if(arg.position) {
		const pos=string2pos(arg.position, genomeobj)
		if(pos) {
			blockinitarg.chr=pos.chr
			blockinitarg.start=pos.start
			blockinitarg.stop=pos.stop
		}
	} else if(arg.positionbygene) {

		try {

			const gmlst = await findgenemodel_bysymbol( arg.genome, arg.positionbygene )
			if( gmlst && gmlst[0] ) {
				const gm = gmlst[0]
				blockinitarg.chr = gm.chr
				blockinitarg.start = gm.start
				blockinitarg.stop = gm.stop
			}
				
		}catch(e) {
			error0(e)
		}
	}

	if(!blockinitarg.chr) {
		blockinitarg.chr=genomeobj.defaultcoord.chr
		blockinitarg.start=genomeobj.defaultcoord.start
		blockinitarg.stop=genomeobj.defaultcoord.stop
	}

	if(arg.datasetqueries) {
		/*
		each dataset comes with customization
		it will be appended as .customization{} to the tk object
		and parsed in makeTk() of svcnv track

		also for launching gene view
		*/
		blockinitarg.datasetqueries=arg.datasetqueries
	}

	// apply url parameter
	const h = client.may_get_locationsearch()
	if(h) {
		if(h.has('position')) {
			const pos = string2pos( h.get('position'), genomeobj )
			if(pos) {
				blockinitarg.chr=pos.chr
				blockinitarg.start=pos.start
				blockinitarg.stop=pos.stop
			}
		}
		if(h.has('hlregion')) {
			const lst = []
			for(const tmp of h.get('hlregion').split(',')) {
				const pos = string2pos( tmp, genomeobj )
				if(pos) {
					lst.push(pos)
				}
			}
			if(lst.length) {
				blockinitarg.hlregions = lst
			}
		}
		if(h.has('bedgraphdotfile')) {
			if(!blockinitarg.tklst) blockinitarg.tklst = []
			const lst=h.get('bedgraphdotfile').split(',')
			for(let i=0; i<lst.length; i+=2) {
				if(lst[i] && lst[i+1]) {
					blockinitarg.tklst.push({
						type:client.tkt.bedgraphdot,
						name:lst[i],
						file:lst[i+1]
					})
				}
			}
		}
	}

	// return a promise resolving to block
	return import('./block')
		.then(b=>{
			const bb = new b.Block(blockinitarg)
			return {block:bb}
		})
}



function launchfusioneditor(arg,holder) {
	const genomeobj=genomes[arg.genome]
	if(!genomeobj) {
		error0('Invalid genome: '+arg.genome)
		return
	}
	import('./svmr').then(p=>{
		p.svmrparseinput(
			arg.fusioneditor,
			error0,
			genomeobj,
			holder,
			hostURL,
			arg.jwt
		)
	})
}


function launchmavb(arg,holder) {
	const genomeobj=genomes[arg.genome]
	if(!genomeobj) {
		error0('Invalid genome: '+arg.genome)
		return
	}
	arg.mavolcanoplot.hostURL=hostURL
	arg.mavolcanoplot.genome=genomeobj
	import('./mavb').then(p=>{
		p.mavbparseinput(
			arg.mavolcanoplot,
			error0,
			holder,
			arg.jwt
		)
	})
}




function launch2dmaf(arg,holder) {
	const genomeobj=genomes[arg.genome]
	if(!genomeobj) {
		error0('Invalid genome: '+arg.genome)
		return
	}
	arg.twodmaf.hostURL=hostURL
	arg.twodmaf.genome=genomeobj
	import('./2dmaf').then(d2maf=>{
		d2maf.d2mafparseinput(
			arg.twodmaf,
			holder
		)
	})
}



/*
function launchjdv(arg, holder) {
	const genomeobj=genomes[arg.genome]
	if(!genomeobj) {
		client.sayerror(holder, 'Invalid genome: '+arg.genome)
		return
	}
	arg.hostURL=hostURL
	arg.genome=genomeobj
	import('./jdv').then(jdv=>{
		jdv.jdvparseinput(arg, holder)
	})
}
*/


async function launch_singlecell ( arg, holder ) {
	try {
		const genome=genomes[arg.genome]
		if(!genome) throw 'Invalid genome: '+arg.genome
		arg.genome = genome

		await client.add_scriptTag( '/static/js/three.js' )
		await client.add_scriptTag('/static/js/loaders/PCDLoader.js')
		await client.add_scriptTag('/static/js/controls/TrackballControls.js')
		await client.add_scriptTag('/static/js/WebGL.js')
		await client.add_scriptTag('/static/js/libs/stats.min.js')

		const _ = await import('./singlecell')
		await _.init( arg, holder )
	}catch(e){
		error0('Error launching single cell viewer: '+e)
		if(e.stack) console.log(e.stack)
	}
}
