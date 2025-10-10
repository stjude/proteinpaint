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
			getHolder(elem, o)
				.style('padding', '0 3px')
				.style('color', 'rgb(255,100,100)')
				.style('opacity', 0.9)
				.style('font-weight', 700)
				.style('font-size', '18px')
				.style('transform', 'rotate(-45deg)')
				.style('cursor', 'pointer')
				//.html('&otimes;')
				.html('&oplus;')
		)
	},
	plus: (elem, o) => {
		return getHolder(elem, o).style('padding', '0 3px').style('opacity', 0.9).style('font-size', '18px').html('&oplus;')
	},
	combine: (elem, o) => {
		return getHolder(elem, o)
			.style('padding', '0 3px')
			.style('opacity', 0.9)
			.style('font-size', '12px')
			.style('color', 'rgb(100,100,255)')
			.style('cursor', 'pointer')
			.html('[]+[]')
	},
	divide: (elem, o) => {
		return getHolder(elem, o)
			.style('padding', '0 3px')
			.style('opacity', 0.9)
			.style('font-size', '12px')
			.style('color', 'rgb(100,100,255)')
			.style('cursor', 'pointer')
			.html('[&divide;]')
	},
	expand: (elem, o) => {
		const color = 'color' in o ? o.color : 'rgb(100,100,255)'
		return (
			getHolder(elem, o)
				.style('height', 'auto')
				.style('color', color)
				.style('opacity', 0.9)
				.style('font-size', 'fontSize' in o ? o.fontSize : '16px')
				.style('padding', 'padding' in o ? o.padding : '0 2px')
				// .style('margin', '0 2px 2px 1px')
				.style('display', 'display' in o ? o.display : 'inline-block')
				.style('cursor', 'pointer')
				//.style('border','1px solid #aaa')
				//.style('background-color','#ccc')
				.html(
					`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="${color}" class="bi bi-square" viewBox="0 0 16 16" >
					  <path stroke='${color}' stroke-width='1' d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
					</svg>`
				)
		)
	},
	collapse: (elem, o) => {
		const color = 'color' in o ? o.color : 'rgb(100,100,255)'
		return (
			getHolder(elem, o)
				.style('height', 'auto')
				.style('color', color)
				.style('opacity', 0.9)
				.style('font-size', 'fontSize' in o ? o.fontSize : '16px')
				.style('padding', 'padding' in o ? o.padding : '0 2px')
				// .style('margin', '0 1px 2px 1px')
				.style('display', 'display' in o ? o.display : 'inline-block')
				.style('cursor', 'pointer')
				//.style('border','1px solid #aaa')
				//.style('background-color','#ccc')
				.html(
					`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="${color}" class="bi bi-dash-lg" viewBox="0 0 16 16">
					  <path stroke='${color}' stroke-width='1' fill-rule="evenodd" d="M2 8a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 8Z"/>
					</svg>`
				)
		)
	},
	corner: (elem, o) => {
		return getHolder(elem, o)
			.style('padding', '0 3px')
			.style('color', o.disabled ? disabled.color : 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('cursor', 'pointer')
			.html('&#8689;')
	},
	left: (elem, o) => {
		const defaultFill = 'rgb(100,100,255)'
		const fill = o.fill ? o.fill : o.disabled ? disabled.color : defaultFill
		const _opts = { color: fill, width: 12, height: 12 }
		Object.assign(_opts, o)
		return getHolder(elem, o)
			.style('padding', '3px')
			.style('color', _opts.disabled ? disabled.color : defaultFill)
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('cursor', 'pointer')
			.html(
				`<svg width='${_opts.width}' height='${_opts.height}'>
				<g transform='translate(0,1)'>
					<path d='M0,${_opts.height / 2}L${_opts.width},0L${_opts.width},${_opts.height}Z' style='fill:${_opts.color}'></path>
				</g>
			</svg>`
			)
	},
	right: (elem, o) => {
		const defaultFill = 'rgb(100,100,255)'
		const fill = o.fill ? o.fill : o.disabled ? disabled.color : defaultFill
		const _opts = { color: fill, width: 12, height: 12 }
		Object.assign(_opts, o)
		return getHolder(elem, o)
			.style('padding', '3px')
			.style('color', _opts.disabled ? disabled.color : defaultFill)
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('cursor', 'pointer')
			.html(
				`<svg width='${_opts.width}' height='${_opts.height}'>
				<g transform='translate(0,1)'>
					<path d='M0,0L${_opts.width},${_opts.height / 2}L0,${_opts.height}Z' style='fill:${_opts.color}'></path>
				</g>
			</svg>`
			)
	},
	up: (elem, o) => {
		const fill = o.disabled ? disabled.color : 'rgb(100,100,255)'
		return (
			getHolder(elem, o)
				.style('padding', '3px')
				//.style('color', 'rgb(100,100,255)')
				.style('opacity', 0.9)
				.style('font-size', '16px')
				.style('cursor', 'pointer')
				.html(
					`<svg width='12' height='12'>
				<path d='M6,0L12,12L0,12Z' style='fill:${fill}'></path>
			</svg>`
				)
		)
	},
	down: (elem, o) => {
		const fill = o.disabled ? disabled.color : 'rgb(100,100,255)'
		return (
			getHolder(elem, o)
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
		)
	},
	updown: (elem, o) => {
		return getHolder(elem, o)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '18px')
			.style('font-weight', 800)
			.style('text-decoration', 'underline')
			.style('cursor', 'pointer')
			.html('&#8693;')
	},
	seHookArrow: (elem, o) => {
		return getHolder(elem, o)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '18px')
			.style('font-weight', 800)
			.style('cursor', 'pointer')
			.html('&#10533;')
	},
	swHookArrow: (elem, o) => {
		return getHolder(elem, o)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '18px')
			.style('font-weight', 800)
			.style('cursor', 'pointer')
			.html('&#10534;')
	},
	unlock: (elem, o) => {
		return (
			getHolder(elem, o)
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
		)
	},
	leftBorder: (elem, o) => {
		return getHolder(elem, o)
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
	},
	leftCrossedOut: (elem, o) => {
		return getHolder(elem, o)
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
	},
	filter: (elem, o) => {
		const holder = getHolder(elem, o)
			.style('padding', '0 3px')
			.style('color', 'rgb(100,100,255)')
			.style('opacity', 0.9)
			.style('font-size', '16px')
			.style('padding', '3px')
			.style('cursor', 'pointer')

		elem.iconPath = holder
			.append('svg')
			.attr('width', 16)
			.attr('height', 12)
			.append('g')
			.attr('transform', 'translate(8,1)')
			.append('path')
			.attr('d', 'M8,0L2,6L2,12L-2,12L-2,6L-8,0Z')
			.style('fill', 'rgb(100,100,255)')

		return holder
	},
	colorScale: (elem, o) => {
		return (
			getHolder(elem, o)
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
		)
	},
	bar: (elem, o) => {
		return getHolder(elem, o)
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
	},
	rect: (elem, o) => {
		return getHolder(elem, o)
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
		select(elem.node().parentNode).append('span').html(o.html)
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
		return getHolder(elem, _opts).html(svg)
	},
	zoomIn: (elem, opts) => {
		const _opts = { color: 'black', width: 18, height: 18 }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-zoom-in" viewBox="0 0 16 16">
	<path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/>
	<path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/>
	<path fill-rule="evenodd" d="M6.5 3a.5.5 0 0 1 .5.5V6h2.5a.5.5 0 0 1 0 1H7v2.5a.5.5 0 0 1-1 0V7H3.5a.5.5 0 0 1 0-1H6V3.5a.5.5 0 0 1 .5-.5z"/>
	</svg>`
		return getHolder(elem, _opts).html(svg)
	},
	zoomOut: (elem, opts) => {
		const _opts = { color: 'black', width: 18, height: 18 }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-zoom-in" viewBox="0 0 16 16">
		<path fill-rule="evenodd" d="M6.5 12a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM13 6.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z"/>
		<path d="M10.344 11.742c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1 6.538 6.538 0 0 1-1.398 1.4z"/>
		<path fill-rule="evenodd" d="M3 6.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/>
	  </svg>`
		return getHolder(elem, _opts).html(svg)
	},
	lasso: (elem, opts) => {
		const _opts = { color: 'black', width: 18, height: 18 }
		const color = !opts.enabled ? 'transparent' : 'rgb(207, 226, 243)'
		Object.assign(_opts, opts)
		const svg = `<button style="cursor:pointer;border:none;background-color:${color};"><svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-zoom-in" viewBox="0 0 16 16">
		<path d="M15.825.12a.5.5 0 0 1 .132.584c-1.53 3.43-4.743 8.17-7.095 10.64a6.067 6.067 0 0 1-2.373 1.534c-.018.227-.06.538-.16.868-.201.659-.667 1.479-1.708 1.74a8.118 8.118 0 0 1-3.078.132 3.659 3.659 0 0 1-.562-.135 1.382 1.382 0 0 1-.466-.247.714.714 0 0 1-.204-.288.622.622 0 0 1 .004-.443c.095-.245.316-.38.461-.452.394-.197.625-.453.867-.826.095-.144.184-.297.287-.472l.117-.198c.151-.255.326-.54.546-.848.528-.739 1.201-.925 1.746-.896.126.007.243.025.348.048.062-.172.142-.38.238-.608.261-.619.658-1.419 1.187-2.069 2.176-2.67 6.18-6.206 9.117-8.104a.5.5 0 0 1 .596.04zM4.705 11.912a1.23 1.23 0 0 0-.419-.1c-.246-.013-.573.05-.879.479-.197.275-.355.532-.5.777l-.105.177c-.106.181-.213.362-.32.528a3.39 3.39 0 0 1-.76.861c.69.112 1.736.111 2.657-.12.559-.139.843-.569.993-1.06a3.122 3.122 0 0 0 .126-.75l-.793-.792zm1.44.026c.12-.04.277-.1.458-.183a5.068 5.068 0 0 0 1.535-1.1c1.9-1.996 4.412-5.57 6.052-8.631-2.59 1.927-5.566 4.66-7.302 6.792-.442.543-.795 1.243-1.042 1.826-.121.288-.214.54-.275.72v.001l.575.575zm-4.973 3.04.007-.005a.031.031 0 0 1-.007.004zm3.582-3.043.002.001h-.002z"/>
		</svg></button>`
		return getHolder(elem, _opts).html(svg)
	},
	download: (elem, opts) => {
		const _opts = { color: 'black', width: 18, height: 18 }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-download" viewBox="0 0 16 16">
		<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
		<path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
	  </svg>`
		return getHolder(elem, opts).html(svg)
	},
	help: (elem, opts) => {
		const _opts = { color: 'black', width: 18, height: 18 }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-question-circle" viewBox="0 0 16 16">
		<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
		<path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
	  </svg>`
		return getHolder(elem, _opts).html(svg)
	},
	search: (elem, opts) => {
		const _opts = { color: 'black', width: 18, height: 18 }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-search" viewBox="0 0 16 16">
		<path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
	  </svg>`
		return getHolder(elem, _opts).html(svg)
	},
	crosshair: (elem, opts = {}) => {
		const _opts = { color: 'black', width: 18, height: 18, d: 2 }
		const w = _opts.width
		const h = _opts.height
		const d = _opts.d
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${
			_opts.height
		}" style='vertical-align: middle'>
		<!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
		<path d="M${w / 2},${d}L${w / 2},${h - d}Z" stroke='${_opts.color}'/>
		<path d="M${d},${h / 2}L${w - d},${h / 2}Z" stroke='${_opts.color}'/>
		</svg>`
		return getHolder(elem, opts).html(svg)
	},
	grab: (elem, opts = {}) => {
		const _opts = { color: 'black', width: 18, height: 18, transform: '' }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" viewBox="0 0 448 512">
		<!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
		<path transform='${_opts.transform}' d="M144 64c0-8.8 7.2-16 16-16s16 7.2 16 16c0 9.1 5.1 17.4 13.3 21.5s17.9 3.2 25.1-2.3c2.7-2 6-3.2 9.6-3.2c8.8 0 16 7.2 16 16c0 9.1 5.1 17.4 13.3 21.5s17.9 3.2 25.1-2.3c2.7-2 6-3.2 9.6-3.2c8.8 0 16 7.2 16 16c0 9.1 5.1 17.4 13.3 21.5s17.9 3.2 25.1-2.3c2.7-2 6-3.2 9.6-3.2c8.8 0 16 7.2 16 16V264c0 31.3-20 58-48 67.9c-9.6 3.4-16 12.5-16 22.6V488c0 13.3 10.7 24 24 24s24-10.7 24-24V370.2c38-20.1 64-60.1 64-106.2V160c0-35.3-28.7-64-64-64c-2.8 0-5.6 .2-8.3 .5C332.8 77.1 311.9 64 288 64c-2.8 0-5.6 .2-8.3 .5C268.8 45.1 247.9 32 224 32c-2.8 0-5.6 .2-8.3 .5C204.8 13.1 183.9 0 160 0C124.7 0 96 28.7 96 64v64.3c-11.7 7.4-22.5 16.4-32 26.9l17.8 16.1L64 155.2l-9.4 10.5C40 181.8 32 202.8 32 224.6v12.8c0 49.6 24.2 96.1 64.8 124.5l13.8-19.7L96.8 361.9l8.9 6.2c6.9 4.8 14.4 8.6 22.3 11.3V488c0 13.3 10.7 24 24 24s24-10.7 24-24V359.9c0-12.6-9.8-23.1-22.4-23.9c-7.3-.5-14.3-2.9-20.3-7.1l-13.1 18.7 13.1-18.7-8.9-6.2C96.6 303.1 80 271.3 80 237.4V224.6c0-9.9 3.7-19.4 10.3-26.8l9.4-10.5c3.8-4.2 7.9-8.1 12.3-11.6V208c0 8.8 7.2 16 16 16s16-7.2 16-16V142.3 128 64z"/>
		</svg>`
		return getHolder(elem, opts).html(svg)
	},
	arrowPointer: (elem, opts = {}) => {
		const _opts = { color: 'black', width: 18, height: 18, transform: '' }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" viewBox="0 0 320 512">
		<!--! Font Awesome Pro 6.4.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license (Commercial License) Copyright 2023 Fonticons, Inc. -->
		<path transform='${_opts.transform}' d="M0 55.2V426c0 12.2 9.9 22 22 22c6.3 0 12.4-2.7 16.6-7.5L121.2 346l58.1 116.3c7.9 15.8 27.1 22.2 42.9 14.3s22.2-27.1 14.3-42.9L179.8 320H297.9c12.2 0 22.1-9.9 22.1-22.1c0-6.3-2.7-12.3-7.4-16.5L38.6 37.9C34.3 34.1 28.9 32 23.2 32C10.4 32 0 42.4 0 55.2z"/>
		</svg>`
		return getHolder(elem, opts).html(svg)
	},
	compare: (elem, opts = {}) => {
		const _opts = { color: 'black', width: 18, height: 18, transform: '' }

		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-copy" viewBox="0 0 16 16">
  		<path d="M0 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2H2a2 2 0 0 1-2-2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/>
		</svg>`
		return getHolder(elem, _opts).html(svg)
	},
	table: (elem, opts = {}) => {
		const _opts = { color: 'black', width: 18, height: 18, transform: '' }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-copy" viewBox="0 0 16 16">
  			<path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm15 2h-4v3h4zm0 4h-4v3h4zm0 4h-4v3h3a1 1 0 0 0 1-1zm-5 3v-3H6v3zm-5 0v-3H1v2a1 1 0 0 0 1 1zm-4-4h4V8H1zm0-4h4V4H1zm5-3v3h4V4zm4 4H6v3h4z"/>
		</svg>`
		return getHolder(elem, _opts).html(svg)
	},
	pdf: (elem, opts = {}) => {
		const _opts = { color: 'black', width: 18, height: 18, transform: '' }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-copy" viewBox="0 0 16 16">
  			<path fill-rule="evenodd" d="M14 4.5V14a2 2 0 0 1-2 2h-1v-1h1a1 1 0 0 0 1-1V4.5h-2A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v9H2V2a2 2 0 0 1 2-2h5.5zM1.6 11.85H0v3.999h.791v-1.342h.803q.43 0 .732-.173.305-.175.463-.474a1.4 1.4 0 0 0 .161-.677q0-.375-.158-.677a1.2 1.2 0 0 0-.46-.477q-.3-.18-.732-.179m.545 1.333a.8.8 0 0 1-.085.38.57.57 0 0 1-.238.241.8.8 0 0 1-.375.082H.788V12.48h.66q.327 0 .512.181.185.183.185.522m1.217-1.333v3.999h1.46q.602 0 .998-.237a1.45 1.45 0 0 0 .595-.689q.196-.45.196-1.084 0-.63-.196-1.075a1.43 1.43 0 0 0-.589-.68q-.396-.234-1.005-.234zm.791.645h.563q.371 0 .609.152a.9.9 0 0 1 .354.454q.118.302.118.753a2.3 2.3 0 0 1-.068.592 1.1 1.1 0 0 1-.196.422.8.8 0 0 1-.334.252 1.3 1.3 0 0 1-.483.082h-.563zm3.743 1.763v1.591h-.79V11.85h2.548v.653H7.896v1.117h1.606v.638z"/>
		</svg>`
		return getHolder(elem, _opts).html(svg)
	},
	add: (elem, opts = {}) => {
		const _opts = { color: 'black', width: 18, height: 18, transform: '' }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-copy" viewBox="0 0 18 18">
			<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
			<path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/>
		</svg>`
		return getHolder(elem, _opts).html(svg)
	},
	save: (elem, opts = {}) => {
		const _opts = { color: 'black', width: 17, height: 17, transform: '' }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-floppy" viewBox="0 0 18 18">
			 	<path d="M11 2H9v3h2z"/>
			  	<path d="M1.5 0h11.586a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 16 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 14.5v-13A1.5 1.5 0 0 1 1.5 0M1 1.5v13a.5.5 0 0 0 .5.5H2v-4.5A1.5 1.5 0 0 1 3.5 9h9a1.5 1.5 0 0 1 1.5 1.5V15h.5a.5.5 0 0 0 .5-.5V2.914a.5.5 0 0 0-.146-.353l-1.415-1.415A.5.5 0 0 0 13.086 1H13v4.5A1.5 1.5 0 0 1 11.5 7h-7A1.5 1.5 0 0 1 3 5.5V1H1.5a.5.5 0 0 0-.5.5m3 4a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V1H4zM3 15h10v-4.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5z"/>
			</svg>`
		return getHolder(elem, _opts).html(svg)
	},
	burguer: (elem, opts = {}) => {
		const _opts = { color: 'black', width: 20, height: 20, transform: '' }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-copy" viewBox="0 0 16 16">
  				<path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
		</svg>`
		return getHolder(elem, _opts).html(svg)
	},
	trash: (elem, opts = {}) => {
		const _opts = { color: 'black', width: 18, height: 18, transform: '' }
		Object.assign(_opts, opts)
		const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${_opts.width}" height="${_opts.height}" fill="${_opts.color}" class="bi bi-copy" viewBox="0 0 16 16">
  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
  <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
		</svg>`
		return getHolder(elem, _opts).html(svg)
	}
}

function getHolder(elem, opts) {
	if (opts.handler) {
		elem.on('click', opts.handler)

		// for Section 508: a clickable element should have a recognized aria-role,
		// either implied by element tagName (button, submit, etc) or via "role" attribute
		if (elem.node().tagName != 'BUTTON') elem.attr('role', 'button').attr('tabindex', 0).style('cursor', 'pointer')
	}
	if (opts.title) {
		elem.attr('aria-label', opts.title).style('z-index', 1) // to have aria-label based tooltip appear above other elements
	}

	return elem
}
