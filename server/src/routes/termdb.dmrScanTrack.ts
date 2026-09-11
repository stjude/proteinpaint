import type { RouteApi, RoutePayload } from '#types'
import { cacheFilePath } from '#src/utils/cacheOrRecompute.ts'
import { HYPER_COLOR, HYPO_COLOR } from '#shared/dmrColors.js'
import fs from 'fs'

/* The DMRs a scan called on one chromosome, as bedj items for a genome browser track.

A scan's DMRs live in its cached result under dmr/; the browser only ever holds the capped
interactive rows, so a track built from those would show a few of the regions and imply the rest
are not there. The cache is not under the tp directory, so it cannot be served as a track FILE;
it is served as in-memory items instead, one chromosome at a time, which is small enough to hold
(chr1 on MMRF NSD2 is ~10,000 DMRs) and lets the reader pan the whole chromosome. The same CpG
floor the volcano applied is applied here, so the track shows the DMRs the volcano counts. */

export const api: RouteApi = {
	endpoint: 'termdb/dmrScanTrack',
	methods: {
		get: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload,
		post: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload
	}
}

function init() {
	return async (req, res): Promise<void> => {
		try {
			const q = req.query
			if (typeof q.cacheId != 'string') throw new Error('cacheId missing')
			if (typeof q.chr != 'string' || !q.chr) throw new Error('chr missing')
			const minCpgs = Math.max(1, Math.floor(Number(q.minCpgs) || 1))
			const file = cacheFilePath('dmr', q.cacheId)
			if (!fs.existsSync(file)) throw new Error('This scan is no longer cached; rerun it to open the browser.')
			const scan = JSON.parse(await fs.promises.readFile(file, 'utf8'))
			const items: { chr: string; start: number; stop: number; name: string; color: string }[] = []
			for (const r of scan.regions || []) {
				if (r.chr != q.chr) continue
				for (const d of r.dmrs || []) {
					if (d.no_cpgs < minCpgs) continue
					items.push({
						chr: d.chr,
						start: d.start,
						stop: d.stop,
						name: `Δβ ${d.meandiff >= 0 ? '+' : ''}${d.meandiff.toFixed(3)}, ${d.no_cpgs} CpGs${
							d.genes?.length ? ', ' + d.genes.join(' ') : ''
						}`,
						color: d.direction == 'hypo' ? HYPO_COLOR : HYPER_COLOR
					})
				}
			}
			items.sort((a, b) => a.start - b.start)
			res.send({ items })
		} catch (e: any) {
			res.status(e.status || 500).send({ error: e.message || e })
		}
	}
}
