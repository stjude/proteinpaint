
const fs = require('fs'),
	url = require('url')
	path = require('path'),
	readline = require('readline'),
	express = require('express'),
	http = require('http'),
	https = require('https'),
	compression = require('compression'),
	bettersqlite = require('better-sqlite3'),
	Canvas = require('canvas'),
	bodyParser = require('body-parser'),
	jsonwebtoken = require('jsonwebtoken'),
	coord = require('./src/coord')






const serverconfigfile = './config.json'

const serverconfig = require( serverconfigfile )


/////////////// globals
const genomes={}
const tabix= serverconfig.tabix || 'tabix'
const samtools= serverconfig.samtools || 'samtools'
const bigwigsummary= serverconfig.bigwigsummary || 'bigWigSummary'
const hicstat = serverconfig.hicstat || 'python read_hic_header.py'
const hicstraw = serverconfig.hicstraw || 'straw'




// launch
server_validate_config()
.then(()=>{
	return server_launch()
})
.catch(err=>{
	console.error(err)
})




///////////////////////////////// validate server config


function server_validate_config() {

return Promise.resolve()
.then(()=>{

	const cfg = serverconfig

	if(!cfg.filedir) throw '.filedir missing'
	if(!cfg.cachedir) throw '.cachedir missing'

	if(cfg.jwt) {
		if(!cfg.jwt.secret) throw 'jwt.secret missing'
		if(!cfg.jwt.permissioncheck) throw 'jwt.permissioncheck missing'
	}

	if(!cfg.genomes) throw '.genomes[] missing'
	if(isBadArray(cfg.genomes)) throw '.genomes[] should be non-empty array'

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
				hash[chr]= Number.parseInt(lst[i+1])
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
					hash[lst[i]] = Number.parseInt(lst[i+1])
				}
				g.minorchr=hash
			}
		}
		for(const k in g.majorchr) {
			if(!Number.isInteger(g.majorchr[k])) throw 'invalid chr size for majorchr '+k+' of '+genomename
		}
		for(const k in g.minorchr) {
			if(!Number.isInteger(g.minorchr[k])) throw 'invalid chr size for minorchr '+k+' of '+genomename
		}

		if(!g.defaultcoord) throw '.defaultcoord missing for '+genomename
		if(!g.majorchr[ g.defaultcoord.chr ]) throw 'no length for defaultcoord.chr '+g.defaultcoord.chr
		if(!Number.isInteger(g.defaultcoord.start)) throw 'invalid value for defaultcoord.start'
		if(!Number.isInteger(g.defaultcoord.stop)) throw 'invalid value for defaultcoord.stop'


		if(!g.genomefile) throw 'genomefile missing for '+genomename
		g.genomefile = path.join( serverconfig.filedir, g.genomefile )
		try {
			fs.statSync( g.genomefile )
		} catch(e) {
			throw e.message
		}

		if(!g.genedb) throw '.genedb missing for '+genomename
		if(!g.genedb.dbfile) throw '.genedb.dbfile missing for '+genomename
		if(!g.genedb.statement_getnamebyname) throw '.genedb.statement_getnamebyname missing for '+genomename
		if(!g.genedb.statement_getnamebyalias) throw '.genedb.statement_getnamebyalias missing for '+genomename
		if(!g.genedb.statement_getjsonbyname) throw '.genedb.statement_getjsonbyname missing for '+genomename
		if(!g.genedb.statement_getnameslike) throw '.genedb.statement_getnameslike missing for '+genomename
		{
			const db = bettersqlite( path.join(serverconfig.filedir, g.genedb.dbfile), {readonly:true, fileMustExist:true} )
			g.genedb.getnamebyname = db.prepare(g.genedb.statement_getnamebyname)
			g.genedb.getnamebyalias = db.prepare( g.genedb.statement_getnamebyalias )
			g.genedb.getjsonbyname = db.prepare( g.genedb.statement_getjsonbyname)
			g.genedb.getnameslike = db.prepare( g.genedb.statement_getnameslike )
		}



		if(g.proteindomain) {
			if(!g.proteindomain.dbfile) throw '.proteindomain.dbfile missing for '+genomename
			if(!g.proteindomain.statement) throw '.proteindomain.statement missing for '+genomename
			const db = bettersqlite( path.join(serverconfig.filedir, g.proteindomain.dbfile), {readonly:true, fileMustExist:true} )
			g.proteindomain.get = db.prepare( g.proteindomain.statement )
		}


		if(g.snp) {
			/*
			snp must have both sqlite db and bedj track
			*/
			if(!g.snp.db) throw '.snp.db{} missing for '+genomename
			if(!g.snp.db.dbfile) throw '.snp.db.dbfile missing for '+genomename
			if(!g.snp.db.statement) throw '.snp.db.statement missing for '+genomename
			const db = bettersqlite( path.join(serverconfig.filedir, g.snp.db.dbfile), {readonly:true, fileMustExist:true} )
			g.snp.db.get = db.prepare( g.snp.db.statement )

			if(!g.snp.tk) throw '.snp.tk{} is required for range-based query for '+genomename
			if(!g.snp.tk.file) throw '.snp.tk.file missing for '+genomename
			const err = validate_tabixfile( g.snp.tk.file )
			if(err) throw genomename+'.snp.tk.file error: '+err
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

	return Promise.all(tasks)
})
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
	app.get('/genomes',handle_genomes)
	app.post('/genelookup',handle_genelookup)

	const port = serverconfig.port || 3000
	app.listen(port)
	console.log('STANDBY at port',port)
}




////////////////////////////////////////////////// sec


function handle_genomes(req,res) {
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
		/*
		for(const dsname in g.datasets) {
			const ds=g.datasets[dsname]

			if(ds.isMds) {
				const _ds = mds_clientcopy( ds )
				if(_ds) {
					g2.datasets[ds.label] = _ds
				}
				continue
			}
		}
		*/

		/*
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
		*/
		hash[genomename]=g2
	}

	const date1=fs.statSync('server.js').mtime
	const date2=fs.statSync('public/bin/proteinpaint.js').mtime
	const lastupdate=date1<date2 ? date1 : date2
	res.send({
		genomes:hash,
		debugmode: serverconfig.debugmode,
		headermessage: serverconfig.headermessage,
		base_zindex: serverconfig.base_zindex,
		lastupdate:lastupdate.toDateString()
	})
}



function handle_genelookup(req,res) {
Promise.resolve().then(()=>{
	const q = JSON.parse(req.body)
	log(req,q)
	if(!q.input) throw 'no input'
	const genome = genomes[q.genome]

	if(q.deep) {
	}

	return Promise.resolve().then(()=>{
		let names = genome.genedb.getnameslike.all( q.input+'%' )
		if(names.length) return { names: (names.length>20 ? names.slice(0,20) : names) }
		names = genome.genedb.getnamebyalias.all( q.input )
		return {names:names}
	})
	.then(result=>{
		res.send(result)
	})
})
.catch(e=>{
	res.send({error: (typeof(e)=='string' ? e : e.message ) })
	if(e.stack) console.error(e.stack)
})
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

function isBadArray (i) {
	if(!Array.isArray(i)) return true
	if(i.length==0) return
}


function illegalpath ( s ) {
	if(s[0]=='/') return true
	if(s.indexOf('..')!=-1) return true
	return false
}

async function validate_tabixfile ( halfpath ) {
	if( illegalpath( halfpath )) return 'illegal file path'
	if( !halfpath.endsWith( '.gz' )) return 'tabix file not ending with .gz'

	const e1 = await access_file( halfpath )
	if(e1) return e1

	const e2 = await access_file( halfpath+'.tbi' )
	if(e2) return e2
}

function access_file ( halfpath ) {
	const file = path.join( serverconfig.tpmasterdir, halfpath )
	// full path to file
	return new Promise((resolve,reject)=>{
		fs.access( file, fs.constants.R_OK, err=>{
			if(err) resolve('cannot read file: ' + halfpath )
			resolve()
		})
	})
}

///////////////////////////////////////////////// END of helpers
