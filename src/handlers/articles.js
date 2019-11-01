const db = require('../utils/db')
const reply = require('../utils/responseHelper')
let dbConnection = null
const authorize = require('./authorize')

const findArticleAndOrUserBy = async (userId, slug) => {
  dbConnection = await db.connect()
  let [ user, article ] = await Promise.all([
    (userId) ? dbConnection.model('User').findById(userId) : null,
    (slug) ? dbConnection.model('Article').findOne({ slug }).populate('author') : null
  ])

  return { user, article }
}

const getUserIdIfTokenIsPresent = (authorizationToken, context) => {
  const callback = (error, res) => { return res.principalId } // todo should log or do something with an invalid token?
  return (authorizationToken) ? authorize.handler({ authorizationToken }, context, callback) : null
}

module.exports.bySlug = async (event, context) => {
  const userId = getUserIdIfTokenIsPresent(event.headers.Authorization, context)
  const { user, article } = await findArticleAndOrUserBy(userId, event.pathParameters.slug)
  if (!article) return reply(404)

  return reply(200, { article: article.toJSONFor(user) })
}

// todo auth optional routes?
module.exports.get = async (event, context) => {
  dbConnection = await db.connect()
  const userId = getUserIdIfTokenIsPresent(event.headers.Authorization, context)

  const query = {}
  const { limit, offset, tag } = getEventParams(event)
  if (tag) query.tagList = { '$in': [event.queryStringParameters.tag] }


  let [author, favoriter] = await Promise.all([
    event.queryStringParameters.author ? dbConnection.model('User').findOne({ username: event.queryStringParameters.author }) : null,
    event.queryStringParameters.favorited ?  dbConnection.model('User').findOne({ username: event.queryStringParameters.favorited }) : null
  ])

  if (author) query.author = author._id

  if (favoriter) query._id = { $in: favoriter.favorites }
  else if (query.favorited) query._id = { $in: [] }

  let [articles, articlesCount, user] = await Promise.all([
    dbConnection.model('Article').find(query)
      .limit(Number(limit))
      .skip(Number(offset))
      .sort({ createdAt: 'desc' })
      .populate('author')
      .exec(),
    dbConnection.model('Article').count(query).exec(),
    userId ? dbConnection.model('User').findById(userId) : null,
  ])

  return reply(200, {
    articles: articles.map(article => { return article.toJSONFor(user)}),
    articlesCount: articlesCount
  })

}

module.exports.feed = async (event, context) => {
  dbConnection = await db.connect()
  const { userId, limit, offset } = getEventParams(event)
  let user = await dbConnection.model('User').findById(userId)
  if (!user) return reply(401)

  let [articles, articlesCount] = await Promise.all([
    dbConnection.model('Article').find({ author: { $in: user.following } })
      .limit(Number(limit))
      .skip(Number(offset))
      .populate('author')
      .exec(),
    dbConnection.model('Article').count({ author: { $in: user.following } })
  ])

  return reply(200, {
    articles: articles.map(article => { return article.toJSONFor(user)}),
    articlesCount: articlesCount
  })
}

module.exports.post = async (event, context) => {
  dbConnection = await db.connect()

  let user = await dbConnection.model('User').findById(event.requestContext.authorizer.principalId)
  if (!user) return reply(401)

  event.body = JSON.parse(event.body)
  const Article = dbConnection.model('Article')
  const article = new Article(event.body.article)
  article.author = user
  await article.save()

  return reply(200, { article: article.toJSONFor(user) })
}

// return a article

// update article

module.exports.put = async (event, context) => {

  // middleware
  const { userId, slug } = getEventParams(event)
  const { user, article } = await findArticleAndOrUserBy(userId, slug)
  if (!user || !article) return reply(401)
  if (article.author._id.toString() !== user._id.toString()) return reply(403, { message: 'Author did not match User' })

  event.body = JSON.parse(event.body)
  const { title, description, body, tagList } = event.body.article
  if (title) article.title = title
  if (description) article.description = description
  if (body) article.body = body
  if (tagList) article.tagList = tagList

  await article.save()

  return reply(200, { article: article.toJSONFor(user) })
}

module.exports.favorite = async (event, context) => {
  dbConnection = await db.connect()

  // middleware
  const { userId, slug } = getEventParams(event)
  const { user, article } = await findArticleAndOrUserBy(userId, slug)
  if (!user || !article) return reply(401)

  await user.favorite(article._id)
  await article.updateFavoriteCount(dbConnection.model('User'))
  return reply(200, { article: article.toJSONFor(user) })

}

module.exports.delete = async (event, context) => {
  // middleware
  const { userId, slug } = getEventParams(event)
  const { user, article } = await findArticleAndOrUserBy(userId, slug)
  if (!user || !article) return reply(401)

  if (article.author._id.toString() === user._id.toString()) {
    await article.remove()
    return reply(204)
  }

  return reply(403)
}

// Unfavorite an article
module.exports.unFavorite = async (event, context) => {
  dbConnection = await db.connect()
  const { userId, slug } = getEventParams(event)
  const { user, article } = await findArticleAndOrUserBy(userId, slug)
  if (!user || !article) return reply(401)

  const articleId = article._id

  await user.unfavorite(articleId)
  await article.updateFavoriteCount(dbConnection.model('User'))
  return reply(200, { article: article.toJSONFor(user) })
}

module.exports.getComments = async (event, context) => {
  const userId = getUserIdIfTokenIsPresent(event.headers.Authorization, context)
  const { user, article } = await findArticleAndOrUserBy(userId, event.pathParameters.slug)
  if (!article) return reply(401)

  let commentsPopulatedArticle = await article.populate({
    path: 'comments',
    populate: {
      path: 'author'
    },
    options: {
      sort: {
        createdAt: 'desc'
      }
    }
  }).execPopulate()

  return reply(200, {
    comments: commentsPopulatedArticle.comments.map(function (comment) {
      return comment.toJSONFor(user)
    })
  })
}

module.exports.postComment = async (event, context) => {
  dbConnection = await db.connect()
  const { userId, slug } = getEventParams(event)

  const { user, article } = await findArticleAndOrUserBy(userId, slug)
  if (!user || !article) return reply(401)

  event.body = JSON.parse(event.body)
  const Comment = dbConnection.model('Comment')
  const comment = new Comment(event.body.comment)
  comment.article = article
  comment.author = user
  await comment.save()

  article.comments.push(comment)
  await article.save()

  return reply(200, { comment: comment.toJSONFor(user) })
}

module.exports.deleteComment = async (event, context) => {
  dbConnection = await db.connect()
  const { userId, slug, commentId } = getEventParams(event)

  const { user, article } = await findArticleAndOrUserBy(userId, slug)
  if (!user || !article) return reply(401)

  let comment = await dbConnection.model('Comment').findById(commentId)
  if (!comment) return reply(404)
  if (userId !== comment.author.toString()) return reply(403)

  await article.comments.remove(comment._id)
  await article.save()
  await dbConnection.model('Comment').find({ _id: comment._id }).remove().exec()

  return reply(204)
}

function getEventParams (event) {
  event.pathParameters = event.pathParameters || {}
  event.requestContext.authorizer = event.requestContext.authorizer || {}
  event.queryStringParameters = event.queryStringParameters || {} // would be undefined if no query is included

  let limit = event.queryStringParameters.limit || 20
  let offset = event.queryStringParameters.offset || 0
  let tag = event.queryStringParameters.tag

  const { slug, commentId } = event.pathParameters
  const userId = event.requestContext.authorizer.principalId

  return { limit, offset, tag, slug, commentId, userId }
}

