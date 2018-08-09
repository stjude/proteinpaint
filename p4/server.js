const fs = require('fs'),
	url = require('url')
	path = require('path'),
	spawn = require('child_process').spawn,
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
			/*
				if(!tk.__isgene) continue
				if(!tk.file) return 'Tabix file missing for gene track: '+JSON.stringify(tk)
				const [err, file] =validate_tabixfile(tk.file)
				if(err) return tk.file+': gene tabix file error: '+err
				*/
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
		const err = await validate_tabixfile( snp.tk.file )
		if(err) throw 'tk.file error for '+snp.name+': '+err
	}
}


///////////////////////////////// END of validate server config








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

	// routes
	app.get('/genomes', handle_genomes)
	app.post('/genelookup', handle_genelookup)
	app.post('/snpbyname', handle_snpbyname)
	app.post('/ntseq', handle_ntseq)
	app.post('/bigwig', handle_bigwig)

	const port = serverconfig.port || 3000
	app.listen(port)
	console.log('STANDBY at port',port)
}




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

		await validate_bigwig( file, url )

		const result = {
			view2img: {}
		}

		for(const view of q.views) {
			if( common.isBadArray( view.regions )) throw 'view.regions[] should be array'
			result.view2img[ view.id ] = { }
			// .src, .width
			for(const region of view.regions) {
				region.values = await handle_bigwig_queryfile(
					file,
					url,
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
		const width = view.regions.reduce((i,j)=>i+j.width, 0 ) + (view.regions.length-1) * view.regionspace
		result.view2img[ view.id ].width = width
		const canvas = new Canvas( width, q.barheight )
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


function handle_bigwig_queryfile ( file, url, region, dotplotfactor, dividefactor ) {
	return new Promise((resolve,reject)=>{
		const ps = spawn( bigWigSummary, [
			'-udcDir='+serverconfig.cachedir,
			file || url,
			region.chr, region.start, region.stop,
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



async function validate_bigwig ( file, url ) {
	if( file ) {
		if( await file_not_exist( file ) ) throw 'file not found'
		if( await file_not_readable( file ) ) throw 'file not readable'
	}
	if( await file_not_bigwig( file || url ) ) throw 'not a bigWig file'
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

function file_not_bigwig ( fileurl ) {
	return new Promise((resolve, reject)=>{
		const ps = spawn( bigWigInfo, [ fileurl ] )
		const out = [], out2 = []
		ps.stdout.on('data',i=> out.push(i) )
		ps.stderr.on('data',i=> out2.push(i) )
		ps.on('close',()=>{
			const err = out2.join('')
			if(err) resolve(true)
			resolve(false)
		})
	})
}

async function validate_tabixfile ( halfpath ) {
	if( illegalpath( halfpath )) return 'illegal file path'
	if( !halfpath.endsWith( '.gz' )) return 'tabix file not ending with .gz'
	const file = path.join( serverconfig.filedir, halfpath )
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
