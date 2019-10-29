const db = require('../utils/db')
let cachedDbConnection = null

// return a list of tags
module.exports.get = async (event, context) => {
  let { Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  let tags = await Article.find().distinct('tagList')
  return { tags }
}
