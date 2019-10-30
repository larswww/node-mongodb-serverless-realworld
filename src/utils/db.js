const mongoose = require('mongoose')
const uri = process.env.MONGODB_URI

mongoose.set('debug', true)
// show the connections adding up in the mongod terminal thing

// https://github.com/serverless/examples/tree/master/aws-node-mongodb-atlas
// https://mongoosejs.com/docs/lambda.html
module.exports.connect = async function (connection) {
  // See https://www.mongodb.com/blog/post/serverless-development-with-nodejs-aws-lambda-mongodb-atlas

  // Because `conn` is in the global scope, Lambda may retain it between
  // function calls thanks to `callbackWaitsForEmptyEventLoop`.
  // This means your Lambda function doesn't have to go through the
  // potentially expensive process of connecting to MongoDB every time.
  // https://mongoosejs.com/docs/lambda.html
  if (connection == null) {
    console.log('connecting to database')
    //todo handle not being able to connect to db
    connection = await mongoose.createConnection(uri, {
      // Buffering means mongoose will queue up operations if it gets
      // disconnected from MongoDB and send them when it reconnects.
      // With serverless, better to fail fast if not connected.
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0 // and MongoDB driver buffering
    })
    require('../models/User')
    require('../models/Article')
    require('../models/Comment')
  } else {
    console.log('using cached connection')
  }

  const Article = connection.model('Article')
  const Comment = connection.model('Comment')
  const User = connection.model('User')

  return { Article, Comment, User, connection }
}
