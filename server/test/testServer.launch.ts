// child process entry for test/testServer.ts: launches the full server app,
// using the serverconfig.json that is found in the child process working directory
import { launch } from '../src/app.ts'

await launch()
