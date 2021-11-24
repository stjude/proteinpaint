const route = process.argv[2]
if (!route)
	throw `Usage: [path/]update.sh route
  where route is a server host+dataset specific route
  for submitting replacement tab-delimited text content  
`

const fs = require('fs')
const http = require('http')

// use JSON.stringify() to encode tab, newlines in tab-delimited data
const anno = fs.readFileSync(`../pnet_annotations.txt`, { encoding: 'utf8' })
const surv = fs.readFileSync(`../survival.txt`, { encoding: 'utf8' })
const data = JSON.stringify({
	annotations: anno,
	survival: surv
})

//console.log(data)

const options = {
	hostname: 'localhost',
	port: 3000,
	path: route,
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'Content-Length': data.length
	}
}

const req = http.request(options, res => {
	console.log(`statusCode: ${res.statusCode}`)

	res.on('data', d => {
		process.stdout.write(d + '\n')
	})
})

req.on('error', error => {
	console.error(error)
})

req.write(new TextEncoder().encode(data))
req.end()
