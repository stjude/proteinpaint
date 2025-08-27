export function parentCorsMessage(res, origin = '') {
	const embedder = res.state?.embedder
	const messageListener = event => {
		if (event.origin !== embedder.origin) return
		if (event.data == 'getActiveMassSession') {
			window.removeEventListener('message', messageListener)
			child.postMessage({ state: res.state }, embedder.origin)
			if (embedder.origin != window.location.origin) {
				// An embedder site was opened using an transitory proteinpaint site URL.
				// Try to close this transitory URL tab since it will not display any viz
				// and is only used to open the saved embedder URL without imposing PP-related
				// URL parameters.
				setTimeout(() => {
					try {
						// Works when a shared URL is clicked from the session menu
						window.close()
					} catch (e) {
						// the browser prevents the closing of an transitory tab that was opened
						// by clicking on a bookmarked link or pasting that link directly on the browser
						// address bar. In that case, make another attempt to close the transitory tab
						console.log(e)
						window.open(window.location, '_self').close()
					}
				}, 500)
			}
		}
	}
	window.addEventListener('message', messageListener, false)
	setTimeout(() => window.removeEventListener('message', messageListener), 8000)
	if (embedder.origin != window.location.origin) {
		confirm(
			`Another window will open to recover the saved session. When the next window opens,` +
				`\n- You may need to allow popups.` +
				`\n- You may have to refresh it.` +
				`\n- After the session is recovered, this browser window should automatically close.`
		)
		document.body.innerHTML = `
			<div style='margin: 20px; padding: 20px; font-size: 24px'>
				Please close this browser tab. The recovered session should visible in another browser tab.
			</div>
		`
	}
	const child = window.open(embedder.href, '_blank')
}

export function childCorsMessage(opts) {
	if (!window.opener) return
	const hostURL = sessionStorage.getItem('hostURL')
	if (hostURL === window.location.origin) return

	// if this is a child window or tab, refreshing it will need previously hydrated session state,
	// in case the window.opener has already removed its message listener
	opts.embeddedSessionState = JSON.parse(sessionStorage.getItem('embeddedSessionState') || `{}`)
	const messageListener = event => {
		if (event.origin != window.location.origin && event.origin !== hostURL) return
		// !!! Potential race-condition
		// - assumes that the message event from the window.opener will be received
		//   before the storeInit() is triggered within the storeInit() call in mass/app.js
		// - low-risk(?) since the postMessage() between browser tabs should be faster than
		//   the dynamic code loading below and in mass/app
		// !!!
		if (event.data.state) {
			window.removeEventListener('message', messageListener)
			Object.assign(opts.embeddedSessionState, event.data.state)
			// see the comment above for when this stored embeddedState may be used
			sessionStorage.setItem('embeddedSessionState', JSON.stringify(opts.embeddedSessionState))
		}
	}
	window.addEventListener('message', messageListener, false)
	// limit the time to listen for the window.opener's message
	setTimeout(() => window.removeEventListener('message', messageListener), 1000)
	// the window.opener can be either
	// - an embedder site when clicking on `Open Session`
	// - a proteinpaint site when clicking on a shared URL link
	// accessing window.opener.location.origin may emit a CORS-related error,
	// so safer to send the message twice to cover both possibilities

	let origin
	try {
		if (window.opener.origin) {
			origin = window.opener.origin
		} else {
			origin = hostURL
		}
	} catch (e) {
		origin = hostURL
	}

	try {
		window.opener.postMessage('getActiveMassSession', origin)
	} catch (e) {
		console.log(e)
	}
}
