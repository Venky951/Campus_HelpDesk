require("dotenv").config();
const { validateRequiredEnvironment } = require("./utils/required-config");

//core Module
const path = require("path");

//External Module
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const { csrfSync } = require("csrf-sync");

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body?._csrf,
});

//Local Module
const helpdeskPath = require("./utils/path");
const loginRoute = require("./routes/login");
const registerRoute = require("./routes/register");
const indexRoute = require("./routes/index");
const studentRoute = require("./routes/student");
const adminRoute = require("./routes/admin");
const isAuth = require("./middleware/is-auth");
const pagenotfound = require("./controllers/error");
const attachmentUpload = require("./middleware/attachment-upload");

const { default: mongoose } = require("mongoose");

const createSessionStore = (uri) => {
  const store = new MongoDBStore({
    uri,
    collection: "sessions",
  });

  store.on("error", (error) => {
    console.error("Session store error:", error.name, error.message);
  });

  return store;
};

const createApp = ({
  sessionStore = createSessionStore(process.env.MONGO_URI),
  sessionSecret = process.env.SESSION_SECRET,
  nodeEnvironment = process.env.NODE_ENV,
} = {}) => {
  const app = express();

  app.set("view engine", "ejs");
  app.set("views", path.join(helpdeskPath, "views"));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", "https://upload.wikimedia.org"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: false,
      strictTransportSecurity:
        nodeEnvironment === "production" ? undefined : false,
    }),
  );

  app.use(express.urlencoded({ extended: false, limit: "10kb" }));
  if (nodeEnvironment === "production") {
    app.set("trust proxy", 1);
  }

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: nodeEnvironment === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24,
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.method === "POST" && req.path === "/student/raiseticket") {
      return attachmentUpload(req, res, next);
    }
    next();
  });
  app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req);
    next();
  });
  app.use(csrfSynchronisedProtection);
  app.use((req, res, next) => {
    req.isLoggedIn = req.session ? req.session.isLoggedIn : false;
    next();
  });

  app.use(express.static(path.join(helpdeskPath, "public")));

  app.use(loginRoute);
  app.use(registerRoute);
  app.use(indexRoute);
  app.post("/logout", isAuth, (req, res, next) => {
    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
  });
  app.use("/student", studentRoute);
  app.use(adminRoute);
  app.use(pagenotfound.pageNotFound);
  app.use(pagenotfound.errorHandler);

  return app;
};

const start = async () => {
  try {
    validateRequiredEnvironment();
    const store = createSessionStore(process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
    const app = createApp({ sessionStore: store });
    const server = app.listen(process.env.PORT || 3000, () => {
      console.log(`Server is running on http://localhost:${process.env.PORT || 3000}`);
    });
    return { app, server, store };
  } catch (error) {
    console.error(
      error.name === "MongooseServerSelectionError"
        ? "MongoDB connection failed"
        : `Startup failed: ${error.message}`,
    );
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = { createApp, createSessionStore, start };
