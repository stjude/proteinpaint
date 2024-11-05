import type { HicGenomeRequest, HicGenomeResponse, XYZCoord, RouteApi } from '#types'
import { hicGenomePayload } from '#types'
import { fileurl } from '#src/utils.js'
import { spawn } from 'child_process'
import readline from 'readline'
import serverconfig from '#src/serverconfig.js'

export const api: RouteApi = {
	endpoint: 'hicgenome',
	methods: {
		get: {
			...hicGenomePayload,
			init
		},
		post: {
			...hicGenomePayload,
			init
		}
	}
}

function init() {
	return async (req, res): Promise<void> => {
		const query: HicGenomeRequest = req.query
		const data: { items: XYZCoord[]; lead: string; follow: string }[] = []
		const erroutput: string[] = []

		const [e, file] = fileurl({ query })
		if (e) res.send({ error: 'illegal file name' })

		/*Value passed from client is not the proper straw parameter.
        Must convert to straw parameter and apply the corresponding maths to the result.
        Use 'observed' as default if not provided.
        */
		const matrixType =
			req.query.matrixType == 'log(oe)' ? 'oe' : req.query.matrixType ? req.query.matrixType : 'observed'

		const promises = req.query.chrlst
			.map((lead: string, i: number) => {
				return req.query.chrlst.slice(0, i + 1).map((follow: string, j: number) => {
					if (j <= i) {
						return new Promise<void>((resolve, reject): void => {
							const pos1 = req.query.nochr ? lead.replace('chr', '') : lead
							const pos2 = req.query.nochr ? follow.replace('chr', '') : follow
							const par = [matrixType, req.query.nmeth || 'NONE', file, pos1, pos2, 'BP', req.query.resolution]

							const ps = spawn(serverconfig.hicstraw, par)
							const rl = readline.createInterface({ input: ps.stdout })

							const items: XYZCoord[] = []
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
								const v =
									req.query.matrixType == 'log(oe)' ? Math.log(Number.parseFloat(l[2])) : Number.parseFloat(l[2])
								if (Number.isNaN(n1) || Number.isNaN(n2) || Number.isNaN(v)) {
									fieldnotnumerical++
									return
								}
								items.push([n1, n2, v] satisfies XYZCoord)
							})
							data.push({ items, lead, follow })
							ps.stderr.on('data', i => erroutput.push(`${lead} - ${follow}: `, i))
							ps.on('close', () => {
								if (erroutput.length) reject({ error: erroutput.join('') })
								if (linenot3fields) reject({ error: `${linenot3fields} lines have other than 3 fields` })

								if (fieldnotnumerical)
									reject(`${fieldnotnumerical} lines have non-numerical values in any of the 3 fields`)
								resolve()
							})
						})
					}
				})
			})
			.flat()

		Promise.allSettled(promises)
			.then(() => res.send({ data, error: erroutput.join('') } satisfies HicGenomeResponse))
			.catch(e => {
				res.send({ error: e?.message || e })
				if (e instanceof Error && e.stack) console.log(e)
			})
	}
}
