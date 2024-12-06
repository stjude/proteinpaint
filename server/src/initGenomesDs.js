import fs from 'fs'
import path from 'path'
import * as common from '#shared/common.js'
import * as utils from './utils.js'
import { checkDependenciesAndVersions } from './checkDependenciesAndVersions.js'
import { initLegacyDataset } from './initLegacyDataset'
import serverconfig from './serverconfig.js'
import { server_init_db_queries, listDbTables } from './termdb.server.init.ts'
import { server_updateAttr } from './dsUpdateAttr'
import { mds_init } from './mds.init.js'
import * as mds3_init from './mds3.init.js'
import { parse_textfilewithheader } from './parse_textfilewithheader.js'
import { clinsig } from '../dataset/clinvar.ts'

// Global variable (storing things in memory)
export const genomes = {} // { hg19: {...}, ... }

const features = serverconfig.features

export async function initGenomesDs(serverconfig) {
	// verify if tp directory is readable
	// ppr has this situation where its tp/ is from a nfs mount and can go down...
	try {
		await fs.promises.stat(serverconfig.tpmasterdir)
	} catch (e) {
		/* dir is inaccessible for some reason */
		const message = 'Error with ' + serverconfig.tpmasterdir + ': ' + e.code
		if (process.argv[2] == 'validate') {
			throw message
		} else {
			// allow the server process to boot
			// we want the node server to keep running so it can inform user with some meaningful msg rather than http error
			console.log('\n!!! ' + message + '\n')
			return
		}
	}

	checkDependenciesAndVersions(serverconfig)

	// date updated
	if (serverconfig.base_zindex != undefined) {
		const v = Number.parseInt(serverconfig.base_zindex)
		if (Number.isNaN(v) || v <= 0) throw 'base_zindex must be positive integer'
		serverconfig.base_zindex = v
	}
	if (serverconfig.jwt) {
		if (!serverconfig.jwt.secret) throw 'jwt.secret missing'
		if (!serverconfig.jwt.permissioncheck) throw 'jwt.permissioncheck missing'
	}
	if (!serverconfig.tpmasterdir) throw '.tpmasterdir missing'
	if (!serverconfig.cachedir) throw '.cachedir missing'

	// create sub directories under cachedir, and register path in serverconfig
	// to ensure temp files saved in previous server session are accessible in current session
	// must use consistent dir name but not random dir name that changes from last server boot
	serverconfig.cachedir_massSession = await mayCreateSubdirInCache('massSession')

	//DELETE THIS after process for deleting mass session files moved into production
	serverconfig.cachedir_massSessionTrash = await mayCreateSubdirInCache('massSessionTrash')

	serverconfig.cache_snpgt = {
		dir: await mayCreateSubdirInCache('snpgt'),
		fileNameRegexp: /[^\w]/, // client-provided cache file name matching with this are denied
		sampleColumn: 6 // in cache file, sample column starts from 7th column
	}
	serverconfig.cachedir_bam = await mayCreateSubdirInCache('bam')
	serverconfig.cachedir_genome = await mayCreateSubdirInCache('genome')
	serverconfig.cachedir_ssid = await mayCreateSubdirInCache('ssid')

	// NOTE: required or imported code files are only loaded once by Nodejs
	// and variables are static so that changes to common key-values will affect all
	// server-side code that import common.js
	if (serverconfig.commonOverrides) {
		common.applyOverrides(serverconfig.commonOverrides)
	}

	if (!serverconfig.genomes) throw '.genomes[] missing'
	if (!Array.isArray(serverconfig.genomes)) throw '.genomes[] not array'

	/*
	for genomes declared in serverconfig for this pp instance,
	load its built in genome javascript file to an in-mem object
	and apply overrides from serverconfig to modify this object
	keep the object in genomes{}
	*/
	for (const g of serverconfig.genomes) {
		if (!g.name) throw '.name missing from a genome: ' + JSON.stringify(g)
		if (!g.file) throw '.file missing from genome ' + g.name

		/*
			When using a Docker container, the mounted app directory
			may have an optional genome directory, which if present
			will be symlinked to the app directory and potentially override any
			similarly named genome js file that are part of the standard
			Proteinpaint packaged files[] 
		*/
		const overrideFile = path.join(process.cwd(), g.file)
		const genomeFile = fs.existsSync(overrideFile) ? overrideFile : path.join(serverconfig.binpath, g.file)

		/* g is the object from serverconfig.json, for instance-specific customizations of this genome
		g2 is the standard-issue obj loaded from the js file
		settings in g will modify g2
		g2 is registered in the global "genomes"
		*/
		const g2module = (await import(genomeFile)).default
		const g2 = g2module.default || g2module
		genomes[g.name] = g2

		if (!g2.genomefile) throw '.genomefile missing from .js file of genome ' + g.name
		if (g2.genomefile == 'NA') {
			// not available
		} else {
			g2.genomefile = path.join(serverconfig.tpmasterdir, g2.genomefile)
		}

		// for testing if gene/isoform/chr/snp names have only allowed characters
		// test to true if name has extra characters which could be attack strings
		// allow for genome-specific pattern setting, otherwise default is used
		if (!g2.genomicNameRegexp) g2.genomicNameRegexp = /[^a-zA-Z0-9.:_-]/

		if (!g2.tracks) {
			g2.tracks = [] // must always have .tracks even if empty
		}
		if (g.tracks) {
			// supplement
			for (const t of g.tracks) {
				g2.tracks.push(t)
			}
		}
		if (g.datasets) {
			g2.rawdslst = g.datasets
		}
		if (g.snp) {
			// replace snp db
			g2.snp = g.snp
		}
		if (g.blat) {
			if (!g.blat.host) throw '.blat.host missing for ' + g.name
			if (!g.blat.port) throw '.blat.port missing for ' + g.name
			// gfServer must start with full path to 2bit file
			g2.blat = g.blat // enable blat
		}
		if (g.nosnp) {
			// no snp
			delete g2.snp
		}
		if (g.nohicenzyme) {
			delete g2.hicenzymefragment
		}
		if (g.nohicdomain) {
			delete g2.hicdomain
		}
		if (g2.genedb) {
			if (g.no_gene2canonicalisoform) delete g2.genedb.gene2canonicalisoform
		}

		if (g.updateAttr) {
			for (const row of g.updateAttr) {
				let pointer = g2
				for (const [i, field] of row.entries()) {
					// to guard against invalid keys, could be manual errors or updated dataset spec
					if (!pointer) continue

					if (typeof field == 'object') {
						// apply the key-value overrides to the object that is pointed to
						for (const k in field) {
							pointer[k] = field[k]
						}
					} else {
						if (typeof pointer[field] == 'string') {
							//terminal
							if (row[i + 1]) {
								pointer[field] = row[i + 1]
							}
							break
						}

						// reset the reference to a subnested object
						pointer = pointer[field]
					}
				}
			}
		}
		if (g?.hideOnClient) {
			g2.hideOnClient = g.hideOnClient
		}
	}

	if (serverconfig.defaultgenome) {
		if (genomes[serverconfig.defaultgenome]) {
			genomes[serverconfig.defaultgenome].isdefault = true
		}
	}

	for (const genomename in genomes) {
		/*
		validate each genome
		*/
		const g = genomes[genomename]
		if (!g.majorchr) throw genomename + ': majorchr missing'
		if (!g.defaultcoord) throw genomename + ': defaultcoord missing'

		try {
			// test samtools and genomefile
			await utils.get_fasta(g, g.defaultcoord.chr + ':' + g.defaultcoord.start + '-' + (g.defaultcoord.start + 1))
		} catch (e) {
			// either samtools or fasta file failed
			throw `${genomename}: cannot get genome sequence: ${e.message || e}`
		}

		if (!g.tracks) {
			g.tracks = []
		}
		if (typeof g.majorchr == 'string') {
			const lst = g.majorchr.trim().split(/[\s\t\n]+/)
			const hash = {}
			const chrorder = []
			for (let i = 0; i < lst.length; i += 2) {
				const chr = lst[i]
				const c = Number.parseInt(lst[i + 1])
				if (Number.isNaN(c)) throw genomename + ' majorchr invalid chr size for ' + chr + ' (' + lst[i + 1] + ')'
				hash[chr] = c
				chrorder.push(chr)
			}
			g.majorchr = hash
			g.majorchrorder = chrorder
		}
		g.chrlookup = {}
		// k: uppercase chr, v: {name:str, len:int, major:bool}
		for (const n in g.majorchr) {
			g.chrlookup[n.toUpperCase()] = { name: n, len: g.majorchr[n], major: true }
		}
		if (g.minorchr) {
			if (typeof g.minorchr == 'string') {
				const lst = g.minorchr.trim().split(/[\s\t\n]+/)
				const hash = {}
				for (let i = 0; i < lst.length; i += 2) {
					const c = Number.parseInt(lst[i + 1])
					if (Number.isNaN(c)) throw genomename + ' minorchr invalid chr size for ' + lst[i] + ' (' + lst[i + 1] + ')'
					hash[lst[i]] = c
				}
				g.minorchr = hash
			}
			for (const n in g.minorchr) {
				g.chrlookup[n.toUpperCase()] = { name: n, len: g.minorchr[n] }
			}
		}

		// genedb is optional
		if (g.genedb) {
			if (!g.genedb.dbfile) throw genomename + ': .genedb.dbfile missing'
			// keep reference of the connection (.db) so as to add dataset-specific query statements later
			try {
				console.log('Connecting', g.genedb.dbfile)
				g.genedb.db = utils.connect_db(g.genedb.dbfile)
			} catch (e) {
				throw `Cannot connect genedb: ${g.genedb.dbfile}: ${e}`
			}
			g.genedb.getnamebynameorisoform = g.genedb.db.prepare('select name from genes where name=? or isoform=?')
			g.genedb.getnamebyisoform = g.genedb.db.prepare('select distinct name from genes where isoform=?')
			g.genedb.getjsonbyname = g.genedb.db.prepare('select isdefault,genemodel from genes where name=?')
			g.genedb.getjsonbyisoform = g.genedb.db.prepare('select isdefault,genemodel from genes where isoform=?')
			g.genedb.getnameslike = g.genedb.db.prepare('select distinct name from genes where name like ? limit 20')

			/*
			optional tables in gene db:

			- genealias
			- gene2coord
			- ideogram
			- gene2canonicalisoform
			- refseq2ensembl
			- buildDate

			if present, create getter to this table and attach to g.genedb{}
			*/
			const tables = listDbTables(g.genedb.db)
			if (tables.has('genealias')) {
				g.genedb.getNameByAlias = g.genedb.db.prepare('select name from genealias where alias=?')
				// quick fix -- convert symbol to ENSG, to be used for gdc api query
				g.genedb.getAliasByName = g.genedb.db.prepare('select alias from genealias where name=?')
			}
			if (tables.has('gene2coord')) {
				g.genedb.getCoordByGene = g.genedb.db.prepare('select * from gene2coord where name=?')
			}
			if (tables.has('ideogram')) {
				g.genedb.hasIdeogram = true
				g.genedb.getIdeogramByChr = g.genedb.db.prepare('select * from ideogram where chromosome=?')
			} else {
				g.genedb.hasIdeogram = false
			}
			if (tables.has('gene2canonicalisoform')) {
				g.genedb.get_gene2canonicalisoform = g.genedb.db.prepare(
					'select isoform from gene2canonicalisoform where gene=?'
				)
			}
			if (tables.has('buildDate')) {
				g.genedb.get_buildDate = g.genedb.db.prepare('select date from buildDate')
			}

			// this table is only used for gdc dataset
			g.genedb.hasTable_refseq2ensembl = tables.has('refseq2ensembl')

			g.genedb.sqlTables = [...tables]
			g.genedb.tableSize = {}
			for (const table of tables) {
				if (table == 'buildDate') continue
				g.genedb.tableSize[table] = g.genedb.db.prepare(`select count(*) as size from ${table}`).get().size
			}
		}

		// termdbs{} is optional
		if (g.termdbs) {
			for (const key in g.termdbs) {
				server_init_db_queries(g.termdbs[key], features)
				console.log(`${key} initiated as ${genomename}-level termdb`)
			}
		}

		for (const tk of g.tracks) {
			if (!tk.__isgene) continue
			if (!tk.file) throw 'Tabix file missing for gene track: ' + JSON.stringify(tk)
			try {
				await utils.validate_tabixfile(path.join(serverconfig.tpmasterdir, tk.file))
			} catch (e) {
				throw 'Error with ' + tk.file + ': ' + e
			}
		}

		if (g.proteindomain) {
			if (!g.proteindomain.dbfile) throw genomename + '.proteindomain: missing dbfile for sqlite db'
			if (!g.proteindomain.statement) throw genomename + '.proteindomain: missing statement for sqlite db'
			let db
			try {
				console.log('Connecting', g.proteindomain.dbfile)
				db = utils.connect_db(g.proteindomain.dbfile)
			} catch (e) {
				throw 'Error with ' + g.proteindomain.dbfile + ': ' + e
			}
			g.proteindomain.getbyisoform = db.prepare(g.proteindomain.statement)
		}

		if (g.snp) {
			if (!g.snp.bigbedfile) throw genomename + '.snp: missing bigBed file'
			g.snp.bigbedfile = path.join(serverconfig.tpmasterdir, g.snp.bigbedfile)
			await utils.file_is_readable(g.snp.bigbedfile)
		}

		if (g.fimo_motif) {
			if (!g.fimo_motif.db) throw genomename + '.fimo_motif: db file missing'
			g.fimo_motif.db = path.join(serverconfig.tpmasterdir, g.fimo_motif.db)
			if (g.fimo_motif.annotationfile) {
				const [err, items] = parse_textfilewithheader(
					fs.readFileSync(path.join(serverconfig.tpmasterdir, g.fimo_motif.annotationfile), { encoding: 'utf8' }).trim()
				)
				g.fimo_motif.tf2attr = {}
				for (const i of items) {
					g.fimo_motif.tf2attr[i.Model.split('_')[0]] = i
				}
			}
		}

		if (g.hicenzymefragment) {
			if (!Array.isArray(g.hicenzymefragment)) throw 'hicenzymefragment should be an array'
			for (const frag of g.hicenzymefragment) {
				if (!frag.enzyme) throw '.enzyme missing for one element of hicenzymefragment[]'
				if (!frag.file) throw '.file missing for one element of hicenzymefragment[]'
				try {
					await utils.validate_tabixfile(path.join(serverconfig.tpmasterdir, frag.file))
				} catch (e) {
					throw 'Error with ' + frag.file + ': ' + e
				}
			}
		}

		if (g.hicdomain) {
			if (!g.hicdomain.groups) throw '.groups{} missing from hicdomain'
			for (const groupname in g.hicdomain.groups) {
				const grp = g.hicdomain.groups[groupname]
				if (!grp.name) throw '.name missing from hicdomain ' + groupname
				if (!grp.sets) throw '.set{} missing from hicdomain ' + groupname
				for (const setname in grp.sets) {
					const hs = grp.sets[setname]
					if (!hs.name) throw '.name missing from hicdomain ' + groupname + ' > ' + setname
					if (!hs.file) throw '.file missing from hicdomain ' + groupname + ' > ' + setname
					hs.file = path.join(serverconfig.tpmasterdir, hs.file) // replace with full path, keep on server side
					try {
						await utils.validate_tabixfile(hs.file)
					} catch (e) {
						throw 'Error with ' + hs.file + ': ' + e
					}
				}
			}
		}

		if (!g.rawdslst) {
			// allow to have no ds
			continue
		}
		/*
	done everything except dataset
	*/

		g.datasets = {}
		for (const d of g.rawdslst) {
			/*
		for each raw dataset
		*/
			if (d.skip) continue
			if (!d.name) throw 'a nameless dataset from ' + genomename
			if (g.datasets[d.name]) throw genomename + ' has duplicating dataset name: ' + d.name
			if (!d.jsfile) throw 'jsfile not available for dataset ' + d.name + ' of ' + genomename

			/*
				When using a Docker container, the mounted app directory
				may have an optional dataset directory, which if present
				will be symlinked to the app directory and potentially override any
				similarly named dataset js file that are part of the standard
				Proteinpaint packaged files[] 
			*/
			const overrideFile = path.join(process.cwd(), d.jsfile)
			const dsFile = fs.existsSync(overrideFile) ? overrideFile : path.join(serverconfig.binpath, d.jsfile)
			const _ds = (await import(dsFile)).default
			const ds =
				typeof _ds == 'function'
					? await _ds(common, { serverconfig, clinsig })
					: typeof _ds?.default == 'function'
					? await _ds.default(common, { serverconfig, clinsig })
					: _ds.default || _ds

			// !!! TODO: is this unnecessarily repeated at a later time? !!!
			server_updateAttr(ds, d)
			ds.noHandleOnClient = d.noHandleOnClient
			ds.label = d.name
			ds.genomename = genomename
			g.datasets[ds.label] = ds

			if (ds.isMds3) {
				// TODO: not awaiting will be the default in next round of refactor;
				// use strict equals of boolean value to not misinterpret undefined
				if (d.awaitOnMds3Init === false) {
					// do not await to support the option to not block other datasets from loading
					mds3_init.init(ds, g, d).catch(e => {
						if (ds.__gdc?.recoverableError) {
							console.log(`recoverableError ignored:`, ds.__gdc.recoverableError)
							return // ignore because error is recoverable
						}
						throw 'Error with mds3 dataset ' + ds.label + ': ' + e
					})
				} else {
					try {
						await mds3_init.init(ds, g, d)
					} catch (e) {
						console.trace(e)
						throw 'Error with mds3 dataset ' + ds.label + ': ' + e
					}
				}
				continue
			}
			if (ds.isMds) {
				try {
					await mds_init(ds, g, d)
				} catch (e) {
					console.trace(e)
					throw 'Error with mds dataset ' + ds.label + ': ' + e
				}
				continue
			}

			initLegacyDataset(ds, g, serverconfig)
		}

		deleteSessionFiles()

		delete g.rawdslst
	}
}

async function mayCreateSubdirInCache(subdir) {
	const dir = path.join(serverconfig.cachedir, subdir)
	try {
		await fs.promises.stat(dir)
	} catch (e) {
		if (e.code == 'ENOENT') {
			try {
				await fs.promises.mkdir(dir)
			} catch (e) {
				throw 'cannot make dir'
			}
		} else {
			throw 'error stating dir'
		}
	}
	return dir
}

async function deleteSessionFiles() {
	//Delete mass session files older than the massSessionDuration in serverconfig or 30 days default
	const files = await fs.promises.readdir(serverconfig.cachedir_massSession)
	try {
		files.forEach(async file => {
			//Return creation Time
			const stats = await fs.promises.stat(path.join(serverconfig.cachedir_massSession, file))
			const sessionCreationDate = stats.birthtime

			//Determine file age against massSessionDuration
			const today = new Date()
			const fileDate = new Date(sessionCreationDate)
			const massSessionDuration = serverconfig.features.massSessionDuration || 30
			const sessionDaysElapsed = Math.round((today.getTime() - fileDate.getTime()) / (1000 * 3600 * 24))
			if (sessionDaysElapsed > massSessionDuration) {
				// Move file to massSessionTrash
				// Process in place until users get use to it
				await fs.promises.copyFile(
					path.join(serverconfig.cachedir_massSession, file),
					path.join(serverconfig.cachedir_massSessionTrash, file)
				)
				// Delete file out of massSession
				await fs.promises.unlink(path.join(serverconfig.cachedir_massSession, file))

				console.log('File deleted: ', file, sessionCreationDate)
			}
		})
	} catch (e) {
		throw `Error: ${e}`
	}
}
