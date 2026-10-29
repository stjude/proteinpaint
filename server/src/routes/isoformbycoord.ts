import type { RouteApi, RoutePayload } from '#types'
import path from 'path'
import * as utils from '#src/utils.js'
import * as common from '#shared/common.js'
import serverconfig from '#src/serverconfig.js'

/*
The route of the isoforms at a genomic position.
*/

const payload: RoutePayload = {
	init,
	request: { typeId: 'any' },
	response: { typeId: 'any' }
}

export const api: RouteApi = {
	endpoint: 'isoformbycoord',
	methods: {
		get: payload
	}
}

function init({ genomes }) {
	return async function handle_isoformbycoord(req, res) {
		try {
			const genome = genomes[req.query.genome]
			if (!genome) throw 'invalid genome'
			// validated chr/pos from string2pos() are used below instead of raw req.query.chr/pos
			const p = common.string2pos(req.query.chr + ':' + req.query.pos, genome, false)
			if (!p?.actualposition?.position) throw 'invalid chr/pos'
			const chr = p.chr,
				pos = p.actualposition.position

			const genetk = genome.tracks.find(i => i.__isgene)
			if (!genetk) throw 'no gene track'
			const isoforms: any[] = []
			await utils.readTabixLines({
				file: path.join(serverconfig.tpmasterdir, genetk.file),
				regions: [{ chr: chr, start: pos, stop: pos }],
				callback: line => {
					const str = line.split('\t')[3]
					if (!str) return
					const j = JSON.parse(str)
					if (!j.isoform) return
					const j2: any = { isoform: j.isoform }
					const tmp = genome.genedb.getjsonbyisoform.get(j.isoform)
					if (tmp) {
						j2.name = JSON.parse(tmp.genemodel).name
						j2.isdefault = tmp.isdefault
					}
					isoforms.push(j2)
				}
			})
			res.send({ lst: isoforms })
		} catch (e: any) {
			if (e.stack) console.log(e.stack)
			res.send({ error: e.message || e })
		}
	}
}
