// request.js
const http = require('http')
const baseURL = global.baseURL
const callback = response => {
  let data = ''
  response.on('data', _data => (data += _data))
  response.on('end', () => resolve(data))
}


module.exports.get = function (endpoint) {
  return new Promise(resolve => {
    // This is an example of an http request, for example to fetch
    // user data from an API.
    // This module is being mocked in __mocks__/request.js
    http.get({ path: `${baseURL}${endpoint}` }, callback )
})
  }

module.exports.post = function () {

}
