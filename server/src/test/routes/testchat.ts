// Test URL: http://localhost:3000/testchat

import serverconfig from '../../serverconfig.js'
import { test_chatbot_by_dataset } from '../../../routes/chat/test/chatUnitTests.ts'

process.removeAllListeners('warning')

export default function setRoutes(app, basepath) {
	app.get(basepath + '/testchat', async () => {
		// (req.res) not currently used
		console.log('test chat page')
		for (const genome of Object.values(serverconfig.genomes)) {
			for (const ds of Object.values((genome as any).datasets)) {
				if ((ds as any)?.queries?.chat) {
					await test_chatbot_by_dataset(ds)
				}
			}
		}
	})
}
