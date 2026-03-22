import { first_genetrack_tolist } from '#common/1stGenetk'
import type { TermdbDmrSuccessResponse, DmrDiagnostic } from '#types'
import type { DmrConfig, BedItem, LegendRow, DmrViewData } from '../DmrTypes.ts'

export class DmrViewModel {
	viewData: DmrViewData

	constructor(
		dmrResult: TermdbDmrSuccessResponse,
		config: DmrConfig,
		genomeObj: any,
		queryChr: string,
		queryStart?: number,
		queryStop?: number
	) {
		const { settings } = config
		const dmrBedItems = this.makeDmrBedItems(dmrResult, settings)
		const sigCpgBedItems = this.makeSigCpgBedItems(dmrResult, settings, queryChr)

		// Generate per-CpG means track image if diagnostic data is available
		const betaTrackImg = dmrResult.diagnostic
			? this.renderBetaTrack(
					dmrResult.diagnostic,
					dmrResult.dmrs,
					config,
					settings.dmr.blockWidth,
					queryStart,
					queryStop
			  )
			: undefined

		this.viewData = {
			tklst: this.buildTrackList(dmrBedItems, sigCpgBedItems, genomeObj, betaTrackImg),
			legendRows: this.buildLegendData(config, dmrResult.dmrs, sigCpgBedItems),
			diagnostic: dmrResult.diagnostic,
			dmrs: dmrResult.dmrs,
			dmrBedItems
		}
	}

	private buildTrackList(
		dmrBedItems: BedItem[],
		sigCpgBedItems: BedItem[],
		genomeObj: any,
		betaTrackImg?: { minv: number; maxv: number; src: string }
	): any[] {
		const tklst: any[] = []
		first_genetrack_tolist(genomeObj, tklst)
		tklst.push({ type: 'bedj', name: 'DMRs', bedItems: dmrBedItems })
		if (sigCpgBedItems.length) {
			tklst.push({ type: 'bedj', name: 'Sig. CpGs', bedItems: sigCpgBedItems })
		}
		if (betaTrackImg) {
			tklst.push({
				type: 'bigwig',
				name: 'Per-CpG Means',
				height: 150,
				imgData: betaTrackImg
			})
		}
		return tklst
	}

	private buildLegendData(
		config: DmrConfig,
		dmrs: TermdbDmrSuccessResponse['dmrs'],
		sigCpgBedItems: BedItem[]
	): LegendRow[] {
		const { colors } = config.settings.dmr
		const g1 = config.group1Name || 'Group 1'
		const g2 = config.group2Name || 'Group 2'
		const rows: LegendRow[] = [
			{
				label: 'Per-CpG Means',
				items: [
					[`${g1} (control)`, colors.group1],
					[`${g2} (case)`, colors.group2]
				]
			}
		]
		// Only show DMR legend entries for directions present in the results
		const hasHyper = dmrs.some(d => d.direction === 'hyper')
		const hasHypo = dmrs.some(d => d.direction === 'hypo')
		if (hasHyper || hasHypo) {
			const dmrItems: [string, string][] = []
			if (hasHyper) dmrItems.push(['Hypermethylated', colors.hyper])
			if (hasHypo) dmrItems.push(['Hypomethylated', colors.hypo])
			rows.push({ label: 'DMR', items: dmrItems })
		}
		if (sigCpgBedItems.length) {
			const sigItems: [string, string][] = []
			const hasHyperCpg = sigCpgBedItems.some(b => b.color === colors.hyper)
			const hasHypoCpg = sigCpgBedItems.some(b => b.color === colors.hypo)
			if (hasHyperCpg) sigItems.push(['Hyper (FDR sig.)', colors.hyper])
			if (hasHypoCpg) sigItems.push(['Hypo (FDR sig.)', colors.hypo])
			rows.push({ label: 'Sig. CpGs', items: sigItems })
		}
		return rows
	}

	/**
	 * Render the per-CpG means scatter plot to an offscreen canvas and return
	 * a data URI suitable for the bigwig imgData track.
	 */
	private renderBetaTrack(
		diagnostic: DmrDiagnostic,
		dmrs: TermdbDmrSuccessResponse['dmrs'],
		config: DmrConfig,
		blockWidth: number,
		queryStart?: number,
		queryStop?: number
	): { minv: number; maxv: number; src: string } | undefined {
		const { probes } = diagnostic
		if (!probes.positions.length) return undefined

		const { colors, fdr_cutoff } = config.settings.dmr
		const dpr = typeof window !== 'undefined' && window.devicePixelRatio > 1 ? window.devicePixelRatio : 1
		const width = blockWidth
		const height = 150

		const canvas = document.createElement('canvas')
		canvas.width = width * dpr
		canvas.height = height * dpr
		const ctx = canvas.getContext('2d')
		if (!ctx) return undefined
		ctx.scale(dpr, dpr)

		// Use the full block view range so dots align with bedj tracks above.
		// The block stretches the image to fill the view from queryStart to queryStop.
		const xMin = queryStart ?? probes.positions[0]
		const xMax = queryStop ?? probes.positions[probes.positions.length - 1]
		const xRange = xMax - xMin || 1
		const scaleX = (val: number) => ((val - xMin) / xRange) * width
		const scaleY = (val: number) => height - val * height // beta 0-1

		// Transparent background so block mouse events (yellow line) show through
		ctx.clearRect(0, 0, width, height)

		// Draw DMR regions as shaded rectangles
		for (const dmr of dmrs) {
			const x1 = Math.max(0, scaleX(dmr.start))
			const x2 = Math.min(width, scaleX(dmr.stop))
			ctx.fillStyle = dmr.direction === 'hyper' ? colors.hyper + '1a' : colors.hypo + '1a'
			ctx.fillRect(x1, 0, Math.max(1, x2 - x1), height)
		}

		// Draw dots
		for (let i = 0; i < probes.positions.length; i++) {
			const x = scaleX(probes.positions[i])
			const isSig = probes.fdr[i] < fdr_cutoff
			const alpha = isSig ? 0.85 : 0.3

			// Group 1 (control)
			ctx.globalAlpha = alpha
			ctx.fillStyle = colors.group1
			ctx.beginPath()
			ctx.arc(x, scaleY(probes.mean_group1[i]), 4, 0, Math.PI * 2)
			ctx.fill()

			// Group 2 (case)
			ctx.fillStyle = colors.group2
			ctx.beginPath()
			ctx.arc(x, scaleY(probes.mean_group2[i]), 4, 0, Math.PI * 2)
			ctx.fill()
		}
		ctx.globalAlpha = 1

		return { minv: 0, maxv: 1, src: canvas.toDataURL('image/png') }
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

	private makeSigCpgBedItems(
		dmrResult: TermdbDmrSuccessResponse,
		settings: DmrConfig['settings'],
		chr: string
	): BedItem[] {
		const diag = dmrResult.diagnostic
		if (!diag) return []
		const { probes } = diag
		const items: BedItem[] = []
		const minDeltaBeta = 0.05 // minimum effect size filter per EWAS consensus
		for (let i = 0; i < probes.positions.length; i++) {
			if (probes.fdr[i] >= settings.dmr.fdr_cutoff) continue
			const deltaBeta = probes.mean_group2[i] - probes.mean_group1[i]
			if (Math.abs(deltaBeta) < minDeltaBeta) continue
			const color = deltaBeta >= 0 ? settings.dmr.colors.hyper : settings.dmr.colors.hypo
			items.push({ chr, start: probes.positions[i], stop: probes.positions[i] + 1, color })
		}
		return items
	}
}
