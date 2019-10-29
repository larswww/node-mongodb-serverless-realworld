const db = require('../utils/db')
let cachedDb = {}

// https://epsagon.com/blog/enforce-consistent-error-handling-in-aws-lambda-with-wrappers/ middy error handler?
// https://aws.amazon.com/getting-started/tutorials/handle-serverless-application-errors-step-functions-lambda/

const getProfileByUsername = async (username) => {
  cachedDb = await db.connect(cachedDb.connection)
  let user = await cachedDb.connection.model('User').findOne({ username })
  if (!user) return { httpStatus: 404, errorMessage: 'No such user' }
  return user
}

module.exports.get = async (event, context) => {
  cachedDb = await db.connect(cachedDb.connection)

  let requestedProfile = await getProfileByUsername(event.path.profile)
  if (requestedProfile.errorMessage) return requestedProfile

  if (event.enhancedAuthContext.principalId) {
    let user = await cachedDb.connection.model('User').findById(event.enhancedAuthContext.principalId)
    return { profile: requestedProfile.toProfileJSONFor(user) }
  }

  return { profile: user.toProfileJSONFor(false) }
}

module.exports.postFollow = async (event, context) => {
  cachedDb = await db.connect(cachedDb.connection)

  let requestedProfile = await getProfileByUsername(event.path.profile)
  if (requestedProfile.errorMessage) return requestedProfile

  let loggedInUser = await cachedDb.connection.model('User').findById(event.enhancedAuthContext.principalId)
  if (!loggedInUser) return { statusCode: 401 }

  await loggedInUser.follow(requestedProfile._id)
  return { profile: requestedProfile.toProfileJSONFor(loggedInUser) }
}

module.exports.deleteFollow = async (event, context) => {
  cachedDb = await db.connect(cachedDb.connection)
  // todo what is the real error handling strategy to use here?
  let requestedProfile = await getProfileByUsername(event.path.profile)
  if (requestedProfile.errorMessage) return requestedProfile

  let loggedInProfile = await cachedDb.connection.model('User').findById(event.enhancedAuthContext.principalId)
  if (!loggedInProfile) return { statusCode: 401 }

  await loggedInProfile.unfollow(requestedProfile)

  return { profile: requestedProfile.toProfileJSONFor(loggedInProfile) }
}
