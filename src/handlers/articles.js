const db = require('../utils/db')
let cachedDbConnection = null
const authorize = require('./authorize')

const articleSlug = async (event, context) => {
  let { Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const slug = event.path.slug
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return { statusCode: 404 }

  // here its normally put on req so explain how to know what/how to return the article?
  return { article }
}

module.exports.bySlug = async (event, context) => {
  let { Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const slug = event.path.slug
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return { statusCode: 404 }

  // here its normally put on req so explain how to know what/how to return the article?
  return { article }
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
  let limit = event.query.limit || 20
  let offset = event.query.offset || 0
  if (event.query.tag) query.tagList = { '$in': [event.query.tag] }

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

  return {
    articles: articles.map(function (article) {
      return article.toJSONFor(user)
    }),
    articlesCount: articlesCount
  }

}

module.exports.feed = async (event, context) => {
  let { User, Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection
  const limit = event.query.limit || 20
  const offset = event.query.offset || 0

  let user = await User.findById(event.enhancedAuthContext.principalId)
  if (!user) return { statusCode: 401 }

  let [articles, articlesCount] = await Promise.all([
    Article.find({ author: { $in: user.following } })
      .limit(Number(limit))
      .skip(Number(offset))
      .populate('author')
      .exec(),
    Article.count({ author: { $in: user.following } })
  ])

  return {
    articles: articles.map(function (article) {
      return article.toJSONFor(user)
    }),
    articlesCount: articlesCount
  }
}

module.exports.post = async (event, context) => {
  let { Article, User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  let user = await User.findById(event.enhancedAuthContext.principalId)
  if (!user) return { statusCode: 401 }

  const article = new Article(event.body.article)
  article.author = user
  await article.save()

  return { article: article.toJSONFor(user) }
}

// return a article

//todo whats the difference between this and getting based on slug?
// module.exports.getArticle = async (event, context) => {
//   Promise.all([
//     req.payload ? User.findById(req.payload.id) : null,
//     req.article.populate('author').execPopulate()
//   ]).then(function(results){
//     var user = results[0];
//
//     return res.json({article: req.article.toJSONFor(user)});
//   }).catch();
// }

// update article

module.exports.put = async (event, context) => {
  let { User, Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const slug = event.path.slug
  let user = await User.findById(event.enhancedAuthContext.principalId)
  let article = await Article.findOne({ slug }).populate('author')
  if (!article) return { statusCode: 404 }
  if (article.author._id.toString() !== user._id.toString()) return { statusCode: 403 }

  const { title, description, body, tagList } = event.body.article
  if (title) article.title = title
  if (description) article.description = description
  if (body) article.body = body
  if (tagList) article.tagList = tagList

  await article.save()

  console.log(article.toJSONFor(user))
  return { article: article.toJSONFor(user) }
}

module.exports.favorite = async (event, context) => {
  let { Article, User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  let article = await Article.findOne({ slug: event.path.slug }).populate('author')
  if (!article) return { statusCode: 401 }
  const articleId = article._id

  const userId = event.enhancedAuthContext.principalId
  let user = await User.findById(userId)
  if (!user) return { statusCode: 401 }

  // updating mongoose install
  // updating mongoose uniqueValidator

  await user.favorite(articleId)
  await article.updateFavoriteCount(cachedDbConnection.model('User'))
  return { article: article.toJSONFor(user) }

}

module.exports.delete = async (event, context) => {
  let { Article, User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  let user = await User.findById(event.enhancedAuthContext.principalId)
  if (!user) return { statusCode: 401 }
  let articleToDelete = await Article.findOne({ slug: event.path.slug }).populate('author')
  if (!articleToDelete) return { statusCode: 401 }

  if (articleToDelete.author._id.toString() === user._id.toString()) {
    await articleToDelete.remove()
    return {statusCode: 204 }

  }

  return {statusCode: 403 }

}

// Unfavorite an article
module.exports.unFavorite = async (event, context) => {
  let { Article, User, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const userId = event.enhancedAuthContext.principalId
  let user = await User.findById(userId)
  if (!user) return { statusCode: 401 }
  let article = await Article.findOne({ slug: event.path.slug }).populate('author')
  if (!article) return { statusCode: 401 }
  const articleId = article._id

  await user.unfavorite(articleId)
  await article.updateFavoriteCount(cachedDbConnection.model('User'))
  return { article: article.toJSONFor(user) }
}

module.exports.getComments = async (event, context) => {
  let { User, Article, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  let userId
  const authorizationToken = event.headers.Authorization
  if (authorizationToken) {
    userId = authorize.handler({ authorizationToken }, context, (error, res) => { return res.principalId })
  }
  let article = await Article.findOne({ slug: event.path.slug }).populate('author')
  if (!article) return { statusCode: 401 }

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

  return {
    comments: commentsPopulatedArticle.comments.map(function (comment) {
      return comment.toJSONFor(user)
    })
  }
}

module.exports.postComment = async (event, context) => {
  let { User, Article, Comment, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const userId = event.enhancedAuthContext.principalId
  let user = await User.findById(userId)
  if (!user) return { statusCode: 401 }
  let article = await Article.findOne({ slug: event.path.slug }).populate('author')
  if (!article) return { statusCode: 401 }

  const comment = new Comment(event.body.comment)
  comment.article = article
  comment.author = user
  await comment.save()
  article.comments.push(comment)
  await article.save()

  return { comment: comment.toJSONFor(user) }
}

module.exports.deleteComment = async (event, context) => {
  let { User, Article, Comment, connection } = await db.connect(cachedDbConnection)
  cachedDbConnection = connection

  const userId = event.enhancedAuthContext.principalId
  let user = await User.findById(userId)
  if (!user) return { statusCode: 401 }
  let article = await Article.findOne({ slug: event.path.slug }).populate('author')
  if (!article) return { statusCode: 401 }

  let comment = await Comment.findById(event.path.commentId)
  if (!comment) return { statusCode: 404 }
  if (userId !== comment.author.toString()) return { statusCode: 403 }

  await article.comments.remove(comment._id)
  await article.save()
  await Comment.find({ _id: comment._id }).remove().exec()

  return { statusCode: 204 }
}

