import ky from 'ky'
import qs from 'qs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { CookieJar } from 'tough-cookie'
import { promisify } from 'util'
import type { WSImagesRequest, WSImagesResponse, RouteApi } from '#types'
import { wsImagesPayload } from '#types/checkers'
import SessionManager, { SessionData } from '../src/wsisessions/SessionManager.ts'
import { ShardManager } from '#src/shardig/ShardManager.js'
import { TileServerShardingAlgorithm } from '#src/shardig/TileServerShardingAlgorithm.js'
import { RedisShardingAlgorithm } from '#src/shardig/RedisShardingAlgorithm.js'
import { RedisShard } from '#src/shardig/RedisShard.js'
import { TileServerShard } from '#src/shardig/TileServerShard.js'

const routePath = 'wsimages'
export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		get: {
			...wsImagesPayload,
			init
		},
		post: {
			...wsImagesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query: WSImagesRequest = req.query
			const g = genomes[query.genome]
			if (!g) throw new Error('Invalid genome name')
			const ds = g.datasets[query.dslabel]
			if (!ds) throw new Error('Invalid dataset name')
			const sampleId = query.sampleId
			if (!sampleId) throw new Error('Invalid sampleId')
			const wsimage = query.wsimage
			if (!wsimage) throw new Error('Invalid wsimage')

			const cookieJar = new CookieJar()
			const setCookie = promisify(cookieJar.setCookie.bind(cookieJar))
			const getCookieString = promisify(cookieJar.getCookieString.bind(cookieJar))

			const sessionId = await getSessionId(cookieJar, getCookieString, setCookie, wsimage, ds, sampleId)

			const getWsiImageResponse: any = await getWsiImageDimensions(sessionId, getCookieString, wsimage)

			const payload: WSImagesResponse = {
				status: 'ok',
				wsiSessionId: sessionId,
				slide_dimensions: getWsiImageResponse.slide_dimensions
			}

			res.status(200).json(payload)
		} catch (e: any) {
			console.error(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}

async function getSessionId(cookieJar, getCookieString, setCookie, wsimage, ds, sampleId) {
	const shardManager = ShardManager.getInstance()

	const tileServer: TileServerShard = shardManager.shardingAlgorithmsMap
		?.get(TileServerShardingAlgorithm.TILE_SERVER_SHARDING_KEY)
		?.getShard(wsimage)

	if (!tileServer) throw new Error('No tile server found')

	const redis: RedisShard = shardManager.shardingAlgorithmsMap
		?.get(RedisShardingAlgorithm.REDIS_SHARDING_KEY)
		?.getShard(wsimage)

	if (!redis) throw new Error('No redis found')

	const sessionManager = SessionManager.getInstance(redis.url, redis.secret)

	const validateSuccesful = await sessionManager.invalidateSessions(3, 5)

	if (!validateSuccesful) throw new Error('Session invalidation failed')

	const sessionData = await sessionManager.getSession(wsimage)

	console.log('sessionData', sessionData)

	if (sessionData) return sessionData.imageSessionId

	await ky.get(`${tileServer.url}/tileserver/session_id`, {
		timeout: 50000,
		hooks: getHooks(cookieJar, getCookieString, setCookie)
	})

	const cookieString = await getCookieString(`${tileServer.url}/tileserver/session_id`)
	const sessionId = cookieString.match(/session_id=([^;]*)/)?.[1]
	if (!sessionId) throw new Error('session_id not found')

	const sampleWsiTileServer = path.join(
		`${tileServer.mount}/${ds.queries.WSImages.imageBySampleFolder}/${sampleId}`,
		wsimage
	)
	const data = qs.stringify({ slide_path: sampleWsiTileServer })

	await ky.put(`${tileServer.url}/tileserver/slide`, {
		body: data,
		timeout: 50000,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Cookie: `session_id=${sessionId}`
		},
		hooks: getHooks(cookieJar, getCookieString, setCookie)
	})

	await sessionManager.setSession(wsimage, sessionId)

	return sessionId
}

async function getWsiImageDimensions(sessionId, getCookieString, wsimage) {
	const shardManager = ShardManager.getInstance()

	const tileServer: TileServerShard = shardManager.shardingAlgorithmsMap
		?.get(TileServerShardingAlgorithm.TILE_SERVER_SHARDING_KEY)
		?.getShard(wsimage)

	if (!tileServer) {
		throw new Error('No tile server')
	}

	return await ky
		.get(`${tileServer.url}/tileserver/slide`, {
			timeout: 120000,
			hooks: {
				beforeRequest: [
					async request => {
						let cookie = await getCookieString(request.url)
						if (!cookie) {
							cookie = `session_id=${sessionId}`
						}
						request.headers.set('Cookie', cookie)
					}
				]
			}
		})
		.json()
}

function getHooks(cookieJar: any, getCookieString, setCookie) {
	return {
		beforeRequest: [
			async request => {
				const cookie = await getCookieString(request.url)
				request.headers.set('Cookie', cookie)
			}
		],
		afterResponse: [
			async (request, options, response) => {
				const setCookieHeader = response.headers.get('set-cookie')
				if (setCookieHeader) {
					await setCookie(setCookieHeader, request.url)
				}
			}
		]
	}
}
