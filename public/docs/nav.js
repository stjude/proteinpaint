d3.select('head').append('style').text(`
body {
	padding: 5px;
}
.navtab {
	display: inline-block;
	padding: 5px;
	border: 1px solid #aaa;
	font: 400 1rem/1 Consolas, Arial, sans-serif;
}
.docs-subheader {
	padding: 10px 15px; 
	background: #3a3a3a; 
	color: #fff; 
	font-family: Menlo, Courier
}
.code-snippet {
  padding: 1px 3px;
  font-family: Menlo, Monospace, Consolas, Arial, sans-serif;
  font-size: 14px;
  color: #990033;
  font-style: normal;
  background: #ddd;
  cursor: copy;
}
`)
// do not position the typedoc input search overlay bar over the injected nav bar?
setTimeout(() => {
	d3.select('#tsd-search .field input').style('top', '')
}, 500)

setTimeout(() => {
	const navbar = d3
		.select('body')
		.insert('div', 'div')
		.style('margin-left', '5px')
		//.style('font-family', 'Consolas, Arial, sans-serif')
		.style('font', '400 1rem/1.1 Consolas, Arial, sans-serif')
		.style('z-index', 10)

	const title = navbar
		.append('h3')
		.style('display', 'inline-block')
		.style('margin-block-start', '0.4rem')
		.style('margin-block-end', '0.4rem')
		.style('border-bottom', 'none')
		.style('cursor', 'pointer')
		.html('Developer Reference')
		.on('click', () => (window.location = '/docs/'))

	fetch('/docs/tabs.json')
		.then(r => r.json())
		.then(tabs => {
			navbar
				.append('div')
				.style('position', 'relative')
				.style('display', 'inline-block')
				.style('margin-left', '24px')
				.selectAll('.navtab')
				.data(tabs)
				.enter()
				.append('div')
				.attr('class', 'navtab')
				.each(function (d) {
					const div = d3.select(this).on('click', function (d) {
						console.log(d, this)
					})
					const isActive = window.location.pathname.includes(d.href)
					div
						.style('background-color', isActive ? '' : 'rgba(100, 100, 100, 0.1)')
						.style('color', isActive ? '#0366d6' : '')
						//.append('a')
						//.attr('href', d.href)
						.style('cursor', 'pointer')
						.style('-webkit-user-select', 'none')
						.style('-moz-user-select', 'none')
						.style('-ms-user-select', 'none')
						.style('-user-select', 'none')
						.html(d.label)
						.on('click', () => (window.location = d.href))
				})
		})

	detectCopyable(d3.select('body'))
}, 0)

function detectCopyable(dom) {
	dom
		.selectAll('.code-snippet')
		.attr('aria-label', function () {
			const elem = d3.select(this)
			if (!elem.attr('aria-label') && !this.__data__) {
				elem.datum(d3.select(this).text())
				return 'Click to copy to clipboard'
			}
		})
		.on('click.docnav', function (d) {
			event.stopPropagation()
			navigator.clipboard.writeText(d)
		})
}
