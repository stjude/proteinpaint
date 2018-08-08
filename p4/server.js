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
	coord = require('./src/coord'),
	common = require('./src/common')






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
	server_launch()
})
.catch(err=>{
	console.error(err)
})




///////////////////////////////// validate server config


async function server_validate_config() {


	const cfg = serverconfig

	if(!cfg.filedir) throw '.filedir missing'
	if(!cfg.cachedir) throw '.cachedir missing'

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
		if( await access_file_readable( g.genomefile        ) ) throw 'cannot read file '+g.genomefile
		if( await access_file_readable( g.genomefile+'.fai' ) ) throw '.fai index missing for '+g.genomefile
		if( await access_file_readable( g.genomefile+'.gzi' ) ) throw '.gzi index missing for '+g.genomefile

		// genedb is required
		try {
			validate_genedb( g.genedb )
		} catch(e) {
			throw genomename+'.genedb: '+e
		}

		if(g.proteindomain) {
			if(!g.proteindomain.dbfile) throw '.proteindomain.dbfile missing for '+genomename
			if(!g.proteindomain.statement) throw '.proteindomain.statement missing for '+genomename
			let db
			try {
				db = bettersqlite( path.join(serverconfig.filedir, g.proteindomain.dbfile), {readonly:true, fileMustExist:true} )
			} catch(e) {
				throw 'cannot read proteindomain.dbfile: '+g.proteindomain.dbfile
			}
			g.proteindomain.get = db.prepare( g.proteindomain.statement )
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


function validate_genedb ( g ) {
	// genome.genedb
	if(!g) throw '.genedb missing'
	if(!g.dbfile) throw '.dbfile missing'
	//if(!g.statement_getnamebyname) throw '.statement_getnamebyname missing'
	if(!g.statement_getnamebyisoform) throw '.statement_getnamebyisoform missing'
	if(!g.statement_getnamebynameorisoform) throw '.statement_getnamebynameorisoform missing'
	if(!g.statement_getjsonbyname) throw '.statement_getjsonbyname missing'
	if(!g.statement_getjsonbyisoform) throw '.statement_getjsonbyisoform missing'
	if(!g.statement_getnameslike) throw '.statement_getnameslike missing'
	let db
	try {
		db = bettersqlite( path.join(serverconfig.filedir, g.dbfile), {readonly:true, fileMustExist:true} )
	} catch(e) {
		throw 'cannot read dbfile: '+g.dbfile
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
		if(!snp.db.statement) throw '.db.statement missing for '+snp.name

		let db
		try {
			db = bettersqlite( path.join(serverconfig.filedir, snp.db.dbfile), {readonly:true, fileMustExist:true} )
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




async function handle_ntseq( req, res ) {
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

async function validate_tabixfile ( halfpath ) {
	if( illegalpath( halfpath )) return 'illegal file path'
	if( !halfpath.endsWith( '.gz' )) return 'tabix file not ending with .gz'

	const e1 = await access_file_readable( halfpath, true )
	if(e1) return e1

	const e2 = await access_file_readable( halfpath+'.tbi', true )
	if(e2) return e2
}

function access_file_readable ( str, ishalf ) {
	// if file is readable
	const file = ishalf ? path.join( serverconfig.filedir, str ) : str
	return new Promise((resolve,reject)=>{
		fs.access( file, fs.constants.R_OK, err=>{
			if(err) resolve('cannot read file: ' + str )
			resolve()
		})
	})
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

///////////////////////////////////////////////// END of helpers
