export function synchronizeOnParameterList(asyncFunc, resultReuse) {
  // validate the arguments
  mustBeInstance(asyncFunc, AsyncFunction);
  if (resultReuse == null)
    resultReuse = ResultReuse.NONE;
  else mustBeEnumerationValue(resultReuse, ResultReuse);

  /*
   * This is the map which holds the queued calls and (optionally) the eagerly reported results.
   * A map entry contains as value an object two properties:
   * - `queue`: a linked list of objects with three properties: `resolve`, `reject`, `next`
   * - `result` (optional): the eagerly reported result  
   */
  const queues = new MultilevelMap();

  // build an asynchronous function which guards the submitted function against parallel runs with the same parameters
  const name = "synchronized" + capitalizeFirstLetter(asyncFunc.name);
  const temp = {
    // this is just a syntactic trick for setting the name of the built function to the value computed above
    [name]: async function (...args) {
      if (!args.length)
        return asyncFunc(); // nothing to synchronize on (nice try)

      let waiting = queues.get(...args);
      if (waiting) {
        // there's another call in progress, but maybe we're in luck of having an eager result
        if (waiting.hasOwnProperty('result'))
          return waiting.result;

        // well, just wait in the queue
        return new Promise((resolve, reject) => {
          waiting.queue = {
            resolve,
            reject,
            next: waiting.queue
          };
        });
      }

      // this call is unique with its parameter list, so prepare an empty queue...
      waiting = {
        queue: null
      };
      queues.set(waiting, ...args);

      // ...and perform it
      return new Promise((resolve, reject) => {
        let run = resultReuse === ResultReuse.EAGERLY ?
          // add an extra parameter for eager result reporting
          asyncFunc(...args, (result) => {
            waiting.result = result;
            resolve(result); // end successfully the current call

            // spread the result to all waiting calls
            let q = waiting.queue;
            while (q) {
              q.resolve(result);
              q = q.next;
            }
            waiting.queue = null; // clear the queue
          }) :
          asyncFunc(...args);

        if (resultReuse === ResultReuse.NONE) {
          // cannot share the outcome of the call
          const nextCall = () => {
            let q = waiting.queue;
            if (q) {
              waiting.queue = q.next;
              asyncFunc(...args).then(q.resolve, q.reject).finally(nextCall);
            } else {
              // remove the queue, it's now empty
              queues.delete(...args);
            }
          };

          // end the current call and simply perform the next waiting call
          return run.then(resolve, reject).finally(nextCall);
        }

        run.then((result) => {
          if (waiting.hasOwnProperty('result'))
            return; // it's done, the result is already reported

          // share the result with all waiting calls
          let q = waiting.queue;
          while (q) {
            q.resolve(result);
            q = q.next;
          }

          // end this call, too
          resolve(result);
        }, (error) => {
          if (waiting.hasOwnProperty('result'))
            return; // a result is already reported, cannot report an error now

          // share the error with all waiting calls
          let q = waiting.queue;
          while (q) {
            q.reject(error);
            q = q.next;
          }

          // end this call, too
          reject(error);
        }).finally(() => {
          // remove the queue
          queues.delete(...args);
        });
      });
    }
  };

  return temp[name];
}

const synchronizedResizeOne = synchronizeOnParameterList(
    fileService.resizeOneAsync.bind(fileService), ResultReuse.EAGERLY
  );
