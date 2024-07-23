import { select } from 'd3-selection'

// TODO: may move this to #shared/types/sse.ts so
// that both server and client can type check against
// the same definitions
type SseDataEntry = {
	/** title of the message: each unique key will be associated with a rendered div, to either add, update, or remove */
	key: string
	message: string
	/** if present, will be used for text and border color of message div */
	color?: string
	/** if present, will be used for rendering style transition and removal */
	duration?: number
	/** if set to true, will trigger a browser refresh/reload */
	reload?: boolean
	status?: string
}

type SseData = SseDataEntry[]

const notifyDiv = select('body')
	.append('div')
	.style('position', 'fixed')
	.style('top', `16px`)
	.style('right', '10px')
	.style('font-size', '1.2em')
	.style('background-color', 'rgba(250, 250, 250, 0.75)')
	.style('z-index', 10000)

let sse,
	initialLoad = 0

const host = sessionStorage.getItem('hostURL') || (window as any).testHost || ''
const sseUrl = host.endsWith('/') ? `${host}sse` : `${host}/sse`
setSse()

function setSse() {
	// server-sent events
	sse = new EventSource(sseUrl)

	let lastReload = 0

	sse.onmessage = event => {
		// track last reload to prevent triggering infinite reload loop
		if (initialLoad === 0) initialLoad = event.timeStamp
		if (lastReload === 0) lastReload = event.timeStamp
		const _data: SseData = JSON.parse(event.data)
		if (event.timeStamp > lastReload && _data.find(d => d.reload)) {
			//window.location.reload()
			//return
		}
		const data = _data //.filter(d => d.status != 'ok' || !d.time || now - d.time < 5000)
		const divs = notifyDiv.selectAll(`:scope>div`).data(data, d => (d as SseDataEntry).key)

		divs.exit().remove()
		divs
			.style('color', d => d.color || (d.status == 'ok' ? 'green' : 'red'))
			.style('border', d => `1px solid ${d.color || '#000'}`)
			.html(d => `${d.key}: ${d.message}`)
			.each(function (d) {
				if (d.reload && event.timeStamp > lastReload) window.location.reload()
				else if (d.duration) {
					setTimeout(
						() =>
							select(this)
								.transition()
								.duration(d.duration as number)
								.style('opacity', 0)
								.remove(),
						d.duration
					)
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
			.on('click', function () {
				//select(this).remove()
			})
			.each(function (d) {
				if (d.reload && event.timeStamp > lastReload) window.location.reload()
				else if (d.duration) {
					setTimeout(
						() =>
							select(this)
								.transition()
								.duration(d.duration as number)
								.style('opacity', 0)
								.remove(),
						d.duration
					)
				}
			})
	}

	sse.onerror = err => console.log(err)

	//function getHtml(d) { return `${d.key}: ${d.reload && initialLoad != lastReload ? 'stale bundle?' : d.message}` }
}

document.addEventListener('visibilitychange', () => {
	if (document.hidden) sse.close()
	else if (!sse || sse.readyState === 2) setSse()
})
