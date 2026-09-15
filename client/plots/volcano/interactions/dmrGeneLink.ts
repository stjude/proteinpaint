import { dofetch3 } from '#common/dofetch'
import { renderTable, sayerror, table2col } from '#dom'
import { bplen } from '#shared/common.js'
import type { DmrScanSummary } from '#types'
import { getDefaultVolcanoSettings } from '../settings/defaults'

/* The genes a scan's DMRs touch, whether their expression moved the way the DMR's position predicts,
and what PubMed has on that gene's methylation-expression relationship.

Linking and classification are the server's (termdb/dmrGeneLink, utils/dmrGeneLink.ts): promoter
methylation and expression should move in opposite directions, gene-body methylation and expression
in the same one. Literature is fetched per gene on a row click (termdb/dmrLiterature) because
E-utilities rate-limits a table-wide lookup. */
export async function dmrGeneLinkPanel(
	tip: any,
	config: any,
	vocab: { genome: string; dslabel: string },
	scan: DmrScanSummary,
	app: any
) {
	const div = tip.d.append('div').style('padding', '10px').style('max-width', '1000px')
	const wait = div
		.append('div')
		.style('color', '#777')
		.text('Linking DMRs to genes and running differential expression…')
	// the same DE the volcano and the gene-body test run, so all three share one cached result
	const de = getDefaultVolcanoSettings({}, { termType: 'geneExpression' }) as any
	const state = app.getState()
	let res: any
	try {
		res = await dofetch3('termdb/dmrGeneLink', {
			body: {
				genome: vocab.genome,
				dslabel: vocab.dslabel,
				cacheId: scan.cacheId,
				minCpgs: scan.minCpgs,
				/* The cohort the scan compared, expanded and matched server-side. The plot state's list can still
				hold a "Not in" group as {in:false} carrying the included group's values, which DE reads as two
				overlapping groups. */
				samplelst: {
					groups: (scan.matchedSamplelst || config.samplelst).groups.map((g: any) => ({
						name: g.name,
						in: g.in,
						values: g.values
					}))
				},
				method: de.method,
				min_count: de.minCount,
				min_total_count: de.minTotalCount,
				cpm_cutoff: de.cpmCutoff,
				filter: state.termfilter?.filter,
				filter0: state.termfilter?.filter0
			}
		})
	} catch (e: any) {
		res = { error: e?.message || String(e) }
	}
	wait.remove()
	if (res.error) return sayerror(div.append('div'), res.error)

	div
		.append('div')
		.style('font-weight', 'bold')
		.text(
			`${res.genes.toLocaleString()} genes touched by DMRs of ${
				scan.minCpgs
			}+ CpGs (${res.links.toLocaleString()} gene-context links), ` +
				`read against ${res.deMethod || 'differential'} expression on the samples with methylation`
		)
	div
		.append('div')
		.style('color', '#777')
		.style('font-size', '.92em')
		.style('padding', '2px 0 6px')
		.text(
			`Promoter = within ${bplen(
				2000
			)} of the TSS; body = the rest of the gene. Concordant: promoter Δβ and expression change in ` +
				`opposite directions, or gene-body Δβ and expression in the same direction (expression adjusted p < 0.05).`
		)
	const summary = table2col({ holder: div.append('div') })
	for (const context of ['promoter', 'body']) {
		const s = res.summary[context] || {}
		const [td1, td2] = summary.addRow()
		td1.text(context == 'promoter' ? 'Promoter DMRs' : 'Gene-body DMRs')
		td2.text(
			['concordant', 'discordant', 'no expression change', 'not tested']
				.map(k => `${k}: ${(s[k] || 0).toLocaleString()}`)
				.join(' · ')
		)
	}

	const rows = res.rows
	const litDiv = div.append('div')
	// renderTable sorts the cell arrays in place, so a clicked index is looked up through them
	const recordOf = new Map<any[], any>()
	const tableRows = rows.map((r: any) => {
		const cells = [
			{ value: r.gene },
			{ value: r.context },
			{ value: `${r.dmr.chr}:${r.dmr.start}-${r.dmr.stop}` },
			{ value: Number(r.dmr.deltaBeta.toFixed(3)) },
			{ value: r.dmr.cpgs },
			{ value: r.nDmrs },
			{ value: r.fc == null ? '' : Number(r.fc.toFixed(3)) },
			{ value: r.p == null ? '' : Number(r.p.toPrecision(2)) },
			{ value: r.relationship }
		]
		recordOf.set(cells, r)
		return cells
	})
	renderTable({
		div: div.append('div'),
		columns: [
			{ label: 'Gene' },
			{ label: 'Context' },
			{ label: 'Strongest DMR' },
			{ label: 'Δβ', sortable: true },
			{ label: 'CpGs', sortable: true },
			{ label: 'DMRs', sortable: true },
			{ label: 'Expression log₂FC', sortable: true },
			{ label: 'Expression p', sortable: true },
			{ label: 'Relationship' }
		],
		rows: tableRows,
		showLines: true,
		maxHeight: '40vh',
		header: { allowSort: true },
		noRadioBtn: true,
		download: { fileName: 'dmr-gene-links.tsv' },
		// a click asks PubMed about that row's gene in that row's context
		noButtonCallback: (i: number) => showLiterature(litDiv, vocab, recordOf.get(tableRows[i]), disease)
	})
	if (rows.length < res.links)
		div
			.append('div')
			.style('color', '#777')
			.style('font-size', '.9em')
			.text(`Showing the first ${rows.length.toLocaleString()} of ${res.links.toLocaleString()} links.`)
	const hint = litDiv.append('div').style('color', '#777').style('padding', '6px 0')
	hint.append('span').text('Click a row for PubMed articles on that gene and mechanism, optionally within a disease: ')
	const disease = hint.append('input').attr('type', 'text').attr('placeholder', 'e.g. myeloma').style('width', '120px')
}

async function showLiterature(
	holder: any,
	vocab: { genome: string; dslabel: string },
	r: any,
	/** this panel's disease-context box, read at each lookup */
	disease: any
) {
	// keep the hint row (and its typed disease) at the top; replace only the previous results
	holder.selectAll('.sjpp-dmr-lit').remove()
	const out = holder.append('div').attr('class', 'sjpp-dmr-lit')
	const head = out.append('div').style('padding', '8px 0 2px').style('font-weight', 'bold')
	const d = String(disease?.property('value') || '').trim()
	const within = d ? ` in ${d}` : ''
	head.text(`PubMed: ${r.gene}, ${r.context} methylation and expression${within}…`)
	const res: any = await dofetch3('termdb/dmrLiterature', {
		body: { genome: vocab.genome, dslabel: vocab.dslabel, gene: r.gene, context: r.context, disease: d }
	}).catch((e: any) => ({ error: e?.message || String(e) }))
	holder = out
	if (res.error) return sayerror(holder.append('div'), res.error)
	head.text(
		`PubMed: ${r.gene}, ${r.context} methylation and expression${within} (${res.count.toLocaleString()} article${
			res.count == 1 ? '' : 's'
		}` +
			`${res.count > res.articles.length ? `, ${res.articles.length} most relevant shown` : ''}; this link is ${
				r.relationship
			})`
	)
	if (!res.articles.length) {
		holder
			.append('div')
			.style('color', '#777')
			.text('No articles match. The link may be unreported rather than unsupported.')
		return
	}
	const ul = holder.append('ul').style('margin', '2px 0')
	for (const a of res.articles) {
		const li = ul.append('li')
		li.append('span').text(`${a.title} ${a.journal} ${a.year}. `)
		li.append('a')
			.attr('href', a.doi ? `https://doi.org/${a.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`)
			.attr('target', '_blank')
			.text(a.doi ? `doi:${a.doi}` : `PMID ${a.pmid}`)
	}
}
