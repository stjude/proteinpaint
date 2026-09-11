import tape from 'tape'
import { dmrScanToRows } from '#src/utils/dmrScanRows.ts'

/*
test sections:

uncorrected: CpG floor, one p per row, direction split, widths, bins
corrected: unscored DMRs leave the rows but stay counted; gene-body loss set gates on body+direction+p
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

const opts = { chromosomes: ['chr1'], lens: { chr1: 20e6 } }

tape('\n', t => {
	t.comment('-***- dmrScanRows specs -***-')
	t.end()
})

tape('uncorrected scan: CpG floor, one p per row, summary counts', t => {
	const p = payload([
		dmr({ start: 0, stop: 500, no_cpgs: 2 }), // below the floor
		dmr({ start: 1000, stop: 2000, genes: ['A', 'B'] }),
		dmr({ start: 10_000_000, stop: 10_005_000 }),
		dmr({ start: 15_000_000, stop: 15_003_000, meandiff: -0.1, maxdiff: -0.2, direction: 'hypo' })
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
	t.equal(scan.domainMap.binBp, 1e6, 'a 20 Mb genome bins at the 1 Mb floor')
	t.deepEqual(scan.domainMap.bins.chr1[0], [1, 0], 'the 1 kb DMR lands in the first bin')
	t.deepEqual(scan.domainMap.bins.chr1[10], [1, 0], 'the 10 Mb one in bin 10')
	t.equal(scan.domainMap.subject, 'all DMRs', 'uncorrected, the map bins every kept DMR')
	t.deepEqual(scan.domainMap.bins.chr1[15], [0, 1], 'the hypo DMR in bin 15')
	t.equal(scan.backgroundCorrection, undefined, 'no correction block without the correction')
	t.equal(scan.geneBodyLoss, undefined, 'and no gene set')
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
	/* The corrected map bins only the survivors: the two non-significant / unscored DMRs (bins 7
	and 9) must be absent, or the map would be the drift map with a different title. */
	t.equal(scan.domainMap.subject, 'DMRs beating matched background (p < 0.05)', 'corrected map names its subject')
	t.deepEqual(scan.domainMap.bins.chr1[0], [1, 2], 'bin 0 holds the three DMRs beating background')
	t.equal(
		scan.domainMap.bins.chr1.reduce((n, b) => n + b[0] + b[1], 0),
		3,
		'and nothing else: the non-significant and unscored DMRs are not on the corrected map'
	)
	t.deepEqual(
		scan.geneBodyLoss,
		{ regions: 1, genes: ['LOSS'] },
		'only the hypo, in-body, significant region contributes genes'
	)
	t.end()
})
