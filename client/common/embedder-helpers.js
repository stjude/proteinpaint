export function corsMessage(res) {
	const embedder = res.state?.embedder
	const messageListener = event => {
		if (event.origin !== embedder.origin) return
		if (event.data == 'getActiveMassSession') {
			window.removeEventListener('message', messageListener)
			child.postMessage({ state: res.state }, embedder.origin) //; console.log()
			setTimeout(window.close, 500)
		}
	}
	window.addEventListener('message', messageListener, false)
	setTimeout(() => window.removeEventListener('message', messageListener), 5000)
	if (embedder.origin != window.location.origin) {
		confirm(
			`Another window will open to recover the saved session. When the next window opens,` +
				`\n- You may need to allow popups.` +
				`\n- You may have to refresh it.` +
				`\n- After the session is recovered, this browser window will automatically close.`
		)
	}
	const child = window.open(embedder.href, 'Visualization')
}
