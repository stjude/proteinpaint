const fs = require('fs'),
	url = require('url')
	path = require('path'),
	spawn = require('child_process').spawn,
	exec = require('child_process').exec,
	readline = require('readline'),
	express = require('express'),
	http = require('http'),
	https = require('https'),
	compression = require('compression'),
	bettersqlite = require('better-sqlite3'), // synchronous
	Canvas = require('canvas'),
	bodyParser = require('body-parser'),
	jsonwebtoken = require('jsonwebtoken'),
	d3color = require('d3-color'),
	d3scale = require('d3-scale'),
	coord = require('./src/coord'),
	common = require('./src/common')






const serverconfigfile = './config.json'

const serverconfig = require( serverconfigfile )


/////////////// globals
const genomes={}
const tabix = serverconfig.tabix || 'tabix'
const samtools = serverconfig.samtools || 'samtools'
const bigWigSummary = serverconfig.bigWigSummary || 'bigWigSummary'
const bigWigInfo = serverconfig.bigWigInfo || 'bigWigInfo'
const hicstat = serverconfig.hicstat || 'python read_hic_header.py'
const hicstraw = serverconfig.hicstraw || 'straw'




// launch
server_validate_config()
.then(()=>{
	server_launch()
})
.catch(err=>{
	console.error(err)
})






function server_launch() {

	const app = express()

	app.use( bodyParser.json({}) )
	app.use( bodyParser.text({limit:'1mb'}) )
	app.use(bodyParser.urlencoded({ extended: true })) 

	app.use((req, res, next)=>{
		res.header("Access-Control-Allow-Origin", "*")
		res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
		next()
	})


	app.use(express.static(__dirname+'/public'))
	app.use(compression())


	if(serverconfig.jwt) {
		console.log('JWT is activated')
		app.use( (req,res,next)=>{
			if(!req.headers || !req.headers.jwt) {
				res.send({error:'No authorization'})
				return
			}
			jsonwebtoken.verify( req.headers.jwt, serverconfig.jwt, (err, decode)=>{
				if(err) {
					res.send({error:'Not authorized'})
					return
				}
				next()
			})
		})
	}

	app.get('/genomes', handle_genomes)
	app.post('/genelookup', handle_genelookup)
	app.post('/snpbyname', handle_snpbyname)
	app.post('/ntseq', handle_ntseq)
	app.post('/bigwig', handle_bigwig)
	app.post('/tkbedj', handle_tkbedj)

	const port = serverconfig.port || 3000
	app.listen(port)
	console.log('STANDBY at port',port)
}




///////////////////////////////// validate server config


async function server_validate_config() {


	const cfg = serverconfig

	if(!cfg.filedir) throw '.filedir missing'
	if(cfg.filedir[0]!='/') throw '.filedir should begin with /'
	if(await file_not_exist(cfg.filedir) ) throw 'filedir does not exist: '+cfg.filedir
	if(await file_not_readable(cfg.filedir) ) throw 'filedir not readable: '+cfg.filedir
	if(!cfg.cachedir) throw '.cachedir missing'
	if(cfg.cachedir[0]!='/') throw '.cachedir should begin with /'
	if(await file_not_exist(cfg.cachedir) ) throw 'cachedir does not exist: '+cfg.cachedir
	if(await file_not_readable(cfg.cachedir) ) throw 'cachedir not readable: '+cfg.cachedir
	if(await file_not_writable(cfg.cachedir) ) throw 'cachedir not writable: '+cfg.cachedir

	if(cfg.jwt) {
		if(!cfg.jwt.secret) throw 'jwt.secret missing'
		if(!cfg.jwt.permissioncheck) throw 'jwt.permissioncheck missing'
	}

	if(!cfg.genomes) throw '.genomes[] missing'
	if(common.isBadArray(cfg.genomes)) throw '.genomes[] should be non-empty array'

	for(const g of cfg.genomes) {
		if(!g.name) throw '.name missing for a genome'
		if(!g.file) throw '.file missing for genome '+g.name
		const g2 = require( g.file )

		/*
		g is server-specific config for this genome
		g2 is genome as defined in the js file, may be hardcoded
		e.g.
		*/

		genomes[g.name]=g2

		// always have .tracks[]
		if(!g2.tracks) g2.tracks=[]

		if(g.tracks) {
			// supplement
			for(const t of g.tracks) {
				g2.tracks.push(t)
			}
		}

		// tracks validated in each genome

		g2.rawdslst = g.datasets || []

		// server-specific config to override genome.js file hardcoded attributes
		if(g.nosnpdb) {
			// no snp
			delete g2.snp
		}
		if(g.nohicenzyme) {
			delete g2.hicenzymefragment
		}
		if(g.nohicdomain) {
			delete g2.hicdomain
		}
		// register as global
		genomes[ g.name ] = g2
	}

	// validate each genome

	for(const genomename in genomes) {

		const g = genomes[genomename]

		if(!g.majorchr) throw '.majorchr missing for '+genomename
		if(typeof(g.majorchr)=='string') {
			const lst=g.majorchr.trim().split(/[\s\t\n]+/)
			const hash={}
			const chrorder=[]
			for(let i=0; i<lst.length; i+=2) {
				const chr=lst[i]
				const v = Number.parseInt(lst[i+1])
				if(!Number.isFinite(v) || v<=0) throw 'invalid chr len for '+chr+' from '+genomename
				hash[chr] = v
				chrorder.push(chr)
			}
			g.majorchr = hash
			g.majorchrorder = chrorder
		}
		if(g.minorchr) {
			if(typeof(g.minorchr)=='string') {
				const lst=g.minorchr.trim().split(/[\s\t\n]+/)
				const hash={}
				for(let i=0; i<lst.length; i+=2) {
					const v = Number.parseInt(lst[i+1])
					if(!Number.isFinite(v) || v<=0) throw 'invald chr len for '+lst[i]+' from '+genomename
					hash[lst[i]] = v
				}
				g.minorchr=hash
			}
		}

		if(!g.defaultcoord) throw '.defaultcoord missing for '+genomename
		if(!g.majorchr[ g.defaultcoord.chr ]) throw 'no length for defaultcoord.chr '+g.defaultcoord.chr
		if(!Number.isInteger(g.defaultcoord.start)) throw 'invalid value for defaultcoord.start'
		if(!Number.isInteger(g.defaultcoord.stop)) throw 'invalid value for defaultcoord.stop'


		if(!g.genomefile) throw 'genomefile missing for '+genomename
		if(!g.genomefile.endsWith('.gz')) throw 'genomefile '+g.genomefile+' not ending with .gz'
		g.genomefile = path.join( serverconfig.filedir, g.genomefile )
		if( await file_not_exist(    g.genomefile )) throw 'file not exist: '+g.genomefile
		if( await file_not_readable( g.genomefile )) throw 'file not readable: '+g.genomefile
		if( await file_not_exist(    g.genomefile+'.fai' )) throw '.fai index not exist: '+g.genomefile
		if( await file_not_readable( g.genomefile+'.fai' )) throw '.fai index not readable: '+g.genomefile
		if( await file_not_exist(    g.genomefile+'.gzi' )) throw '.gzi index not exist: '+g.genomefile
		if( await file_not_readable( g.genomefile+'.gzi' )) throw '.gzi index not readable: '+g.genomefile

		// genedb is required
		try {
			validate_genedb( g.genedb )
		} catch(e) {
			throw genomename+'.genedb: '+e
		}

		// proteindomain db is optional
		try {
			validate_proteindomain( g.proteindomain )
		} catch(e) {
			throw genomename+'.proteindomain: '+e
		}

		// snp is optional
		try {
			validate_snpdb( g.snp )
		} catch(e) {
			throw genomename+'.snp: '+e
		}

		if(g.tracks) {
			for(const tk of g.tracks) {
				if( tk.__isgene ) {
				} else {
				}
			}
		}

		if( g.snp ) {
			// expose snp as tracks, but not file and other attributes
			if(!g.tracks) g.tracks = []
			for(const snp of g.snp) {
				g.tracks.push( {
					type: common.tkt.bedj,
					name: snp.tk.name,
					issnp: snp.name,
					categories: snp.tk.categories
				})
			}
		}

		/*
		done everything except dataset
		*/

		g.datasets={}
		for(const d of g.rawdslst) {
			/*
			for each raw dataset
			*/

			if(!d.name) throw 'a nameless dataset from '+genomename
			if(g.datasets[d.name]) throw genomename+' has duplicating dataset name: '+d.name
			let ds
			if(d.jsfile) {
				ds=require(d.jsfile)
			} else {
				throw 'jsfile not available for dataset '+d.name+' of '+genomename
			}
			ds.label=d.name
			g.datasets[ds.label]=ds
		}

		delete g.rawdslst
	}
}


async function validate_genedb ( g ) {
	// genome.genedb
	if(!g) throw '.genedb missing'
	if(!g.dbfile) throw '.dbfile missing'
	g.dbfile = path.join(serverconfig.filedir, g.dbfile)
	if(await file_not_exist(g.dbfile)) throw '.dbfile not exist'
	if(await file_not_readable(g.dbfile)) throw '.dbfile not readable'

	//if(!g.statement_getnamebyname) throw '.statement_getnamebyname missing'
	if(!g.statement_getnamebyisoform) throw '.statement_getnamebyisoform missing'
	if(!g.statement_getnamebynameorisoform) throw '.statement_getnamebynameorisoform missing'
	if(!g.statement_getjsonbyname) throw '.statement_getjsonbyname missing'
	if(!g.statement_getjsonbyisoform) throw '.statement_getjsonbyisoform missing'
	if(!g.statement_getnameslike) throw '.statement_getnameslike missing'
	let db
	try {
		db = bettersqlite( g.dbfile, {readonly:true, fileMustExist:true} )
	} catch(e) {
		throw 'cannot read dbfile'
	}
	//g.getnamebyname          = db.prepare( g.statement_getnamebyname )
	g.getnamebyisoform       = db.prepare( g.statement_getnamebyisoform )
	g.getnamebynameorisoform = db.prepare( g.statement_getnamebynameorisoform )
	g.getjsonbyname          = db.prepare( g.statement_getjsonbyname )
	g.getjsonbyisoform       = db.prepare( g.statement_getjsonbyisoform )
	g.getnameslike           = db.prepare( g.statement_getnameslike )
	if( g.statement_getnamebyalias ) {
		g.getnamebyalias = db.prepare( g.statement_getnamebyalias )
	}
}


async function validate_proteindomain ( g ) {
	if(!g) return // db is optional
	if(!g.dbfile) throw '.dbfile missing'
	g.dbfile = path.join( serverconfig.filedir, g.dbfile )
	if(await file_not_exist(g.dbfile)) throw '.dbfile not exist'
	if(await file_not_readable(g.dbfile)) throw '.dbfile not readable'
	if(!g.statement) throw '.statement missing'
	let db
	try {
		db = bettersqlite( g.dbfile, {readonly:true, fileMustExist:true} )
	} catch(e) {
		throw 'cannot read proteindomain.dbfile'
	}
	g.get = db.prepare( g.statement )
}


async function validate_snpdb ( lst ) {
	/*
	genome.snp[] is array
	each snp db has both sqlite and bedj track
	*/
	if(!lst) return
	if(common.isBadArray(lst)) throw '.snp must be array'

	for(const snp of lst) {
		/*
		snp must have both sqlite db and bedj track
		*/
		if(!snp.name) throw '.key missing from a snpdb'

		if(!snp.db) throw '.db{} missing for '+snp.name
		if(!snp.db.dbfile) throw '.db.dbfile missing for '+snp.name
		snp.db.dbfile = path.join(serverconfig.filedir, snp.db.dbfile)
		if(await file_not_exist(snp.db.dbfile)) throw 'snp dbfile not exist for '+snp.name
		if(await file_not_readable(snp.db.dbfile)) throw 'snp dbfile not readable for '+snp.name

		if(!snp.db.statement) throw '.db.statement missing for '+snp.name

		let db
		try {
			db = bettersqlite( snp.db.dbfile, {readonly:true, fileMustExist:true} )
		} catch(e) {
			throw 'cannot read dbfile: '+snp.db.dbfile
		}
		snp.db.get = db.prepare( snp.db.statement )

		if(!snp.tk) throw '.snp.tk{} missing for '+snp.name
		if(!snp.tk.file) throw '.snp.tk.file missing for '+snp.name
		illegalpath(snp.tk.file)
		snp.tk.file = path.join( serverconfig.filedir, snp.tk.file )
		const err = await validate_tabixfile( snp.tk.file )
		if(err) throw 'tk.file error for '+snp.name+': '+err
	}
}


///////////////////////////////// END of validate server config











////////////////////////////////////////////////// sec


async function handle_genomes( req, res) {
	const hash={}
	for(const genomename in genomes) {
		const g=genomes[genomename]
		const g2={
			species: g.species,
			name:genomename,
			defaultcoord:g.defaultcoord,
			isdefault:g.isdefault,
			majorchr:g.majorchr,
			majorchrorder:g.majorchrorder,
			minorchr:g.minorchr,
			tracks:g.tracks,
			//hicenzymefragment:g.hicenzymefragment,
			datasets:{}
		}

		for(const dsname in g.datasets) {
			const ds=g.datasets[dsname]

			const _ds = mds_clientcopy( ds )
			if(_ds) {
				g2.datasets[ds.label] = _ds
			}
		}

		if(g.hicdomain) {
			g2.hicdomain = { groups: {} }
			for(const s1 in g.hicdomain.groups) {
				const tt = g.hicdomain.groups[s1]
				g2.hicdomain.groups[s1] = {
					name: tt.name,
					reference: tt.reference,
					sets: {}
				}
				for(const s2 in tt.sets) {
					g2.hicdomain.groups[s1].sets[s2] = {
						name: tt.sets[s2].name,
						longname: tt.sets[s2].longname
					}
				}
			}
		}

		hash[genomename]=g2
	}

	res.send({
		genomes:hash,
		debugmode: serverconfig.debugmode,
		headermessage: serverconfig.headermessage,
		base_zindex: serverconfig.base_zindex,
		lastupdate: await whenisserverupdated()
	})
}



function handle_genelookup( req, res ) {
	// better sqlite3 is synchronous
	try {
		const q = JSON.parse(req.body)
		log(req,q)
		if(!q.input) throw 'no input'
		const genome = genomes[q.genome]
		if(!genome) throw 'invalid genome name'

		if(q.deep) {
			if( q.isisoform ) {
				const out = genome.genedb.getjsonbyisoform.all( q.input )
				const lst = []
				for(const i of out) {
					lst.push( JSON.parse( i.genemodel ) )
				}
				return res.send( { lst: lst })
			}
			/*
			gene name should have been cleaned,
			no alias
			*/
			const out = genome.genedb.getjsonbyname.all( q.input )
			const lst = []
			for(const i of out) {
				const j = JSON.parse( i.genemodel )
				if(i.isdefault) j.isdefault = true
				lst.push(j)
			}
			return res.send( { lst: lst })
		}

		let names = genome.genedb.getnameslike.all( q.input+'%' )
		if(names.length) {
			// found by symbol
			return res.send( { lst: (names.length>20 ? names.slice(0,20) : names) } )
		}

		if( genome.genedb.getnamebyalias ) {
			names = genome.genedb.getnamebyalias.all( q.input )
			if(names.length) {
				// found symbol by alias
				for(const n of names) {
					n.alias = q.input
				}
				return res.send({lst:names})
			}
		}

		names = genome.genedb.getnamebyisoform.all( q.input )
		if(names.length) {
			// found name by isoform
			for(const n of names) {
				n.isoform = q.input
			}
			return res.send({lst:names})
		}

		// no hit
		res.send({lst:[]})

	} catch(e){
		if(e.stack) console.error(e.stack)
		res.send({error: (e.message || e)})
	}
}




function handle_snpbyname( req, res ) {
	try {
		const q = JSON.parse(req.body)
		log(req,q)
		if(!q.str) throw 'no input string'
		const genome = genomes[q.genome]
		if(!genome) throw 'invalid genome name'
		if(!genome.snp) throw 'snp not available for '+q.genome

		// only query the first snp set, may fix later
		const snp = genome.snp[0]
		const hit = snp.db.get.get( q.str )
		return res.send({ hit: hit })

	} catch(e){
		if(e.stack) console.error(e.stack)
		res.send({error: (e.message || e)})
	}
}




async function handle_ntseq ( req, res ) {
	try {
		const q = JSON.parse(req.body)
		log(req,q)
		if(!q.chr) throw 'no chr'
		if(!common.isPositiveInteger( q.start )) throw 'start is not positive integer'
		if(!common.isPositiveInteger( q.stop )) throw 'stop is not positive integer'
		const genome = genomes[q.genome]
		if(!genome) throw 'invalid genome name'
		const seq = await get_ntseq( genome, q.chr, q.start, q.stop )
		res.send({seq: seq})

	} catch(e){
		if(e.stack) console.error(e.stack)
		res.send({error: (e.message || e)})
	}
}








async function handle_bigwig ( req, res ) {
	try {
		const q = JSON.parse(req.body)
		log(req,q)

		const genome = genomes[ q.genome ]
		if(!genome) throw 'invalid genome name'
		const [ file, url ] = fileurl( q )
		if( common.isBadArray( q.views )) throw '.views[] should be array'
		if( !q.scale ) throw '.scale{} missing'
		if(q.scale.auto) {
		} else if(q.scale.percentile) {
			if(!Number.isFinite(q.scale.percentile) || q.scale.percentile<=0 || q.scale.percentile>=100) throw 'scale.percentile should be 0-100'
		} else {
			if(!Number.isFinite(q.scale.min)) throw 'scale.min invalid value'
			if(!Number.isFinite(q.scale.max)) throw 'scale.max invalid value'
			if(q.scale.max <= q.scale.min) throw 'scale min >= max'
		}
		if(!common.isPositiveInteger(q.barheight)) throw 'invalid barheight'

		const fileobj = await validate_bigwig( file, url, genome )


		const result = {
			view2img: {}
		}
		for(const view of q.views) {
			if( common.isBadArray( view.regions )) throw 'view.regions[] should be array'
			result.view2img[ view.id ] = { }
			// .src, .width
			for(const region of view.regions) {
				region.values = await handle_bigwig_queryfile(
					fileobj,
					region,
					q.dotplotfactor,
					q.dividefactor
				)
			}
		}
		handle_bigwig_render( q, result )
		res.send(result)
	} catch(e){
		if(e.stack) console.error(e.stack)
		res.send({error: (e.message || e)})
	}
}


function handle_bigwig_render ( q, result ) {
	/*
	q:
		.pcolor
		.barheight
		.views[ { id, regions:[], regionspace } ]
			.width
			.values[]
		.scale.auto
	result:
		view2img{}
	*/
	if(q.scale.auto || q.scale.percentile) {
		// get min/max across all views
		const positive=[]
		const negative=[]
		for(const v of q.views) {
			for(const r of v.regions) {
				if(!r.values) continue
				for(const v of r.values) {
					if(Number.isNaN(v)) continue
					if(v>=0) {
						positive.push(v)
					} else {
						negative.push(v)
					}
				}
			}
		}
		if(positive.length) {
			positive.sort((a,b)=>a-b)
			if(q.scale.auto) {
				q.scale.max = positive[ positive.length-1 ]
			} else {
				q.scale.max = positive[ Math.floor( positive.length * q.scale.percentile/100) ]
			}
		} else {
			q.scale.max = 0
		}
		if(negative.length) {
			negative.sort((a,b)=>b-a)
			if(q.scale.auto) {
				q.scale.min = negative[ negative.length-1 ]
			} else {
				q.scale.min = negative[ Math.floor(negative.length * q.scale.percentile/100) ]
			}
		} else {
			q.scale.min = 0
		}
		result.min = q.scale.min
		result.max = q.scale.max
	}


	let hscale
	if(q.barheight > 10) {
		// for barplot
		hscale = makeyscale().height(q.barheight).min(q.scale.min).max(q.scale.max)
	}

	for(const view of q.views ) {
		result.view2img[ view.id ].width = view.width
		const canvas = new Canvas( view.width, q.barheight )
		const ctx = canvas.getContext('2d')

		const pointwidth = 1 // line/dot plot width
		const pointshift = q.dotplotfactor ? q.dotplotfactor : 1 // shift distance

		if(q.barheight<=10) {
			/*
			heatmap
			*/
			let r = d3color.rgb( q.pcolor )
			const rgbp = r.r+','+r.g+','+r.b
			r = d3color.rgb( q.ncolor )
			const rgbn = r.r+','+r.g+','+r.b
			let x=0
			for(const r of view.regions ) {
				if(r.values) {
					for(let i=0; i<r.values.length; i++) {
						const v=r.values[i]
						if(Number.isNaN(v)) continue
						ctx.fillStyle = v >= q.scale.max ? q.pcolor2 :
							(v>=0 ? 'rgba('+rgbp+','+(v/q.scale.max)+')' :
							(v<=q.scale.min ? q.ncolor2 : 'rgba('+rgbn+','+(v/q.scale.min)+')'))
						const x2 = Math.ceil( x + ( view.reverse ? r.width-pointshift*i : pointshift*i ) )
						ctx.fillRect( x2, 0, pointwidth, q.barheight )
					}
				}
				x += r.width + view.regionspace
			}
		} else {
			/*
			barplot
			*/
			let x=0
			for(const r of view.regions) {
				if(r.values) {
					for(let i=0; i<r.values.length; i++) {
						const v = r.values[i]
						if(Number.isNaN(v)) continue
						ctx.fillStyle = v>0 ? q.pcolor : q.ncolor
						const x2 = Math.ceil( x +( view.reverse ? r.width - pointshift*i : pointshift*i ) )
						const tmp=hscale(v)
						if(v>0) {
							ctx.fillRect(x2, tmp.y, pointwidth, q.dotplotfactor ? Math.min(2, tmp.h) : tmp.h)
						} else {
							if(q.dotplotfactor) {
								const _h=Math.min(2, tmp.h)
								ctx.fillRect(x2, tmp.y+tmp.h-_h, pointwidth, _h)
							} else {
								ctx.fillRect(x2, tmp.y, pointwidth, tmp.h)
							}
						}

						if(v > q.scale.max) {
							ctx.fillStyle = q.pcolor2
							ctx.fillRect(x2,0,pointwidth,2)
						} else if(v < q.scale.min) {
							ctx.fillStyle = q.ncolor2
							ctx.fillRect(x2, q.barheight-2, pointwidth, 2 )
						}
					}
				}
				x += r.width + q.regionspace
			}
		}
		result.view2img[ view.id ].src = canvas.toDataURL()
	}
}



function makeyscale() {
	var barheight=50,
		minv=0,
		maxv=100
	function yscale(v){
		var usebaseline=false
		var baseliney=0
		if(minv==0 && maxv==0) {
			// nothing
		} else if(minv<=0 && maxv>=0) {
			usebaseline=true
			baseliney=barheight*maxv/(maxv-minv)
		}
		if(usebaseline) {
			if(v>=maxv) return {y:0,h:baseliney}
			if(v>=0) {
				var h=baseliney*v/maxv
				return {y:baseliney-h,h:h}
			}
			if(v<=minv) return {y:baseliney,h:barheight-baseliney}
			var h=(barheight-baseliney)*v/minv
			return {y:baseliney,h:h}
			return
		}
		if(v<=minv) return {y:barheight,h:0}
		var h=barheight*(v-minv)/(maxv-minv)
		return {y:barheight-h,h:h}
	}
	yscale.height=function(h){
		barheight=h
		return yscale
	}
	yscale.min=function(v){
		minv=v
		return yscale
	}
	yscale.max=function(v){
		maxv=v
		return yscale
	}
	return yscale
}


function handle_bigwig_queryfile ( fileobj, region, dotplotfactor, dividefactor ) {
	/*
	fileobj: {file, url, nochr}
	*/
	return new Promise((resolve,reject)=>{
		const ps = spawn( bigWigSummary, [
			'-udcDir='+serverconfig.cachedir,
			fileobj.file || fileobj.url,
			fileobj.nochr ? region.chr.replace('chr','') : region.chr,
			region.start,
			region.stop,
			Math.ceil( region.width * (dotplotfactor || 1) )
		])
		const out=[], out2=[]
		ps.stdout.on('data',i=>out.push(i))
		ps.stderr.on('data',i=>out2.push(i))
		ps.on('close',()=>{
			const err = out2.join('')
			if(err) {
				if(err.startsWith('no data')) resolve([])
				reject( err )
			}
			const lst = out.join('').trim().split('\t').map(Number.parseFloat)
			if(dividefactor) resolve( lst.map( i=> i/dividefactor) )
			resolve( lst )
		})
	})
}



async function validate_bigwig ( file, url, genome ) {
	if( file ) {
		if( await file_not_exist( file ) ) throw 'file not found'
		if( await file_not_readable( file ) ) throw 'file not readable'
	}
	const output = await getfileinfo_bigwig( file || url )
	if(!output) throw 'not a bigWig file'
	const nochr = ifnochr_bigwig( output, genome )
	return {
		file: file,
		url: url,
		nochr: nochr
	}
}


async function validate_tabixtrack ( filefullpath, url, indexURL, genome ) {
	if(filefullpath) {
		const err = await validate_tabixfile( filefullpath )
		if(err) throw err
		const chrlst = await getchrlst_tabix( filefullpath )
		if(!chrlst) throw 'not a tabix file'
		return {
			file: filefullpath,
			nochr: contigNameNoChr( chrlst, genome )
		}
	}
	if(!url) throw 'neither file or url given'


	const indexurl = indexURL || url+'.tbi' // no .csi

	const tmp = indexurl.split('//')
	if(tmp.length!=2) throw 'invalid index URL: '+indexurl

	// path of the index file, not including file name
	const dir = path.join( serverconfig.cachedir, tmp[0], tmp[1] )

	/*
	index file full path
	for .tbi index file coming from dnanexus, convert the downloaded cache file to .csi
	XXX FIXME why .tbi index doesn't work natively on dnanexus??
	*/
	let indexfile = path.basename(tmp[1])
	if(indexurl.startsWith('https://dl.dnanex.us') ||
		indexurl.startsWith('https://westus.dl.azure.dnanex.us') ||
		indexurl.startsWith('https://westus.dl.stagingazure.dnanex.us')
		) {
		indexfile = indexfile.replace(/tbi$/,'csi')
	}

	const indexFilepath = path.join( dir,  indexfile )

	if( await file_not_exist( dir )) {
		if(! (await create_directory( dir ) )) throw 'cannot create directory for index file'
	}
	if( await file_not_writable( dir )) throw 'cannot write to index file directory'
	if( await file_not_exist( indexFilepath ) ) {
		await downloadFileSaveTo( indexurl, indexFilepath )
	}
	const chrlst = await getchrlst_tabix( url, dir )
	if(!chrlst) throw 'URL does not point to tabix file'
	return {
		url: url,
		dir: dir,
		nochr: contigNameNoChr( chrlst, genome )
	}
}


function downloadFileSaveTo( url, tofile ) {
	return new Promise((resolve,reject)=>{
		const f = fs.createWriteStream(tofile)

		f.on('finish',()=>{
			f.close()
			resolve()
		})

		( url.startsWith('https') ? https : http )
		.get( url, (response)=>{
			response.pipe(f)
		})
		.on('error', err=>{
			reject('cannot download index file')
		})
	})
}




async function getchrlst_tabix ( file, dir ) {
	/* file is either full-path file or url
	in case of url, dir must be given
	*/
	return new Promise((resolve,reject)=>{
		const ps = spawn(tabix, [ '-l', file], {cwd: dir} )
		const out=[], out2=[]
		ps.stdout.on('data',i=>out.push(i))
		ps.stderr.on('data',i=>out2.push(i))
		ps.on('close',()=>{
			const err = out2.join('')
			if(err) resolve(null)
			resolve( out.join('').trim().split('\n') )
		})
	})
}





async function handle_tkbedj ( req, res ) {
	try {
		const q = JSON.parse(req.body)
		log(req,q)

		const genome = genomes[ q.genome ]
		if(!genome) throw 'invalid genome name'
		q.genome = genome

		const fileobj = await handle_bedj_fileobj( q, genome )

		if( common.isBadArray( q.views )) throw '.views[] should be array'
		for(const view of q.views) {
			if( common.isBadArray( view.regions )) throw 'view.regions[] should be array'

			if( handle_bedj_rangetoobig( fileobj, view ) ) {
				// view range beyond limit, drawn an alert message
				continue
			}

			await handle_bedj_getdata_view( fileobj, view )

			if( view.lineset ) {
				await handle_bedj_render_stack( view, fileobj, q )
			} else {
				handle_bedj_render_depth( view, q )
			}
		}

		const result = {
			views: [],
		}
		let maxdepth = 0
		for(const view of q.views) {
			result.views.push( {
				id: view.id,
				src: view.src,
				width: view.width,
				height: view.height,
			} )
			if( view.regions[0].depth ) {
				// depth
				for(const r of view.regions) {
					for(const v of r.depth) {
						maxdepth = Math.max( v, maxdepth )
					}
				}
			}
		}
		if( maxdepth ) result.maxdepth = maxdepth

		res.send(result)

	} catch(e){
		if(e.stack) console.error(e.stack)
		res.send({error: (e.message || e)})
	}
}



async function handle_bedj_fileobj( q, genome ) {
	if( q.issnp ) {
		// TODO snp tk
		if( !genome.snp) throw 'genome has no snp'
		const snptk = genome.snp.find( i=> i.name == q.issnp )
		if( !snptk ) throw 'no snp track found for '+q.issnp
		const fileobj = { issnp: 1, }
		for(const k in snptk.tk) {
			fileobj[k] = snptk.tk[k]
		}
		return fileobj
	}

	const [ file, url ] = fileurl( q )
	const fileobj = await validate_tabixtrack( file, url, q.indexURL, genome )

	if( fileobj.file ) {
		// check if it is a native gene track
		if( genome.tracks.find( i=> i.__isgene && path.join(serverconfig.filedir,i.file) == fileobj.file ) ) {
			fileobj.isgene = true
		}
	}
	return fileobj
}



function handle_bedj_rangetoobig ( fileobj, view ) {
	if(fileobj.noshowbeyondrange) {
		if( view.regions.reduce((i,j)=>i+j.stop-j.start,0) > fileobj.noshowbeyondrange ) {
			// above limit
			const h = 50
			const canvas=new Canvas( view.width, h )
			const ctx=canvas.getContext('2d')
			ctx.font = '16px Arial'
			ctx.fillStyle='#aaa'
			ctx.textAlign='center'
			ctx.textBaseline='middle'
			ctx.fillText('Zoom in under '+common.bplen(fileobj.noshowbeyondrange)+' to view data', view.width/2, h/2 )
			view.src = canvas.toDataURL()
			view.height = h
			return true
		}
	}
	return false
}


async function handle_bedj_getdata_view ( fileobj, view ) {
	/*
	view {}
		regions [ {} ]
	
	for each region, fetch lines and add to view.lineset
	when # of lines grow too big
	convert lines to region.depth[], length by region.width, and add subsequent lines to coverage
	delete view.lineset

	otherwise, keep view.lineset for stack
	*/
	view.lineset = new Set()

	for(const region of view.regions) {
		await handle_bedj_getdata_region( fileobj, view, region )
	}
}


async function handle_bedj_getdata_region ( fileobj, view, region ) {
	return new Promise((resolve,reject)=>{
		const ps = spawn( tabix, [
			fileobj.file || fileobj.url,
			(fileobj.nochr ? region.chr.replace('chr','') : region.chr)+':'+region.start+'-'+region.stop,
			{cwd: fileobj.dir}
		])
		const out2 = []
		ps.stderr.on('data',i=>out2.push(i))
		const rl = readline.createInterface({input: ps.stdout})
		rl.on('line',line=>{

			if( view.lineset ) {
				// recording lines
				view.lineset.add( line )
				handle_bedj_getdata_mayflipmode( view )
				return
			}
			// recording depth
			handle_bedj_line2regiondepth( line, view, region )
		})
		rl.on('close',()=>{
			const err = out2.join('')
			if(err) throw err
			resolve()
		})
	})
}


function handle_bedj_getdata_mayflipmode ( view ) {
	if( view.lineset.size < 500 ) {
		// no flip
		return
	}
	for(const region of view.regions) {
		region.depth = []
		for(let i=0; i<region.width; i++) region.depth.push(0)
		
		region.binbpsize = (region.stop - region.start) / region.width
	}
	// collapse all lines to depth
	for(const line of view.lineset) {
		handle_bedj_line2regiondepth( line, view )
	}
	console.log('flipped', Math.max(...view.regions[0].depth))
	delete view.lineset
}



function handle_bedj_line2regiondepth ( line, view, region ) {
	const l = line.split('\t')
	const start = Number.parseInt(l[1])
	const stop = Number.parseInt(l[2])
	if( ! region ) {
		region = view.regions.find( r => Math.max( r.start, start) <= Math.min( r.stop, stop ) )
		if(!region) throw start+'-'+stop+' not falling into any region'
	}
	const start0 = Math.max( region.start, start )
	const stop0  = Math.min( region.stop, stop )
	/*
	for(let i=Math.floor((start0-region.start)/region.binbpsize); start0+region.binbpsize*(i+1)< stop0; i++) {
		region.depth[ i ]++
	}
	*/
	let i=Math.floor((start0-region.start)/region.binbpsize)
	while(1) {
		region.depth[ i++ ]++
		if(start0+region.binbpsize*(i+1) >= stop0) break
	}
}



async function handle_bedj_render_stack ( view, fileobj, q ) {
	/*
	view {}
		reverse
		lineset
		regions [ {} ]
			start/stop/width
		regionspace
		width
	fileobj {}
		isgene -- only from server-side config
	q {}
		stackheight
		stackspace
		categories {}
		color
		genome
	*/

	const items = []
	for(const line of view.lineset) {
		const l = line.split('\t')
		const j = JSON.parse(l[3])
		j.start = Number.parseInt(l[1])
		j.stop  = Number.parseInt(l[2])
		items.push( j )
	}

	let maytranslate = false
	if( fileobj.isgene ) {
		let bp=0, w=0
		for(const r of view.regions) {
			bp += r.stop - r.start
			w += r.width
		}
		if( bp < w*3 ) maytranslate = true
	}

	const fontsize = q.stackheight - 2

	const translateitem=[]
	const namespace=1
	const namepad=10 // box no struct: [pad---name---pad]
	const canvas=new Canvas(10,10) // for measuring text only
	let ctx=canvas.getContext('2d')
	ctx.font='bold '+fontsize+'px Arial'
	const packfull = items.length<200
	const mapisoform = items.length<200 ? [] : null

	// sort items
	items.sort((a,b)=>{
		if( view.reverse ) {
			if(a.stop==b.stop) {
				return a.start-b.start
			}
			return b.stop-a.stop
		}
		if(a.start==b.start) {
			return b.stop-a.stop
		}
		return a.start-b.start
	})

	const hasstruct = items.find( i=> i.exon )

	// for each region, make coord 2 px scale 
	{
		let x = 0
		for(const r of view.regions) {
			r.scale = d3scale.scaleLinear()
				.range([ x, x + r.width ])
			if( view.reverse ) {
				r.scale.domain([ r.stop, r.start ])
			} else {
				r.scale.domain([ r.start, r.stop ])
			}
			x += r.width + view.regionspace
		}
	}

	// stack
	const stack = [ 0 ]
	let maxstack = 1,
		mapexon = null

	for(const item of items) {

		item.rglst = [] // list of regions which this item is in
		// px position in view.regions
		let itemstartpx = null,
			itemstoppx = null

		for(const r of view.regions ) {
			const a=Math.max(item.start,r.start)
			const b=Math.min(item.stop,r.stop)
			if(a<b) {
				// item in this region
				const x1 = r.scale( a )
				const x2 = r.scale( b )
				itemstartpx = Math.min( x1, x2 )
				itemstoppx  = Math.max( x1, x2 )
				item.rglst.push( r )
			}
		}

		if(itemstartpx==null) {
			continue
		}

		item.canvas = {
			start:itemstartpx,
			stop:itemstoppx,
			stranded:(item.strand!=undefined),
		}

		if(item.coding && maytranslate) {
			item.willtranslate=true // so later the strand will not show
			translateitem.push(item)
		}

		let boxstart = itemstartpx
		let boxstop  = itemstoppx
		if(packfull) {
			// check item name
			const namestr = item.name ? item.name : null
			if(namestr) {
				item.canvas.namestr=namestr
				const namewidth=ctx.measureText( namestr ).width
				if(hasstruct) {
					if(item.canvas.start>=namewidth+namespace) {
						item.canvas.namestart=item.canvas.start-namespace
						boxstart=item.canvas.namestart-namewidth
						item.canvas.textalign='right'
					} else if(item.canvas.stop+namewidth+namespace <= view.width) {
						item.canvas.namestart=item.canvas.stop+namespace
						boxstop=item.canvas.namestart+namewidth
						item.canvas.textalign='left'
					} else {
						item.canvas.namehover=true
						item.canvas.namewidth=namewidth
						item.canvas.textalign='left'
					}
				} else {
					if(Math.min(view.width,item.canvas.stop)-Math.max(0,item.canvas.start)>=namewidth+namepad*2) {
						item.canvas.namein=true
					} else if(item.canvas.start>=namewidth+namespace) {
						item.canvas.namestart=item.canvas.start-namespace
						boxstart=item.canvas.namestart-namewidth
						item.canvas.textalign='right'
					} else if(item.canvas.stop+namewidth+namespace <= view.width) {
						item.canvas.namestart=item.canvas.stop+namespace
						boxstop=item.canvas.namestart+namewidth
						item.canvas.textalign='left'
					} else {
						// why??
						item.canvas.namein=true
					}
				}
			}
		}
		if(item.canvas.stop-item.canvas.start > view.width * .3) {
			// enable
			mapexon = []
		}
		for(let i=1; i<=maxstack; i++) {
			if(stack[i]==undefined || stack[i]<boxstart) {
				item.canvas.stack=i
				stack[i]=boxstop
				break
			}
		}
		if(item.canvas.stack==undefined) {
			maxstack++
			stack[maxstack]=boxstop
			item.canvas.stack=maxstack
		}
		if(mapisoform && (item.name || item.isoform)) {
			const show=[]
			if(item.name) show.push(item.name)
			if(item.isoform) show.push(item.isoform)
			mapisoform.push({
				x1:item.canvas.start,
				x2:item.canvas.stop,
				y:item.canvas.stack,
				name:show.join(' ')+printcoord(item.chr, item.start, item.stop)
			})
		}
	}

	// render

	canvas.width = view.width
	const finalheight = (q.stackheight + q.stackspace) * maxstack - q.stackspace
	canvas.height = finalheight
	ctx = canvas.getContext('2d')
	ctx.font = 'bold '+fontsize+'px Arial'
	ctx.textBaseline='middle'
	ctx.lineWidth=1

	const thinpad = Math.ceil( q.stackheight/4 )-1

	for(const item of items) {

		// render an item 

		const c=item.canvas
		if(!c) {
			// invisible item
			continue
		}

		item.fillcolor =
			(q.categories && item.category && q.categories[item.category]) ?
				q.categories[item.category].color :
				(item.color || q.color)
		ctx.fillStyle = item.fillcolor

		const y = (q.stackheight + q.stackspace) * (c.stack-1)


		if( item.exon || item.rglst.length>1 ) {
			// through line
			ctx.strokeStyle = item.fillcolor
			ctx.beginPath()	
			ctx.moveTo(c.start, Math.floor(y + q.stackheight/2)+.5)
			ctx.lineTo(c.stop,  Math.floor(y + q.stackheight/2)+.5)
			ctx.stroke()
		}


		// parts of item
		const thinbox = []
		if(item.utr3) {
			thinbox.push(...item.utr3)
		}
		if(item.utr5) {
			thinbox.push(...item.utr5)
		}
		if(item.exon && (!item.coding || item.coding.length==0)) {
			thinbox.push(...item.exon)
		}

		const thick=[]
		if(item.exon) {
			if(item.coding && item.coding.length>0) {
				thick.push(...item.coding)
			}
		} else {
			thick.push([item.start,item.stop])
		}

		let _strand=item.strand
		if(c.stranded && view.reverse) {
			_strand = item.strand=='+' ? '-' : '+'
		}

		for(const r of item.rglst) {
			for(const e of thinbox) {
				const a=Math.max(e[0],r.start)
				const b=Math.min(e[1],r.stop)
				if(a<b) {
					const pxa=r.scale( view.reverse ? b : a)
					const pxb=r.scale( view.reverse ? a : b )
					ctx.fillRect(pxa, y+thinpad, Math.max(1,pxb-pxa), q.stackheight-thinpad*2)
				}
			}
			for(const e of thick) {
				const a=Math.max(e[0],r.start)
				const b=Math.min(e[1],r.stop)
				if(a<b) {
					const pxa = r.scale( view.reverse ? b : a)
					const pxb = r.scale( view.reverse ? a : b )
					ctx.fillRect( pxa, y, Math.max(1,pxb-pxa), q.stackheight )
					if(c.stranded && !item.willtranslate) {
						ctx.strokeStyle='white'
						strokearrow(ctx, _strand, pxa, y+thinpad, pxb-pxa, q.stackheight-thinpad*2)
					}
				}
			}
			if(c.stranded && item.intron) {
				// intron arrows
				ctx.strokeStyle = item.fillcolor
				for(const e of item.intron) {
					const a = Math.max( e[0], r.start)
					const b = Math.min( e[1], r.stop)
					if(a<b) {
						const pxa = r.scale( view.reverse ? b : a)
						const pxb = r.scale( view.reverse ? a : b )
						strokearrow( ctx, _strand, pxa, y+thinpad, pxb-pxa, q.stackheight-thinpad*2 )
					}
				}
			}

			if(mapexon && item.exon) {
				// client tooltip
				for(const [ i, e ] of item.exon.entries() ) {
					const a = Math.max( e[0], r.start )
					const b = Math.min( e[1], r.stop )
					if(a<b) {
						const x1 = r.scale( view.reverse ? b : a)
						const x2 = r.scale( view.reverse ? a : b)
						mapexon.push({
							x1:x1,
							x2:x2,
							y:c.stack,
							name:'Exon '+(i+1)+'/'+item.exon.length + printcoord(item.chr, e[0], e[1])
						})
					}
				}
				for(let i=1; i<item.exon.length; i++) {
					const istart=item.exon[ item.strand=='+' ? i-1 : i][1],
						  istop=item.exon[ item.strand=='+' ? i : i-1][0]
					if(istop<=r.start || istart>=r.stop) continue
					const a=Math.max(istart,r.start)
					const b=Math.min(istop, r.stop)
					if(a<b) {
						const x1 = r.scale( view.reverse ? b : a)
						const x2 = r.scale( view.reverse ? a : b)
						if(x2<0) continue
						mapexon.push({
							x1:x1,
							x2:x2,
							y:c.stack,
							name:'Intron '+i+'/'+(item.exon.length-1) + printcoord(item.chr, istart, istop)
						})
					}
				}
			}
		}

		// name
		if(c.namestart!=undefined) {
			ctx.textAlign = c.textalign
			ctx.fillStyle = item.fillcolor
			ctx.fillText(c.namestr, c.namestart, y + q.stackheight/2 )
		} else if(c.namehover) {
			const x=Math.max(10,c.start+10)
			ctx.fillStyle='white'
			ctx.fillRect(x, y, c.namewidth+10, q.stackheight )
			ctx.strokeStyle = item.fillcolor
			ctx.strokeRect( x+1.5, y+.5, c.namewidth+10-3, q.stackheight-2)
			ctx.fillStyle = item.fillcolor
			ctx.textAlign = 'center'
			ctx.fillText( c.namestr, x+c.namewidth/2+5, y+q.stackheight/2)
		} else if(c.namein) {
			ctx.textAlign='center'
			ctx.fillStyle='white'
			ctx.fillText(c.namestr,
				(Math.max(0,c.start)+Math.min( view.width,c.stop))/2,
				y + q.stackheight/2)
		}
	}

	for(const item of translateitem) {
		await handle_bedj_render_stack_translate( canvas, ctx, item, view, q )
	}

	view.src = canvas.toDataURL()
	view.height = finalheight
	view.mapisoform = mapisoform
	view.mapexon = mapexon
}




function strokearrow(ctx,strand,x,y,w,h) {
	const pad=h/2,
		arrowwidth=h/2,
		arrowpad=Math.max(h/2,6)
	if(w-pad*2<arrowwidth) return
	var arrownum=Math.ceil((w-pad*2)/(arrowwidth+arrowpad))
	if(arrownum<=0) return
	var forward=strand=='+'
	var x0=Math.ceil(x+(w-arrowwidth*arrownum-arrowpad*(arrownum-1))/2)
	for(var i=0; i<arrownum; i++) {
		ctx.beginPath()
		if(forward) {
			ctx.moveTo(x0,y)
			ctx.lineTo(x0+arrowwidth, y+h/2)
			ctx.moveTo(x0+arrowwidth, y+h/2+1)
			ctx.lineTo(x0,y+h)
		} else {
			ctx.moveTo(x0+arrowwidth,y)
			ctx.lineTo(x0, y+h/2)
			ctx.moveTo(x0, y+h/2+1)
			ctx.lineTo(x0+arrowwidth,y+h)
		}
		ctx.stroke()
		x0+=arrowwidth+arrowpad
	}
}



function printcoord(chr, start, stop) {
	return ' <span style="font-size:.7em;color:#858585">'+chr+':'+(start+1)+'-'+stop+' '+common.bplen(stop-start)+'</span>'
}



async function handle_bedj_render_stack_translate ( canvas, ctx, item, view, q ) {
	/*
	a single item
	*/

	if(!view.mapaa) view.mapaa = []

	const altcolor='rgba(122,103,44,.7)',
		errcolor='red',
		startcolor='rgba(0,255,0,.4)',
		stopcolor='rgba(255,0,0,.5)'


	ctx.textAlign='center'
	ctx.textBaseline='middle'

	const c=item.canvas
	const y = (q.stackheight + q.stackspace)*(c.stack-1)

	item.genomicseq = ( await get_ntseq( q.genome, view.regions[0].chr, item.start, item.stop ) ).toUpperCase()

	const aaseq = common.nt2aa(item)

	let cumx = 0

	for(const region of view.regions) {
		if( Math.max(item.start, region.start) > Math.min(item.stop, region.stop) ) {
			continue
		}

		const bppx = region.width / (region.stop-region.start)
		const _fs = Math.min( q.stackheight, bppx*3)
		const aafontsize=_fs<8 ? null : _fs
		let minustrand=false
		if(c.stranded && item.strand=='-') {
			minustrand=true
		}
		let cds=0
		if(aafontsize) {
			ctx.font=aafontsize+'px Arial'
		}
		for(const e of item.coding) {
			// each exon, they are ordered 5' to 3'
			if(minustrand) {
				if(e[0]>=item.stop) {
					cds+=e[1]-e[0]
					continue
				}
				if(e[1]<=item.start) {
					break
				}
			} else {
				if(e[1]<=item.start) {
					cds+=e[1]-e[0]
					continue
				}
				if(e[0]>=item.stop) {
					break
				}
			}

			const lookstart=Math.max(item.start, e[0]),
				lookstop=Math.min(item.stop, e[1])
			if(minustrand) {
				cds+=e[1]-lookstop
			} else {
				cds+=lookstart-e[0]
			}

			let codonspan=0
			for(let k=0; k<lookstop-lookstart;k++) {
				// each coding base
				cds++
				codonspan++

				let aanumber
				if(cds%3==0) {
					aanumber=(cds/3)-1
				} else {
					if(k<lookstop-lookstart-1) {
						continue
					} else {
						// at the 3' end of this exon
						aanumber=Math.floor(cds/3)
					}
				}

				let aa = aaseq[aanumber]
				let _fillcolor= Math.ceil(cds/3)%2==0 ? altcolor : null

				if(!aa) {
					aa=4 // show text "4" to indicate error
					_fillcolor=errcolor
				} else if(aa=='M') {
					_fillcolor=startcolor
				} else if(aa=='*') {
					_fillcolor=stopcolor
				}

				// draw aa
				let thispx
				let thiswidth=bppx*codonspan
				if(minustrand) {
					const thispos=lookstop-1-k
					thispx = region.scale(thispos)
				} else {
					const thispos=lookstart+k+1-codonspan
					thispx = region.scale(thispos)
				}
				if(view.reverse) {
					// correction!
					thispx-=thiswidth
				}


				codonspan=0
				if(thispx>=cumx && thispx<=cumx+region.width) {
					// in view range
					// rect
					if(_fillcolor) {
						ctx.fillStyle= _fillcolor
						ctx.fillRect(thispx,y,thiswidth, q.stackheight)
					}
					if(aafontsize) {
						ctx.fillStyle='white'
						ctx.fillText(aa,thispx+thiswidth/2, y+ q.stackheight/2 )
					}
					view.mapaa.push({
						x1:thispx,
						x2:thispx+thiswidth,
						y: c.stack,
						name: aa+(aanumber+1)+' <span style="font-size:.7em;color:#858585">AA residue</span>'
					})
				}
			}
		}
		cumx += region.width + view.regionspace
	}
	if(c.namehover) {
		ctx.font='bold '+(q.stackheight-2)+'px Arial'
		const x=Math.max(10,c.start+10)
		ctx.fillStyle='white'
		ctx.fillRect(x,y,c.namewidth+10, q.stackheight)
		ctx.strokeStyle = item.fillcolor
		ctx.strokeRect(x+1.5,y+.5,c.namewidth+10-3, q.stackheight-2)
		ctx.fillStyle = item.fillcolor
		ctx.fillText(c.namestr,x+c.namewidth/2+5, y + q.stackheight/2)
	}
}



function handle_bedj_render_depth ( view, q ) {
	/*
	view {}
		regions : [ {} ]
			depth: []
			width
	*/

	for(const r of view.regions) {
		r.values = r.depth
	}

	const q2 = {
		pcolor: q.color,
		barheight: q.barheight,
		views: [ view ],
		scale: {auto:1}
	}

	const result = { view2img:{} }
	result.view2img[ view.id ] ={}
	handle_bigwig_render( q2, result )
	view.height = q.barheight
	view.src = result.view2img[ view.id ].src
}







async function handle_TEMPLATE ( req, res ) {
	try {
		const q = JSON.parse(req.body)
		log(req,q)
		//res.send({seq: seq})

	} catch(e){
		if(e.stack) console.error(e.stack)
		res.send({error: (e.message || e)})
	}
}








////////////////////////////////////////////////// END of sec












////////////////////////////////////////////////// helpers





function log ( req, q ) {
	console.log('%s\t%s\t%s\t%s',
		url.parse(req.url).pathname,
		new Date(),
		req.header('x-forwarded-for') || req.connection.remoteAddress,
		JSON.stringify(q)
	)
}



function illegalpath ( s ) {
	if(s[0]=='/') return true
	if(s.indexOf('..')!=-1) return true
	return false
}



function stat_file ( file ) {
	// return stat, do not join path
	return new Promise((resolve,reject)=>{
		fs.stat( file, (e,s)=> resolve([e,s]) )
	})
}


async function whenisserverupdated() {
	const [e1, stat1] = await stat_file('server.js')
	if(e1) return 'error stating server.js'
	const date1 = stat1.mtime
	const [e2, stat2] = await stat_file('public/bin/proteinpaint.js')
	if(e2) return 'error stating proteinpaint.js'
	const date2 = stat2.mtime
	return ( date1<date2 ? date1 : date2 ).toDateString()
}



function get_ntseq ( genome, chr, start, stop ) {
	if(!chr) throw 'unknown chr'
	return new Promise( (resolve, reject) => {
		const out = [],
			out2 = []
		const ps = spawn( samtools, [ 'faidx', genome.genomefile, chr+':'+(start+1)+'-'+stop ] )
		ps.stdout.on('data', d=> out.push(d) )
		ps.stderr.on('data', d=> out2.push(d) )
		ps.on('close', ()=>{
			const err = out2.join('')
			if(err) reject('error getting sequence: '+err)
			const lines = out.join('').trim().split('\n')
			resolve( lines.slice(1).join('') )
		})
	})
}


function fileurl ( q ) {
	if(q.file) {
		if(illegalpath( q.file )) throw 'illegal file path'
		return [ path.join( serverconfig.filedir, q.file ) ]
	}
	if(q.url) return [ null, q.url ]
	throw 'no file or url'
}


function file_not_exist ( file ) {
	return new Promise((resolve,reject)=>{
		fs.access( file, fs.constants.F_OK, err=>{
			if(err) resolve( true )
			resolve( false )
		})
	})
}
function file_not_readable ( file ) {
	return new Promise((resolve,reject)=>{
		fs.access( file, fs.constants.R_OK, err=>{
			if(err) resolve( true )
			resolve( false )
		})
	})
}
function file_not_writable ( file ) {
	return new Promise((resolve,reject)=>{
		fs.access( file, fs.constants.W_OK, err=>{
			if(err) resolve( true )
			resolve( false )
		})
	})
}
function create_directory ( dir ) {
	return new Promise((resolve,reject)=>{
		exec('mkdir -p '+dir, e=>{
			if(e) resolve(false)
			resolve(true)
		})
	})
}

function getfileinfo_bigwig ( fileurl ) {
	return new Promise((resolve, reject)=>{
		const ps = spawn( bigWigInfo, [ '-chroms', fileurl ] )
		const out = [], out2 = []
		ps.stdout.on('data',i=> out.push(i) )
		ps.stderr.on('data',i=> out2.push(i) )
		ps.on('close',()=>{
			const err = out2.join('')
			if(err) resolve(false)
			resolve(out.join(''))
		})
	})
}

function ifnochr_bigwig ( text, genome ) {
	/*
	chromCount: 25
		1 0 249250621
		10 1 135534747
	*/
	const chrlst = []
	for(const line of text.split('\n')) {
		if(line[0] == '\t') chrlst.push( line.trim().split(' ')[0] )
	}
	if(chrlst.length==0) throw 'no chr names found'
	return contigNameNoChr( chrlst, genome )
}


function contigNameNoChr( chrlst, genome ) {
	// hardcoded for human genome
	for(const n in genome.majorchr) {
		if(chrlst.indexOf( n.replace('chr','')) != -1) return true
	}
	return false
}




async function validate_tabixfile ( file ) {
	/*
	file is full path, legal
	*/
	if( !file.endsWith( '.gz' )) return 'tabix file not ending with .gz'
	if( await file_not_exist(file)) return '.gz file not exist'
	if( await file_not_readable(file)) return '.gz file not readable'

	const tbi = file+'.tbi'
	if( await file_not_exist(tbi)) {
		const csi = file+'.csi'
		if(await file_not_exist(csi)) return 'neither .tbi .csi index file exist'
		if(await file_not_readable(csi)) return '.csi index file not readable'
	} else {
		// tbi exists
		if(await file_not_readable(tbi)) return '.tbi index file not readable'
	}
}

///////////////////////////////////////////////// END of helpers
