// in test browser environment like Electron or headless Chrome,
// the native fetch API will not know the default host or might
// not have access to the localStorage, so
// configHost will be used as default as needed
// const serverconfig = require('../../serverconfig')
window.testHost = 'http://localhost:3000' //+ serverconfig.port
sessionStorage.setItem('hostURL', window.testHost)

// trigger the test
window.runproteinpaint({ noheader: true, testInternals: true })
