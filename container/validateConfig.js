const fs = require('fs')
const c = require('./serverconfig.json')

if (!c.tpmasterdir) throw 'There must be a serverconfig.tpmasterdir entry.'

if (!c.port) c.port = 3000

if (c.url && !c.URL) c.URL = c.url
if (!c.URL) c.URL = 'http://localhost:3456'
if (isNaN(c.URL.split(':')[2]))
	throw 'A serverconfig.URL entry must have a port number, for example http://localhost:3456'

fs.writeFileSync('./serverconfig.json', JSON.stringify(c, null, '   '), { charset: 'utf8' })
