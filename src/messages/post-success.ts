export const successMessage =
  "Gosh, this _is_ an interesting conversation - I've filed a copy at ${url} for future reference!";

export const createSuccessMessage = (url) =>
  successMessage.replace("${url}", url);
