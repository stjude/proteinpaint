const disabled = {
	color: '#ccc'
}

export const icons = {
	x: (elem, o) => {
		return (
			elem
				.attr('title', o.title)
				.style('padding', '0 3px')
				.style('color', 'rgb(255,100,100)')
				.style('opacity', 0.9)
				.style('font-weight', 700)
				.style('font-size', '18px')
				.style('transform', 'rotate(-45deg)')
				.style('cursor', 'pointer')
				//.html('&otimes;')
				.html('&oplus;')
				.on('click', o.handler)
		)
	},
	plus: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('opacity', 0.9)
			.style('font-size', '18px')
			.html('&oplus;')
			.on('click', o.handler)
	},
	combine: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('opacity', 0.9)
			.style('font-size', '12px')
			.style('color', 'rgb(100,100,255)')
			.style('cursor', 'pointer')
			.html('[]+[]')
			.on('click', o.handler)
	},
	divide: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('opacity', 0.9)
			.style('font-size', '12px')
			.style('color', 'rgb(100,100,255)')
			.style('cursor', 'pointer')
			.html('[&divide;]')
			.on('click', o.handler)
	},
	expand: (elem, o) => {
		return (
			elem
				.attr('title', o.title)
				.style('padding', '0 3px')
				.style('height', '16px')
				.style('color', 'rgb(100,100,255)')
				.style('opacity', 0.9)
				.style('font-size', '16px')
				.style('padding', '0 2px')
				.style('margin', '0 2px 2px 1px')
				.style('display', 'display' in o ? o.display : 'inline-block')
				.style('cursor', 'pointer')
				//.style('border','1px solid #aaa')
				//.style('background-color','#ccc')
				.html(
					`<svg width='16' height='12' style='margin:0;overflow:visible'>
				<g transform='translate(0,0)'>
					<line x1='1' y1='0' x2='1' y2='12' style='stroke:rgb(100,100,255);stroke-width:2px'></line>
					<path d='M2,6L7,3L7,9Z' style='fill:rgb(100,100,255)'></path>
					<path d='M9,3L14,6L9,9Z' style='fill:rgb(100,100,255)'></path>
					<line x1='15' y1='0' x2='15' y2='12' style='stroke:rgb(100,100,255);stroke-width:2px'></line>
				</g>
			</svg>`
				)
				.on('click', o.handler)
		)
	},
	collapse: (elem, o) => {
		return (
			elem
				.attr('title', o.title)
				.style('padding', '0 3px')
				.style('height', '16px')
				.style('color', 'rgb(100,100,255)')
				.style('opacity', 0.9)
				.style('font-size', '16px')
				.style('padding', '0 2px')
				.style('margin', '0 1px 2px 1px')
				.style('display', 'display' in o ? o.display : 'inline-block')
				.style('cursor', 'pointer')
				//.style('border','1px solid #aaa')
				//.style('background-color','#ccc')
				.html(
					`<svg width='16' height='12' style='margin:0;overflow:visible'>
				<g transform='translate(0,0)'>
					<line x1='6' y1='0' x2='6' y2='12' style='stroke:rgb(100,100,255);stroke-width:2px'></line>
					<path d='M0,3L5,6L0,9Z' style='fill:rgb(100,100,255)'></path>
					<path d='M10,6L16,3L16,9Z' style='fill:rgb(100,100,255)'></path>
					<line x1='9' y1='0' x2='9' y2='12' style='stroke:rgb(100,100,255);stroke-width:2px'></line>
				</g>
			</svg>`
				)
				.on('click', o.handler)
		)
	},
	corner: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('color', o.disabled ? disabled.color : 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('cursor', 'pointer')
			.html('&#8689;')
			.on('click', o.handler)
	},
	left: (elem, o) => {
		const fill = o.disabled ? disabled.color : 'rgb(100,100,255)'
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('color', o.disabled ? disabled.color : 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('padding', '3px')
			.style('cursor', 'pointer')
			.html(
				`<svg width='12' height='12'>
				<g transform='translate(0,1)'>
					<path d='M0,6L12,0L12,12Z' style='fill:${fill}'></path>
				</g>
			</svg>`
			)
			.on('click', o.handler)
	},
	right: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('padding-top', '3px')
			.style('cursor', 'pointer')
			.html(
				`<svg width='12' height='12'>
				<g transform='translate(0,0)'>
					<path d='M0,0L12,6L0,12Z' style='fill:rgb(100,100,255)'></path>
				</g>
			</svg>`
			)
			.on('click', o.handler)
	},
	up: (elem, o) => {
		const fill = o.disabled ? disabled.color : 'rgb(100,100,255)'
		return (
			elem
				.attr('title', o.title)
				.style('padding', '0 3px')
				//.style('color', 'rgb(100,100,255)')
				.style('opacity', 0.9)
				.style('font-size', '16px')
				.style('cursor', 'pointer')
				.html(
					`<svg width='12' height='12'>
				<path d='M6,0L12,12L0,12Z' style='fill:${fill}'></path>
			</svg>`
				)
				.on('click', o.handler)
		)
	},
	down: (elem, o) => {
		const fill = o.disabled ? disabled.color : 'rgb(100,100,255)'
		return (
			elem
				.attr('title', o.title)
				.style('padding', '0 3px')
				//.style('color', 'rgb(100,100,255)')
				.style('opacity', 0.9)
				.style('font-size', '16px')
				.style('cursor', 'pointer')
				.html(
					`<svg width='12' height='12'>
				<g transform='translate(0,1)'>
					<path d='M0,0L12,0L6,12Z' style='fill:${fill}'></path>
				</g>
			</svg>`
				)
				.on('click', o.handler)
		)
	},
	updown: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '18px')
			.style('font-weight', 800)
			.style('text-decoration', 'underline')
			.style('cursor', 'pointer')
			.html('&#8693;')
			.on('click', o.handler)
	},
	seHookArrow: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '18px')
			.style('font-weight', 800)
			.style('cursor', 'pointer')
			.html('&#10533;')
			.on('click', o.handler)
	},
	swHookArrow: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '18px')
			.style('font-weight', 800)
			.style('cursor', 'pointer')
			.html('&#10534;')
			.on('click', o.handler)
	},
	unlock: (elem, o) => {
		return (
			elem
				.attr('title', o.title)
				.style('padding', '0 3px')
				//.style('color', 'rgb(100,100,255)')
				.style('opacity', 0.9)
				//.style('font-size', '18px')
				//.style('font-weight',800)
				.html(
					`<svg width='12' height='12'>
			<g transform="scale(0.045)" fill="rgb(100,100,255)">
				<path d="m299.02 161.26h-185.84v-46.28c0-41.34 33.635-74.979 74.979-74.979 33.758 0 63.51 22.716 72.36 55.24 2.898 10.657 13.888 16.946 24.547 14.05 10.659-2.898 16.949-13.889 14.05-24.548-13.57-49.896-59.2-84.74-110.96-84.74-63.4 0-114.98 51.58-114.98 114.98v46.715c-9.06 1.902-15.888 9.952-15.888 19.571v175.05c0 11.03 8.972 20 20 20h221.73c11.03 0 20-8.972 20-20v-175.05c0-11.03-8.972-20-20-20"/>
			</g>
		</svg>`
				)
				.on('click', o.handler)
		)
	},
	leftBorder: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('padding', '3px')
			.style('cursor', 'pointer')
			.html(
				`<svg width='12' height='12'>
				<g transform='translate(0,1)'>
					<path d='M1,6L11,1L11,11Z' style='stroke:rgb(100,100,255); stroke-width:1px; fill:#ececec'></path>
				</g>
			</svg>`
			)
			.on('click', o.handler)
	},
	leftCrossedOut: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('padding', '3px')
			.style('cursor', 'pointer')
			.html(
				`<svg width='12' height='12'>
				<g transform='translate(0,1)'>
					<path d='M1,6L11,1L11,11Z' style='stroke:rgb(100,100,255); stroke-width:1px; fill:#ececec'></path>
					<text x='3' y='10' style='font-size:12; fill:#f00; font-weight:bold'>X</text>
				</g>
			</svg>`
			)
			.on('click', o.handler)
	},
	filter: (elem, o) => {
		elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('padding', '3px')
			.style('cursor', 'pointer')
			.on('click', o.handler)

		elem.iconPath = elem
			.append('svg')
			.attr('width', 16)
			.attr('height', 12)
			.append('g')
			.attr('transform', 'translate(8,1)')
			.append('path')
			.attr('d', 'M8,0L2,6L2,12L-2,12L-2,6L-8,0Z')
			.style('fill', 'rgb(100,100,255)')

		return elem
	},
	colorScale: (elem, o) => {
		return (
			elem
				.attr('title', o.title)
				.style('padding', '0 3px')
				.style('color', 'rgb(100,100,255)')
				.style('opacity', 0.9)
				//.style('font-size', '8px')
				//.style('padding','3px')
				.html(
					`<svg width='12' height='12'>
				<defs>
					<linearGradient id='` +
						o.linearGradientId +
						`'>
						<stop offset='0' stop-color='red'></stop>
						<stop offset='1' stop-color='blue'></stop>
					</linearGradient>
				</defs>
				<g transform='translate(0,1)'>
					<rect x='0' y='1' width='10' height='10' fill='url(#` +
						o.linearGradientId +
						`)'></rect>
				</g>
			</svg>`
				)
				.on('click', o.handler)
		)
	},
	bar: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('padding', '3px')
			.style('cursor', 'pointer')
			.html(
				`<svg width='12' height='12'>
				<g transform='translate(0,1)'>
					<rect x='0' y='0' width='3' height='11' fill='rgb(100,100,255)'></rect>
					<rect x='4' y='6' width='3' height='5' fill='rgb(100,100,255)'></rect>
					<rect x='8' y='3' width='3' height='8' fill='rgb(100,100,255)'></rect>
				</g>
			</svg>`
			)
			.on('click', o.handler)
	},
	rect: (elem, o) => {
		return elem
			.attr('title', o.title)
			.style('padding', '0 3px')
			.style('stroke', 'rgb(100,100,255)')
			.style('fill', 'fill' in o ? o.fill : 'none')
			.style('opacity', 0.9)
			.html(
				`<svg width='12' height='12'>
				<g transform='translate(0,1)'>
					<rect x="0" y="1" width="10" height="10"></rect>
				</g>
			</svg>`
			)
			.on('click', o.handler)
	},
	text: (elem, o) => {
		const addWrapper = elem.append('div').style('display', 'none')

		const input = addWrapper.append('input')
		input
			.attr('type', 'text')
			.style('width', o.width + 'px')
			.style('margin', '0 0 1px 2px')
			.style('border', '1px solid #aaa')
			.style('border-spacing', 0)
			.style('height', '21px')
			.style('padding', 0)
			.style('background-color', '#fff')
			.style('cursor', 'pointer')
			.on('change', o.handler)
			.on('click.tphm2', event => event.stopPropagation())

		addWrapper
			.append('button')
			.style('margin', 0)
			.style('border-spacing', 0)
			//.style('height','21px')
			.style('padding', '2px')
			.html('add')
			.on('click', o.handler)

		return {
			wrapper: addWrapper,
			input: input
		}
	},
	html: (elem, o) => {
		select(elem.node().parentNode)
			.append('span')
			.html(o.html)
		if (o.styles) {
			for (const s in styles) {
				elem.style(s, styles[s])
			}
		}
		return elem
	}
}
