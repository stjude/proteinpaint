import type { RoutePayload, RouteApi } from '#types'
import fs from 'fs'
import path from 'path'
import serverconfig from '../serverconfig.js'
import { matchedSamplelst, eligibleMethylationSamples } from '#src/utils/methylationMatrix.ts'

/* Per-patient promoter silencing: genes whose normally unmethylated promoter is methylated in a few
patients, with expression lost in exactly those patients.

A group comparison averages such events away, so this is not computed from the volcano's groups: the
screen is precomputed over the whole cohort (the dataset's dnaMethylation.silencingScreen file, built
offline) and served here. When the volcano's two groups are sent along, each row also says how many
silenced patients fall in each group, which is where a genotype link shows (NSD2-driven silencing sits
in t(4;14)). */

export const api: RouteApi = {
	endpoint: 'termdb/dmrSilencing',
	methods: {
		get: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload,
		post: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload
	}
}

const NUMERIC = new Set(['start', 'n_outliers', 'outlier_frac', 'median_beta_rest', 'median_beta_outliers'])
for (const k of ['expr_rest', 'expr_outliers', 'effect', 'silenced_frac', 'p', 'q']) NUMERIC.add(k)

/** parsed screen per file path; the file is a build artifact, so it is read once per process */
const screens = new Map<string, any[]>()

function readScreen(file: string) {
	let rows = screens.get(file)
	if (rows) return rows
	const lines = fs.readFileSync(file, 'utf8').trim().split('\n')
	const header = lines[0].split('\t')
	rows = lines.slice(1).map(line => {
		const cells = line.split('\t')
		const r: any = {}
		header.forEach((h, i) => (r[h] = NUMERIC.has(h) ? Number(cells[i]) : cells[i]))
		r.outlier_patients = r.outlier_patients ? r.outlier_patients.split(',') : []
		return r
	})
	screens.set(file, rows)
	return rows
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q = req.query
			const ds = genomes[q.genome]?.datasets?.[q.dslabel]
			if (!ds) throw new Error('unknown genome or dataset')
			const cfg = ds.queries?.dnaMethylation?.silencingScreen
			if (!cfg?.file) throw new Error('This dataset has no promoter silencing screen.')
			const rows = readScreen(path.join(serverconfig.tpmasterdir, cfg.file))
			const maxQ = Number.isFinite(Number(q.maxQ)) ? Number(q.maxQ) : 0.2
			const hits = rows.filter(r => r.q <= maxQ)

			let groups: { name: string; n: number; ids: Set<string> }[] | undefined
			if (q.samplelst?.groups?.length == 2) {
				const matched = await matchedSamplelst(q.samplelst, eligibleMethylationSamples(ds, undefined), ds)
				groups = matched.groups.map(g => ({
					name: g.name,
					n: g.values.length,
					ids: new Set(g.values.map(v => String(v.sampleId)))
				}))
			}
			const idOf = (name: string) => String(ds.cohort?.termdb?.q?.sampleName2id?.(name) ?? name)

			res.send({
				status: 'ok',
				genesTested: rows.length,
				maxQ,
				groups: groups?.map(g => ({ name: g.name, n: g.n })),
				rows: hits.map(({ outlier_patients, ...r }) => ({
					...r,
					inGroups: groups?.map(g => outlier_patients.filter(n => g.ids.has(idOf(n))).length)
				}))
			})
		} catch (e: any) {
			res.send({ error: e?.message || String(e) })
		}
	}
}
