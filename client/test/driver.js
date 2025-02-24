import { Builder, logging } from 'selenium-webdriver'
import chrome from 'selenium-webdriver/chrome.js'

function createDriverInstance() {
	const options = new chrome.Options()
	options.addArguments('--headless')
	options.addArguments('--no-sandbox')
	options.addArguments('--disable-dev-shm-usage')
	options.addArguments(`--user-agent=SJPPGithubUserAgent/1.0`)

	const prefs = new logging.Preferences();
	prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL);
	options.setLoggingPrefs(prefs);

	return new Builder().forBrowser('chrome').setChromeOptions(options).build()
}

const driver = createDriverInstance()
await driver.get("http://localhost:3000/testrun.html?name=*.unit");
const interval = setInterval(async () => {
	const res = await driver.manage().logs().get(logging.Type.BROWSER);
	const lastLines = []
	let reachedSummary = false 
	for(const r of res) {
		// ignore log level, since the tests may be expecting error messages as a valid result
		// if (r.level != 'INFO') console.log(23, 'r.level=', r.level)
		const i = r.message.indexOf('"')
		const msg = r.message.slice(i+1,-1)
		console.log(msg)
		if (reachedSummary) lastLines.push(msg)
		else if (msg.startsWith('1..')) reachedSummary = true
	}
	if (reachedSummary) {
		if (!lastLines.find(l => l.startsWith('# ok'))) console.error(`\n!!! test failed !!!\n`)
		clearInterval(interval)
	}
}, 100)
