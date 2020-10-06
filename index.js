const express = require("express");
const OAuth2Server = require("express-oauth-server");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const flash = require("express-flash-2");
const session = require("express-session");
const morgan = require("morgan");

const { google_actions_app } = require("./google_actions");
const model = require("./model");
const { getVariablesForAuthorization, getQueryStringForLogin } = require("./util");
const port = process.env.PORT || 3000;

// Create an Express application.
const app = express();
app.set("view engine", "pug");
app.use(morgan("dev"));

// Add OAuth server.
app.oauth = new OAuth2Server({
    model,
    debug: true,
});

// Add body parser.
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

// initialize cookie-parser to allow us access the cookies stored in the browser.
app.use(cookieParser(process.env.APP_KEY));

// initialize express-session to allow us track the logged-in user across sessions.
app.use(session({
    key: "user_sid",
    secret: process.env.APP_KEY,
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 600000
    }
}));

app.use(flash());

// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {
    if (req.cookies.user_sid && !req.session.user) {
        res.clearCookie("user_sid");
    }

    next();
});


// Post token.
app.post("/oauth/token", app.oauth.token());

// Get authorization.
app.get("/oauth/authorize", (req, res, next) => {
    // Redirect anonymous users to login page.
    if (!req.session.user) {
        return res.redirect(`/log-in?${getQueryStringForLogin(req)}`);
    }

    next();
}, app.oauth.authorize({
    authenticateHandler: {
        handle: req => {
            return req.session.user
        }
    }
}));

// Post authorization.
app.post("/oauth/authorize", function (req, res) {
    // Redirect anonymous users to login page.
    if (!req.session.user) {
        return res.redirect(`/log-in?${getQueryStringForLogin(req)}`);
    }

    return app.oauth.authorize();
});

app.get("/log-in", (req, res) => {
    if (req.session.user) {
        return res.redirect(`/oauth/authorize?${getQueryStringForLogin(req)}`);
    }

    res.render("log-in", {
        ...getVariablesForAuthorization(req),
        ...{ signUpQueryString: getQueryStringForLogin(req) },
    });
});

app.post("/log-in", async (req, res) => {
    if (req.session.user) {
        return res.redirect(`/oauth/authorize?${getQueryStringForLogin(req)}`);
    }

    if (!req.body?.email) {
        return res.render("log-in", {
            flash: {
                error: "Email address is required"
            },
            ...getVariablesForAuthorization(req),
            ...{ signUpQueryString: getQueryStringForLogin(req) },
        });
    }

    if (!req.body?.password) {
        return res.render("log-in", {
            flash: {
                error: "Password is required"
            },
            ...getVariablesForAuthorization(req),
            ...{ signUpQueryString: getQueryStringForLogin(req) },
        });
    }

    const user = await model.getUser(req.body.email, req.body.password);

    if (user) {
        req.session.user = user;
        return res.redirect(
            `/oauth/authorize?${getQueryStringForLogin(req)}`
        );
    } else {
        res.flash("error", "Unable to find user with that email and password");
        return res.redirect(`/log-in?${getQueryStringForLogin(req)}`);
    }
});

app.get("/log-out", (req, res) => {
    // route for user logout
    if (req.session.user && req.cookies.user_sid) {
        res.clearCookie("user_sid");
    }

    res.flash("success", "Successfully logged out");
    res.redirect("/log-in");
});

app.get("/sign-up", async (req, res) => {
    res.render("sign-up", getVariablesForAuthorization(req));
});

app.post("/sign-up", async (req, res) => {
    if (!req.body?.email) {
        return res.render("sign-up", { flash: { error: "Email address is required" } });
    }

    if (!req.body?.password || !req.body?.passwordConfirmation) {
        return res.render("sign-up", { flash: { error: "Password and Password Confirmation are required" } });
    }

    if (req.body.password != req.body.passwordConfirmation) {
        return res.render("sign-up", { flash: { error: "Password and Password Confirmation must matched" } });
    }

    req.session.user = await model.createUser(req.body.email, req.body.password);

    res.redirect(`/oauth/authorize?${getQueryStringForLogin(req)}`);
});

app.post("/gaction/fulfillment", app.oauth.authenticate(), google_actions_app);

app.get('/healthz', ((req, res) => {
    res.json({
        success: "true",
    });
}));

app.listen(port, () => {
    console.log(`Example app listening at port ${port}`);
});
