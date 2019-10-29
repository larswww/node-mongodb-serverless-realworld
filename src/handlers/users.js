const db = require('../utils/db')
let cachedDbConnection = null

// when setting up webstorm debug mention that command line is required for auto-reloading the code!
module.exports.get = async (event, context) => {
  let { User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const id = event.enhancedAuthContext.principalId
  let user = await User.findById(id)
  if (!user) return { statusCode: 401 }

  return { user: user.toAuthJSON() }
}

module.exports.put = async (event, context) => {
  let { User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const id = event.enhancedAuthContext.principalId

  let user = await User.findById(id)
  if (!user) return {statusCode : 401}

  const { username, email, bio, image, password } = event.body

  if (username) user.username = username
  if (email) user.email = email
  if (bio) user.bio = bio
  if (image) user.image = image
  if (password) user.setPassword(password)

  await user.save()
  return { user: user.toAuthJSON() }

}

module.exports.postUser = async (event, context) => {
  let { User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const { username, email, password } = event.body.user
  let user = new User()
  user.username = username
  user.email = email
  user.setPassword(password)

  await user.save().catch(e => {
    console.error(e)})

  // show the password not being 8 chars going wrong and how annoying that is
  return { user: user.toAuthJSON() }
}

module.exports.postLogin = async (event, context) => {
  let { User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const { email, password } = event.body.user
  let user = await User.findOne({ email })
  if (!user) return { statusCode: 422 } // should this be a 422?

  if (user.validPassword(password)) {
    user.token = user.generateJWT()

    return { user: user.toAuthJSON() }
  } else {
    return { statusCode: 422 }
  }

}

