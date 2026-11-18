import type { MassAppApi } from '#mass/types/mass'
import { dofetch3 } from '#common/dofetch'
import type { VolcanoRenderRequest } from '#types'
import { getGroupColors, toHex } from '../colors'
import { withOthersGroup } from '#mass/groups'
import { getVolcanoHandler, type EffectAxis, type VolcanoHandler, type VolcanoRequestContext } from '../handlers'

/** Fetches the analysis of config.termType. The request differs by data type and is built by the
 * handler of that type (../handlers/); this class holds what every request shares. */
export class VolcanoModel implements VolcanoRequestContext {
	plot: any
	app: MassAppApi
	config!: any
	settings!: any
	termType: string

	/** TODO: This model is used in both the volcano and gsea.
	 * In the future, create base model in DA and use specific
	 * classes for the volcano and gsea. */
	constructor(plot: any, termType: string) {
		this.plot = plot
		this.app = plot.app
		this.termType = termType
	}

	/** looked up on use, not in the constructor: a volcano of an unsupported type is still created,
	 * and fails when it asks for data */
	get handler(): VolcanoHandler {
		return getVolcanoHandler(this.termType)
	}

	async getData(config: any, settings: any) {
		this.config = config
		this.settings = settings

		const handler = this.handler
		const body = await handler.getRequestBody(this)
		const response = await dofetch3(handler.route, { body, signal: this.plot.api?.getAbortSignal() })
		// Surface the request so downstream plots (GSEA) can snapshot it and later ask the server to
		// recompute the DA cache if the file is missing on a peer node or after TTL eviction.
		if (handler.comparesGroups && response && !response.error) {
			response.daRequest = body
			this.setGroupSizes(response)
		}
		return response
	}

	/** Parameters telling the server to run the `volcano` Rust renderer and return a
	 * volcano PNG + top-significant rows instead of the full dot list. */
	getVolcanoRender(): VolcanoRenderRequest {
		// Match the client overlay's radius (see VolcanoViewModel.setPointData)
		// so the PNG rings and the interactive overlay rings line up; otherwise
		// a smaller PNG ring sits inside the larger overlay ring and looks like
		// a stray dot at the center.
		const dotRadius = Math.max(this.settings.width, this.settings.height) / 80
		// Resolve case/control colors via the shared helper (see colors.ts) so the
		// PNG and the SVG overlay paint each side with the exact same hex string.
		const { caseColor, controlColor } = getGroupColors(this.config)
		/* The handler names the effect size on the x axis and the cutoff in that field's units:
		fold_change unless the data type plots another (delta_beta, delta_psi). */
		const axis: EffectAxis = this.handler.getEffectAxis?.(this.settings) || { cutoff: this.settings.foldChangeCutoff }
		const render: VolcanoRenderRequest = {
			significanceThresholds: {
				pValueCutoff: this.settings.pValue,
				pValueType: this.settings.pValueType,
				foldChangeCutoff: axis.cutoff
			},
			...(axis.xField ? { xField: axis.xField } : {}),
			...(axis.centerX ? { centerX: true } : {}),
			pixelWidth: this.settings.width,
			pixelHeight: this.settings.height,
			colorSignificant: toHex(this.settings.defaultSignColor, 'red'),
			colorSignificantUp: caseColor,
			colorSignificantDown: controlColor,
			colorNonsignificant: toHex(this.settings.defaultNonSignColor, 'black'),
			dotRadius,
			maxInteractiveDots: this.settings.maxInteractiveDots,
			// Render the PNG at device-pixel resolution so it stays sharp on
			// retina screens. The server reports the plot extent in CSS-space,
			// so SVG overlay coords are unaffected.
			//
			// Oversample by 2× so the PNG also stays sharp when the user
			// *zooms in after* the initial render (the captured DPR is frozen
			// at fetch time — bigger headroom = more tolerable post-render
			// zoom before pixelation appears). The server clamp keeps the
			// bitmap memory bounded.
			devicePixelRatio: (typeof window !== 'undefined' ? window.devicePixelRatio : 1) * 2
		}
		return render
	}

	//This is a workaround until the server can accept an arr of confounder tws
	addConfounderTw(body) {
		const confounders = this.config?.confounderTws
		if (confounders?.length) {
			body.tw = this.config.confounderTws[0]
			if (confounders.length > 1) body.tw2 = this.config.confounderTws[1]
		}
	}

	/** The "others" group arrives as a placeholder with {in: false}. Replace it with the group that
	 * it stands for: the filter of the app without the samples of the other group, which the server
	 * resolves. */
	setOthersGroup(samplelst) {
		samplelst.groups = withOthersGroup(samplelst.groups, this.app.getState().termfilter)
	}

	/** A group that the server resolved from a filter lists no sample here. Keep the number of its
	 * samples that the analysis ran on, where the group does not carry one, for getSampleNum(). */
	setGroupSizes(response) {
		for (const [i, g] of this.config.samplelst.groups.entries()) {
			const n = response[`sample_size${i + 1}`]
			if (!Array.isArray(g.values) && g.sampleCount === undefined && Number.isFinite(n)) g.sampleCount = n
		}
	}
}
