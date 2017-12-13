// we can just use the exact same webpack config by requiring it
// however, remember to delete the original entry since we don't
// need it during tests
var webpackConfig = require('./webpack.config.js')

// karma.conf.js
module.exports = function (config) {
  config.set({
    browsers: ['Chrome'],
    frameworks: ['jasmine'],
    // this is the entry file for all our tests.
    files: ['./test/*.spec.js'],
    // we will pass the entry file to webpack for bundling.
    preprocessors: {
      './test/*.spec.js': ['webpack']
    },
    // use the webpack config
    webpack: webpackConfig,
    singleRun: false, //true,

    client: {
      captureConsole: true,
      mocha: {
        bail: true
      }
    },

    webpackMiddleware: {
      noInfo: true
    }
  })
}