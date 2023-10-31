export function corsMessage(res, origin = '') {
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
	setTimeout(() => window.removeEventListener('message', messageListener), 6000)
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
