
/** https://github.com/serverless/serverless/issues/3896
 * https://serverless-stack.com/chapters/handle-api-gateway-cors-errors.html
 * Can this be done in serverless.yml??
 * https://aws.amazon.com/premiumsupport/knowledge-center/api-gateway-cloudfront-distribution/
 *
 * Small helper to make each handler less verbose
 *
 * for serverless CORS Access-Control must be set on all, setting cors: true in serverless.yml only affects
 * OPTIONS pre-flight
 */
module.exports = (statusCode, body, additionalHeaders) => {
  let res = {
    statusCode: statusCode || 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true
    },
  }

  if (additionalHeaders) {
    res.headers  = {
      ...res.headers, // always keep the CORS headers
      ...additionalHeaders
    }
  }

  // some of the mongoose methods returns JSON as is
  if (body) res.body = (typeof  body === 'string') ? body : JSON.stringify(body)

  return res
}
