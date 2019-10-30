const jwt = require('jsonwebtoken')

const buildIAMPolicy = (userId, effect, resource, context) => {
  return {
    principalId: userId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: '*',
        },
      ],
    },
    context,
  }
  /** Alex de Brie on using 'Resource: '*':
   *  "Normally, using wildcards in IAM policies is a bad idea. In this situation, it seems more controlled and, thus, acceptable.
   *  However, I’d love to know if this is a security hole. Please reach out if you know how this could be exploited.
   */
}

// https://www.alexdebrie.com/posts/lambda-custom-authorizers/
// https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html
// https://github.com/yosriady/serverless-auth/blob/master/functions/authorize.js

module.exports.handler = (event, context, callback) => {
  try {
    console.log('recieved event:', event)
    const token = event.authorizationToken.split('Token ')[1]
    console.log('splitted token:', token)
    // Verify JWT
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET)
    console.log(decoded)
    const user = decoded.username

    // Return an IAM policy document for the current endpoint (not using scopes, always just allow if jwt is valid)
    const effect = 'Allow'
    const userId = decoded.id
    const authorizerContext = { user }
    const policyDocument = buildIAMPolicy(userId, effect, event.methodArn, authorizerContext)

    callback(null, policyDocument)
  } catch (e) {
    console.log('auth error', e.message)
    callback('Unauthorized') // Return a 401 Unauthorized response
  }
}
