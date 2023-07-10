export default interface Arc {
	readonly startAngle: number
	readonly endAngle: number
	readonly innerRadius: number
	readonly outerRadius: number
	readonly text: string
	readonly color: any

	readonly padAngle?: number | undefined
}
