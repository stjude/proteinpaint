const request = require("request")
const tape = require("tape")
const examples = require("./examples")

tape("\n", function(test) {
  test.pass("-***- /termsql specs -***-")
  test.end()
})

tape("conditions", function (test) {
  test.plan(examples.data.conditions.length)
  for(const example of examples.data.conditions) {
    request(examples.getURL(example),(error,response,body)=>{
      if(error) {
        test.fail(error)
      }
      switch(response.statusCode) {
      case 200:
        const data = JSON.parse(body)
        delete data.dbtime
        delete example.expected.dbtime
        test.deepEqual(data, example.expected, example.title)
        break;
      default:
        test.fail("invalid status")
      }
    })
  }
})

tape("one term, no overlay", function (test) {
  test.plan(examples.data.oneTerm.length)
  for(const example of examples.data.oneTerm) {
    request(examples.getURL(example),(error,response,body)=>{
      if(error) {
        test.fail(error)
      }
      switch(response.statusCode) {
      case 200:
        const data = JSON.parse(body)
        delete data.dbtime
        delete example.expected.dbtime
        test.deepEqual(data, example.expected, example.title)
        break;
      default:
        test.fail("invalid status")
      }
    })
  }
})

