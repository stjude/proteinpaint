/*
The /cardsjson route handler, see routes/cardsjson.ts
*/

import serverconfig from './serverconfig.js'
import * as utils from './utils.js'
import * as common from '#shared/common.js'

// set by the route init, so that the handler code can use the loaded genomes
let genomes

export { handle_cards }

export function setGenomes(_genomes) {
	genomes = _genomes
}

/****
	- validate and start the server
	This enables the correct monitoring by the forever module. 
	Whereas before 'forever' will endlessly restart the server
	even if it cannot be initialized in a full working state,
	the usage in a bash script should now be: 
	```
	set -e
	node server validate 
	# only proceed to using forever on successful validation
	forever -a --minUptime 1000 --spinSleepTime 1000 --uid "pp" -l $logdir/log -o $logdir/out -e $logdir/err start server.js --max-old-space-size=8192
	```
***/

async function handle_cards(req, res) {
	try {
		if (req.query.datafile && req.query.tabixCoord) {
			const gn = genomes[req.query.genome]
			if (!gn) throw 'invalid genome'

			const c = common.string2pos(req.query.tabixCoord, gn, true)
			if (!c) throw 'invalid tabixCoord'

			const [e, file] = utils.fileurl({ query: { file: req.query.datafile } })
			if (e) throw e
			await utils.file_is_readable(file)

			const lines = []
			await utils.readTabixLines({
				file: file,
				regions: [{ chr: c.chr, start: c.start, stop: c.stop }],
				callback: line => lines.push(line)
			})
			res.send({ file: lines })
		} else {
			throw `invalid cards request`
		}
	} catch (e) {
		res.send({ error: e.message || e })
	}
}
