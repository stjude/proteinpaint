const ds = require('./sjlife2.hg38.js')
const dscopy = JSON.parse(JSON.stringify(ds))
delete dscopy.cohort.termdb.selectCohort
module.exports = dscopy
