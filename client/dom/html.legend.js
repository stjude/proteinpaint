import { select } from 'd3-selection'

export default function htmlLegend(legendDiv, viz = { settings: {}, handlers: {} }) {
	const isHidden = {}

	function render(data) {
		const s = viz.settings
		legendDiv.selectAll('*').remove()
		legendDiv
			.style(
				'text-align',
				data.legendTextAlign || s.legendTextAlign || (s.legendOrientation == 'vertical' ? 'left' : 'center')
			)
			.style('display', s.legendOrientation == 'grid' ? 'grid' : '')
			//.style('grid-template-cols', s.legendOrientation == 'grid' ? 'auto auto' : '')
			.style('grid-template-rows', s.legendOrientation == 'grid' ? 'auto auto' : '')
			.style('gap', s.legendOrientation == 'grid' ? '10px' : '')
			.selectAll('div')
			.data(data)
			.enter()
			.append('div')
			.each(addLegendRow)

		if (s.legendChartSide == 'right') {
			setTimeout(() => {
				const pbox = viz.dom.container.node().parentNode.getBoundingClientRect()
				const mbox = viz.dom.container.node().getBoundingClientRect()
				const lbox = viz.dom.legendDiv.node().getBoundingClientRect()
				const currPadTop = parseFloat(viz.dom.legendDiv.style('padding-top'))
				const padTop = pbox.height - mbox.height + (mbox.height - lbox.height + currPadTop) / 2
				if (Math.abs(currPadTop - padTop) < 20) return
				//console.log(padTop, pbox.height, mbox.height, lbox.height)
				viz.dom.legendDiv
					.transition()
					.duration(100)
					.style('padding-top', padTop < 0 ? 0 : padTop + 'px')
			}, 1200)
		}
	}

	function addLegendRow(d) {
		const s = viz.settings
		const div = select(this).style(
			'display',
			s.legendOrientation == 'vertical' || s.legendOrientation == 'grid' ? 'block' : 'inline-block'
		)

		if (d.name) {
			if (s.legendChartSide == 'right') {
				div.style('text-align', 'left')

				div
					.append('div')
					.style('font-size', s.legendFontSize)
					.style('font-weight', 600)
					.html(d.name)

				div
					.append('div')
					.selectAll('div')
					.data(d.items)
					.enter()
					.append('div')
					.style('display', s.legendOrientation == 'vertical' ? 'block' : 'inline-block')
					.style('margin-right', '5px')
					.each(addLegendItem)
			} else {
				div.style('white-space', 'nowrap').style('width', s.legendOrientation == 'vertical' ? 'fit-content' : null)

				div
					.append('div')
					.style(
						'display',
						s.legendOrientation == 'grid' || s.legendOrientation == 'vertical' ? 'block' : 'inline-block'
					)
					.style('width', d.rowLabelHangLeft ? d.rowLabelHangLeft + 'px' : null)
					.style('margin-left', s.legendOrientation == 'vertical' ? '15px' : null)
					.style('text-align', d.rowLabelHangLeft ? 'right' : null)
					.style('font-weight', 600)
					.style('vertical-align', 'top')
					.html(d.name)

				div
					.append('div')
					.style(
						'display',
						s.legendOrientation == 'grid' || s.legendOrientation == 'vertical' ? 'block' : 'inline-block'
					)
					.style('max-width', 1.2 * d.rowLabelHangLeft + 'px')
					.style('white-space', 'normal')
					.style('vertical-align', 'top')
					.selectAll('div')
					.data(d.items)
					.enter()
					.append('div')
					.style('display', 'inline-block')
					.style('margin-left', '15px')
					.each(addLegendItem)
			}
		} else {
			div
				.selectAll('div')
				.data(d.items)
				.enter()
				.append('div')
				.style('display', s.legendOrientation == 'vertical' ? 'block' : 'inline-block')
				.style('margin-left', '15px')
				.each(addLegendItem)
		}
	}

	function addLegendItem(d) {
		const s = viz.settings
		const div = select(this)
		const color = d.fill ? d.fill : d.stroke ? d.stroke : d.color

		div
			.style('opacity', !d.isHidden ? 1 : d.hiddenOpacity ? d.hiddenOpacity : 0.3)
			.attr('class', 'legend-row')
			.style('display', s.legendOrientation == 'vertical' ? 'block' : 'inline-block')
			.style('width', s.legendOrientation == 'vertical' ? 'fit-content' : null)

		if (d.svg) {
			div
				.append('svg')
				.attr('width', d.svgw)
				.attr('height', d.svgh)
				.style('display', 'inline-block')
				.style('vertical-align', 'top')
				.style('border', d.border)
				.html(d => d.svg)
		} else if (!d.noIcon) {
			div
				.append('div')
				.style('display', 'inline-block')
				.style('position', 'relative')
				.style('min-width', '12px')
				.style('height', '12px')
				.style('top', '1px')
				.style('border', d.border ? d.border : '1px solid ' + color)
				.style('border-radius', d.shape == 'circle' ? '6px' : '')
				.style('background-color', d.shape == 'circle' ? '' : color)
				.style('cursor', 'isHidden' in d ? 'pointer' : 'default')
				.style('color', d.textColor ? d.textColor : '#fff')
				.style('font-size', '10px')
				.style('vertical-align', d.inset ? 'top' : '')
				.style('padding', d.inset ? '0 3px' : '')
				.text(d.inset)
		}

		div
			.append('div')
			.style('display', 'inline-block')
			.style('margin-left', d.svg ? '1px' : '3px')
			.style('cursor', d.isHidden ? 'pointer' : 'default')
			.style('font-size', s.legendFontSize)
			.style('line-height', s.legendFontSize)
			.style('vertical-align', d.svg ? 'top' : null)
			.html(d.text)

		if (Object.keys(viz.handlers).length) {
			div
				.on('click', viz.handlers.legend.click)
				.on('mouseover', viz.handlers.legend.mouseover)
				.on('mouseout', viz.handlers.legend.mouseout)
		}
	}

	return render
}
