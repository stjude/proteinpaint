import type { HicdataRequest, HicdataResponse, XYZCoord, RouteApi } from '#types'
import { hicdataPayload } from '#types/checkers'
import { fileurl } from '#src/utils.js'
import { spawn } from 'child_process'
import readline from 'readline'
import serverconfig from '#src/serverconfig.js'

export const api: RouteApi = {
	endpoint: 'hicdata',
	methods: {
		get: {
			...hicdataPayload,
			init
		},
		post: {
			...hicdataPayload,
			init
		}
	}
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			const q: HicdataRequest = req.query
			const payload = await handle_hicdata(q)
			res.send(payload satisfies HicdataResponse)
		} catch (e: any) {
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

function handle_hicdata(q: HicdataRequest): Promise<HicdataResponse> {
	return new Promise((resolve, reject) => {
		const [e, file] = fileurl({ query: q })
		if (e) reject({ error: 'illegal file name' })

		/*Value passed from client is not the proper straw parameter.
		Must convert to straw parameter and apply the corresponding maths to the result.
		Use 'observed' as default if not provided.
		*/
		const matrixType = q.matrixType == 'log(oe)' ? 'oe' : q.matrixType ? q.matrixType : 'observed'

		const par = [matrixType, q.nmeth || 'NONE', file, q.pos1, q.pos2, q.isfrag ? 'FRAG' : 'BP', q.resolution]

		const ps = spawn(serverconfig.hicstraw, par)
		const rl = readline.createInterface({ input: ps.stdout })

		const items: XYZCoord[] = []
		const erroutput = [] as string[]
		let linenot3fields = 0
		let fieldnotnumerical = 0

		rl.on('line', line => {
			// straw output: pos1 \t pos2 \t value
			const l = line.split('\t')
			if (l.length != 3) {
				linenot3fields++
				return
			}
			const n1 = Number.parseInt(l[0])
			const n2 = Number.parseInt(l[1])
			const v = q.matrixType == 'log(oe)' ? Math.log(Number.parseFloat(l[2])) : Number.parseFloat(l[2])
			if (Number.isNaN(n1) || Number.isNaN(n2) || Number.isNaN(v)) {
				fieldnotnumerical++
				return
			}
			if (q.mincutoff != undefined && v <= q.mincutoff) {
				return
			}
			items.push([n1, n2, v] satisfies XYZCoord)
		})

		ps.stderr.on('data', i => erroutput.push(i))
		ps.on('close', () => {
			const err = erroutput.join('')
			if (err) reject({ error: err })

			if (linenot3fields) reject({ error: linenot3fields + ' lines have other than 3 fields' })

			if (fieldnotnumerical)
				reject({ error: fieldnotnumerical + ' lines have non-numerical values in any of the 3 fields' })

			resolve({ items } as HicdataResponse)
		})
	})
}
