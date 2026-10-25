import tape from 'tape'
import express from 'express'
import http from 'http'
import type { AddressInfo } from 'net'
import { freezeRoutes } from '../freezeRoutes.ts'

/*
	Tests:
		freezeRoutes() prevents adding routes and middlewares
		freezeRoutes() prevents replacing a route handler
		freezeRoutes() keeps existing routes working
*/

function getApp() {
	const app: any = express()
	app.use((req, res, next) => {
		res.set('x-test', 'ok')
		next()
	})
	app.get('/a', (req, res) => res.send('a'))
	app.post('/b/:id', (req, res) => res.json({ id: req.params.id }))
	const router = express.Router()
	router.get('/c', (req, res) => res.send('c'))
	app.use('/sub', router)
	return { app, router }
}

async function listen(app) {
	const server = http.createServer(app)
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
	const { port } = server.address() as AddressInfo
	return { server, url: `http://127.0.0.1:${port}` }
}

tape('\n', test => {
	test.comment('-***- freezeRoutes specs -***-')
	test.end()
})

tape('freezeRoutes() prevents adding routes and middlewares', test => {
	const { app, router } = getApp()
	const route = app._router.stack.find(layer => layer.route?.path == '/a').route
	freezeRoutes(app)

	test.throws(() => app.get('/x', (req, res) => res.send('x')), /not extensible/, 'should throw on app.get()')
	test.throws(() => app.use((req, res, next) => next()), /not extensible/, 'should throw on app.use()')
	test.throws(() => app.all('/x', (req, res) => res.send('x')), /not extensible/, 'should throw on app.all()')
	test.throws(
		() => router.get('/x', (req, res) => res.send('x')),
		/not extensible/,
		'should throw on adding a route to an existing sub-router'
	)
	test.throws(
		() => route.post((req, res) => res.send('x')),
		/not extensible/,
		'should throw on adding a method to an existing route'
	)
	test.throws(() => app.param('id', (req, res, next) => next()), TypeError, 'should throw on app.param()')
	test.end()
})

tape('freezeRoutes() prevents replacing a route handler', test => {
	const { app, router } = getApp()
	freezeRoutes(app)
	const stack = app._router.stack
	const layer = stack.find(layer => layer.route?.path == '/a')
	const handle = layer.route.stack[0].handle

	test.throws(() => stack.pop(), TypeError, 'should throw on removing a layer')
	test.throws(() => (stack[0] = stack[1]), TypeError, 'should throw on replacing a layer')
	test.throws(() => (layer.route.stack[0].handle = () => {}), TypeError, 'should throw on replacing a method handler')
	test.equal(layer.route.stack[0].handle, handle, 'should keep the method handler')
	test.throws(() => (layer.route = null), TypeError, 'should throw on replacing a layer route')
	test.throws(() => (layer.regexp = /.*/), TypeError, 'should throw on replacing a layer regexp')
	test.throws(() => (layer.route.methods.delete = true), TypeError, 'should throw on enabling another route method')
	test.throws(() => (app._router = express.Router()), TypeError, 'should throw on replacing the app router')
	test.throws(() => (router.stack = []), TypeError, 'should throw on replacing a sub-router stack')
	test.end()
})

tape('freezeRoutes() keeps existing routes working', async test => {
	const { app } = getApp()
	freezeRoutes(app)
	// may be called again without error
	freezeRoutes(app)
	const { server, url } = await listen(app)
	try {
		// each route is requested twice, since express updates layer properties on each request
		for (let i = 0; i < 2; i++) {
			const a = await fetch(`${url}/a`)
			test.equal(a.status, 200, 'should respond to an existing GET route')
			test.equal(await a.text(), 'a', 'should use the existing GET handler')
			test.equal(a.headers.get('x-test'), 'ok', 'should apply an existing middleware')

			const b = await fetch(`${url}/b/1`, { method: 'POST' })
			test.deepEqual(await b.json(), { id: '1' }, 'should respond to an existing POST route with a param')

			const c = await fetch(`${url}/sub/c`)
			test.equal(await c.text(), 'c', 'should respond to a route in a sub-router')
		}
		const x = await fetch(`${url}/x`)
		test.equal(x.status, 404, 'should respond with 404 to an unregistered path')
		const d = await fetch(`${url}/a`, { method: 'DELETE' })
		test.equal(d.status, 404, 'should respond with 404 to an unregistered method')
	} finally {
		server.close()
	}
	test.end()
})
