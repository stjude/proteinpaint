/*
	Below are helper functions to securely comply with CORS while also
	enabling secure data sharing between embedder portal and pp server
	at different URLs/host domains.
	
	Sequence of steps:
	1. Parent window is opened with a mass-session-<"id" | "file" | "url">
  2. parent downloads/loads the session state
  3. if session state has "embedder" key-values, open the embedder origin
     and listen for when it is ready to receive the state

  4. child window is opened at session state.embedder.href
  5. before loading mass appInit(), child sends a posts a 'getActiveMassSession' 
     message to the the parent window

  6. the parent posts the session state as a message for the child window,
     and the parent can now close
  
  7. the child window saves the posted session state into localStorage before
     calling mass appInit(), which is then retrieved to be used for storeInit()
     in downstream code
*/

export function parentCorsMessage(res, flag = '') {
	const embedder = res.state?.embedder || {}
	const messageListener = event => {
		if (event.origin !== embedder.origin) return
		if (event.data == 'getActiveMassSession') {
			window.removeEventListener('message', messageListener)
			child?.postMessage({ state: res.state }, embedder.origin)
			if (embedder.origin != window.location.origin) {
				setTimeout(() => {
					// The recovered session will remain visible in another tab, regardless of what happens below.
					try {
						// If there is a page to go back to, assume that it's a page with a table or list of links
						// for published figures and the user would prefer to go back to that page instead of seeing steps
						// to manually go back or close the window.
						if (window.history.length > 1) window.history.back()
						// If this page was launched from clicking a link outside of a web page (such as from an email),
						// then there would be no browser history to go back to, this page should be automatically closed.
						// In this case, an embedder site was opened using an transitory proteinpaint site URL.
						// Try to close this transitory URL tab since it will not display any viz and was only used
						// to open the saved embedder URL without imposing PP-related URL parameters.
						else window.close()
						// The above was also tested to work when a shared URL is clicked from the session menu.
					} catch (e) {
						// the browser prevents the closing of a transitory tab that was opened
						// by clicking on a bookmarked link or pasting that link directly on the browser
						// address bar. In that case, make another attempt to close the transitory tab
						console.log(e)
						window.open(window.location.href, '_self')?.close()
					}
				}, 500)
			}
		}
	}
	window.addEventListener('message', messageListener, false)

	const confirmedCorsWindow = JSON.parse(localStorage.getItem('confirmedCorsWindow') || `[]`)
	if (embedder.origin && embedder.origin != window.location.origin && !confirmedCorsWindow.includes(embedder.origin)) {
		const ok = confirm(
			`Another window will open to recover the saved session. When the next window opens,` +
				`\n- You may need to allow popups.` +
				`\n- You may have to refresh it.` +
				`\n- After the session is recovered, this browser window should automatically close.`
		)
		if (ok) {
			if (embedder.origin && !confirmedCorsWindow.includes(embedder.origin)) confirmedCorsWindow.push(embedder.origin)
			localStorage.setItem('confirmedCorsWindow', JSON.stringify(confirmedCorsWindow.filter(d => d != undefined))) // not falsy
		}
	}

	if (flag != 'noredirect') {
		// only wipe document html if there is a redirect
		document.body.innerHTML = `
			<div style='margin: 20px; padding: 20px; font-size: 24px'>
				The recovered session should be visible in another browser tab.
				You may go back in your browser history or close this browser tab.
			</div>
		`
	}

	setTimeout(() => window.removeEventListener('message', messageListener), 8000)
	const child = window.open(embedder.href, '_blank')
}

// Resolves when the window.opener has posted the session state, or after a timeout if no state is posted.
// Callers must await this before mass appInit(), since storeInit() reads opts.embeddedSessionState
// once during init and the dynamic import of mass/app may finish before the opener's reply arrives.
export function childCorsMessage(opts, timeout = 1000): Promise<void> {
	if (!window.opener) return Promise.resolve()
	const hostURL = sessionStorage.getItem('hostURL')
	if (hostURL === window.location.origin) return Promise.resolve()

	// if this is a child window or tab, refreshing it will need previously hydrated session state,
	// in case the window.opener has already removed its message listener
	opts.embeddedSessionState = JSON.parse(sessionStorage.getItem('embeddedSessionState') || `{}`)

	let resolve
	const received = new Promise<void>(r => (resolve = r))
	const messageListener = event => {
		if (event.origin != window.location.origin && event.origin !== hostURL) return
		if (event.data?.state) {
			window.removeEventListener('message', messageListener)
			Object.assign(opts.embeddedSessionState, event.data.state)
			// see the comment above for when this stored embeddedState may be used
			sessionStorage.setItem('embeddedSessionState', JSON.stringify(opts.embeddedSessionState))
			resolve()
		}
	}
	window.addEventListener('message', messageListener, false)
	// limit the time to listen for the window.opener's message, for example when
	// the opener is not a proteinpaint or embedder window that will respond
	setTimeout(() => {
		window.removeEventListener('message', messageListener)
		resolve()
	}, timeout)
	// the window.opener can be either
	// - an embedder site when clicking on `Open Session`
	// - a proteinpaint site when clicking on a shared URL link
	// accessing window.opener.location.origin may emit a CORS-related error,
	// so safer to send the message twice to cover both possibilities

	let origin
	try {
		if (window.opener?.origin) {
			origin = window.opener.origin
		} else {
			origin = hostURL
		}
	} catch (e) {
		console.log(e)
		origin = hostURL
	}

	try {
		// message the window.opener, aka. parent window at a different URL domain,
		// that the child window is ready to receive the session state, if available;
		// this inter-window messaging is meant to address CORS restrictions and
		// uses the targetWindow argument (origin) to restrict who can listen
		window.opener.postMessage('getActiveMassSession', origin)
	} catch (e) {
		console.log(e)
	}
	return received
}
