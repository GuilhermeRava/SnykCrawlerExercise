const { Worker } = require("worker_threads");
const path = require("path");
const { performance, PerformanceObserver } = require("perf_hooks");

const { getCsvData, getCsvPath } = require("./csvUtils.js");

// This will be our list of domains + path to process
let QUEUE;
let QUEUE_POINTER = 0;

// We'll leverage NodeJS worker_threads for parallel parsing. Maximum of 4 workers as the requirement.
const WORKERS = [];
const MAXIMUM_WORKERS = 4;

// Our object that we'll later use to output the results + summary
const PARSED_DOMAINS = {};

// setup some performance observers to output more summary information
const PERFORMANCE_OBSERVER = new PerformanceObserver((items) => {
  // items.getEntries().forEach((entry) => {
  //   console.log(entry);
  // });
});

PERFORMANCE_OBSERVER.observe({ entryTypes: ["measure"], buffer: true });

const initWorkers = (doneCallback) => {
  // setup workers, for now its required to have a maximum of 4 simultaneos
  for (let i = 0; i < MAXIMUM_WORKERS; i++) {
    const worker = new Worker(path.resolve(__dirname, "workerScript.js"), {});
    worker._customID = i;

    // if a worker fails for some unknowe reason, we fail the process as a whole
    worker.on("error", (err) => {
      throw err;
    });
    worker.on("message", (msg) => {
      const { domain, path, data } = msg;
      if (!PARSED_DOMAINS[domain]) {
        PARSED_DOMAINS[domain] = {
          statusCodes: {
            "-1": 0,
          },
          validPaths: [],
          invalidPaths: [],
          forbiddenPaths: [],
          requiresAuthPaths: [],
          errorPaths: [],
        };
      }

      // as per the requirement, if some server error, DNS error or something else happens, we use the status "-1";
      if (data.error) {
        PARSED_DOMAINS[domain].statusCodes["-1"]++;
        PARSED_DOMAINS[domain].errorPaths.push(path);
      } else {
        if (!PARSED_DOMAINS[domain].statusCodes[data.statusCode]) {
          PARSED_DOMAINS[domain].statusCodes[data.statusCode] = 1;
        } else {
          PARSED_DOMAINS[domain].statusCodes[data.statusCode]++;
        }

        switch (data.statusCode) {
          case 200:
            {
              PARSED_DOMAINS[domain].validPaths.push(path);
            }
            break;
          case 401:
            {
              PARSED_DOMAINS[domain].requiresAuthPaths.push(path);
            }
            break;
          case 403:
            {
              PARSED_DOMAINS[domain].forbiddenPaths.push(path);
            }
            break;
          case 404:
            {
              PARSED_DOMAINS[domain].invalidPaths.push(path);
            }
            break;
        }
      }

      // because he finished working, lets send the other job to be processed
      if (QUEUE_POINTER < QUEUE.length) {
        const dataToSend = QUEUE[QUEUE_POINTER];
        QUEUE_POINTER++;
        worker.postMessage(dataToSend);
      } else {
        // we finished parsing all domains, invoke callback
        doneCallback(worker);
      }
    });
    WORKERS.push(worker);
  }
};

const processJobs = () => {
  // start the workers with the first jobs, then we'll send more jobs to them whenever they
  // send a message back to the main thread.
  for (
    ;
    QUEUE_POINTER < MAXIMUM_WORKERS && QUEUE_POINTER < QUEUE.length;
    QUEUE_POINTER++
  ) {
    const worker = WORKERS[QUEUE_POINTER];
    const dataToSend = QUEUE[QUEUE_POINTER];
    worker.postMessage(dataToSend);
  }
};

const main = async () => {
  const csvPath = getCsvPath();

  const csvData = await getCsvData(csvPath);
  if (csvData.length === 0) {
    console.error(
      "Invalid CSV received, 0 domains to be parsed. Please submit a valid one"
    );
    process.exit(-1);
  }
  QUEUE = csvData;

  const isDonePromise = new Promise((res) => {
    let finishedWorkers = 0;
    const doneCallback = (worker) => {
      finishedWorkers++;
      console.info(
        `Worker '${
          worker._customID
        }' finished all it jobs. exiting... remaining ${
          MAXIMUM_WORKERS - finishedWorkers
        } workers`
      );
      worker.terminate();

      if (finishedWorkers === MAXIMUM_WORKERS) {
        console.info("All workers finished working.");
        res({ parsedDomains: PARSED_DOMAINS });
        performance.mark("process-jobs-end");
        performance.measure(
          "process-jobs",
          "process-jobs-start",
          "process-jobs-end"
        );
      }
    };

    performance.mark("workers-init-start");
    initWorkers(doneCallback);
    performance.mark("workers-init-end");
    performance.measure(
      "workers-init",
      "workers-init-start",
      "workers-init-end"
    );

    // start processing the input
    performance.mark("process-jobs-start");
    processJobs();
  });

  // wait for all jobs to be finished and return parsed domains so we can display the output
  return await isDonePromise;
};

main()
  .then(({ parsedDomains }) => {
    let outputMessage = ``;

    // handle each domain output information
    Object.entries(parsedDomains).forEach(([key, val]) => {
      const {
        statusCodes,
        validPaths,
        invalidPaths,
        forbiddenPaths,
        requiresAuthPaths,
        errorPaths,
      } = val;

      const outputUrlPathResult = (BlockMessage, pathObject) => {
        if (pathObject.length === 0) {
          return "";
        }
        return pathObject.reduce((acc, path) => {
          acc += `\n\t${path}`;
          return acc;
        }, BlockMessage);
      };

      outputMessage += `
Results for ${key}:
  Status codes:
${Object.entries(statusCodes).reduce((acc, [statusCode, quantity]) => {
  acc += `\t${statusCode}:\t${quantity}\n`;
  return acc;
}, "")}
${outputUrlPathResult(
  "  Valid paths:          (200 HTTP Code):",
  validPaths
)}
${outputUrlPathResult(
  "  Requires Auth paths   (401 HTTP Code):",
  requiresAuthPaths
)}
${outputUrlPathResult(
  "  Forbidden paths       (403 HTTP Code):",
  forbiddenPaths
)}
${outputUrlPathResult(
  "  Not found paths       (404 HTTP Code):",
  invalidPaths
)}
${outputUrlPathResult("  Error paths           (-1 Code):", errorPaths)}
----\n`;
    });

    // handle summary
    outputMessage += `
Results summary:
  Total domains tested\t${Object.keys(parsedDomains).length}
  Total paths tested:\t${QUEUE.length}
  Time to init workers:\t${(
    performance.getEntriesByName("workers-init")[0].duration / 1000
  ).toFixed(2)} seconds
  Time to parse all domains\t${(
    performance.getEntriesByName("process-jobs")[0].duration / 1000
  ).toFixed(2)} seconds
`;

    console.log(outputMessage);

    // close the application
    process.exit();
  })
  .catch((e) => {
    console.error("Something went wrong when running the application:\n", e);

    WORKERS.forEach((worker) => {
      worker.terminate();
    });
    process.exit(1);
  })
  .finally(() => {
    PERFORMANCE_OBSERVER.disconnect();
  });
