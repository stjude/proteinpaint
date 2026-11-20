import { dofetch3 } from '#common/dofetch'
import { TermTypes, DMR_SCAN_ELEMENT_TYPE } from '#types'
import { VolcanoModel } from '#plots/volcano/model/VolcanoModel.ts'
import { getPlotConfig as getDiffAnalysisConfig } from '#plots/diffAnalysis/DifferentialAnalysis.ts'
import type { Column, ColumnResult } from './viewModel'

/* Runs every column of a pathway comparison: the column's differential analysis, as the volcano requests it, then
gene-set enrichment on that analysis' cache, as the GSEA tab requests it. Each column's config is the one the
differential analysis of that pair would get (getDiffAnalysisConfig), so its requests are the same as opening that
analysis by hand: a scan or DE already run is a cache hit, and the GSEA opened from a cell lands on the same cache. */

/** analyses a server runs at once per kind are capped (CacheManager): two columns at a time stays under every cap */
const CONCURRENCY = 2
/** a column the server turns away as busy is retried after these waits, in ms */
const BUSY_RETRY_MS = [5000, 10000, 20000, 40000, 60000]

export const DATA_LABEL: Record<string, string> = {
	[TermTypes.GENE_EXPRESSION]: 'Expression',
	[TermTypes.DNA_METHYLATION]: 'Body methylation'
}

/** the comparisons a config asks for: each case group (groups[1..]) against groups[0], on each data type */
export function getColumns(config: any): Column[] {
	const [ref, ...cases] = config.samplelst.groups
	const values = config.tw?.term?.values || {}
	return cases.flatMap((g: any) =>
		config.termTypes.map((termType: string) => ({
			key: `${g.name}\t${termType}`,
			caseName: g.name,
			controlName: ref.name,
			termType,
			dataLabel: DATA_LABEL[termType] || termType,
			color: values[g.name]?.color
		}))
	)
}

/** the differential-analysis config of one column; a methylation column is the gene-body ranking of a DMR scan */
export function getColumnConfig(config: any, col: Column, app: any) {
	const groups = config.samplelst.groups
	const pair = [groups[0], groups.find((g: any) => g.name == col.caseName)]
	const values = config.tw?.term?.values || {}
	const tw = config.tw && {
		...config.tw,
		term: {
			...config.tw.term,
			values: Object.fromEntries(pair.map(g => [g.name, values[g.name]]).filter(([, v]) => v))
		},
		q: { ...config.tw.q, groups: pair }
	}
	return getDiffAnalysisConfig(
		{
			termType: col.termType,
			samplelst: { groups: structuredClone(pair) },
			...(tw ? { tw } : {}),
			...(col.termType == TermTypes.DNA_METHYLATION
				? { settings: { volcano: { elementType: DMR_SCAN_ELEMENT_TYPE } } }
				: {})
		},
		app
	)
}

export class GseaCompareModel {
	plot: any

	constructor(plot: any) {
		this.plot = plot
	}

	/** every column, CONCURRENCY at a time; onColumn is called as each one finishes, so the grid fills in */
	async runAll(config: any, columns: Column[], onColumn: (i: number, r: ColumnResult) => void) {
		let next = 0
		const worker = async () => {
			while (next < columns.length) {
				const i = next++
				onColumn(i, await this.runColumn(config, columns[i]))
			}
		}
		await Promise.all(Array.from({ length: Math.min(CONCURRENCY, columns.length) }, worker))
	}

	/** colConfig: the differential-analysis config to run the column on, when the caller has one (the methylation
	 * starburst passes its volcano's, so that the scan is the volcano's own); otherwise the pair's default */
	async runColumn(
		config: any,
		col: Column,
		colConfig = getColumnConfig(config, col, this.plot.app)
	): Promise<ColumnResult> {
		try {
			const da = await new VolcanoModel(this.plot, col.termType).getData(colConfig, colConfig.settings.volcano)
			if (da?.error) throw new Error(da.error)
			if (!da?.data?.cacheId) throw new Error('the analysis returned no result to run enrichment on')
			const body = {
				genome: this.plot.app.vocabApi.vocab.genome,
				dslabel: this.plot.app.vocabApi.vocab.dslabel,
				cacheId: da.data.cacheId,
				daRequest: da.daRequest,
				geneSetGroup: config.settings.gseaCompare.pathway,
				msigdbRelease: this.plot.app.opts.genome?.termdbs?.msigdb?.release,
				method: 'blitzgsea',
				num_permutations: colConfig.settings.gsea.num_permutations,
				filter_non_coding_genes: colConfig.settings.gsea.filter_non_coding_genes,
				// a DMR scan's ranking net of expression level; the server reads it on a scan only
				...(colConfig.settings.gsea.adjust_expression_level ? { adjust_expression_level: true } : {})
			}
			const out = await this.fetchWithRetry(body)
			return { status: 'done', sets: out.data || {} }
		} catch (e: any) {
			if (e?.name == 'AbortError') throw e
			return { status: 'error', error: String(e?.message || e) }
		}
	}

	/** route: genesetEnrichment, or another route that answers a busy cache with code CACHE_BUSY */
	async fetchWithRetry(body: any, route = 'genesetEnrichment') {
		for (let attempt = 0; ; attempt++) {
			const out = await dofetch3(route, { body, signal: this.plot.api?.getAbortSignal() })
			if (!out?.error) return out
			if (out.code != 'CACHE_BUSY' || attempt >= BUSY_RETRY_MS.length) throw new Error(out.error)
			await new Promise(r => setTimeout(r, BUSY_RETRY_MS[attempt]))
		}
	}
}
