import type Legend from './Legend.ts'
import { CnvType } from '#plots/disco/cnv/CnvType.ts'
import { FusionLegend } from '#plots/disco/fusion/FusionLegend.ts'
import { CnvRenderingType } from '#plots/disco/cnv/CnvRenderingType.ts'
import { scaleLinear } from 'd3-scale'
import { rgb } from 'd3-color'

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
				const maxValue = Math.max(Math.abs(loss.value), gain.value)
				const domain = [-maxValue, 0, maxValue]
				const colors = [loss.color, 'white', gain.color]

				if (gain.value < maxValue) {
					/** Insert the real gain max value to show the gradient correctly.
					 * Fixes the problem with the colors not appearing to not match
					 * the tooltips or the plot*/
					const lossColor = rgb(loss.color)
					const midwayLossColor = rgb(
						(lossColor.r + 255) / 2,
						(lossColor.g + 255) / 2,
						(lossColor.b + 255) / 2
					).formatHex()
					domain.splice(1, 0, -maxValue / 2)
					colors.splice(1, 0, midwayLossColor)

					domain.splice(3, 0, maxValue / 2)
					colors.splice(3, 0, gain.color)
				}

				if (loss.value > -maxValue) {
					/** Same reason as above */
					const gainColor = rgb(gain.color)
					const midwayGainColor = rgb(
						(gainColor.r + 255) / 2,
						(gainColor.g + 255) / 2,
						(gainColor.b + 255) / 2
					).formatHex()
					domain.splice(1, 0, -maxValue / 2)
					colors.splice(1, 0, midwayGainColor)

					domain.splice(3, 0, maxValue / 2)
					colors.splice(3, 0, loss.color)
				}

				cnvItems.push(
					Object.assign(
						{
							key: CnvType.LossGain,
							domain,
							colors,
							labels: { left: 'Loss', right: 'Gain' },
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
