window.process = require('process')
const params = getParams()

export function matchSpecs(filepath) {
	if (!params.dir && !params.dir) return false
	const f = filepath.split('/')
	const fname = f.pop()
	const fpath = f.join('/')
	const matchedDir = !params.dir || fpath.startsWith('./' + params.dir)
	const matchedName = !params.name || fname.startsWith(params.name)
	return matchedDir && matchedName
}

function getParams() {
  const params={}
  if (!window.location.search.length) return params
  window.location.search.substr(1).split("&").forEach(kv=>{
    const [key,value] = kv.split("=")
    params[key] = value
  })
  return params
}