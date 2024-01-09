import { HicdataRequest, HicdataResponse, Item } from '#shared/types/routes/hicdata.ts'
import { fileurl } from '#src/utils.js'
import { spawn } from 'child_process'
import readline from 'readline'
import serverconfig from '#src/serverconfig.js'

export const api: any = {
	endpoint: 'hicdata',
	methods: {
		get: {
			init,
			request: {
				typeId: 'HicdataRequest'
			},
			response: {
				typeId: 'HicdataResponse'
			}
			/*
			examples: [
				{
					request: {
						body: {
							genome: 'hg38-test',
							dslabel: 'TermdbTest',
							embedder: 'localhost',
							gettermbyid: 'subcohort'
						}
					},
					response: {
						header: { status: 200 }
					}
				}
			]
			*/
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const payload = await handle_hicdata(req.query as HicdataRequest)
			res.send(payload)
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

function handle_hicdata(q: HicdataRequest) {
	return new Promise((resolve, reject) => {
		const [e, file, isurl] = fileurl({ query: q })
		if (e) reject({ error: 'illegal file name' })

		const par = [
			q.oevalues || 'observed',
			q.nmeth || 'NONE',
			file,
			q.pos1,
			q.pos2,
			q.isfrag ? 'FRAG' : 'BP',
			q.resolution
		]

		const ps = spawn(serverconfig.hicstraw, par)
		const rl = readline.createInterface({ input: ps.stdout })

		const items = [] as Item[]
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
			const v = Number.parseFloat(l[2])
			if (Number.isNaN(n1) || Number.isNaN(n2) || Number.isNaN(v)) {
				fieldnotnumerical++
				return
			}
			if (q.mincutoff != undefined && v <= q.mincutoff) {
				return
			}
			items.push([n1, n2, v] as Item)
		})

		ps.stderr.on('data', i => erroutput.push(i))
		ps.on('close', () => {
			const err = erroutput.join('')
			if (err) reject({ error: err })

			if (linenot3fields) reject({ error: linenot3fields + ' lines have other than 3 fields' })

			if (fieldnotnumerical)
				reject({ error: fieldnotnumerical + ' lines have non-numerical values in any of the 3 fields' })

			resolve({ items })
		})
	})
}
