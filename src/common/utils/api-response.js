export const sendResponse = (response, statusCode, message, data = null) => {
  response.status(statusCode).json({
    success: true,
    message,
    ...(data !== null ? { data } : {}),
  });
};
