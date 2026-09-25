import { dofetch3 } from '#common/dofetch'
import { renderTable, sayerror } from '#dom'

/* Per-patient promoter silencing, from the DM volcano.

Genes whose normally unmethylated promoter is methylated in a few patients, and whose expression is
lost in exactly those patients. A two-group volcano averages such events away, so the screen is not
computed from the volcano's groups: it is precomputed over the whole cohort (termdb/dmrSilencing). The
volcano's groups only add a column each, the silenced patients falling in that group, which is where a
genotype link shows.

Each row opens the two views a silencing claim needs: survival split at the silencing call (promoter
beta >= 0.5), and the promoter's methylation against the gene's expression per group. */

const Q_CHOICES = [0.05, 0.1, 0.2]

export async function silencingPanel(tip: any, config: any, interactions: any) {
	const app = interactions.app
	const holder = tip.d.append('div').style('padding', '10px').style('max-width', '1100px')
	const controls = holder.append('div').style('margin-bottom', '6px')
	controls.append('span').text('Promoter silencing events at q < ')
	const select = controls.append('select')
	for (const q of Q_CHOICES) select.append('option').attr('value', q).text(q)
	const out = holder.append('div')
	select.on('change', () => load(Number(select.property('value'))))
	load(Q_CHOICES[0])

	async function load(maxQ: number) {
		out.selectAll('*').remove()
		const wait = out.append('div').style('color', '#777').text('Loading the silencing screen…')
		let res: any
		try {
			res = await dofetch3('termdb/dmrSilencing', {
				body: {
					genome: app.vocabApi.vocab.genome,
					dslabel: app.vocabApi.vocab.dslabel,
					maxQ,
					samplelst: config.samplelst
				}
			})
		} catch (e: any) {
			res = { error: e?.message || String(e) }
		}
		wait.remove()
		if (res.error) return sayerror(out.append('div'), res.error)
		render(res)
	}

	function render(res: any) {
		const [g1, g2] = res.groups || []
		out
			.append('div')
			.style('font-weight', 'bold')
			.text(`${res.rows.length} of ${res.genesTested} testable genes are silenced in some patients at q < ${res.maxQ}.`)
		out
			.append('div')
			.style('color', '#777')
			.style('font-size', '.92em')
			.style('padding-bottom', '6px')
			.text(
				'A promoter counts when it is normally unmethylated (cohort median beta < 0.2) and the gene expressed; ' +
					'silenced patients are those at beta >= 0.5, tested for lower expression (one-sided Mann-Whitney, ' +
					'Benjamini-Hochberg q over the genes tested). One diagnostic sample per patient, autosomes only. ' +
					(g1 ? `Group columns count silenced patients among the ${g1.n} and ${g2.n} in each volcano group.` : '')
			)
		// renderTable sorts the cell arrays in place, so a clicked row is looked up through them
		const rowOf = new Map<any[], any>()
		const fmt = (v: number) => ({ value: Number.isFinite(v) ? Number(v.toPrecision(2)) : '' })
		const rows = res.rows.map((r: any) => {
			const cells = [
				{ value: r.gene },
				{ value: r.promoter },
				{ value: r.n_outliers },
				...(g1 ? [{ value: r.inGroups[0] }, { value: r.inGroups[1] }] : []),
				fmt(r.median_beta_outliers),
				fmt(r.effect),
				fmt(r.silenced_frac),
				fmt(r.q)
			]
			rowOf.set(cells, r)
			return cells
		})
		const col = (label: string) => ({ label, align: 'right', sortable: true })
		// the promoter id carries its window, e.g. SEL1L.p1_chr14:81484028-81486028
		const regionOf = (r: any) => {
			const m = /_(chr[^:]+):(\d+)-(\d+)$/.exec(r.promoter)
			// named as the gene's promoter, not after the volcano's element class (e.g. "DMR")
			const named = { gene_name: r.gene, promoter_id: r.promoter, noun: `${r.gene} promoter` }
			return m
				? { chr: m[1], start: Number(m[2]), stop: Number(m[3]), ...named }
				: { chr: r.chr, start: r.start, stop: r.start + 2000, ...named }
		}
		const act = (fn: (d: any) => any) => (_e: any, i: number) => {
			const r = rowOf.get(rows[i])
			if (!r) return
			tip.hide()
			fn(regionOf(r))
		}
		renderTable({
			div: out.append('div'),
			columns: [
				{ label: 'Gene' },
				{ label: 'Promoter' },
				col('Silenced patients'),
				...(g1 ? [col(`in ${g1.name}`), col(`in ${g2.name}`)] : []),
				col('Median beta, silenced'),
				col('Expression change (log2)'),
				col('Share below 10th pct'),
				col('q')
			] as any,
			rows,
			header: { allowSort: true },
			columnButtons: [
				{ text: 'Survival', callback: act(d => interactions.launchSilencingSurvival(d)) },
				{ text: 'Scatter', callback: act(d => interactions.launchDNAMethExpressionScatter(d)) }
			],
			showLines: true,
			maxHeight: '50vh',
			download: { fileName: 'promoter-silencing.tsv' }
		})
	}
}
