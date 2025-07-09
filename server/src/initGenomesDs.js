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

	await checkDependenciesAndVersions(serverconfig)

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
		g2.label = g.name

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

	// will be used to track dataset loading status
	const trackedDatasets = []

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
				if (g.termdbs[key].cohort?.termdb?.isGeneSetTermdb != true)
					throw 'genome-level geneset db lacks flag of cohort.termdb.isGeneSetTermdb=true' // this flag is part of termdbconfig and used by tree app
				server_init_db_queries(g.termdbs[key])
				if (!Array.isArray(g.termdbs[key].analysisGenesetGroups)) throw '.analysisGenesetGroups[] not array'
				if (g.termdbs[key].analysisGenesetGroups.length == 0) throw '.analysisGenesetGroups[] blank'
				for (const a of g.termdbs[key].analysisGenesetGroups) {
					if (!a.label || !a.value) throw 'label/value property missing from one of analysisGenesetGroups[]'
				}
				if (!g.termdbs[key].geneORAparam) throw '.geneORAparam missing'
				console.log(`${key} initiated as ${genomename}-level geneset db`)
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

		// option to limit the datasets that are loaded, useful for faster ds-specific test iteration
		const dslabelFilter = serverconfig.features.dslabelFilter

		g.datasets = {}
		for (const d of g.rawdslst) {
			/*
			for each raw dataset
			*/
			if (d.skip) continue
			if (!d.name) throw 'a nameless dataset from ' + genomename
			if (dslabelFilter && !dslabelFilter?.includes(d.name)) continue
			if (g.datasets[d.name]) throw genomename + ' has duplicate dataset name: ' + d.name
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

			server_updateAttr(ds, d)
			ds.noHandleOnClient = d.noHandleOnClient
			ds.label = d.name
			ds.genomename = genomename
			ds.genomeObj = g // this makes genome obj readily accessible to functions that already accepts ds obj as argument, avoid retrofit to add in additional genome obj argument
			g.datasets[ds.label] = ds

			// populate possibly missing ds.init option values
			// retryMax or retryDelay override may be specified without the other
			ds.init = {
				...{ retryMax: 0, retryDelay: 1000 * 60 * 5 }, // default, 0 retry, every 5 minutes
				...(ds.init || {}), // overrides from dataset js file
				...(d.init || {}) // overrides from raw dataset entry in serverconfig, highest priority
			}

			trackedDatasets.push(ds)

			// wrap ds init execution in a try-catch, to not crash when at least 1 dataset loaded successfully
			try {
				ds.init.status = 'started'
				// initial attempt is awaited, so that the server startup logs/CI can summarize status
				if (ds.isMds3) await mds3_init.init(ds, g)
				else if (ds.isMds) await mds_init(ds, g, d)
				else initLegacyDataset(ds, g, serverconfig)
				// no error bubbled up to be caught, and there are no nonblocking step being performed, init is done
				if (ds.init.status != 'nonblocking') ds.init.status = 'done'
			} catch (e) {
				mayRetryInit(g, ds, d, e)
			}
		}
		delete g.rawdslst
	}
	return trackedDatasets
}

function mayRetryInit(g, ds, d, e) {
	// if initial attempt fails, can stop or retry
	const gdlabel = `${g.label}/${ds.label}`
	console.log(`Init error with ${gdlabel}`)

	if (serverconfig.features.mustExitPendingValidation) {
		/* 
			start special handling of datasets with recoverable error and active retries
			!!! during server validation only !!!
		*/
		if (ds.init?.recoverableError) {
			console.log(ds.init)
			return // do not throw; must not block validation of other datasets and continuing to server startup
		}
		if (e?.status == 'recoverableError') {
			console.log(e)
			return // do not throw; must not block validation of other datasets and continuing to server startup
		}
		/* end special handling */

		const msg = ds.init?.fatalError || e?.error || e
		// optional slack notification will be handled in app.ts
		throw msg
	}

	if (e) console.trace(e)

	if (!ds.init.recoverableError && !utils.nonFatalStatus.has(ds.init.status) && !utils.nonFatalStatus.has(e.status)) {
		// forget datasets that did not load or cannot be loaded with retries
		delete g.datasets[ds.label]
	}

	if (ds.init.fatalError) {
		// will not be able to recover even with retries
		ds.init.status = `fatalError`
		if (!ds.init.error) ds.init.error = JSON.stringify(e)
		return
	}
	if (!ds.init.retryMax) {
		// default ds.init.retryMax is 0, assumes that
		// most dataset init errors are not recoverable, unless overriden
		ds.init.status = `zeroRetries`
		if (!ds.init.error) ds.init.error = JSON.stringify(e)
		return
	}
	console.log(`${gdlabel} recoverableError:`, ds.init.recoverableError)
	ds.init.status = `recoverableError` // needed by app processTrackedDs() to summarize init status
	delete ds.init.recoverableError // info only, should not be present at the beginning of retries

	// This loop is NOT awaited on, so that it doesn't block subsequent datasets from loading
	let currentRetry = 0
	const interval = setInterval(async () => {
		currentRetry++
		ds.init.currentRetry = currentRetry
		try {
			console.log(`Retrying ${gdlabel} init(), attempt #${currentRetry} ...`)
			if (ds.isMds3) await mds3_init.init(ds, g)
			else if (ds.isMds) await mds_init(ds, g, d)
			else initLegacyDataset(ds, g, serverconfig)
			// as long as no error bubbles up to here, the retry is considered successful
			clearInterval(interval)
			if (ds.init.status != 'nonblocking') ds.init.status = 'done'
		} catch (e) {
			if (ds.init.status != 'recoverableError' && !ds.init.recoverableError && !utils.isRecoverableError(e)) {
				const msg = `Fatal error on ${gdlabel} retry, stopping retry`
				console.log(msg)
				clearInterval(interval) // cancel since retrying will not change the outcome
				ds.init.status = 'fatalError'
				if (serverconfig.slackWebhookUrl) {
					sendMessageToSlack(
						serverconfig.slackWebhookUrl,
						`\n${serverconfig.URL}: ${msg}`,
						path.join(serverconfig.cachedir, '/slack/last_message_hash.txt')
					)
				}
			} else {
				console.warn(`${gdlabel} init() failed. Retrying... (${ds.init.retryMax - currentRetry} attempts left)`)
				if (currentRetry >= ds.init.retryMax) {
					clearInterval(interval) // cancel retries
					const msg = `Max retry attempts for ${gdlabel} reached. Failing with error:`
					console.error(msg)
					if (ds.init.errorCallback) ds.init.errorCallback(response)
					else {
						// allow to fail silently to not affect other loaded datasets
						console.log(e)
					}
					if (serverconfig.slackWebhookUrl) {
						sendMessageToSlack(
							serverconfig.slackWebhookUrl,
							`\n${serverconfig.URL}: ${msg}`,
							path.join(serverconfig.cachedir, '/slack/last_message_hash.txt')
						)
					}
				}

				ds.init.status = `recoverableError`
				delete ds.init.recoverableError // should not be present at the beginning of retries
			}
		}
	}, ds.init.retryDelay)
}
