const tape = require("tape")
const b = require("../../modules/termdb.bins")

const get_summary = (()=>{
  const values = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]
  const n = values.length/100
  return (percentiles) => {
    const summary = {
      min: Math.min(...values),
      max: Math.max(...values)
    }
    
    const pct = []
    for(const num of percentiles) {
      summary['p'+num] = values[Math.floor(num*n)]
    }

    return summary
  }
})()



tape("\n", function(test) {
  test.pass("-***- termdb.bins specs -***-")
  test.end()
})




tape("compute_bins() error handling", function (test) {
  const mssg0a = "should throw on empty config"
  try {
    b.compute_bins()
    test.fail(mssg0a)
  } catch(e) {
    test.equal(e, 'bin schema must be an object', mssg0a)
  }

  const mssg1a = "should throw on missing bin_size"
  try {
    b.compute_bins({}, get_summary)
    test.fail(mssg1a)
  } catch(e) {
    test.equal(e, 'missing custom_bin.bin_size', mssg1a)
  }

  const mssg1b = "should throw on non-numeric bin_size"
  try {
    b.compute_bins({bin_size: 'abc'}, get_summary)
    test.fail(mssg1b)
  } catch(e) {
    test.equal(e, 'non-numeric bin_size', mssg1b)
  }

  const mssg1c = "should throw on bin_size <= 0"
  try {
    b.compute_bins({bin_size: 0}, get_summary)
    test.fail(mssg1c)
  } catch(e) {
    test.equal(e, 'bin_size must be greater than 0', mssg1c)
  }

  const mssg2a = "should throw on missing first_bin"
  try {
    b.compute_bins({bin_size: 5}, get_summary)
    test.fail(mssg2)
  } catch(e) {
    test.equal(e, 'first_bin missing', mssg2a)
  }

  const mssg2b = "should throw on a non-object first_bin"
  try {
    b.compute_bins({bin_size: 5, first_bin: 'abc'}, get_summary)
    test.fail(mssg2b)
  } catch(e) {
    test.equal(e, 'first_bin is not an object', mssg2b)
  }

  const mssg2bi = "should throw on an empty first_bin object"
  try {
    b.compute_bins({bin_size: 5, first_bin: {}}, get_summary)
    test.fail(mssg2bi)
  } catch(e) {
    test.equal(e, 'first_bin is an empty object', mssg2bi)
  }

  const mssg2c = "should throw if missing first_bin.startunbounded + stop, or start_percentile, or start"
  try {
    b.compute_bins({bin_size: 5, first_bin: {startunbounded:1}}, get_summary)
    test.fail(mssg2c)
  } catch(e) {
    test.equal(e, 'must set first_bin.start, or start_percentile, or startunbounded + stop', mssg2c)
  }
  /*
  const mssg3 = "should throw if missing last_bin.stopunbounded + start, or stop_percentile, or stop"
  try {
    b.compute_bins({bin_size: 5, first_bin: {start:2}, last_bin: {}}, get_summary)
    test.fail(mssg3)
  } catch(e) {
    test.equal(e, 'must set last_bin.stopunbounded + start, or stop_percentile, or stop', mssg3)
  }*/

  test.end()
})


tape("get_bin_label()", function (test) {
  // test smaller helper functions first since they
  // tend to get used in larger functions and the
  // testing sequence would help isolate the cause(s)
  // of multiple failing tests 
  const binconfig = {
    bin_size:3,
    startinclusive:true, 
    first_bin:{},
    results: {
      summary: {
        min: 0
      }
    }
  }
  test.equal(
    b.get_bin_label({startunbounded:1, stop: 3}, binconfig),
    "<3",
    "startunbounded"
  )

  test.equal(
    b.get_bin_label({startunbounded:1, stop: 3, stopinclusive: 1}, binconfig),
    "≤3",
    "startunbounded + stopinclusive"
  )
  
  test.deepEqual(
    b.get_bin_label({stopunbounded:1, start: 30}, binconfig),
    ">30",
    "stopunbounded"
  )

  test.equal(
    b.get_bin_label({stopunbounded:1, start: 25, startinclusive: 1}, binconfig),
    "≥25",
    "stopunbounded + startinclusive"
  )

  test.equal(
    b.get_bin_label({start: 1, stop: 5, startinclusive: 1}, binconfig),
    "1 to 4",
    "integer start and stop, startinclusive and not stopinclusive"
  )

  test.equal(
    b.get_bin_label({start: 1, stop: 5, stopinclusive: 1}, binconfig),
    "2 to 5",
    "integer start and stop, not startinclusive but stopinclusive"
  )

  test.equal(
    b.get_bin_label({start: 1, stop: 5, stopinclusive: 1, startinclusive: 1}, binconfig),
    "1 to 5",
    "integer start and stop, both startinclusive and stopinclusive"
  )

  test.equal(
    b.get_bin_label({start: 1, stop: 5}, binconfig),
    "2 to 4",
    "integer start and stop, neither startinclusive nor stopinclusive"
  )

  test.end()
})


tape("compute_bins() unbounded", function (test) {
  test.deepLooseEqual(
    b.compute_bins({bin_size: 5, first_bin: {startunbounded:1, stop:5}}, get_summary),
    [
      { startunbounded: 1, start: undefined, stop: 5, startinclusive: 1, stopinclusive: 0, label: '<5' },
      { startinclusive: 1, stopinclusive: 0, start: 5, stop: 10, label: '5 to 9' },
      { startinclusive: 1, stopinclusive: 0, start: 10, stop: 15, label: '10 to 14' },
      { startinclusive: 1, stopinclusive: 0, start: 15, stop: 20, label: '15 to 20' }
    ],
    "should default to unbounded firt and last bins, equally sized bins"
  )

  test.deepLooseEqual(
    b.compute_bins({bin_size: 4, first_bin: {startunbounded:1, stop: 2}}, get_summary),
    [
      { startunbounded: 1, start: undefined, stop: 2, startinclusive: 1, stopinclusive: 0, label: '<2' },
      { startinclusive: 1, stopinclusive: 0, start: 2, stop: 6, label: '2 to 5' },
      { startinclusive: 1, stopinclusive: 0, start: 6, stop: 10, label: '6 to 9' },
      { startinclusive: 1, stopinclusive: 0, start: 10, stop: 14, label: '10 to 13' },
      { startinclusive: 1, stopinclusive: 0, start: 14, stop: 18, label: '14 to 17' },
      { startinclusive: 1, stopinclusive: 0, start: 18, stop: 20, label: '18 to 20' }
    ],
    "should default to unbounded firt and last bins, not equally sized bins"
  )

  test.deepLooseEqual(
    b.compute_bins({bin_size: 6, first_bin: {startunbounded:1, start_percentile:4, start:5, stop: 10}}, get_summary),
    [
      { startunbounded: 1, start: undefined, stop: 10, startinclusive: 1, stopinclusive: 0, label: '<10' },
      { startinclusive: 1, stopinclusive: 0, start: 10, stop: 16, label: '10 to 15' },
      { startinclusive: 1, stopinclusive: 0, start: 16, stop: 20, label: '16 to 20' }
    ],
    "should override start_percentile or start with startunbounded"
  )

  // stopunbounded

  test.end()
})


tape("compute_bins() non-percentile", function (test) {
  test.deepLooseEqual(
    b.compute_bins({bin_size: 3, first_bin: {start:4}}, get_summary),
    [
      { startunbounded: undefined, start: 4, stop: 7, startinclusive: 1, stopinclusive: 0, label: '4 to 6' },
      { startinclusive: 1, stopinclusive: 0, start: 7, stop: 10, label: '7 to 9' },
      { startinclusive: 1, stopinclusive: 0, start: 10, stop: 13, label: '10 to 12' },
      { startinclusive: 1, stopinclusive: 0, start: 13, stop: 16, label: '13 to 15' },
      { startinclusive: 1, stopinclusive: 0, start: 16, stop: 19, label: '16 to 18' }, 
      { startinclusive: 1, stopinclusive: 0, start: 19, stop: 20, label: '19 to 20' }
    ],
    "should handle first_bin.start"
  )

  test.deepLooseEqual(
    b.compute_bins({bin_size: 3, first_bin: {start:4, stop: 8}}, get_summary),
    [
      { startunbounded: undefined, start: 4, stop: 8, startinclusive: 1, stopinclusive: 0, label: '4 to 7' },
      { startinclusive: 1, stopinclusive: 0, start: 8, stop: 11, label: '8 to 10' },
      { startinclusive: 1, stopinclusive: 0, start: 11, stop: 14, label: '11 to 13' },
      { startinclusive: 1, stopinclusive: 0, start: 14, stop: 17, label: '14 to 16' },
      { startinclusive: 1, stopinclusive: 0, start: 17, stop: 20, label: '17 to 20' }
    ],
    "should handle first_bin.start + stop"
  )

  test.deepLooseEqual(
    b.compute_bins({bin_size: 4, first_bin: {start:4}, last_bin: {stop:15}}, get_summary),
    [ 
      { startunbounded: undefined, start: 4, stop: 8, startinclusive: 1, stopinclusive: 0, label: '4 to 7' },
      { startinclusive: 1, stopinclusive: 0, start: 8, stop: 12, label: '8 to 11' },
      { startinclusive: 1, stopinclusive: 0, start: 12, stop: 15, label: '12 to 14' }
    ],
    "should handle last_bin.start"
  )

  test.deepLooseEqual(
    b.compute_bins({bin_size: 3, first_bin: {startunbounded: 1, stop:3}, last_bin: {start:15, stop: 18}}, get_summary),
    [
      { startunbounded: 1, start: undefined, stop: 3, startinclusive: 1, stopinclusive: 0, label: '<3' },
      { startinclusive: 1, stopinclusive: 0, start: 3, stop: 6, label: '3 to 5' },
      { startinclusive: 1, stopinclusive: 0, start: 6, stop: 9, label: '6 to 8' },
      { startinclusive: 1, stopinclusive: 0, start: 9, stop: 12, label: '9 to 11' },
      { startinclusive: 1, stopinclusive: 0, start: 12, stop: 15, label: '12 to 14' },
      { startinclusive: 1, stopinclusive: 0, start: 15, stop: 18, label: '15 to 17' }
    ],
    "should handle last_bin.start + stop"
  )

  test.deepLooseEqual(
    b.compute_bins({
      bin_size: 1, 
      first_bin: {start: 5, stopunbounded:1, stop: 7, stopinclusive: 1}, 
      last_bin: {start:12, stopunbounded: 1}
    }, get_summary),
    [ 
      { startunbounded: undefined, start: 5, stop: 7, startinclusive: 1, stopinclusive: 0, label: 5 },
      { startinclusive: 1, stopinclusive: 0, start: 7, stop: 8, label: 7 }, 
      { startinclusive: 1, stopinclusive: 0, start: 8, stop: 9, label: 8 },
      { startinclusive: 1, stopinclusive: 0, start: 9, stop: 10, label: 9 },
      { startinclusive: 1, stopinclusive: 0, start: 10, stop: 11, label: 10 },
      { startinclusive: 1, stopinclusive: 0, start: 11, stop: 12, label: 11 },
      { startinclusive: 1, stopinclusive: 0, start: 12, stop: 13, stopunbounded: true, label: '≥12' }
    ],
    "should handle first_bins, last_bin"
  )

  test.end()
})


tape("target_percentiles()", function (test) {
  test.deepLooseEqual(
    b.target_percentiles({bin_size: 3, first_bin: {startunbounded:1, stop_percentile:4}}, get_summary),
    [4],
    "should find the first_bin.stop_percentile"
  )

  test.deepLooseEqual(
    b.target_percentiles({
      bin_size: 3, 
      first_bin: {start: 4}, 
      first_bin: {stopunbounded:1, start_percentile:80}
    }, get_summary),
    [80],
    "should find the first_bin.stop_percentile"
  )

  test.deepLooseEqual(
    b.target_percentiles({
      bin_size: 3, 
      first_bin: {startunbounded: 1, start_percentile: 10, stop_percentile: 20}, 
      last_bin: {stopunbounded:1, start_percentile:80, stop_percentile: 95}
    }, get_summary),
    [10, 20, 80, 95],
    "should find all configured percentiles"
  )

  test.end()
})


tape("compute_bins() percentile", function (test) {

  test.deepLooseEqual(
    b.compute_bins({bin_size: 3, first_bin: {start_percentile:10}}, get_summary),
    [
      { startunbounded: undefined, start: 2, stop: 5, startinclusive: 1, stopinclusive: 0, label: '2 to 4' },
      { startinclusive: 1, stopinclusive: 0, start: 5, stop: 8, label: '5 to 7' },
      { startinclusive: 1, stopinclusive: 0, start: 8, stop: 11, label: '8 to 10' },
      { startinclusive: 1, stopinclusive: 0, start: 11, stop: 14, label: '11 to 13' },
      { startinclusive: 1, stopinclusive: 0, start: 14, stop: 17, label: '14 to 16' },
      { startinclusive: 1, stopinclusive: 0, start: 17, stop: 20, label: '17 to 20'}
    ],
    "should handle first_bin.start_percentile"
  )

  test.deepLooseEqual(
    b.compute_bins({bin_size: 3, first_bin: {start_percentile:10, stop_percentile: 20}}, get_summary),
    [ 
      { startunbounded: undefined, start: 2, stop: 4, startinclusive: 1, stopinclusive: 0, label: '2 to 3' },
      { startinclusive: 1, stopinclusive: 0, start: 4, stop: 7, label: '4 to 6' },
      { startinclusive: 1, stopinclusive: 0, start: 7, stop: 10, label: '7 to 9' },
      { startinclusive: 1, stopinclusive: 0, start: 10, stop: 13, label: '10 to 12' },
      { startinclusive: 1, stopinclusive: 0, start: 13, stop: 16, label: '13 to 15' },
      { startinclusive: 1, stopinclusive: 0, start: 16, stop: 19, label: '16 to 18' },
      { startinclusive: 1, stopinclusive: 0, start: 19, stop: 20, label: '19 to 20' }
    ],
    "should handle first_bin.start_percentile + stop_percentile"
  )

  test.deepLooseEqual(
    b.compute_bins({bin_size: 4, first_bin: {start:4}, last_bin: {start_percentile:90, stopunbounded: 1}}, get_summary),
    [
      { startunbounded: undefined, start: 4, stop: 8, startinclusive: 1, stopinclusive: 0, label: '4 to 7' },
      { startinclusive: 1, stopinclusive: 0, start: 8, stop: 12, label: '8 to 11' },
      { startinclusive: 1, stopinclusive: 0, start: 12, stop: 16, label: '12 to 15' },
      { startinclusive: 1, stopinclusive: 0, start: 16, stop: 18, label: '16 to 17' },
      { startinclusive: 1, stopinclusive: 0, start: 18, stop: 20, stopunbounded: 1, label: '≥18'} 
    ],
    "should handle last_bin.start_percentile"
  )

  test.deepLooseEqual(
    b.compute_bins({bin_size: 4, first_bin: {start: 5}, last_bin: {start_percentile:80, stop_percentile: 95}}, get_summary),
    [
      { startunbounded: undefined, start: 5, stop: 9, startinclusive: 1, stopinclusive: 0, label: '5 to 8' },
      { startinclusive: 1, stopinclusive: 0, start: 9, stop: 13, label: '9 to 12' },
      { startinclusive: 1, stopinclusive: 0, start: 13, stop: 16, label: '13 to 15' },
      { startinclusive: 1, stopinclusive: 0, start: 16, stop: 19, label: '16 to 19' }
    ],
    "should handle last_bin.start_percentile + stop_percentile"
  )

  test.end()
})

tape.skip("get_term_bins() ", function(test) {
  // to-do
})
