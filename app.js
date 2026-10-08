require("dotenv").config();

//core Module
const path = require("path");

//External Module
const express = require("express");
const app = express();
const helmet = require("helmet");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const { csrfSync } = require("csrf-sync");

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  getTokenFromRequest: (req) => req.body?._csrf,
});

const store = new MongoDBStore({
  uri: process.env.MONGO_URI,
  collection: "sessions",
});

store.on("error", (error) => {
  console.error("Session store error:", error.name, error.message);
});

app.set("view engine", "ejs");
app.set("views", "views");
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
      process.env.NODE_ENV === "production" ? undefined : false,
  }),
);

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

app.use(express.urlencoded({ extended: false, limit: "10kb" }));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
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
  if (req.session) {
    req.isLoggedIn = req.session.isLoggedIn;
  } else {
    req.isLoggedIn = false;
  }
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

const PORT = process.env.PORT || 3000;

const startServer = () => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    startServer();
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.name, err.message);
    process.exit(1);
  });
