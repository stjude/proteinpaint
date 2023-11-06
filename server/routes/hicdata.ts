// import { gettermbyidRequest, gettermbyidResponse } from '#shared/types/routes/termdb.termbyid'
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
				typeId: 'hicdata'
			},
			response: {
				typeId: 'hicdata'
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
			const payload = await handle_hicdata(req)
			res.send(payload)
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

function handle_hicdata(req) {
	return new Promise((resolve, reject) => {
		const [e, file, isurl] = fileurl(req)
		if (e) reject({ error: 'illegal file name' })

		const par = [
			// TODO add option for observed/oe
			req.query.nmeth || 'NONE',
			file,
			req.query.pos1,
			req.query.pos2,
			req.query.isfrag ? 'FRAG' : 'BP',
			req.query.resolution
		]

		const ps = spawn(serverconfig.hicstraw, par)
		const rl = readline.createInterface({ input: ps.stdout })

		const items = []
		const erroutput = []
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
			if (req.query.mincutoff != undefined && v <= req.query.mincutoff) {
				return
			}
			items.push([n1, n2, v])
		})

		ps.stderr.on('data', i => erroutput.push(i))
		ps.on('close', () => {
			const err = erroutput.join('')
			if (err) reject({ error: err })

			if (linenot3fields) reject({ error: linenot3fields + ' lines have other than 3 fields' })

			if (fieldnotnumerical)
				reject({ error: fieldnotnumerical + ' lines have non-numerical values in any of the 3 fields' })

			resolve({ items: items })
		})
	})
}
