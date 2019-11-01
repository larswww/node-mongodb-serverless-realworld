const db = require('../utils/db')
const reply = require('../utils/responseHelper')
let dbConnection = null

// return a list of tags
module.exports.get = async () => {
  dbConnection = await db.connect(dbConnection)
  let tags = await dbConnection.model('Article').find().distinct('tagList')
  return reply(200, { tags })
}
