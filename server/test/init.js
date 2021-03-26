// in test browser environment like Electron or headless Chrome,
// the native fetch API will not know the default host or might
// not have access to the localStorage, so
// configHost will be used as default as needed
const serverconfig = require('../../serverconfig')
window.testHost = 'http://localhost:' + serverconfig.port
