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

// http://localhost:3000/oauth/authorize?response_type=code&client_id=eb47ecec86884e029ac626bd5de45d92&redirect_uri=https://oauth-redirect.googleusercontent.com/r/esp32-iot-desk-b8329&state=ABdO3MUUq0VpbQzyH7c957nhSkOG_dwUUNFhlpX6yS4Z4ef_yxn3EtlYs2F5es-PLUnaW-IwjYbG6lG8UiRhQZKPNr6ggVqwW_ETWkI_-oonK2GgnEXX6C2_p9D1wZ1JbXY3qHnCE8B75z_0HzfX9SbBB1rsht3u-WfIK_yhEYXEYDBA13_kcg7vqmy0bUjC-HdDG0aIu1h73cH9wSARiT5YUn2gutfz1yBR0PdLzTIw5k4RxZv4EvJ4syI_jaGEnHW1d-HKPHn1tYNf_NbjIPA_Vg0eKRng36qLqcgcQnz1wrjfCntTdS4zZiV7qvtIBP1vtFWeur3RBImWxUMMEEVqwDAvlUmTshx4g-jp4HC_8WW12YV8uvxSEcImP_Zk47MkYeeRnUpDeFmEQCCsrwSpg2I3ptuORc49HZd2hp5uNebJ8UQRYZsKLf7wS-kh3w61_vj-jRjfy-u4UChx8J2Rvzc_Vr0TEkTPcgZ9iwgp8fdSLw2DUEhy-GkpRor-7f4QZaV7r62COvC7kcRulCIdvFqkWNVIoQDZrI1BbNNXtiZ7T6QjctPssfltaTGklAo8eDpZiWDAPIG7IAtsHXYIj6MnPlTuC3LupGkyWYhC6EFIqekdkWpoN3i4i5mFD4Jje3OpWX6bnJC9HMddbJ4K0wU_5lUtFA&user_locale=en

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


app.get("/", (req, res) => {
    return res.render("index", { loggedIn: !!req.session.user, userEmail: req.session.user?.email });
});

app.get("/log-in", (req, res) => {
    if (req.session.user) {
        return res.redirect(`/oauth/authorize?${getQueryStringForLogin(req)}`);
    }

    res.render("log-in", getVariablesForAuthorization(req));
});

app.post("/log-in", async (req, res) => {
    if (req.session.user) {
        // TODO: This should redirect to the authorization endpoint
        return res.redirect("/");
    }

    if (!req.body?.email) {
        return res.render("log-in", {
            flash: {
                error: "Email address is required"
            },
            ...getVariablesForAuthorization(req),
        });
    }

    if (!req.body?.password) {
        return res.render("log-in", {
            flash: {
                error: "Password is required"
            },
            ...getVariablesForAuthorization(req),
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

app.listen(port, () => {
    console.log(`Example app listening at port ${port}`);
});
