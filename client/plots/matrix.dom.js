import { Menu } from '#dom/menu'

export function setMatrixDom(opts) {
	const holder = opts.controls ? opts.holder : opts.holder.append('div')
	holder.style('position', 'relative')
	const controls = this.opts.controls || holder.append('div')
	const loadingDiv = holder
		.append('div')
		.style('position', 'absolute')
		.style('top', this.opts.controls ? 0 : '50px')
		.style('left', '50px')
	const errdiv = holder
		.append('div')
		.attr('class', 'sja_errorbar')
		.style('display', 'none')
	const svg = holder
		.append('svg')
		.style('margin', '20px 10px')
		.style('overflow', 'visible')
		.on('mousemove.label', this.svgMousemove)
		.on('mouseup.label', this.svgMouseup)

	this.seriesClipId = `sjpp_clip_${this.id}`

	const mainG = svg
		.append('g')
		//.style('overflow', 'hidden')
		.on('mouseover', this.showCellInfo)
		.on('mousemove', this.showCellInfo)
		.on('mouseout', this.mouseout)

	const rectsG = mainG.append('g').attr('clip-path', `url(#${this.seriesClipId})`)
	// parent g for sample, term labels g
	const sampleLabelsPG = mainG.append('g')
	const termLabelsPG = mainG.append('g')

	const tip = new Menu({ padding: '5px' })
	this.dom = {
		header: opts.header,
		holder,
		contentNode: opts.holder.node().closest('.sjpp-output-sandbox-content') || opts.holder.node().parentNode,
		errdiv,
		controls,
		loadingDiv,
		svg,
		clipRect: svg
			.append('defs')
			.append('clipPath')
			.attr('id', this.seriesClipId)
			//.attr('clipPathUnits', 'objectBoundingBox')
			.attr('clipPathUnits', 'userSpaceOnUse')
			.append('rect')
			.attr('display', 'block'),
		mainG,
		cluster: rectsG
			.append('g')
			.attr('class', 'sjpp-matrix-cluster-g')
			.on('mousedown', this.seriesesGMousedown)
			.on('mousemove', this.seriesesGMousemove),
		//.on('mouseup', this.seriesesGMouseup),
		seriesesG: rectsG
			.append('g')
			.attr('class', 'sjpp-matrix-serieses-g')
			.on('mousedown', this.seriesesGMousedown),
		//.on('mousemove', this.seriesesGMousemove)
		//.on('mouseup', this.seriesesGMouseup),
		sampleLabelsPG,
		sampleGrpLabelG: sampleLabelsPG
			.append('g')
			.attr('class', 'sjpp-matrix-series-group-label-g')
			.on('click', this.showSampleGroupMenu)
			.on('mousedown.sjppMatrixLabelText', this.enableTextHighlight)
			.on('mouseup.sjppMatrixLabelText', this.disableTextHighlight),
		sampleLabelG: sampleLabelsPG
			.append('g')
			.attr('class', 'sjpp-matrix-series-label-g')
			.on('mousedown.sjppMatrixLabelText', this.enableTextHighlight)
			.on('mouseup.sjppMatrixLabelText', this.disableTextHighlight)
			.on('click', event => this.mouseclick(event)),
		/* // TODO: sample label drag to move
			.on('mouseover', this.sampleLabelMouseover)
			.on('mouseout', this.sampleLabelMouseout)
			.on('mousedown', this.sampleLabelMousedown)
			.on('mousemove', this.sampleLabelMousemove)
			.on('mouseup', this.sampleLabelMouseup)*/
		termLabelsPG,
		termGrpLabelG: termLabelsPG
			.append('g')
			.attr('class', 'sjpp-matrix-term-group-label-g')
			.on('mouseover', this.termGrpLabelMouseover)
			.on('mouseout', this.termGrpLabelMouseout)
			.on('mousedown', this.termGrpLabelMousedown)
			.on('mousemove', this.termGrpLabelMousemove)
			.on('mouseup', this.termGrpLabelMouseup)
			.on('mousedown.sjppMatrixLabelText', this.enableTextHighlight)
			.on('mouseup.sjppMatrixLabelText', this.disableTextHighlight),
		termLabelG: termLabelsPG
			.append('g')
			.attr('class', 'sjpp-matrix-term-label-g')
			.on('mouseover', this.termLabelMouseover)
			.on('mouseout', this.termLabelMouseout)
			.on('mousedown', this.termLabelMousedown)
			.on('mousemove', this.termLabelMousemove)
			.on('mouseup', this.termLabelMouseup)
			.on('mousedown.sjppMatrixLabelText', this.enableTextHighlight)
			.on('mouseup.sjppMatrixLabelText', this.disableTextHighlight),
		scroll: mainG.append('g'),
		//legendDiv: holder.append('div').style('margin', '5px 5px 15px 50px'),
		legendG: mainG.append('g'),
		tip,
		menutop: tip.d.append('div'),
		menubody: tip.d.append('div')
	}

	this.dom.tip.onHide = () => {
		this.lastActiveLabel = this.activeLabel
		delete this.activeLabel
	}
}
