import { select } from 'd3-selection'

const sseMessageStorageKey = 'sjpp-sse-message'
const notifyDiv = setNotifyDiv()
const notifyElem = notifyDiv.node()
const refresh = notifyElem.__ppRefresh

// the sse connection that is specific to this notify code bundle
let sse

// notify a user of pertinent message
function notify(_data: SseData, now) {
	const data = _data.filter(d => d.status != 'ok' || !d.time || now - d.time < 5000 || refresh.lastCall < d.time)
	const divs = notifyDiv.selectAll(`.sjpp-sse-message`).data(data, (d: SseDataEntry) => d.key)

	divs
		.exit()
		.filter(d => !d.duration)
		.remove()
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
		.attr('class', 'sjpp-sse-message')
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

		notifyDiv.node().__ppRefresh = setRefresh(notifyDiv)
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

function setRefresh(notifyDiv) {
	const refresh = {
		// used in both sessionStorage and serverconfig.features
		key: 'sseRefreshMode',
		// default starting mode, may be replaced by:
		// - using the rendered dom.select dropdown (tab-specific behavior)
		// - setting sessionStorage.setItem(/*refresh.key*/, ) manually (tab-specific)
		// - setting serverconfig.features[/*refresh.key*/] (applies across tabs)

		mode: 'full',
		// available mode options
		modeOptions: {
			appOnly: 'call runproteinpaint() on the same DOM element, with the original argument + any HMR state',
			appOnly_except_on_unhide: 'same as reload, except when a hidden browser tab is made visible',
			full:
				'call window.reload() to refresh from URL params and/or runpp() arguments, ' +
				'this may have less memory leaks than the default approach',
			full_except_on_unhide: 'same as full reload, except when a hidden browser tab is made visible',
			none: 'do not refresh the app view'
		},

		// the callback to call when a notification includes `reload: true`,
		// will be overriden by setRefreshCallback()
		callback: () => window.location.reload(),
		// the Unix timestamp when callback() was last called
		lastCall: Date.now(),
		mostRecentMsg: 0,

		dom: {} as any,

		// sse = the connection to /sse route
		sse: undefined as any,

		update(mode) {
			if (!refresh.modeOptions[mode]) {
				console.log(`invalid refresh.mode='${mode}'`)
				return
			}
			refresh.mode = mode
			refresh.dom.select.property('value', mode)
			if (sessionStorage.getItem(refresh.key) != mode) {
				sessionStorage.setItem(refresh.key, mode)
			}
		},

		destroy() {
			//console.log(47, 'refresh.destroy()')
			disconnect(refresh.sse)
			for (const k of Object.keys(refresh.dom)) {
				if (typeof refresh.dom[k] == 'function') refresh.dom[k].remove()
				delete refresh.dom[k]
			}
			// for (const k of Object.keys(refresh)) {
			// 	delete refresh[k]
			// }
		}
	}

	const features = JSON.parse(sessionStorage.getItem('optionalFeatures') || '{}')
	refresh.mode = sessionStorage.getItem(refresh.key) || features[refresh.key] || refresh.mode
	sessionStorage.setItem(refresh.key, refresh.mode)

	// in case this notify code file was rebundled, the refresh instance will be replaced,
	// and so must replace the dom with attached event listeners from the stale bundle
	const handleCls = '.sja-sse-refresh-opts-div' //
	notifyDiv.selectAll(handleCls).remove()
	const elem = notifyDiv.insert('div', 'div').attr('class', handleCls.slice(1)).style('text-align', 'right')
	const s = {
		w: '32px',
		h: '24px',
		o: 0.5,
		bg: '#ececec'
	}
	const handle = elem
		.append('div')
		.style('display', 'inline-block')
		.style('width', s.w)
		.style('height', s.h)
		.style('overflow', 'hidden')
		.style('background-color', s.bg)
		.on('mouseover', function () {
			handle.style('width', '').style('height', '').style('opacity', '').style('background-color', '')
		})
		.on('mouseout', function () {
			handle.style('width', s.w).style('height', s.h).style('opacity', s.o).style('background-color', s.bg)
		})

	const dom: any = {
		elem,
		label: handle.append('label')
	}

	dom.label
		.append('span')
		.style('font-family', 'consola arial')
		.style('font-size', '1rem')
		.attr('title', 'Click on the select input and hover over an option for details')
		.html(`SSE refresh mode (tab-specific) <br/>`)

	dom.select = dom.label.append('select').on('change', () => {
		refresh.mode = refresh.dom.select.property('value')
		sessionStorage.setItem(refresh.key, refresh.mode)
	})

	dom.select
		.selectAll('option')
		.data(Object.keys(refresh.modeOptions))
		.enter()
		.append('option')
		.attr('value', key => key)
		.attr('title', key => refresh.modeOptions[key])
		.property('selected', key => key == refresh.mode)
		.html(key => key)

	refresh.dom = dom
	return refresh
}

export function setRefreshCallback(callback) {
	refresh.callback = callback
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
if (!document.hidden) setSse() //

function setSse() {
	if (sse && sse == refresh.sse && sse.readyState != 2) return

	// if this code file was rebundled, then clear the current refresh.sse reference
	if (refresh.sse) disconnect(refresh.sse)

	// server-sent events
	sse = new EventSource(sseUrl)
	refresh.sse = sse

	sse.onmessage = event => {
		if (sse != refresh.sse) {
			// only the browser tab with the active refresh.sse connection should notify
			// and trigger a storage event that will allow other visible window tabs
			// to refresh after a rebundle
			disconnect(sse)
			return
		}
		const data: SseData = JSON.parse(event.data)
		if (!data.length) return
		handleMessageData(data, { save: true })
	}

	sse.onerror = _ => {
		// ok to lose sse connection, since the server can only maintain
		// up to 6 sse streams per standard; another connection will be triggered
		// when this browser window/tab becomes visible again
		if (sse != refresh.sse) sse.close()
	}
}

function handleMessageData(_data, opts = {} as any) {
	if (!_data.length) return
	const now = Date.now()
	const data = [..._data] //
	if (data.length && (refresh.mode == 'none' || opts.unhidden)) {
		data.unshift({
			key: 'skipped refresh',
			message: 'no auto-refresh',
			status: 'ok',
			color: 'black',
			duration: 2500,
			reload: false,
			time: Date.now()
		})
	}
	const renderedData = notify(data, now)
	if (data[0]?.key == 'skipped refresh') return

	const mostRecentMsg = Math.max(0, ...renderedData.map(d => d.time))
	// console.log(293, mostRecentMsg - refresh.lastCall)
	if (opts.save) localStorage.setItem(sseMessageStorageKey, JSON.stringify(data))
	if (mostRecentMsg && mostRecentMsg - refresh.lastCall > 100) {
		// Math.max() would adjust for possible discrepancy between browser and server unix time
		refresh.lastCall = refresh.mostRecentMsg ? mostRecentMsg : Math.max(mostRecentMsg, now)
		refresh.mostRecentMsg = mostRecentMsg

		if (refresh.mode == 'none') {
			// console.log(`skipped refresh in sessionRefresh.mode='none'`)
		} else if (refresh.mode == 'appOnly') {
			console.clear()
			if (refresh.pendingCall) clearTimeout(refresh.pendingCall)
			// debounce
			refresh.pendingCall = setTimeout(refresh.callback, 500)
		} else if (refresh.mode == 'full') {
			if (refresh.pendingCall) clearTimeout(refresh.pendingCall) //
			// debounce
			refresh.pendingCall = setTimeout(() => window.location.reload(), 500)
		} else if (!refresh.modeOptions[refresh.mode]) {
			console.warn(`invalid value ${refresh.key}='${refresh.mode}', triggering refresh instead`)
			console.clear()
			//refresh.callback()
			if (refresh.pendingCall) clearTimeout(refresh.pendingCall)
			// debounce
			refresh.pendingCall = setTimeout(refresh.callback, 500)
		}
	}
}

function disconnect(sse) {
	if (!sse) return
	// console.log('!!! stale sse !!!')
	// this sse was from a stale notify.ts bundle that was replaced via HMR
	if (sse.readyState != 2) sse.close()
	if (sse == refresh.sse) delete refresh.sse
	delete sse.onmessage
}

document.onvisibilitychange = () => {
	if (document.hidden) {
		disconnect(refresh.sse)
	} else {
		const msg = localStorage.getItem(sseMessageStorageKey)
		const data = JSON.parse(msg || '[]')
		const opts = { unhidden: refresh.mode.endsWith('except_on_unhide') } as any
		if (!refresh.lastUnhide) refresh.lastUnhide = 0
		handleMessageData(
			data.filter(m => !m.key.includes('skipped') && m.time > refresh.lastUnhide),
			opts
		)

		if (!refresh.sse || refresh.sse.readyState === 2) {
			setSse()
		} else {
			console.warn('will reuse sse connection')
			// disconnect(refresh.sse)
		}
	}
}

// this listener allows multiple visible browser tabs/windows
// to react to server-side events, even when only one tab has
// an active connection, since that active connection will trigger
// a localStorage.setItem() event that the other tabs listens on;
// this is a work-around to SSE being limited to 6 max connections
window.onstorage = event => {
	//
	// ignore storage event if
	// - sse is present: rely on sse.onmessage event directly
	// - document is not visible: does not have to display notification
	//   when the browser window/tab is not visible
	if (refresh.sse || document.hidden) return

	switch (event.key) {
		case refresh.key:
			refresh.update(event.newValue)
			break

		case sseMessageStorageKey:
			{
				const msg = localStorage.getItem(sseMessageStorageKey)
				const data = JSON.parse(msg || '[]')
				handleMessageData(data)
			}
			break
	}
}
