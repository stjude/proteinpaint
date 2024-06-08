window.runproteinpaint = async arg => {
	// requires the following symlink to be present:
	// public/bin -> proteinpaint-client/dist symlink
	const { runproteinpaint } = await import('../dist/app.js')
	if (arg) return await runproteinpaint(arg)
	window.runproteinpaint = runproteinpaint
}

// allow runpp script src code to load, even before being called,
// so it's ready sooner when called
window.runproteinpaint()
