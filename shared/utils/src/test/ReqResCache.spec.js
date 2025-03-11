import tape from 'tape'
import { ReqResCache } from '../ReqResCache.js'
import fs from 'fs'

tape('\n', function (test) {
	test.pass('-***- #shared/ReqResCache specs -***-')
	test.end()
})

const cachedir = process.cwd() + '/.ReqResCacheTest'
if (fs.existsSync(cachedir)) fs.rmSync(cachedir, {recursive: true})

tape('ReqResCache instance', test => {
	fs.mkdirSync(cachedir)
	{
		const cache = new ReqResCache({path: '/termdb/abc', query: {x:1, y: 1}})
		//console.log(cache)
		test.deepEqual(
			Object.keys(cache).sort(), 
			['opts', 'reqPath', 'generalRoutes', 'customSubroute', 'data', 'reqJson'].sort(), 
			'should not have loc properties, initially'
		)
		
		const loc0 = cache.getLoc(cachedir, '')
		test.deepEqual(
			loc0, 
			{ 
				subdir: '/Users/esioson/dev/sjpp/proteinpaint/shared/utils/.ReqResCacheTest/termdb.abc',
				id: 'bede63aec750e1c0339584bb3ead740cd3a68ee5', // pragma: allowlist secret
				req: '/Users/esioson/dev/sjpp/proteinpaint/shared/utils/.ReqResCacheTest/termdb.abc/bede63aec750-req.json', 
				res: '/Users/esioson/dev/sjpp/proteinpaint/shared/utils/.ReqResCacheTest/termdb.abc/bede63aec750-res.json' 
			}, 
			'should set the correct loc'
		)

		const loc1 = cache.getLoc(cachedir, 'test')
		test.deepEqual(
			loc1, 
			{ 
				subdir: `${cachedir}/termdb.abc`, 
				id: 'bede63aec750e1c0339584bb3ead740cd3a68ee5',  // pragma: allowlist secret
				req: `${cachedir}/termdb.abc/bede63aec750-req.json`, 
				res: `${cachedir}/termdb.abc/bede63aec750-res.json` 
			}, 
			'should set the correct loc'
		)
	}
	{
		const cache = new ReqResCache({path: '/termdb', query: {getregression:1, y: 1}})
		const loc = cache.getLoc(cachedir, 'test')
		test.deepEqual(
			loc, 
			{ 
				subdir: `${cachedir}/termdb~getregression`,
				id: '7b476ce65cb16dc88151df21340ae01091443ca8',  // pragma: allowlist secret
				req: `${cachedir}/termdb~getregression/7b476ce65cb1-req.json`,
				res: `${cachedir}/termdb~getregression/7b476ce65cb1-res.json`
			}, 
			'should set the correct loc for /termdb?getregression=1'
		)
	}
	{
		const cache = new ReqResCache({path: '/termdb', query: {for:'matrix', y: 1}})
		const loc = cache.getLoc(cachedir, 'test')
		test.deepEqual(
			loc, 
			{
				subdir: `${cachedir}/termdb~for`, 
				id: '95e3ccd4281cd5939d896452b0230baa1e1fec75',  // pragma: allowlist secret
				req: `${cachedir}/termdb~for/95e3ccd4281c-req.json`, 
				res: `${cachedir}/termdb~for/95e3ccd4281c-res.json`
			}, 
			'should set the correct loc for /termdb?for=matrix'
		)
		test.true(!fs.existsSync(loc.sudbir), 'should not mkdir in test mode')
	}
	fs.rmSync(cachedir, {recursive: true})
	test.end()
})

tape('ReqResCache read, write', async test => {
	fs.mkdirSync(cachedir)
	{
		const cache = new ReqResCache({path: '/termdb/abc', query: {for:'matrix', y: 1}}, {mode: 'mkdir'})
		const loc = cache.getLoc(cachedir, 'mkdir')
		test.true(loc.subdir && fs.existsSync(loc.subdir), `should create subdir='${loc.subdir}' in mkdir mode`)

		await cache.write()
		test.equal(cache.reqJson, undefined, 'should delete instance.reqJson upon write')
		test.true(loc.req && fs.existsSync(loc.req), 'should cache the loc.req data')
		test.true(loc.res && !fs.existsSync(loc.res), 'should not have cache loc.res, initially')
		
		await cache.write({header: {status: 200}, body: {a: 'test'}})
		test.true(loc.res && fs.existsSync(loc.res), 'should cache the loc.res if cache.write(arg) is called with an arg')

		const req = structuredClone(cache.data.req)
		const res = structuredClone(cache.data.res)
		delete cache.data.req
		delete cache.data.res
		await cache.read()
		test.deepEqual(cache.data.req, req, 'should read the cached req data')
		test.deepEqual(cache.data.res, res, 'should read the cached res data')
	}
	fs.rmSync(cachedir, {recursive: true})
	test.end()
})


