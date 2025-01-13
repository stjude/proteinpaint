import { select } from 'd3-selection'

const featureToggle = 'sseRefreshMode'
const toggleValues = {
	// default: 'call runproteinpaint() again with the original argument + any HMR state',
	reload:
		'call window.reload() to refresh from URL params and/or runpp() arguments, ' +
		'this may have less memory leaks than the default approach',
	none: 'do not refresh the app view'
}
console.log(
	`You may use sessionStorage.setItem('${featureToggle}', ` +
		Object.keys(toggleValues)
			.map(d => `'${d}'`)
			.join(' | ') +
		`) or sessionStorage.removeItem('${featureToggle}') for default behavior, ` +
		`see notify.ts for details.`
	//toggleValues
)

const sseMessageStorageKey = 'sjpp-sse-message'
const notifyDiv = setNotifyDiv()
const notifyElem = notifyDiv.node()

// sse = the connection to /sse route
let sse
// the callback to call when a notification included `reload: true`,
// may be overriden by setRefresh()
let refresh = () => window.location.reload()
// the Unix timestamp when refresh() was last called
let lastRefresh = Date.now() //Math.min(notifyElem.__ppLastRefresh, Date.now())
// the most recent sse message that was processed
let mostRecentReloadTime = 0

// notify a user of pertinent message
function notify(_data: SseData, now) {
	const data = _data.filter(d => d.status != 'ok' || !d.time || now - d.time < 5000 || lastRefresh < d.time)
	if (sessionStorage.getItem(featureToggle) == 'none') {
		data.unshift({
			key: 'IGNORED SSE',
			message: 'no auto-refresh',
			status: 'ok',
			color: 'black',
			duration: 2500,
			reload: false,
			time: Date.now()
		})
	}

	const divs = notifyDiv.selectAll(`:scope>div`).data(data, (d: SseDataEntry) => d.key)

	divs.exit().remove()
	divs
		.style('color', getColor)
		.style('border', getBorder)
		.html(getHtml)
		.each(function (this: HTMLElement, d) {
			if (d.duration) {
				setTimeout(
					() =>
						select(this)
							.transition()
							.duration(d.duration || 0)
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
		.style('border', getBorder)
		.style('color', getColor)
		.html(getHtml)
		.each(function (this: HTMLElement, d) {
			if (d.duration) {
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

	return data
}

function setNotifyDiv() {
	// by using an id attribute for the notify div
	// it can be reused across HMR replacement of app instances/runtimes
	const divId = `#sjpp-notify-div-sse-refresh`
	const notifyElem = document.body.querySelector(divId)
	// tsc errors on const notifyDiv = notifyElem ? select(notifyElem) : ...,
	// so has to use this longer syntax for now
	let notifyDiv
	if (notifyElem) notifyDiv = select(notifyElem)
	else {
		notifyDiv = select('body')
			.append('div')
			.attr('id', divId.slice(1))
			.style('position', 'fixed')
			.style('top', `16px`)
			.style('right', '10px')
			.style('font-size', '1.2em')
			.style('background-color', 'rgba(250, 250, 250, 0.75)')
			.style('z-index', 10000)
	}

	return notifyDiv
}

function getHtml(d) {
	return `${d.key}: ${d.message}`
}

function getColor(d) {
	return d.color || (d.status == 'ok' ? 'green' : 'red')
}

function getBorder(d) {
	return `1px solid ${d.color || '#000'}`
}

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
	time: number
}

type SseData = SseDataEntry[]

const host = sessionStorage.getItem('hostURL') || (window as any).testHost || ''
const sseUrl = host.endsWith('/') ? `${host}sse` : `${host}/sse`
// when a user clicks opens a link in another tab,
// the browser might not switch the active tab to it yet,
// in that case do not automatically listen for server-sent events
if (!document.hidden) setSse()

function setSse() {
	// if this code file was rebundled, then clear the notifyElem.__ppSse reference
	if (notifyElem.__ppSse) notifyElem.__ppSse.close()

	// server-sent events
	sse = new EventSource(`${sseUrl}?time=${lastRefresh}&now=${Date.now()}`)
	notifyElem.__ppSse = sse

	sse.onmessage = event => {
		if (sse != notifyElem.__ppSse) {
			console.log(155, 'stale sse --')
			// this sse was from a stale notify.ts bundle that was replaced via HMR
			sse.close()
			delete sse.onmessage
			return
		}
		const data: SseData = JSON.parse(event.data)
		if (!data.length) return
		const now = Date.now()
		const renderedData = notify(data, now)
		mostRecentReloadTime = Math.max(0, ...renderedData.map(d => d.time))

		// track last refresh to prevent triggering infinite refresh loop
		// if (lastRefresh === 0) lastRefresh = now //
		// console.log(lastRefresh, mostRecentReloadTime)
		// the first entry will be the timestamp of when the data was stored
		localStorage.setItem(sseMessageStorageKey, JSON.stringify(data))
		if (mostRecentReloadTime && mostRecentReloadTime - lastRefresh > 100) {
			// only the browser tab with the active sse connection should refresh,
			// to allow side-by-side comparison of visible window tabs before and
			// after code change
			lastRefresh = Math.max(now, mostRecentReloadTime)
			const mode = sessionStorage.getItem(featureToggle)
			if (!mode) refresh()
			else if (mode == 'reload') window.location.reload()
			else if (!toggleValues[mode]) {
				console.warn(`invalue ${featureToggle}='${mode}', triggering refresh instead`)
				refresh()
			}
		}
	}

	// sse.onerror = e => console.log(e.message, e.phase, sse.readyState, e) // err => {
	// 	// ok to lose sse connection, since the server can only maintain
	// 	// up to 6 sse streams per standard; another connection will be triggered
	// 	// when this browser window/tab becomes visible again
	// 	// if (sse) {
	// 	// 	sse.close()
	// 	// 	sse = undefined
	// 	// }
	// }
}

export function setRefresh(callback) {
	refresh = callback
	//if (!notifyDiv) return
	//notifyDiv.selectAll(`:scope>div`).remove()
}

document.onvisibilitychange = () => {
	if (document.hidden) {
		if (sse) {
			sse.close()
			sse = undefined
			delete notifyElem.__ppSse
		}
	} else if (!sse || sse.readyState === 2) {
		sse = undefined
		delete notifyElem.__ppSse
		setSse()
	} else {
		console.warn(sse, 'not hidden, has open sse')
	}
}

// this listener allows multiple visible browser tabs/windows
// to react to server-side events, even when only one tab has
// an active connection, since that active connection will trigger
// a localStorage.setItem() event that the other tabs listens on;
// this is a work-around to SSE being limited to 6 max connections
window.onstorage = event => {
	// ignore storage event if
	// - sse is present: rely on sse.onmessage event directly
	// - document is not visible: does not have to display notification
	//   when the browser window/tab is not visible
	if (sse || document.hidden) return

	// only process the event if the expected storage key was changed
	if (event.key != sseMessageStorageKey) return
	const data = JSON.parse(localStorage.getItem(sseMessageStorageKey) || '')
	notify(data, Date.now)
	refresh()
}
