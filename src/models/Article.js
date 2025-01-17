const mongoose = require('mongoose')
const uniqueValidator = require('mongoose-unique-validator')
const slug = require('slug')
// const User = mongoose.model('User') circular reference and how this wouldn't play?

var ArticleSchema = new mongoose.Schema({
  slug: { type: String, lowercase: true, unique: true },
  title: String,
  description: String,
  body: String,
  favoritesCount: { type: Number, default: 0 },
  comments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Comment' }],
  tagList: [{ type: String }],
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true })

ArticleSchema.plugin(uniqueValidator, { message: 'is already taken' })

ArticleSchema.pre('validate', function (next) {
  if (!this.slug) {
    this.slugify()
  }
  next()
})

ArticleSchema.methods.slugify = function () {
  this.slug = slug(this.title) + '-' + (Math.random() * Math.pow(36, 6) | 0).toString(36)
}

ArticleSchema.methods.updateFavoriteCount = async function (userModel) {
  var article = this
  // explain count being na, model injection and the exec thing
  let favoriteCount = await userModel.countDocuments({ favorites: { $in: [article._id] } }).exec()
  article.favoritesCount = favoriteCount
  await article.save()
}

ArticleSchema.methods.toJSONFor = function (user) {
  return {
    slug: this.slug,
    title: this.title,
    description: this.description,
    body: this.body,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    tagList: this.tagList,
    favorited: user ? user.isFavorite(this._id) : false,
    favoritesCount: this.favoritesCount,
    author: this.author.toProfileJSONFor(user)
  }
}

try {
  mongoose.model('Article', ArticleSchema)
} catch (e) {
}

