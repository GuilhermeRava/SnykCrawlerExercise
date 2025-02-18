const { parentPort } = require("worker_threads");

const axios = require("axios");

const waitAndMakeRequest = (instance, { waitTime, parentMessage: message }) => {
  setTimeout(() => {
    instance
      .get()
      .then((response) => {
        const { status } = response;
        console.log("response,", response.headers);
        parentPort.postMessage({
          domain: message.domain,
          path: message.path,
          data: { statusCode: status },
        });
      })
      .catch((error) => {
        // if we have a response it could be some auth issue ( 401 for example ) or something else.
        const { headers } = error.response;
        if (headers["retry-after"]) {
          const parsedWaitTIme = parseInt(headers["retry-after"]) * 1000;
          console.log("will retry in", parsedWaitTIme);
          waitAndMakeRequest(instance, {waitTime: parsedWaitTIme, parentMessage: message});
          return
        }
        if (error) {
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
  }, waitTime);
  return;
};

parentPort.on("message", (message) => {
  const instance = axios.create({
    baseURL: `${message.domain}${message.path}`,
    // for now we hardcode a timeout of 15 secs, because axios doesn't has one by default
    // just to avoid taking ages to parse a domain
    timeout: 15_000,
  });

  waitAndMakeRequest(instance, {waitTime: 0, parentMessage: message});
});
