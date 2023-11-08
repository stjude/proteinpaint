import { fileurl, file_is_readable } from '#src/utils.js'
import { do_hicstat } from '#src/hicstat.js'
import { HicstatRequest, HicstatResponse } from '#shared/types/routes/hicstat.ts'

export const api = {
	endpoint: 'hicstat',
	methods: {
		get: {
			init,
			request: {
				typeId: 'HicstatRequest'
			},
			response: {
				typeId: 'HicstatResponse'
			},
			examples: [
				{
					request: {
						body: {
							genome: 'hg19',
							file: 'proteinpaint_demo/hg19/hic/hic_demo.hic',
							embedder: 'localhost'
						}
					},
					response: {
						header: { status: 200 }
					}
				}
			]
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init() {
	return async (req: HicstatRequest, res: any): Promise<void> => {
		try {
			await handle_hicstat(req, res)
		} catch (e) {
			console.log(`hicstat error: ${e} [server/routes/hicstat.ts handle_hicstat()]`)
		}
	}
}

async function handle_hicstat(req: HicstatRequest, res: any) {
	try {
		const [e, file, isurl] = fileurl(req)
		if (e) throw 'illegal file name'
		if (!isurl) {
			await file_is_readable(file)
		}
		const out = (await do_hicstat(file, isurl)) as Partial<HicstatResponse>
		res.send({ out })
	} catch (e: any) {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		res.send({ error: e?.message || e })
		if (e instanceof Error && e.stack) console.log(e)
	}
}
