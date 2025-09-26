import ky from 'ky'
import qs from 'qs'
import path from 'path'
import { CookieJar } from 'tough-cookie'
import { promisify } from 'util'
import type { PredictionOverlay, RouteApi, WSImagesRequest, WSImagesResponse } from '#types'
import { wsImagesPayload } from '#types/checkers'
import SessionManager from '../src/wsisessions/SessionManager.ts'
import type { SessionData } from '../src/wsisessions/SessionManager.ts'
import { ShardManager } from '#src/sharding/ShardManager.ts'
import { TileServerShardingAlgorithm } from '#src/sharding/TileServerShardingAlgorithm.ts'
import type { TileServerShard } from '#src/sharding/TileServerShard.ts'
import serverconfig from '#src/serverconfig.js'

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
			const wSImagesRequest: WSImagesRequest = req.query
			const g = genomes[wSImagesRequest.genome]
			if (!g) throw new Error('Invalid genome name')
			const ds = g.datasets[wSImagesRequest.dslabel]
			if (!ds) throw new Error('Invalid dataset name')
			const sampleId = wSImagesRequest.sampleId
			const wsimage = wSImagesRequest.wsimage
			const aiProjectId = wSImagesRequest.aiProjectId

			if (!sampleId && (!wsimage || !aiProjectId)) {
				throw new Error('Invalid parameters: sampleId or both wsimage and aiProjectId must be provided')
			}

			const cookieJar = new CookieJar()
			const setCookie = promisify(cookieJar.setCookie.bind(cookieJar))
			const getCookieString = promisify(cookieJar.getCookieString.bind(cookieJar))

			const wsiImagePath = await getWSImagePath(ds, wSImagesRequest)

			// TODO use project id when creating a session
			const session = await getSessionId(ds, cookieJar, getCookieString, setCookie, wsiImagePath, aiProjectId)

			const getWsiImageResponse: any = await getWsiImageDimensions(
				session.imageSessionId,
				getCookieString,
				wsiImagePath
			)

			const payload: WSImagesResponse = {
				status: 'ok',
				wsiSessionId: session.imageSessionId,
				overlays: session.overlays,
				slide_dimensions: getWsiImageResponse.slide_dimensions
			}

			res.status(200).json(payload)
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}

async function getWSImagePath(ds: any, wSImagesRequest: WSImagesRequest) {
	const mount = serverconfig.features?.tileserver?.mount

	if (!mount) throw new Error('No mount available for TileServer')

	if (wSImagesRequest.sampleId) {
		return path.join(
			`${mount}/${ds.queries.WSImages.imageBySampleFolder}/${wSImagesRequest.sampleId}`,
			wSImagesRequest.wsimage
		)
	} else {
		return path.join(`${mount}/${ds.queries.WSImages.aiToolImageFolder}/`, wSImagesRequest.wsimage)
	}
}

async function getSessionId(
	ds: any,
	cookieJar: any,
	getCookieString: any,
	setCookie: any,
	wsimage: string,
	projectId?: any
): Promise<SessionData> {
	const sessionManager = SessionManager.getInstance()

	const invalidateResult = await sessionManager.syncAndInvalidateSessions(wsimage)

	if (!invalidateResult) throw new Error('Session invalidation failed')

	const session = await sessionManager.getSession(wsimage)

	// TODO fix image layers recovery in case redis goes down.
	if (session) {
		return session
	}

	const tileServer = await sessionManager.getTileServerShard(wsimage)

	if (!tileServer) throw new Error('No TileServer shard available')

	await ky.get(`${tileServer.url}/tileserver/session_id`, {
		timeout: 50000,
		hooks: getHooks(cookieJar, getCookieString, setCookie)
	})

	const cookieString = await getCookieString(`${tileServer.url}/tileserver/session_id`)
	const sessionId = cookieString.match(/session_id=([^;]*)/)?.[1]
	if (!sessionId) throw new Error('session_id not found')

	const overlays: Array<PredictionOverlay> = []

	const data = qs.stringify({ slide_path: wsimage })

	await ky.put(`${tileServer.url}/tileserver/slide`, {
		body: data,
		timeout: 50000,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Cookie: `session_id=${sessionId}`
		},
		hooks: getHooks(cookieJar, getCookieString, setCookie)
	})

	if (ds.queries.WSImages.getPredictionLayers) {
		const predictionLayers: Map<string, string> | Record<string, string> | undefined =
			await ds.queries.WSImages.getPredictionLayers(projectId, wsimage)

		if (predictionLayers) {
			const mount = serverconfig.features?.tileserver?.mount

			const resolveFilename = (key: string): string | undefined => {
				if (!predictionLayers) return undefined
				if (predictionLayers instanceof Map) return predictionLayers.get(key) ?? undefined
				// handle plain object
				return (predictionLayers as Record<string, string>)[key] ?? undefined
			}

			const pushOverlayForKey = async (
				key: 'Prediction' | 'Uncertainty',
				predictionOverlayType: 'Prediction' | 'Uncertainty'
			) => {
				const filename = resolveFilename(key)
				if (!filename) return
				const overlayFilePath = path.join(`${mount}/${ds.queries.WSImages.aiToolImageFolder}/`, filename)
				const annotationsData = qs.stringify({
					overlay_path: overlayFilePath
				})

				const layerNumber: string = await ky
					.put(`${tileServer.url}/tileserver/overlay`, {
						body: annotationsData,
						timeout: 50000,
						headers: {
							'Content-Type': 'application/x-www-form-urlencoded',
							Cookie: `session_id=${sessionId}`
						},
						hooks: getHooks(cookieJar, getCookieString, setCookie)
					})
					.json()

				const overlay: PredictionOverlay = {
					layerNumber: layerNumber,
					predictionOverlayType
				}

				overlays.push(overlay)
			}

			await pushOverlayForKey('Prediction', 'Prediction')
			await pushOverlayForKey('Uncertainty', 'Uncertainty')
		}
	}

	// TODO add session id
	const sessionData: SessionData = await sessionManager.setSession(wsimage, sessionId, tileServer, overlays)

	return sessionData
}

async function getWsiImageDimensions(sessionId, getCookieString, wsimage) {
	const shardManager = ShardManager.getInstance()

	const tileServer: TileServerShard = await shardManager.shardingAlgorithmsMap
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
