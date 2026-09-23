import type { RoutePayload, RouteApi } from '#types'
import { run_R } from '@sjcrh/proteinpaint-r'
import { getData } from '#src/termdb.matrix.js'
import { mayLog } from '#src/helpers.ts'
import { matchedSamplelst, eligibleMethylationSamples } from '#src/utils/methylationMatrix.ts'
import { formatElapsedTime } from '#shared'

/* Does a region's methylation predict survival, beyond the grouping that picked it?

Screens a fixed list of regions -- the top of a methylation volcano, chosen on methylation evidence
before survival is looked at, so the selection cannot be tuned to outcome -- with one Cox model per
region (R/src/dmrSurvival.R): methylation per SD, the caller's covariates, and the two volcano groups
as strata. Stratifying is what keeps this from being circular: the grouping (t(4;14) on MMRF) is
itself prognostic, and a region it shifts would otherwise "predict" survival by proxy.

When a region names a gene, that gene's expression goes through the same model, so a hit can be
read as methylation -> expression -> outcome rather than methylation alone.

Values come through getData(), the same path the survival plot uses, so case-level survival joins
sample-level methylation exactly as it does there. */

export const api: RouteApi = {
	endpoint: 'termdb/dmrSurvival',
	methods: {
		get: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload,
		post: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload
	}
}

/** Each region is one CpG-shard read, run in sequence; this bounds a request to a few minutes. */
const MAX_REGIONS = 500

type Region = { id: string; chr: string; start: number; stop: number; gene?: string }

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q = req.query
			const ds = genomes[q.genome]?.datasets?.[q.dslabel]
			if (!ds) throw new Error('unknown genome or dataset')
			const regions: Region[] = q.regions
			if (!Array.isArray(regions) || !regions.length) throw new Error('No regions supplied.')
			if (regions.length > MAX_REGIONS)
				throw new Error(`Too many regions (${regions.length}). Maximum is ${MAX_REGIONS}.`)
			if (!q.survTw?.term) throw new Error('survTw missing')
			if (q.samplelst?.groups?.length != 2) throw new Error('Two sample groups are required.')
			const t0 = Date.now()

			// the patients the methylation was measured on, as the scan compared them
			const samplelst = await matchedSamplelst(q.samplelst, eligibleMethylationSamples(ds, undefined), ds)
			const groupOf = new Map<string, string>()
			for (const g of samplelst.groups) for (const v of g.values) groupOf.set(String(v.sampleId), g.name)

			const covTws: any[] = q.covariateTws || []
			const methTws = regions.map((r, i) => ({
				$id: `meth${i}`,
				term: { type: 'dnaMethylation', chr: r.chr, start: r.start, stop: r.stop, name: r.id },
				q: { mode: 'continuous' }
			}))
			const genes = [...new Set(regions.map(r => r.gene).filter(Boolean))] as string[]
			const geneTws = ds.queries?.geneExpression
				? genes.map((gene, i) => ({
						$id: `gene${i}`,
						term: { type: 'geneExpression', gene, name: gene },
						q: { mode: 'continuous' }
				  }))
				: []

			const data = await getData(
				{
					terms: [q.survTw, ...covTws, ...methTws],
					filter: q.filter,
					filter0: q.filter0,
					__protected__: q.__protected__
				},
				ds
			)
			if (data.error) throw data.error
			/* Expression straight from the getter, all genes in one read. Through getData() each gene
			is its own call, and the getter throws when a call finds no data, so one symbol missing
			from the expression matrix (an antisense RNA, say) failed the whole screen. */
			if (geneTws.length) {
				const ge = await ds.queries.geneExpression
					.get({ terms: geneTws, filter: q.filter, filter0: q.filter0, __protected__: q.__protected__ }, ds)
					.catch(() => null)
				for (const [id, s2v] of ge?.term2sample2value || []) {
					for (const sid in s2v) if (data.samples[sid]) data.samples[sid][id] = { value: s2v[sid] }
				}
			}

			// keyed by the sample id getData() filed each sample under, which is what the groups hold
			const usable = Object.entries(data.samples as Record<string, any>)
				.filter(([sid, s]) => {
					const sv = s[q.survTw.$id]
					return groupOf.has(sid) && sv && Number.isFinite(sv.value) && sv.value >= 0
				})
				.map(([sid, s]) => ({ ...s, sid, name: ds.cohort.termdb.q.id2sampleName?.(Number(sid)) ?? sid }))
			/* One row per patient. Survival is the patient's, so a patient with a relapse or blood sample
			beside the diagnostic one would otherwise enter the model twice (21 of 315 in MMRF's t(4;14)
			groups). The kept sample is the first by name, which on MMRF's naming is the diagnostic
			marrow one (_1_BM sorts before _1_PB and _2_BM).
			ponytail: case from the GDC-style 'cases.case_id' ref only; a dataset with another sample
			ancestry scheme keeps every sample, as before. */
			const byCase = new Map<string, any>()
			for (const s of usable) {
				const c = ds.cohort.termdb.q.id2sampleRefs?.(s.sid)?.['cases.case_id'] ?? s.sid
				const kept = byCase.get(c)
				if (!kept || String(s.name) < String(kept.name)) byCase.set(c, s)
			}
			const rows = [...byCase.values()]
			if (rows.length < 10) throw new Error(`Only ${rows.length} patients have both survival and group membership.`)

			const covariates = {}
			for (const tw of covTws) {
				const vals = rows.map(s => s[tw.$id]?.value ?? s[tw.$id]?.key ?? null)
				// categorical values arrive as keys; mixing kinds would make R read numbers as a factor
				covariates[tw.term.name || tw.$id] = vals.every(v => v === null || typeof v == 'number')
					? vals
					: vals.map(v => (v === null ? null : String(v)))
			}
			const input = (tws: any[]) => ({
				time: rows.map(s => s[q.survTw.$id].value),
				status: rows.map(s => Number(s[q.survTw.$id].key)),
				group: rows.map(s => groupOf.get(s.sid)),
				covariates,
				features: tws.map(tw => ({ id: tw.$id, values: rows.map(s => s[tw.$id]?.value ?? null) }))
			})
			const byId = (out: any[]) => new Map(out.map(r => [r.id, r]))
			const meth = byId(JSON.parse(await run_R('dmrSurvival.R', JSON.stringify(input(methTws)))))
			const expr = geneTws.length
				? byId(JSON.parse(await run_R('dmrSurvival.R', JSON.stringify(input(geneTws)))))
				: new Map()
			const exprOfGene = new Map(geneTws.map(tw => [tw.term.gene, expr.get(tw.$id)]))

			const results = regions.map((r, i) => {
				const fit = meth.get(`meth${i}`) || {}
				const e = r.gene ? exprOfGene.get(r.gene) : undefined
				return {
					...fit, // the region's own id wins over the R row id
					...r,
					expression: e?.hr
						? { hr: e.hr, p: e.p, q: e.q, n: e.n, pInteraction: e.pInteraction, kmP: e.kmP, hrByGroup: e.hrByGroup }
						: undefined
				}
			})
			results.sort((a: any, b: any) => (a.p ?? 2) - (b.p ?? 2))

			mayLog(`dmrSurvival: ${regions.length} regions, ${genes.length} genes,`, formatElapsedTime(Date.now() - t0))
			res.send({
				status: 'ok',
				patients: rows.length,
				/** further samples of a patient already in the model, left out */
				samplesDropped: usable.length - rows.length,
				events: rows.filter(s => Number(s[q.survTw.$id].key) == 1).length,
				groups: samplelst.groups.map(g => ({
					name: g.name,
					n: rows.filter(s => groupOf.get(s.sid) == g.name).length
				})),
				covariates: covTws.map(tw => tw.term.name || tw.$id),
				results
			})
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			res.send({ error: msg })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}
