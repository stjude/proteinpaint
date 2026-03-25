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
		const sigCpgBedItems = this.makeSigCpgBedItems(dmrResult, settings, queryChr, queryStart, queryStop)

		const xRange = (queryStop ?? 0) - (queryStart ?? 0)
		const showLoess = !!(dmrResult.diagnostic?.loess && xRange <= settings.dmr.maxLoessRegion)

		const betaTrackResult = dmrResult.diagnostic
			? this.renderBetaTrack(dmrResult.diagnostic, config, settings.dmr.blockWidth, showLoess, queryStart, queryStop)
			: undefined

		this.viewData = {
			tklst: this.buildTrackList(dmrBedItems, sigCpgBedItems, genomeObj, betaTrackResult?.img),
			legendRows: this.buildLegendData(
				config,
				dmrResult.dmrs,
				sigCpgBedItems,
				showLoess,
				betaTrackResult?.showCi ?? false
			),
			diagnostic: dmrResult.diagnostic,
			dmrs: dmrResult.dmrs,
			dmrBedItems,
			showLoess
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
		tklst.push({ type: 'bedj', name: 'Sig. CpGs', bedItems: sigCpgBedItems })
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
		sigCpgBedItems: BedItem[],
		showLoess: boolean,
		showCi: boolean
	): LegendRow[] {
		const { colors } = config.settings.dmr
		const g1 = config.group1Name || 'Group 1'
		const g2 = config.group2Name || 'Group 2'
		const meansItems: LegendRow['items'] = [
			{ text: `${g1} (control)`, color: colors.group1 },
			{ text: `${g2} (case)`, color: colors.group2 }
		]
		if (showLoess) {
			const ciLabel = showCi ? ' + 95% CI' : ''
			meansItems.push(
				{ text: `${g1} LOESS trend${ciLabel}`, color: colors.group1, style: showCi ? 'shaded' : 'dashed' },
				{ text: `${g2} LOESS trend${ciLabel}`, color: colors.group2, style: showCi ? 'shaded' : 'dashed' }
			)
		}
		const rows: LegendRow[] = [{ label: 'Per-CpG Means', items: meansItems }]
		// Only show DMR legend entries for directions present in the results
		const hasHyper = dmrs.some(d => d.direction === 'hyper')
		const hasHypo = dmrs.some(d => d.direction === 'hypo')
		if (hasHyper || hasHypo) {
			const items: LegendRow['items'] = []
			if (hasHyper) items.push({ text: 'Hypermethylated', color: colors.hyper })
			if (hasHypo) items.push({ text: 'Hypomethylated', color: colors.hypo })
			rows.push({ label: 'DMR', items })
		}
		if (sigCpgBedItems.length) {
			const items: LegendRow['items'] = []
			const hasHyperCpg = sigCpgBedItems.some(b => b.color === colors.hyper)
			const hasHypoCpg = sigCpgBedItems.some(b => b.color === colors.hypo)
			if (hasHyperCpg) items.push({ text: 'Hyper (FDR sig.)', color: colors.hyper })
			if (hasHypoCpg) items.push({ text: 'Hypo (FDR sig.)', color: colors.hypo })
			rows.push({ label: 'Sig. CpGs', items })
		}
		return rows
	}

	/**
	 * Render the per-CpG means scatter plot to an offscreen canvas and return
	 * a data URI suitable for the bigwig imgData track.
	 */
	private renderBetaTrack(
		diagnostic: DmrDiagnostic,
		config: DmrConfig,
		blockWidth: number,
		showLoess: boolean,
		queryStart?: number,
		queryStop?: number
	): { img: { minv: number; maxv: number; src: string }; showCi: boolean } | undefined {
		const { probes } = diagnostic
		if (!probes.positions.length) return undefined

		const { colors, fdr_cutoff, minProbesForCi } = config.settings.dmr
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

		// DMR region shading omitted — already shown as a bedj track above

		// Draw LOESS curves with shaded CI regions, clipped to probe data range.
		// Only show CIs when there are enough probes for a reliable estimate.
		let showCi = false
		if (showLoess && diagnostic.loess) {
			const { loess } = diagnostic
			const firstProbePos = probes.positions[0]
			const lastProbePos = probes.positions[probes.positions.length - 1]
			showCi = probes.positions.length >= minProbesForCi

			for (const [fitted, ciLower, ciUpper, color] of [
				[loess.group1_fitted, loess.group1_ci_lower, loess.group1_ci_upper, colors.group1],
				[loess.group2_fitted, loess.group2_ci_lower, loess.group2_ci_upper, colors.group2]
			] as [number[], number[], number[], string][]) {
				if (!fitted.length) continue
				const lPos = loess.positions

				// Find LOESS indices within the range of actual probe positions
				let iStart = 0
				let iEnd = lPos.length - 1
				while (iStart < lPos.length && lPos[iStart] < firstProbePos) iStart++
				while (iEnd >= 0 && lPos[iEnd] > lastProbePos) iEnd--
				if (iStart > iEnd) continue

				if (showCi) {
					// Draw CI as shaded region
					ctx.globalAlpha = 0.12
					ctx.fillStyle = color
					ctx.beginPath()
					for (let i = iStart; i <= iEnd; i++) {
						ctx.lineTo(scaleX(lPos[i]), scaleY(Math.max(0, Math.min(1, ciUpper[i]))))
					}
					for (let i = iEnd; i >= iStart; i--) {
						ctx.lineTo(scaleX(lPos[i]), scaleY(Math.max(0, Math.min(1, ciLower[i]))))
					}
					ctx.closePath()
					ctx.fill()
				}

				// Draw LOESS fitted curve (dashed when no CI, solid otherwise)
				ctx.globalAlpha = 0.8
				ctx.strokeStyle = color
				ctx.lineWidth = 2
				ctx.setLineDash(showCi ? [] : [6, 4])
				ctx.beginPath()
				for (let i = iStart; i <= iEnd; i++) {
					ctx.lineTo(scaleX(lPos[i]), scaleY(Math.max(0, Math.min(1, fitted[i]))))
				}
				ctx.stroke()
				ctx.setLineDash([])
			}
		}

		// Draw dots
		for (let i = 0; i < probes.positions.length; i++) {
			const x = scaleX(probes.positions[i])
			const isSig = probes.fdr[i] < fdr_cutoff
			const alpha = isSig ? 0.85 : 0.3

			// Group 1 (control)
			ctx.globalAlpha = alpha
			ctx.fillStyle = colors.group1
			const m1 = probes.mean_group1[i]
			if (m1 != null) {
				ctx.beginPath()
				ctx.arc(x, scaleY(m1), 4, 0, Math.PI * 2)
				ctx.fill()
			}

			// Group 2 (case)
			ctx.fillStyle = colors.group2
			const m2 = probes.mean_group2[i]
			if (m2 != null) {
				ctx.beginPath()
				ctx.arc(x, scaleY(m2), 4, 0, Math.PI * 2)
				ctx.fill()
			}
		}
		ctx.globalAlpha = 1

		return { img: { minv: 0, maxv: 1, src: canvas.toDataURL('image/png') }, showCi }
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
		chr: string,
		queryStart?: number,
		queryStop?: number
	): BedItem[] {
		const diag = dmrResult.diagnostic
		if (!diag) return []
		const { probes } = diag
		const items: BedItem[] = []
		const minDeltaBeta = 0.05
		for (let i = 0; i < probes.positions.length; i++) {
			if (probes.fdr[i] >= settings.dmr.fdr_cutoff) continue
			const pos = probes.positions[i]
			if (queryStart != null && queryStop != null && (pos < queryStart || pos > queryStop)) continue
			const mg1 = probes.mean_group1[i]
			const mg2 = probes.mean_group2[i]
			if (mg1 == null || mg2 == null) continue
			const deltaBeta = mg2 - mg1
			if (Math.abs(deltaBeta) < minDeltaBeta) continue
			const color = deltaBeta >= 0 ? settings.dmr.colors.hyper : settings.dmr.colors.hypo
			items.push({ chr, start: pos, stop: pos + 1, color })
		}
		return items
	}
}
