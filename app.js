//core Module
const path = require("path");

//External Module
const express = require("express");
const app = express();
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const DB_URI =
  "mongodb+srv://Campus-helpdesk:malothvenky@campus-helpdesk.1aoq1vq.mongodb.net/campus-helpdesk?retryWrites=true&w=majority";

const store = new MongoDBStore({
  uri: DB_URI,
  collection: "sessions",
});

store.on("error", (error) => {
  console.error("Session store error:", error);
});

app.set("view engine", "ejs");
app.set("views", "views");

//Local Module
const helpdeskPath = require("./utils/path");
const loginRoute = require("./routes/login");
const registerRoute = require("./routes/register");
const indexRoute = require("./routes/index");
const studentRoute = require("./routes/student");
const adminRoute = require("./routes/admin");
const isAuth = require("./middleware/is-auth");
const pagenotfound = require("./controllers/error");

const { default: mongoose } = require("mongoose");

app.use(express.urlencoded({ extended: false }));
//app.use(cookies());
//const store = new mongostore({
//uri: DB_URI,
//collection: "sessions",
//});
app.use(
  session({
    secret: "helpdesk-secret-key",
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  }),
);
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
  req.session.destroy(() => {
    res.redirect("/");
  });
});
app.use("/student", studentRoute);
app.use(adminRoute);
app.use(pagenotfound.pageNotFound);

const PORT = 3000;
mongoose
  .connect(DB_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully");
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
  });
