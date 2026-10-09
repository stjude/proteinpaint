export type NavTab = {
	top: string
	mid: string
	btm: string
	subheader: string
	hide?: boolean
	disabled?: boolean
	disabledMessage?: string
	[key: string]: any
}

export type NavTabCell = {
	rowNum: number
	key: 'top' | 'mid' | 'btm'
	colNum: number
	label: string
	subheader: string
	disabled?: boolean
	disabledMessage?: string
}
