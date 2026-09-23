import { dofetch3 } from '#common/dofetch'
import { renderTable, sayerror } from '#dom'
import { fillTermWrapper } from '#termsetting'

/* Does methylation at the volcano's top regions predict survival, beyond the grouping?

Takes the top regions by methylation evidence (p, then effect size) -- chosen before survival is
looked at, so the list cannot be tuned to outcome -- and fits one Cox model per region on the server
(termdb/dmrSurvival): methylation as a rank-based normal score, the volcano's own covariates, the two
groups as strata. The strata are what keep this honest when the grouping is itself prognostic, as
t(4;14) is. A region's gene, when it has exactly one, gets the same model on expression.

The table is the result; a row's Survival button opens the per-group Kaplan-Meier curves for that
region, and the highlight buttons mark the hits on the volcano itself. The gene-link panel reuses
runSurvivalScreen() for its concordant, literature-supported genes. */

const TOP_N_CHOICES = [100, 200, 500]
const Q_CUTOFF = 0.1
/** Not HYPER/HYPO_COLOR: those already mean direction on this plot, and a survival hit can be either. */
const SURVIVAL_HIT_COLOR = '#7b3294'

/** A region to screen, in the volcano row's shape so a row can open its own survival plots. */
export type ScreenRegion = {
	promoter_id: string
	chr: string
	start: number
	stop: number
	gene_name?: string
}

export async function dmrSurvivalScreen(tip: any, config: any, rows: any[], interactions: any) {
	const holder = tip.d.append('div').style('padding', '10px').style('max-width', '1100px')
	const ranked = [...rows].sort(
		(a, b) =>
			(a.original_p_value ?? 1) - (b.original_p_value ?? 1) ||
			Math.abs(b.excess ?? b.delta_beta ?? 0) - Math.abs(a.excess ?? a.delta_beta ?? 0)
	)
	const controls = holder.append('div').style('margin-bottom', '8px')
	controls.append('span').text('Cox survival screen of the top ')
	const select = controls.append('select')
	for (const n of TOP_N_CHOICES.filter(n => n <= ranked.length).concat(ranked.length < 500 ? [ranked.length] : []))
		select.append('option').attr('value', n).text(n)
	controls.append('span').text(' regions, ranked by methylation p then effect size ')
	const out = holder.append('div')
	controls
		.append('button')
		.attr('data-testid', 'sjpp-dmrSurvival-run')
		.text('Run')
		.on('click', () =>
			runSurvivalScreen(out, config, ranked.slice(0, Number(select.property('value'))), interactions, tip, {
				highlight: true
			})
		)
}

/** Fit and render the screen for these regions into `out`. `highlight` offers marking hits on the
 * volcano, which only works when the regions ARE volcano rows; `extraColumn` adds one per-region
 * column, such as a PubMed count. */
export async function runSurvivalScreen(
	out: any,
	config: any,
	regions: ScreenRegion[],
	interactions: any,
	tip: any,
	opts: { highlight?: boolean; extraColumn?: { label: string; value: (r: ScreenRegion) => string | number } } = {}
) {
	const app = interactions.app
	out.selectAll('*').remove()
	const survDefault = app.vocabApi.termdbConfig?.defaultTw4correlationPlot?.survival
	if (!survDefault) return sayerror(out, 'This dataset names no default survival term.')
	const wait = out.append('div').style('color', '#777').text(`Fitting ${regions.length} Cox models…`)
	let res: any, survTw: any
	try {
		survTw = structuredClone(survDefault)
		await fillTermWrapper(survTw, app.vocabApi)
		res = await dofetch3('termdb/dmrSurvival', {
			body: {
				genome: app.vocabApi.vocab.genome,
				dslabel: app.vocabApi.vocab.dslabel,
				survTw,
				covariateTws: config.confounderTws || [],
				samplelst: config.samplelst,
				regions: regions.map(d => {
					const genes = (d.gene_name || '')
						.split(',')
						.map((s: string) => s.trim())
						.filter(Boolean)
					// a region naming several genes cannot say whose expression to test
					return {
						id: d.promoter_id,
						chr: d.chr,
						start: d.start,
						stop: d.stop,
						gene: genes.length == 1 ? genes[0] : undefined
					}
				}),
				filter: app.getState().termfilter?.filter,
				filter0: app.getState().termfilter?.filter0
			}
		})
	} catch (e: any) {
		res = { error: e?.message || String(e) }
	}
	wait.remove()
	if (res?.error) return sayerror(out.append('div'), res.error)

	const regionOf = new Map(regions.map(d => [d.promoter_id, d]))
	const [g1, g2] = res.groups
	const covs = res.covariates.length ? ` + ${res.covariates.join(' + ')}` : ''
	const qHits = res.results.filter((r: any) => r.q < Q_CUTOFF)
	const pHits = res.results.filter((r: any) => r.p < 0.05)
	const exprQ = res.results.filter((r: any) => r.expression?.q < Q_CUTOFF).length
	out
		.append('div')
		.style('font-weight', 'bold')
		.text(
			`${qHits.length} of ${res.results.length} regions predict ${survTw.term.name} at q < ${Q_CUTOFF} ` +
				`(${pHits.length} at unadjusted p < 0.05); ${exprQ} of their genes' expression does.`
		)
	out
		.append('div')
		.style('color', '#777')
		.style('font-size', '.92em')
		.style('padding-bottom', '6px')
		.text(
			`${res.patients} patients (${g1.name} ${g1.n}, ${g2.name} ${g2.n}), ${res.events} events. ` +
				`Model per region: ${survTw.term.name} ~ methylation${covs} + strata(group), so the grouping's own ` +
				`prognostic effect is not credited to methylation; expression goes through the same model. Values ` +
				`enter as rank-based normal scores, so HR is per SD and a few extreme values cannot set it. ` +
				`HR > 1: higher value, worse outcome. Interaction p tests whether the effect differs between the ` +
				`groups. KM p: log-rank within the group, split at the group's own median. q is Benjamini-Hochberg ` +
				`over the ${res.results.length} regions screened.`
		)
	if (opts.highlight) {
		for (const [hits, label] of [
			[qHits, `q < ${Q_CUTOFF}`],
			[pHits, 'unadjusted p < 0.05']
		] as const) {
			if (!hits.length) continue
			out
				.append('button')
				.attr('class', 'sja_menuoption')
				.style('margin', '0 6px 8px 0')
				.text(`Highlight the ${hits.length} regions with ${label} on the volcano`)
				.on('click', () => {
					tip.hide()
					app.dispatch({
						type: 'plot_edit',
						id: interactions.id,
						config: {
							highlightedData: hits.map((r: any) => r.id),
							settings: { volcano: { defaultHighlightColor: SURVIVAL_HIT_COLOR } }
						}
					})
				})
		}
	}

	const fmt = (v: any) => ({ value: Number.isFinite(v) ? Number(v.toPrecision(2)) : '' })
	// renderTable sorts the cell arrays in place, so a clicked row is looked up through them
	const regionOfRow = new Map<any[], ScreenRegion>()
	const rows = res.results.map((r: any) => {
		const region = regionOf.get(r.id)!
		const cells = [
			{ value: `${r.id} ${r.chr}:${r.start}-${r.stop}` },
			{ value: region.gene_name || '' },
			...(opts.extraColumn ? [{ value: opts.extraColumn.value(region) }] : []),
			{ value: `${r.n} / ${r.events}` },
			fmt(r.hr),
			{ value: Number.isFinite(r.lower) ? `${r.lower.toFixed(2)}–${r.upper.toFixed(2)}` : '' },
			fmt(r.p),
			fmt(r.q),
			fmt(r.pInteraction),
			fmt(r.kmP?.[g1.name]),
			fmt(r.kmP?.[g2.name]),
			fmt(r.expression?.hr),
			fmt(r.expression?.p),
			fmt(r.expression?.q),
			fmt(r.expression?.hrByGroup?.[g1.name]),
			fmt(r.expression?.hrByGroup?.[g2.name]),
			fmt(r.expression?.kmP?.[g1.name]),
			fmt(r.expression?.kmP?.[g2.name])
		]
		regionOfRow.set(cells, region)
		return cells
	})
	const right = (label: string) => ({ label, align: 'right', sortable: true })
	renderTable({
		div: out.append('div'),
		columns: [
			{ label: 'Region' },
			{ label: 'Gene' },
			...(opts.extraColumn ? [right(opts.extraColumn.label)] : []),
			{ label: 'n / events', align: 'right' },
			right('Methylation HR'),
			{ label: '95% CI', align: 'right' },
			right('p'),
			right('q'),
			right('Interaction p'),
			right(`KM p, ${g1.name}`),
			right(`KM p, ${g2.name}`),
			right('Expression HR'),
			right('Expression p'),
			right('Expression q'),
			right(`Expr. HR, ${g1.name}`),
			right(`Expr. HR, ${g2.name}`),
			right(`Expr. KM p, ${g1.name}`),
			right(`Expr. KM p, ${g2.name}`)
		] as any,
		rows,
		header: { allowSort: true },
		columnButtons: [
			{
				text: 'Survival',
				callback: (_e: any, i: number) => {
					const d = regionOfRow.get(rows[i])
					if (!d) return
					tip.hide()
					interactions.launchDNAMethSurvival(d)
				}
			}
		],
		showLines: true,
		maxHeight: '45vh',
		download: { fileName: `dmr-survival-screen-${survTw.term.id}.tsv` }
	})
}
