import * as common from '#shared/common.js'
import * as utils from './utils.js'
import * as vcf from '#shared/vcf.js'
import child_process from 'child_process'
import serverconfig from './serverconfig.js'
import path from 'path'

export function initLegacyDataset(ds, genome, serverconfig) {
	/* old official dataset */
	if (ds.dbfile) {
		/* this dataset has a db */
		try {
			console.log('Connecting', ds.dbfile)
			ds.newconn = utils.connect_db(ds.dbfile)
		} catch (e) {
			throw 'Error with ' + ds.dbfile + ': ' + e
		}
	}

	if (ds.snvindel_attributes) {
		for (const at of ds.snvindel_attributes) {
			if (at.lst) {
				for (const a2 of at.lst) {
					a2.get = getFunctionConstructorArgs(a2.get)
				}
			} else {
				at.get = getFunctionConstructorArgs(at.get)
			}
		}
	}

	if (ds.cohort) {
		// a dataset with cohort

		if (ds.cohort.levels) {
			if (!Array.isArray(ds.cohort.levels)) throw 'cohort.levels must be array for ' + ds.genomename + '.' + ds.label
			if (ds.cohort.levels.length == 0) throw 'levels is blank array for cohort of ' + ds.genomename + '.' + ds.label
			for (const i of ds.cohort.levels) {
				if (!i.k) throw '.k key missing in one of the levels, .cohort, in ' + ds.genomename + '.' + ds.label
			}
		}

		if (ds.cohort.fromdb) {
			/*
		cohort content to be loaded lazily from db
		*/
			if (!ds.cohort.fromdb.sql) throw '.sql missing from ds.cohort.fromdb in ' + ds.genomename + '.' + ds.label
			const rows = ds.newconn.prepare(ds.cohort.fromdb.sql).all()
			delete ds.cohort.fromdb
			ds.cohort.raw = rows ///// backward compatible
			console.log(rows.length + ' rows retrieved for ' + ds.label + ' sample annotation')
		}

		if (ds.cohort.files) {
			// sample annotation load directly from text files, in sync
			let rows = []
			for (const file of ds.cohort.files) {
				if (!file.file) throw '.file missing from one of cohort.files[] for ' + ds.genomename + '.' + ds.label
				const txt = fs.readFileSync(path.join(serverconfig.tpmasterdir, file.file), 'utf8').trim()
				if (!txt) throw file.file + ' is empty for ' + ds.genomename + '.' + ds.label
				rows = [...rows, ...d3dsv.tsvParse(txt)]
			}
			delete ds.cohort.files
			if (ds.cohort.raw) {
				ds.cohort.raw = [...ds.cohort.raw, ...rows]
			} else {
				ds.cohort.raw = rows
			}
			console.log(rows.length + ' rows retrieved for ' + ds.label + ' sample annotation')
		}
		if (ds.cohort.tosampleannotation) {
			// a directive to tell client to convert cohort.raw[] to cohort.annotation{}, key-value hash
			if (!ds.cohort.tosampleannotation.samplekey)
				throw '.samplekey missing from .cohort.tosampleannotation for ' + ds.genomename + '.' + ds.label
			if (!ds.cohort.key4annotation)
				throw (
					'.cohort.key4annotation missing when .cohort.tosampleannotation is on for ' + ds.genomename + '.' + ds.label
				)
			// in fact, it still requires ds.cohort.raw, but since db querying is async, not checked
		}
	}

	if (!ds.queries) throw '.queries missing from dataset ' + ds.label + ', ' + ds.genomename
	if (!Array.isArray(ds.queries)) throw ds.label + '.queries is not array'
	for (const q of ds.queries) {
		const err = legacyds_init_one_query(q, ds, genome)
		if (err) throw 'Error parsing a query in "' + ds.label + '": ' + err
	}

	if (ds.vcfinfofilter) {
		const err = common.validate_vcfinfofilter(ds.vcfinfofilter)
		if (err) throw ds.label + ': vcfinfofilter error: ' + err
	}

	if (ds.url4variant) {
		for (const u of ds.url4variant) {
			if (!u.makelabel) throw 'makelabel() missing for one item of url4variant from ' + ds.label
			if (!u.makeurl) throw 'makeurl() missing for one item of url4variant from ' + ds.label
			u.makelabel = getFunctionConstructorArgs(u.makelabel)
			u.makeurl = getFunctionConstructorArgs(u.makeurl)
		}
	}
}

function legacyds_init_one_query(q, ds, genome) {
	/* parse a query from legacy ds.queries[]
	 */
	if (!q.name) return '.name missing'

	if (q.dsblocktracklst) {
		/*
        not sure if still in use!

        one or more block track available from this query
        quick-fix for cohort junction, replace-by-mds
        */
		if (!Array.isArray(q.dsblocktracklst)) return 'dsblocktracklst not an array in ' + ds.label
		for (const tk of q.dsblocktracklst) {
			if (!tk.type) return 'missing type for a blocktrack of ' + ds.label
			if (!tk.file && !tk.url) return 'neither file or url given for a blocktrack of ' + ds.label
		}
		return
	}

	if (q.vcffile) {
		// single vcf
		const meta = child_process
			.execSync(serverconfig.tabix + ' -H ' + path.join(serverconfig.tpmasterdir, q.vcffile), { encoding: 'utf8' })
			.trim()
		if (meta == '') return 'no meta lines in VCF file ' + q.vcffile + ' of query ' + q.name
		const [info, format, samples, errs] = vcf.vcfparsemeta(meta.split('\n'))
		if (errs) return 'error parsing VCF meta lines of ' + q.vcffile + ': ' + errs.join('; ')
		q.vcf = {
			vcfid: Math.random().toString(),
			info: info,
			format: format,
			samples: samples
		}
		if (q.hlinfo) {
			q.vcf.hlinfo = q.hlinfo
			delete q.hlinfo
		}
		if (q.infopipejoin) {
			q.vcf.infopipejoin = q.infopipejoin
			delete q.infopipejoin
		}
		const tmp = child_process
			.execSync(serverconfig.tabix + ' -l ' + path.join(serverconfig.tpmasterdir, q.vcffile), { encoding: 'utf8' })
			.trim()
		if (tmp == '') return 'tabix -l found no chromosomes/contigs in ' + q.vcffile + ' of query ' + q.name
		q.vcf.nochr = common.contigNameNoChr(genome, tmp.split('\n'))
		let infoc = 0
		if (info) {
			for (const n in info) infoc++
		}
		console.log(
			'Parsed vcf meta from ' +
				q.vcffile +
				': ' +
				infoc +
				' INFO, ' +
				samples.length +
				' sample, ' +
				(q.vcf.nochr ? 'no "chr"' : 'has "chr"')
		)
		return
	}

	if (q.makequery) {
		if (q.isgeneexpression) {
			if (!q.config) return 'config object missing for gene expression query of ' + q.name
			if (q.config.maf) {
				q.config.maf.get = getFunctionConstructorArgs(q.config.maf.get)
			}
		}
		return
	}

	return 'do not know how to parse query: ' + q.name
}

function getFunctionConstructorArgs(fxn) {
	// new Function() constructor requires a separate argument string
	// for each function argument, and then the function body as the last argument, see
	// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/Function
	const lines = fxn
		.toString()
		.split('\n')
		.map(f => f.trim())
	const line0 = lines.shift()
	const args =
		line0.includes('(') && line0.includes(')')
			? line0.split('(')[1].split(')')[0].trim().split(',')
			: line0.split('=>')[0].replace('async ', '').trim().split(' ')
	if (lines[lines.length - 1] == '}') lines.pop()
	args.push(lines.join('\n'))
	return args
}
