//core Module
const path = require("path");

//External Module
const express = require("express");
const app = express();
const session = require("express-session");
// Disable MongoDB store temporarily - using memory store instead
// const MongoDBStore = require("connect-mongodb-session")(session);
const DB_URI =
  "mongodb+srv://Campus-helpdesk:malothvenky@campus-helpdesk.1aoq1vq.mongodb.net/campus-helpdesk?retryWrites=true&w=majority&tls=true&tlsAllowInvalidCertificates=true";

// Disable store for now
// const store = new MongoDBStore({
//   uri: DB_URI,
//   collection: "sessions",
//   mongoOptions: {
//     tls: true,
//     tlsAllowInvalidCertificates: true,
//   },
// });

// store.on("error", (error) => {
//   console.error("Session store error:", error);
// });

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

// Use in-memory session store temporarily if MongoDB fails
const sessionConfig = {
  secret: "helpdesk-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
  },
};

// MongoDB store disabled due to connection issues
// Using memory store for now
// try {
//   sessionConfig.store = store;
// } catch (err) {
//   console.warn(
//     "MongoDB session store failed, using memory store:",
//     err.message,
//   );
// }

app.use(session(sessionConfig));
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
      console.error("Session destruction error:", err);
      return res.redirect("/");
    }
    res.redirect("/");
  });
});
app.use("/student", studentRoute);
app.use(adminRoute);
app.use(pagenotfound.pageNotFound);

const PORT = process.env.PORT || 3000;

// Start server even if MongoDB connection fails
const startServer = () => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

mongoose
  .connect(DB_URI, {
    tls: true,
    tlsAllowInvalidCertificates: true,
  })
  .then(() => {
    console.log("Connected to MongoDB successfully");
    startServer();
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    console.warn("Continuing without database persistence...");
    startServer();
  });
