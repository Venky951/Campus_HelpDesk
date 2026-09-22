exports.pageNotFound = (req, res, next) => {
  res.status(404).render("404", {
    title: "Page Not Found",
    currentPage: "404",
    isLoggedIn: req.isLoggedIn,
  });
};

exports.errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).render("403", {
      title: "Request Rejected",
      currentPage: "403",
      isLoggedIn: req.isLoggedIn,
    });
  }

  console.error(
    "Unhandled application error:",
    err.name || "Error",
    err.message,
  );
  res.status(500).send("Something went wrong. Please try again later.");
};
