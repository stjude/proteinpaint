import type { CnvType } from './CnvType.ts'

export default class CnvLegend {
	text: string
	cnvType: CnvType
	color: string
	value: number

	constructor(text: string, cnvType: CnvType, color: string, value: number) {
		this.text = text
		this.cnvType = cnvType
		this.color = color
		this.value = value
	}
}
