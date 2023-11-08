import { fileurl, file_is_readable } from '#src/utils.js'
import { do_hicstat } from '#src/hicstat.js'
import { HicstatRequest } from '#shared/types/routes/hicstat.ts'

export const api: any = {
	endpoint: 'hicstat',
	methods: {
		get: {
			init,
			request: {
				typeId: 'HicstatRequest'
			},
			response: {
				typeId: 'HicstatRequest'
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
			const payload = await handle_hicstat(req as HicstatRequest, res as any)
			res.send(payload)
		} catch (e) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			res.send({ error: e?.message || e })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

async function handle_hicstat(req: any, res: any) {
	try {
		const [e, file, isurl] = fileurl(req)
		if (e) throw 'illegal file name'
		if (!isurl) {
			await file_is_readable(file)
		}
		const out = await do_hicstat(file, isurl)
		res.send({ out })
	} catch (e: any) {
		res.send({ error: e.message || e })
		if (e.stack) console.log(e.stack)
	}
}
