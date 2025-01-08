import ky from 'ky'
import qs from 'qs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { CookieJar } from 'tough-cookie'
import { promisify } from 'util'
import type { WSImagesRequest, WSImagesResponse, RouteApi } from '#types'
import { wsImagesPayload } from '#types/checkers'
import SessionManager, { SessionData } from '../src/wsisessions/SessionManager.ts'
import crypto from 'crypto'

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
			let sessionManager
			let sessionData
			let userSessionId: string | undefined = undefined

			if (serverconfig.redis) {
				sessionManager = SessionManager.getInstance(serverconfig.redis.url)

				userSessionId = crypto.createHash('sha256').update(crypto.randomBytes(32).toString('hex')).digest('hex')

				sessionData = await sessionManager.getSession(wsimage)
			}

			const sessionId = sessionData
				? sessionData.imageSessionId
				: await getSessionId(cookieJar, getCookieString, setCookie, wsimage, ds, sampleId)

			if (serverconfig.redis && sessionManager) {
				await manageUserSession(sessionManager, sessionData, wsimage, userSessionId, sessionId)
			}

			const getWsiImageResponse: any = await getWsiImageDimensions(sessionId, getCookieString)

			const payload: WSImagesResponse = {
				status: 'ok',
				wsiSessionId: sessionId,
				browserImageInstanceId: serverconfig.redis ? userSessionId : undefined,
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
	await ky.get(`${serverconfig.tileServerURL}/tileserver/session_id`, {
		timeout: 50000,
		hooks: getHooks(cookieJar, getCookieString, setCookie)
	})

	const cookieString = await getCookieString(`${serverconfig.tileServerURL}/tileserver/session_id`)
	const sessionId = cookieString.match(/session_id=([^;]*)/)?.[1]
	if (!sessionId) throw new Error('session_id not found')

	const sampleWsiTileServer = path.join(
		`${serverconfig.tileServerMount}/${ds.queries.WSImages.imageBySampleFolder}/${sampleId}`,
		wsimage
	)
	const data = qs.stringify({ slide_path: sampleWsiTileServer })

	await ky.put(`${serverconfig.tileServerURL}/tileserver/slide`, {
		body: data,
		timeout: 50000,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Cookie: `session_id=${sessionId}`
		},
		hooks: getHooks(cookieJar, getCookieString, setCookie)
	})

	return sessionId
}

async function manageUserSession(sessionManager, sessionData, wsimage, userId, sessionId) {
	if (!sessionData) {
		await sessionManager.setSession(wsimage, new SessionData(sessionId, [userId]))
	} else if (!sessionData.userSessionIds || !sessionData.userSessionIds.includes(userId)) {
		sessionData.userSessionIds = sessionData.userSessionIds || []
		sessionData.userSessionIds.push(userId)
		await sessionManager.setSession(wsimage, sessionData)
	}
}

async function getWsiImageDimensions(sessionId, getCookieString) {
	return await ky
		.get(`${serverconfig.tileServerURL}/tileserver/slide`, {
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
