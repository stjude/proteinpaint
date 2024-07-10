import { select, selectAll } from 'd3-selection'

const src = new EventSource('/notifications')

let lastTimeStamp = 0
src.onmessage = event => {
	const chunks = event.data.split('\n\n')
	const data = chunks.map(JSON.parse)
	console.log(data)
	const cls = 'sjpp-notification-banner'
	const divs = select('body')
		.selectAll(`.${cls}`)
		.data(data, d => d.key)

	divs.exit().remove()
	divs
		.style('color', d => (d.status == 'ok' ? 'green' : 'red'))
		.html(d => `${d.key}: ${d.message}`)
		.each(function (d) {
			console.log(18, d)
			if (d.status == 'ok')
				setTimeout(() => select(this).transition().duration(2500).style('opacity', 0).remove(), 5000)
		})
	divs
		.enter()
		.append('div')
		.attr('class', cls)
		.style('position', 'fixed')
		.style('top', (d, i) => `${(i + 1) * 16}px`)
		.style('right', '10px')
		.style('color', d => (d.status == 'ok' ? 'green' : 'red'))
		.html(d => `${d.key}: ${d.message}`)
		.on('click', function (d) {
			select(this).remove()
		})
		.each(function (d) {
			console.log(32, d)
			if (d.status == 'ok')
				setTimeout(() => select(this).transition().duration(2500).style('opacity', 0).remove(), 5000)
		})
}

src.onerror = err => console.log(err)
