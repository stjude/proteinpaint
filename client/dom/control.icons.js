//We use icons from https://icons.getbootstrap.com/ here, therefore we include their license
/**********************************
 The MIT License (MIT)
Copyright (c) 2019-2021 The Bootstrap Authors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
***********************************/

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
	},
	restart: (elem, opts) => {
		const _opts = { color: 'black', width: 18, height: 18 }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-house-fill" viewBox="0 0 16 16">
		<path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
		<path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
	  </svg>`
		elem.html(svg).on('click', opts.handler)
	},
	zoomIn: (elem, opts) => {
		const _opts = { color: 'black', width: 18, height: 18 }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-zoom-in" viewBox="0 0 16 16">
	<path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/>
	<path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/>
	<path fill-rule="evenodd" d="M6.5 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 .5-.5z"/>
	</svg>`
		elem.html(svg).on('click', opts.handler)
	},
	zoomOut: (elem, opts) => {
		const _opts = { color: 'black', width: 18, height: 18 }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-zoom-in" viewBox="0 0 16 16">
		<path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/>
		<path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/>
		<path fill-rule="evenodd" d="M3 6.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/>
	  </svg>`
		elem.html(svg).on('click', opts.handler)
	},
	lasso: (elem, opts) => {
		const color = opts.enabled ? 'black' : 'gray'
		const _opts = { color: color, width: 18, height: 18 }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-zoom-in" viewBox="0 0 16 16">
		<path d="M15.825.12a.5.5 0 0 1 .132.584c-1.53 3.43-4.743 8.17-7.095 10.64a6.067 6.067 0 0 1-2.373 1.534c-.018.227-.06.538-.16.868-.201.659-.667 1.479-1.708 1.74a8.118 8.118 0 0 1-3.078.132 3.659 3.659 0 0 1-.562-.135 1.382 1.382 0 0 1-.466-.247.714.714 0 0 1-.204-.288.622.622 0 0 1 .004-.443c.095-.245.316-.38.461-.452.394-.197.625-.453.867-.826.095-.144.184-.297.287-.472l.117-.198c.151-.255.326-.54.546-.848.528-.739 1.201-.925 1.746-.896.126.007.243.025.348.048.062-.172.142-.38.238-.608.261-.619.658-1.419 1.187-2.069 2.176-2.67 6.18-6.206 9.117-8.104a.5.5 0 0 1 .596.04zM4.705 11.912a1.23 1.23 0 0 0-.419-.1c-.246-.013-.573.05-.879.479-.197.275-.355.532-.5.777l-.105.177c-.106.181-.213.362-.32.528a3.39 3.39 0 0 1-.76.861c.69.112 1.736.111 2.657-.12.559-.139.843-.569.993-1.06a3.122 3.122 0 0 0 .126-.75l-.793-.792zm1.44.026c.12-.04.277-.1.458-.183a5.068 5.068 0 0 0 1.535-1.1c1.9-1.996 4.412-5.57 6.052-8.631-2.59 1.927-5.566 4.66-7.302 6.792-.442.543-.795 1.243-1.042 1.826-.121.288-.214.54-.275.72v.001l.575.575zm-4.973 3.04.007-.005a.031.031 0 0 1-.007.004zm3.582-3.043.002.001h-.002z"/>
		</svg>`
		elem.html(svg).on('click', opts.handler)
	}
}
