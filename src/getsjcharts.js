let prom

export function getsjcharts() {
	if (window.sjcharts) { //console.log('exists')
		return Promise.resolve(window.sjcharts)
	}
	else if (prom) { //console.log('pending')
		return prom
	}
	else { //console.log('requesting')
		prom = new Promise((resolve,reject)=>{
			const hostname = window.location.hostname.split('.')[0]
			const codehost = ['pecan-test'].includes(hostname) ? 'pecan-test.stjude.org' : 'pecan.stjude.cloud'
			const filename = `https://${codehost}/sjcharts/bin/sjcharts.js`
			const fileref = document.createElement('script')
	        fileref.setAttribute("type","text/javascript")
	        fileref.setAttribute("src", filename)
	        document.getElementsByTagName("head")[0].appendChild(fileref)
	        let interval, i=0
	        fileref.onload = ()=>{
	        	resolve(window.sjcharts)
	        }
	    })

	    return prom
	}
}

