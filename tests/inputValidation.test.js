const Axios = require('axios')
const axios = Axios.create({
  baseURL: 'https://gqch1fr4jf.execute-api.us-east-1.amazonaws.com/dev/'
})

describe('Input Validation using JSON schemas', () => {

  describe('users/login', () => {

    test('without User returns 400', async () => {
      let res = await axios.post('users/login', {}).catch(e => { return e.response })
      expect(res.status).toBe(400)
    })

    test('without username/password returns 400', async () => {
      let res = await axios.post('users/login', {user: {}}).catch(e => { return e.response })
      expect(res.status).toBe(400)
    })

    test('empty password returns 400', async () => {
      let res = await axios.post('users/login', {user: {username: 'test', password: ''}}).catch(e => { return e.response })
      expect(res.status).toBe(400)
    })

  })
})

