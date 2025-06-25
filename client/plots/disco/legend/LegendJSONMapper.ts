import type Legend from './Legend.ts'
import { CnvType } from '#plots/disco/cnv/CnvType.ts'
import { FusionLegend } from '#plots/disco/fusion/FusionLegend.ts'
import { CnvRenderingType } from '#plots/disco/cnv/CnvRenderingType.ts'
import { scaleLinear } from 'd3-scale'
import { roundValueAuto } from '@sjcrh/proteinpaint-shared/roundValue.js'

export default class LegendJSONMapper {
	private cappedCnvMaxAbsValue: number

	constructor(cappedCnvMaxAbsValue: number) {
		this.cappedCnvMaxAbsValue = cappedCnvMaxAbsValue
	}

	map(legend: Legend) {
		const legendJSON: Array<any> = []

		let order = 0
		if (legend.snvClassMap) {
			this.mapSnv(legend, legendJSON, order++)
		}

		if (legend.cnvRenderingType == CnvRenderingType.heatmap) {
			this.mapCnvHeatmap(legend, legendJSON, order++)
		} else if (legend.cnvRenderingType == CnvRenderingType.bar) {
			if (legend.cnvClassMap) {
				this.mapCnvBar(legend, legendJSON, order++)
			}
		}

		if (legend.lohLegend) {
			this.mapLoh(legend, legendJSON, order++)
		}

		if (legend.fusionLegend) {
			this.mapFusion(legend, legendJSON, order++)
		}

		return legendJSON
	}

	private mapSnv(legend: Legend, legendJSON: Array<any>, order: number) {
		const snvItems: Array<any> = []

		let snvOrder = 0

		for (const [snvKey, snvLegendElement] of legend.snvClassMap) {
			snvItems.push({
				termid: legend.snvTitle,
				key: snvKey,
				text: `${snvLegendElement.snvType} (${snvLegendElement.count})`,
				color: snvLegendElement.color,
				order: snvOrder++,
				border: '1px solid #ccc'
			})
		}

		legendJSON.push({
			name: legend.snvTitle,
			order: order,
			items: snvItems
		})
	}

	private mapCnvBar(legend: Legend, legendJSON: Array<any>, order: number) {
		if (!legend.cnvClassMap) return
		const gain = legend.cnvClassMap.get(CnvType.Gain)
		const loss = legend.cnvClassMap.get(CnvType.Loss)
		const cap = legend.cnvClassMap.get(CnvType.Cap)

		if (gain && loss && cap) {
			let cnvOrder = 0
			const cnvItems: Array<any> = []
			if (gain.value > 0) {
				cnvItems.push({
					termid: legend.cnvTitle,
					key: CnvType.Gain,
					text: `Max: ${gain.value}`,
					color: gain.color,
					order: cnvOrder++,
					border: '1px solid #ccc'
				})
			}

			if (loss.value < 0) {
				cnvItems.push({
					termid: legend.cnvTitle,
					key: CnvType.Loss,
					text: `Min: ${loss.value}`,
					color: loss.color,
					order: cnvOrder++,
					border: '1px solid #ccc'
				})
			}

			cnvItems.push({
				termid: legend.cnvTitle,
				key: CnvType.Cap,
				text: `Capping: ${cap.value}`,
				color: cap.color,
				order: cnvOrder++,
				border: '1px solid #ccc'
				// ,
				// onClickCallback: this.onClickCallback
			})

			legendJSON.push({
				name: legend.cnvTitle,
				order: order,
				items: cnvItems
			})
		}
	}

	private mapCnvHeatmap(legend: Legend, legendJSON: Array<any>, order: number) {
		if (!legend.cnvClassMap) return
		const gain = legend.cnvClassMap.get(CnvType.Gain)
		const loss = legend.cnvClassMap.get(CnvType.Loss)
		const cap = legend.cnvClassMap.get(CnvType.Cap)

		if (gain && loss && cap) {
			let cnvOrder = 0

			const cnvItems: Array<any> = []
			const base = {
				termid: legend.cnvTitle,
				width: 100,
				order: cnvOrder++,
				isLegendItem: true,
				dt: 4
			}
			if (gain.value > 0 && loss.value < 0) {
				/** Do not use equidistant domain (like code below) here.
				 * Colorscale will not match the colors in the disco or tooltips. */
				// const maxValue = Math.max(Math.abs(loss.value), gain.value)
				// const domain = [-maxValue, 0, maxValue]
				const domain = [roundValueAuto(loss.value), 0, roundValueAuto(gain.value)]
				cnvItems.push(
					Object.assign(
						{
							key: CnvType.LossGain,
							domain,
							colors: [loss.color, 'white', gain.color],
							labels: { left: 'Loss', right: 'Gain' },
							showNumsAsIs: true,
							numericInputs: {
								cutoffMode: legend.cnvCutoffMode,
								defaultPercentile: legend.cnvPercentile,
								callback: obj => legend.discoInteractions.colorScaleNumericInputsCallback(obj)
							}
						},
						base
					)
				)
			} else {
				if (gain.value > 0) {
					cnvItems.push(
						Object.assign(
							{
								key: CnvType.Gain,
								text: 'Copy number gain',
								domain: [0, gain.value],
								scale: scaleLinear([0, 1], ['white', gain.color])
							},
							base
						)
					)
				}
				if (loss.value < 0) {
					cnvItems.push(
						Object.assign(
							{
								key: CnvType.Loss,
								text: 'Copy number loss',
								domain: [loss.value, 0],
								scale: scaleLinear([0, 1], [loss.color, 'white'])
							},
							base
						)
					)
				}
			}
			legendJSON.push({
				name: legend.cnvTitle,
				order: order,
				items: cnvItems
			})
		}
	}

	private mapLoh(legend: Legend, legendJSON: Array<any>, order: number) {
		if (!legend.lohLegend) return
		const lohItems: Array<any> = []

		lohItems.push({
			termid: legend.lohTitle,
			key: 'min',
			text: 'min',
			color: legend.lohLegend.colorStartValue,
			order: 0,
			border: '1px solid #ccc'
		})

		lohItems.push({
			termid: legend.lohTitle,
			key: 'max',
			text: 'max',
			color: legend.lohLegend.colorEndValue,
			order: 1,
			border: '1px solid #ccc'
		})

		legendJSON.push({
			name: legend.lohTitle,
			order: order,
			items: lohItems
		})
	}

	private mapFusion(legend: Legend, legendJSON: Array<any>, order: number) {
		const fusionItems: Array<any> = []

		fusionItems.push({
			termid: legend.fusionTitle,
			key: FusionLegend.Interchromosomal,
			text: 'Interchromosomal',
			color: FusionLegend.Interchromosomal.valueOf(),
			order: 0,
			border: '1px solid #ccc'
		})

		fusionItems.push({
			termid: legend.fusionTitle,
			key: FusionLegend.Intrachromosomal,
			text: 'Intrachromosomal',
			color: FusionLegend.Intrachromosomal.valueOf(),
			order: 1,
			border: '1px solid #ccc'
		})

		legendJSON.push({
			name: legend.fusionTitle,
			order: order,
			items: fusionItems
		})
	}
}
