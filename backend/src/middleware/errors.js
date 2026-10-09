export function notFound(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.path}.` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.name === "ZodError") {
    return res.status(400).json({
      message: "Please check the submitted information.",
      errors: error.issues.map(({ path, message }) => ({ field: path.join("."), message }))
    });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: "A record with that value already exists." });
  }
  if (error.name === "ValidationError" || error.name === "CastError") {
    return res.status(400).json({ message: "The submitted information is invalid." });
  }

  console.error("Request failed:", error);
  return res.status(500).json({ message: "An unexpected server error occurred." });
}
