import path from 'path'
import serverconfig from './serverconfig'
import * as utils from './utils'
import * as common from '#shared/common'
import * as vcf from '#shared/vcf'
import * as bulk from '#shared/bulk'
import * as bulksnv from '#shared/bulk.snv'
import * as bulkcnv from '#shared/bulk.cnv'
import * as bulkdel from '#shared/bulk.del'
import * as bulkitd from '#shared/bulk.itd'
import * as bulksv from '#shared/bulk.sv'
import * as bulksvjson from '#shared/bulk.svjson'
import * as bulktrunc from '#shared/bulk.trunc'

export default async function handle_study(req, res) {
	try {
		if (utils.illegalpath(req.query.file)) throw 'invalid file path'
		const file = path.join(
			serverconfig.tpmasterdir,
			req.query.file.endsWith('.json') ? req.query.file : req.query.file + '.json'
		)

		const cohort = JSON.parse(await utils.read_file(file))
		if (!cohort.genome) throw 'genome missing'
		const flagset = {}
		let nameless = 0
		for (const mset of cohort.mutationset || []) {
			const flag = bulk.init_bulk_flag(cohort.genome)
			if (!flag) throw 'init_bulk_flag() failed'
			if (cohort.mutationset.length > 1) {
				flag.tpsetname = mset.name ? mset.name : 'set' + ++nameless
			}
			flagset[Math.random()] = flag
			if (mset.snvindel) {
				const text = await utils.read_file(path.join(serverconfig.tpmasterdir, mset.snvindel))
				const lines = text.trim().split(/\r?\n/)
				const herr = bulksnv.parseheader(lines[0], flag)
				if (herr) throw 'snvindel header line error: ' + herr
				for (let i = 1; i < lines.length; i++) {
					bulksnv.parseline(i, lines[i], flag)
				}
			}
			if (mset.sv) {
				const text = await utils.read_file(path.join(serverconfig.tpmasterdir, mset.sv))
				const lines = text.trim().split(/\r?\n/)
				const herr = bulksv.parseheader(lines[0], flag, true)
				if (herr) throw 'sv header line error: ' + herr
				for (let i = 1; i < lines.length; i++) {
					bulksv.parseline(i, lines[i], flag, true)
				}
			}
			if (mset.fusion) {
				const text = await utils.read_file(path.join(serverconfig.tpmasterdir, mset.fusion))
				const lines = text.trim().split(/\r?\n/)
				const herr = bulksv.parseheader(lines[0], flag, false)
				if (herr) throw 'fusion header line error: ' + herr
				for (let i = 1; i < lines.length; i++) {
					bulksv.parseline(i, lines[i], flag, false)
				}
			}
			if (mset.svjson) {
				const text = await utils.read_file(path.join(serverconfig.tpmasterdir, mset.svjson))
				const lines = text.trim().split(/\r?\n/)
				const [herr, header] = bulksvjson.parseheader(lines[0], flag)
				if (herr) throw 'svjson header line error: ' + herr
				for (let i = 1; i < lines.length; i++) {
					bulksvjson.parseline(i, lines[i], flag, header)
				}
			}
			if (mset.cnv) {
				const text = await utils.read_file(path.join(serverconfig.tpmasterdir, mset.cnv))
				const lines = text.trim().split(/\r?\n/)
				const herr = bulkcnv.parseheader(lines[0], flag)
				if (herr) throw 'cnv header line error: ' + herr
				for (let i = 1; i < lines.length; i++) {
					bulkcnv.parseline(i, lines[i], flag)
				}
			}
			if (mset.itd) {
				const text = await utils.read_file(path.join(serverconfig.tpmasterdir, mset.itd))
				const lines = text.trim().split(/\r?\n/)
				const herr = bulkitd.parseheader(lines[0], flag)
				if (herr) throw 'itd header line error: ' + herr
				for (let i = 1; i < lines.length; i++) {
					bulkitd.parseline(i, lines[i], flag)
				}
			}
			if (mset.deletion) {
				const text = await utils.read_file(path.join(serverconfig.tpmasterdir, mset.deletion))
				const lines = text.trim().split(/\r?\n/)
				const herr = bulkdel.parseheader(lines[0], flag)
				if (herr) throw 'deletion header line error: ' + herr
				for (let i = 1; i < lines.length; i++) {
					bulkdel.parseline(i, lines[i], flag)
				}
			}
			if (mset.truncation) {
				const text = await utils.read_file(path.join(serverconfig.tpmasterdir, mset.truncation))
				const lines = text.trim().split(/\r?\n/)
				const herr = bulktrunc.parseheader(lines[0], flag)
				if (herr) throw 'Truncation header line error: ' + herr
				for (let i = 1; i < lines.length; i++) {
					bulktrunc.parseline(i, lines[i], flag)
				}
			}
		}
		if (cohort.annotations) {
			const idkey = cohort.annotations.idkey ? cohort.annotations.idkey : 'sample'
			cohort.annotations.data = {}
			for (const filename of cohort.annotations.files) {
				const text = await utils.read_file(path.join(serverconfig.tpmasterdir, filename))
				d3dsv.tsvParse(text).forEach(d => {
					const id = d[idkey].trim()
					if (!cohort.annotations.data[id]) {
						cohort.annotations.data[id] = []
					}
					cohort.annotations.data[id].push(d)
				})
			}
		}
		for (const k in flagset) {
			local_end_flag(flagset[k])
		}
		delete cohort.mutationset
		res.send({
			cohort: cohort,
			flagset: flagset
		})
	} catch (e) {
		res.send({ error: e.message || e })
		return
	}
}

function local_end_flag(flag) {
	delete flag.mclasslabel2key
	delete flag.sample2disease
	delete flag.patient2ori2sample
}
