import type { RoutePayload } from '#types'
import type { HicGenomeRequest, HicGenomeResponse, XYZCoord, RouteApi } from '#types'
import { fileurl } from '#src/utils.js'
import { spawn } from 'child_process'
import readline from 'readline'
import serverconfig from '#src/serverconfig.js'
import { mapConcurrent } from '#src/utils/concurrencyLimiter.ts'
import { getStrawArgs, validChrlst, STRAW_CONCURRENCY } from '#src/utils/hicStraw.ts'

export const payload: RoutePayload = {
	init,
	request: { typeId: 'HicGenomeRequest' /*, checkers: TODO write validator */ },
	response: { typeId: 'HicGenomeResponse' }
}

export const api: RouteApi = {
	endpoint: 'hicgenome',
	methods: {
		get: payload,
		post: payload
	}
}

function init() {
	return async (req, res): Promise<void> => {
		const query: HicGenomeRequest = req.query
		const data: { items: XYZCoord[]; lead: string; follow: string }[] = []
		const erroutput: string[] = []

		const [e, file] = fileurl({ query })
		if (e) {
			res.send({ error: 'illegal file name' })
			return
		}

		let strawArgs: ReturnType<typeof getStrawArgs>, chrlst: string[]
		try {
			strawArgs = getStrawArgs(query)
			chrlst = validChrlst(query.chrlst)
		} catch (e) {
			res.send({ error: e })
			return
		}
		const { strawMatrixType, nmeth, resolution } = strawArgs

		// one straw process per chromosome pair, in the same lead/follow order as before
		const pairs: { lead: string; follow: string; items: XYZCoord[] }[] = []
		for (const [i, lead] of chrlst.entries()) {
			for (const follow of chrlst.slice(0, i + 1)) pairs.push({ lead, follow, items: [] })
		}
		data.push(...pairs)

		const runStraw = ({ lead, follow, items }: (typeof pairs)[number]) =>
			new Promise<void>((resolve, reject): void => {
				const pos1 = query.nochr ? lead.replace('chr', '') : lead
				const pos2 = query.nochr ? follow.replace('chr', '') : follow
				const par = [strawMatrixType, nmeth, file, pos1, pos2, 'BP', resolution]

				const ps = spawn(serverconfig.hicstraw, par)
				const rl = readline.createInterface({ input: ps.stdout })

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
					const v = query.matrixType == 'log(oe)' ? Math.log(Number.parseFloat(l[2])) : Number.parseFloat(l[2])
					if (Number.isNaN(n1) || Number.isNaN(n2) || Number.isNaN(v)) {
						fieldnotnumerical++
						return
					}
					items.push([n1, n2, v] satisfies XYZCoord)
				})
				ps.stderr.on('data', i => erroutput.push(`${lead} - ${follow}: `, i))
				ps.on('close', () => {
					if (erroutput.length) reject({ error: erroutput.join('') })
					if (linenot3fields) reject({ error: `${linenot3fields} lines have other than 3 fields` })

					if (fieldnotnumerical) reject(`${fieldnotnumerical} lines have non-numerical values in any of the 3 fields`)
					resolve()
				})
			})

		mapConcurrent(pairs, STRAW_CONCURRENCY, runStraw)
			.then(() => res.send({ data, error: erroutput.join('') } satisfies HicGenomeResponse))
			.catch(e => {
				res.send({ error: e?.message || e })
				if (e instanceof Error && e.stack) console.log(e)
			})
	}
}
