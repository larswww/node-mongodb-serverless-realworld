const db = require('../utils/db')
const reply = require('../utils/responseHelper')
let cachedDbConnection = null

// when setting up webstorm debug mention that command line is required for auto-reloading the code!
module.exports.get = async (event, context) => {
  let { User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const id = event.requestContext.authorizer.principalId
  let user = await User.findById(id)
  if (!user) return reply(401)

  return reply(200, { user: user.toAuthJSON() })
}

module.exports.put = async (event, context) => {
  let { User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const id = event.requestContext.authorizer.principalId

  let user = await User.findById(id)
  if (!user) return reply(401)

  event.body = JSON.parse(event.body)
  const { username, email, bio, image, password } = event.body

  if (username) user.username = username
  if (email) user.email = email
  if (bio) user.bio = bio
  if (image) user.image = image
  if (password) user.setPassword(password)

  await user.save()
  return reply(200, { user: user.toAuthJSON() })
}

module.exports.postUser = async (event, context) => {
  let { User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  event.body = JSON.parse(event.body)
  const { username, email, password } = event.body.user
  let user = new User()
  user.username = username
  user.email = email
  user.setPassword(password)

  await user.save().catch(e => {
    console.error(e)})

  // show the password not being 8 chars going wrong and how annoying that is
  return reply(200, { user: user.toAuthJSON() })
}

module.exports.postLogin = async (event, context) => {
  let { User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  event.body = JSON.parse(event.body)
  const { email, password } = event.body.user
  let user = await User.findOne({ email })
  if (!user) return reply(422) // should this be a 422?

  if (user.validPassword(password)) {
    user.token = user.generateJWT()

    return reply(200, { user: user.toAuthJSON() })
  } else {
    return reply(422)
  }
}

