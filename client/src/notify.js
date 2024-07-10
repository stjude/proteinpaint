import { select, selectAll } from 'd3-selection'

// server-sent events
const sse = new EventSource('/sse')
const notifyDiv = select('body')
	.append('div')
	.style('position', 'fixed')
	.style('top', `16px`)
	.style('right', '10px')
	.style('font-size', '1.2em')
	.style('background-color', 'rgba(250, 250, 250, 0.75)')
	.style('z-index', 10000)

let lastReload = 0

sse.onmessage = event => {
	// track last reload to prevent triggering infinite reload loop
	if (lastReload === 0) lastReload = event.timeStamp
	const data = JSON.parse(event.data) //; console.log(data)
	const divs = notifyDiv.selectAll(`:scope>div`).data(data, d => d.key)

	divs.exit().remove()
	divs
		.style('color', d => d.color || (d.status == 'ok' ? 'green' : 'red'))
		.style('border', d => `1px solid ${d.color || '#000'}`)
		.html(d => `${d.key}: ${d.message}`)
		.each(function (d) {
			if (d.reload && event.timeStamp > lastReload) window.location.reload()
			else if (d.duration) {
				setTimeout(() => select(this).transition().duration(d.duration).style('opacity', 0).remove(), d.duration)
			}
		})
	divs
		.enter()
		.append('div')
		.style('margin', '5px')
		.style('padding', '5px')
		.style('border', d => `1px solid ${d.color || '#000'}`)
		.style('color', d => d.color || (d.status == 'ok' ? 'green' : 'red'))
		.html(d => `${d.key}: ${d.message}`)
		.on('click', function (d) {
			//select(this).remove()
		})
		.each(function (d) {
			if (d.reload && event.timeStamp > lastReload) window.location.reload()
			else if (d.duration) {
				setTimeout(() => select(this).transition().duration(d.duration).style('opacity', 0).remove(), d.duration)
			}
		})
}

sse.onerror = err => console.log(err)
