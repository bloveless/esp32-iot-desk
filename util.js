const querystring = require("querystring");

module.exports.getQueryStringForLogin = (req) => querystring.stringify({
    client_id: req.query.client_id || req.body.client_id,
    redirect_uri: req.query.redirect_uri || req.body.redirect_uri,
    state: req.query.state || req.body.state,
    // scope: req.query.scope || req.body.scope,
    response_type: req.query.response_type || req.body.response_type,
    user_locale: req.query.user_locale || req.body.user_locale,
});

module.exports.getVariablesForAuthorization = (req) => ({
    clientId: req.query.client_id || req.body.client_id,
    redirectUri: req.query.redirect_uri || req.body.redirect_uri,
    state: req.query.state || req.body.state,
    // scope: req.query.scope || req.body.scope,
    responseType: req.query.response_type || req.body.response_type,
    userLocale: req.query.user_locale || req.body.user_locale,
});

module.exports.getTokenFromHeader = (authHeader) => {
    return authHeader.substring(7);
};