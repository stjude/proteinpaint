//Icons from bootstrap: https://icons.getbootstrap.com/
export const shapes = {
	//circle filled
	filledCircle: {
		path: 'M 8,8 m 8,0 a 8,8 0 1,0 -16,0 a 8,8 0 1,0 16,0',
		isFilled: true
	},

	//rectangle empty
	// https://icons.getbootstrap.com/icons/file/
	emptyVerticalRectangle: {
		path: 'M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1',
		calculatePath: opts => {
			const _opts = { height: 16, width: 16 }
			Object.assign(_opts, opts)
			const { width, height } = _opts

			return `M-${width / 2},-${height / 2}h${width}v${height}h-${width}z`
		},
		isFilled: false
	},

	//circle empty
	//https://icons.getbootstrap.com/icons/circle/
	emptyCircle: {
		path: 'M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16',
		calculatePath: opts => {
			const _opts = { radius: 16 }
			Object.assign(_opts, opts)
			const { radius } = _opts

			return `M${radius},0 A${radius},${radius} 0 1,1 ${-radius},0 A${radius},${radius} 0 1,1 ${radius},0 Z`
		},
		isFilled: false
	},

	// shield empty
	// https://icons.getbootstrap.com/icons/shield/
	emptyShield: {
		path: 'M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.7 10.7 0 0 0 2.287 2.233c.346.244.652.42.893.533q.18.085.293.118a1 1 0 0 0 .101.025 1 1 0 0 0 .1-.025q.114-.034.294-.118c.24-.113.547-.29.893-.533a10.7 10.7 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56',
		calculatePath: opts => {
			const _opts = { width: 16, height: 24 }
			Object.assign(_opts, opts)
			const { width, height } = _opts

			const halfWidth = width / 2
			const arcRadius = halfWidth

			return `M-${halfWidth},-${height / 2} A${arcRadius},${arcRadius} 0 0,1 ${halfWidth},-${
				height / 2
			} L${halfWidth},${height * 0.1} L0,${height / 2} L-${halfWidth},${height * 0.1} Z`
		},
		isFilled: false
	},

	// triangle filled
	// https://icons.getbootstrap.com/icons/triangle-fill/
	filledTriangle: {
		path: 'M7.022 1.566a1.13 1.13 0 0 1 1.96 0l6.857 11.667c.457.778-.092 1.767-.98 1.767H1.144c-.889 0-1.437-.99-.98-1.767z',
		calculatePath: opts => {
			const _opts = { height: 16, width: 16 }
			Object.assign(_opts, opts)
			const { width, height } = _opts

			const xOffset = width / 2
			const yOffset = height / 2

			const p1 = `M0,-${yOffset}`
			const p2 = `L${xOffset},${yOffset}`
			const p3 = `L-${xOffset},${yOffset}`

			return `${p1} ${p2} ${p3} Z`
		},
		isFilled: true
	},

	//triangle empty
	//https://icons.getbootstrap.com/icons/triangle/
	emptyTriangle: {
		path: 'M7.938 2.016A.13.13 0 0 1 8.002 2a.13.13 0 0 1 .063.016.15.15 0 0 1 .054.057l6.857 11.667c.036.06.035.124.002.183a.2.2 0 0 1-.054.06.1.1 0 0 1-.066.017H1.146a.1.1 0 0 1-.066-.017.2.2 0 0 1-.054-.06.18.18 0 0 1 .002-.183L7.884 2.073a.15.15 0 0 1 .054-.057m1.044-.45a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767z',
		calculatePath: opts => {
			const _opts = { height: 16, width: 16 }
			Object.assign(_opts, opts)
			const { width, height } = _opts

			const xOffset = width / 2
			const yOffset = height / 2

			const p1 = `M0,-${yOffset}`
			const p2 = `L${xOffset},${yOffset}`
			const p3 = `L-${xOffset},${yOffset}`

			return `${p1} ${p2} ${p3} Z`
		},
		isFilled: false
	},

	//shield filled
	filledShield: {
		path: 'M5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56',
		isFilled: true
	},

	//diamond filled
	filledDiamond: {
		path: 'M6.95.435c.58-.58 1.52-.58 2.1 0l6.515 6.516c.58.58.58 1.519 0 2.098L9.05 15.565c-.58.58-1.519.58-2.098 0L.435 9.05a1.48 1.48 0 0 1 0-2.098z',
		isFilled: true
	},

	//cross large
	largeCross: {
		path: 'M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z'
	},

	//diamond empty
	emptyDiamond: {
		path: 'M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z',
		isFilled: false
	},

	//plus
	plusIcon: {
		path: 'M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2'
	},

	// egg filled
	filledEgg: {
		path: 'M14 10a6 6 0 0 1-12 0C2 5.686 5 0 8 0s6 5.686 6 10',
		isFilled: true
	},

	//pentagon filled
	filledPentagon: {
		path: 'M7.685.256a.5.5 0 0 1 .63 0l7.421 6.03a.5.5 0 0 1 .162.538l-2.788 8.827a.5.5 0 0 1-.476.349H3.366a.5.5 0 0 1-.476-.35L.102 6.825a.5.5 0 0 1 .162-.538l7.42-6.03Z',
		isFilled: true
	},

	//egg empty
	emptyEgg: {
		path: 'M8 15a5 5 0 0 1-5-5c0-1.956.69-4.286 1.742-6.12.524-.913 1.112-1.658 1.704-2.164C7.044 1.206 7.572 1 8 1s.956.206 1.554.716c.592.506 1.18 1.251 1.704 2.164C12.31 5.714 13 8.044 13 10a5 5 0 0 1-5 5m0 1a6 6 0 0 0 6-6c0-4.314-3-10-6-10S2 5.686 2 10a6 6 0 0 0 6 6',
		isFilled: false
	},

	//pentagon empty
	emptyPentagon: {
		path: 'M7.685 1.545a.5.5 0 0 1 .63 0l6.263 5.088a.5.5 0 0 1 .161.539l-2.362 7.479a.5.5 0 0 1-.476.349H4.099a.5.5 0 0 1-.476-.35L1.26 7.173a.5.5 0 0 1 .161-.54l6.263-5.087Zm8.213 5.28a.5.5 0 0 0-.162-.54L8.316.257a.5.5 0 0 0-.631 0L.264 6.286a.5.5 0 0 0-.162.538l2.788 8.827a.5.5 0 0 0 .476.349h9.268a.5.5 0 0 0 .476-.35l2.788-8.826Z',
		isFilled: false
	},

	//suit diamond filled
	filledDiamondSuit: {
		path: 'M2.45 7.4 7.2 1.067a1 1 0 0 1 1.6 0L13.55 7.4a1 1 0 0 1 0 1.2L8.8 14.933a1 1 0 0 1-1.6 0L2.45 8.6a1 1 0 0 1 0-1.2',
		isFilled: true
	},

	//square empty
	//https://icons.getbootstrap.com/icons/square/
	emptySquare: {
		path: 'M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z',
		calculatePath: opts => {
			const _opts = { height: 16, width: 16 }
			Object.assign(_opts, opts)
			const { width, height } = _opts

			return `M-${width / 2},-${height / 2} h${width} v${height} h-${width} Z`
		},
		isFilled: false
	},

	//suit diamond empty
	emptyDiamondSuit: {
		path: 'M6.95.435c.58-.58 1.52-.58 2.1 0l6.515 6.516c.58.58.58 1.519 0 2.098L9.05 15.565c-.58.58-1.519.58-2.098 0L.435 9.05a1.48 1.48 0 0 1 0-2.098zm1.4.7a.495.495 0 0 0-.7 0L1.134 7.65a.495.495 0 0 0 0 .7l6.516 6.516a.495.495 0 0 0 .7 0l6.516-6.516a.495.495 0 0 0 0-.7L8.35 1.134z',
		isFilled: false
	},

	//cross
	crossShape: {
		path: 'M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708'
	},

	//square filled
	// https://icons.getbootstrap.com/icons/square-fill/
	filledSquare: {
		path: 'M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2z',
		calculatePath(opts) {
			const _opts = { height: 16, width: 16 }
			Object.assign(_opts, opts)
			const { width, height } = _opts

			return `M-${width / 2},-${height / 2} h${width} v${height} h-${width} Z`
		},
		isFilled: true
	},

	//rectangle filled
	// https://icons.getbootstrap.com/icons/file-fill/
	filledVerticalRectangle: {
		path: 'M4 0h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2',
		calculatePath: opts => {
			const _opts = { height: 16, width: 16 }
			Object.assign(_opts, opts)
			const { width, height } = _opts

			return `M-${width / 2},-${height / 2}h${width}v${height}h-${width}z`
		},
		isFilled: true
	}
}

export const shapesArray = Object.values(shapes).map(shape => shape.path)
