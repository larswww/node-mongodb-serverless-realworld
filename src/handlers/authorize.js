const jwt = require('jsonwebtoken')

// https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html
// https://github.com/yosriady/serverless-auth/blob/master/functions/authorize.js

const buildIAMPolicy = (userId, effect, resource, context) => {
  return {
    principalId: userId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context,
  }
}

module.exports.handler = (event, context, callback) => {
  const token = event.authorizationToken.split('Token ')[1]

  try {
    console.log(token)
    // Verify JWT
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET)

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
