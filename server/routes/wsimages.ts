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

/*
return session_id and slide_dimensions of the requested WSImage
*/

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
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const sampleId = query.sampleId
			if (!sampleId) throw 'invalid sampleId'
			const wsimage = query.wsimage
			if (!wsimage) throw 'invalid wsimage'

			const sessionManager = SessionManager.getInstance()

			const cookieJar = new CookieJar()
			const setCookie = promisify(cookieJar.setCookie.bind(cookieJar))
			const getCookieString = promisify(cookieJar.getCookieString.bind(cookieJar))

			if (!req.session.user) {
				const userSessionId = crypto.createHash('sha256').update(crypto.randomBytes(32).toString('hex')).digest('hex')

				req.session.user = { id: userSessionId }
			}

			const sessionData = (await sessionManager.getSession(wsimage)) as SessionData | undefined

			let sessionId: string | undefined = undefined

			if (!sessionData) {
				// Make the request to get the session_id
				await ky.get(`${serverconfig.tileServerURL}/tileserver/session_id`, {
					hooks: {
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
				})

				// Extract session_id from the cookie jar
				const cookieString = await getCookieString(`${serverconfig.tileServerURL}/tileserver/session_id`)

				sessionId = cookieString.match(/session_id=([^;]*)/)?.[1]

				if (!sessionId) {
					throw 'session_id not found'
				}

				const sampleWsiTileServer = path.join(
					`${serverconfig.tileServerMount}/${ds.queries.WSImages.imageBySampleFolder}/${sampleId}`,
					wsimage
				)

				const data = qs.stringify({ slide_path: sampleWsiTileServer })

				// Make the PUT request with the extracted session_id and load the wsi image to the TileServer
				await ky.put(`${serverconfig.tileServerURL}/tileserver/slide`, {
					body: data,
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Cookie: `session_id=${sessionId}` // Include the session_id in the headers
					},
					hooks: {
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
				})
				await sessionManager.setSession(wsimage, new SessionData(sessionId, [req.session.user.id]))
			} else {
				if (
					sessionData.userSessionIds === undefined ||
					sessionData.userSessionIds.indexOf(req.session.user.id) === -1
				) {
					if (sessionData.userSessionIds === undefined) {
						sessionData.userSessionIds = []
					}
					sessionData.userSessionIds.push(req.session.user.id)
					await sessionManager.setSession(wsimage, sessionData)
				}
				sessionId = sessionData.imageSessionId
			}

			// Make the GET request to the TileServer get the image dimensions
			const getWsiImageResponse: any = await ky
				.get(`${serverconfig.tileServerURL}/tileserver/slide`, {
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

			const payload: WSImagesResponse = {
				status: 'ok',
				wsiSessionId: sessionId,
				browserImageInstanceId: req.session.user.id,
				slide_dimensions: getWsiImageResponse.slide_dimensions
			}
			res.status(200).json(payload)
		} catch (e: any) {
			console.log(e)
			res.status(500)
			res.send({
				status: 'error',
				error: e.error || e
			})
		}
	}
}
