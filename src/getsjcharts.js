let prom

export function getsjcharts() {
	if (window.sjcharts) {
		//console.log('exists')
		return Promise.resolve(window.sjcharts)
	} else if (prom) {
		//console.log('pending')
		return prom
	} else {
		//console.log('requesting')
		prom = new Promise((resolve, reject) => {
			const subdomain = window.location.hostname.split('.')[0]
			const codehost = ['pp-test', 'pecan-test', 'ppr'].includes(subdomain)
				? `${subdomain}.stjude.org`
				: 'proteinpaint.stjude.org'
			const filename = `https://${codehost}/sjcharts/bin/sjcharts.js`
			const fileref = document.createElement('script')
			fileref.setAttribute('type', 'text/javascript')
			fileref.setAttribute('src', filename)
			document.getElementsByTagName('head')[0].appendChild(fileref)
			fileref.onload = () => {
				resolve(window.sjcharts)
			}
			fileref.onerror = () => {
				const message = 'Unable to load SJCharts from ' + filename
				alert(message)
				reject(message)
			}
		})

		return prom
	}
}
