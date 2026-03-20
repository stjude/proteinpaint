import { first_genetrack_tolist } from '#common/1stGenetk'
import type { TermdbDmrSuccessResponse } from '#types'
import type { DmrConfig, BedItem, LegendRow, DmrViewData } from '../DmrTypes.ts'

export class DmrViewModel {
	viewData: DmrViewData

	constructor(dmrResult: TermdbDmrSuccessResponse, config: DmrConfig, genomeObj: any) {
		const { settings } = config
		const dmrBedItems = this.makeDmrBedItems(dmrResult, settings)
		const annotationBedItems = this.makeAnnotationBedItems(dmrResult, settings)
		const hasAnnotations = !!dmrResult.annotations?.length

		this.viewData = {
			tklst: this.buildTrackList(dmrBedItems, annotationBedItems, genomeObj),
			legendRows: this.buildLegendData(config, hasAnnotations),
			diagnostic: dmrResult.diagnostic,
			dmrs: dmrResult.dmrs,
			hasAnnotations,
			dmrBedItems,
			annotationBedItems
		}
	}

	private buildTrackList(dmrBedItems: BedItem[], annotationBedItems: BedItem[], genomeObj: any): any[] {
		const tklst: any[] = []
		first_genetrack_tolist(genomeObj, tklst)
		tklst.push({ type: 'bedj', name: 'DMRs', bedItems: dmrBedItems })
		if (annotationBedItems.length) {
			tklst.push({ type: 'bedj', name: 'cCREs', bedItems: annotationBedItems })
		}
		return tklst
	}

	private buildLegendData(config: DmrConfig, hasAnnotations: boolean): LegendRow[] {
		const { colors, annotationColors } = config.settings.dmr
		const g1 = config.group1Name || 'Group 1'
		const g2 = config.group2Name || 'Group 2'
		const rows: LegendRow[] = [
			{
				label: 'Per-CpG Means',
				items: [
					[`${g1} (control)`, colors.group1],
					[`${g2} (case)`, colors.group2]
				]
			},
			{
				label: 'DMR',
				items: [
					['Hypermethylated', colors.hyper],
					['Hypomethylated', colors.hypo]
				]
			}
		]
		if (hasAnnotations) {
			rows.push({ label: 'cCRE', items: Object.entries(annotationColors) as [string, string][] })
		}
		return rows
	}

	private makeDmrBedItems(dmrResult: TermdbDmrSuccessResponse, settings: DmrConfig['settings']): BedItem[] {
		return dmrResult.dmrs.map(dmr => {
			// Map -log10(min_smoothed_fdr) to alpha: more significant = more opaque
			const negLog = -Math.log10(Math.max(dmr.min_smoothed_fdr, 1e-300))
			const alpha = Math.round(Math.min(255, Math.max(50, (negLog / 10) * 255)))
			const hex = alpha.toString(16).padStart(2, '0')
			const base = dmr.direction === 'hyper' ? settings.dmr.colors.hyper : settings.dmr.colors.hypo
			return { chr: dmr.chr, start: dmr.start, stop: dmr.stop, color: base + hex }
		})
	}

	private makeAnnotationBedItems(dmrResult: TermdbDmrSuccessResponse, settings: DmrConfig['settings']): BedItem[] {
		return ((dmrResult as any).annotations || []).map((a: any) => ({
			chr: a.chr,
			start: a.start,
			stop: a.stop,
			color: settings.dmr.annotationColors[a.type]
		}))
	}
}
