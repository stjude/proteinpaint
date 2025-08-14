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
			const aiProjectWSIId = wSImagesRequest.aiProjectWSIId

			if ((!sampleId && wsimage) || !aiProjectWSIId) {
				throw new Error('Invalid parameters: sampleId and wsimage or aiProjectWSIId must be provided')
			}

			const cookieJar = new CookieJar()
			const setCookie = promisify(cookieJar.setCookie.bind(cookieJar))
			const getCookieString = promisify(cookieJar.getCookieString.bind(cookieJar))

			const wsiImagePath = await getWSImagePath(ds, wSImagesRequest)

			const session = await getSessionId(ds, cookieJar, getCookieString, setCookie, wsiImagePath)

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

	if (wSImagesRequest.sampleId && wSImagesRequest.wsimage) {
		return path.join(
			`${mount}/${ds.queries.WSImages.imageBySampleFolder}/${wSImagesRequest.sampleId}`,
			wSImagesRequest.wsimage
		)
	} else {
		return 'some_default_path' // Placeholder for aiProjectWSIId or other logic
	}
}

async function getSessionId(
	ds: any,
	cookieJar: any,
	getCookieString: any,
	setCookie: any,
	wsimage: string
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

	if (ds.queries.WSImages.getWSIPredictionOverlay) {
		const predictionOverlay = await ds.queries.WSImages.getWSIPredictionOverlay(wsimage)

		if (predictionOverlay) {
			const mount = serverconfig.features?.tileserver?.mount

			const annotationsFilePath = path.join(`${mount}/${ds.queries.WSImages.aiToolImageFolder}/`, predictionOverlay)
			const annotationsData = qs.stringify({
				overlay_path: annotationsFilePath
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
				predictionOverlayType: 'Prediction'
			}

			overlays.push(overlay)
		}
	}

	if (ds.queries.WSImages.getWSIUncertaintyOverlay) {
		const uncertaintyOverlay = await ds.queries.WSImages.getWSIUncertaintyOverlay(wsimage)

		if (uncertaintyOverlay) {
			const mount = serverconfig.features?.tileserver?.mount

			const annotationsFilePath = path.join(`${mount}/${ds.queries.WSImages.imageBySampleFolder}/`, uncertaintyOverlay)
			const annotationsData = qs.stringify({
				overlay_path: annotationsFilePath
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
				predictionOverlayType: 'Uncertainty'
			}

			overlays.push(overlay)
		}
	}

	const sessionData: SessionData = await sessionManager.setSession(wsimage, sessionId, tileServer, overlays)

	if (ds.queries.WSImages.getWSIPredictionPatches) {
		const predictionPatches = await ds.queries.WSImages.getWSIPredictionPatches(wsimage)

		if (!predictionPatches) throw new Error('No prediction files found')

		const mount = serverconfig.features?.tileserver?.mount

		if (!mount) throw new Error('No mount available for TileServer')

		if (predictionPatches.length > 0) {
			for (const predictionPatch of predictionPatches) {
				const predictionFilePath = path.join(`${mount}/${ds.queries.WSImages.aiToolImageFolder}/`, predictionPatch)
				const predictionsData = qs.stringify({
					overlay_path: predictionFilePath
				})

				await ky.put(`${tileServer.url}/tileserver/overlay`, {
					body: predictionsData,
					timeout: 50000,
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Cookie: `session_id=${sessionId}`
					},
					hooks: getHooks(cookieJar, getCookieString, setCookie)
				})
			}

			// Submit the color map for predictions
			const cmapData = qs.stringify({
				cmap: JSON.stringify({
					keys: ['prediction', 'annotation'],
					values: [ds.queries.WSImages.predictionColor, ds.queries.WSImages.annotationsColor]
				})
			})

			await ky.put(`${tileServer.url}/tileserver/cmap`, {
				body: cmapData,
				timeout: 50000,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Cookie: `session_id=${sessionId}`
				},
				hooks: getHooks(cookieJar, getCookieString, setCookie)
			})
		}
	}

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
