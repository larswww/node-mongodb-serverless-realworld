const db = require('../utils/db')
const reply = require('../utils/responseHelper')
let cachedDbConnection = null
const authorize = require('./authorize')

const articleSlug = async (event, context) => {
  let { Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const slug = event.path.slug
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return reply(404)

  // here its normally put on req so explain how to know what/how to return the article?
  return reply()
}

module.exports.bySlug = async (event, context) => {
  let { Article, User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  let userId
  const authorizationToken = event.headers.Authorization
  if (authorizationToken) {
    userId = authorize.handler({ authorizationToken }, context, (error, res) => { return res.principalId })
  }

  let user = false
  if (userId) {
    user = await User.findById(userId)
  }

  const slug = event.pathParameters.slug
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return reply(404)

  // here its normally put on req so explain how to know what/how to return the article?
  return reply(200, { article: article.toJSONFor(user) })
}

// todo auth optional routes?
module.exports.get = async (event, context) => {
  let { User, Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection
  /**
   * "Auth optional hack"
   * https://www.alexdebrie.com/posts/lambda-custom-authorizers/
   * Lambda custom authorize functions doesnt support the optional concept.
   * So calling the auth function manually just to get the id.
   */
  let userId
  const authorizationToken = event.headers.Authorization
  if (authorizationToken) {
    userId = authorize.handler({ authorizationToken }, context, (error, res) => { return res.principalId })
  }

  const query = {}
  event.queryStringParameters = event.queryStringParameters || {} // would be undefined if no query is included
  let limit = event.queryStringParameters.limit || 20
  let offset = event.queryStringParameters.offset || 0
  if (event.queryStringParameters.tag) query.tagList = { '$in': [event.queryStringParameters.tag] }

  let [author, favoriter] = await Promise.all([
    query.author ? User.findOne({ username: query.author }) : null,
    query.favorited ? User.findOne({ username: query.favorited }) : null
  ])

  if (author) {
    query.author = author._id
  }

  if (favoriter) {
    query._id = { $in: favoriter.favorites }
  } else if (query.favorited) {
    query._id = { $in: [] }
  }

  let [articles, articlesCount, user] = await Promise.all([
    Article.find(query)
      .limit(Number(limit))
      .skip(Number(offset))
      .sort({ createdAt: 'desc' })
      .populate('author')
      .exec(),
    Article.count(query).exec(),
    userId ? User.findById(userId) : null,
  ])

  return reply(200, {
    articles: articles.map(article => { return article.toJSONFor(user)}),
    articlesCount: articlesCount
  })

}

module.exports.feed = async (event, context) => {
  let { User, Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection
  event.queryStringParameters = event.queryStringParameters || {}
  const limit = event.queryStringParameters.limit || 20
  const offset = event.queryStringParameters.offset || 0

  let user = await User.findById(event.requestContext.authorizer.principalId)
  if (!user) return reply(401)

  let [articles, articlesCount] = await Promise.all([
    Article.find({ author: { $in: user.following } })
      .limit(Number(limit))
      .skip(Number(offset))
      .populate('author')
      .exec(),
    Article.count({ author: { $in: user.following } })
  ])

  return reply(200, {
    articles: articles.map(article => { return article.toJSONFor(user)}),
    articlesCount: articlesCount
  })
}

module.exports.post = async (event, context) => {
  let { Article, User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  let user = await User.findById(event.requestContext.authorizer.principalId)
  if (!user) return reply(401)

  event.body = JSON.parse(event.body)
  const article = new Article(event.body.article)
  article.author = user
  await article.save()

  return reply(200, { article: article.toJSONFor(user) })
}

// return a article

// update article

module.exports.put = async (event, context) => {
  let { User, Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const slug = event.pathParameters.slug
  let user = await User.findById(event.requestContext.authorizer.principalId)
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return reply(404)
  if (article.author._id.toString() !== user._id.toString()) return reply(403, {message: 'Author did not match User'})

  event.body = JSON.parse(event.body)
  const { title, description, body, tagList } = event.body.article
  if (title) article.title = title
  if (description) article.description = description
  if (body) article.body = body
  if (tagList) article.tagList = tagList

  await article.save()

  console.log(article.toJSONFor(user))
  return reply(200, { article: article.toJSONFor(user) })
}

module.exports.favorite = async (event, context) => {
  let { Article, User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const slug = event.pathParameters.slug
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return reply(401)
  const articleId = article._id

  const userId = event.requestContext.authorizer.principalId
  let user = await User.findById(userId)
  if (!user) return reply(401)

  // updating mongoose install
  // updating mongoose uniqueValidator

  await user.favorite(articleId)
  await article.updateFavoriteCount(cachedDbConnection.model('User'))
  return reply(200, { article: article.toJSONFor(user) })

}

module.exports.delete = async (event, context) => {
  let { Article, User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  let user = await User.findById(event.requestContext.authorizer.principalId)
  if (!user) return reply(401)
  const slug = event.pathParameters.slug
  let articleToDelete = await Article.findOne({ slug }).populate('author')
  if (!articleToDelete) return reply(401)

  if (articleToDelete.author._id.toString() === user._id.toString()) {
    await articleToDelete.remove()
    return reply(204)

  }

  return reply(403)

}

// Unfavorite an article
module.exports.unFavorite = async (event, context) => {
  let { Article, User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const userId = event.requestContext.authorizer.principalId
  let user = await User.findById(userId)
  if (!user) return reply(401)
  const slug = event.pathParameters.slug
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return reply(401)
  const articleId = article._id

  await user.unfavorite(articleId)
  await article.updateFavoriteCount(cachedDbConnection.model('User'))
  return reply(200, { article: article.toJSONFor(user) })
}

module.exports.getComments = async (event, context) => {
  let { User, Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  let userId
  const authorizationToken = event.headers.Authorization
  if (authorizationToken) {
    userId = authorize.handler({ authorizationToken }, context, (error, res) => { return res.principalId })
  }
  const slug = event.pathParameters.slug
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return reply(401)

  let user = await Promise.resolve(userId ? User.findById(userId) : null)
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
  let { User, Article, Comment, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const slug = event.pathParameters.slug
  const userId = event.requestContext.authorizer.principalId
  let user = await User.findById(userId)
  if (!user) return reply(401, {message: 'User not found'})
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return reply(401, {message: 'Article not found'})

  event.body = JSON.parse(event.body)
  const comment = new Comment(event.body.comment)
  comment.article = article
  comment.author = user
  await comment.save()
  article.comments.push(comment)
  await article.save()

  return reply(200, { comment: comment.toJSONFor(user) })
}

module.exports.deleteComment = async (event, context) => {
  let { User, Article, Comment, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const slug = event.pathParameters.slug
  const userId = event.requestContext.authorizer.principalId
  let user = await User.findById(userId)
  if (!user) return reply(401)
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return reply(401)

  let comment = await Comment.findById(event.pathParameters.commentId)
  if (!comment) return reply(404)
  if (userId !== comment.author.toString()) return reply(403)

  await article.comments.remove(comment._id)
  await article.save()
  await Comment.find({ _id: comment._id }).remove().exec()

  return reply(204)
}

