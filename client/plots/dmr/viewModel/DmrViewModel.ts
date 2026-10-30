import { first_genetrack_tolist } from '#common/1stGenetk'

/** Name of the regulatory-element track in the genome config, if it declares one. */
export const CCRE_TRACK_NAME = 'ENCODE cCREs'
/** a DMR the artifact mask dropped */
const MASKED_COLOR = '#aaaaaa'
/** a delta-beta with its sign, 3 decimals */
const signed = (v: number | null | undefined) => `${(v ?? 0) >= 0 ? '+' : ''}${(v ?? 0).toFixed(3)}`
/** a DMR whose |Δβ| is under the scan's Min Δβ */
const BELOW_FLOOR_COLOR = '#d9d9d9'
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
		const loess = dmrResult.diagnostic?.loess
		const showLoess = !!(loess && loess.group1_fitted.length > 0 && loess.group2_fitted.length > 0)
		const showDots = xRange <= settings.dmr.maxLoessRegion

		const betaTrackResult = dmrResult.diagnostic
			? this.renderBetaTrack(
					dmrResult.diagnostic,
					config,
					settings.dmr.blockWidth,
					showLoess,
					showDots,
					queryStart,
					queryStop
			  )
			: undefined

		this.viewData = {
			tklst: this.buildTrackList(dmrBedItems, sigCpgBedItems, genomeObj, betaTrackResult?.img),
			legendRows: this.buildLegendData(
				config,
				dmrResult.dmrs,
				dmrResult.maskedDmrs || [],
				sigCpgBedItems,
				showLoess,
				showDots,
				betaTrackResult?.showCi ?? false
			),
			diagnostic: dmrResult.diagnostic,
			dmrs: dmrResult.dmrs,
			dmrBedItems,
			showLoess,
			showDots,
			notes: this.buildNotes(config, dmrResult, showDots)
		}
	}

	/* Plain sentences for what the view cannot say by color alone: why a DMR is gray, and when to zoom.
	A gray DMR with significant CpGs under it otherwise reads as a contradiction. */
	private buildNotes(config: DmrConfig, dmrResult: TermdbDmrSuccessResponse, showDots: boolean): string[] {
		const notes: string[] = []
		const floor = config.settings.dmr.minDeltaBeta || 0
		const below = dmrResult.dmrs.filter(d => Math.abs(d.delta_beta_mean ?? 0) < floor)
		if (below.length) {
			const g1 = config.group1Name || 'group 1'
			const g2 = config.group2Name || 'group 2'
			const one = below.length == 1
			let text =
				`Light gray: ${one ? 'a DMR' : `${below.length} DMRs`} that DMRcate called, but where methylation barely ` +
				`changes between the groups (${one ? `Δβ ${signed(below[0].delta_beta_mean)}` : 'each'} under the ` +
				`volcano's minimum of ${floor}), so the volcano does not count ${one ? 'it' : 'them'}.`
			const d = config.readDepth
			if (d && Math.max(d.control, d.case) / Math.min(d.control, d.case) > 1.5) {
				const [deep, shallow, dv, sv] = d.case > d.control ? [g2, g1, d.case, d.control] : [g1, g2, d.control, d.case]
				text +=
					` In this comparison ${deep} has ${(dv / sv).toFixed(1)}× the reads per CpG of ${shallow} (${dv.toFixed(
						2
					)} vs ` +
					`${sv.toFixed(2)}). DMRcate compares ratios of methylated to unmethylated reads, which shift with read ` +
					`depth, so a depth difference alone can produce a call like this, and its CpGs show as significant below.`
			}
			notes.push(text)
		}
		const masked = dmrResult.maskedDmrs || []
		if (masked.length) {
			const by = [...new Set(masked.flatMap(m => m.maskedBy))].join(', ').toLowerCase() || 'an artifact-prone region'
			notes.push(
				`Dark gray: ${masked.length == 1 ? 'a DMR' : `${masked.length} DMRs`} in ${by}, where reads from ` +
					'near-identical copies of the sequence can mix and the methylation measured can be wrong, so the volcano ' +
					`does not count ${masked.length == 1 ? 'it' : 'them'}.`
			)
		}
		if (!showDots) notes.push('Zoom in to see per-CpG dots.')
		return notes
	}

	private buildTrackList(
		dmrBedItems: BedItem[],
		sigCpgBedItems: BedItem[],
		genomeObj: any,
		betaTrackImg?: { minv: number; maxv: number; src: string }
	): any[] {
		const tklst: any[] = []
		first_genetrack_tolist(genomeObj, tklst)
		/* Regulatory context, switched on here rather than left in the Tracks menu. A DMR next to a
		gene model says where it is; a DMR next to the cCREs says what it is sitting on, which is the
		question the element-level view was answering. Taken from the genome's own declaration by
		name, so a genome that does not declare it simply renders without the row. */
		const ccre = (genomeObj?.tracks || []).find((t: any) => t.name == CCRE_TRACK_NAME)
		if (ccre) tklst.push(structuredClone(ccre))
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
		masked: NonNullable<TermdbDmrSuccessResponse['maskedDmrs']>,
		sigCpgBedItems: BedItem[],
		showLoess: boolean,
		showDots: boolean,
		showCi: boolean
	): LegendRow[] {
		const { colors } = config.settings.dmr
		const g1 = config.group1Name || 'Group 1'
		const g2 = config.group2Name || 'Group 2'
		const meansItems: LegendRow['items'] = []
		if (showDots) {
			meansItems.push({ text: `${g1} (control)`, color: colors.group1 }, { text: `${g2} (case)`, color: colors.group2 })
		}
		if (showLoess) {
			const ciLabel = showCi ? ' + 95% CI' : ''
			meansItems.push(
				{ text: `${g1} LOESS trend${ciLabel}`, color: colors.group1, style: showCi ? 'shaded' : 'dashed' },
				{ text: `${g2} LOESS trend${ciLabel}`, color: colors.group2, style: showCi ? 'shaded' : 'dashed' }
			)
		}
		const rows: LegendRow[] = [{ label: 'Per-CpG Means', items: meansItems }]
		// Only show DMR legend entries for what is drawn: directions among the counted DMRs, then the gray ones
		const floor = config.settings.dmr.minDeltaBeta || 0
		const counted = dmrs.filter(d => Math.abs(d.delta_beta_mean ?? 0) >= floor)
		const hasHyper = counted.some(d => d.direction === 'hyper')
		const hasHypo = counted.some(d => d.direction === 'hypo')
		const below = dmrs.length > counted.length
		if (hasHyper || hasHypo || below || masked.length) {
			const items: LegendRow['items'] = []
			if (hasHyper) items.push({ text: 'Hypermethylated', color: colors.hyper })
			if (hasHypo) items.push({ text: 'Hypomethylated', color: colors.hypo })
			// short here; the note under the plot says why
			if (below)
				items.push({ text: `Methylation change below ${floor}: not counted (see note)`, color: BELOW_FLOOR_COLOR })
			if (masked.length)
				items.push({ text: 'In an artifact-prone region: not counted (see note)', color: MASKED_COLOR })
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
		showDots: boolean,
		queryStart?: number,
		queryStop?: number
	): { img: { minv: number; maxv: number; src: string }; showCi: boolean } | undefined {
		const { probes } = diagnostic
		if (!probes.positions.length) return undefined

		const { colors, minProbesForCi } = config.settings.dmr
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

		// Draw dots (hidden for large regions where only LOESS is shown)
		if (!showDots) {
			ctx.globalAlpha = 1
			return { img: { minv: 0, maxv: 1, src: canvas.toDataURL('image/png') }, showCi }
		}
		for (let i = 0; i < probes.positions.length; i++) {
			const x = scaleX(probes.positions[i])
			const isSig = probes.sig[i]
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
		const floor = settings.dmr.minDeltaBeta || 0
		const items = dmrResult.dmrs.map(dmr => {
			// under the scan's Min Δβ: called, but not counted by the scan
			if (Math.abs(dmr.delta_beta_mean ?? 0) < floor)
				return {
					chr: dmr.chr,
					start: dmr.start,
					stop: dmr.stop,
					color: BELOW_FLOOR_COLOR,
					name: `Δβ ${signed(dmr.delta_beta_mean)}, under ${floor}: not counted`
				}
			// Map -log10(min_smoothed_fdr) to alpha: more significant = more opaque
			const negLog = -Math.log10(Math.max(dmr.min_smoothed_fdr, 1e-300))
			const alpha = Math.round(Math.min(255, Math.max(50, (negLog / 10) * 255)))
			const hex = alpha.toString(16).padStart(2, '0')
			const base = dmr.direction === 'hyper' ? settings.dmr.colors.hyper : settings.dmr.colors.hypo
			return {
				chr: dmr.chr,
				start: dmr.start,
				stop: dmr.stop,
				color: base + hex,
				name: `Δβ ${signed(dmr.delta_beta_mean)}, ${dmr.no_cpgs} CpGs`
			}
		})
		/* DMRs the artifact mask dropped, in gray: called by DMRcate, so its significant CpGs show on
		the Sig. CpGs track, but in a region where reads from duplicated copies can pool and beta can be
		wrong, so the scan neither counts nor plots them. */
		for (const d of dmrResult.maskedDmrs || [])
			items.push({
				chr: d.chr,
				start: d.start,
				stop: d.stop,
				color: MASKED_COLOR,
				name: `masked: ${d.maskedBy.join(', ').toLowerCase() || 'artifact-prone region'}`
			})
		return items
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
			if (!probes.sig[i]) continue
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
