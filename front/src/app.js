// KEEP THIS ppsrc DECLARATION AT THE TOP SCOPE !!!
// need to know the script src when pp is first loaded
// the source context may be lost after the pp script is loaded
// and a different script gets loaded in the page
const ppsrc = (document && document.currentScript && document.currentScript.src) || ''
const hostpath = ppsrc.replace('/proteinpaint.js', '')

// NOTE: stylesheets are currently handled by a custom esbuild plugin
// load the bundled css
// let link = document.createElement('link')
// link.rel = 'stylesheet'
// // NOTE: hostpath is required when PP is used by an external embedder/portal/html
// link.href = `${hostpath}/dist/app.css`
// document.head.appendChild(link)

window.runproteinpaint = async arg => {
	// requires the following symlink to be present:
	// public/bin -> proteinpaint-client/dist symlink
	//
	// NOTE: hostpath is required when PP is used by an external embedder/portal/html
	//
	const { runproteinpaint } = await import(`${hostpath}/dist/app.js`)
	if (arg) {
		// assume that this script is loaded from a full image service,
		// where the expected server base path is the parent path of /bin
		if (!arg.host) arg.host = hostpath.replace('/bin', '')
		return await runproteinpaint(arg)
	}
	window.runproteinpaint = runproteinpaint
}

// allow runpp script src code to load, even before being called,
// so it's ready sooner when called
window.runproteinpaint()
