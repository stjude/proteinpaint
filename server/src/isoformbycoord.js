/*
The /isoformbycoord route handler, moved from app.unorg.js, see routes/isoformbycoord.ts
*/

import serverconfig from './serverconfig.js'
import path from 'path'
import * as utils from './utils.js'
import * as common from '#shared/common.js'

// set by the route init, so that the moved code can use genomes as in app.unorg.js
let genomes

export { handle_isoformbycoord }

export function setGenomes(_genomes) {
	genomes = _genomes
}

async function handle_isoformbycoord(req, res) {
	try {
		const genome = genomes[req.query.genome]
		if (!genome) throw 'invalid genome'
		// validated chr/pos from string2pos() are used below instead of raw req.query.chr/pos
		const p = common.string2pos(req.query.chr + ':' + req.query.pos, genome)
		if (!p?.actualposition?.position) throw 'invalid chr/pos'
		const chr = p.chr,
			pos = p.actualposition.position

		const genetk = genome.tracks.find(i => i.__isgene)
		if (!genetk) throw 'no gene track'
		const isoforms = []
		await utils.readTabixLines({
			file: path.join(serverconfig.tpmasterdir, genetk.file),
			regions: [{ chr: chr, start: pos, stop: pos }],
			callback: line => {
				const str = line.split('\t')[3]
				if (!str) return
				const j = JSON.parse(str)
				if (!j.isoform) return
				const j2 = { isoform: j.isoform }
				const tmp = genome.genedb.getjsonbyisoform.get(j.isoform)
				if (tmp) {
					j2.name = JSON.parse(tmp.genemodel).name
					j2.isdefault = tmp.isdefault
				}
				isoforms.push(j2)
			}
		})
		res.send({ lst: isoforms })
	} catch (e) {
		if (e.stack) console.log(e.stack)
		res.send({ error: e.message || e })
	}
}
