d3.select('head').append('style').text(`
body {
	padding: 10px;
}
.navtab {
	display: inline-block;
	padding: 5px;
	border: 1px solid #aaa;
}
`)
// do not position the typedoc input search overlay bar over the injected nav bar?
setTimeout(() => {
	d3.select('#tsd-search .field input').style('top', '')
}, 500)

setTimeout(() => {
	const header = d3.select('header').size()

	const navbar = d3
		.select('body')
		.insert('div', header ? 'header' : 'div')
		.style('margin-left', '5px')
		.style('font-family', 'Consolas, Arial, sans-serif')
		.style('z-index', 10)

	const title = navbar
		.append('h1')
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
				.style('top', '-5px')
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
					div
						.style('background-color', window.location.pathname.includes(d.href) ? '' : 'rgba(100, 100, 100, 0.2)')
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
}, 0)
