import tape from 'tape'
import { dmrScanToRows, summarizeProfile, coarsenProfile } from '#src/utils/dmrScanRows.ts'

/*
test sections:

uncorrected: CpG floor, one p per row, direction split, widths, gene-body loss set
corrected: unscored DMRs leave the rows but stay counted; the correction adds a p gate to the set
summarizeProfile: quantiles and moved-fraction of the genome-wide binned profile
coarsenProfile: probe-weighted re-binning for display
*/

/** The scan reaches the volcano only through this mapping, so a mistake here is a wrong figure
 * with nothing to flag it: a DMR counted in the caption but missing from the plot, or a gene in the
 * expression test that only clipped a promoter. */

const dmr = (o: Partial<any>) => ({
	chr: 'chr1',
	start: 1000,
	stop: 2000,
	no_cpgs: 10,
	min_smoothed_fdr: 1e-10,
	HMFDR: 1e-300,
	maxdiff: 0.3,
	meandiff: 0.2,
	direction: 'hyper',
	...o
})

const payload = (dmrs: any[], extra: any = {}) =>
	({
		status: 'ok',
		regions: [
			{ chr: 'chr1', start: 0, stop: 20e6, members: [0], n_probes: 1, n_sig_probes: 1, dmrs, elementResolution: false }
		],
		chromosomes: 1,
		totalProbesAnalyzed: 12345,
		...extra
	} as any)

const opts = { chromosomes: ['chr1'] }

tape('\n', t => {
	t.comment('-***- dmrScanRows specs -***-')
	t.end()
})

tape('uncorrected scan: CpG floor, one p per row, summary counts', t => {
	const p = payload([
		dmr({ start: 0, stop: 500, no_cpgs: 2 }), // below the floor
		dmr({ start: 1000, stop: 2000, genes: ['A', 'B'] }),
		dmr({ start: 10_000_000, stop: 10_005_000 }),
		dmr({
			start: 15_000_000,
			stop: 15_003_000,
			meandiff: -0.1,
			maxdiff: -0.2,
			direction: 'hypo',
			inGeneBody: true,
			genes: ['LOSS']
		})
	])
	const { rows, scan } = dmrScanToRows(p, opts)
	t.equal(scan.called, 4, 'every called DMR is counted')
	t.equal(scan.kept, 3, 'the 2-CpG call is dropped at the default floor of 5')
	t.equal(rows.length, 3, 'and is not a row')
	t.deepEqual([scan.hyper, scan.hypo], [2, 1], 'direction split is over kept DMRs')
	t.equal(rows[0].promoter_id, 'chr1:1000-2000', 'the row key is the coordinate')
	t.equal(rows[0].gene_name, 'A, B', 'genes are joined for the Gene(s) column')
	t.equal(rows[0].delta_beta, 0.2, 'x is the mean delta-beta')
	t.equal(rows[0].fold_change, 0.3, 'fold_change carries the peak delta-beta, same sign')
	t.equal(rows[0].original_p_value, 1e-10, 'p is the smoothed FDR')
	t.equal(rows[0].adjusted_p_value, 1e-10, 'and is the same under either p-value type')
	t.deepEqual(scan.width, { median: 3000, q1: 1000, q3: 3000 }, 'width quantiles over kept DMRs')
	t.equal(scan.resources, undefined, 'a result computed before cost accounting carries no resources')
	const res = {
		workers: 2,
		threadsPerWorker: 1,
		wallMs: 1,
		peakWorkerMemoryMb: 1,
		peakPoolMemoryMb: 2,
		workerCpuSeconds: 1,
		nodeRssDeltaMb: 0,
		nodeCpuSeconds: 0,
		perChromosome: []
	}
	t.equal(
		dmrScanToRows(payload([], { resources: res }), opts).scan.resources,
		res,
		'and one with them passes them through to the panel'
	)
	t.equal(scan.backgroundCorrection, undefined, 'no correction block without the correction')
	/* The gene-body loss set does not depend on the correction: without one, a DMR's own smoothed
	FDR is the evidence, and the expression test is offered on that. Gating it on the correction
	made the uncorrected scan the only reading you could not follow up. */
	t.deepEqual(
		scan.geneBodyLoss,
		{ regions: 1, genes: ['LOSS'] },
		'the gene set comes from the hypo, in-body DMR with no background p'
	)
	t.equal(
		dmrScanToRows(payload([dmr({ direction: 'hypo', inGeneBody: false, genes: ['PROMOTER_ONLY'] })]), opts).scan
			.geneBodyLoss,
		undefined,
		'and is omitted rather than reported as empty when nothing qualifies'
	)
	t.end()
})

tape('corrected scan: unscored DMRs are counted but not plotted; gene-body loss set is gated', t => {
	const p = payload(
		[
			// scored, beats background, in a gene body, hypo -> in the gene set
			dmr({
				start: 1000,
				stop: 2000,
				direction: 'hypo',
				meandiff: -0.2,
				bgP: 0.01,
				excess: -0.15,
				inGeneBody: true,
				genes: ['LOSS']
			}),
			// hypo, beats background, but only clips a promoter -> not in the set
			dmr({ start: 3000, stop: 4000, direction: 'hypo', meandiff: -0.2, bgP: 0.01, genes: ['PROMOTER_ONLY'] }),
			// hyper in a gene body -> not a loss
			dmr({ start: 5000, stop: 6000, bgP: 0.01, inGeneBody: true, genes: ['GAIN'] }),
			// hypo in a gene body but not significant
			dmr({ start: 7000, stop: 8000, direction: 'hypo', meandiff: -0.2, bgP: 0.4, inGeneBody: true, genes: ['NS'] }),
			// unscored: no bgP
			dmr({ start: 9000, stop: 60000, no_cpgs: 900 })
		],
		{
			backgroundCorrection: {
				windows: 2000,
				scored: 4,
				unscored: 1,
				significant: 3,
				matchedOn: ['CpG density', 'width']
			}
		}
	)
	const { rows, scan } = dmrScanToRows(p, { ...opts, backgroundCorrection: true })
	t.equal(scan.kept, 5, 'the unscored DMR is still a kept DMR')
	t.equal(rows.length, 4, 'but has no p to plot, so it is not a row')
	t.deepEqual(
		scan.backgroundCorrection,
		{ windows: 2000, matchedOn: ['CpG density', 'width'], scored: 4, unscored: 1, significant: 3 },
		'scored / unscored / significant are counted over kept DMRs'
	)
	t.equal(rows[0].original_p_value, 0.01, 'p is now the background p')
	t.equal(rows[0].excess, -0.15, 'and the excess rides along for the table')
	t.deepEqual(
		scan.geneBodyLoss,
		{ regions: 1, genes: ['LOSS'] },
		'only the hypo, in-body, significant region contributes genes'
	)
	t.end()
})

tape('summarizeProfile reports how much of the measured methylome moved', t => {
	/* The number a reader quotes from the profile figure. It exists because a DMR count does not
	answer it: a cohort that drifted a little everywhere produces a huge DMR count, and the
	fraction of bins that actually moved is what separates that from real, concentrated change. */
	const bin = (control: number, caseV: number) => ({ chr: 'chr1', start: 0, n_probes: 10, control, case: caseV })
	// nine bins: deltas -0.2 -0.1 -0.04 -0.01 0 +0.01 +0.04 +0.1 +0.2
	const deltas = [-0.2, -0.1, -0.04, -0.01, 0, 0.01, 0.04, 0.1, 0.2]
	const pf = summarizeProfile({ binBp: 100000, bins: deltas.map(d => bin(0.5, 0.5 + d)) })!
	t.equal(pf.bins, 9, 'every bin is counted, including the ones that did not move')
	t.ok(Math.abs(pf.median) < 1e-9, 'the median is the middle bin, not the mean of the extremes')
	t.ok(Math.abs(pf.q1 + 0.04) < 1e-9 && Math.abs(pf.q3 - 0.04) < 1e-9, 'quartiles bracket the bulk')
	// strictly beyond: the two at exactly 0.1 do not count, the two at 0.2 do
	t.ok(Math.abs(pf.fractionBeyond10 - 2 / 9) < 1e-9, '|delta| > 0.10 is a strict threshold')
	t.ok(Math.abs(pf.fractionBeyond05 - 4 / 9) < 1e-9, 'and so is |delta| > 0.05')
	t.ok(Math.abs(pf.fractionHyper - 4 / 9) < 1e-9, 'a bin at exactly zero is not counted as hyper')
	t.equal(summarizeProfile({ binBp: 100000, bins: [] }), undefined, 'no bins is no summary, not a zero')
	t.end()
})

tape('coarsenProfile averages bins for display, weighted by the probes under them', t => {
	/* The figure is unreadable at the native width (29,000 dots over 1,000 px), so a reader can
	draw it coarser. The averaging has to be probe-weighted: a bin resting on 3 CpGs and one resting
	on 3,000 are not two equal measurements, and a plain mean of bin means would let a sparse bin at
	a centromere edge pull a megabase's value around. */
	const bm = {
		binBp: 100_000,
		// two bins in the same 1 Mb, wildly different probe counts
		bins: [
			{ chr: 'chr1', start: 0, n_probes: 100, control: 0.8, case: 0.9 },
			{ chr: 'chr1', start: 100_000, n_probes: 900, control: 0.4, case: 0.4 },
			// a third in the NEXT megabase, and one on another chromosome at the same offset
			{ chr: 'chr1', start: 1_000_000, n_probes: 10, control: 0.5, case: 0.7 },
			{ chr: 'chr2', start: 0, n_probes: 50, control: 0.2, case: 0.3 }
		]
	}
	const wide = coarsenProfile(bm, 1_000_000)
	t.equal(wide.binBp, 1_000_000, 'the reported width is the one drawn')
	t.equal(wide.bins.length, 3, 'bins merge within a chromosome and a window, never across either')
	const first = wide.bins[0]
	t.equal(first.n_probes, 1000, 'probe counts add')
	t.equal(first.control, (0.8 * 100 + 0.4 * 900) / 1000, 'control is the probe-weighted mean, not the bin mean')
	t.equal(first.case, (0.9 * 100 + 0.4 * 900) / 1000, 'and so is case')
	t.notEqual(first.control, 0.6, 'a plain mean of the two bin means would have said 0.6')
	t.deepEqual(
		wide.bins.map(b => `${b.chr}:${b.start}`),
		['chr1:0', 'chr1:1000000', 'chr2:0'],
		'each wide bin is keyed by chromosome and window start'
	)
	/* The native width and anything at or below it must pass through untouched -- the default asks
	for exactly the width the bins are already at, and that must not re-bin or re-average. */
	t.equal(coarsenProfile(bm, 100_000), bm, 'the native width returns the same object')
	t.equal(coarsenProfile(bm, 50_000), bm, 'so does a narrower request: there is nothing to split')
	t.equal(coarsenProfile(bm, undefined), bm, 'and an absent width')
	t.equal(coarsenProfile(bm, NaN), bm, 'and a nonsense one')
	// bounded, so a hostile width cannot ask for one dot per genome
	t.equal(coarsenProfile(bm, 1e12).binBp, 100_000 * 100, 'the factor is capped at 100x the native width')
	t.end()
})
