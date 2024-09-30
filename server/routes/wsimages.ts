import ky from 'ky'
import qs from 'qs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { CookieJar } from 'tough-cookie'
import { promisify } from 'util'
import { GetWSImagesRequest, GetWSImagesResponse } from '#types'

/*
return session_id and slide_dimensions of the requested WSImage
*/

const routePath = 'wsimages'

export const api: any = {
	endpoint: `${routePath}`,
	methods: {
		get: {
			init,
			request: {
				typeId: 'GetWSImagesRequest'
			},
			response: {
				typeId: 'GetWSImagesResponse'
			}
		},
		post: {
			alternativeFor: 'get',
			init
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const query = req.query as GetWSImagesRequest
			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const sampleId = query.sampleId
			if (!sampleId) throw 'invalid sampleId'
			const wsimage = query.wsimage
			if (!wsimage) throw 'invalid wsimage'

			const cookieJar = new CookieJar()
			const setCookie = promisify(cookieJar.setCookie.bind(cookieJar))
			const getCookieString = promisify(cookieJar.getCookieString.bind(cookieJar))

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
			const sessionId = cookieString.match(/session_id=([^;]*)/)?.[1]

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

			// Make the GET request to the TileServer get the image dimensions
			const getWsiImageResponse: any = await ky
				.get(`${serverconfig.tileServerURL}/tileserver/slide`, {
					hooks: {
						beforeRequest: [
							async request => {
								const cookie = await getCookieString(request.url)
								request.headers.set('Cookie', cookie)
							}
						]
					}
				})
				.json()

			res
				.status(200)
				.json({ sessionId: sessionId, slide_dimensions: getWsiImageResponse.slide_dimensions } as GetWSImagesResponse)
		} catch (e: any) {
			console.log(e)
			res.send({
				status: 'error',
				error: e.error || e
			})
		}
	}
}
