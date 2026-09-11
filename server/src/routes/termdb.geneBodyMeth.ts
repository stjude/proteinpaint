import type { RouteApi, RoutePayload } from '#types'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import serverconfig from '#src/serverconfig.js'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { resolveMethylationMatrix, resolveGroupNames, matchedSamplelst } from '#src/utils/methylationMatrix.ts'
import { getDeCacheResult } from '#src/routes/termdb.DE.ts'
import { GENE_BODY_PAD } from '#src/utils/dmrGenes.ts'
import { cacheOrRecompute } from '#src/utils/cacheOrRecompute.ts'
import { fingerprint } from '#src/routes/termdb.dmrBatch.ts'
import { buildGeneIndex } from '#src/utils/dmrGenes.ts'
import {
	buildExclusion,
	sampleBackground,
	scoreAgainstBackground,
	BG_WINDOWS_PER_CHR
} from '#src/utils/dmrBackground.ts'

/* Is gene-body methylation loss a cause of reduced transcription, or a footprint of it?

Gene-body methylation is laid down BY transcription: Pol II carries SETD2, which deposits H3K36me3
across the body of a gene as it is transcribed, and DNMT3B reads that mark and methylates the DNA.
So a gene transcribed less loses gene-body methylation for that reason alone, and a correlation
between the two is expected under a model where methylation does nothing at all.

The discriminating question is what happens to genes whose expression did NOT change. Under the
footprint model their gene-body methylation should not move either. If it moves anyway, something
other than transcription is putting it there.

So: measure delta-beta over EVERY gene body -- not only the ones a scan called -- bin genes by
their expression fold change, and report the methylation change per bin. The readout is the value
at fold change zero.

Cheap because the fit already carries both group means per probe: gene bodies go in as
background_regions, which returns a plain delta and skips smoothing and segmentation entirely. */

export const api: RouteApi = {
	endpoint: 'termdb/geneBodyMeth',
	methods: {
		get: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload,
		post: { init, request: { typeId: undefined }, response: { typeId: undefined } } as any as RoutePayload
	}
}

/** Expression bins, in log2 fold change. Narrow around zero because that is where the test lives. */
const FC_EDGES = [-Infinity, -1, -0.5, -0.25, -0.1, 0.1, 0.25, 0.5, 1, Infinity]

/** A bin holding fewer genes than this is reported but not read: its median is noise. */
const MIN_PER_BIN = 30

function median(v: number[]): number {
	if (!v.length) return NaN
	const s = [...v].sort((a, b) => a - b)
	const m = s.length >> 1
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q = req.query
			const genome = genomes[q.genome]
			if (!genome) throw 'unknown genome'
			const ds = genome.datasets?.[q.dslabel]
			if (!ds) throw 'unknown ds'
			if (!q.samplelst?.groups?.length) throw new Error('Two sample groups are required.')
			if (!Array.isArray(q.group1) || !Array.isArray(q.group2)) throw new Error('group1 and group2 are required.')
			const t0 = Date.now()

			const deltaOf = new Map(Object.entries(await getGeneBodyDeltas(q, genomes)))

			// expression on the same patients the methylation was measured on; see matchedSamplelst
			const { eligible } = resolveMethylationMatrix(ds, genome.majorchrorder?.[0] || 'chr1', q.element_type)
			const samplelst = await matchedSamplelst(q.samplelst, eligible, ds)
			const { result } = await getDeCacheResult(
				{
					genome: q.genome,
					dslabel: q.dslabel,
					samplelst,
					min_count: q.min_count ?? 10,
					min_total_count: q.min_total_count ?? 15,
					method: q.method
				} as any,
				genomes
			)
			const deRows: any[] = (result as any)?.geneRows || []
			const paired: { gene: string; fc: number; delta: number }[] = []
			for (const r of deRows) {
				const d = deltaOf.get(r.gene_name)
				if (d == null || !Number.isFinite(r.fold_change)) continue
				paired.push({ gene: r.gene_name, fc: r.fold_change, delta: d })
			}
			if (!paired.length) throw new Error('No gene had both a gene-body methylation value and a fold change.')

			const bins: any[] = []
			for (let i = 0; i < FC_EDGES.length - 1; i++) {
				const lo = FC_EDGES[i]
				const hi = FC_EDGES[i + 1]
				const g = paired.filter(x => x.fc >= lo && x.fc < hi)
				bins.push({
					fcFrom: lo === -Infinity ? null : lo,
					fcTo: hi === Infinity ? null : hi,
					n: g.length,
					medianDelta: median(g.map(x => x.delta)),
					medianFc: median(g.map(x => x.fc)),
					usable: g.length >= MIN_PER_BIN
				})
			}
			// the bin straddling zero: genes whose expression did not move
			const flat = paired.filter(x => x.fc >= -0.1 && x.fc < 0.1)
			mayLog(`geneBodyMeth: ${paired.length} genes paired,`, formatElapsedTime(Date.now() - t0))
			res.send({
				status: 'ok',
				genesPaired: paired.length,
				geneBodiesMeasured: deltaOf.size,
				bins,
				unchangedExpression: { n: flat.length, medianDelta: median(flat.map(x => x.delta)) },
				allGenes: { n: paired.length, medianDelta: median(paired.map(x => x.delta)) }
			})
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			res.send({ error: msg })
			if (e instanceof Error && e.stack) console.log(e)
		}
	}
}

/** Bump when a change here alters the deltas for an unchanged request. */
const CACHE_VERSION = 2 // 2: corrected mode added; raw entries carry corrected:false in the key

/* Mean delta-beta over every gene body, keyed by gene symbol -- one signed number per gene across
the whole genome. This is the gene-level reading of a methylation scan: a DMR list has many regions
per gene, none for half of them, and more for long genes, so it cannot rank genes; the body mean
can, and it is what the GSEA tab ranks on for a scan (see genesetEnrichment.ts).

`corrected` scores each gene body against width- and CpG-density-matched intergenic background --
the scan's own correction, pointed at fixed regions -- and returns the excess over that background
instead of the raw delta. Raw, the gain side of the ranking is led by silent, late-replicating gene
families (olfactory receptors, keratins), which is where genome-wide drift lives; the excess asks
whether a gene body moved more than a region like it drifted. Genes whose stratum holds too little
background are left out rather than scored badly.

Cached because it is ~33s of rust across 24 chromosomes and the same contrast asks for it from the
causality test and from GSEA. Keyed on the samples, the chromosomes and the files read, the same
way the scan cache is. */
export async function getGeneBodyDeltas(
	q: {
		genome: string
		dslabel: string
		group1: any[]
		group2: any[]
		chromosomes?: string[]
		element_type?: string
		corrected?: boolean
	},
	genomes: any
): Promise<Record<string, number>> {
	const genome = genomes[q.genome]
	if (!genome) throw new Error('unknown genome')
	const ds = genome.datasets?.[q.dslabel]
	if (!ds) throw new Error('unknown ds')
	if (!Array.isArray(q.group1) || !Array.isArray(q.group2)) throw new Error('group1 and group2 are required.')
	const chromosomes = q.chromosomes?.length ? [...q.chromosomes].sort() : null
	const matrixFiles = (chromosomes || Object.keys(genome.majorchr || {})).map(
		c => resolveMethylationMatrix(ds, c, q.element_type).matrixFile
	)
	const { result } = await cacheOrRecompute({
		computeArgument: {
			v: CACHE_VERSION,
			genome: q.genome,
			dslabel: q.dslabel,
			group1: q.group1.map(x => x.sampleId).sort(),
			group2: q.group2.map(x => x.sampleId).sort(),
			chromosomes,
			element_type: q.element_type ?? null,
			corrected: !!q.corrected,
			files: fingerprint([...new Set(matrixFiles)].concat(genome?.genedb?.dbfile))
		},
		cacheSubdir: 'geneBodyMeth',
		computeFresh: async () => computeGeneBodyDeltas(q, genome, ds)
	})
	return result as Record<string, number>
}

async function computeGeneBodyDeltas(q: any, genome: any, ds: any): Promise<Record<string, number>> {
	/* Gene bodies, trimmed at both ends exactly as the scan's inGeneBody flag trims them, so
	"gene body" means one thing across the two analyses. */
	const rows: any[] = genome?.genedb?.db?.prepare('select name, chr, start, stop from gene2coord').all() || []
	if (!rows.length) throw new Error('This genome has no gene2coord table.')
	const byChr = new Map<string, { name: string; start: number; stop: number }[]>()
	for (const r of rows) {
		const s = r.start + GENE_BODY_PAD
		const e = r.stop - GENE_BODY_PAD
		if (!(e > s)) continue // shorter than twice the pad: no body left
		const lst = byChr.get(r.chr) || []
		lst.push({ name: r.name, start: s, stop: e })
		byChr.set(r.chr, lst)
	}

	const chrs: string[] = (q.chromosomes?.length ? q.chromosomes : [...byChr.keys()]).filter((c: string) => byChr.has(c))
	const deltaOf: Record<string, number> = {}
	// the exclusion needs the gene index; built once, not per chromosome
	const geneIdx = q.corrected ? buildGeneIndex(genome) : null
	const CONCURRENCY = Math.max(1, Number(serverconfig.dmrBatchConcurrency) || 2)
	let next = 0
	await Promise.all(
		Array.from({ length: Math.min(CONCURRENCY, chrs.length) }, async () => {
			while (true) {
				const i = next++
				if (i >= chrs.length) return
				const chr = chrs[i]
				const bodies = byChr.get(chr)!
				const { matrixFile, mvalues, eligible } = resolveMethylationMatrix(ds, chr, q.element_type)
				const { group1, group2 } = await resolveGroupNames(q.group1, q.group2, eligible, ds)
				if (group1.length < 3 || group2.length < 3) throw new Error('Each group needs at least 3 samples.')
				/* Corrected: intergenic windows width-matched to the gene bodies ride along in the same
				rust call, after the bodies, so one fit serves both. Same sampler and seed rule as the
				scan, so the two corrections are the same correction. */
				let windows: { chr: string; start: number; stop: number }[] = []
				if (q.corrected) {
					const chrLen = genome.chrlookup?.[chr.toUpperCase()]?.len
					const excl = chrLen ? await buildExclusion(genome, chr, chrLen, geneIdx as any) : null
					if (!excl) throw new Error('This genome cannot supply an intergenic background (no cCRE track).')
					windows = sampleBackground(
						chr,
						chrLen,
						excl,
						bodies.map(b => b.stop - b.start),
						BG_WINDOWS_PER_CHR,
						[...chr].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0
					)
				}
				const out = JSON.parse(
					await run_rust(
						'dmrcate',
						JSON.stringify({
							probe_h5_file: matrixFile,
							mvalues,
							cachedir: serverconfig.cachedir,
							genome: q.genome,
							chr,
							start: 0,
							stop: 0,
							regions: [],
							background_regions: [...bodies.map(b => ({ chr, start: b.start, stop: b.stop })), ...windows],
							case: group2.join(','),
							control: group1.join(',')
						})
					)
				)
				if (out.error) throw new Error(`${chr}: ${out.error}`)
				const bg: any[] = out.background || []
				const bodyRes = bg.slice(0, bodies.length)
				if (!q.corrected) {
					bodyRes.forEach((b: any, j: number) => {
						/* A gene body with too few probes has an unstable mean; 5 matches the scan's own
						minimum CpG count so the two analyses agree on what is measurable. */
						if (b.delta != null && b.n_probes >= 5) deltaOf[bodies[j].name] = b.delta
					})
				} else {
					const measured = bodyRes
						.map((b: any, j: number) => ({ j, b }))
						.filter(({ b }) => b?.delta != null && b.n_probes >= 5)
					const { scored } = scoreAgainstBackground(
						measured.map(({ b }) => ({ no_cpgs: b.n_probes, start: b.start, stop: b.stop, meandiff: b.delta })),
						bg.slice(bodies.length)
					)
					measured.forEach(({ j }, k) => {
						const sc = scored[k]
						if (sc) deltaOf[bodies[j].name] = Math.round(sc.excess * 100000) / 100000
					})
				}
			}
		})
	)
	return deltaOf
}
