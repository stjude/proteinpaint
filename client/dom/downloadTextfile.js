export function to_textfile(filename, text) {
	const a = document.createElement('a')
	a.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text))
	a.setAttribute('download', filename)
	a.style.display = 'none'
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
}
