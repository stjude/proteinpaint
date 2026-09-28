import type { RouteApi, RoutePayload } from '#types'
import { scanWithExpression } from '#src/routes/termdb.dmrGeneLink.ts'
import { geneSketch, cnvByGroup, PROMOTER_PAD } from '#src/utils/dmrGeneLink.ts'

/* The genes DE ranks highest each way on the patients with both methylation and RNA, each with the
scan's DMRs over its promoter and body and how often each group gains or loses it. DE is the cached
run termdb/dmrGeneLink and the volcano share; see utils/dmrGeneLink.ts geneSketch for the layout. */

export const api: RouteApi = {
	endpoint: 'termdb/dmrTopGenes',
	methods: {
		get: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload,
		post: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload
	}
}

const MAX_TOP = 100
/* MMRF's CNV defaults are tuned for focal events: cutoff 0 calls any positive segment a gain and the
10 Mb cap drops arm-level ones, so neither is a copy-number state. ±0.15 with no cap is what the
dataset's ABL1 ploidy override and hyperdiploidy term use. */
const CNV_CUTOFF = 0.15
const SEX_CHR = new Set(['chrX', 'chrY'])

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q = req.query
			const { genome, ds, scan, minCpgs, samplelst, de } = await scanWithExpression(q, genomes)
			const top = Math.min(MAX_TOP, Math.max(1, Math.floor(Number(q.top) || 20)))
			const p = (r: any) => r.adjusted_p_value ?? r.original_p_value
			const sig = (de.geneRows || []).filter((r: any) => Number.isFinite(r.fold_change) && p(r) < 0.05)
			const up = sig.filter((r: any) => r.fold_change > 0).sort((a: any, b: any) => b.fold_change - a.fold_change)
			const down = sig.filter((r: any) => r.fold_change < 0).sort((a: any, b: any) => a.fold_change - b.fold_change)
			const dmrs = (scan.regions || []).flatMap((r: any) => r.dmrs || [])
			// the cached scan carries this block only when it ran corrected
			const corrected = !!scan.backgroundCorrection

			// the samples DE compared: methylation-matched, and with RNA
			const rna: Set<string> | undefined = ds.queries?.rnaseqGeneCount?.allSampleSet
			const toId = (n: string) => ds.cohort?.termdb?.q?.sampleName2id?.(n) ?? n
			const withRna = rna ? new Set([...rna].map(toId)) : undefined
			const groups = samplelst.groups.map(
				g => new Set(g.values.map(v => v.sampleId).filter(id => !withRna || withRna.has(id)))
			)
			const cnvq = ds.queries?.cnv
			const assayed = new Set<number | string>((cnvq?.samples || []).map((s: any) => s.name))

			const row = async (r: any) => {
				const out: any = { gene: r.gene_name, fc: r.fold_change, p: p(r) }
				const m = defaultModel(genome, r.gene_name)
				if (!m) return out
				out.model = { chr: m.chr, start: m.start, stop: m.stop, strand: m.strand }
				out.sketch = geneSketch(m, dmrs, minCpgs, corrected)
				// a segment mean against a diploid reference calls every male X a loss: sex, not copy number
				if (cnvq?.get && !SEX_CHR.has(m.chr)) {
					const { cnvs } = await cnvq.get({
						rglst: [{ chr: m.chr, start: m.start, stop: m.stop }],
						cnvGainCutoff: CNV_CUTOFF,
						cnvLossCutoff: -CNV_CUTOFF
					})
					out.cnv = cnvByGroup(cnvs, groups, assayed)
				}
				return out
			}
			res.send({
				status: 'ok',
				deMethod: de.method,
				sampleSizes: [de.sample_size1, de.sample_size2],
				pairedSizes: groups.map(g => g.size),
				nSignificant: sig.length,
				promoterPad: PROMOTER_PAD,
				backgroundCorrection: corrected,
				cnvCutoff: cnvq?.get ? CNV_CUTOFF : undefined,
				up: await Promise.all(up.slice(0, top).map(row)),
				down: await Promise.all(down.slice(0, top).map(row))
			})
		} catch (e: any) {
			res.send({ error: e?.message || String(e) })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

/** The gene's default model, the one termdb/dmrGeneLink places DMRs against; RefSeq and Ensembl can
 * both be default, and the first is taken. */
function defaultModel(genome: any, name: string) {
	const rows = genome.genedb?.getjsonbyname?.all(name) || []
	const r = rows.find((r: any) => r.isdefault) || rows[0]
	return r ? JSON.parse(r.genemodel) : null
}
