// in test browser environment like Electron or headless Chrome,
// the native fetch API will not know the default host or might
// not have access to the localStorage, so
// testHost will be used as default as needed
window.testHost = 'http://localhost:3000'
sessionStorage.setItem('hostURL', window.testHost)

// trigger the test
window.runproteinpaint({ noheader: true, testInternals: true })
