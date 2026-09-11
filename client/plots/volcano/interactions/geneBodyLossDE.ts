import { dofetch3 } from '#common/dofetch'
import { renderTable, sayerror } from '#dom'
import { bplen } from '#shared/common.js'
import { getGroupColors } from '../colors'
import { HYPO_COLOR } from '../../dmr/settings/defaults'
import type { DmrScanSummary } from '#types'
import { getDefaultVolcanoSettings } from '../settings/defaults'

/* Do the genes losing gene-body methylation also lose expression?

Gene-body methylation tracks transcription, so a scan finding loss concentrated in gene bodies
predicts those genes are expressed lower in the same patients. This is the first question in the
volcano that reaches function rather than another methylation-adjacent annotation, and it is
answerable here because the two groups that defined the scan also define the expression contrast.

The gene set comes from the server with the scan (DmrScanSummary.geneBodyLoss): hypomethylated
DMRs beating matched background and overlapping a gene BODY -- a region clipping only a promoter
relates to transcription the other way round. The test itself is termdb/dmrGeneDE, which compares
hit genes to non-hits within gene-length strata; see that route for why length matching is the
test and not a caveat. */
export async function geneBodyLossTest(
	/** the volcano's actions menu; rendered into and hidden when a plot is launched from it */
	tip: any,
	config: any,
	vocab: { genome: string; dslabel: string },
	scan: DmrScanSummary,
	app: any
) {
	const gb = scan.geneBodyLoss!
	const holder = tip.d
	const groups = config?.samplelst?.groups
	if (!groups || groups.length != 2) {
		sayerror(holder.append('div'), 'Two sample groups are required.')
		return
	}
	const div = holder.append('div').style('padding', '10px').style('max-width', '900px')
	const wait = div.append('div').style('color', '#777').text('Running differential expression…')
	/* The same DE the volcano launched below will run: same method, count filters, CPM cutoff and
	cohort filter. Left to the route's defaults the test picked its engine from group size and got
	Wilcoxon while the volcano ran edgeR, so the fold changes behind the length-matched difference
	and the dots on the plot came from different methods. Aligned, the two share one cached run. */
	const de = getDefaultVolcanoSettings({}, { termType: 'geneExpression' }) as any
	try {
		const res: any = await dofetch3('termdb/dmrGeneDE', {
			body: {
				genome: vocab.genome,
				dslabel: vocab.dslabel,
				// `in` is part of the DE cache key, so it must travel or the two runs get separate entries
				samplelst: { groups: groups.map((g: any) => ({ name: g.name, in: g.in, values: g.values })) },
				genes: gb.genes,
				method: de.method,
				min_count: de.minCount,
				min_total_count: de.minTotalCount,
				cpm_cutoff: de.cpmCutoff,
				filter: app.getState().termfilter?.filter,
				filter0: app.getState().termfilter?.filter0
			}
		})
		wait.remove()
		if (res?.error) {
			sayerror(div.append('div'), res.error)
			return
		}
		renderGeneDE(div, res, gb.regions, config, scan, app, tip)
	} catch (e: any) {
		wait.remove()
		sayerror(div.append('div'), e?.message || String(e))
	}
}

function renderGeneDE(div: any, res: any, nRegions: number, config: any, scan: DmrScanSummary, app: any, tip: any) {
	const gb = scan.geneBodyLoss!
	/* The DE volcano runs on the patients the methylation was measured on, not on everyone with RNA:
	the server did the same for the test above, so the two agree on who was compared, and a
	difference between the methylation and expression readings cannot be the extra patients. */
	const samplelst = scan.matchedSamplelst || config.samplelst
	const nMatched = samplelst.groups.reduce((n: number, g: any) => n + g.values.length, 0)
	const dir = res.weightedDiff < 0 ? 'lower' : 'higher'
	/* The same contrast as a differential-expression volcano, with the gene-body loss genes
	highlighted. The stratified difference below is the test; the volcano is where a reader sees the
	set against every other gene, and it is the existing DE plot on the same two groups, so nothing
	is drawn here that the volcano already draws. Highlighting applies to the significant dots the
	volcano returns, so hit genes that are not DE simply are not marked. */
	div
		.append('button')
		.attr('class', 'sja_menuoption')
		.attr('data-testid', 'sjpp-geneBodyLoss-deVolcano')
		.style('margin', '0 0 8px')
		.style('padding', '3px 6px')
		.text(
			`Open as differential expression volcano on the ${nMatched.toLocaleString()} samples with methylation, ` +
				`${gb.genes.length.toLocaleString()} genes highlighted`
		)
		.on('click', () => {
			tip.hide()
			app.dispatch({
				type: 'plot_create',
				config: structuredClone({
					chartType: 'differentialAnalysis',
					termType: 'geneExpression',
					state: config.state,
					samplelst,
					tw: config.tw,
					highlightedData: gb.genes,
					/* The default highlight is orange-yellow, which on a case group drawn in orange makes
					the highlighted hits and the up-regulated genes one blob. Use the colour the
					methylation figures give to LOSS instead: these genes are highlighted because they
					lost gene-body methylation, so the fill says the same thing there and here. */
					settings: { volcano: { defaultHighlightColor: HYPO_COLOR } }
				})
			})
		})
	div
		.append('div')
		.style('font-weight', 'bold')
		.style('padding', '4px 0')
		.text(
			`Genes under a surviving gene-body loss region are expressed ${dir} in the case group: ` +
				`${res.weightedDiff >= 0 ? '+' : ''}${res.weightedDiff.toFixed(3)} log₂ fold change ` +
				`within matched gene length (p = ${res.p < 0.001 ? res.p.toExponential(1) : res.p.toFixed(4)}).`
		)
	/* Length matching is the test, not a caveat: the most frequently hit genes are the longest, and
	long genes move differently for reasons unrelated to methylation. So the comparison is made
	inside length strata and the null permutes labels within them. */
	div
		.append('div')
		.style('color', '#777')
		.style('font-size', '.92em')
		.text(
			`${nRegions.toLocaleString()} regions → ${res.genesRequested.toLocaleString()} genes; ` +
				`${res.nHit.toLocaleString()} compared against ${res.nOther.toLocaleString()} genes of matched length ` +
				`across ${res.strata.length} strata. ${res.genesNotInDE.toLocaleString()} were not tested by DE ` +
				`(low count or absent from the expression matrix) and ${res.unmatchedHits.toLocaleString()} fell in ` +
				`strata too thin to match. Comparing hits to all other genes instead would recover gene length.`
		)
	/* The individual genes. The stratified difference above says the SET moves; this says which
	members did, using DE's own p rather than the permutation p, which is a property of the set and
	not of any gene in it. */
	if (res.sigCount) {
		div
			.append('div')
			.style('padding', '8px 0 2px')
			.style('font-weight', 'bold')
			.text(
				`${res.sigCount.toLocaleString()} of these genes are differentially expressed on their own ` +
					`(p < 0.05), ${res.sigDown.toLocaleString()} of them down.`
			)
		/* Bars rather than numbers. Length on a log axis: the set runs from 4 kb to 2 Mb, so a
		linear bar would draw every gene under 100 kb as a sliver. Fold change coloured by the group
		it favours, the same two colours the volcano paints its dots with. */
		const { caseColor, controlColor } = getGroupColors(config)
		renderTable({
			div: div.append('div'),
			columns: [
				{ label: 'Gene' },
				{ label: 'Length (log₁₀ bp)', barplot: { axisWidth: 90, colorPositive: '#999', tickCount: 3 } },
				{ label: 'log₂FC', barplot: { axisWidth: 110, colorNegative: controlColor, colorPositive: caseColor } },
				{ label: res.topGenes[0]?.adjusted ? 'Adjusted p' : 'p', align: 'right' }
			],
			rows: res.topGenes.map((g: any) => [
				{ value: g.gene },
				{ value: g.len ? Number(Math.log10(g.len).toFixed(2)) : NaN },
				{ value: Number(g.fc.toFixed(3)) },
				{ value: Number(g.p.toPrecision(2)) }
			]),
			showLines: true,
			maxHeight: '26vh',
			download: { fileName: 'gene-body-loss-genes.tsv' }
		})
		if (res.sigCount > res.topGenes.length)
			div
				.append('div')
				.style('color', '#777')
				.style('font-size', '.9em')
				.text(`Showing the ${res.topGenes.length} most significant of ${res.sigCount.toLocaleString()}.`)
	}
	div.append('div').style('padding', '10px 0 2px').style('font-weight', 'bold').text('By gene length')
	renderTable({
		div: div.append('div'),
		columns: [
			{ label: 'Gene length' },
			{ label: 'Genes hit', align: 'right' },
			{ label: 'Matched', align: 'right' },
			{ label: 'Median log₂FC, hit', align: 'right' },
			{ label: 'Median log₂FC, matched', align: 'right' },
			{ label: 'Difference', align: 'right' }
		],
		rows: res.strata.map((s: any) => [
			{ value: `${bplen(s.lenFrom)} – ${bplen(s.lenTo)}` },
			{ value: s.nHit.toLocaleString() },
			{ value: s.nOther.toLocaleString() },
			{ value: Number(s.medianHit.toFixed(3)) },
			{ value: Number(s.medianOther.toFixed(3)) },
			{ value: Number(s.diff.toFixed(3)) }
		]),
		showLines: true,
		maxHeight: '26vh',
		download: { fileName: 'gene-body-loss-expression.tsv' }
	})
}
