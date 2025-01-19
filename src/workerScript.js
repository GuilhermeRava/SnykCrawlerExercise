const { parentPort } = require("worker_threads");

const axios = require("axios");

parentPort.on("message", (message) => {
  const instance = axios.create({
    baseURL: `${message.domain}${message.path}`,
    // for now we hardcode a timeout of 15 secs, because axios doesn't has one by default
    // just to avoid taking ages to parse a domain
    timeout: 15_000,
  });

  instance
    .get()
    .then((response) => {
      const { status } = response;
      parentPort.postMessage({
        domain: message.domain,
        path: message.path,
        data: { statusCode: status },
      });
    })
    .catch((error) => {
      // if we have a response it could be some auth issue ( 401 for example ) or something else.
      if (error.response) {
        parentPort.postMessage({
          domain: message.domain,
          path: message.path,
          data: { statusCode: error.response.status },
        });
      } else {
        parentPort.postMessage({
          domain: message.domain,
          path: message.path,
          data: { error: true },
        });
      }
    });
});
