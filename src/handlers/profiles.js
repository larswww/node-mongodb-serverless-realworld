const db = require('../utils/db')
const reply = require('../utils/responseHelper')
let cachedDb = {}

// https://epsagon.com/blog/enforce-consistent-error-handling-in-aws-lambda-with-wrappers/ middy error handler?
// https://aws.amazon.com/getting-started/tutorials/handle-serverless-application-errors-step-functions-lambda/

const getProfileByUsername = async (username) => {
  cachedDb = await db.connect(cachedDb.connection)
  return await cachedDb.connection.model('User').findOne({ username })
}

module.exports.get = async (event, context) => {
  cachedDb = await db.connect(cachedDb.connection)

  let requestedProfile = await getProfileByUsername(event.pathParameters.profile)
  if (!requestedProfile) return reply(404)

  if (event.requestContext.authorizer.principalId) {
    let user = await cachedDb.connection.model('User').findById(event.requestContext.authorizer.principalId)
    return reply(200, { profile: requestedProfile.toProfileJSONFor(user) })
  }

  return reply(200, { profile: requestedProfile.toProfileJSONFor(user) })
}

module.exports.postFollow = async (event, context) => {
  cachedDb = await db.connect(cachedDb.connection)

  let requestedProfile = await getProfileByUsername(event.pathParameters.profile)
  if (!requestedProfile) return reply(404)

  let loggedInUser = await cachedDb.connection.model('User').findById(event.requestContext.authorizer.principalId)
  if (!loggedInUser) return reply(401)

  await loggedInUser.follow(requestedProfile._id)
  return reply(200, { profile: requestedProfile.toProfileJSONFor(loggedInUser) })
}

module.exports.deleteFollow = async (event, context) => {
  cachedDb = await db.connect(cachedDb.connection)
  // todo what is the real error handling strategy to use here?
  let requestedProfile = await getProfileByUsername(event.pathParameters.profile)
  if (!requestedProfile) return reply(404)

  let loggedInProfile = await cachedDb.connection.model('User').findById(event.requestContext.authorizer.principalId)
  if (!loggedInProfile) return reply(401)

  await loggedInProfile.unfollow(requestedProfile)

  return reply(200, { profile: requestedProfile.toProfileJSONFor(loggedInProfile) })
}
