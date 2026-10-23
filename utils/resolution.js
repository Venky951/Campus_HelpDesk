const MAX_RESOLUTION_DETAILS_LENGTH = 2000;

const validateResolutionDetails = (
  status,
  previousStatus,
  resolutionDetails,
) => {
  const details =
    typeof resolutionDetails === "string" ? resolutionDetails.trim() : "";

  if (status === "Resolved" && previousStatus !== "Resolved" && !details) {
    return { valid: false, message: "Resolution details are required" };
  }

  if (details.length > MAX_RESOLUTION_DETAILS_LENGTH) {
    return {
      valid: false,
      message: "Resolution details must be 2000 characters or fewer",
    };
  }

  return { valid: true, details };
};

module.exports = {
  MAX_RESOLUTION_DETAILS_LENGTH,
  validateResolutionDetails,
};
