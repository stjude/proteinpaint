import { createServer } from 'http'
import { parse } from 'url'
import { createReadStream, existsSync } from 'fs'
import { resolve, sep } from 'path'

const port = process.argv[3] || 8080
const publicDir = resolve('./public')
createServer((req, res) => {
	const reqUrl = parse(req.url)
	const file = reqUrl.pathname == '/' ? '/index.html' : reqUrl.pathname
	const filepath = resolve(publicDir, '.' + file)
	try {
		if (filepath.startsWith(publicDir + sep) && existsSync(filepath)) {
			res.writeHead(200, { 'Content-Type': filepath.endsWith('js') ? 'application/javascript' : 'text/html' })
			createReadStream(filepath).pipe(res)
		} else {
			res.writeHead(404, { 'Content-Type': 'text/html' })
			return res.end('404 Not Found')
		}
	} catch (e) {
		res.writeHead(500, { 'Content-Type': 'text/html' })
		return res.end('500 Server Error')
	}
}).listen(port, '127.0.0.1')

console.log(`listening on ${port} ...`)
