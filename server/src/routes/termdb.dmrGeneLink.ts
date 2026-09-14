import type { RouteApi, RoutePayload } from '#types'
import { cacheFilePath } from '#src/utils/cacheOrRecompute.ts'
import { getDeCacheResult } from '#src/routes/termdb.DE.ts'
import { matchedSamplelst, eligibleMethylationSamples } from '#src/utils/methylationMatrix.ts'
import { buildTssIndex, linkDmrsToGenes, classifyLink, type GeneModel, type TssIndex } from '#src/utils/dmrGeneLink.ts'
import fs from 'fs'

/* Every gene a scan's DMRs touch, where they touch it, and whether its expression moved the way
that position predicts. The scan comes from its cache (as termdb/dmrScanTrack reads it), expression
from the same DE run the volcano and termdb/dmrGeneDE use, on the patients with methylation. See
utils/dmrGeneLink.ts for the promoter/body rules. */

export const api: RouteApi = {
	endpoint: 'termdb/dmrGeneLink',
	methods: {
		get: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload,
		post: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload
	}
}

/** Rows returned. The summary counts cover every link; the rows are for reading and following up. */
const MAX_ROWS = 2000

/** Default-isoform gene models per genome, parsed once: ~40,000 JSON rows is a second of work. */
const tssIndexes = new WeakMap<object, TssIndex>()
function getTssIndex(genome: any): TssIndex {
	let idx = tssIndexes.get(genome)
	if (idx) return idx
	const rows = genome?.genedb?.db?.prepare('select genemodel from genes where isdefault=1').all() || []
	const models: GeneModel[] = []
	for (const r of rows) {
		try {
			const m = JSON.parse(r.genemodel)
			models.push({ name: m.name, chr: m.chr, start: m.start, stop: m.stop, strand: m.strand })
		} catch {
			// a malformed model is one gene missing from the links, not a failed request
		}
	}
	idx = buildTssIndex(models)
	tssIndexes.set(genome, idx)
	return idx
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw new Error('unknown genome')
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw new Error('unknown dataset')
			if (!ds.queries?.dnaMethylation) throw new Error('This dataset has no DNA methylation data.')
			if (typeof q.cacheId != 'string' || !/^[0-9a-f]+$/i.test(q.cacheId)) throw new Error('cacheId missing')
			if (q.samplelst?.groups?.length != 2) throw new Error('Two sample groups are required.')
			const file = cacheFilePath('dmr', q.cacheId)
			if (!fs.existsSync(file)) throw new Error('This scan is no longer cached; rerun it first.')
			const scan = JSON.parse(await fs.promises.readFile(file, 'utf8'))
			const minCpgs = Math.max(1, Math.floor(Number(q.minCpgs) || 1))
			const links = linkDmrsToGenes(
				(scan.regions || []).flatMap((r: any) => r.dmrs || []),
				getTssIndex(genome),
				minCpgs
			)

			const samplelst = await matchedSamplelst(q.samplelst, eligibleMethylationSamples(ds, undefined), ds)
			const { result } = await getDeCacheResult(
				{
					genome: q.genome,
					dslabel: q.dslabel,
					samplelst,
					min_count: q.min_count ?? 10,
					min_total_count: q.min_total_count ?? 15,
					cpm_cutoff: q.cpm_cutoff,
					method: q.method,
					filter: q.filter,
					filter0: q.filter0
				} as any,
				genomes
			)
			const expr = new Map<string, { fc: number; p: number }>()
			for (const r of (result as any)?.geneRows || [])
				expr.set(r.gene_name, { fc: r.fold_change, p: r.adjusted_p_value ?? r.original_p_value })

			const summary: Record<string, Record<string, number>> = { promoter: {}, body: {} }
			const rows = links.map(l => {
				const e = expr.get(l.gene)
				const relationship = classifyLink(l.context, l.dmr.deltaBeta, e)
				summary[l.context][relationship] = (summary[l.context][relationship] || 0) + 1
				return { ...l, fc: e?.fc ?? null, p: e?.p ?? null, relationship }
			})
			// what a reader follows up first: links the expression supports, then by expression evidence
			const rank = { concordant: 0, discordant: 1, 'no expression change': 2, 'not tested': 3 }
			rows.sort((a, b) => rank[a.relationship] - rank[b.relationship] || (a.p ?? 1) - (b.p ?? 1))
			res.send({
				status: 'ok',
				genes: new Set(links.map(l => l.gene)).size,
				links: rows.length,
				summary,
				deMethod: (result as any)?.method,
				rows: rows.slice(0, MAX_ROWS)
			})
		} catch (e: any) {
			res.send({ error: e?.message || String(e) })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
