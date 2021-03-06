(function () {
var define = null;
var buildDate = '2016-10-27 12:01:24';
var buildUUID = '489e30979db14cb58542a604d4121f0e';
(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)

    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var list = this.map[name]
    if (!list) {
      list = []
      this.map[name] = list
    }
    list.push(value)
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    var values = this.map[normalizeName(name)]
    return values ? values[0] : null
  }

  Headers.prototype.getAll = function(name) {
    return this.map[normalizeName(name)] || []
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = [normalizeValue(value)]
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    Object.getOwnPropertyNames(this.map).forEach(function(name) {
      this.map[name].forEach(function(value) {
        callback.call(thisArg, value, name, this)
      }, this)
    }, this)
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    reader.readAsArrayBuffer(blob)
    return fileReaderReady(reader)
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    reader.readAsText(blob)
    return fileReaderReady(reader)
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (!body) {
        this._bodyText = ''
      } else if (support.arrayBuffer && ArrayBuffer.prototype.isPrototypeOf(body)) {
        // Only support ArrayBuffers for POST method.
        // Receiving ArrayBuffers happens via Blobs, instead.
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        return this.blob().then(readBlobAsArrayBuffer)
      }

      this.text = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return readBlobAsText(this._bodyBlob)
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as text')
        } else {
          return Promise.resolve(this._bodyText)
        }
      }
    } else {
      this.text = function() {
        var rejected = consumed(this)
        return rejected ? rejected : Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body
    if (Request.prototype.isPrototypeOf(input)) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = input
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this)
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function headers(xhr) {
    var head = new Headers()
    var pairs = (xhr.getAllResponseHeaders() || '').trim().split('\n')
    pairs.forEach(function(header) {
      var split = header.trim().split(':')
      var key = split.shift().trim()
      var value = split.join(':').trim()
      head.append(key, value)
    })
    return head
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = options.status
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = options.statusText
    this.headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request
      if (Request.prototype.isPrototypeOf(input) && !init) {
        request = input
      } else {
        request = new Request(input, init)
      }

      var xhr = new XMLHttpRequest()

      function responseURL() {
        if ('responseURL' in xhr) {
          return xhr.responseURL
        }

        // Avoid security warnings on getResponseHeader when not allowed by CORS
        if (/^X-Request-URL:/mi.test(xhr.getAllResponseHeaders())) {
          return xhr.getResponseHeader('X-Request-URL')
        }

        return
      }

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: headers(xhr),
          url: responseURL()
        }
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);


/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   4.0.5
 */

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  return typeof x === 'function' || typeof x === 'object' && x !== null;
}

function isFunction(x) {
  return typeof x === 'function';
}

var _isArray = undefined;
if (!Array.isArray) {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
} else {
  _isArray = Array.isArray;
}

var isArray = _isArray;

var len = 0;
var vertxNext = undefined;
var customSchedulerFn = undefined;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && ({}).toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }

  return useSetTimeout();
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var r = require;
    var vertx = r('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = undefined;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var _arguments = arguments;

  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;

  if (_state) {
    (function () {
      var callback = _arguments[_state - 1];
      asap(function () {
        return invokeCallback(_state, child, callback, parent._result);
      });
    })();
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  _resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(16);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

var GET_THEN_ERROR = new ErrorObject();

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function getThen(promise) {
  try {
    return promise.then;
  } catch (error) {
    GET_THEN_ERROR.error = error;
    return GET_THEN_ERROR;
  }
}

function tryThen(then, value, fulfillmentHandler, rejectionHandler) {
  try {
    then.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        _resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      _reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      _reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    _reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return _resolve(promise, value);
    }, function (reason) {
      return _reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$) {
  if (maybeThenable.constructor === promise.constructor && then$$ === then && maybeThenable.constructor.resolve === resolve) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$ === GET_THEN_ERROR) {
      _reject(promise, GET_THEN_ERROR.error);
    } else if (then$$ === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$)) {
      handleForeignThenable(promise, maybeThenable, then$$);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function _resolve(promise, value) {
  if (promise === value) {
    _reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    handleMaybeThenable(promise, value, getThen(value));
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function _reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;

  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = undefined,
      callback = undefined,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function ErrorObject() {
  this.error = null;
}

var TRY_CATCH_ERROR = new ErrorObject();

function tryCatch(callback, detail) {
  try {
    return callback(detail);
  } catch (e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = undefined,
      error = undefined,
      succeeded = undefined,
      failed = undefined;

  if (hasCallback) {
    value = tryCatch(callback, detail);

    if (value === TRY_CATCH_ERROR) {
      failed = true;
      error = value.error;
      value = null;
    } else {
      succeeded = true;
    }

    if (promise === value) {
      _reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
      _resolve(promise, value);
    } else if (failed) {
      _reject(promise, error);
    } else if (settled === FULFILLED) {
      fulfill(promise, value);
    } else if (settled === REJECTED) {
      _reject(promise, value);
    }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      _resolve(promise, value);
    }, function rejectPromise(reason) {
      _reject(promise, reason);
    });
  } catch (e) {
    _reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function Enumerator(Constructor, input) {
  this._instanceConstructor = Constructor;
  this.promise = new Constructor(noop);

  if (!this.promise[PROMISE_ID]) {
    makePromise(this.promise);
  }

  if (isArray(input)) {
    this._input = input;
    this.length = input.length;
    this._remaining = input.length;

    this._result = new Array(this.length);

    if (this.length === 0) {
      fulfill(this.promise, this._result);
    } else {
      this.length = this.length || 0;
      this._enumerate();
      if (this._remaining === 0) {
        fulfill(this.promise, this._result);
      }
    }
  } else {
    _reject(this.promise, validationError());
  }
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
};

Enumerator.prototype._enumerate = function () {
  var length = this.length;
  var _input = this._input;

  for (var i = 0; this._state === PENDING && i < length; i++) {
    this._eachEntry(_input[i], i);
  }
};

Enumerator.prototype._eachEntry = function (entry, i) {
  var c = this._instanceConstructor;
  var resolve$$ = c.resolve;

  if (resolve$$ === resolve) {
    var _then = getThen(entry);

    if (_then === then && entry._state !== PENDING) {
      this._settledAt(entry._state, i, entry._result);
    } else if (typeof _then !== 'function') {
      this._remaining--;
      this._result[i] = entry;
    } else if (c === Promise) {
      var promise = new c(noop);
      handleMaybeThenable(promise, entry, _then);
      this._willSettleAt(promise, i);
    } else {
      this._willSettleAt(new c(function (resolve$$) {
        return resolve$$(entry);
      }), i);
    }
  } else {
    this._willSettleAt(resolve$$(entry), i);
  }
};

Enumerator.prototype._settledAt = function (state, i, value) {
  var promise = this.promise;

  if (promise._state === PENDING) {
    this._remaining--;

    if (state === REJECTED) {
      _reject(promise, value);
    } else {
      this._result[i] = value;
    }
  }

  if (this._remaining === 0) {
    fulfill(promise, this._result);
  }
};

Enumerator.prototype._willSettleAt = function (promise, i) {
  var enumerator = this;

  subscribe(promise, undefined, function (value) {
    return enumerator._settledAt(FULFILLED, i, value);
  }, function (reason) {
    return enumerator._settledAt(REJECTED, i, reason);
  });
};

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all(entries) {
  return new Enumerator(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  _reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {function} resolver
  Useful for tooling.
  @constructor
*/
function Promise(resolver) {
  this[PROMISE_ID] = nextId();
  this._result = this._state = undefined;
  this._subscribers = [];

  if (noop !== resolver) {
    typeof resolver !== 'function' && needsResolver();
    this instanceof Promise ? initializePromise(this, resolver) : needsNew();
  }
}

Promise.all = all;
Promise.race = race;
Promise.resolve = resolve;
Promise.reject = reject;
Promise._setScheduler = setScheduler;
Promise._setAsap = setAsap;
Promise._asap = asap;

Promise.prototype = {
  constructor: Promise,

  /**
    The primary way of interacting with a promise is through its `then` method,
    which registers callbacks to receive either a promise's eventual value or the
    reason why the promise cannot be fulfilled.
  
    ```js
    findUser().then(function(user){
      // user is available
    }, function(reason){
      // user is unavailable, and you are given the reason why
    });
    ```
  
    Chaining
    --------
  
    The return value of `then` is itself a promise.  This second, 'downstream'
    promise is resolved with the return value of the first promise's fulfillment
    or rejection handler, or rejected if the handler throws an exception.
  
    ```js
    findUser().then(function (user) {
      return user.name;
    }, function (reason) {
      return 'default name';
    }).then(function (userName) {
      // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
      // will be `'default name'`
    });
  
    findUser().then(function (user) {
      throw new Error('Found user, but still unhappy');
    }, function (reason) {
      throw new Error('`findUser` rejected and we're unhappy');
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
      // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
    });
    ```
    If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
  
    ```js
    findUser().then(function (user) {
      throw new PedagogicalException('Upstream error');
    }).then(function (value) {
      // never reached
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // The `PedgagocialException` is propagated all the way down to here
    });
    ```
  
    Assimilation
    ------------
  
    Sometimes the value you want to propagate to a downstream promise can only be
    retrieved asynchronously. This can be achieved by returning a promise in the
    fulfillment or rejection handler. The downstream promise will then be pending
    until the returned promise is settled. This is called *assimilation*.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // The user's comments are now available
    });
    ```
  
    If the assimliated promise rejects, then the downstream promise will also reject.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // If `findCommentsByAuthor` fulfills, we'll have the value here
    }, function (reason) {
      // If `findCommentsByAuthor` rejects, we'll have the reason here
    });
    ```
  
    Simple Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let result;
  
    try {
      result = findResult();
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
    findResult(function(result, err){
      if (err) {
        // failure
      } else {
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findResult().then(function(result){
      // success
    }, function(reason){
      // failure
    });
    ```
  
    Advanced Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let author, books;
  
    try {
      author = findAuthor();
      books  = findBooksByAuthor(author);
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
  
    function foundBooks(books) {
  
    }
  
    function failure(reason) {
  
    }
  
    findAuthor(function(author, err){
      if (err) {
        failure(err);
        // failure
      } else {
        try {
          findBoooksByAuthor(author, function(books, err) {
            if (err) {
              failure(err);
            } else {
              try {
                foundBooks(books);
              } catch(reason) {
                failure(reason);
              }
            }
          });
        } catch(error) {
          failure(err);
        }
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findAuthor().
      then(findBooksByAuthor).
      then(function(books){
        // found books
    }).catch(function(reason){
      // something went wrong
    });
    ```
  
    @method then
    @param {Function} onFulfilled
    @param {Function} onRejected
    Useful for tooling.
    @return {Promise}
  */
  then: then,

  /**
    `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
    as the catch block of a try/catch statement.
  
    ```js
    function findAuthor(){
      throw new Error('couldn't find that author');
    }
  
    // synchronous
    try {
      findAuthor();
    } catch(reason) {
      // something went wrong
    }
  
    // async with promises
    findAuthor().catch(function(reason){
      // something went wrong
    });
    ```
  
    @method catch
    @param {Function} onRejection
    Useful for tooling.
    @return {Promise}
  */
  'catch': function _catch(onRejection) {
    return this.then(null, onRejection);
  }
};

function polyfill() {
    var local = undefined;

    if (typeof global !== 'undefined') {
        local = global;
    } else if (typeof self !== 'undefined') {
        local = self;
    } else {
        try {
            local = Function('return this')();
        } catch (e) {
            throw new Error('polyfill failed because global object is unavailable in this environment');
        }
    }

    var P = local.Promise;

    if (P) {
        var promiseToString = null;
        try {
            promiseToString = Object.prototype.toString.call(P.resolve());
        } catch (e) {
            // silently ignored
        }

        if (promiseToString === '[object Promise]' && !P.cast) {
            return;
        }
    }

    local.Promise = Promise;
}

// Strange compat..
Promise.polyfill = polyfill;
Promise.Promise = Promise;

return Promise;

})));

ES6Promise.polyfill();
//# sourceMappingURL=es6-promise.auto.map

/*
 Leaflet, a JavaScript library for mobile-friendly interactive maps. http://leafletjs.com
 (c) 2010-2013, Vladimir Agafonkin
 (c) 2010-2011, CloudMade
*/
(function (window, document, undefined) {
var oldL = window.L,
    L = {};

L.version = '0.7.7';

// define Leaflet for Node module pattern loaders, including Browserify
if (typeof module === 'object' && typeof module.exports === 'object') {
	module.exports = L;

// define Leaflet as an AMD module
} else if (typeof define === 'function' && define.amd) {
	define(L);
}

// define Leaflet as a global L variable, saving the original L to restore later if needed

L.noConflict = function () {
	window.L = oldL;
	return this;
};

window.L = L;


/*
 * L.Util contains various utility functions used throughout Leaflet code.
 */

L.Util = {
	extend: function (dest) { // (Object[, Object, ...]) ->
		var sources = Array.prototype.slice.call(arguments, 1),
		    i, j, len, src;

		for (j = 0, len = sources.length; j < len; j++) {
			src = sources[j] || {};
			for (i in src) {
				if (src.hasOwnProperty(i)) {
					dest[i] = src[i];
				}
			}
		}
		return dest;
	},

	bind: function (fn, obj) { // (Function, Object) -> Function
		var args = arguments.length > 2 ? Array.prototype.slice.call(arguments, 2) : null;
		return function () {
			return fn.apply(obj, args || arguments);
		};
	},

	stamp: (function () {
		var lastId = 0,
		    key = '_leaflet_id';
		return function (obj) {
			obj[key] = obj[key] || ++lastId;
			return obj[key];
		};
	}()),

	invokeEach: function (obj, method, context) {
		var i, args;

		if (typeof obj === 'object') {
			args = Array.prototype.slice.call(arguments, 3);

			for (i in obj) {
				method.apply(context, [i, obj[i]].concat(args));
			}
			return true;
		}

		return false;
	},

	limitExecByInterval: function (fn, time, context) {
		var lock, execOnUnlock;

		return function wrapperFn() {
			var args = arguments;

			if (lock) {
				execOnUnlock = true;
				return;
			}

			lock = true;

			setTimeout(function () {
				lock = false;

				if (execOnUnlock) {
					wrapperFn.apply(context, args);
					execOnUnlock = false;
				}
			}, time);

			fn.apply(context, args);
		};
	},

	falseFn: function () {
		return false;
	},

	formatNum: function (num, digits) {
		var pow = Math.pow(10, digits || 5);
		return Math.round(num * pow) / pow;
	},

	trim: function (str) {
		return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
	},

	splitWords: function (str) {
		return L.Util.trim(str).split(/\s+/);
	},

	setOptions: function (obj, options) {
		obj.options = L.extend({}, obj.options, options);
		return obj.options;
	},

	getParamString: function (obj, existingUrl, uppercase) {
		var params = [];
		for (var i in obj) {
			params.push(encodeURIComponent(uppercase ? i.toUpperCase() : i) + '=' + encodeURIComponent(obj[i]));
		}
		return ((!existingUrl || existingUrl.indexOf('?') === -1) ? '?' : '&') + params.join('&');
	},
	template: function (str, data) {
		return str.replace(/\{ *([\w_]+) *\}/g, function (str, key) {
			var value = data[key];
			if (value === undefined) {
				throw new Error('No value provided for variable ' + str);
			} else if (typeof value === 'function') {
				value = value(data);
			}
			return value;
		});
	},

	isArray: Array.isArray || function (obj) {
		return (Object.prototype.toString.call(obj) === '[object Array]');
	},

	emptyImageUrl: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='
};

(function () {

	// inspired by http://paulirish.com/2011/requestanimationframe-for-smart-animating/

	function getPrefixed(name) {
		var i, fn,
		    prefixes = ['webkit', 'moz', 'o', 'ms'];

		for (i = 0; i < prefixes.length && !fn; i++) {
			fn = window[prefixes[i] + name];
		}

		return fn;
	}

	var lastTime = 0;

	function timeoutDefer(fn) {
		var time = +new Date(),
		    timeToCall = Math.max(0, 16 - (time - lastTime));

		lastTime = time + timeToCall;
		return window.setTimeout(fn, timeToCall);
	}

	var requestFn = window.requestAnimationFrame ||
	        getPrefixed('RequestAnimationFrame') || timeoutDefer;

	var cancelFn = window.cancelAnimationFrame ||
	        getPrefixed('CancelAnimationFrame') ||
	        getPrefixed('CancelRequestAnimationFrame') ||
	        function (id) { window.clearTimeout(id); };


	L.Util.requestAnimFrame = function (fn, context, immediate, element) {
		fn = L.bind(fn, context);

		if (immediate && requestFn === timeoutDefer) {
			fn();
		} else {
			return requestFn.call(window, fn, element);
		}
	};

	L.Util.cancelAnimFrame = function (id) {
		if (id) {
			cancelFn.call(window, id);
		}
	};

}());

// shortcuts for most used utility functions
L.extend = L.Util.extend;
L.bind = L.Util.bind;
L.stamp = L.Util.stamp;
L.setOptions = L.Util.setOptions;


/*
 * L.Class powers the OOP facilities of the library.
 * Thanks to John Resig and Dean Edwards for inspiration!
 */

L.Class = function () {};

L.Class.extend = function (props) {

	// extended class with the new prototype
	var NewClass = function () {

		// call the constructor
		if (this.initialize) {
			this.initialize.apply(this, arguments);
		}

		// call all constructor hooks
		if (this._initHooks) {
			this.callInitHooks();
		}
	};

	// instantiate class without calling constructor
	var F = function () {};
	F.prototype = this.prototype;

	var proto = new F();
	proto.constructor = NewClass;

	NewClass.prototype = proto;

	//inherit parent's statics
	for (var i in this) {
		if (this.hasOwnProperty(i) && i !== 'prototype') {
			NewClass[i] = this[i];
		}
	}

	// mix static properties into the class
	if (props.statics) {
		L.extend(NewClass, props.statics);
		delete props.statics;
	}

	// mix includes into the prototype
	if (props.includes) {
		L.Util.extend.apply(null, [proto].concat(props.includes));
		delete props.includes;
	}

	// merge options
	if (props.options && proto.options) {
		props.options = L.extend({}, proto.options, props.options);
	}

	// mix given properties into the prototype
	L.extend(proto, props);

	proto._initHooks = [];

	var parent = this;
	// jshint camelcase: false
	NewClass.__super__ = parent.prototype;

	// add method for calling all hooks
	proto.callInitHooks = function () {

		if (this._initHooksCalled) { return; }

		if (parent.prototype.callInitHooks) {
			parent.prototype.callInitHooks.call(this);
		}

		this._initHooksCalled = true;

		for (var i = 0, len = proto._initHooks.length; i < len; i++) {
			proto._initHooks[i].call(this);
		}
	};

	return NewClass;
};


// method for adding properties to prototype
L.Class.include = function (props) {
	L.extend(this.prototype, props);
};

// merge new default options to the Class
L.Class.mergeOptions = function (options) {
	L.extend(this.prototype.options, options);
};

// add a constructor hook
L.Class.addInitHook = function (fn) { // (Function) || (String, args...)
	var args = Array.prototype.slice.call(arguments, 1);

	var init = typeof fn === 'function' ? fn : function () {
		this[fn].apply(this, args);
	};

	this.prototype._initHooks = this.prototype._initHooks || [];
	this.prototype._initHooks.push(init);
};


/*
 * L.Mixin.Events is used to add custom events functionality to Leaflet classes.
 */

var eventsKey = '_leaflet_events';

L.Mixin = {};

L.Mixin.Events = {

	addEventListener: function (types, fn, context) { // (String, Function[, Object]) or (Object[, Object])

		// types can be a map of types/handlers
		if (L.Util.invokeEach(types, this.addEventListener, this, fn, context)) { return this; }

		var events = this[eventsKey] = this[eventsKey] || {},
		    contextId = context && context !== this && L.stamp(context),
		    i, len, event, type, indexKey, indexLenKey, typeIndex;

		// types can be a string of space-separated words
		types = L.Util.splitWords(types);

		for (i = 0, len = types.length; i < len; i++) {
			event = {
				action: fn,
				context: context || this
			};
			type = types[i];

			if (contextId) {
				// store listeners of a particular context in a separate hash (if it has an id)
				// gives a major performance boost when removing thousands of map layers

				indexKey = type + '_idx';
				indexLenKey = indexKey + '_len';

				typeIndex = events[indexKey] = events[indexKey] || {};

				if (!typeIndex[contextId]) {
					typeIndex[contextId] = [];

					// keep track of the number of keys in the index to quickly check if it's empty
					events[indexLenKey] = (events[indexLenKey] || 0) + 1;
				}

				typeIndex[contextId].push(event);


			} else {
				events[type] = events[type] || [];
				events[type].push(event);
			}
		}

		return this;
	},

	hasEventListeners: function (type) { // (String) -> Boolean
		var events = this[eventsKey];
		return !!events && ((type in events && events[type].length > 0) ||
		                    (type + '_idx' in events && events[type + '_idx_len'] > 0));
	},

	removeEventListener: function (types, fn, context) { // ([String, Function, Object]) or (Object[, Object])

		if (!this[eventsKey]) {
			return this;
		}

		if (!types) {
			return this.clearAllEventListeners();
		}

		if (L.Util.invokeEach(types, this.removeEventListener, this, fn, context)) { return this; }

		var events = this[eventsKey],
		    contextId = context && context !== this && L.stamp(context),
		    i, len, type, listeners, j, indexKey, indexLenKey, typeIndex, removed;

		types = L.Util.splitWords(types);

		for (i = 0, len = types.length; i < len; i++) {
			type = types[i];
			indexKey = type + '_idx';
			indexLenKey = indexKey + '_len';

			typeIndex = events[indexKey];

			if (!fn) {
				// clear all listeners for a type if function isn't specified
				delete events[type];
				delete events[indexKey];
				delete events[indexLenKey];

			} else {
				listeners = contextId && typeIndex ? typeIndex[contextId] : events[type];

				if (listeners) {
					for (j = listeners.length - 1; j >= 0; j--) {
						if ((listeners[j].action === fn) && (!context || (listeners[j].context === context))) {
							removed = listeners.splice(j, 1);
							// set the old action to a no-op, because it is possible
							// that the listener is being iterated over as part of a dispatch
							removed[0].action = L.Util.falseFn;
						}
					}

					if (context && typeIndex && (listeners.length === 0)) {
						delete typeIndex[contextId];
						events[indexLenKey]--;
					}
				}
			}
		}

		return this;
	},

	clearAllEventListeners: function () {
		delete this[eventsKey];
		return this;
	},

	fireEvent: function (type, data) { // (String[, Object])
		if (!this.hasEventListeners(type)) {
			return this;
		}

		var event = L.Util.extend({}, data, { type: type, target: this });

		var events = this[eventsKey],
		    listeners, i, len, typeIndex, contextId;

		if (events[type]) {
			// make sure adding/removing listeners inside other listeners won't cause infinite loop
			listeners = events[type].slice();

			for (i = 0, len = listeners.length; i < len; i++) {
				listeners[i].action.call(listeners[i].context, event);
			}
		}

		// fire event for the context-indexed listeners as well
		typeIndex = events[type + '_idx'];

		for (contextId in typeIndex) {
			listeners = typeIndex[contextId].slice();

			if (listeners) {
				for (i = 0, len = listeners.length; i < len; i++) {
					listeners[i].action.call(listeners[i].context, event);
				}
			}
		}

		return this;
	},

	addOneTimeEventListener: function (types, fn, context) {

		if (L.Util.invokeEach(types, this.addOneTimeEventListener, this, fn, context)) { return this; }

		var handler = L.bind(function () {
			this
			    .removeEventListener(types, fn, context)
			    .removeEventListener(types, handler, context);
		}, this);

		return this
		    .addEventListener(types, fn, context)
		    .addEventListener(types, handler, context);
	}
};

L.Mixin.Events.on = L.Mixin.Events.addEventListener;
L.Mixin.Events.off = L.Mixin.Events.removeEventListener;
L.Mixin.Events.once = L.Mixin.Events.addOneTimeEventListener;
L.Mixin.Events.fire = L.Mixin.Events.fireEvent;


/*
 * L.Browser handles different browser and feature detections for internal Leaflet use.
 */

(function () {

	var ie = 'ActiveXObject' in window,
		ielt9 = ie && !document.addEventListener,

	    // terrible browser detection to work around Safari / iOS / Android browser bugs
	    ua = navigator.userAgent.toLowerCase(),
	    webkit = ua.indexOf('webkit') !== -1,
	    chrome = ua.indexOf('chrome') !== -1,
	    phantomjs = ua.indexOf('phantom') !== -1,
	    android = ua.indexOf('android') !== -1,
	    android23 = ua.search('android [23]') !== -1,
		gecko = ua.indexOf('gecko') !== -1,

	    mobile = typeof orientation !== undefined + '',
	    msPointer = !window.PointerEvent && window.MSPointerEvent,
		pointer = (window.PointerEvent && window.navigator.pointerEnabled) ||
				  msPointer,
	    retina = ('devicePixelRatio' in window && window.devicePixelRatio > 1) ||
	             ('matchMedia' in window && window.matchMedia('(min-resolution:144dpi)') &&
	              window.matchMedia('(min-resolution:144dpi)').matches),

	    doc = document.documentElement,
	    ie3d = ie && ('transition' in doc.style),
	    webkit3d = ('WebKitCSSMatrix' in window) && ('m11' in new window.WebKitCSSMatrix()) && !android23,
	    gecko3d = 'MozPerspective' in doc.style,
	    opera3d = 'OTransition' in doc.style,
	    any3d = !window.L_DISABLE_3D && (ie3d || webkit3d || gecko3d || opera3d) && !phantomjs;

	var touch = !window.L_NO_TOUCH && !phantomjs && (pointer || 'ontouchstart' in window ||
		(window.DocumentTouch && document instanceof window.DocumentTouch));

	L.Browser = {
		ie: ie,
		ielt9: ielt9,
		webkit: webkit,
		gecko: gecko && !webkit && !window.opera && !ie,

		android: android,
		android23: android23,

		chrome: chrome,

		ie3d: ie3d,
		webkit3d: webkit3d,
		gecko3d: gecko3d,
		opera3d: opera3d,
		any3d: any3d,

		mobile: mobile,
		mobileWebkit: mobile && webkit,
		mobileWebkit3d: mobile && webkit3d,
		mobileOpera: mobile && window.opera,

		touch: touch,
		msPointer: msPointer,
		pointer: pointer,

		retina: retina
	};

}());


/*
 * L.Point represents a point with x and y coordinates.
 */

L.Point = function (/*Number*/ x, /*Number*/ y, /*Boolean*/ round) {
	this.x = (round ? Math.round(x) : x);
	this.y = (round ? Math.round(y) : y);
};

L.Point.prototype = {

	clone: function () {
		return new L.Point(this.x, this.y);
	},

	// non-destructive, returns a new point
	add: function (point) {
		return this.clone()._add(L.point(point));
	},

	// destructive, used directly for performance in situations where it's safe to modify existing point
	_add: function (point) {
		this.x += point.x;
		this.y += point.y;
		return this;
	},

	subtract: function (point) {
		return this.clone()._subtract(L.point(point));
	},

	_subtract: function (point) {
		this.x -= point.x;
		this.y -= point.y;
		return this;
	},

	divideBy: function (num) {
		return this.clone()._divideBy(num);
	},

	_divideBy: function (num) {
		this.x /= num;
		this.y /= num;
		return this;
	},

	multiplyBy: function (num) {
		return this.clone()._multiplyBy(num);
	},

	_multiplyBy: function (num) {
		this.x *= num;
		this.y *= num;
		return this;
	},

	round: function () {
		return this.clone()._round();
	},

	_round: function () {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	},

	floor: function () {
		return this.clone()._floor();
	},

	_floor: function () {
		this.x = Math.floor(this.x);
		this.y = Math.floor(this.y);
		return this;
	},

	distanceTo: function (point) {
		point = L.point(point);

		var x = point.x - this.x,
		    y = point.y - this.y;

		return Math.sqrt(x * x + y * y);
	},

	equals: function (point) {
		point = L.point(point);

		return point.x === this.x &&
		       point.y === this.y;
	},

	contains: function (point) {
		point = L.point(point);

		return Math.abs(point.x) <= Math.abs(this.x) &&
		       Math.abs(point.y) <= Math.abs(this.y);
	},

	toString: function () {
		return 'Point(' +
		        L.Util.formatNum(this.x) + ', ' +
		        L.Util.formatNum(this.y) + ')';
	}
};

L.point = function (x, y, round) {
	if (x instanceof L.Point) {
		return x;
	}
	if (L.Util.isArray(x)) {
		return new L.Point(x[0], x[1]);
	}
	if (x === undefined || x === null) {
		return x;
	}
	return new L.Point(x, y, round);
};


/*
 * L.Bounds represents a rectangular area on the screen in pixel coordinates.
 */

L.Bounds = function (a, b) { //(Point, Point) or Point[]
	if (!a) { return; }

	var points = b ? [a, b] : a;

	for (var i = 0, len = points.length; i < len; i++) {
		this.extend(points[i]);
	}
};

L.Bounds.prototype = {
	// extend the bounds to contain the given point
	extend: function (point) { // (Point)
		point = L.point(point);

		if (!this.min && !this.max) {
			this.min = point.clone();
			this.max = point.clone();
		} else {
			this.min.x = Math.min(point.x, this.min.x);
			this.max.x = Math.max(point.x, this.max.x);
			this.min.y = Math.min(point.y, this.min.y);
			this.max.y = Math.max(point.y, this.max.y);
		}
		return this;
	},

	getCenter: function (round) { // (Boolean) -> Point
		return new L.Point(
		        (this.min.x + this.max.x) / 2,
		        (this.min.y + this.max.y) / 2, round);
	},

	getBottomLeft: function () { // -> Point
		return new L.Point(this.min.x, this.max.y);
	},

	getTopRight: function () { // -> Point
		return new L.Point(this.max.x, this.min.y);
	},

	getSize: function () {
		return this.max.subtract(this.min);
	},

	contains: function (obj) { // (Bounds) or (Point) -> Boolean
		var min, max;

		if (typeof obj[0] === 'number' || obj instanceof L.Point) {
			obj = L.point(obj);
		} else {
			obj = L.bounds(obj);
		}

		if (obj instanceof L.Bounds) {
			min = obj.min;
			max = obj.max;
		} else {
			min = max = obj;
		}

		return (min.x >= this.min.x) &&
		       (max.x <= this.max.x) &&
		       (min.y >= this.min.y) &&
		       (max.y <= this.max.y);
	},

	intersects: function (bounds) { // (Bounds) -> Boolean
		bounds = L.bounds(bounds);

		var min = this.min,
		    max = this.max,
		    min2 = bounds.min,
		    max2 = bounds.max,
		    xIntersects = (max2.x >= min.x) && (min2.x <= max.x),
		    yIntersects = (max2.y >= min.y) && (min2.y <= max.y);

		return xIntersects && yIntersects;
	},

	isValid: function () {
		return !!(this.min && this.max);
	}
};

L.bounds = function (a, b) { // (Bounds) or (Point, Point) or (Point[])
	if (!a || a instanceof L.Bounds) {
		return a;
	}
	return new L.Bounds(a, b);
};


/*
 * L.Transformation is an utility class to perform simple point transformations through a 2d-matrix.
 */

L.Transformation = function (a, b, c, d) {
	this._a = a;
	this._b = b;
	this._c = c;
	this._d = d;
};

L.Transformation.prototype = {
	transform: function (point, scale) { // (Point, Number) -> Point
		return this._transform(point.clone(), scale);
	},

	// destructive transform (faster)
	_transform: function (point, scale) {
		scale = scale || 1;
		point.x = scale * (this._a * point.x + this._b);
		point.y = scale * (this._c * point.y + this._d);
		return point;
	},

	untransform: function (point, scale) {
		scale = scale || 1;
		return new L.Point(
		        (point.x / scale - this._b) / this._a,
		        (point.y / scale - this._d) / this._c);
	}
};


/*
 * L.DomUtil contains various utility functions for working with DOM.
 */

L.DomUtil = {
	get: function (id) {
		return (typeof id === 'string' ? document.getElementById(id) : id);
	},

	getStyle: function (el, style) {

		var value = el.style[style];

		if (!value && el.currentStyle) {
			value = el.currentStyle[style];
		}

		if ((!value || value === 'auto') && document.defaultView) {
			var css = document.defaultView.getComputedStyle(el, null);
			value = css ? css[style] : null;
		}

		return value === 'auto' ? null : value;
	},

	getViewportOffset: function (element) {

		var top = 0,
		    left = 0,
		    el = element,
		    docBody = document.body,
		    docEl = document.documentElement,
		    pos;

		do {
			top  += el.offsetTop  || 0;
			left += el.offsetLeft || 0;

			//add borders
			top += parseInt(L.DomUtil.getStyle(el, 'borderTopWidth'), 10) || 0;
			left += parseInt(L.DomUtil.getStyle(el, 'borderLeftWidth'), 10) || 0;

			pos = L.DomUtil.getStyle(el, 'position');

			if (el.offsetParent === docBody && pos === 'absolute') { break; }

			if (pos === 'fixed') {
				top  += docBody.scrollTop  || docEl.scrollTop  || 0;
				left += docBody.scrollLeft || docEl.scrollLeft || 0;
				break;
			}

			if (pos === 'relative' && !el.offsetLeft) {
				var width = L.DomUtil.getStyle(el, 'width'),
				    maxWidth = L.DomUtil.getStyle(el, 'max-width'),
				    r = el.getBoundingClientRect();

				if (width !== 'none' || maxWidth !== 'none') {
					left += r.left + el.clientLeft;
				}

				//calculate full y offset since we're breaking out of the loop
				top += r.top + (docBody.scrollTop  || docEl.scrollTop  || 0);

				break;
			}

			el = el.offsetParent;

		} while (el);

		el = element;

		do {
			if (el === docBody) { break; }

			top  -= el.scrollTop  || 0;
			left -= el.scrollLeft || 0;

			el = el.parentNode;
		} while (el);

		return new L.Point(left, top);
	},

	documentIsLtr: function () {
		if (!L.DomUtil._docIsLtrCached) {
			L.DomUtil._docIsLtrCached = true;
			L.DomUtil._docIsLtr = L.DomUtil.getStyle(document.body, 'direction') === 'ltr';
		}
		return L.DomUtil._docIsLtr;
	},

	create: function (tagName, className, container) {

		var el = document.createElement(tagName);
		el.className = className;

		if (container) {
			container.appendChild(el);
		}

		return el;
	},

	hasClass: function (el, name) {
		if (el.classList !== undefined) {
			return el.classList.contains(name);
		}
		var className = L.DomUtil._getClass(el);
		return className.length > 0 && new RegExp('(^|\\s)' + name + '(\\s|$)').test(className);
	},

	addClass: function (el, name) {
		if (el.classList !== undefined) {
			var classes = L.Util.splitWords(name);
			for (var i = 0, len = classes.length; i < len; i++) {
				el.classList.add(classes[i]);
			}
		} else if (!L.DomUtil.hasClass(el, name)) {
			var className = L.DomUtil._getClass(el);
			L.DomUtil._setClass(el, (className ? className + ' ' : '') + name);
		}
	},

	removeClass: function (el, name) {
		if (el.classList !== undefined) {
			el.classList.remove(name);
		} else {
			L.DomUtil._setClass(el, L.Util.trim((' ' + L.DomUtil._getClass(el) + ' ').replace(' ' + name + ' ', ' ')));
		}
	},

	_setClass: function (el, name) {
		if (el.className.baseVal === undefined) {
			el.className = name;
		} else {
			// in case of SVG element
			el.className.baseVal = name;
		}
	},

	_getClass: function (el) {
		return el.className.baseVal === undefined ? el.className : el.className.baseVal;
	},

	setOpacity: function (el, value) {

		if ('opacity' in el.style) {
			el.style.opacity = value;

		} else if ('filter' in el.style) {

			var filter = false,
			    filterName = 'DXImageTransform.Microsoft.Alpha';

			// filters collection throws an error if we try to retrieve a filter that doesn't exist
			try {
				filter = el.filters.item(filterName);
			} catch (e) {
				// don't set opacity to 1 if we haven't already set an opacity,
				// it isn't needed and breaks transparent pngs.
				if (value === 1) { return; }
			}

			value = Math.round(value * 100);

			if (filter) {
				filter.Enabled = (value !== 100);
				filter.Opacity = value;
			} else {
				el.style.filter += ' progid:' + filterName + '(opacity=' + value + ')';
			}
		}
	},

	testProp: function (props) {

		var style = document.documentElement.style;

		for (var i = 0; i < props.length; i++) {
			if (props[i] in style) {
				return props[i];
			}
		}
		return false;
	},

	getTranslateString: function (point) {
		// on WebKit browsers (Chrome/Safari/iOS Safari/Android) using translate3d instead of translate
		// makes animation smoother as it ensures HW accel is used. Firefox 13 doesn't care
		// (same speed either way), Opera 12 doesn't support translate3d

		var is3d = L.Browser.webkit3d,
		    open = 'translate' + (is3d ? '3d' : '') + '(',
		    close = (is3d ? ',0' : '') + ')';

		return open + point.x + 'px,' + point.y + 'px' + close;
	},

	getScaleString: function (scale, origin) {

		var preTranslateStr = L.DomUtil.getTranslateString(origin.add(origin.multiplyBy(-1 * scale))),
		    scaleStr = ' scale(' + scale + ') ';

		return preTranslateStr + scaleStr;
	},

	setPosition: function (el, point, disable3D) { // (HTMLElement, Point[, Boolean])

		// jshint camelcase: false
		el._leaflet_pos = point;

		if (!disable3D && L.Browser.any3d) {
			el.style[L.DomUtil.TRANSFORM] =  L.DomUtil.getTranslateString(point);
		} else {
			el.style.left = point.x + 'px';
			el.style.top = point.y + 'px';
		}
	},

	getPosition: function (el) {
		// this method is only used for elements previously positioned using setPosition,
		// so it's safe to cache the position for performance

		// jshint camelcase: false
		return el._leaflet_pos;
	}
};


// prefix style property names

L.DomUtil.TRANSFORM = L.DomUtil.testProp(
        ['transform', 'WebkitTransform', 'OTransform', 'MozTransform', 'msTransform']);

// webkitTransition comes first because some browser versions that drop vendor prefix don't do
// the same for the transitionend event, in particular the Android 4.1 stock browser

L.DomUtil.TRANSITION = L.DomUtil.testProp(
        ['webkitTransition', 'transition', 'OTransition', 'MozTransition', 'msTransition']);

L.DomUtil.TRANSITION_END =
        L.DomUtil.TRANSITION === 'webkitTransition' || L.DomUtil.TRANSITION === 'OTransition' ?
        L.DomUtil.TRANSITION + 'End' : 'transitionend';

(function () {
    if ('onselectstart' in document) {
        L.extend(L.DomUtil, {
            disableTextSelection: function () {
                L.DomEvent.on(window, 'selectstart', L.DomEvent.preventDefault);
            },

            enableTextSelection: function () {
                L.DomEvent.off(window, 'selectstart', L.DomEvent.preventDefault);
            }
        });
    } else {
        var userSelectProperty = L.DomUtil.testProp(
            ['userSelect', 'WebkitUserSelect', 'OUserSelect', 'MozUserSelect', 'msUserSelect']);

        L.extend(L.DomUtil, {
            disableTextSelection: function () {
                if (userSelectProperty) {
                    var style = document.documentElement.style;
                    this._userSelect = style[userSelectProperty];
                    style[userSelectProperty] = 'none';
                }
            },

            enableTextSelection: function () {
                if (userSelectProperty) {
                    document.documentElement.style[userSelectProperty] = this._userSelect;
                    delete this._userSelect;
                }
            }
        });
    }

	L.extend(L.DomUtil, {
		disableImageDrag: function () {
			L.DomEvent.on(window, 'dragstart', L.DomEvent.preventDefault);
		},

		enableImageDrag: function () {
			L.DomEvent.off(window, 'dragstart', L.DomEvent.preventDefault);
		}
	});
})();


/*
 * L.LatLng represents a geographical point with latitude and longitude coordinates.
 */

L.LatLng = function (lat, lng, alt) { // (Number, Number, Number)
	lat = parseFloat(lat);
	lng = parseFloat(lng);

	if (isNaN(lat) || isNaN(lng)) {
		throw new Error('Invalid LatLng object: (' + lat + ', ' + lng + ')');
	}

	this.lat = lat;
	this.lng = lng;

	if (alt !== undefined) {
		this.alt = parseFloat(alt);
	}
};

L.extend(L.LatLng, {
	DEG_TO_RAD: Math.PI / 180,
	RAD_TO_DEG: 180 / Math.PI,
	MAX_MARGIN: 1.0E-9 // max margin of error for the "equals" check
});

L.LatLng.prototype = {
	equals: function (obj) { // (LatLng) -> Boolean
		if (!obj) { return false; }

		obj = L.latLng(obj);

		var margin = Math.max(
		        Math.abs(this.lat - obj.lat),
		        Math.abs(this.lng - obj.lng));

		return margin <= L.LatLng.MAX_MARGIN;
	},

	toString: function (precision) { // (Number) -> String
		return 'LatLng(' +
		        L.Util.formatNum(this.lat, precision) + ', ' +
		        L.Util.formatNum(this.lng, precision) + ')';
	},

	// Haversine distance formula, see http://en.wikipedia.org/wiki/Haversine_formula
	// TODO move to projection code, LatLng shouldn't know about Earth
	distanceTo: function (other) { // (LatLng) -> Number
		other = L.latLng(other);

		var R = 6378137, // earth radius in meters
		    d2r = L.LatLng.DEG_TO_RAD,
		    dLat = (other.lat - this.lat) * d2r,
		    dLon = (other.lng - this.lng) * d2r,
		    lat1 = this.lat * d2r,
		    lat2 = other.lat * d2r,
		    sin1 = Math.sin(dLat / 2),
		    sin2 = Math.sin(dLon / 2);

		var a = sin1 * sin1 + sin2 * sin2 * Math.cos(lat1) * Math.cos(lat2);

		return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	},

	wrap: function (a, b) { // (Number, Number) -> LatLng
		var lng = this.lng;

		a = a || -180;
		b = b ||  180;

		lng = (lng + b) % (b - a) + (lng < a || lng === b ? b : a);

		return new L.LatLng(this.lat, lng);
	}
};

L.latLng = function (a, b) { // (LatLng) or ([Number, Number]) or (Number, Number)
	if (a instanceof L.LatLng) {
		return a;
	}
	if (L.Util.isArray(a)) {
		if (typeof a[0] === 'number' || typeof a[0] === 'string') {
			return new L.LatLng(a[0], a[1], a[2]);
		} else {
			return null;
		}
	}
	if (a === undefined || a === null) {
		return a;
	}
	if (typeof a === 'object' && 'lat' in a) {
		return new L.LatLng(a.lat, 'lng' in a ? a.lng : a.lon);
	}
	if (b === undefined) {
		return null;
	}
	return new L.LatLng(a, b);
};



/*
 * L.LatLngBounds represents a rectangular area on the map in geographical coordinates.
 */

L.LatLngBounds = function (southWest, northEast) { // (LatLng, LatLng) or (LatLng[])
	if (!southWest) { return; }

	var latlngs = northEast ? [southWest, northEast] : southWest;

	for (var i = 0, len = latlngs.length; i < len; i++) {
		this.extend(latlngs[i]);
	}
};

L.LatLngBounds.prototype = {
	// extend the bounds to contain the given point or bounds
	extend: function (obj) { // (LatLng) or (LatLngBounds)
		if (!obj) { return this; }

		var latLng = L.latLng(obj);
		if (latLng !== null) {
			obj = latLng;
		} else {
			obj = L.latLngBounds(obj);
		}

		if (obj instanceof L.LatLng) {
			if (!this._southWest && !this._northEast) {
				this._southWest = new L.LatLng(obj.lat, obj.lng);
				this._northEast = new L.LatLng(obj.lat, obj.lng);
			} else {
				this._southWest.lat = Math.min(obj.lat, this._southWest.lat);
				this._southWest.lng = Math.min(obj.lng, this._southWest.lng);

				this._northEast.lat = Math.max(obj.lat, this._northEast.lat);
				this._northEast.lng = Math.max(obj.lng, this._northEast.lng);
			}
		} else if (obj instanceof L.LatLngBounds) {
			this.extend(obj._southWest);
			this.extend(obj._northEast);
		}
		return this;
	},

	// extend the bounds by a percentage
	pad: function (bufferRatio) { // (Number) -> LatLngBounds
		var sw = this._southWest,
		    ne = this._northEast,
		    heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio,
		    widthBuffer = Math.abs(sw.lng - ne.lng) * bufferRatio;

		return new L.LatLngBounds(
		        new L.LatLng(sw.lat - heightBuffer, sw.lng - widthBuffer),
		        new L.LatLng(ne.lat + heightBuffer, ne.lng + widthBuffer));
	},

	getCenter: function () { // -> LatLng
		return new L.LatLng(
		        (this._southWest.lat + this._northEast.lat) / 2,
		        (this._southWest.lng + this._northEast.lng) / 2);
	},

	getSouthWest: function () {
		return this._southWest;
	},

	getNorthEast: function () {
		return this._northEast;
	},

	getNorthWest: function () {
		return new L.LatLng(this.getNorth(), this.getWest());
	},

	getSouthEast: function () {
		return new L.LatLng(this.getSouth(), this.getEast());
	},

	getWest: function () {
		return this._southWest.lng;
	},

	getSouth: function () {
		return this._southWest.lat;
	},

	getEast: function () {
		return this._northEast.lng;
	},

	getNorth: function () {
		return this._northEast.lat;
	},

	contains: function (obj) { // (LatLngBounds) or (LatLng) -> Boolean
		if (typeof obj[0] === 'number' || obj instanceof L.LatLng) {
			obj = L.latLng(obj);
		} else {
			obj = L.latLngBounds(obj);
		}

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2, ne2;

		if (obj instanceof L.LatLngBounds) {
			sw2 = obj.getSouthWest();
			ne2 = obj.getNorthEast();
		} else {
			sw2 = ne2 = obj;
		}

		return (sw2.lat >= sw.lat) && (ne2.lat <= ne.lat) &&
		       (sw2.lng >= sw.lng) && (ne2.lng <= ne.lng);
	},

	intersects: function (bounds) { // (LatLngBounds)
		bounds = L.latLngBounds(bounds);

		var sw = this._southWest,
		    ne = this._northEast,
		    sw2 = bounds.getSouthWest(),
		    ne2 = bounds.getNorthEast(),

		    latIntersects = (ne2.lat >= sw.lat) && (sw2.lat <= ne.lat),
		    lngIntersects = (ne2.lng >= sw.lng) && (sw2.lng <= ne.lng);

		return latIntersects && lngIntersects;
	},

	toBBoxString: function () {
		return [this.getWest(), this.getSouth(), this.getEast(), this.getNorth()].join(',');
	},

	equals: function (bounds) { // (LatLngBounds)
		if (!bounds) { return false; }

		bounds = L.latLngBounds(bounds);

		return this._southWest.equals(bounds.getSouthWest()) &&
		       this._northEast.equals(bounds.getNorthEast());
	},

	isValid: function () {
		return !!(this._southWest && this._northEast);
	}
};

//TODO International date line?

L.latLngBounds = function (a, b) { // (LatLngBounds) or (LatLng, LatLng)
	if (!a || a instanceof L.LatLngBounds) {
		return a;
	}
	return new L.LatLngBounds(a, b);
};


/*
 * L.Projection contains various geographical projections used by CRS classes.
 */

L.Projection = {};


/*
 * Spherical Mercator is the most popular map projection, used by EPSG:3857 CRS used by default.
 */

L.Projection.SphericalMercator = {
	MAX_LATITUDE: 85.0511287798,

	project: function (latlng) { // (LatLng) -> Point
		var d = L.LatLng.DEG_TO_RAD,
		    max = this.MAX_LATITUDE,
		    lat = Math.max(Math.min(max, latlng.lat), -max),
		    x = latlng.lng * d,
		    y = lat * d;

		y = Math.log(Math.tan((Math.PI / 4) + (y / 2)));

		return new L.Point(x, y);
	},

	unproject: function (point) { // (Point, Boolean) -> LatLng
		var d = L.LatLng.RAD_TO_DEG,
		    lng = point.x * d,
		    lat = (2 * Math.atan(Math.exp(point.y)) - (Math.PI / 2)) * d;

		return new L.LatLng(lat, lng);
	}
};


/*
 * Simple equirectangular (Plate Carree) projection, used by CRS like EPSG:4326 and Simple.
 */

L.Projection.LonLat = {
	project: function (latlng) {
		return new L.Point(latlng.lng, latlng.lat);
	},

	unproject: function (point) {
		return new L.LatLng(point.y, point.x);
	}
};


/*
 * L.CRS is a base object for all defined CRS (Coordinate Reference Systems) in Leaflet.
 */

L.CRS = {
	latLngToPoint: function (latlng, zoom) { // (LatLng, Number) -> Point
		var projectedPoint = this.projection.project(latlng),
		    scale = this.scale(zoom);

		return this.transformation._transform(projectedPoint, scale);
	},

	pointToLatLng: function (point, zoom) { // (Point, Number[, Boolean]) -> LatLng
		var scale = this.scale(zoom),
		    untransformedPoint = this.transformation.untransform(point, scale);

		return this.projection.unproject(untransformedPoint);
	},

	project: function (latlng) {
		return this.projection.project(latlng);
	},

	scale: function (zoom) {
		return 256 * Math.pow(2, zoom);
	},

	getSize: function (zoom) {
		var s = this.scale(zoom);
		return L.point(s, s);
	}
};


/*
 * A simple CRS that can be used for flat non-Earth maps like panoramas or game maps.
 */

L.CRS.Simple = L.extend({}, L.CRS, {
	projection: L.Projection.LonLat,
	transformation: new L.Transformation(1, 0, -1, 0),

	scale: function (zoom) {
		return Math.pow(2, zoom);
	}
});


/*
 * L.CRS.EPSG3857 (Spherical Mercator) is the most common CRS for web mapping
 * and is used by Leaflet by default.
 */

L.CRS.EPSG3857 = L.extend({}, L.CRS, {
	code: 'EPSG:3857',

	projection: L.Projection.SphericalMercator,
	transformation: new L.Transformation(0.5 / Math.PI, 0.5, -0.5 / Math.PI, 0.5),

	project: function (latlng) { // (LatLng) -> Point
		var projectedPoint = this.projection.project(latlng),
		    earthRadius = 6378137;
		return projectedPoint.multiplyBy(earthRadius);
	}
});

L.CRS.EPSG900913 = L.extend({}, L.CRS.EPSG3857, {
	code: 'EPSG:900913'
});


/*
 * L.CRS.EPSG4326 is a CRS popular among advanced GIS specialists.
 */

L.CRS.EPSG4326 = L.extend({}, L.CRS, {
	code: 'EPSG:4326',

	projection: L.Projection.LonLat,
	transformation: new L.Transformation(1 / 360, 0.5, -1 / 360, 0.5)
});


/*
 * L.Map is the central class of the API - it is used to create a map.
 */

L.Map = L.Class.extend({

	includes: L.Mixin.Events,

	options: {
		crs: L.CRS.EPSG3857,

		/*
		center: LatLng,
		zoom: Number,
		layers: Array,
		*/

		fadeAnimation: L.DomUtil.TRANSITION && !L.Browser.android23,
		trackResize: true,
		markerZoomAnimation: L.DomUtil.TRANSITION && L.Browser.any3d
	},

	initialize: function (id, options) { // (HTMLElement or String, Object)
		options = L.setOptions(this, options);


		this._initContainer(id);
		this._initLayout();

		// hack for https://github.com/Leaflet/Leaflet/issues/1980
		this._onResize = L.bind(this._onResize, this);

		this._initEvents();

		if (options.maxBounds) {
			this.setMaxBounds(options.maxBounds);
		}

		if (options.center && options.zoom !== undefined) {
			this.setView(L.latLng(options.center), options.zoom, {reset: true});
		}

		this._handlers = [];

		this._layers = {};
		this._zoomBoundLayers = {};
		this._tileLayersNum = 0;

		this.callInitHooks();

		this._addLayers(options.layers);
	},


	// public methods that modify map state

	// replaced by animation-powered implementation in Map.PanAnimation.js
	setView: function (center, zoom) {
		zoom = zoom === undefined ? this.getZoom() : zoom;
		this._resetView(L.latLng(center), this._limitZoom(zoom));
		return this;
	},

	setZoom: function (zoom, options) {
		if (!this._loaded) {
			this._zoom = this._limitZoom(zoom);
			return this;
		}
		return this.setView(this.getCenter(), zoom, {zoom: options});
	},

	zoomIn: function (delta, options) {
		return this.setZoom(this._zoom + (delta || 1), options);
	},

	zoomOut: function (delta, options) {
		return this.setZoom(this._zoom - (delta || 1), options);
	},

	setZoomAround: function (latlng, zoom, options) {
		var scale = this.getZoomScale(zoom),
		    viewHalf = this.getSize().divideBy(2),
		    containerPoint = latlng instanceof L.Point ? latlng : this.latLngToContainerPoint(latlng),

		    centerOffset = containerPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale),
		    newCenter = this.containerPointToLatLng(viewHalf.add(centerOffset));

		return this.setView(newCenter, zoom, {zoom: options});
	},

	fitBounds: function (bounds, options) {

		options = options || {};
		bounds = bounds.getBounds ? bounds.getBounds() : L.latLngBounds(bounds);

		var paddingTL = L.point(options.paddingTopLeft || options.padding || [0, 0]),
		    paddingBR = L.point(options.paddingBottomRight || options.padding || [0, 0]),

		    zoom = this.getBoundsZoom(bounds, false, paddingTL.add(paddingBR));

		zoom = (options.maxZoom) ? Math.min(options.maxZoom, zoom) : zoom;

		var paddingOffset = paddingBR.subtract(paddingTL).divideBy(2),

		    swPoint = this.project(bounds.getSouthWest(), zoom),
		    nePoint = this.project(bounds.getNorthEast(), zoom),
		    center = this.unproject(swPoint.add(nePoint).divideBy(2).add(paddingOffset), zoom);

		return this.setView(center, zoom, options);
	},

	fitWorld: function (options) {
		return this.fitBounds([[-90, -180], [90, 180]], options);
	},

	panTo: function (center, options) { // (LatLng)
		return this.setView(center, this._zoom, {pan: options});
	},

	panBy: function (offset) { // (Point)
		// replaced with animated panBy in Map.PanAnimation.js
		this.fire('movestart');

		this._rawPanBy(L.point(offset));

		this.fire('move');
		return this.fire('moveend');
	},

	setMaxBounds: function (bounds) {
		bounds = L.latLngBounds(bounds);

		this.options.maxBounds = bounds;

		if (!bounds) {
			return this.off('moveend', this._panInsideMaxBounds, this);
		}

		if (this._loaded) {
			this._panInsideMaxBounds();
		}

		return this.on('moveend', this._panInsideMaxBounds, this);
	},

	panInsideBounds: function (bounds, options) {
		var center = this.getCenter(),
			newCenter = this._limitCenter(center, this._zoom, bounds);

		if (center.equals(newCenter)) { return this; }

		return this.panTo(newCenter, options);
	},

	addLayer: function (layer) {
		// TODO method is too big, refactor

		var id = L.stamp(layer);

		if (this._layers[id]) { return this; }

		this._layers[id] = layer;

		// TODO getMaxZoom, getMinZoom in ILayer (instead of options)
		if (layer.options && (!isNaN(layer.options.maxZoom) || !isNaN(layer.options.minZoom))) {
			this._zoomBoundLayers[id] = layer;
			this._updateZoomLevels();
		}

		// TODO looks ugly, refactor!!!
		if (this.options.zoomAnimation && L.TileLayer && (layer instanceof L.TileLayer)) {
			this._tileLayersNum++;
			this._tileLayersToLoad++;
			layer.on('load', this._onTileLayerLoad, this);
		}

		if (this._loaded) {
			this._layerAdd(layer);
		}

		return this;
	},

	removeLayer: function (layer) {
		var id = L.stamp(layer);

		if (!this._layers[id]) { return this; }

		if (this._loaded) {
			layer.onRemove(this);
		}

		delete this._layers[id];

		if (this._loaded) {
			this.fire('layerremove', {layer: layer});
		}

		if (this._zoomBoundLayers[id]) {
			delete this._zoomBoundLayers[id];
			this._updateZoomLevels();
		}

		// TODO looks ugly, refactor
		if (this.options.zoomAnimation && L.TileLayer && (layer instanceof L.TileLayer)) {
			this._tileLayersNum--;
			this._tileLayersToLoad--;
			layer.off('load', this._onTileLayerLoad, this);
		}

		return this;
	},

	hasLayer: function (layer) {
		if (!layer) { return false; }

		return (L.stamp(layer) in this._layers);
	},

	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	invalidateSize: function (options) {
		if (!this._loaded) { return this; }

		options = L.extend({
			animate: false,
			pan: true
		}, options === true ? {animate: true} : options);

		var oldSize = this.getSize();
		this._sizeChanged = true;
		this._initialCenter = null;

		var newSize = this.getSize(),
		    oldCenter = oldSize.divideBy(2).round(),
		    newCenter = newSize.divideBy(2).round(),
		    offset = oldCenter.subtract(newCenter);

		if (!offset.x && !offset.y) { return this; }

		if (options.animate && options.pan) {
			this.panBy(offset);

		} else {
			if (options.pan) {
				this._rawPanBy(offset);
			}

			this.fire('move');

			if (options.debounceMoveend) {
				clearTimeout(this._sizeTimer);
				this._sizeTimer = setTimeout(L.bind(this.fire, this, 'moveend'), 200);
			} else {
				this.fire('moveend');
			}
		}

		return this.fire('resize', {
			oldSize: oldSize,
			newSize: newSize
		});
	},

	// TODO handler.addTo
	addHandler: function (name, HandlerClass) {
		if (!HandlerClass) { return this; }

		var handler = this[name] = new HandlerClass(this);

		this._handlers.push(handler);

		if (this.options[name]) {
			handler.enable();
		}

		return this;
	},

	remove: function () {
		if (this._loaded) {
			this.fire('unload');
		}

		this._initEvents('off');

		try {
			// throws error in IE6-8
			delete this._container._leaflet;
		} catch (e) {
			this._container._leaflet = undefined;
		}

		this._clearPanes();
		if (this._clearControlPos) {
			this._clearControlPos();
		}

		this._clearHandlers();

		return this;
	},


	// public methods for getting map state

	getCenter: function () { // (Boolean) -> LatLng
		this._checkIfLoaded();

		if (this._initialCenter && !this._moved()) {
			return this._initialCenter;
		}
		return this.layerPointToLatLng(this._getCenterLayerPoint());
	},

	getZoom: function () {
		return this._zoom;
	},

	getBounds: function () {
		var bounds = this.getPixelBounds(),
		    sw = this.unproject(bounds.getBottomLeft()),
		    ne = this.unproject(bounds.getTopRight());

		return new L.LatLngBounds(sw, ne);
	},

	getMinZoom: function () {
		return this.options.minZoom === undefined ?
			(this._layersMinZoom === undefined ? 0 : this._layersMinZoom) :
			this.options.minZoom;
	},

	getMaxZoom: function () {
		return this.options.maxZoom === undefined ?
			(this._layersMaxZoom === undefined ? Infinity : this._layersMaxZoom) :
			this.options.maxZoom;
	},

	getBoundsZoom: function (bounds, inside, padding) { // (LatLngBounds[, Boolean, Point]) -> Number
		bounds = L.latLngBounds(bounds);

		var zoom = this.getMinZoom() - (inside ? 1 : 0),
		    maxZoom = this.getMaxZoom(),
		    size = this.getSize(),

		    nw = bounds.getNorthWest(),
		    se = bounds.getSouthEast(),

		    zoomNotFound = true,
		    boundsSize;

		padding = L.point(padding || [0, 0]);

		do {
			zoom++;
			boundsSize = this.project(se, zoom).subtract(this.project(nw, zoom)).add(padding);
			zoomNotFound = !inside ? size.contains(boundsSize) : boundsSize.x < size.x || boundsSize.y < size.y;

		} while (zoomNotFound && zoom <= maxZoom);

		if (zoomNotFound && inside) {
			return null;
		}

		return inside ? zoom : zoom - 1;
	},

	getSize: function () {
		if (!this._size || this._sizeChanged) {
			this._size = new L.Point(
				this._container.clientWidth,
				this._container.clientHeight);

			this._sizeChanged = false;
		}
		return this._size.clone();
	},

	getPixelBounds: function () {
		var topLeftPoint = this._getTopLeftPoint();
		return new L.Bounds(topLeftPoint, topLeftPoint.add(this.getSize()));
	},

	getPixelOrigin: function () {
		this._checkIfLoaded();
		return this._initialTopLeftPoint;
	},

	getPanes: function () {
		return this._panes;
	},

	getContainer: function () {
		return this._container;
	},


	// TODO replace with universal implementation after refactoring projections

	getZoomScale: function (toZoom) {
		var crs = this.options.crs;
		return crs.scale(toZoom) / crs.scale(this._zoom);
	},

	getScaleZoom: function (scale) {
		return this._zoom + (Math.log(scale) / Math.LN2);
	},


	// conversion methods

	project: function (latlng, zoom) { // (LatLng[, Number]) -> Point
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.latLngToPoint(L.latLng(latlng), zoom);
	},

	unproject: function (point, zoom) { // (Point[, Number]) -> LatLng
		zoom = zoom === undefined ? this._zoom : zoom;
		return this.options.crs.pointToLatLng(L.point(point), zoom);
	},

	layerPointToLatLng: function (point) { // (Point)
		var projectedPoint = L.point(point).add(this.getPixelOrigin());
		return this.unproject(projectedPoint);
	},

	latLngToLayerPoint: function (latlng) { // (LatLng)
		var projectedPoint = this.project(L.latLng(latlng))._round();
		return projectedPoint._subtract(this.getPixelOrigin());
	},

	containerPointToLayerPoint: function (point) { // (Point)
		return L.point(point).subtract(this._getMapPanePos());
	},

	layerPointToContainerPoint: function (point) { // (Point)
		return L.point(point).add(this._getMapPanePos());
	},

	containerPointToLatLng: function (point) {
		var layerPoint = this.containerPointToLayerPoint(L.point(point));
		return this.layerPointToLatLng(layerPoint);
	},

	latLngToContainerPoint: function (latlng) {
		return this.layerPointToContainerPoint(this.latLngToLayerPoint(L.latLng(latlng)));
	},

	mouseEventToContainerPoint: function (e) { // (MouseEvent)
		return L.DomEvent.getMousePosition(e, this._container);
	},

	mouseEventToLayerPoint: function (e) { // (MouseEvent)
		return this.containerPointToLayerPoint(this.mouseEventToContainerPoint(e));
	},

	mouseEventToLatLng: function (e) { // (MouseEvent)
		return this.layerPointToLatLng(this.mouseEventToLayerPoint(e));
	},


	// map initialization methods

	_initContainer: function (id) {
		var container = this._container = L.DomUtil.get(id);

		if (!container) {
			throw new Error('Map container not found.');
		} else if (container._leaflet) {
			throw new Error('Map container is already initialized.');
		}

		container._leaflet = true;
	},

	_initLayout: function () {
		var container = this._container;

		L.DomUtil.addClass(container, 'leaflet-container' +
			(L.Browser.touch ? ' leaflet-touch' : '') +
			(L.Browser.retina ? ' leaflet-retina' : '') +
			(L.Browser.ielt9 ? ' leaflet-oldie' : '') +
			(this.options.fadeAnimation ? ' leaflet-fade-anim' : ''));

		var position = L.DomUtil.getStyle(container, 'position');

		if (position !== 'absolute' && position !== 'relative' && position !== 'fixed') {
			container.style.position = 'relative';
		}

		this._initPanes();

		if (this._initControlPos) {
			this._initControlPos();
		}
	},

	_initPanes: function () {
		var panes = this._panes = {};

		this._mapPane = panes.mapPane = this._createPane('leaflet-map-pane', this._container);

		this._tilePane = panes.tilePane = this._createPane('leaflet-tile-pane', this._mapPane);
		panes.objectsPane = this._createPane('leaflet-objects-pane', this._mapPane);
		panes.shadowPane = this._createPane('leaflet-shadow-pane');
		panes.overlayPane = this._createPane('leaflet-overlay-pane');
		panes.markerPane = this._createPane('leaflet-marker-pane');
		panes.popupPane = this._createPane('leaflet-popup-pane');

		var zoomHide = ' leaflet-zoom-hide';

		if (!this.options.markerZoomAnimation) {
			L.DomUtil.addClass(panes.markerPane, zoomHide);
			L.DomUtil.addClass(panes.shadowPane, zoomHide);
			L.DomUtil.addClass(panes.popupPane, zoomHide);
		}
	},

	_createPane: function (className, container) {
		return L.DomUtil.create('div', className, container || this._panes.objectsPane);
	},

	_clearPanes: function () {
		this._container.removeChild(this._mapPane);
	},

	_addLayers: function (layers) {
		layers = layers ? (L.Util.isArray(layers) ? layers : [layers]) : [];

		for (var i = 0, len = layers.length; i < len; i++) {
			this.addLayer(layers[i]);
		}
	},


	// private methods that modify map state

	_resetView: function (center, zoom, preserveMapOffset, afterZoomAnim) {

		var zoomChanged = (this._zoom !== zoom);

		if (!afterZoomAnim) {
			this.fire('movestart');

			if (zoomChanged) {
				this.fire('zoomstart');
			}
		}

		this._zoom = zoom;
		this._initialCenter = center;

		this._initialTopLeftPoint = this._getNewTopLeftPoint(center);

		if (!preserveMapOffset) {
			L.DomUtil.setPosition(this._mapPane, new L.Point(0, 0));
		} else {
			this._initialTopLeftPoint._add(this._getMapPanePos());
		}

		this._tileLayersToLoad = this._tileLayersNum;

		var loading = !this._loaded;
		this._loaded = true;

		this.fire('viewreset', {hard: !preserveMapOffset});

		if (loading) {
			this.fire('load');
			this.eachLayer(this._layerAdd, this);
		}

		this.fire('move');

		if (zoomChanged || afterZoomAnim) {
			this.fire('zoomend');
		}

		this.fire('moveend', {hard: !preserveMapOffset});
	},

	_rawPanBy: function (offset) {
		L.DomUtil.setPosition(this._mapPane, this._getMapPanePos().subtract(offset));
	},

	_getZoomSpan: function () {
		return this.getMaxZoom() - this.getMinZoom();
	},

	_updateZoomLevels: function () {
		var i,
			minZoom = Infinity,
			maxZoom = -Infinity,
			oldZoomSpan = this._getZoomSpan();

		for (i in this._zoomBoundLayers) {
			var layer = this._zoomBoundLayers[i];
			if (!isNaN(layer.options.minZoom)) {
				minZoom = Math.min(minZoom, layer.options.minZoom);
			}
			if (!isNaN(layer.options.maxZoom)) {
				maxZoom = Math.max(maxZoom, layer.options.maxZoom);
			}
		}

		if (i === undefined) { // we have no tilelayers
			this._layersMaxZoom = this._layersMinZoom = undefined;
		} else {
			this._layersMaxZoom = maxZoom;
			this._layersMinZoom = minZoom;
		}

		if (oldZoomSpan !== this._getZoomSpan()) {
			this.fire('zoomlevelschange');
		}
	},

	_panInsideMaxBounds: function () {
		this.panInsideBounds(this.options.maxBounds);
	},

	_checkIfLoaded: function () {
		if (!this._loaded) {
			throw new Error('Set map center and zoom first.');
		}
	},

	// map events

	_initEvents: function (onOff) {
		if (!L.DomEvent) { return; }

		onOff = onOff || 'on';

		L.DomEvent[onOff](this._container, 'click', this._onMouseClick, this);

		var events = ['dblclick', 'mousedown', 'mouseup', 'mouseenter',
		              'mouseleave', 'mousemove', 'contextmenu'],
		    i, len;

		for (i = 0, len = events.length; i < len; i++) {
			L.DomEvent[onOff](this._container, events[i], this._fireMouseEvent, this);
		}

		if (this.options.trackResize) {
			L.DomEvent[onOff](window, 'resize', this._onResize, this);
		}
	},

	_onResize: function () {
		L.Util.cancelAnimFrame(this._resizeRequest);
		this._resizeRequest = L.Util.requestAnimFrame(
		        function () { this.invalidateSize({debounceMoveend: true}); }, this, false, this._container);
	},

	_onMouseClick: function (e) {
		if (!this._loaded || (!e._simulated &&
		        ((this.dragging && this.dragging.moved()) ||
		         (this.boxZoom  && this.boxZoom.moved()))) ||
		            L.DomEvent._skipped(e)) { return; }

		this.fire('preclick');
		this._fireMouseEvent(e);
	},

	_fireMouseEvent: function (e) {
		if (!this._loaded || L.DomEvent._skipped(e)) { return; }

		var type = e.type;

		type = (type === 'mouseenter' ? 'mouseover' : (type === 'mouseleave' ? 'mouseout' : type));

		if (!this.hasEventListeners(type)) { return; }

		if (type === 'contextmenu') {
			L.DomEvent.preventDefault(e);
		}

		var containerPoint = this.mouseEventToContainerPoint(e),
		    layerPoint = this.containerPointToLayerPoint(containerPoint),
		    latlng = this.layerPointToLatLng(layerPoint);

		this.fire(type, {
			latlng: latlng,
			layerPoint: layerPoint,
			containerPoint: containerPoint,
			originalEvent: e
		});
	},

	_onTileLayerLoad: function () {
		this._tileLayersToLoad--;
		if (this._tileLayersNum && !this._tileLayersToLoad) {
			this.fire('tilelayersload');
		}
	},

	_clearHandlers: function () {
		for (var i = 0, len = this._handlers.length; i < len; i++) {
			this._handlers[i].disable();
		}
	},

	whenReady: function (callback, context) {
		if (this._loaded) {
			callback.call(context || this, this);
		} else {
			this.on('load', callback, context);
		}
		return this;
	},

	_layerAdd: function (layer) {
		layer.onAdd(this);
		this.fire('layeradd', {layer: layer});
	},


	// private methods for getting map state

	_getMapPanePos: function () {
		return L.DomUtil.getPosition(this._mapPane);
	},

	_moved: function () {
		var pos = this._getMapPanePos();
		return pos && !pos.equals([0, 0]);
	},

	_getTopLeftPoint: function () {
		return this.getPixelOrigin().subtract(this._getMapPanePos());
	},

	_getNewTopLeftPoint: function (center, zoom) {
		var viewHalf = this.getSize()._divideBy(2);
		// TODO round on display, not calculation to increase precision?
		return this.project(center, zoom)._subtract(viewHalf)._round();
	},

	_latLngToNewLayerPoint: function (latlng, newZoom, newCenter) {
		var topLeft = this._getNewTopLeftPoint(newCenter, newZoom).add(this._getMapPanePos());
		return this.project(latlng, newZoom)._subtract(topLeft);
	},

	// layer point of the current center
	_getCenterLayerPoint: function () {
		return this.containerPointToLayerPoint(this.getSize()._divideBy(2));
	},

	// offset of the specified place to the current center in pixels
	_getCenterOffset: function (latlng) {
		return this.latLngToLayerPoint(latlng).subtract(this._getCenterLayerPoint());
	},

	// adjust center for view to get inside bounds
	_limitCenter: function (center, zoom, bounds) {

		if (!bounds) { return center; }

		var centerPoint = this.project(center, zoom),
		    viewHalf = this.getSize().divideBy(2),
		    viewBounds = new L.Bounds(centerPoint.subtract(viewHalf), centerPoint.add(viewHalf)),
		    offset = this._getBoundsOffset(viewBounds, bounds, zoom);

		return this.unproject(centerPoint.add(offset), zoom);
	},

	// adjust offset for view to get inside bounds
	_limitOffset: function (offset, bounds) {
		if (!bounds) { return offset; }

		var viewBounds = this.getPixelBounds(),
		    newBounds = new L.Bounds(viewBounds.min.add(offset), viewBounds.max.add(offset));

		return offset.add(this._getBoundsOffset(newBounds, bounds));
	},

	// returns offset needed for pxBounds to get inside maxBounds at a specified zoom
	_getBoundsOffset: function (pxBounds, maxBounds, zoom) {
		var nwOffset = this.project(maxBounds.getNorthWest(), zoom).subtract(pxBounds.min),
		    seOffset = this.project(maxBounds.getSouthEast(), zoom).subtract(pxBounds.max),

		    dx = this._rebound(nwOffset.x, -seOffset.x),
		    dy = this._rebound(nwOffset.y, -seOffset.y);

		return new L.Point(dx, dy);
	},

	_rebound: function (left, right) {
		return left + right > 0 ?
			Math.round(left - right) / 2 :
			Math.max(0, Math.ceil(left)) - Math.max(0, Math.floor(right));
	},

	_limitZoom: function (zoom) {
		var min = this.getMinZoom(),
		    max = this.getMaxZoom();

		return Math.max(min, Math.min(max, zoom));
	}
});

L.map = function (id, options) {
	return new L.Map(id, options);
};


/*
 * Mercator projection that takes into account that the Earth is not a perfect sphere.
 * Less popular than spherical mercator; used by projections like EPSG:3395.
 */

L.Projection.Mercator = {
	MAX_LATITUDE: 85.0840591556,

	R_MINOR: 6356752.314245179,
	R_MAJOR: 6378137,

	project: function (latlng) { // (LatLng) -> Point
		var d = L.LatLng.DEG_TO_RAD,
		    max = this.MAX_LATITUDE,
		    lat = Math.max(Math.min(max, latlng.lat), -max),
		    r = this.R_MAJOR,
		    r2 = this.R_MINOR,
		    x = latlng.lng * d * r,
		    y = lat * d,
		    tmp = r2 / r,
		    eccent = Math.sqrt(1.0 - tmp * tmp),
		    con = eccent * Math.sin(y);

		con = Math.pow((1 - con) / (1 + con), eccent * 0.5);

		var ts = Math.tan(0.5 * ((Math.PI * 0.5) - y)) / con;
		y = -r * Math.log(ts);

		return new L.Point(x, y);
	},

	unproject: function (point) { // (Point, Boolean) -> LatLng
		var d = L.LatLng.RAD_TO_DEG,
		    r = this.R_MAJOR,
		    r2 = this.R_MINOR,
		    lng = point.x * d / r,
		    tmp = r2 / r,
		    eccent = Math.sqrt(1 - (tmp * tmp)),
		    ts = Math.exp(- point.y / r),
		    phi = (Math.PI / 2) - 2 * Math.atan(ts),
		    numIter = 15,
		    tol = 1e-7,
		    i = numIter,
		    dphi = 0.1,
		    con;

		while ((Math.abs(dphi) > tol) && (--i > 0)) {
			con = eccent * Math.sin(phi);
			dphi = (Math.PI / 2) - 2 * Math.atan(ts *
			            Math.pow((1.0 - con) / (1.0 + con), 0.5 * eccent)) - phi;
			phi += dphi;
		}

		return new L.LatLng(phi * d, lng);
	}
};



L.CRS.EPSG3395 = L.extend({}, L.CRS, {
	code: 'EPSG:3395',

	projection: L.Projection.Mercator,

	transformation: (function () {
		var m = L.Projection.Mercator,
		    r = m.R_MAJOR,
		    scale = 0.5 / (Math.PI * r);

		return new L.Transformation(scale, 0.5, -scale, 0.5);
	}())
});


/*
 * L.TileLayer is used for standard xyz-numbered tile layers.
 */

L.TileLayer = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		minZoom: 0,
		maxZoom: 18,
		tileSize: 256,
		subdomains: 'abc',
		errorTileUrl: '',
		attribution: '',
		zoomOffset: 0,
		opacity: 1,
		/*
		maxNativeZoom: null,
		zIndex: null,
		tms: false,
		continuousWorld: false,
		noWrap: false,
		zoomReverse: false,
		detectRetina: false,
		reuseTiles: false,
		bounds: false,
		*/
		unloadInvisibleTiles: L.Browser.mobile,
		updateWhenIdle: L.Browser.mobile
	},

	initialize: function (url, options) {
		options = L.setOptions(this, options);

		// detecting retina displays, adjusting tileSize and zoom levels
		if (options.detectRetina && L.Browser.retina && options.maxZoom > 0) {

			options.tileSize = Math.floor(options.tileSize / 2);
			options.zoomOffset++;

			if (options.minZoom > 0) {
				options.minZoom--;
			}
			this.options.maxZoom--;
		}

		if (options.bounds) {
			options.bounds = L.latLngBounds(options.bounds);
		}

		this._url = url;

		var subdomains = this.options.subdomains;

		if (typeof subdomains === 'string') {
			this.options.subdomains = subdomains.split('');
		}
	},

	onAdd: function (map) {
		this._map = map;
		this._animated = map._zoomAnimated;

		// create a container div for tiles
		this._initContainer();

		// set up events
		map.on({
			'viewreset': this._reset,
			'moveend': this._update
		}, this);

		if (this._animated) {
			map.on({
				'zoomanim': this._animateZoom,
				'zoomend': this._endZoomAnim
			}, this);
		}

		if (!this.options.updateWhenIdle) {
			this._limitedUpdate = L.Util.limitExecByInterval(this._update, 150, this);
			map.on('move', this._limitedUpdate, this);
		}

		this._reset();
		this._update();
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	onRemove: function (map) {
		this._container.parentNode.removeChild(this._container);

		map.off({
			'viewreset': this._reset,
			'moveend': this._update
		}, this);

		if (this._animated) {
			map.off({
				'zoomanim': this._animateZoom,
				'zoomend': this._endZoomAnim
			}, this);
		}

		if (!this.options.updateWhenIdle) {
			map.off('move', this._limitedUpdate, this);
		}

		this._container = null;
		this._map = null;
	},

	bringToFront: function () {
		var pane = this._map._panes.tilePane;

		if (this._container) {
			pane.appendChild(this._container);
			this._setAutoZIndex(pane, Math.max);
		}

		return this;
	},

	bringToBack: function () {
		var pane = this._map._panes.tilePane;

		if (this._container) {
			pane.insertBefore(this._container, pane.firstChild);
			this._setAutoZIndex(pane, Math.min);
		}

		return this;
	},

	getAttribution: function () {
		return this.options.attribution;
	},

	getContainer: function () {
		return this._container;
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;

		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	setZIndex: function (zIndex) {
		this.options.zIndex = zIndex;
		this._updateZIndex();

		return this;
	},

	setUrl: function (url, noRedraw) {
		this._url = url;

		if (!noRedraw) {
			this.redraw();
		}

		return this;
	},

	redraw: function () {
		if (this._map) {
			this._reset({hard: true});
			this._update();
		}
		return this;
	},

	_updateZIndex: function () {
		if (this._container && this.options.zIndex !== undefined) {
			this._container.style.zIndex = this.options.zIndex;
		}
	},

	_setAutoZIndex: function (pane, compare) {

		var layers = pane.children,
		    edgeZIndex = -compare(Infinity, -Infinity), // -Infinity for max, Infinity for min
		    zIndex, i, len;

		for (i = 0, len = layers.length; i < len; i++) {

			if (layers[i] !== this._container) {
				zIndex = parseInt(layers[i].style.zIndex, 10);

				if (!isNaN(zIndex)) {
					edgeZIndex = compare(edgeZIndex, zIndex);
				}
			}
		}

		this.options.zIndex = this._container.style.zIndex =
		        (isFinite(edgeZIndex) ? edgeZIndex : 0) + compare(1, -1);
	},

	_updateOpacity: function () {
		var i,
		    tiles = this._tiles;

		if (L.Browser.ielt9) {
			for (i in tiles) {
				L.DomUtil.setOpacity(tiles[i], this.options.opacity);
			}
		} else {
			L.DomUtil.setOpacity(this._container, this.options.opacity);
		}
	},

	_initContainer: function () {
		var tilePane = this._map._panes.tilePane;

		if (!this._container) {
			this._container = L.DomUtil.create('div', 'leaflet-layer');

			this._updateZIndex();

			if (this._animated) {
				var className = 'leaflet-tile-container';

				this._bgBuffer = L.DomUtil.create('div', className, this._container);
				this._tileContainer = L.DomUtil.create('div', className, this._container);

			} else {
				this._tileContainer = this._container;
			}

			tilePane.appendChild(this._container);

			if (this.options.opacity < 1) {
				this._updateOpacity();
			}
		}
	},

	_reset: function (e) {
		for (var key in this._tiles) {
			this.fire('tileunload', {tile: this._tiles[key]});
		}

		this._tiles = {};
		this._tilesToLoad = 0;

		if (this.options.reuseTiles) {
			this._unusedTiles = [];
		}

		this._tileContainer.innerHTML = '';

		if (this._animated && e && e.hard) {
			this._clearBgBuffer();
		}

		this._initContainer();
	},

	_getTileSize: function () {
		var map = this._map,
		    zoom = map.getZoom() + this.options.zoomOffset,
		    zoomN = this.options.maxNativeZoom,
		    tileSize = this.options.tileSize;

		if (zoomN && zoom > zoomN) {
			tileSize = Math.round(map.getZoomScale(zoom) / map.getZoomScale(zoomN) * tileSize);
		}

		return tileSize;
	},

	_update: function () {

		if (!this._map) { return; }

		var map = this._map,
		    bounds = map.getPixelBounds(),
		    zoom = map.getZoom(),
		    tileSize = this._getTileSize();

		if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
			return;
		}

		var tileBounds = L.bounds(
		        bounds.min.divideBy(tileSize)._floor(),
		        bounds.max.divideBy(tileSize)._floor());

		this._addTilesFromCenterOut(tileBounds);

		if (this.options.unloadInvisibleTiles || this.options.reuseTiles) {
			this._removeOtherTiles(tileBounds);
		}
	},

	_addTilesFromCenterOut: function (bounds) {
		var queue = [],
		    center = bounds.getCenter();

		var j, i, point;

		for (j = bounds.min.y; j <= bounds.max.y; j++) {
			for (i = bounds.min.x; i <= bounds.max.x; i++) {
				point = new L.Point(i, j);

				if (this._tileShouldBeLoaded(point)) {
					queue.push(point);
				}
			}
		}

		var tilesToLoad = queue.length;

		if (tilesToLoad === 0) { return; }

		// load tiles in order of their distance to center
		queue.sort(function (a, b) {
			return a.distanceTo(center) - b.distanceTo(center);
		});

		var fragment = document.createDocumentFragment();

		// if its the first batch of tiles to load
		if (!this._tilesToLoad) {
			this.fire('loading');
		}

		this._tilesToLoad += tilesToLoad;

		for (i = 0; i < tilesToLoad; i++) {
			this._addTile(queue[i], fragment);
		}

		this._tileContainer.appendChild(fragment);
	},

	_tileShouldBeLoaded: function (tilePoint) {
		if ((tilePoint.x + ':' + tilePoint.y) in this._tiles) {
			return false; // already loaded
		}

		var options = this.options;

		if (!options.continuousWorld) {
			var limit = this._getWrapTileNum();

			// don't load if exceeds world bounds
			if ((options.noWrap && (tilePoint.x < 0 || tilePoint.x >= limit.x)) ||
				tilePoint.y < 0 || tilePoint.y >= limit.y) { return false; }
		}

		if (options.bounds) {
			var tileSize = this._getTileSize(),
			    nwPoint = tilePoint.multiplyBy(tileSize),
			    sePoint = nwPoint.add([tileSize, tileSize]),
			    nw = this._map.unproject(nwPoint),
			    se = this._map.unproject(sePoint);

			// TODO temporary hack, will be removed after refactoring projections
			// https://github.com/Leaflet/Leaflet/issues/1618
			if (!options.continuousWorld && !options.noWrap) {
				nw = nw.wrap();
				se = se.wrap();
			}

			if (!options.bounds.intersects([nw, se])) { return false; }
		}

		return true;
	},

	_removeOtherTiles: function (bounds) {
		var kArr, x, y, key;

		for (key in this._tiles) {
			kArr = key.split(':');
			x = parseInt(kArr[0], 10);
			y = parseInt(kArr[1], 10);

			// remove tile if it's out of bounds
			if (x < bounds.min.x || x > bounds.max.x || y < bounds.min.y || y > bounds.max.y) {
				this._removeTile(key);
			}
		}
	},

	_removeTile: function (key) {
		var tile = this._tiles[key];

		this.fire('tileunload', {tile: tile, url: tile.src});

		if (this.options.reuseTiles) {
			L.DomUtil.removeClass(tile, 'leaflet-tile-loaded');
			this._unusedTiles.push(tile);

		} else if (tile.parentNode === this._tileContainer) {
			this._tileContainer.removeChild(tile);
		}

		// for https://github.com/CloudMade/Leaflet/issues/137
		if (!L.Browser.android) {
			tile.onload = null;
			tile.src = L.Util.emptyImageUrl;
		}

		delete this._tiles[key];
	},

	_addTile: function (tilePoint, container) {
		var tilePos = this._getTilePos(tilePoint);

		// get unused tile - or create a new tile
		var tile = this._getTile();

		/*
		Chrome 20 layouts much faster with top/left (verify with timeline, frames)
		Android 4 browser has display issues with top/left and requires transform instead
		(other browsers don't currently care) - see debug/hacks/jitter.html for an example
		*/
		L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome);

		this._tiles[tilePoint.x + ':' + tilePoint.y] = tile;

		this._loadTile(tile, tilePoint);

		if (tile.parentNode !== this._tileContainer) {
			container.appendChild(tile);
		}
	},

	_getZoomForUrl: function () {

		var options = this.options,
		    zoom = this._map.getZoom();

		if (options.zoomReverse) {
			zoom = options.maxZoom - zoom;
		}

		zoom += options.zoomOffset;

		return options.maxNativeZoom ? Math.min(zoom, options.maxNativeZoom) : zoom;
	},

	_getTilePos: function (tilePoint) {
		var origin = this._map.getPixelOrigin(),
		    tileSize = this._getTileSize();

		return tilePoint.multiplyBy(tileSize).subtract(origin);
	},

	// image-specific code (override to implement e.g. Canvas or SVG tile layer)

	getTileUrl: function (tilePoint) {
		return L.Util.template(this._url, L.extend({
			s: this._getSubdomain(tilePoint),
			z: tilePoint.z,
			x: tilePoint.x,
			y: tilePoint.y
		}, this.options));
	},

	_getWrapTileNum: function () {
		var crs = this._map.options.crs,
		    size = crs.getSize(this._map.getZoom());
		return size.divideBy(this._getTileSize())._floor();
	},

	_adjustTilePoint: function (tilePoint) {

		var limit = this._getWrapTileNum();

		// wrap tile coordinates
		if (!this.options.continuousWorld && !this.options.noWrap) {
			tilePoint.x = ((tilePoint.x % limit.x) + limit.x) % limit.x;
		}

		if (this.options.tms) {
			tilePoint.y = limit.y - tilePoint.y - 1;
		}

		tilePoint.z = this._getZoomForUrl();
	},

	_getSubdomain: function (tilePoint) {
		var index = Math.abs(tilePoint.x + tilePoint.y) % this.options.subdomains.length;
		return this.options.subdomains[index];
	},

	_getTile: function () {
		if (this.options.reuseTiles && this._unusedTiles.length > 0) {
			var tile = this._unusedTiles.pop();
			this._resetTile(tile);
			return tile;
		}
		return this._createTile();
	},

	// Override if data stored on a tile needs to be cleaned up before reuse
	_resetTile: function (/*tile*/) {},

	_createTile: function () {
		var tile = L.DomUtil.create('img', 'leaflet-tile');
		tile.style.width = tile.style.height = this._getTileSize() + 'px';
		tile.galleryimg = 'no';

		tile.onselectstart = tile.onmousemove = L.Util.falseFn;

		if (L.Browser.ielt9 && this.options.opacity !== undefined) {
			L.DomUtil.setOpacity(tile, this.options.opacity);
		}
		// without this hack, tiles disappear after zoom on Chrome for Android
		// https://github.com/Leaflet/Leaflet/issues/2078
		if (L.Browser.mobileWebkit3d) {
			tile.style.WebkitBackfaceVisibility = 'hidden';
		}
		return tile;
	},

	_loadTile: function (tile, tilePoint) {
		tile._layer  = this;
		tile.onload  = this._tileOnLoad;
		tile.onerror = this._tileOnError;

		this._adjustTilePoint(tilePoint);
		tile.src     = this.getTileUrl(tilePoint);

		this.fire('tileloadstart', {
			tile: tile,
			url: tile.src
		});
	},

	_tileLoaded: function () {
		this._tilesToLoad--;

		if (this._animated) {
			L.DomUtil.addClass(this._tileContainer, 'leaflet-zoom-animated');
		}

		if (!this._tilesToLoad) {
			this.fire('load');

			if (this._animated) {
				// clear scaled tiles after all new tiles are loaded (for performance)
				clearTimeout(this._clearBgBufferTimer);
				this._clearBgBufferTimer = setTimeout(L.bind(this._clearBgBuffer, this), 500);
			}
		}
	},

	_tileOnLoad: function () {
		var layer = this._layer;

		//Only if we are loading an actual image
		if (this.src !== L.Util.emptyImageUrl) {
			L.DomUtil.addClass(this, 'leaflet-tile-loaded');

			layer.fire('tileload', {
				tile: this,
				url: this.src
			});
		}

		layer._tileLoaded();
	},

	_tileOnError: function () {
		var layer = this._layer;

		layer.fire('tileerror', {
			tile: this,
			url: this.src
		});

		var newUrl = layer.options.errorTileUrl;
		if (newUrl) {
			this.src = newUrl;
		}

		layer._tileLoaded();
	}
});

L.tileLayer = function (url, options) {
	return new L.TileLayer(url, options);
};


/*
 * L.TileLayer.WMS is used for putting WMS tile layers on the map.
 */

L.TileLayer.WMS = L.TileLayer.extend({

	defaultWmsParams: {
		service: 'WMS',
		request: 'GetMap',
		version: '1.1.1',
		layers: '',
		styles: '',
		format: 'image/jpeg',
		transparent: false
	},

	initialize: function (url, options) { // (String, Object)

		this._url = url;

		var wmsParams = L.extend({}, this.defaultWmsParams),
		    tileSize = options.tileSize || this.options.tileSize;

		if (options.detectRetina && L.Browser.retina) {
			wmsParams.width = wmsParams.height = tileSize * 2;
		} else {
			wmsParams.width = wmsParams.height = tileSize;
		}

		for (var i in options) {
			// all keys that are not TileLayer options go to WMS params
			if (!this.options.hasOwnProperty(i) && i !== 'crs') {
				wmsParams[i] = options[i];
			}
		}

		this.wmsParams = wmsParams;

		L.setOptions(this, options);
	},

	onAdd: function (map) {

		this._crs = this.options.crs || map.options.crs;

		this._wmsVersion = parseFloat(this.wmsParams.version);

		var projectionKey = this._wmsVersion >= 1.3 ? 'crs' : 'srs';
		this.wmsParams[projectionKey] = this._crs.code;

		L.TileLayer.prototype.onAdd.call(this, map);
	},

	getTileUrl: function (tilePoint) { // (Point, Number) -> String

		var map = this._map,
		    tileSize = this.options.tileSize,

		    nwPoint = tilePoint.multiplyBy(tileSize),
		    sePoint = nwPoint.add([tileSize, tileSize]),

		    nw = this._crs.project(map.unproject(nwPoint, tilePoint.z)),
		    se = this._crs.project(map.unproject(sePoint, tilePoint.z)),
		    bbox = this._wmsVersion >= 1.3 && this._crs === L.CRS.EPSG4326 ?
		        [se.y, nw.x, nw.y, se.x].join(',') :
		        [nw.x, se.y, se.x, nw.y].join(','),

		    url = L.Util.template(this._url, {s: this._getSubdomain(tilePoint)});

		return url + L.Util.getParamString(this.wmsParams, url, true) + '&BBOX=' + bbox;
	},

	setParams: function (params, noRedraw) {

		L.extend(this.wmsParams, params);

		if (!noRedraw) {
			this.redraw();
		}

		return this;
	}
});

L.tileLayer.wms = function (url, options) {
	return new L.TileLayer.WMS(url, options);
};


/*
 * L.TileLayer.Canvas is a class that you can use as a base for creating
 * dynamically drawn Canvas-based tile layers.
 */

L.TileLayer.Canvas = L.TileLayer.extend({
	options: {
		async: false
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	redraw: function () {
		if (this._map) {
			this._reset({hard: true});
			this._update();
		}

		for (var i in this._tiles) {
			this._redrawTile(this._tiles[i]);
		}
		return this;
	},

	_redrawTile: function (tile) {
		this.drawTile(tile, tile._tilePoint, this._map._zoom);
	},

	_createTile: function () {
		var tile = L.DomUtil.create('canvas', 'leaflet-tile');
		tile.width = tile.height = this.options.tileSize;
		tile.onselectstart = tile.onmousemove = L.Util.falseFn;
		return tile;
	},

	_loadTile: function (tile, tilePoint) {
		tile._layer = this;
		tile._tilePoint = tilePoint;

		this._redrawTile(tile);

		if (!this.options.async) {
			this.tileDrawn(tile);
		}
	},

	drawTile: function (/*tile, tilePoint*/) {
		// override with rendering code
	},

	tileDrawn: function (tile) {
		this._tileOnLoad.call(tile);
	}
});


L.tileLayer.canvas = function (options) {
	return new L.TileLayer.Canvas(options);
};


/*
 * L.ImageOverlay is used to overlay images over the map (to specific geographical bounds).
 */

L.ImageOverlay = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		opacity: 1
	},

	initialize: function (url, bounds, options) { // (String, LatLngBounds, Object)
		this._url = url;
		this._bounds = L.latLngBounds(bounds);

		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._map = map;

		if (!this._image) {
			this._initImage();
		}

		map._panes.overlayPane.appendChild(this._image);

		map.on('viewreset', this._reset, this);

		if (map.options.zoomAnimation && L.Browser.any3d) {
			map.on('zoomanim', this._animateZoom, this);
		}

		this._reset();
	},

	onRemove: function (map) {
		map.getPanes().overlayPane.removeChild(this._image);

		map.off('viewreset', this._reset, this);

		if (map.options.zoomAnimation) {
			map.off('zoomanim', this._animateZoom, this);
		}
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		this._updateOpacity();
		return this;
	},

	// TODO remove bringToFront/bringToBack duplication from TileLayer/Path
	bringToFront: function () {
		if (this._image) {
			this._map._panes.overlayPane.appendChild(this._image);
		}
		return this;
	},

	bringToBack: function () {
		var pane = this._map._panes.overlayPane;
		if (this._image) {
			pane.insertBefore(this._image, pane.firstChild);
		}
		return this;
	},

	setUrl: function (url) {
		this._url = url;
		this._image.src = this._url;
	},

	getAttribution: function () {
		return this.options.attribution;
	},

	_initImage: function () {
		this._image = L.DomUtil.create('img', 'leaflet-image-layer');

		if (this._map.options.zoomAnimation && L.Browser.any3d) {
			L.DomUtil.addClass(this._image, 'leaflet-zoom-animated');
		} else {
			L.DomUtil.addClass(this._image, 'leaflet-zoom-hide');
		}

		this._updateOpacity();

		//TODO createImage util method to remove duplication
		L.extend(this._image, {
			galleryimg: 'no',
			onselectstart: L.Util.falseFn,
			onmousemove: L.Util.falseFn,
			onload: L.bind(this._onImageLoad, this),
			src: this._url
		});
	},

	_animateZoom: function (e) {
		var map = this._map,
		    image = this._image,
		    scale = map.getZoomScale(e.zoom),
		    nw = this._bounds.getNorthWest(),
		    se = this._bounds.getSouthEast(),

		    topLeft = map._latLngToNewLayerPoint(nw, e.zoom, e.center),
		    size = map._latLngToNewLayerPoint(se, e.zoom, e.center)._subtract(topLeft),
		    origin = topLeft._add(size._multiplyBy((1 / 2) * (1 - 1 / scale)));

		image.style[L.DomUtil.TRANSFORM] =
		        L.DomUtil.getTranslateString(origin) + ' scale(' + scale + ') ';
	},

	_reset: function () {
		var image   = this._image,
		    topLeft = this._map.latLngToLayerPoint(this._bounds.getNorthWest()),
		    size = this._map.latLngToLayerPoint(this._bounds.getSouthEast())._subtract(topLeft);

		L.DomUtil.setPosition(image, topLeft);

		image.style.width  = size.x + 'px';
		image.style.height = size.y + 'px';
	},

	_onImageLoad: function () {
		this.fire('load');
	},

	_updateOpacity: function () {
		L.DomUtil.setOpacity(this._image, this.options.opacity);
	}
});

L.imageOverlay = function (url, bounds, options) {
	return new L.ImageOverlay(url, bounds, options);
};


/*
 * L.Icon is an image-based icon class that you can use with L.Marker for custom markers.
 */

L.Icon = L.Class.extend({
	options: {
		/*
		iconUrl: (String) (required)
		iconRetinaUrl: (String) (optional, used for retina devices if detected)
		iconSize: (Point) (can be set through CSS)
		iconAnchor: (Point) (centered by default, can be set in CSS with negative margins)
		popupAnchor: (Point) (if not specified, popup opens in the anchor point)
		shadowUrl: (String) (no shadow by default)
		shadowRetinaUrl: (String) (optional, used for retina devices if detected)
		shadowSize: (Point)
		shadowAnchor: (Point)
		*/
		className: ''
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	createIcon: function (oldIcon) {
		return this._createIcon('icon', oldIcon);
	},

	createShadow: function (oldIcon) {
		return this._createIcon('shadow', oldIcon);
	},

	_createIcon: function (name, oldIcon) {
		var src = this._getIconUrl(name);

		if (!src) {
			if (name === 'icon') {
				throw new Error('iconUrl not set in Icon options (see the docs).');
			}
			return null;
		}

		var img;
		if (!oldIcon || oldIcon.tagName !== 'IMG') {
			img = this._createImg(src);
		} else {
			img = this._createImg(src, oldIcon);
		}
		this._setIconStyles(img, name);

		return img;
	},

	_setIconStyles: function (img, name) {
		var options = this.options,
		    size = L.point(options[name + 'Size']),
		    anchor;

		if (name === 'shadow') {
			anchor = L.point(options.shadowAnchor || options.iconAnchor);
		} else {
			anchor = L.point(options.iconAnchor);
		}

		if (!anchor && size) {
			anchor = size.divideBy(2, true);
		}

		img.className = 'leaflet-marker-' + name + ' ' + options.className;

		if (anchor) {
			img.style.marginLeft = (-anchor.x) + 'px';
			img.style.marginTop  = (-anchor.y) + 'px';
		}

		if (size) {
			img.style.width  = size.x + 'px';
			img.style.height = size.y + 'px';
		}
	},

	_createImg: function (src, el) {
		el = el || document.createElement('img');
		el.src = src;
		return el;
	},

	_getIconUrl: function (name) {
		if (L.Browser.retina && this.options[name + 'RetinaUrl']) {
			return this.options[name + 'RetinaUrl'];
		}
		return this.options[name + 'Url'];
	}
});

L.icon = function (options) {
	return new L.Icon(options);
};


/*
 * L.Icon.Default is the blue marker icon used by default in Leaflet.
 */

L.Icon.Default = L.Icon.extend({

	options: {
		iconSize: [25, 41],
		iconAnchor: [12, 41],
		popupAnchor: [1, -34],

		shadowSize: [41, 41]
	},

	_getIconUrl: function (name) {
		var key = name + 'Url';

		if (this.options[key]) {
			return this.options[key];
		}

		if (L.Browser.retina && name === 'icon') {
			name += '-2x';
		}

		var path = L.Icon.Default.imagePath;

		if (!path) {
			throw new Error('Couldn\'t autodetect L.Icon.Default.imagePath, set it manually.');
		}

		return path + '/marker-' + name + '.png';
	}
});

L.Icon.Default.imagePath = (function () {
	var scripts = document.getElementsByTagName('script'),
	    leafletRe = /[\/^]leaflet[\-\._]?([\w\-\._]*)\.js\??/;

	var i, len, src, matches, path;

	for (i = 0, len = scripts.length; i < len; i++) {
		src = scripts[i].src;
		matches = src.match(leafletRe);

		if (matches) {
			path = src.split(leafletRe)[0];
			return (path ? path + '/' : '') + 'images';
		}
	}
}());


/*
 * L.Marker is used to display clickable/draggable icons on the map.
 */

L.Marker = L.Class.extend({

	includes: L.Mixin.Events,

	options: {
		icon: new L.Icon.Default(),
		title: '',
		alt: '',
		clickable: true,
		draggable: false,
		keyboard: true,
		zIndexOffset: 0,
		opacity: 1,
		riseOnHover: false,
		riseOffset: 250
	},

	initialize: function (latlng, options) {
		L.setOptions(this, options);
		this._latlng = L.latLng(latlng);
	},

	onAdd: function (map) {
		this._map = map;

		map.on('viewreset', this.update, this);

		this._initIcon();
		this.update();
		this.fire('add');

		if (map.options.zoomAnimation && map.options.markerZoomAnimation) {
			map.on('zoomanim', this._animateZoom, this);
		}
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	onRemove: function (map) {
		if (this.dragging) {
			this.dragging.disable();
		}

		this._removeIcon();
		this._removeShadow();

		this.fire('remove');

		map.off({
			'viewreset': this.update,
			'zoomanim': this._animateZoom
		}, this);

		this._map = null;
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);

		this.update();

		return this.fire('move', { latlng: this._latlng });
	},

	setZIndexOffset: function (offset) {
		this.options.zIndexOffset = offset;
		this.update();

		return this;
	},

	setIcon: function (icon) {

		this.options.icon = icon;

		if (this._map) {
			this._initIcon();
			this.update();
		}

		if (this._popup) {
			this.bindPopup(this._popup);
		}

		return this;
	},

	update: function () {
		if (this._icon) {
			this._setPos(this._map.latLngToLayerPoint(this._latlng).round());
		}
		return this;
	},

	_initIcon: function () {
		var options = this.options,
		    map = this._map,
		    animation = (map.options.zoomAnimation && map.options.markerZoomAnimation),
		    classToAdd = animation ? 'leaflet-zoom-animated' : 'leaflet-zoom-hide';

		var icon = options.icon.createIcon(this._icon),
			addIcon = false;

		// if we're not reusing the icon, remove the old one and init new one
		if (icon !== this._icon) {
			if (this._icon) {
				this._removeIcon();
			}
			addIcon = true;

			if (options.title) {
				icon.title = options.title;
			}

			if (options.alt) {
				icon.alt = options.alt;
			}
		}

		L.DomUtil.addClass(icon, classToAdd);

		if (options.keyboard) {
			icon.tabIndex = '0';
		}

		this._icon = icon;

		this._initInteraction();

		if (options.riseOnHover) {
			L.DomEvent
				.on(icon, 'mouseover', this._bringToFront, this)
				.on(icon, 'mouseout', this._resetZIndex, this);
		}

		var newShadow = options.icon.createShadow(this._shadow),
			addShadow = false;

		if (newShadow !== this._shadow) {
			this._removeShadow();
			addShadow = true;
		}

		if (newShadow) {
			L.DomUtil.addClass(newShadow, classToAdd);
		}
		this._shadow = newShadow;


		if (options.opacity < 1) {
			this._updateOpacity();
		}


		var panes = this._map._panes;

		if (addIcon) {
			panes.markerPane.appendChild(this._icon);
		}

		if (newShadow && addShadow) {
			panes.shadowPane.appendChild(this._shadow);
		}
	},

	_removeIcon: function () {
		if (this.options.riseOnHover) {
			L.DomEvent
			    .off(this._icon, 'mouseover', this._bringToFront)
			    .off(this._icon, 'mouseout', this._resetZIndex);
		}

		this._map._panes.markerPane.removeChild(this._icon);

		this._icon = null;
	},

	_removeShadow: function () {
		if (this._shadow) {
			this._map._panes.shadowPane.removeChild(this._shadow);
		}
		this._shadow = null;
	},

	_setPos: function (pos) {
		L.DomUtil.setPosition(this._icon, pos);

		if (this._shadow) {
			L.DomUtil.setPosition(this._shadow, pos);
		}

		this._zIndex = pos.y + this.options.zIndexOffset;

		this._resetZIndex();
	},

	_updateZIndex: function (offset) {
		this._icon.style.zIndex = this._zIndex + offset;
	},

	_animateZoom: function (opt) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center).round();

		this._setPos(pos);
	},

	_initInteraction: function () {

		if (!this.options.clickable) { return; }

		// TODO refactor into something shared with Map/Path/etc. to DRY it up

		var icon = this._icon,
		    events = ['dblclick', 'mousedown', 'mouseover', 'mouseout', 'contextmenu'];

		L.DomUtil.addClass(icon, 'leaflet-clickable');
		L.DomEvent.on(icon, 'click', this._onMouseClick, this);
		L.DomEvent.on(icon, 'keypress', this._onKeyPress, this);

		for (var i = 0; i < events.length; i++) {
			L.DomEvent.on(icon, events[i], this._fireMouseEvent, this);
		}

		if (L.Handler.MarkerDrag) {
			this.dragging = new L.Handler.MarkerDrag(this);

			if (this.options.draggable) {
				this.dragging.enable();
			}
		}
	},

	_onMouseClick: function (e) {
		var wasDragged = this.dragging && this.dragging.moved();

		if (this.hasEventListeners(e.type) || wasDragged) {
			L.DomEvent.stopPropagation(e);
		}

		if (wasDragged) { return; }

		if ((!this.dragging || !this.dragging._enabled) && this._map.dragging && this._map.dragging.moved()) { return; }

		this.fire(e.type, {
			originalEvent: e,
			latlng: this._latlng
		});
	},

	_onKeyPress: function (e) {
		if (e.keyCode === 13) {
			this.fire('click', {
				originalEvent: e,
				latlng: this._latlng
			});
		}
	},

	_fireMouseEvent: function (e) {

		this.fire(e.type, {
			originalEvent: e,
			latlng: this._latlng
		});

		// TODO proper custom event propagation
		// this line will always be called if marker is in a FeatureGroup
		if (e.type === 'contextmenu' && this.hasEventListeners(e.type)) {
			L.DomEvent.preventDefault(e);
		}
		if (e.type !== 'mousedown') {
			L.DomEvent.stopPropagation(e);
		} else {
			L.DomEvent.preventDefault(e);
		}
	},

	setOpacity: function (opacity) {
		this.options.opacity = opacity;
		if (this._map) {
			this._updateOpacity();
		}

		return this;
	},

	_updateOpacity: function () {
		L.DomUtil.setOpacity(this._icon, this.options.opacity);
		if (this._shadow) {
			L.DomUtil.setOpacity(this._shadow, this.options.opacity);
		}
	},

	_bringToFront: function () {
		this._updateZIndex(this.options.riseOffset);
	},

	_resetZIndex: function () {
		this._updateZIndex(0);
	}
});

L.marker = function (latlng, options) {
	return new L.Marker(latlng, options);
};


/*
 * L.DivIcon is a lightweight HTML-based icon class (as opposed to the image-based L.Icon)
 * to use with L.Marker.
 */

L.DivIcon = L.Icon.extend({
	options: {
		iconSize: [12, 12], // also can be set through CSS
		/*
		iconAnchor: (Point)
		popupAnchor: (Point)
		html: (String)
		bgPos: (Point)
		*/
		className: 'leaflet-div-icon',
		html: false
	},

	createIcon: function (oldIcon) {
		var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div'),
		    options = this.options;

		if (options.html !== false) {
			div.innerHTML = options.html;
		} else {
			div.innerHTML = '';
		}

		if (options.bgPos) {
			div.style.backgroundPosition =
			        (-options.bgPos.x) + 'px ' + (-options.bgPos.y) + 'px';
		}

		this._setIconStyles(div, 'icon');
		return div;
	},

	createShadow: function () {
		return null;
	}
});

L.divIcon = function (options) {
	return new L.DivIcon(options);
};


/*
 * L.Popup is used for displaying popups on the map.
 */

L.Map.mergeOptions({
	closePopupOnClick: true
});

L.Popup = L.Class.extend({
	includes: L.Mixin.Events,

	options: {
		minWidth: 50,
		maxWidth: 300,
		// maxHeight: null,
		autoPan: true,
		closeButton: true,
		offset: [0, 7],
		autoPanPadding: [5, 5],
		// autoPanPaddingTopLeft: null,
		// autoPanPaddingBottomRight: null,
		keepInView: false,
		className: '',
		zoomAnimation: true
	},

	initialize: function (options, source) {
		L.setOptions(this, options);

		this._source = source;
		this._animated = L.Browser.any3d && this.options.zoomAnimation;
		this._isOpen = false;
	},

	onAdd: function (map) {
		this._map = map;

		if (!this._container) {
			this._initLayout();
		}

		var animFade = map.options.fadeAnimation;

		if (animFade) {
			L.DomUtil.setOpacity(this._container, 0);
		}
		map._panes.popupPane.appendChild(this._container);

		map.on(this._getEvents(), this);

		this.update();

		if (animFade) {
			L.DomUtil.setOpacity(this._container, 1);
		}

		this.fire('open');

		map.fire('popupopen', {popup: this});

		if (this._source) {
			this._source.fire('popupopen', {popup: this});
		}
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	openOn: function (map) {
		map.openPopup(this);
		return this;
	},

	onRemove: function (map) {
		map._panes.popupPane.removeChild(this._container);

		L.Util.falseFn(this._container.offsetWidth); // force reflow

		map.off(this._getEvents(), this);

		if (map.options.fadeAnimation) {
			L.DomUtil.setOpacity(this._container, 0);
		}

		this._map = null;

		this.fire('close');

		map.fire('popupclose', {popup: this});

		if (this._source) {
			this._source.fire('popupclose', {popup: this});
		}
	},

	getLatLng: function () {
		return this._latlng;
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);
		if (this._map) {
			this._updatePosition();
			this._adjustPan();
		}
		return this;
	},

	getContent: function () {
		return this._content;
	},

	setContent: function (content) {
		this._content = content;
		this.update();
		return this;
	},

	update: function () {
		if (!this._map) { return; }

		this._container.style.visibility = 'hidden';

		this._updateContent();
		this._updateLayout();
		this._updatePosition();

		this._container.style.visibility = '';

		this._adjustPan();
	},

	_getEvents: function () {
		var events = {
			viewreset: this._updatePosition
		};

		if (this._animated) {
			events.zoomanim = this._zoomAnimation;
		}
		if ('closeOnClick' in this.options ? this.options.closeOnClick : this._map.options.closePopupOnClick) {
			events.preclick = this._close;
		}
		if (this.options.keepInView) {
			events.moveend = this._adjustPan;
		}

		return events;
	},

	_close: function () {
		if (this._map) {
			this._map.closePopup(this);
		}
	},

	_initLayout: function () {
		var prefix = 'leaflet-popup',
			containerClass = prefix + ' ' + this.options.className + ' leaflet-zoom-' +
			        (this._animated ? 'animated' : 'hide'),
			container = this._container = L.DomUtil.create('div', containerClass),
			closeButton;

		if (this.options.closeButton) {
			closeButton = this._closeButton =
			        L.DomUtil.create('a', prefix + '-close-button', container);
			closeButton.href = '#close';
			closeButton.innerHTML = '&#215;';
			L.DomEvent.disableClickPropagation(closeButton);

			L.DomEvent.on(closeButton, 'click', this._onCloseButtonClick, this);
		}

		var wrapper = this._wrapper =
		        L.DomUtil.create('div', prefix + '-content-wrapper', container);
		L.DomEvent.disableClickPropagation(wrapper);

		this._contentNode = L.DomUtil.create('div', prefix + '-content', wrapper);

		L.DomEvent.disableScrollPropagation(this._contentNode);
		L.DomEvent.on(wrapper, 'contextmenu', L.DomEvent.stopPropagation);

		this._tipContainer = L.DomUtil.create('div', prefix + '-tip-container', container);
		this._tip = L.DomUtil.create('div', prefix + '-tip', this._tipContainer);
	},

	_updateContent: function () {
		if (!this._content) { return; }

		if (typeof this._content === 'string') {
			this._contentNode.innerHTML = this._content;
		} else {
			while (this._contentNode.hasChildNodes()) {
				this._contentNode.removeChild(this._contentNode.firstChild);
			}
			this._contentNode.appendChild(this._content);
		}
		this.fire('contentupdate');
	},

	_updateLayout: function () {
		var container = this._contentNode,
		    style = container.style;

		style.width = '';
		style.whiteSpace = 'nowrap';

		var width = container.offsetWidth;
		width = Math.min(width, this.options.maxWidth);
		width = Math.max(width, this.options.minWidth);

		style.width = (width + 1) + 'px';
		style.whiteSpace = '';

		style.height = '';

		var height = container.offsetHeight,
		    maxHeight = this.options.maxHeight,
		    scrolledClass = 'leaflet-popup-scrolled';

		if (maxHeight && height > maxHeight) {
			style.height = maxHeight + 'px';
			L.DomUtil.addClass(container, scrolledClass);
		} else {
			L.DomUtil.removeClass(container, scrolledClass);
		}

		this._containerWidth = this._container.offsetWidth;
	},

	_updatePosition: function () {
		if (!this._map) { return; }

		var pos = this._map.latLngToLayerPoint(this._latlng),
		    animated = this._animated,
		    offset = L.point(this.options.offset);

		if (animated) {
			L.DomUtil.setPosition(this._container, pos);
		}

		this._containerBottom = -offset.y - (animated ? 0 : pos.y);
		this._containerLeft = -Math.round(this._containerWidth / 2) + offset.x + (animated ? 0 : pos.x);

		// bottom position the popup in case the height of the popup changes (images loading etc)
		this._container.style.bottom = this._containerBottom + 'px';
		this._container.style.left = this._containerLeft + 'px';
	},

	_zoomAnimation: function (opt) {
		var pos = this._map._latLngToNewLayerPoint(this._latlng, opt.zoom, opt.center);

		L.DomUtil.setPosition(this._container, pos);
	},

	_adjustPan: function () {
		if (!this.options.autoPan) { return; }

		var map = this._map,
		    containerHeight = this._container.offsetHeight,
		    containerWidth = this._containerWidth,

		    layerPos = new L.Point(this._containerLeft, -containerHeight - this._containerBottom);

		if (this._animated) {
			layerPos._add(L.DomUtil.getPosition(this._container));
		}

		var containerPos = map.layerPointToContainerPoint(layerPos),
		    padding = L.point(this.options.autoPanPadding),
		    paddingTL = L.point(this.options.autoPanPaddingTopLeft || padding),
		    paddingBR = L.point(this.options.autoPanPaddingBottomRight || padding),
		    size = map.getSize(),
		    dx = 0,
		    dy = 0;

		if (containerPos.x + containerWidth + paddingBR.x > size.x) { // right
			dx = containerPos.x + containerWidth - size.x + paddingBR.x;
		}
		if (containerPos.x - dx - paddingTL.x < 0) { // left
			dx = containerPos.x - paddingTL.x;
		}
		if (containerPos.y + containerHeight + paddingBR.y > size.y) { // bottom
			dy = containerPos.y + containerHeight - size.y + paddingBR.y;
		}
		if (containerPos.y - dy - paddingTL.y < 0) { // top
			dy = containerPos.y - paddingTL.y;
		}

		if (dx || dy) {
			map
			    .fire('autopanstart')
			    .panBy([dx, dy]);
		}
	},

	_onCloseButtonClick: function (e) {
		this._close();
		L.DomEvent.stop(e);
	}
});

L.popup = function (options, source) {
	return new L.Popup(options, source);
};


L.Map.include({
	openPopup: function (popup, latlng, options) { // (Popup) or (String || HTMLElement, LatLng[, Object])
		this.closePopup();

		if (!(popup instanceof L.Popup)) {
			var content = popup;

			popup = new L.Popup(options)
			    .setLatLng(latlng)
			    .setContent(content);
		}
		popup._isOpen = true;

		this._popup = popup;
		return this.addLayer(popup);
	},

	closePopup: function (popup) {
		if (!popup || popup === this._popup) {
			popup = this._popup;
			this._popup = null;
		}
		if (popup) {
			this.removeLayer(popup);
			popup._isOpen = false;
		}
		return this;
	}
});


/*
 * Popup extension to L.Marker, adding popup-related methods.
 */

L.Marker.include({
	openPopup: function () {
		if (this._popup && this._map && !this._map.hasLayer(this._popup)) {
			this._popup.setLatLng(this._latlng);
			this._map.openPopup(this._popup);
		}

		return this;
	},

	closePopup: function () {
		if (this._popup) {
			this._popup._close();
		}
		return this;
	},

	togglePopup: function () {
		if (this._popup) {
			if (this._popup._isOpen) {
				this.closePopup();
			} else {
				this.openPopup();
			}
		}
		return this;
	},

	bindPopup: function (content, options) {
		var anchor = L.point(this.options.icon.options.popupAnchor || [0, 0]);

		anchor = anchor.add(L.Popup.prototype.options.offset);

		if (options && options.offset) {
			anchor = anchor.add(options.offset);
		}

		options = L.extend({offset: anchor}, options);

		if (!this._popupHandlersAdded) {
			this
			    .on('click', this.togglePopup, this)
			    .on('remove', this.closePopup, this)
			    .on('move', this._movePopup, this);
			this._popupHandlersAdded = true;
		}

		if (content instanceof L.Popup) {
			L.setOptions(content, options);
			this._popup = content;
			content._source = this;
		} else {
			this._popup = new L.Popup(options, this)
				.setContent(content);
		}

		return this;
	},

	setPopupContent: function (content) {
		if (this._popup) {
			this._popup.setContent(content);
		}
		return this;
	},

	unbindPopup: function () {
		if (this._popup) {
			this._popup = null;
			this
			    .off('click', this.togglePopup, this)
			    .off('remove', this.closePopup, this)
			    .off('move', this._movePopup, this);
			this._popupHandlersAdded = false;
		}
		return this;
	},

	getPopup: function () {
		return this._popup;
	},

	_movePopup: function (e) {
		this._popup.setLatLng(e.latlng);
	}
});


/*
 * L.LayerGroup is a class to combine several layers into one so that
 * you can manipulate the group (e.g. add/remove it) as one layer.
 */

L.LayerGroup = L.Class.extend({
	initialize: function (layers) {
		this._layers = {};

		var i, len;

		if (layers) {
			for (i = 0, len = layers.length; i < len; i++) {
				this.addLayer(layers[i]);
			}
		}
	},

	addLayer: function (layer) {
		var id = this.getLayerId(layer);

		this._layers[id] = layer;

		if (this._map) {
			this._map.addLayer(layer);
		}

		return this;
	},

	removeLayer: function (layer) {
		var id = layer in this._layers ? layer : this.getLayerId(layer);

		if (this._map && this._layers[id]) {
			this._map.removeLayer(this._layers[id]);
		}

		delete this._layers[id];

		return this;
	},

	hasLayer: function (layer) {
		if (!layer) { return false; }

		return (layer in this._layers || this.getLayerId(layer) in this._layers);
	},

	clearLayers: function () {
		this.eachLayer(this.removeLayer, this);
		return this;
	},

	invoke: function (methodName) {
		var args = Array.prototype.slice.call(arguments, 1),
		    i, layer;

		for (i in this._layers) {
			layer = this._layers[i];

			if (layer[methodName]) {
				layer[methodName].apply(layer, args);
			}
		}

		return this;
	},

	onAdd: function (map) {
		this._map = map;
		this.eachLayer(map.addLayer, map);
	},

	onRemove: function (map) {
		this.eachLayer(map.removeLayer, map);
		this._map = null;
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	eachLayer: function (method, context) {
		for (var i in this._layers) {
			method.call(context, this._layers[i]);
		}
		return this;
	},

	getLayer: function (id) {
		return this._layers[id];
	},

	getLayers: function () {
		var layers = [];

		for (var i in this._layers) {
			layers.push(this._layers[i]);
		}
		return layers;
	},

	setZIndex: function (zIndex) {
		return this.invoke('setZIndex', zIndex);
	},

	getLayerId: function (layer) {
		return L.stamp(layer);
	}
});

L.layerGroup = function (layers) {
	return new L.LayerGroup(layers);
};


/*
 * L.FeatureGroup extends L.LayerGroup by introducing mouse events and additional methods
 * shared between a group of interactive layers (like vectors or markers).
 */

L.FeatureGroup = L.LayerGroup.extend({
	includes: L.Mixin.Events,

	statics: {
		EVENTS: 'click dblclick mouseover mouseout mousemove contextmenu popupopen popupclose'
	},

	addLayer: function (layer) {
		if (this.hasLayer(layer)) {
			return this;
		}

		if ('on' in layer) {
			layer.on(L.FeatureGroup.EVENTS, this._propagateEvent, this);
		}

		L.LayerGroup.prototype.addLayer.call(this, layer);

		if (this._popupContent && layer.bindPopup) {
			layer.bindPopup(this._popupContent, this._popupOptions);
		}

		return this.fire('layeradd', {layer: layer});
	},

	removeLayer: function (layer) {
		if (!this.hasLayer(layer)) {
			return this;
		}
		if (layer in this._layers) {
			layer = this._layers[layer];
		}

		if ('off' in layer) {
			layer.off(L.FeatureGroup.EVENTS, this._propagateEvent, this);
		}

		L.LayerGroup.prototype.removeLayer.call(this, layer);

		if (this._popupContent) {
			this.invoke('unbindPopup');
		}

		return this.fire('layerremove', {layer: layer});
	},

	bindPopup: function (content, options) {
		this._popupContent = content;
		this._popupOptions = options;
		return this.invoke('bindPopup', content, options);
	},

	openPopup: function (latlng) {
		// open popup on the first layer
		for (var id in this._layers) {
			this._layers[id].openPopup(latlng);
			break;
		}
		return this;
	},

	setStyle: function (style) {
		return this.invoke('setStyle', style);
	},

	bringToFront: function () {
		return this.invoke('bringToFront');
	},

	bringToBack: function () {
		return this.invoke('bringToBack');
	},

	getBounds: function () {
		var bounds = new L.LatLngBounds();

		this.eachLayer(function (layer) {
			bounds.extend(layer instanceof L.Marker ? layer.getLatLng() : layer.getBounds());
		});

		return bounds;
	},

	_propagateEvent: function (e) {
		e = L.extend({
			layer: e.target,
			target: this
		}, e);
		this.fire(e.type, e);
	}
});

L.featureGroup = function (layers) {
	return new L.FeatureGroup(layers);
};


/*
 * L.Path is a base class for rendering vector paths on a map. Inherited by Polyline, Circle, etc.
 */

L.Path = L.Class.extend({
	includes: [L.Mixin.Events],

	statics: {
		// how much to extend the clip area around the map view
		// (relative to its size, e.g. 0.5 is half the screen in each direction)
		// set it so that SVG element doesn't exceed 1280px (vectors flicker on dragend if it is)
		CLIP_PADDING: (function () {
			var max = L.Browser.mobile ? 1280 : 2000,
			    target = (max / Math.max(window.outerWidth, window.outerHeight) - 1) / 2;
			return Math.max(0, Math.min(0.5, target));
		})()
	},

	options: {
		stroke: true,
		color: '#0033ff',
		dashArray: null,
		lineCap: null,
		lineJoin: null,
		weight: 5,
		opacity: 0.5,

		fill: false,
		fillColor: null, //same as color by default
		fillOpacity: 0.2,

		clickable: true
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	onAdd: function (map) {
		this._map = map;

		if (!this._container) {
			this._initElements();
			this._initEvents();
		}

		this.projectLatlngs();
		this._updatePath();

		if (this._container) {
			this._map._pathRoot.appendChild(this._container);
		}

		this.fire('add');

		map.on({
			'viewreset': this.projectLatlngs,
			'moveend': this._updatePath
		}, this);
	},

	addTo: function (map) {
		map.addLayer(this);
		return this;
	},

	onRemove: function (map) {
		map._pathRoot.removeChild(this._container);

		// Need to fire remove event before we set _map to null as the event hooks might need the object
		this.fire('remove');
		this._map = null;

		if (L.Browser.vml) {
			this._container = null;
			this._stroke = null;
			this._fill = null;
		}

		map.off({
			'viewreset': this.projectLatlngs,
			'moveend': this._updatePath
		}, this);
	},

	projectLatlngs: function () {
		// do all projection stuff here
	},

	setStyle: function (style) {
		L.setOptions(this, style);

		if (this._container) {
			this._updateStyle();
		}

		return this;
	},

	redraw: function () {
		if (this._map) {
			this.projectLatlngs();
			this._updatePath();
		}
		return this;
	}
});

L.Map.include({
	_updatePathViewport: function () {
		var p = L.Path.CLIP_PADDING,
		    size = this.getSize(),
		    panePos = L.DomUtil.getPosition(this._mapPane),
		    min = panePos.multiplyBy(-1)._subtract(size.multiplyBy(p)._round()),
		    max = min.add(size.multiplyBy(1 + p * 2)._round());

		this._pathViewport = new L.Bounds(min, max);
	}
});


/*
 * Extends L.Path with SVG-specific rendering code.
 */

L.Path.SVG_NS = 'http://www.w3.org/2000/svg';

L.Browser.svg = !!(document.createElementNS && document.createElementNS(L.Path.SVG_NS, 'svg').createSVGRect);

L.Path = L.Path.extend({
	statics: {
		SVG: L.Browser.svg
	},

	bringToFront: function () {
		var root = this._map._pathRoot,
		    path = this._container;

		if (path && root.lastChild !== path) {
			root.appendChild(path);
		}
		return this;
	},

	bringToBack: function () {
		var root = this._map._pathRoot,
		    path = this._container,
		    first = root.firstChild;

		if (path && first !== path) {
			root.insertBefore(path, first);
		}
		return this;
	},

	getPathString: function () {
		// form path string here
	},

	_createElement: function (name) {
		return document.createElementNS(L.Path.SVG_NS, name);
	},

	_initElements: function () {
		this._map._initPathRoot();
		this._initPath();
		this._initStyle();
	},

	_initPath: function () {
		this._container = this._createElement('g');

		this._path = this._createElement('path');

		if (this.options.className) {
			L.DomUtil.addClass(this._path, this.options.className);
		}

		this._container.appendChild(this._path);
	},

	_initStyle: function () {
		if (this.options.stroke) {
			this._path.setAttribute('stroke-linejoin', 'round');
			this._path.setAttribute('stroke-linecap', 'round');
		}
		if (this.options.fill) {
			this._path.setAttribute('fill-rule', 'evenodd');
		}
		if (this.options.pointerEvents) {
			this._path.setAttribute('pointer-events', this.options.pointerEvents);
		}
		if (!this.options.clickable && !this.options.pointerEvents) {
			this._path.setAttribute('pointer-events', 'none');
		}
		this._updateStyle();
	},

	_updateStyle: function () {
		if (this.options.stroke) {
			this._path.setAttribute('stroke', this.options.color);
			this._path.setAttribute('stroke-opacity', this.options.opacity);
			this._path.setAttribute('stroke-width', this.options.weight);
			if (this.options.dashArray) {
				this._path.setAttribute('stroke-dasharray', this.options.dashArray);
			} else {
				this._path.removeAttribute('stroke-dasharray');
			}
			if (this.options.lineCap) {
				this._path.setAttribute('stroke-linecap', this.options.lineCap);
			}
			if (this.options.lineJoin) {
				this._path.setAttribute('stroke-linejoin', this.options.lineJoin);
			}
		} else {
			this._path.setAttribute('stroke', 'none');
		}
		if (this.options.fill) {
			this._path.setAttribute('fill', this.options.fillColor || this.options.color);
			this._path.setAttribute('fill-opacity', this.options.fillOpacity);
		} else {
			this._path.setAttribute('fill', 'none');
		}
	},

	_updatePath: function () {
		var str = this.getPathString();
		if (!str) {
			// fix webkit empty string parsing bug
			str = 'M0 0';
		}
		this._path.setAttribute('d', str);
	},

	// TODO remove duplication with L.Map
	_initEvents: function () {
		if (this.options.clickable) {
			if (L.Browser.svg || !L.Browser.vml) {
				L.DomUtil.addClass(this._path, 'leaflet-clickable');
			}

			L.DomEvent.on(this._container, 'click', this._onMouseClick, this);

			var events = ['dblclick', 'mousedown', 'mouseover',
			              'mouseout', 'mousemove', 'contextmenu'];
			for (var i = 0; i < events.length; i++) {
				L.DomEvent.on(this._container, events[i], this._fireMouseEvent, this);
			}
		}
	},

	_onMouseClick: function (e) {
		if (this._map.dragging && this._map.dragging.moved()) { return; }

		this._fireMouseEvent(e);
	},

	_fireMouseEvent: function (e) {
		if (!this._map || !this.hasEventListeners(e.type)) { return; }

		var map = this._map,
		    containerPoint = map.mouseEventToContainerPoint(e),
		    layerPoint = map.containerPointToLayerPoint(containerPoint),
		    latlng = map.layerPointToLatLng(layerPoint);

		this.fire(e.type, {
			latlng: latlng,
			layerPoint: layerPoint,
			containerPoint: containerPoint,
			originalEvent: e
		});

		if (e.type === 'contextmenu') {
			L.DomEvent.preventDefault(e);
		}
		if (e.type !== 'mousemove') {
			L.DomEvent.stopPropagation(e);
		}
	}
});

L.Map.include({
	_initPathRoot: function () {
		if (!this._pathRoot) {
			this._pathRoot = L.Path.prototype._createElement('svg');
			this._panes.overlayPane.appendChild(this._pathRoot);

			if (this.options.zoomAnimation && L.Browser.any3d) {
				L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-animated');

				this.on({
					'zoomanim': this._animatePathZoom,
					'zoomend': this._endPathZoom
				});
			} else {
				L.DomUtil.addClass(this._pathRoot, 'leaflet-zoom-hide');
			}

			this.on('moveend', this._updateSvgViewport);
			this._updateSvgViewport();
		}
	},

	_animatePathZoom: function (e) {
		var scale = this.getZoomScale(e.zoom),
		    offset = this._getCenterOffset(e.center)._multiplyBy(-scale)._add(this._pathViewport.min);

		this._pathRoot.style[L.DomUtil.TRANSFORM] =
		        L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ') ';

		this._pathZooming = true;
	},

	_endPathZoom: function () {
		this._pathZooming = false;
	},

	_updateSvgViewport: function () {

		if (this._pathZooming) {
			// Do not update SVGs while a zoom animation is going on otherwise the animation will break.
			// When the zoom animation ends we will be updated again anyway
			// This fixes the case where you do a momentum move and zoom while the move is still ongoing.
			return;
		}

		this._updatePathViewport();

		var vp = this._pathViewport,
		    min = vp.min,
		    max = vp.max,
		    width = max.x - min.x,
		    height = max.y - min.y,
		    root = this._pathRoot,
		    pane = this._panes.overlayPane;

		// Hack to make flicker on drag end on mobile webkit less irritating
		if (L.Browser.mobileWebkit) {
			pane.removeChild(root);
		}

		L.DomUtil.setPosition(root, min);
		root.setAttribute('width', width);
		root.setAttribute('height', height);
		root.setAttribute('viewBox', [min.x, min.y, width, height].join(' '));

		if (L.Browser.mobileWebkit) {
			pane.appendChild(root);
		}
	}
});


/*
 * Popup extension to L.Path (polylines, polygons, circles), adding popup-related methods.
 */

L.Path.include({

	bindPopup: function (content, options) {

		if (content instanceof L.Popup) {
			this._popup = content;
		} else {
			if (!this._popup || options) {
				this._popup = new L.Popup(options, this);
			}
			this._popup.setContent(content);
		}

		if (!this._popupHandlersAdded) {
			this
			    .on('click', this._openPopup, this)
			    .on('remove', this.closePopup, this);

			this._popupHandlersAdded = true;
		}

		return this;
	},

	unbindPopup: function () {
		if (this._popup) {
			this._popup = null;
			this
			    .off('click', this._openPopup)
			    .off('remove', this.closePopup);

			this._popupHandlersAdded = false;
		}
		return this;
	},

	openPopup: function (latlng) {

		if (this._popup) {
			// open the popup from one of the path's points if not specified
			latlng = latlng || this._latlng ||
			         this._latlngs[Math.floor(this._latlngs.length / 2)];

			this._openPopup({latlng: latlng});
		}

		return this;
	},

	closePopup: function () {
		if (this._popup) {
			this._popup._close();
		}
		return this;
	},

	_openPopup: function (e) {
		this._popup.setLatLng(e.latlng);
		this._map.openPopup(this._popup);
	}
});


/*
 * Vector rendering for IE6-8 through VML.
 * Thanks to Dmitry Baranovsky and his Raphael library for inspiration!
 */

L.Browser.vml = !L.Browser.svg && (function () {
	try {
		var div = document.createElement('div');
		div.innerHTML = '<v:shape adj="1"/>';

		var shape = div.firstChild;
		shape.style.behavior = 'url(#default#VML)';

		return shape && (typeof shape.adj === 'object');

	} catch (e) {
		return false;
	}
}());

L.Path = L.Browser.svg || !L.Browser.vml ? L.Path : L.Path.extend({
	statics: {
		VML: true,
		CLIP_PADDING: 0.02
	},

	_createElement: (function () {
		try {
			document.namespaces.add('lvml', 'urn:schemas-microsoft-com:vml');
			return function (name) {
				return document.createElement('<lvml:' + name + ' class="lvml">');
			};
		} catch (e) {
			return function (name) {
				return document.createElement(
				        '<' + name + ' xmlns="urn:schemas-microsoft.com:vml" class="lvml">');
			};
		}
	}()),

	_initPath: function () {
		var container = this._container = this._createElement('shape');

		L.DomUtil.addClass(container, 'leaflet-vml-shape' +
			(this.options.className ? ' ' + this.options.className : ''));

		if (this.options.clickable) {
			L.DomUtil.addClass(container, 'leaflet-clickable');
		}

		container.coordsize = '1 1';

		this._path = this._createElement('path');
		container.appendChild(this._path);

		this._map._pathRoot.appendChild(container);
	},

	_initStyle: function () {
		this._updateStyle();
	},

	_updateStyle: function () {
		var stroke = this._stroke,
		    fill = this._fill,
		    options = this.options,
		    container = this._container;

		container.stroked = options.stroke;
		container.filled = options.fill;

		if (options.stroke) {
			if (!stroke) {
				stroke = this._stroke = this._createElement('stroke');
				stroke.endcap = 'round';
				container.appendChild(stroke);
			}
			stroke.weight = options.weight + 'px';
			stroke.color = options.color;
			stroke.opacity = options.opacity;

			if (options.dashArray) {
				stroke.dashStyle = L.Util.isArray(options.dashArray) ?
				    options.dashArray.join(' ') :
				    options.dashArray.replace(/( *, *)/g, ' ');
			} else {
				stroke.dashStyle = '';
			}
			if (options.lineCap) {
				stroke.endcap = options.lineCap.replace('butt', 'flat');
			}
			if (options.lineJoin) {
				stroke.joinstyle = options.lineJoin;
			}

		} else if (stroke) {
			container.removeChild(stroke);
			this._stroke = null;
		}

		if (options.fill) {
			if (!fill) {
				fill = this._fill = this._createElement('fill');
				container.appendChild(fill);
			}
			fill.color = options.fillColor || options.color;
			fill.opacity = options.fillOpacity;

		} else if (fill) {
			container.removeChild(fill);
			this._fill = null;
		}
	},

	_updatePath: function () {
		var style = this._container.style;

		style.display = 'none';
		this._path.v = this.getPathString() + ' '; // the space fixes IE empty path string bug
		style.display = '';
	}
});

L.Map.include(L.Browser.svg || !L.Browser.vml ? {} : {
	_initPathRoot: function () {
		if (this._pathRoot) { return; }

		var root = this._pathRoot = document.createElement('div');
		root.className = 'leaflet-vml-container';
		this._panes.overlayPane.appendChild(root);

		this.on('moveend', this._updatePathViewport);
		this._updatePathViewport();
	}
});


/*
 * Vector rendering for all browsers that support canvas.
 */

L.Browser.canvas = (function () {
	return !!document.createElement('canvas').getContext;
}());

L.Path = (L.Path.SVG && !window.L_PREFER_CANVAS) || !L.Browser.canvas ? L.Path : L.Path.extend({
	statics: {
		//CLIP_PADDING: 0.02, // not sure if there's a need to set it to a small value
		CANVAS: true,
		SVG: false
	},

	redraw: function () {
		if (this._map) {
			this.projectLatlngs();
			this._requestUpdate();
		}
		return this;
	},

	setStyle: function (style) {
		L.setOptions(this, style);

		if (this._map) {
			this._updateStyle();
			this._requestUpdate();
		}
		return this;
	},

	onRemove: function (map) {
		map
		    .off('viewreset', this.projectLatlngs, this)
		    .off('moveend', this._updatePath, this);

		if (this.options.clickable) {
			this._map.off('click', this._onClick, this);
			this._map.off('mousemove', this._onMouseMove, this);
		}

		this._requestUpdate();
		
		this.fire('remove');
		this._map = null;
	},

	_requestUpdate: function () {
		if (this._map && !L.Path._updateRequest) {
			L.Path._updateRequest = L.Util.requestAnimFrame(this._fireMapMoveEnd, this._map);
		}
	},

	_fireMapMoveEnd: function () {
		L.Path._updateRequest = null;
		this.fire('moveend');
	},

	_initElements: function () {
		this._map._initPathRoot();
		this._ctx = this._map._canvasCtx;
	},

	_updateStyle: function () {
		var options = this.options;

		if (options.stroke) {
			this._ctx.lineWidth = options.weight;
			this._ctx.strokeStyle = options.color;
		}
		if (options.fill) {
			this._ctx.fillStyle = options.fillColor || options.color;
		}

		if (options.lineCap) {
			this._ctx.lineCap = options.lineCap;
		}
		if (options.lineJoin) {
			this._ctx.lineJoin = options.lineJoin;
		}
	},

	_drawPath: function () {
		var i, j, len, len2, point, drawMethod;

		this._ctx.beginPath();

		for (i = 0, len = this._parts.length; i < len; i++) {
			for (j = 0, len2 = this._parts[i].length; j < len2; j++) {
				point = this._parts[i][j];
				drawMethod = (j === 0 ? 'move' : 'line') + 'To';

				this._ctx[drawMethod](point.x, point.y);
			}
			// TODO refactor ugly hack
			if (this instanceof L.Polygon) {
				this._ctx.closePath();
			}
		}
	},

	_checkIfEmpty: function () {
		return !this._parts.length;
	},

	_updatePath: function () {
		if (this._checkIfEmpty()) { return; }

		var ctx = this._ctx,
		    options = this.options;

		this._drawPath();
		ctx.save();
		this._updateStyle();

		if (options.fill) {
			ctx.globalAlpha = options.fillOpacity;
			ctx.fill(options.fillRule || 'evenodd');
		}

		if (options.stroke) {
			ctx.globalAlpha = options.opacity;
			ctx.stroke();
		}

		ctx.restore();

		// TODO optimization: 1 fill/stroke for all features with equal style instead of 1 for each feature
	},

	_initEvents: function () {
		if (this.options.clickable) {
			this._map.on('mousemove', this._onMouseMove, this);
			this._map.on('click dblclick contextmenu', this._fireMouseEvent, this);
		}
	},

	_fireMouseEvent: function (e) {
		if (this._containsPoint(e.layerPoint)) {
			this.fire(e.type, e);
		}
	},

	_onMouseMove: function (e) {
		if (!this._map || this._map._animatingZoom) { return; }

		// TODO don't do on each move
		if (this._containsPoint(e.layerPoint)) {
			this._ctx.canvas.style.cursor = 'pointer';
			this._mouseInside = true;
			this.fire('mouseover', e);

		} else if (this._mouseInside) {
			this._ctx.canvas.style.cursor = '';
			this._mouseInside = false;
			this.fire('mouseout', e);
		}
	}
});

L.Map.include((L.Path.SVG && !window.L_PREFER_CANVAS) || !L.Browser.canvas ? {} : {
	_initPathRoot: function () {
		var root = this._pathRoot,
		    ctx;

		if (!root) {
			root = this._pathRoot = document.createElement('canvas');
			root.style.position = 'absolute';
			ctx = this._canvasCtx = root.getContext('2d');

			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';

			this._panes.overlayPane.appendChild(root);

			if (this.options.zoomAnimation) {
				this._pathRoot.className = 'leaflet-zoom-animated';
				this.on('zoomanim', this._animatePathZoom);
				this.on('zoomend', this._endPathZoom);
			}
			this.on('moveend', this._updateCanvasViewport);
			this._updateCanvasViewport();
		}
	},

	_updateCanvasViewport: function () {
		// don't redraw while zooming. See _updateSvgViewport for more details
		if (this._pathZooming) { return; }
		this._updatePathViewport();

		var vp = this._pathViewport,
		    min = vp.min,
		    size = vp.max.subtract(min),
		    root = this._pathRoot;

		//TODO check if this works properly on mobile webkit
		L.DomUtil.setPosition(root, min);
		root.width = size.x;
		root.height = size.y;
		root.getContext('2d').translate(-min.x, -min.y);
	}
});


/*
 * L.LineUtil contains different utility functions for line segments
 * and polylines (clipping, simplification, distances, etc.)
 */

/*jshint bitwise:false */ // allow bitwise operations for this file

L.LineUtil = {

	// Simplify polyline with vertex reduction and Douglas-Peucker simplification.
	// Improves rendering performance dramatically by lessening the number of points to draw.

	simplify: function (/*Point[]*/ points, /*Number*/ tolerance) {
		if (!tolerance || !points.length) {
			return points.slice();
		}

		var sqTolerance = tolerance * tolerance;

		// stage 1: vertex reduction
		points = this._reducePoints(points, sqTolerance);

		// stage 2: Douglas-Peucker simplification
		points = this._simplifyDP(points, sqTolerance);

		return points;
	},

	// distance from a point to a segment between two points
	pointToSegmentDistance:  function (/*Point*/ p, /*Point*/ p1, /*Point*/ p2) {
		return Math.sqrt(this._sqClosestPointOnSegment(p, p1, p2, true));
	},

	closestPointOnSegment: function (/*Point*/ p, /*Point*/ p1, /*Point*/ p2) {
		return this._sqClosestPointOnSegment(p, p1, p2);
	},

	// Douglas-Peucker simplification, see http://en.wikipedia.org/wiki/Douglas-Peucker_algorithm
	_simplifyDP: function (points, sqTolerance) {

		var len = points.length,
		    ArrayConstructor = typeof Uint8Array !== undefined + '' ? Uint8Array : Array,
		    markers = new ArrayConstructor(len);

		markers[0] = markers[len - 1] = 1;

		this._simplifyDPStep(points, markers, sqTolerance, 0, len - 1);

		var i,
		    newPoints = [];

		for (i = 0; i < len; i++) {
			if (markers[i]) {
				newPoints.push(points[i]);
			}
		}

		return newPoints;
	},

	_simplifyDPStep: function (points, markers, sqTolerance, first, last) {

		var maxSqDist = 0,
		    index, i, sqDist;

		for (i = first + 1; i <= last - 1; i++) {
			sqDist = this._sqClosestPointOnSegment(points[i], points[first], points[last], true);

			if (sqDist > maxSqDist) {
				index = i;
				maxSqDist = sqDist;
			}
		}

		if (maxSqDist > sqTolerance) {
			markers[index] = 1;

			this._simplifyDPStep(points, markers, sqTolerance, first, index);
			this._simplifyDPStep(points, markers, sqTolerance, index, last);
		}
	},

	// reduce points that are too close to each other to a single point
	_reducePoints: function (points, sqTolerance) {
		var reducedPoints = [points[0]];

		for (var i = 1, prev = 0, len = points.length; i < len; i++) {
			if (this._sqDist(points[i], points[prev]) > sqTolerance) {
				reducedPoints.push(points[i]);
				prev = i;
			}
		}
		if (prev < len - 1) {
			reducedPoints.push(points[len - 1]);
		}
		return reducedPoints;
	},

	// Cohen-Sutherland line clipping algorithm.
	// Used to avoid rendering parts of a polyline that are not currently visible.

	clipSegment: function (a, b, bounds, useLastCode) {
		var codeA = useLastCode ? this._lastCode : this._getBitCode(a, bounds),
		    codeB = this._getBitCode(b, bounds),

		    codeOut, p, newCode;

		// save 2nd code to avoid calculating it on the next segment
		this._lastCode = codeB;

		while (true) {
			// if a,b is inside the clip window (trivial accept)
			if (!(codeA | codeB)) {
				return [a, b];
			// if a,b is outside the clip window (trivial reject)
			} else if (codeA & codeB) {
				return false;
			// other cases
			} else {
				codeOut = codeA || codeB;
				p = this._getEdgeIntersection(a, b, codeOut, bounds);
				newCode = this._getBitCode(p, bounds);

				if (codeOut === codeA) {
					a = p;
					codeA = newCode;
				} else {
					b = p;
					codeB = newCode;
				}
			}
		}
	},

	_getEdgeIntersection: function (a, b, code, bounds) {
		var dx = b.x - a.x,
		    dy = b.y - a.y,
		    min = bounds.min,
		    max = bounds.max;

		if (code & 8) { // top
			return new L.Point(a.x + dx * (max.y - a.y) / dy, max.y);
		} else if (code & 4) { // bottom
			return new L.Point(a.x + dx * (min.y - a.y) / dy, min.y);
		} else if (code & 2) { // right
			return new L.Point(max.x, a.y + dy * (max.x - a.x) / dx);
		} else if (code & 1) { // left
			return new L.Point(min.x, a.y + dy * (min.x - a.x) / dx);
		}
	},

	_getBitCode: function (/*Point*/ p, bounds) {
		var code = 0;

		if (p.x < bounds.min.x) { // left
			code |= 1;
		} else if (p.x > bounds.max.x) { // right
			code |= 2;
		}
		if (p.y < bounds.min.y) { // bottom
			code |= 4;
		} else if (p.y > bounds.max.y) { // top
			code |= 8;
		}

		return code;
	},

	// square distance (to avoid unnecessary Math.sqrt calls)
	_sqDist: function (p1, p2) {
		var dx = p2.x - p1.x,
		    dy = p2.y - p1.y;
		return dx * dx + dy * dy;
	},

	// return closest point on segment or distance to that point
	_sqClosestPointOnSegment: function (p, p1, p2, sqDist) {
		var x = p1.x,
		    y = p1.y,
		    dx = p2.x - x,
		    dy = p2.y - y,
		    dot = dx * dx + dy * dy,
		    t;

		if (dot > 0) {
			t = ((p.x - x) * dx + (p.y - y) * dy) / dot;

			if (t > 1) {
				x = p2.x;
				y = p2.y;
			} else if (t > 0) {
				x += dx * t;
				y += dy * t;
			}
		}

		dx = p.x - x;
		dy = p.y - y;

		return sqDist ? dx * dx + dy * dy : new L.Point(x, y);
	}
};


/*
 * L.Polyline is used to display polylines on a map.
 */

L.Polyline = L.Path.extend({
	initialize: function (latlngs, options) {
		L.Path.prototype.initialize.call(this, options);

		this._latlngs = this._convertLatLngs(latlngs);
	},

	options: {
		// how much to simplify the polyline on each zoom level
		// more = better performance and smoother look, less = more accurate
		smoothFactor: 1.0,
		noClip: false
	},

	projectLatlngs: function () {
		this._originalPoints = [];

		for (var i = 0, len = this._latlngs.length; i < len; i++) {
			this._originalPoints[i] = this._map.latLngToLayerPoint(this._latlngs[i]);
		}
	},

	getPathString: function () {
		for (var i = 0, len = this._parts.length, str = ''; i < len; i++) {
			str += this._getPathPartStr(this._parts[i]);
		}
		return str;
	},

	getLatLngs: function () {
		return this._latlngs;
	},

	setLatLngs: function (latlngs) {
		this._latlngs = this._convertLatLngs(latlngs);
		return this.redraw();
	},

	addLatLng: function (latlng) {
		this._latlngs.push(L.latLng(latlng));
		return this.redraw();
	},

	spliceLatLngs: function () { // (Number index, Number howMany)
		var removed = [].splice.apply(this._latlngs, arguments);
		this._convertLatLngs(this._latlngs, true);
		this.redraw();
		return removed;
	},

	closestLayerPoint: function (p) {
		var minDistance = Infinity, parts = this._parts, p1, p2, minPoint = null;

		for (var j = 0, jLen = parts.length; j < jLen; j++) {
			var points = parts[j];
			for (var i = 1, len = points.length; i < len; i++) {
				p1 = points[i - 1];
				p2 = points[i];
				var sqDist = L.LineUtil._sqClosestPointOnSegment(p, p1, p2, true);
				if (sqDist < minDistance) {
					minDistance = sqDist;
					minPoint = L.LineUtil._sqClosestPointOnSegment(p, p1, p2);
				}
			}
		}
		if (minPoint) {
			minPoint.distance = Math.sqrt(minDistance);
		}
		return minPoint;
	},

	getBounds: function () {
		return new L.LatLngBounds(this.getLatLngs());
	},

	_convertLatLngs: function (latlngs, overwrite) {
		var i, len, target = overwrite ? latlngs : [];

		for (i = 0, len = latlngs.length; i < len; i++) {
			if (L.Util.isArray(latlngs[i]) && typeof latlngs[i][0] !== 'number') {
				return;
			}
			target[i] = L.latLng(latlngs[i]);
		}
		return target;
	},

	_initEvents: function () {
		L.Path.prototype._initEvents.call(this);
	},

	_getPathPartStr: function (points) {
		var round = L.Path.VML;

		for (var j = 0, len2 = points.length, str = '', p; j < len2; j++) {
			p = points[j];
			if (round) {
				p._round();
			}
			str += (j ? 'L' : 'M') + p.x + ' ' + p.y;
		}
		return str;
	},

	_clipPoints: function () {
		var points = this._originalPoints,
		    len = points.length,
		    i, k, segment;

		if (this.options.noClip) {
			this._parts = [points];
			return;
		}

		this._parts = [];

		var parts = this._parts,
		    vp = this._map._pathViewport,
		    lu = L.LineUtil;

		for (i = 0, k = 0; i < len - 1; i++) {
			segment = lu.clipSegment(points[i], points[i + 1], vp, i);
			if (!segment) {
				continue;
			}

			parts[k] = parts[k] || [];
			parts[k].push(segment[0]);

			// if segment goes out of screen, or it's the last one, it's the end of the line part
			if ((segment[1] !== points[i + 1]) || (i === len - 2)) {
				parts[k].push(segment[1]);
				k++;
			}
		}
	},

	// simplify each clipped part of the polyline
	_simplifyPoints: function () {
		var parts = this._parts,
		    lu = L.LineUtil;

		for (var i = 0, len = parts.length; i < len; i++) {
			parts[i] = lu.simplify(parts[i], this.options.smoothFactor);
		}
	},

	_updatePath: function () {
		if (!this._map) { return; }

		this._clipPoints();
		this._simplifyPoints();

		L.Path.prototype._updatePath.call(this);
	}
});

L.polyline = function (latlngs, options) {
	return new L.Polyline(latlngs, options);
};


/*
 * L.PolyUtil contains utility functions for polygons (clipping, etc.).
 */

/*jshint bitwise:false */ // allow bitwise operations here

L.PolyUtil = {};

/*
 * Sutherland-Hodgeman polygon clipping algorithm.
 * Used to avoid rendering parts of a polygon that are not currently visible.
 */
L.PolyUtil.clipPolygon = function (points, bounds) {
	var clippedPoints,
	    edges = [1, 4, 2, 8],
	    i, j, k,
	    a, b,
	    len, edge, p,
	    lu = L.LineUtil;

	for (i = 0, len = points.length; i < len; i++) {
		points[i]._code = lu._getBitCode(points[i], bounds);
	}

	// for each edge (left, bottom, right, top)
	for (k = 0; k < 4; k++) {
		edge = edges[k];
		clippedPoints = [];

		for (i = 0, len = points.length, j = len - 1; i < len; j = i++) {
			a = points[i];
			b = points[j];

			// if a is inside the clip window
			if (!(a._code & edge)) {
				// if b is outside the clip window (a->b goes out of screen)
				if (b._code & edge) {
					p = lu._getEdgeIntersection(b, a, edge, bounds);
					p._code = lu._getBitCode(p, bounds);
					clippedPoints.push(p);
				}
				clippedPoints.push(a);

			// else if b is inside the clip window (a->b enters the screen)
			} else if (!(b._code & edge)) {
				p = lu._getEdgeIntersection(b, a, edge, bounds);
				p._code = lu._getBitCode(p, bounds);
				clippedPoints.push(p);
			}
		}
		points = clippedPoints;
	}

	return points;
};


/*
 * L.Polygon is used to display polygons on a map.
 */

L.Polygon = L.Polyline.extend({
	options: {
		fill: true
	},

	initialize: function (latlngs, options) {
		L.Polyline.prototype.initialize.call(this, latlngs, options);
		this._initWithHoles(latlngs);
	},

	_initWithHoles: function (latlngs) {
		var i, len, hole;
		if (latlngs && L.Util.isArray(latlngs[0]) && (typeof latlngs[0][0] !== 'number')) {
			this._latlngs = this._convertLatLngs(latlngs[0]);
			this._holes = latlngs.slice(1);

			for (i = 0, len = this._holes.length; i < len; i++) {
				hole = this._holes[i] = this._convertLatLngs(this._holes[i]);
				if (hole[0].equals(hole[hole.length - 1])) {
					hole.pop();
				}
			}
		}

		// filter out last point if its equal to the first one
		latlngs = this._latlngs;

		if (latlngs.length >= 2 && latlngs[0].equals(latlngs[latlngs.length - 1])) {
			latlngs.pop();
		}
	},

	projectLatlngs: function () {
		L.Polyline.prototype.projectLatlngs.call(this);

		// project polygon holes points
		// TODO move this logic to Polyline to get rid of duplication
		this._holePoints = [];

		if (!this._holes) { return; }

		var i, j, len, len2;

		for (i = 0, len = this._holes.length; i < len; i++) {
			this._holePoints[i] = [];

			for (j = 0, len2 = this._holes[i].length; j < len2; j++) {
				this._holePoints[i][j] = this._map.latLngToLayerPoint(this._holes[i][j]);
			}
		}
	},

	setLatLngs: function (latlngs) {
		if (latlngs && L.Util.isArray(latlngs[0]) && (typeof latlngs[0][0] !== 'number')) {
			this._initWithHoles(latlngs);
			return this.redraw();
		} else {
			return L.Polyline.prototype.setLatLngs.call(this, latlngs);
		}
	},

	_clipPoints: function () {
		var points = this._originalPoints,
		    newParts = [];

		this._parts = [points].concat(this._holePoints);

		if (this.options.noClip) { return; }

		for (var i = 0, len = this._parts.length; i < len; i++) {
			var clipped = L.PolyUtil.clipPolygon(this._parts[i], this._map._pathViewport);
			if (clipped.length) {
				newParts.push(clipped);
			}
		}

		this._parts = newParts;
	},

	_getPathPartStr: function (points) {
		var str = L.Polyline.prototype._getPathPartStr.call(this, points);
		return str + (L.Browser.svg ? 'z' : 'x');
	}
});

L.polygon = function (latlngs, options) {
	return new L.Polygon(latlngs, options);
};


/*
 * Contains L.MultiPolyline and L.MultiPolygon layers.
 */

(function () {
	function createMulti(Klass) {

		return L.FeatureGroup.extend({

			initialize: function (latlngs, options) {
				this._layers = {};
				this._options = options;
				this.setLatLngs(latlngs);
			},

			setLatLngs: function (latlngs) {
				var i = 0,
				    len = latlngs.length;

				this.eachLayer(function (layer) {
					if (i < len) {
						layer.setLatLngs(latlngs[i++]);
					} else {
						this.removeLayer(layer);
					}
				}, this);

				while (i < len) {
					this.addLayer(new Klass(latlngs[i++], this._options));
				}

				return this;
			},

			getLatLngs: function () {
				var latlngs = [];

				this.eachLayer(function (layer) {
					latlngs.push(layer.getLatLngs());
				});

				return latlngs;
			}
		});
	}

	L.MultiPolyline = createMulti(L.Polyline);
	L.MultiPolygon = createMulti(L.Polygon);

	L.multiPolyline = function (latlngs, options) {
		return new L.MultiPolyline(latlngs, options);
	};

	L.multiPolygon = function (latlngs, options) {
		return new L.MultiPolygon(latlngs, options);
	};
}());


/*
 * L.Rectangle extends Polygon and creates a rectangle when passed a LatLngBounds object.
 */

L.Rectangle = L.Polygon.extend({
	initialize: function (latLngBounds, options) {
		L.Polygon.prototype.initialize.call(this, this._boundsToLatLngs(latLngBounds), options);
	},

	setBounds: function (latLngBounds) {
		this.setLatLngs(this._boundsToLatLngs(latLngBounds));
	},

	_boundsToLatLngs: function (latLngBounds) {
		latLngBounds = L.latLngBounds(latLngBounds);
		return [
			latLngBounds.getSouthWest(),
			latLngBounds.getNorthWest(),
			latLngBounds.getNorthEast(),
			latLngBounds.getSouthEast()
		];
	}
});

L.rectangle = function (latLngBounds, options) {
	return new L.Rectangle(latLngBounds, options);
};


/*
 * L.Circle is a circle overlay (with a certain radius in meters).
 */

L.Circle = L.Path.extend({
	initialize: function (latlng, radius, options) {
		L.Path.prototype.initialize.call(this, options);

		this._latlng = L.latLng(latlng);
		this._mRadius = radius;
	},

	options: {
		fill: true
	},

	setLatLng: function (latlng) {
		this._latlng = L.latLng(latlng);
		return this.redraw();
	},

	setRadius: function (radius) {
		this._mRadius = radius;
		return this.redraw();
	},

	projectLatlngs: function () {
		var lngRadius = this._getLngRadius(),
		    latlng = this._latlng,
		    pointLeft = this._map.latLngToLayerPoint([latlng.lat, latlng.lng - lngRadius]);

		this._point = this._map.latLngToLayerPoint(latlng);
		this._radius = Math.max(this._point.x - pointLeft.x, 1);
	},

	getBounds: function () {
		var lngRadius = this._getLngRadius(),
		    latRadius = (this._mRadius / 40075017) * 360,
		    latlng = this._latlng;

		return new L.LatLngBounds(
		        [latlng.lat - latRadius, latlng.lng - lngRadius],
		        [latlng.lat + latRadius, latlng.lng + lngRadius]);
	},

	getLatLng: function () {
		return this._latlng;
	},

	getPathString: function () {
		var p = this._point,
		    r = this._radius;

		if (this._checkIfEmpty()) {
			return '';
		}

		if (L.Browser.svg) {
			return 'M' + p.x + ',' + (p.y - r) +
			       'A' + r + ',' + r + ',0,1,1,' +
			       (p.x - 0.1) + ',' + (p.y - r) + ' z';
		} else {
			p._round();
			r = Math.round(r);
			return 'AL ' + p.x + ',' + p.y + ' ' + r + ',' + r + ' 0,' + (65535 * 360);
		}
	},

	getRadius: function () {
		return this._mRadius;
	},

	// TODO Earth hardcoded, move into projection code!

	_getLatRadius: function () {
		return (this._mRadius / 40075017) * 360;
	},

	_getLngRadius: function () {
		return this._getLatRadius() / Math.cos(L.LatLng.DEG_TO_RAD * this._latlng.lat);
	},

	_checkIfEmpty: function () {
		if (!this._map) {
			return false;
		}
		var vp = this._map._pathViewport,
		    r = this._radius,
		    p = this._point;

		return p.x - r > vp.max.x || p.y - r > vp.max.y ||
		       p.x + r < vp.min.x || p.y + r < vp.min.y;
	}
});

L.circle = function (latlng, radius, options) {
	return new L.Circle(latlng, radius, options);
};


/*
 * L.CircleMarker is a circle overlay with a permanent pixel radius.
 */

L.CircleMarker = L.Circle.extend({
	options: {
		radius: 10,
		weight: 2
	},

	initialize: function (latlng, options) {
		L.Circle.prototype.initialize.call(this, latlng, null, options);
		this._radius = this.options.radius;
	},

	projectLatlngs: function () {
		this._point = this._map.latLngToLayerPoint(this._latlng);
	},

	_updateStyle : function () {
		L.Circle.prototype._updateStyle.call(this);
		this.setRadius(this.options.radius);
	},

	setLatLng: function (latlng) {
		L.Circle.prototype.setLatLng.call(this, latlng);
		if (this._popup && this._popup._isOpen) {
			this._popup.setLatLng(latlng);
		}
		return this;
	},

	setRadius: function (radius) {
		this.options.radius = this._radius = radius;
		return this.redraw();
	},

	getRadius: function () {
		return this._radius;
	}
});

L.circleMarker = function (latlng, options) {
	return new L.CircleMarker(latlng, options);
};


/*
 * Extends L.Polyline to be able to manually detect clicks on Canvas-rendered polylines.
 */

L.Polyline.include(!L.Path.CANVAS ? {} : {
	_containsPoint: function (p, closed) {
		var i, j, k, len, len2, dist, part,
		    w = this.options.weight / 2;

		if (L.Browser.touch) {
			w += 10; // polyline click tolerance on touch devices
		}

		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];
			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				if (!closed && (j === 0)) {
					continue;
				}

				dist = L.LineUtil.pointToSegmentDistance(p, part[k], part[j]);

				if (dist <= w) {
					return true;
				}
			}
		}
		return false;
	}
});


/*
 * Extends L.Polygon to be able to manually detect clicks on Canvas-rendered polygons.
 */

L.Polygon.include(!L.Path.CANVAS ? {} : {
	_containsPoint: function (p) {
		var inside = false,
		    part, p1, p2,
		    i, j, k,
		    len, len2;

		// TODO optimization: check if within bounds first

		if (L.Polyline.prototype._containsPoint.call(this, p, true)) {
			// click on polygon border
			return true;
		}

		// ray casting algorithm for detecting if point is in polygon

		for (i = 0, len = this._parts.length; i < len; i++) {
			part = this._parts[i];

			for (j = 0, len2 = part.length, k = len2 - 1; j < len2; k = j++) {
				p1 = part[j];
				p2 = part[k];

				if (((p1.y > p.y) !== (p2.y > p.y)) &&
						(p.x < (p2.x - p1.x) * (p.y - p1.y) / (p2.y - p1.y) + p1.x)) {
					inside = !inside;
				}
			}
		}

		return inside;
	}
});


/*
 * Extends L.Circle with Canvas-specific code.
 */

L.Circle.include(!L.Path.CANVAS ? {} : {
	_drawPath: function () {
		var p = this._point;
		this._ctx.beginPath();
		this._ctx.arc(p.x, p.y, this._radius, 0, Math.PI * 2, false);
	},

	_containsPoint: function (p) {
		var center = this._point,
		    w2 = this.options.stroke ? this.options.weight / 2 : 0;

		return (p.distanceTo(center) <= this._radius + w2);
	}
});


/*
 * CircleMarker canvas specific drawing parts.
 */

L.CircleMarker.include(!L.Path.CANVAS ? {} : {
	_updateStyle: function () {
		L.Path.prototype._updateStyle.call(this);
	}
});


/*
 * L.GeoJSON turns any GeoJSON data into a Leaflet layer.
 */

L.GeoJSON = L.FeatureGroup.extend({

	initialize: function (geojson, options) {
		L.setOptions(this, options);

		this._layers = {};

		if (geojson) {
			this.addData(geojson);
		}
	},

	addData: function (geojson) {
		var features = L.Util.isArray(geojson) ? geojson : geojson.features,
		    i, len, feature;

		if (features) {
			for (i = 0, len = features.length; i < len; i++) {
				// Only add this if geometry or geometries are set and not null
				feature = features[i];
				if (feature.geometries || feature.geometry || feature.features || feature.coordinates) {
					this.addData(features[i]);
				}
			}
			return this;
		}

		var options = this.options;

		if (options.filter && !options.filter(geojson)) { return; }

		var layer = L.GeoJSON.geometryToLayer(geojson, options.pointToLayer, options.coordsToLatLng, options);
		layer.feature = L.GeoJSON.asFeature(geojson);

		layer.defaultOptions = layer.options;
		this.resetStyle(layer);

		if (options.onEachFeature) {
			options.onEachFeature(geojson, layer);
		}

		return this.addLayer(layer);
	},

	resetStyle: function (layer) {
		var style = this.options.style;
		if (style) {
			// reset any custom styles
			L.Util.extend(layer.options, layer.defaultOptions);

			this._setLayerStyle(layer, style);
		}
	},

	setStyle: function (style) {
		this.eachLayer(function (layer) {
			this._setLayerStyle(layer, style);
		}, this);
	},

	_setLayerStyle: function (layer, style) {
		if (typeof style === 'function') {
			style = style(layer.feature);
		}
		if (layer.setStyle) {
			layer.setStyle(style);
		}
	}
});

L.extend(L.GeoJSON, {
	geometryToLayer: function (geojson, pointToLayer, coordsToLatLng, vectorOptions) {
		var geometry = geojson.type === 'Feature' ? geojson.geometry : geojson,
		    coords = geometry.coordinates,
		    layers = [],
		    latlng, latlngs, i, len;

		coordsToLatLng = coordsToLatLng || this.coordsToLatLng;

		switch (geometry.type) {
		case 'Point':
			latlng = coordsToLatLng(coords);
			return pointToLayer ? pointToLayer(geojson, latlng) : new L.Marker(latlng);

		case 'MultiPoint':
			for (i = 0, len = coords.length; i < len; i++) {
				latlng = coordsToLatLng(coords[i]);
				layers.push(pointToLayer ? pointToLayer(geojson, latlng) : new L.Marker(latlng));
			}
			return new L.FeatureGroup(layers);

		case 'LineString':
			latlngs = this.coordsToLatLngs(coords, 0, coordsToLatLng);
			return new L.Polyline(latlngs, vectorOptions);

		case 'Polygon':
			if (coords.length === 2 && !coords[1].length) {
				throw new Error('Invalid GeoJSON object.');
			}
			latlngs = this.coordsToLatLngs(coords, 1, coordsToLatLng);
			return new L.Polygon(latlngs, vectorOptions);

		case 'MultiLineString':
			latlngs = this.coordsToLatLngs(coords, 1, coordsToLatLng);
			return new L.MultiPolyline(latlngs, vectorOptions);

		case 'MultiPolygon':
			latlngs = this.coordsToLatLngs(coords, 2, coordsToLatLng);
			return new L.MultiPolygon(latlngs, vectorOptions);

		case 'GeometryCollection':
			for (i = 0, len = geometry.geometries.length; i < len; i++) {

				layers.push(this.geometryToLayer({
					geometry: geometry.geometries[i],
					type: 'Feature',
					properties: geojson.properties
				}, pointToLayer, coordsToLatLng, vectorOptions));
			}
			return new L.FeatureGroup(layers);

		default:
			throw new Error('Invalid GeoJSON object.');
		}
	},

	coordsToLatLng: function (coords) { // (Array[, Boolean]) -> LatLng
		return new L.LatLng(coords[1], coords[0], coords[2]);
	},

	coordsToLatLngs: function (coords, levelsDeep, coordsToLatLng) { // (Array[, Number, Function]) -> Array
		var latlng, i, len,
		    latlngs = [];

		for (i = 0, len = coords.length; i < len; i++) {
			latlng = levelsDeep ?
			        this.coordsToLatLngs(coords[i], levelsDeep - 1, coordsToLatLng) :
			        (coordsToLatLng || this.coordsToLatLng)(coords[i]);

			latlngs.push(latlng);
		}

		return latlngs;
	},

	latLngToCoords: function (latlng) {
		var coords = [latlng.lng, latlng.lat];

		if (latlng.alt !== undefined) {
			coords.push(latlng.alt);
		}
		return coords;
	},

	latLngsToCoords: function (latLngs) {
		var coords = [];

		for (var i = 0, len = latLngs.length; i < len; i++) {
			coords.push(L.GeoJSON.latLngToCoords(latLngs[i]));
		}

		return coords;
	},

	getFeature: function (layer, newGeometry) {
		return layer.feature ? L.extend({}, layer.feature, {geometry: newGeometry}) : L.GeoJSON.asFeature(newGeometry);
	},

	asFeature: function (geoJSON) {
		if (geoJSON.type === 'Feature') {
			return geoJSON;
		}

		return {
			type: 'Feature',
			properties: {},
			geometry: geoJSON
		};
	}
});

var PointToGeoJSON = {
	toGeoJSON: function () {
		return L.GeoJSON.getFeature(this, {
			type: 'Point',
			coordinates: L.GeoJSON.latLngToCoords(this.getLatLng())
		});
	}
};

L.Marker.include(PointToGeoJSON);
L.Circle.include(PointToGeoJSON);
L.CircleMarker.include(PointToGeoJSON);

L.Polyline.include({
	toGeoJSON: function () {
		return L.GeoJSON.getFeature(this, {
			type: 'LineString',
			coordinates: L.GeoJSON.latLngsToCoords(this.getLatLngs())
		});
	}
});

L.Polygon.include({
	toGeoJSON: function () {
		var coords = [L.GeoJSON.latLngsToCoords(this.getLatLngs())],
		    i, len, hole;

		coords[0].push(coords[0][0]);

		if (this._holes) {
			for (i = 0, len = this._holes.length; i < len; i++) {
				hole = L.GeoJSON.latLngsToCoords(this._holes[i]);
				hole.push(hole[0]);
				coords.push(hole);
			}
		}

		return L.GeoJSON.getFeature(this, {
			type: 'Polygon',
			coordinates: coords
		});
	}
});

(function () {
	function multiToGeoJSON(type) {
		return function () {
			var coords = [];

			this.eachLayer(function (layer) {
				coords.push(layer.toGeoJSON().geometry.coordinates);
			});

			return L.GeoJSON.getFeature(this, {
				type: type,
				coordinates: coords
			});
		};
	}

	L.MultiPolyline.include({toGeoJSON: multiToGeoJSON('MultiLineString')});
	L.MultiPolygon.include({toGeoJSON: multiToGeoJSON('MultiPolygon')});

	L.LayerGroup.include({
		toGeoJSON: function () {

			var geometry = this.feature && this.feature.geometry,
				jsons = [],
				json;

			if (geometry && geometry.type === 'MultiPoint') {
				return multiToGeoJSON('MultiPoint').call(this);
			}

			var isGeometryCollection = geometry && geometry.type === 'GeometryCollection';

			this.eachLayer(function (layer) {
				if (layer.toGeoJSON) {
					json = layer.toGeoJSON();
					jsons.push(isGeometryCollection ? json.geometry : L.GeoJSON.asFeature(json));
				}
			});

			if (isGeometryCollection) {
				return L.GeoJSON.getFeature(this, {
					geometries: jsons,
					type: 'GeometryCollection'
				});
			}

			return {
				type: 'FeatureCollection',
				features: jsons
			};
		}
	});
}());

L.geoJson = function (geojson, options) {
	return new L.GeoJSON(geojson, options);
};


/*
 * L.DomEvent contains functions for working with DOM events.
 */

L.DomEvent = {
	/* inspired by John Resig, Dean Edwards and YUI addEvent implementations */
	addListener: function (obj, type, fn, context) { // (HTMLElement, String, Function[, Object])

		var id = L.stamp(fn),
		    key = '_leaflet_' + type + id,
		    handler, originalHandler, newType;

		if (obj[key]) { return this; }

		handler = function (e) {
			return fn.call(context || obj, e || L.DomEvent._getEvent());
		};

		if (L.Browser.pointer && type.indexOf('touch') === 0) {
			return this.addPointerListener(obj, type, handler, id);
		}
		if (L.Browser.touch && (type === 'dblclick') && this.addDoubleTapListener) {
			this.addDoubleTapListener(obj, handler, id);
		}

		if ('addEventListener' in obj) {

			if (type === 'mousewheel') {
				obj.addEventListener('DOMMouseScroll', handler, false);
				obj.addEventListener(type, handler, false);

			} else if ((type === 'mouseenter') || (type === 'mouseleave')) {

				originalHandler = handler;
				newType = (type === 'mouseenter' ? 'mouseover' : 'mouseout');

				handler = function (e) {
					if (!L.DomEvent._checkMouse(obj, e)) { return; }
					return originalHandler(e);
				};

				obj.addEventListener(newType, handler, false);

			} else if (type === 'click' && L.Browser.android) {
				originalHandler = handler;
				handler = function (e) {
					return L.DomEvent._filterClick(e, originalHandler);
				};

				obj.addEventListener(type, handler, false);
			} else {
				obj.addEventListener(type, handler, false);
			}

		} else if ('attachEvent' in obj) {
			obj.attachEvent('on' + type, handler);
		}

		obj[key] = handler;

		return this;
	},

	removeListener: function (obj, type, fn) {  // (HTMLElement, String, Function)

		var id = L.stamp(fn),
		    key = '_leaflet_' + type + id,
		    handler = obj[key];

		if (!handler) { return this; }

		if (L.Browser.pointer && type.indexOf('touch') === 0) {
			this.removePointerListener(obj, type, id);
		} else if (L.Browser.touch && (type === 'dblclick') && this.removeDoubleTapListener) {
			this.removeDoubleTapListener(obj, id);

		} else if ('removeEventListener' in obj) {

			if (type === 'mousewheel') {
				obj.removeEventListener('DOMMouseScroll', handler, false);
				obj.removeEventListener(type, handler, false);

			} else if ((type === 'mouseenter') || (type === 'mouseleave')) {
				obj.removeEventListener((type === 'mouseenter' ? 'mouseover' : 'mouseout'), handler, false);
			} else {
				obj.removeEventListener(type, handler, false);
			}
		} else if ('detachEvent' in obj) {
			obj.detachEvent('on' + type, handler);
		}

		obj[key] = null;

		return this;
	},

	stopPropagation: function (e) {

		if (e.stopPropagation) {
			e.stopPropagation();
		} else {
			e.cancelBubble = true;
		}
		L.DomEvent._skipped(e);

		return this;
	},

	disableScrollPropagation: function (el) {
		var stop = L.DomEvent.stopPropagation;

		return L.DomEvent
			.on(el, 'mousewheel', stop)
			.on(el, 'MozMousePixelScroll', stop);
	},

	disableClickPropagation: function (el) {
		var stop = L.DomEvent.stopPropagation;

		for (var i = L.Draggable.START.length - 1; i >= 0; i--) {
			L.DomEvent.on(el, L.Draggable.START[i], stop);
		}

		return L.DomEvent
			.on(el, 'click', L.DomEvent._fakeStop)
			.on(el, 'dblclick', stop);
	},

	preventDefault: function (e) {

		if (e.preventDefault) {
			e.preventDefault();
		} else {
			e.returnValue = false;
		}
		return this;
	},

	stop: function (e) {
		return L.DomEvent
			.preventDefault(e)
			.stopPropagation(e);
	},

	getMousePosition: function (e, container) {
		if (!container) {
			return new L.Point(e.clientX, e.clientY);
		}

		var rect = container.getBoundingClientRect();

		return new L.Point(
			e.clientX - rect.left - container.clientLeft,
			e.clientY - rect.top - container.clientTop);
	},

	getWheelDelta: function (e) {

		var delta = 0;

		if (e.wheelDelta) {
			delta = e.wheelDelta / 120;
		}
		if (e.detail) {
			delta = -e.detail / 3;
		}
		return delta;
	},

	_skipEvents: {},

	_fakeStop: function (e) {
		// fakes stopPropagation by setting a special event flag, checked/reset with L.DomEvent._skipped(e)
		L.DomEvent._skipEvents[e.type] = true;
	},

	_skipped: function (e) {
		var skipped = this._skipEvents[e.type];
		// reset when checking, as it's only used in map container and propagates outside of the map
		this._skipEvents[e.type] = false;
		return skipped;
	},

	// check if element really left/entered the event target (for mouseenter/mouseleave)
	_checkMouse: function (el, e) {

		var related = e.relatedTarget;

		if (!related) { return true; }

		try {
			while (related && (related !== el)) {
				related = related.parentNode;
			}
		} catch (err) {
			return false;
		}
		return (related !== el);
	},

	_getEvent: function () { // evil magic for IE
		/*jshint noarg:false */
		var e = window.event;
		if (!e) {
			var caller = arguments.callee.caller;
			while (caller) {
				e = caller['arguments'][0];
				if (e && window.Event === e.constructor) {
					break;
				}
				caller = caller.caller;
			}
		}
		return e;
	},

	// this is a horrible workaround for a bug in Android where a single touch triggers two click events
	_filterClick: function (e, handler) {
		var timeStamp = (e.timeStamp || e.originalEvent.timeStamp),
			elapsed = L.DomEvent._lastClick && (timeStamp - L.DomEvent._lastClick);

		// are they closer together than 500ms yet more than 100ms?
		// Android typically triggers them ~300ms apart while multiple listeners
		// on the same event should be triggered far faster;
		// or check if click is simulated on the element, and if it is, reject any non-simulated events

		if ((elapsed && elapsed > 100 && elapsed < 500) || (e.target._simulatedClick && !e._simulated)) {
			L.DomEvent.stop(e);
			return;
		}
		L.DomEvent._lastClick = timeStamp;

		return handler(e);
	}
};

L.DomEvent.on = L.DomEvent.addListener;
L.DomEvent.off = L.DomEvent.removeListener;


/*
 * L.Draggable allows you to add dragging capabilities to any element. Supports mobile devices too.
 */

L.Draggable = L.Class.extend({
	includes: L.Mixin.Events,

	statics: {
		START: L.Browser.touch ? ['touchstart', 'mousedown'] : ['mousedown'],
		END: {
			mousedown: 'mouseup',
			touchstart: 'touchend',
			pointerdown: 'touchend',
			MSPointerDown: 'touchend'
		},
		MOVE: {
			mousedown: 'mousemove',
			touchstart: 'touchmove',
			pointerdown: 'touchmove',
			MSPointerDown: 'touchmove'
		}
	},

	initialize: function (element, dragStartTarget) {
		this._element = element;
		this._dragStartTarget = dragStartTarget || element;
	},

	enable: function () {
		if (this._enabled) { return; }

		for (var i = L.Draggable.START.length - 1; i >= 0; i--) {
			L.DomEvent.on(this._dragStartTarget, L.Draggable.START[i], this._onDown, this);
		}

		this._enabled = true;
	},

	disable: function () {
		if (!this._enabled) { return; }

		for (var i = L.Draggable.START.length - 1; i >= 0; i--) {
			L.DomEvent.off(this._dragStartTarget, L.Draggable.START[i], this._onDown, this);
		}

		this._enabled = false;
		this._moved = false;
	},

	_onDown: function (e) {
		this._moved = false;

		if (e.shiftKey || ((e.which !== 1) && (e.button !== 1) && !e.touches)) { return; }

		L.DomEvent.stopPropagation(e);

		if (L.Draggable._disabled) { return; }

		L.DomUtil.disableImageDrag();
		L.DomUtil.disableTextSelection();

		if (this._moving) { return; }

		var first = e.touches ? e.touches[0] : e;

		this._startPoint = new L.Point(first.clientX, first.clientY);
		this._startPos = this._newPos = L.DomUtil.getPosition(this._element);

		L.DomEvent
		    .on(document, L.Draggable.MOVE[e.type], this._onMove, this)
		    .on(document, L.Draggable.END[e.type], this._onUp, this);
	},

	_onMove: function (e) {
		if (e.touches && e.touches.length > 1) {
			this._moved = true;
			return;
		}

		var first = (e.touches && e.touches.length === 1 ? e.touches[0] : e),
		    newPoint = new L.Point(first.clientX, first.clientY),
		    offset = newPoint.subtract(this._startPoint);

		if (!offset.x && !offset.y) { return; }
		if (L.Browser.touch && Math.abs(offset.x) + Math.abs(offset.y) < 3) { return; }

		L.DomEvent.preventDefault(e);

		if (!this._moved) {
			this.fire('dragstart');

			this._moved = true;
			this._startPos = L.DomUtil.getPosition(this._element).subtract(offset);

			L.DomUtil.addClass(document.body, 'leaflet-dragging');
			this._lastTarget = e.target || e.srcElement;
			L.DomUtil.addClass(this._lastTarget, 'leaflet-drag-target');
		}

		this._newPos = this._startPos.add(offset);
		this._moving = true;

		L.Util.cancelAnimFrame(this._animRequest);
		this._animRequest = L.Util.requestAnimFrame(this._updatePosition, this, true, this._dragStartTarget);
	},

	_updatePosition: function () {
		this.fire('predrag');
		L.DomUtil.setPosition(this._element, this._newPos);
		this.fire('drag');
	},

	_onUp: function () {
		L.DomUtil.removeClass(document.body, 'leaflet-dragging');

		if (this._lastTarget) {
			L.DomUtil.removeClass(this._lastTarget, 'leaflet-drag-target');
			this._lastTarget = null;
		}

		for (var i in L.Draggable.MOVE) {
			L.DomEvent
			    .off(document, L.Draggable.MOVE[i], this._onMove)
			    .off(document, L.Draggable.END[i], this._onUp);
		}

		L.DomUtil.enableImageDrag();
		L.DomUtil.enableTextSelection();

		if (this._moved && this._moving) {
			// ensure drag is not fired after dragend
			L.Util.cancelAnimFrame(this._animRequest);

			this.fire('dragend', {
				distance: this._newPos.distanceTo(this._startPos)
			});
		}

		this._moving = false;
	}
});


/*
	L.Handler is a base class for handler classes that are used internally to inject
	interaction features like dragging to classes like Map and Marker.
*/

L.Handler = L.Class.extend({
	initialize: function (map) {
		this._map = map;
	},

	enable: function () {
		if (this._enabled) { return; }

		this._enabled = true;
		this.addHooks();
	},

	disable: function () {
		if (!this._enabled) { return; }

		this._enabled = false;
		this.removeHooks();
	},

	enabled: function () {
		return !!this._enabled;
	}
});


/*
 * L.Handler.MapDrag is used to make the map draggable (with panning inertia), enabled by default.
 */

L.Map.mergeOptions({
	dragging: true,

	inertia: !L.Browser.android23,
	inertiaDeceleration: 3400, // px/s^2
	inertiaMaxSpeed: Infinity, // px/s
	inertiaThreshold: L.Browser.touch ? 32 : 18, // ms
	easeLinearity: 0.25,

	// TODO refactor, move to CRS
	worldCopyJump: false
});

L.Map.Drag = L.Handler.extend({
	addHooks: function () {
		if (!this._draggable) {
			var map = this._map;

			this._draggable = new L.Draggable(map._mapPane, map._container);

			this._draggable.on({
				'dragstart': this._onDragStart,
				'drag': this._onDrag,
				'dragend': this._onDragEnd
			}, this);

			if (map.options.worldCopyJump) {
				this._draggable.on('predrag', this._onPreDrag, this);
				map.on('viewreset', this._onViewReset, this);

				map.whenReady(this._onViewReset, this);
			}
		}
		this._draggable.enable();
	},

	removeHooks: function () {
		this._draggable.disable();
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_onDragStart: function () {
		var map = this._map;

		if (map._panAnim) {
			map._panAnim.stop();
		}

		map
		    .fire('movestart')
		    .fire('dragstart');

		if (map.options.inertia) {
			this._positions = [];
			this._times = [];
		}
	},

	_onDrag: function () {
		if (this._map.options.inertia) {
			var time = this._lastTime = +new Date(),
			    pos = this._lastPos = this._draggable._newPos;

			this._positions.push(pos);
			this._times.push(time);

			if (time - this._times[0] > 200) {
				this._positions.shift();
				this._times.shift();
			}
		}

		this._map
		    .fire('move')
		    .fire('drag');
	},

	_onViewReset: function () {
		// TODO fix hardcoded Earth values
		var pxCenter = this._map.getSize()._divideBy(2),
		    pxWorldCenter = this._map.latLngToLayerPoint([0, 0]);

		this._initialWorldOffset = pxWorldCenter.subtract(pxCenter).x;
		this._worldWidth = this._map.project([0, 180]).x;
	},

	_onPreDrag: function () {
		// TODO refactor to be able to adjust map pane position after zoom
		var worldWidth = this._worldWidth,
		    halfWidth = Math.round(worldWidth / 2),
		    dx = this._initialWorldOffset,
		    x = this._draggable._newPos.x,
		    newX1 = (x - halfWidth + dx) % worldWidth + halfWidth - dx,
		    newX2 = (x + halfWidth + dx) % worldWidth - halfWidth - dx,
		    newX = Math.abs(newX1 + dx) < Math.abs(newX2 + dx) ? newX1 : newX2;

		this._draggable._newPos.x = newX;
	},

	_onDragEnd: function (e) {
		var map = this._map,
		    options = map.options,
		    delay = +new Date() - this._lastTime,

		    noInertia = !options.inertia || delay > options.inertiaThreshold || !this._positions[0];

		map.fire('dragend', e);

		if (noInertia) {
			map.fire('moveend');

		} else {

			var direction = this._lastPos.subtract(this._positions[0]),
			    duration = (this._lastTime + delay - this._times[0]) / 1000,
			    ease = options.easeLinearity,

			    speedVector = direction.multiplyBy(ease / duration),
			    speed = speedVector.distanceTo([0, 0]),

			    limitedSpeed = Math.min(options.inertiaMaxSpeed, speed),
			    limitedSpeedVector = speedVector.multiplyBy(limitedSpeed / speed),

			    decelerationDuration = limitedSpeed / (options.inertiaDeceleration * ease),
			    offset = limitedSpeedVector.multiplyBy(-decelerationDuration / 2).round();

			if (!offset.x || !offset.y) {
				map.fire('moveend');

			} else {
				offset = map._limitOffset(offset, map.options.maxBounds);

				L.Util.requestAnimFrame(function () {
					map.panBy(offset, {
						duration: decelerationDuration,
						easeLinearity: ease,
						noMoveStart: true
					});
				});
			}
		}
	}
});

L.Map.addInitHook('addHandler', 'dragging', L.Map.Drag);


/*
 * L.Handler.DoubleClickZoom is used to handle double-click zoom on the map, enabled by default.
 */

L.Map.mergeOptions({
	doubleClickZoom: true
});

L.Map.DoubleClickZoom = L.Handler.extend({
	addHooks: function () {
		this._map.on('dblclick', this._onDoubleClick, this);
	},

	removeHooks: function () {
		this._map.off('dblclick', this._onDoubleClick, this);
	},

	_onDoubleClick: function (e) {
		var map = this._map,
		    zoom = map.getZoom() + (e.originalEvent.shiftKey ? -1 : 1);

		if (map.options.doubleClickZoom === 'center') {
			map.setZoom(zoom);
		} else {
			map.setZoomAround(e.containerPoint, zoom);
		}
	}
});

L.Map.addInitHook('addHandler', 'doubleClickZoom', L.Map.DoubleClickZoom);


/*
 * L.Handler.ScrollWheelZoom is used by L.Map to enable mouse scroll wheel zoom on the map.
 */

L.Map.mergeOptions({
	scrollWheelZoom: true
});

L.Map.ScrollWheelZoom = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.on(this._map._container, 'mousewheel', this._onWheelScroll, this);
		L.DomEvent.on(this._map._container, 'MozMousePixelScroll', L.DomEvent.preventDefault);
		this._delta = 0;
	},

	removeHooks: function () {
		L.DomEvent.off(this._map._container, 'mousewheel', this._onWheelScroll);
		L.DomEvent.off(this._map._container, 'MozMousePixelScroll', L.DomEvent.preventDefault);
	},

	_onWheelScroll: function (e) {
		var delta = L.DomEvent.getWheelDelta(e);

		this._delta += delta;
		this._lastMousePos = this._map.mouseEventToContainerPoint(e);

		if (!this._startTime) {
			this._startTime = +new Date();
		}

		var left = Math.max(40 - (+new Date() - this._startTime), 0);

		clearTimeout(this._timer);
		this._timer = setTimeout(L.bind(this._performZoom, this), left);

		L.DomEvent.preventDefault(e);
		L.DomEvent.stopPropagation(e);
	},

	_performZoom: function () {
		var map = this._map,
		    delta = this._delta,
		    zoom = map.getZoom();

		delta = delta > 0 ? Math.ceil(delta) : Math.floor(delta);
		delta = Math.max(Math.min(delta, 4), -4);
		delta = map._limitZoom(zoom + delta) - zoom;

		this._delta = 0;
		this._startTime = null;

		if (!delta) { return; }

		if (map.options.scrollWheelZoom === 'center') {
			map.setZoom(zoom + delta);
		} else {
			map.setZoomAround(this._lastMousePos, zoom + delta);
		}
	}
});

L.Map.addInitHook('addHandler', 'scrollWheelZoom', L.Map.ScrollWheelZoom);


/*
 * Extends the event handling code with double tap support for mobile browsers.
 */

L.extend(L.DomEvent, {

	_touchstart: L.Browser.msPointer ? 'MSPointerDown' : L.Browser.pointer ? 'pointerdown' : 'touchstart',
	_touchend: L.Browser.msPointer ? 'MSPointerUp' : L.Browser.pointer ? 'pointerup' : 'touchend',

	// inspired by Zepto touch code by Thomas Fuchs
	addDoubleTapListener: function (obj, handler, id) {
		var last,
		    doubleTap = false,
		    delay = 250,
		    touch,
		    pre = '_leaflet_',
		    touchstart = this._touchstart,
		    touchend = this._touchend,
		    trackedTouches = [];

		function onTouchStart(e) {
			var count;

			if (L.Browser.pointer) {
				trackedTouches.push(e.pointerId);
				count = trackedTouches.length;
			} else {
				count = e.touches.length;
			}
			if (count > 1) {
				return;
			}

			var now = Date.now(),
				delta = now - (last || now);

			touch = e.touches ? e.touches[0] : e;
			doubleTap = (delta > 0 && delta <= delay);
			last = now;
		}

		function onTouchEnd(e) {
			if (L.Browser.pointer) {
				var idx = trackedTouches.indexOf(e.pointerId);
				if (idx === -1) {
					return;
				}
				trackedTouches.splice(idx, 1);
			}

			if (doubleTap) {
				if (L.Browser.pointer) {
					// work around .type being readonly with MSPointer* events
					var newTouch = { },
						prop;

					// jshint forin:false
					for (var i in touch) {
						prop = touch[i];
						if (typeof prop === 'function') {
							newTouch[i] = prop.bind(touch);
						} else {
							newTouch[i] = prop;
						}
					}
					touch = newTouch;
				}
				touch.type = 'dblclick';
				handler(touch);
				last = null;
			}
		}
		obj[pre + touchstart + id] = onTouchStart;
		obj[pre + touchend + id] = onTouchEnd;

		// on pointer we need to listen on the document, otherwise a drag starting on the map and moving off screen
		// will not come through to us, so we will lose track of how many touches are ongoing
		var endElement = L.Browser.pointer ? document.documentElement : obj;

		obj.addEventListener(touchstart, onTouchStart, false);
		endElement.addEventListener(touchend, onTouchEnd, false);

		if (L.Browser.pointer) {
			endElement.addEventListener(L.DomEvent.POINTER_CANCEL, onTouchEnd, false);
		}

		return this;
	},

	removeDoubleTapListener: function (obj, id) {
		var pre = '_leaflet_';

		obj.removeEventListener(this._touchstart, obj[pre + this._touchstart + id], false);
		(L.Browser.pointer ? document.documentElement : obj).removeEventListener(
		        this._touchend, obj[pre + this._touchend + id], false);

		if (L.Browser.pointer) {
			document.documentElement.removeEventListener(L.DomEvent.POINTER_CANCEL, obj[pre + this._touchend + id],
				false);
		}

		return this;
	}
});


/*
 * Extends L.DomEvent to provide touch support for Internet Explorer and Windows-based devices.
 */

L.extend(L.DomEvent, {

	//static
	POINTER_DOWN: L.Browser.msPointer ? 'MSPointerDown' : 'pointerdown',
	POINTER_MOVE: L.Browser.msPointer ? 'MSPointerMove' : 'pointermove',
	POINTER_UP: L.Browser.msPointer ? 'MSPointerUp' : 'pointerup',
	POINTER_CANCEL: L.Browser.msPointer ? 'MSPointerCancel' : 'pointercancel',

	_pointers: [],
	_pointerDocumentListener: false,

	// Provides a touch events wrapper for (ms)pointer events.
	// Based on changes by veproza https://github.com/CloudMade/Leaflet/pull/1019
	//ref http://www.w3.org/TR/pointerevents/ https://www.w3.org/Bugs/Public/show_bug.cgi?id=22890

	addPointerListener: function (obj, type, handler, id) {

		switch (type) {
		case 'touchstart':
			return this.addPointerListenerStart(obj, type, handler, id);
		case 'touchend':
			return this.addPointerListenerEnd(obj, type, handler, id);
		case 'touchmove':
			return this.addPointerListenerMove(obj, type, handler, id);
		default:
			throw 'Unknown touch event type';
		}
	},

	addPointerListenerStart: function (obj, type, handler, id) {
		var pre = '_leaflet_',
		    pointers = this._pointers;

		var cb = function (e) {
			if (e.pointerType !== 'mouse' && e.pointerType !== e.MSPOINTER_TYPE_MOUSE) {
				L.DomEvent.preventDefault(e);
			}

			var alreadyInArray = false;
			for (var i = 0; i < pointers.length; i++) {
				if (pointers[i].pointerId === e.pointerId) {
					alreadyInArray = true;
					break;
				}
			}
			if (!alreadyInArray) {
				pointers.push(e);
			}

			e.touches = pointers.slice();
			e.changedTouches = [e];

			handler(e);
		};

		obj[pre + 'touchstart' + id] = cb;
		obj.addEventListener(this.POINTER_DOWN, cb, false);

		// need to also listen for end events to keep the _pointers list accurate
		// this needs to be on the body and never go away
		if (!this._pointerDocumentListener) {
			var internalCb = function (e) {
				for (var i = 0; i < pointers.length; i++) {
					if (pointers[i].pointerId === e.pointerId) {
						pointers.splice(i, 1);
						break;
					}
				}
			};
			//We listen on the documentElement as any drags that end by moving the touch off the screen get fired there
			document.documentElement.addEventListener(this.POINTER_UP, internalCb, false);
			document.documentElement.addEventListener(this.POINTER_CANCEL, internalCb, false);

			this._pointerDocumentListener = true;
		}

		return this;
	},

	addPointerListenerMove: function (obj, type, handler, id) {
		var pre = '_leaflet_',
		    touches = this._pointers;

		function cb(e) {

			// don't fire touch moves when mouse isn't down
			if ((e.pointerType === e.MSPOINTER_TYPE_MOUSE || e.pointerType === 'mouse') && e.buttons === 0) { return; }

			for (var i = 0; i < touches.length; i++) {
				if (touches[i].pointerId === e.pointerId) {
					touches[i] = e;
					break;
				}
			}

			e.touches = touches.slice();
			e.changedTouches = [e];

			handler(e);
		}

		obj[pre + 'touchmove' + id] = cb;
		obj.addEventListener(this.POINTER_MOVE, cb, false);

		return this;
	},

	addPointerListenerEnd: function (obj, type, handler, id) {
		var pre = '_leaflet_',
		    touches = this._pointers;

		var cb = function (e) {
			for (var i = 0; i < touches.length; i++) {
				if (touches[i].pointerId === e.pointerId) {
					touches.splice(i, 1);
					break;
				}
			}

			e.touches = touches.slice();
			e.changedTouches = [e];

			handler(e);
		};

		obj[pre + 'touchend' + id] = cb;
		obj.addEventListener(this.POINTER_UP, cb, false);
		obj.addEventListener(this.POINTER_CANCEL, cb, false);

		return this;
	},

	removePointerListener: function (obj, type, id) {
		var pre = '_leaflet_',
		    cb = obj[pre + type + id];

		switch (type) {
		case 'touchstart':
			obj.removeEventListener(this.POINTER_DOWN, cb, false);
			break;
		case 'touchmove':
			obj.removeEventListener(this.POINTER_MOVE, cb, false);
			break;
		case 'touchend':
			obj.removeEventListener(this.POINTER_UP, cb, false);
			obj.removeEventListener(this.POINTER_CANCEL, cb, false);
			break;
		}

		return this;
	}
});


/*
 * L.Handler.TouchZoom is used by L.Map to add pinch zoom on supported mobile browsers.
 */

L.Map.mergeOptions({
	touchZoom: L.Browser.touch && !L.Browser.android23,
	bounceAtZoomLimits: true
});

L.Map.TouchZoom = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.on(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	removeHooks: function () {
		L.DomEvent.off(this._map._container, 'touchstart', this._onTouchStart, this);
	},

	_onTouchStart: function (e) {
		var map = this._map;

		if (!e.touches || e.touches.length !== 2 || map._animatingZoom || this._zooming) { return; }

		var p1 = map.mouseEventToLayerPoint(e.touches[0]),
		    p2 = map.mouseEventToLayerPoint(e.touches[1]),
		    viewCenter = map._getCenterLayerPoint();

		this._startCenter = p1.add(p2)._divideBy(2);
		this._startDist = p1.distanceTo(p2);

		this._moved = false;
		this._zooming = true;

		this._centerOffset = viewCenter.subtract(this._startCenter);

		if (map._panAnim) {
			map._panAnim.stop();
		}

		L.DomEvent
		    .on(document, 'touchmove', this._onTouchMove, this)
		    .on(document, 'touchend', this._onTouchEnd, this);

		L.DomEvent.preventDefault(e);
	},

	_onTouchMove: function (e) {
		var map = this._map;

		if (!e.touches || e.touches.length !== 2 || !this._zooming) { return; }

		var p1 = map.mouseEventToLayerPoint(e.touches[0]),
		    p2 = map.mouseEventToLayerPoint(e.touches[1]);

		this._scale = p1.distanceTo(p2) / this._startDist;
		this._delta = p1._add(p2)._divideBy(2)._subtract(this._startCenter);

		if (this._scale === 1) { return; }

		if (!map.options.bounceAtZoomLimits) {
			if ((map.getZoom() === map.getMinZoom() && this._scale < 1) ||
			    (map.getZoom() === map.getMaxZoom() && this._scale > 1)) { return; }
		}

		if (!this._moved) {
			L.DomUtil.addClass(map._mapPane, 'leaflet-touching');

			map
			    .fire('movestart')
			    .fire('zoomstart');

			this._moved = true;
		}

		L.Util.cancelAnimFrame(this._animRequest);
		this._animRequest = L.Util.requestAnimFrame(
		        this._updateOnMove, this, true, this._map._container);

		L.DomEvent.preventDefault(e);
	},

	_updateOnMove: function () {
		var map = this._map,
		    origin = this._getScaleOrigin(),
		    center = map.layerPointToLatLng(origin),
		    zoom = map.getScaleZoom(this._scale);

		map._animateZoom(center, zoom, this._startCenter, this._scale, this._delta, false, true);
	},

	_onTouchEnd: function () {
		if (!this._moved || !this._zooming) {
			this._zooming = false;
			return;
		}

		var map = this._map;

		this._zooming = false;
		L.DomUtil.removeClass(map._mapPane, 'leaflet-touching');
		L.Util.cancelAnimFrame(this._animRequest);

		L.DomEvent
		    .off(document, 'touchmove', this._onTouchMove)
		    .off(document, 'touchend', this._onTouchEnd);

		var origin = this._getScaleOrigin(),
		    center = map.layerPointToLatLng(origin),

		    oldZoom = map.getZoom(),
		    floatZoomDelta = map.getScaleZoom(this._scale) - oldZoom,
		    roundZoomDelta = (floatZoomDelta > 0 ?
		            Math.ceil(floatZoomDelta) : Math.floor(floatZoomDelta)),

		    zoom = map._limitZoom(oldZoom + roundZoomDelta),
		    scale = map.getZoomScale(zoom) / this._scale;

		map._animateZoom(center, zoom, origin, scale);
	},

	_getScaleOrigin: function () {
		var centerOffset = this._centerOffset.subtract(this._delta).divideBy(this._scale);
		return this._startCenter.add(centerOffset);
	}
});

L.Map.addInitHook('addHandler', 'touchZoom', L.Map.TouchZoom);


/*
 * L.Map.Tap is used to enable mobile hacks like quick taps and long hold.
 */

L.Map.mergeOptions({
	tap: true,
	tapTolerance: 15
});

L.Map.Tap = L.Handler.extend({
	addHooks: function () {
		L.DomEvent.on(this._map._container, 'touchstart', this._onDown, this);
	},

	removeHooks: function () {
		L.DomEvent.off(this._map._container, 'touchstart', this._onDown, this);
	},

	_onDown: function (e) {
		if (!e.touches) { return; }

		L.DomEvent.preventDefault(e);

		this._fireClick = true;

		// don't simulate click or track longpress if more than 1 touch
		if (e.touches.length > 1) {
			this._fireClick = false;
			clearTimeout(this._holdTimeout);
			return;
		}

		var first = e.touches[0],
		    el = first.target;

		this._startPos = this._newPos = new L.Point(first.clientX, first.clientY);

		// if touching a link, highlight it
		if (el.tagName && el.tagName.toLowerCase() === 'a') {
			L.DomUtil.addClass(el, 'leaflet-active');
		}

		// simulate long hold but setting a timeout
		this._holdTimeout = setTimeout(L.bind(function () {
			if (this._isTapValid()) {
				this._fireClick = false;
				this._onUp();
				this._simulateEvent('contextmenu', first);
			}
		}, this), 1000);

		L.DomEvent
			.on(document, 'touchmove', this._onMove, this)
			.on(document, 'touchend', this._onUp, this);
	},

	_onUp: function (e) {
		clearTimeout(this._holdTimeout);

		L.DomEvent
			.off(document, 'touchmove', this._onMove, this)
			.off(document, 'touchend', this._onUp, this);

		if (this._fireClick && e && e.changedTouches) {

			var first = e.changedTouches[0],
			    el = first.target;

			if (el && el.tagName && el.tagName.toLowerCase() === 'a') {
				L.DomUtil.removeClass(el, 'leaflet-active');
			}

			// simulate click if the touch didn't move too much
			if (this._isTapValid()) {
				this._simulateEvent('click', first);
			}
		}
	},

	_isTapValid: function () {
		return this._newPos.distanceTo(this._startPos) <= this._map.options.tapTolerance;
	},

	_onMove: function (e) {
		var first = e.touches[0];
		this._newPos = new L.Point(first.clientX, first.clientY);
	},

	_simulateEvent: function (type, e) {
		var simulatedEvent = document.createEvent('MouseEvents');

		simulatedEvent._simulated = true;
		e.target._simulatedClick = true;

		simulatedEvent.initMouseEvent(
		        type, true, true, window, 1,
		        e.screenX, e.screenY,
		        e.clientX, e.clientY,
		        false, false, false, false, 0, null);

		e.target.dispatchEvent(simulatedEvent);
	}
});

if (L.Browser.touch && !L.Browser.pointer) {
	L.Map.addInitHook('addHandler', 'tap', L.Map.Tap);
}


/*
 * L.Handler.ShiftDragZoom is used to add shift-drag zoom interaction to the map
  * (zoom to a selected bounding box), enabled by default.
 */

L.Map.mergeOptions({
	boxZoom: true
});

L.Map.BoxZoom = L.Handler.extend({
	initialize: function (map) {
		this._map = map;
		this._container = map._container;
		this._pane = map._panes.overlayPane;
		this._moved = false;
	},

	addHooks: function () {
		L.DomEvent.on(this._container, 'mousedown', this._onMouseDown, this);
	},

	removeHooks: function () {
		L.DomEvent.off(this._container, 'mousedown', this._onMouseDown);
		this._moved = false;
	},

	moved: function () {
		return this._moved;
	},

	_onMouseDown: function (e) {
		this._moved = false;

		if (!e.shiftKey || ((e.which !== 1) && (e.button !== 1))) { return false; }

		L.DomUtil.disableTextSelection();
		L.DomUtil.disableImageDrag();

		this._startLayerPoint = this._map.mouseEventToLayerPoint(e);

		L.DomEvent
		    .on(document, 'mousemove', this._onMouseMove, this)
		    .on(document, 'mouseup', this._onMouseUp, this)
		    .on(document, 'keydown', this._onKeyDown, this);
	},

	_onMouseMove: function (e) {
		if (!this._moved) {
			this._box = L.DomUtil.create('div', 'leaflet-zoom-box', this._pane);
			L.DomUtil.setPosition(this._box, this._startLayerPoint);

			//TODO refactor: move cursor to styles
			this._container.style.cursor = 'crosshair';
			this._map.fire('boxzoomstart');
		}

		var startPoint = this._startLayerPoint,
		    box = this._box,

		    layerPoint = this._map.mouseEventToLayerPoint(e),
		    offset = layerPoint.subtract(startPoint),

		    newPos = new L.Point(
		        Math.min(layerPoint.x, startPoint.x),
		        Math.min(layerPoint.y, startPoint.y));

		L.DomUtil.setPosition(box, newPos);

		this._moved = true;

		// TODO refactor: remove hardcoded 4 pixels
		box.style.width  = (Math.max(0, Math.abs(offset.x) - 4)) + 'px';
		box.style.height = (Math.max(0, Math.abs(offset.y) - 4)) + 'px';
	},

	_finish: function () {
		if (this._moved) {
			this._pane.removeChild(this._box);
			this._container.style.cursor = '';
		}

		L.DomUtil.enableTextSelection();
		L.DomUtil.enableImageDrag();

		L.DomEvent
		    .off(document, 'mousemove', this._onMouseMove)
		    .off(document, 'mouseup', this._onMouseUp)
		    .off(document, 'keydown', this._onKeyDown);
	},

	_onMouseUp: function (e) {

		this._finish();

		var map = this._map,
		    layerPoint = map.mouseEventToLayerPoint(e);

		if (this._startLayerPoint.equals(layerPoint)) { return; }

		var bounds = new L.LatLngBounds(
		        map.layerPointToLatLng(this._startLayerPoint),
		        map.layerPointToLatLng(layerPoint));

		map.fitBounds(bounds);

		map.fire('boxzoomend', {
			boxZoomBounds: bounds
		});
	},

	_onKeyDown: function (e) {
		if (e.keyCode === 27) {
			this._finish();
		}
	}
});

L.Map.addInitHook('addHandler', 'boxZoom', L.Map.BoxZoom);


/*
 * L.Map.Keyboard is handling keyboard interaction with the map, enabled by default.
 */

L.Map.mergeOptions({
	keyboard: true,
	keyboardPanOffset: 80,
	keyboardZoomOffset: 1
});

L.Map.Keyboard = L.Handler.extend({

	keyCodes: {
		left:    [37],
		right:   [39],
		down:    [40],
		up:      [38],
		zoomIn:  [187, 107, 61, 171],
		zoomOut: [189, 109, 173]
	},

	initialize: function (map) {
		this._map = map;

		this._setPanOffset(map.options.keyboardPanOffset);
		this._setZoomOffset(map.options.keyboardZoomOffset);
	},

	addHooks: function () {
		var container = this._map._container;

		// make the container focusable by tabbing
		if (container.tabIndex === -1) {
			container.tabIndex = '0';
		}

		L.DomEvent
		    .on(container, 'focus', this._onFocus, this)
		    .on(container, 'blur', this._onBlur, this)
		    .on(container, 'mousedown', this._onMouseDown, this);

		this._map
		    .on('focus', this._addHooks, this)
		    .on('blur', this._removeHooks, this);
	},

	removeHooks: function () {
		this._removeHooks();

		var container = this._map._container;

		L.DomEvent
		    .off(container, 'focus', this._onFocus, this)
		    .off(container, 'blur', this._onBlur, this)
		    .off(container, 'mousedown', this._onMouseDown, this);

		this._map
		    .off('focus', this._addHooks, this)
		    .off('blur', this._removeHooks, this);
	},

	_onMouseDown: function () {
		if (this._focused) { return; }

		var body = document.body,
		    docEl = document.documentElement,
		    top = body.scrollTop || docEl.scrollTop,
		    left = body.scrollLeft || docEl.scrollLeft;

		this._map._container.focus();

		window.scrollTo(left, top);
	},

	_onFocus: function () {
		this._focused = true;
		this._map.fire('focus');
	},

	_onBlur: function () {
		this._focused = false;
		this._map.fire('blur');
	},

	_setPanOffset: function (pan) {
		var keys = this._panKeys = {},
		    codes = this.keyCodes,
		    i, len;

		for (i = 0, len = codes.left.length; i < len; i++) {
			keys[codes.left[i]] = [-1 * pan, 0];
		}
		for (i = 0, len = codes.right.length; i < len; i++) {
			keys[codes.right[i]] = [pan, 0];
		}
		for (i = 0, len = codes.down.length; i < len; i++) {
			keys[codes.down[i]] = [0, pan];
		}
		for (i = 0, len = codes.up.length; i < len; i++) {
			keys[codes.up[i]] = [0, -1 * pan];
		}
	},

	_setZoomOffset: function (zoom) {
		var keys = this._zoomKeys = {},
		    codes = this.keyCodes,
		    i, len;

		for (i = 0, len = codes.zoomIn.length; i < len; i++) {
			keys[codes.zoomIn[i]] = zoom;
		}
		for (i = 0, len = codes.zoomOut.length; i < len; i++) {
			keys[codes.zoomOut[i]] = -zoom;
		}
	},

	_addHooks: function () {
		L.DomEvent.on(document, 'keydown', this._onKeyDown, this);
	},

	_removeHooks: function () {
		L.DomEvent.off(document, 'keydown', this._onKeyDown, this);
	},

	_onKeyDown: function (e) {
		var key = e.keyCode,
		    map = this._map;

		if (key in this._panKeys) {

			if (map._panAnim && map._panAnim._inProgress) { return; }

			map.panBy(this._panKeys[key]);

			if (map.options.maxBounds) {
				map.panInsideBounds(map.options.maxBounds);
			}

		} else if (key in this._zoomKeys) {
			map.setZoom(map.getZoom() + this._zoomKeys[key]);

		} else {
			return;
		}

		L.DomEvent.stop(e);
	}
});

L.Map.addInitHook('addHandler', 'keyboard', L.Map.Keyboard);


/*
 * L.Handler.MarkerDrag is used internally by L.Marker to make the markers draggable.
 */

L.Handler.MarkerDrag = L.Handler.extend({
	initialize: function (marker) {
		this._marker = marker;
	},

	addHooks: function () {
		var icon = this._marker._icon;
		if (!this._draggable) {
			this._draggable = new L.Draggable(icon, icon);
		}

		this._draggable
			.on('dragstart', this._onDragStart, this)
			.on('drag', this._onDrag, this)
			.on('dragend', this._onDragEnd, this);
		this._draggable.enable();
		L.DomUtil.addClass(this._marker._icon, 'leaflet-marker-draggable');
	},

	removeHooks: function () {
		this._draggable
			.off('dragstart', this._onDragStart, this)
			.off('drag', this._onDrag, this)
			.off('dragend', this._onDragEnd, this);

		this._draggable.disable();
		L.DomUtil.removeClass(this._marker._icon, 'leaflet-marker-draggable');
	},

	moved: function () {
		return this._draggable && this._draggable._moved;
	},

	_onDragStart: function () {
		this._marker
		    .closePopup()
		    .fire('movestart')
		    .fire('dragstart');
	},

	_onDrag: function () {
		var marker = this._marker,
		    shadow = marker._shadow,
		    iconPos = L.DomUtil.getPosition(marker._icon),
		    latlng = marker._map.layerPointToLatLng(iconPos);

		// update shadow position
		if (shadow) {
			L.DomUtil.setPosition(shadow, iconPos);
		}

		marker._latlng = latlng;

		marker
		    .fire('move', {latlng: latlng})
		    .fire('drag');
	},

	_onDragEnd: function (e) {
		this._marker
		    .fire('moveend')
		    .fire('dragend', e);
	}
});


/*
 * L.Control is a base class for implementing map controls. Handles positioning.
 * All other controls extend from this class.
 */

L.Control = L.Class.extend({
	options: {
		position: 'topright'
	},

	initialize: function (options) {
		L.setOptions(this, options);
	},

	getPosition: function () {
		return this.options.position;
	},

	setPosition: function (position) {
		var map = this._map;

		if (map) {
			map.removeControl(this);
		}

		this.options.position = position;

		if (map) {
			map.addControl(this);
		}

		return this;
	},

	getContainer: function () {
		return this._container;
	},

	addTo: function (map) {
		this._map = map;

		var container = this._container = this.onAdd(map),
		    pos = this.getPosition(),
		    corner = map._controlCorners[pos];

		L.DomUtil.addClass(container, 'leaflet-control');

		if (pos.indexOf('bottom') !== -1) {
			corner.insertBefore(container, corner.firstChild);
		} else {
			corner.appendChild(container);
		}

		return this;
	},

	removeFrom: function (map) {
		var pos = this.getPosition(),
		    corner = map._controlCorners[pos];

		corner.removeChild(this._container);
		this._map = null;

		if (this.onRemove) {
			this.onRemove(map);
		}

		return this;
	},

	_refocusOnMap: function () {
		if (this._map) {
			this._map.getContainer().focus();
		}
	}
});

L.control = function (options) {
	return new L.Control(options);
};


// adds control-related methods to L.Map

L.Map.include({
	addControl: function (control) {
		control.addTo(this);
		return this;
	},

	removeControl: function (control) {
		control.removeFrom(this);
		return this;
	},

	_initControlPos: function () {
		var corners = this._controlCorners = {},
		    l = 'leaflet-',
		    container = this._controlContainer =
		            L.DomUtil.create('div', l + 'control-container', this._container);

		function createCorner(vSide, hSide) {
			var className = l + vSide + ' ' + l + hSide;

			corners[vSide + hSide] = L.DomUtil.create('div', className, container);
		}

		createCorner('top', 'left');
		createCorner('top', 'right');
		createCorner('bottom', 'left');
		createCorner('bottom', 'right');
	},

	_clearControlPos: function () {
		this._container.removeChild(this._controlContainer);
	}
});


/*
 * L.Control.Zoom is used for the default zoom buttons on the map.
 */

L.Control.Zoom = L.Control.extend({
	options: {
		position: 'topleft',
		zoomInText: '+',
		zoomInTitle: 'Zoom in',
		zoomOutText: '-',
		zoomOutTitle: 'Zoom out'
	},

	onAdd: function (map) {
		var zoomName = 'leaflet-control-zoom',
		    container = L.DomUtil.create('div', zoomName + ' leaflet-bar');

		this._map = map;

		this._zoomInButton  = this._createButton(
		        this.options.zoomInText, this.options.zoomInTitle,
		        zoomName + '-in',  container, this._zoomIn,  this);
		this._zoomOutButton = this._createButton(
		        this.options.zoomOutText, this.options.zoomOutTitle,
		        zoomName + '-out', container, this._zoomOut, this);

		this._updateDisabled();
		map.on('zoomend zoomlevelschange', this._updateDisabled, this);

		return container;
	},

	onRemove: function (map) {
		map.off('zoomend zoomlevelschange', this._updateDisabled, this);
	},

	_zoomIn: function (e) {
		this._map.zoomIn(e.shiftKey ? 3 : 1);
	},

	_zoomOut: function (e) {
		this._map.zoomOut(e.shiftKey ? 3 : 1);
	},

	_createButton: function (html, title, className, container, fn, context) {
		var link = L.DomUtil.create('a', className, container);
		link.innerHTML = html;
		link.href = '#';
		link.title = title;

		var stop = L.DomEvent.stopPropagation;

		L.DomEvent
		    .on(link, 'click', stop)
		    .on(link, 'mousedown', stop)
		    .on(link, 'dblclick', stop)
		    .on(link, 'click', L.DomEvent.preventDefault)
		    .on(link, 'click', fn, context)
		    .on(link, 'click', this._refocusOnMap, context);

		return link;
	},

	_updateDisabled: function () {
		var map = this._map,
			className = 'leaflet-disabled';

		L.DomUtil.removeClass(this._zoomInButton, className);
		L.DomUtil.removeClass(this._zoomOutButton, className);

		if (map._zoom === map.getMinZoom()) {
			L.DomUtil.addClass(this._zoomOutButton, className);
		}
		if (map._zoom === map.getMaxZoom()) {
			L.DomUtil.addClass(this._zoomInButton, className);
		}
	}
});

L.Map.mergeOptions({
	zoomControl: true
});

L.Map.addInitHook(function () {
	if (this.options.zoomControl) {
		this.zoomControl = new L.Control.Zoom();
		this.addControl(this.zoomControl);
	}
});

L.control.zoom = function (options) {
	return new L.Control.Zoom(options);
};



/*
 * L.Control.Attribution is used for displaying attribution on the map (added by default).
 */

L.Control.Attribution = L.Control.extend({
	options: {
		position: 'bottomright',
		prefix: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a>'
	},

	initialize: function (options) {
		L.setOptions(this, options);

		this._attributions = {};
	},

	onAdd: function (map) {
		this._container = L.DomUtil.create('div', 'leaflet-control-attribution');
		L.DomEvent.disableClickPropagation(this._container);

		for (var i in map._layers) {
			if (map._layers[i].getAttribution) {
				this.addAttribution(map._layers[i].getAttribution());
			}
		}
		
		map
		    .on('layeradd', this._onLayerAdd, this)
		    .on('layerremove', this._onLayerRemove, this);

		this._update();

		return this._container;
	},

	onRemove: function (map) {
		map
		    .off('layeradd', this._onLayerAdd)
		    .off('layerremove', this._onLayerRemove);

	},

	setPrefix: function (prefix) {
		this.options.prefix = prefix;
		this._update();
		return this;
	},

	addAttribution: function (text) {
		if (!text) { return; }

		if (!this._attributions[text]) {
			this._attributions[text] = 0;
		}
		this._attributions[text]++;

		this._update();

		return this;
	},

	removeAttribution: function (text) {
		if (!text) { return; }

		if (this._attributions[text]) {
			this._attributions[text]--;
			this._update();
		}

		return this;
	},

	_update: function () {
		if (!this._map) { return; }

		var attribs = [];

		for (var i in this._attributions) {
			if (this._attributions[i]) {
				attribs.push(i);
			}
		}

		var prefixAndAttribs = [];

		if (this.options.prefix) {
			prefixAndAttribs.push(this.options.prefix);
		}
		if (attribs.length) {
			prefixAndAttribs.push(attribs.join(', '));
		}

		this._container.innerHTML = prefixAndAttribs.join(' | ');
	},

	_onLayerAdd: function (e) {
		if (e.layer.getAttribution) {
			this.addAttribution(e.layer.getAttribution());
		}
	},

	_onLayerRemove: function (e) {
		if (e.layer.getAttribution) {
			this.removeAttribution(e.layer.getAttribution());
		}
	}
});

L.Map.mergeOptions({
	attributionControl: true
});

L.Map.addInitHook(function () {
	if (this.options.attributionControl) {
		this.attributionControl = (new L.Control.Attribution()).addTo(this);
	}
});

L.control.attribution = function (options) {
	return new L.Control.Attribution(options);
};


/*
 * L.Control.Scale is used for displaying metric/imperial scale on the map.
 */

L.Control.Scale = L.Control.extend({
	options: {
		position: 'bottomleft',
		maxWidth: 100,
		metric: true,
		imperial: true,
		updateWhenIdle: false
	},

	onAdd: function (map) {
		this._map = map;

		var className = 'leaflet-control-scale',
		    container = L.DomUtil.create('div', className),
		    options = this.options;

		this._addScales(options, className, container);

		map.on(options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
		map.whenReady(this._update, this);

		return container;
	},

	onRemove: function (map) {
		map.off(this.options.updateWhenIdle ? 'moveend' : 'move', this._update, this);
	},

	_addScales: function (options, className, container) {
		if (options.metric) {
			this._mScale = L.DomUtil.create('div', className + '-line', container);
		}
		if (options.imperial) {
			this._iScale = L.DomUtil.create('div', className + '-line', container);
		}
	},

	_update: function () {
		var bounds = this._map.getBounds(),
		    centerLat = bounds.getCenter().lat,
		    halfWorldMeters = 6378137 * Math.PI * Math.cos(centerLat * Math.PI / 180),
		    dist = halfWorldMeters * (bounds.getNorthEast().lng - bounds.getSouthWest().lng) / 180,

		    size = this._map.getSize(),
		    options = this.options,
		    maxMeters = 0;

		if (size.x > 0) {
			maxMeters = dist * (options.maxWidth / size.x);
		}

		this._updateScales(options, maxMeters);
	},

	_updateScales: function (options, maxMeters) {
		if (options.metric && maxMeters) {
			this._updateMetric(maxMeters);
		}

		if (options.imperial && maxMeters) {
			this._updateImperial(maxMeters);
		}
	},

	_updateMetric: function (maxMeters) {
		var meters = this._getRoundNum(maxMeters);

		this._mScale.style.width = this._getScaleWidth(meters / maxMeters) + 'px';
		this._mScale.innerHTML = meters < 1000 ? meters + ' m' : (meters / 1000) + ' km';
	},

	_updateImperial: function (maxMeters) {
		var maxFeet = maxMeters * 3.2808399,
		    scale = this._iScale,
		    maxMiles, miles, feet;

		if (maxFeet > 5280) {
			maxMiles = maxFeet / 5280;
			miles = this._getRoundNum(maxMiles);

			scale.style.width = this._getScaleWidth(miles / maxMiles) + 'px';
			scale.innerHTML = miles + ' mi';

		} else {
			feet = this._getRoundNum(maxFeet);

			scale.style.width = this._getScaleWidth(feet / maxFeet) + 'px';
			scale.innerHTML = feet + ' ft';
		}
	},

	_getScaleWidth: function (ratio) {
		return Math.round(this.options.maxWidth * ratio) - 10;
	},

	_getRoundNum: function (num) {
		var pow10 = Math.pow(10, (Math.floor(num) + '').length - 1),
		    d = num / pow10;

		d = d >= 10 ? 10 : d >= 5 ? 5 : d >= 3 ? 3 : d >= 2 ? 2 : 1;

		return pow10 * d;
	}
});

L.control.scale = function (options) {
	return new L.Control.Scale(options);
};


/*
 * L.Control.Layers is a control to allow users to switch between different layers on the map.
 */

L.Control.Layers = L.Control.extend({
	options: {
		collapsed: true,
		position: 'topright',
		autoZIndex: true
	},

	initialize: function (baseLayers, overlays, options) {
		L.setOptions(this, options);

		this._layers = {};
		this._lastZIndex = 0;
		this._handlingClick = false;

		for (var i in baseLayers) {
			this._addLayer(baseLayers[i], i);
		}

		for (i in overlays) {
			this._addLayer(overlays[i], i, true);
		}
	},

	onAdd: function (map) {
		this._initLayout();
		this._update();

		map
		    .on('layeradd', this._onLayerChange, this)
		    .on('layerremove', this._onLayerChange, this);

		return this._container;
	},

	onRemove: function (map) {
		map
		    .off('layeradd', this._onLayerChange, this)
		    .off('layerremove', this._onLayerChange, this);
	},

	addBaseLayer: function (layer, name) {
		this._addLayer(layer, name);
		this._update();
		return this;
	},

	addOverlay: function (layer, name) {
		this._addLayer(layer, name, true);
		this._update();
		return this;
	},

	removeLayer: function (layer) {
		var id = L.stamp(layer);
		delete this._layers[id];
		this._update();
		return this;
	},

	_initLayout: function () {
		var className = 'leaflet-control-layers',
		    container = this._container = L.DomUtil.create('div', className);

		//Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
		container.setAttribute('aria-haspopup', true);

		if (!L.Browser.touch) {
			L.DomEvent
				.disableClickPropagation(container)
				.disableScrollPropagation(container);
		} else {
			L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
		}

		var form = this._form = L.DomUtil.create('form', className + '-list');

		if (this.options.collapsed) {
			if (!L.Browser.android) {
				L.DomEvent
				    .on(container, 'mouseover', this._expand, this)
				    .on(container, 'mouseout', this._collapse, this);
			}
			var link = this._layersLink = L.DomUtil.create('a', className + '-toggle', container);
			link.href = '#';
			link.title = 'Layers';

			if (L.Browser.touch) {
				L.DomEvent
				    .on(link, 'click', L.DomEvent.stop)
				    .on(link, 'click', this._expand, this);
			}
			else {
				L.DomEvent.on(link, 'focus', this._expand, this);
			}
			//Work around for Firefox android issue https://github.com/Leaflet/Leaflet/issues/2033
			L.DomEvent.on(form, 'click', function () {
				setTimeout(L.bind(this._onInputClick, this), 0);
			}, this);

			this._map.on('click', this._collapse, this);
			// TODO keyboard accessibility
		} else {
			this._expand();
		}

		this._baseLayersList = L.DomUtil.create('div', className + '-base', form);
		this._separator = L.DomUtil.create('div', className + '-separator', form);
		this._overlaysList = L.DomUtil.create('div', className + '-overlays', form);

		container.appendChild(form);
	},

	_addLayer: function (layer, name, overlay) {
		var id = L.stamp(layer);

		this._layers[id] = {
			layer: layer,
			name: name,
			overlay: overlay
		};

		if (this.options.autoZIndex && layer.setZIndex) {
			this._lastZIndex++;
			layer.setZIndex(this._lastZIndex);
		}
	},

	_update: function () {
		if (!this._container) {
			return;
		}

		this._baseLayersList.innerHTML = '';
		this._overlaysList.innerHTML = '';

		var baseLayersPresent = false,
		    overlaysPresent = false,
		    i, obj;

		for (i in this._layers) {
			obj = this._layers[i];
			this._addItem(obj);
			overlaysPresent = overlaysPresent || obj.overlay;
			baseLayersPresent = baseLayersPresent || !obj.overlay;
		}

		this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
	},

	_onLayerChange: function (e) {
		var obj = this._layers[L.stamp(e.layer)];

		if (!obj) { return; }

		if (!this._handlingClick) {
			this._update();
		}

		var type = obj.overlay ?
			(e.type === 'layeradd' ? 'overlayadd' : 'overlayremove') :
			(e.type === 'layeradd' ? 'baselayerchange' : null);

		if (type) {
			this._map.fire(type, obj);
		}
	},

	// IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
	_createRadioElement: function (name, checked) {

		var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' + name + '"';
		if (checked) {
			radioHtml += ' checked="checked"';
		}
		radioHtml += '/>';

		var radioFragment = document.createElement('div');
		radioFragment.innerHTML = radioHtml;

		return radioFragment.firstChild;
	},

	_addItem: function (obj) {
		var label = document.createElement('label'),
		    input,
		    checked = this._map.hasLayer(obj.layer);

		if (obj.overlay) {
			input = document.createElement('input');
			input.type = 'checkbox';
			input.className = 'leaflet-control-layers-selector';
			input.defaultChecked = checked;
		} else {
			input = this._createRadioElement('leaflet-base-layers', checked);
		}

		input.layerId = L.stamp(obj.layer);

		L.DomEvent.on(input, 'click', this._onInputClick, this);

		var name = document.createElement('span');
		name.innerHTML = ' ' + obj.name;

		label.appendChild(input);
		label.appendChild(name);

		var container = obj.overlay ? this._overlaysList : this._baseLayersList;
		container.appendChild(label);

		return label;
	},

	_onInputClick: function () {
		var i, input, obj,
		    inputs = this._form.getElementsByTagName('input'),
		    inputsLen = inputs.length;

		this._handlingClick = true;

		for (i = 0; i < inputsLen; i++) {
			input = inputs[i];
			obj = this._layers[input.layerId];

			if (input.checked && !this._map.hasLayer(obj.layer)) {
				this._map.addLayer(obj.layer);

			} else if (!input.checked && this._map.hasLayer(obj.layer)) {
				this._map.removeLayer(obj.layer);
			}
		}

		this._handlingClick = false;

		this._refocusOnMap();
	},

	_expand: function () {
		L.DomUtil.addClass(this._container, 'leaflet-control-layers-expanded');
	},

	_collapse: function () {
		this._container.className = this._container.className.replace(' leaflet-control-layers-expanded', '');
	}
});

L.control.layers = function (baseLayers, overlays, options) {
	return new L.Control.Layers(baseLayers, overlays, options);
};


/*
 * L.PosAnimation is used by Leaflet internally for pan animations.
 */

L.PosAnimation = L.Class.extend({
	includes: L.Mixin.Events,

	run: function (el, newPos, duration, easeLinearity) { // (HTMLElement, Point[, Number, Number])
		this.stop();

		this._el = el;
		this._inProgress = true;
		this._newPos = newPos;

		this.fire('start');

		el.style[L.DomUtil.TRANSITION] = 'all ' + (duration || 0.25) +
		        's cubic-bezier(0,0,' + (easeLinearity || 0.5) + ',1)';

		L.DomEvent.on(el, L.DomUtil.TRANSITION_END, this._onTransitionEnd, this);
		L.DomUtil.setPosition(el, newPos);

		// toggle reflow, Chrome flickers for some reason if you don't do this
		L.Util.falseFn(el.offsetWidth);

		// there's no native way to track value updates of transitioned properties, so we imitate this
		this._stepTimer = setInterval(L.bind(this._onStep, this), 50);
	},

	stop: function () {
		if (!this._inProgress) { return; }

		// if we just removed the transition property, the element would jump to its final position,
		// so we need to make it stay at the current position

		L.DomUtil.setPosition(this._el, this._getPos());
		this._onTransitionEnd();
		L.Util.falseFn(this._el.offsetWidth); // force reflow in case we are about to start a new animation
	},

	_onStep: function () {
		var stepPos = this._getPos();
		if (!stepPos) {
			this._onTransitionEnd();
			return;
		}
		// jshint camelcase: false
		// make L.DomUtil.getPosition return intermediate position value during animation
		this._el._leaflet_pos = stepPos;

		this.fire('step');
	},

	// you can't easily get intermediate values of properties animated with CSS3 Transitions,
	// we need to parse computed style (in case of transform it returns matrix string)

	_transformRe: /([-+]?(?:\d*\.)?\d+)\D*, ([-+]?(?:\d*\.)?\d+)\D*\)/,

	_getPos: function () {
		var left, top, matches,
		    el = this._el,
		    style = window.getComputedStyle(el);

		if (L.Browser.any3d) {
			matches = style[L.DomUtil.TRANSFORM].match(this._transformRe);
			if (!matches) { return; }
			left = parseFloat(matches[1]);
			top  = parseFloat(matches[2]);
		} else {
			left = parseFloat(style.left);
			top  = parseFloat(style.top);
		}

		return new L.Point(left, top, true);
	},

	_onTransitionEnd: function () {
		L.DomEvent.off(this._el, L.DomUtil.TRANSITION_END, this._onTransitionEnd, this);

		if (!this._inProgress) { return; }
		this._inProgress = false;

		this._el.style[L.DomUtil.TRANSITION] = '';

		// jshint camelcase: false
		// make sure L.DomUtil.getPosition returns the final position value after animation
		this._el._leaflet_pos = this._newPos;

		clearInterval(this._stepTimer);

		this.fire('step').fire('end');
	}

});


/*
 * Extends L.Map to handle panning animations.
 */

L.Map.include({

	setView: function (center, zoom, options) {

		zoom = zoom === undefined ? this._zoom : this._limitZoom(zoom);
		center = this._limitCenter(L.latLng(center), zoom, this.options.maxBounds);
		options = options || {};

		if (this._panAnim) {
			this._panAnim.stop();
		}

		if (this._loaded && !options.reset && options !== true) {

			if (options.animate !== undefined) {
				options.zoom = L.extend({animate: options.animate}, options.zoom);
				options.pan = L.extend({animate: options.animate}, options.pan);
			}

			// try animating pan or zoom
			var animated = (this._zoom !== zoom) ?
				this._tryAnimatedZoom && this._tryAnimatedZoom(center, zoom, options.zoom) :
				this._tryAnimatedPan(center, options.pan);

			if (animated) {
				// prevent resize handler call, the view will refresh after animation anyway
				clearTimeout(this._sizeTimer);
				return this;
			}
		}

		// animation didn't start, just reset the map view
		this._resetView(center, zoom);

		return this;
	},

	panBy: function (offset, options) {
		offset = L.point(offset).round();
		options = options || {};

		if (!offset.x && !offset.y) {
			return this;
		}

		if (!this._panAnim) {
			this._panAnim = new L.PosAnimation();

			this._panAnim.on({
				'step': this._onPanTransitionStep,
				'end': this._onPanTransitionEnd
			}, this);
		}

		// don't fire movestart if animating inertia
		if (!options.noMoveStart) {
			this.fire('movestart');
		}

		// animate pan unless animate: false specified
		if (options.animate !== false) {
			L.DomUtil.addClass(this._mapPane, 'leaflet-pan-anim');

			var newPos = this._getMapPanePos().subtract(offset);
			this._panAnim.run(this._mapPane, newPos, options.duration || 0.25, options.easeLinearity);
		} else {
			this._rawPanBy(offset);
			this.fire('move').fire('moveend');
		}

		return this;
	},

	_onPanTransitionStep: function () {
		this.fire('move');
	},

	_onPanTransitionEnd: function () {
		L.DomUtil.removeClass(this._mapPane, 'leaflet-pan-anim');
		this.fire('moveend');
	},

	_tryAnimatedPan: function (center, options) {
		// difference between the new and current centers in pixels
		var offset = this._getCenterOffset(center)._floor();

		// don't animate too far unless animate: true specified in options
		if ((options && options.animate) !== true && !this.getSize().contains(offset)) { return false; }

		this.panBy(offset, options);

		return true;
	}
});


/*
 * L.PosAnimation fallback implementation that powers Leaflet pan animations
 * in browsers that don't support CSS3 Transitions.
 */

L.PosAnimation = L.DomUtil.TRANSITION ? L.PosAnimation : L.PosAnimation.extend({

	run: function (el, newPos, duration, easeLinearity) { // (HTMLElement, Point[, Number, Number])
		this.stop();

		this._el = el;
		this._inProgress = true;
		this._duration = duration || 0.25;
		this._easeOutPower = 1 / Math.max(easeLinearity || 0.5, 0.2);

		this._startPos = L.DomUtil.getPosition(el);
		this._offset = newPos.subtract(this._startPos);
		this._startTime = +new Date();

		this.fire('start');

		this._animate();
	},

	stop: function () {
		if (!this._inProgress) { return; }

		this._step();
		this._complete();
	},

	_animate: function () {
		// animation loop
		this._animId = L.Util.requestAnimFrame(this._animate, this);
		this._step();
	},

	_step: function () {
		var elapsed = (+new Date()) - this._startTime,
		    duration = this._duration * 1000;

		if (elapsed < duration) {
			this._runFrame(this._easeOut(elapsed / duration));
		} else {
			this._runFrame(1);
			this._complete();
		}
	},

	_runFrame: function (progress) {
		var pos = this._startPos.add(this._offset.multiplyBy(progress));
		L.DomUtil.setPosition(this._el, pos);

		this.fire('step');
	},

	_complete: function () {
		L.Util.cancelAnimFrame(this._animId);

		this._inProgress = false;
		this.fire('end');
	},

	_easeOut: function (t) {
		return 1 - Math.pow(1 - t, this._easeOutPower);
	}
});


/*
 * Extends L.Map to handle zoom animations.
 */

L.Map.mergeOptions({
	zoomAnimation: true,
	zoomAnimationThreshold: 4
});

if (L.DomUtil.TRANSITION) {

	L.Map.addInitHook(function () {
		// don't animate on browsers without hardware-accelerated transitions or old Android/Opera
		this._zoomAnimated = this.options.zoomAnimation && L.DomUtil.TRANSITION &&
				L.Browser.any3d && !L.Browser.android23 && !L.Browser.mobileOpera;

		// zoom transitions run with the same duration for all layers, so if one of transitionend events
		// happens after starting zoom animation (propagating to the map pane), we know that it ended globally
		if (this._zoomAnimated) {
			L.DomEvent.on(this._mapPane, L.DomUtil.TRANSITION_END, this._catchTransitionEnd, this);
		}
	});
}

L.Map.include(!L.DomUtil.TRANSITION ? {} : {

	_catchTransitionEnd: function (e) {
		if (this._animatingZoom && e.propertyName.indexOf('transform') >= 0) {
			this._onZoomTransitionEnd();
		}
	},

	_nothingToAnimate: function () {
		return !this._container.getElementsByClassName('leaflet-zoom-animated').length;
	},

	_tryAnimatedZoom: function (center, zoom, options) {

		if (this._animatingZoom) { return true; }

		options = options || {};

		// don't animate if disabled, not supported or zoom difference is too large
		if (!this._zoomAnimated || options.animate === false || this._nothingToAnimate() ||
		        Math.abs(zoom - this._zoom) > this.options.zoomAnimationThreshold) { return false; }

		// offset is the pixel coords of the zoom origin relative to the current center
		var scale = this.getZoomScale(zoom),
		    offset = this._getCenterOffset(center)._divideBy(1 - 1 / scale),
			origin = this._getCenterLayerPoint()._add(offset);

		// don't animate if the zoom origin isn't within one screen from the current center, unless forced
		if (options.animate !== true && !this.getSize().contains(offset)) { return false; }

		this
		    .fire('movestart')
		    .fire('zoomstart');

		this._animateZoom(center, zoom, origin, scale, null, true);

		return true;
	},

	_animateZoom: function (center, zoom, origin, scale, delta, backwards, forTouchZoom) {

		if (!forTouchZoom) {
			this._animatingZoom = true;
		}

		// put transform transition on all layers with leaflet-zoom-animated class
		L.DomUtil.addClass(this._mapPane, 'leaflet-zoom-anim');

		// remember what center/zoom to set after animation
		this._animateToCenter = center;
		this._animateToZoom = zoom;

		// disable any dragging during animation
		if (L.Draggable) {
			L.Draggable._disabled = true;
		}

		L.Util.requestAnimFrame(function () {
			this.fire('zoomanim', {
				center: center,
				zoom: zoom,
				origin: origin,
				scale: scale,
				delta: delta,
				backwards: backwards
			});
			// horrible hack to work around a Chrome bug https://github.com/Leaflet/Leaflet/issues/3689
			setTimeout(L.bind(this._onZoomTransitionEnd, this), 250);
		}, this);
	},

	_onZoomTransitionEnd: function () {
		if (!this._animatingZoom) { return; }

		this._animatingZoom = false;

		L.DomUtil.removeClass(this._mapPane, 'leaflet-zoom-anim');

		L.Util.requestAnimFrame(function () {
			this._resetView(this._animateToCenter, this._animateToZoom, true, true);

			if (L.Draggable) {
				L.Draggable._disabled = false;
			}
		}, this);
	}
});


/*
	Zoom animation logic for L.TileLayer.
*/

L.TileLayer.include({
	_animateZoom: function (e) {
		if (!this._animating) {
			this._animating = true;
			this._prepareBgBuffer();
		}

		var bg = this._bgBuffer,
		    transform = L.DomUtil.TRANSFORM,
		    initialTransform = e.delta ? L.DomUtil.getTranslateString(e.delta) : bg.style[transform],
		    scaleStr = L.DomUtil.getScaleString(e.scale, e.origin);

		bg.style[transform] = e.backwards ?
				scaleStr + ' ' + initialTransform :
				initialTransform + ' ' + scaleStr;
	},

	_endZoomAnim: function () {
		var front = this._tileContainer,
		    bg = this._bgBuffer;

		front.style.visibility = '';
		front.parentNode.appendChild(front); // Bring to fore

		// force reflow
		L.Util.falseFn(bg.offsetWidth);

		var zoom = this._map.getZoom();
		if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
			this._clearBgBuffer();
		}

		this._animating = false;
	},

	_clearBgBuffer: function () {
		var map = this._map;

		if (map && !map._animatingZoom && !map.touchZoom._zooming) {
			this._bgBuffer.innerHTML = '';
			this._bgBuffer.style[L.DomUtil.TRANSFORM] = '';
		}
	},

	_prepareBgBuffer: function () {

		var front = this._tileContainer,
		    bg = this._bgBuffer;

		// if foreground layer doesn't have many tiles but bg layer does,
		// keep the existing bg layer and just zoom it some more

		var bgLoaded = this._getLoadedTilesPercentage(bg),
		    frontLoaded = this._getLoadedTilesPercentage(front);

		if (bg && bgLoaded > 0.5 && frontLoaded < 0.5) {

			front.style.visibility = 'hidden';
			this._stopLoadingImages(front);
			return;
		}

		// prepare the buffer to become the front tile pane
		bg.style.visibility = 'hidden';
		bg.style[L.DomUtil.TRANSFORM] = '';

		// switch out the current layer to be the new bg layer (and vice-versa)
		this._tileContainer = bg;
		bg = this._bgBuffer = front;

		this._stopLoadingImages(bg);

		//prevent bg buffer from clearing right after zoom
		clearTimeout(this._clearBgBufferTimer);
	},

	_getLoadedTilesPercentage: function (container) {
		var tiles = container.getElementsByTagName('img'),
		    i, len, count = 0;

		for (i = 0, len = tiles.length; i < len; i++) {
			if (tiles[i].complete) {
				count++;
			}
		}
		return count / len;
	},

	// stops loading all tiles in the background layer
	_stopLoadingImages: function (container) {
		var tiles = Array.prototype.slice.call(container.getElementsByTagName('img')),
		    i, len, tile;

		for (i = 0, len = tiles.length; i < len; i++) {
			tile = tiles[i];

			if (!tile.complete) {
				tile.onload = L.Util.falseFn;
				tile.onerror = L.Util.falseFn;
				tile.src = L.Util.emptyImageUrl;

				tile.parentNode.removeChild(tile);
			}
		}
	}
});


/*
 * Provides L.Map with convenient shortcuts for using browser geolocation features.
 */

L.Map.include({
	_defaultLocateOptions: {
		watch: false,
		setView: false,
		maxZoom: Infinity,
		timeout: 10000,
		maximumAge: 0,
		enableHighAccuracy: false
	},

	locate: function (/*Object*/ options) {

		options = this._locateOptions = L.extend(this._defaultLocateOptions, options);

		if (!navigator.geolocation) {
			this._handleGeolocationError({
				code: 0,
				message: 'Geolocation not supported.'
			});
			return this;
		}

		var onResponse = L.bind(this._handleGeolocationResponse, this),
			onError = L.bind(this._handleGeolocationError, this);

		if (options.watch) {
			this._locationWatchId =
			        navigator.geolocation.watchPosition(onResponse, onError, options);
		} else {
			navigator.geolocation.getCurrentPosition(onResponse, onError, options);
		}
		return this;
	},

	stopLocate: function () {
		if (navigator.geolocation) {
			navigator.geolocation.clearWatch(this._locationWatchId);
		}
		if (this._locateOptions) {
			this._locateOptions.setView = false;
		}
		return this;
	},

	_handleGeolocationError: function (error) {
		var c = error.code,
		    message = error.message ||
		            (c === 1 ? 'permission denied' :
		            (c === 2 ? 'position unavailable' : 'timeout'));

		if (this._locateOptions.setView && !this._loaded) {
			this.fitWorld();
		}

		this.fire('locationerror', {
			code: c,
			message: 'Geolocation error: ' + message + '.'
		});
	},

	_handleGeolocationResponse: function (pos) {
		var lat = pos.coords.latitude,
		    lng = pos.coords.longitude,
		    latlng = new L.LatLng(lat, lng),

		    latAccuracy = 180 * pos.coords.accuracy / 40075017,
		    lngAccuracy = latAccuracy / Math.cos(L.LatLng.DEG_TO_RAD * lat),

		    bounds = L.latLngBounds(
		            [lat - latAccuracy, lng - lngAccuracy],
		            [lat + latAccuracy, lng + lngAccuracy]),

		    options = this._locateOptions;

		if (options.setView) {
			var zoom = Math.min(this.getBoundsZoom(bounds), options.maxZoom);
			this.setView(latlng, zoom);
		}

		var data = {
			latlng: latlng,
			bounds: bounds,
			timestamp: pos.timestamp
		};

		for (var i in pos.coords) {
			if (typeof pos.coords[i] === 'number') {
				data[i] = pos.coords[i];
			}
		}

		this.fire('locationfound', data);
	}
});


}(window, document));

/*
 Leaflet-GeoMixer, Leaflet plugin for visualization data from GeoMixer server
 (c) 2013-2016, RDC ScanEx
*/
(function () {
"use strict";
var L;
if (typeof module !== 'undefined' && module.exports) {
    L = require('leaflet');
    L.gmx = {};
    module.exports = L.gmx;
} else {
    L = window.L;
}


/*
   Single-pass recursive descent PEG parser library:
      http://en.wikipedia.org/wiki/Parsing_expression_grammar
   Inspired by Chris Double's parser combinator library in JavaScript:
      http://www.bluishcoder.co.nz/2007/10/javascript-packrat-parser.html
	+ Добавлены функции: Math.floor
*/
(function() {
    var regexExpression = /\[(.+?)\]/g,
        regexMath = /(floor\()/g;
	var Parsers = {						// Парсеры
        functionFromExpression: function(s) {
/*eslint-disable no-new-func*/
            return new Function(
/*eslint-enable */
                'props',
                'indexes',
                'return ' +
                    s
                     .replace(regexExpression, 'props[indexes["$1"]]')
                     .replace(regexMath, 'Math.$1')
                    + ';'
            );
        }
    };

	var makePair = function(t1, t2) {
		return {head: t1, tail: t2};
	};

// C-style linked list via recursive typedef.
//   Used purely functionally to get shareable sublists.
//typedef LinkedList = Pair<Dynamic, LinkedList>;
	var LinkedList = function(t1, t2) {
		return makePair(t1, t2);
	};

// Parser state contains position in string and some accumulated data.
//typedef ParserState = Pair<Int, LinkedList>;
	var ParserState = function(t1, t2) {
		return makePair(t1, t2);
	};

// Parser accepts string and state, returns another state.
//typedef Parser = String->ParserState->ParserState;

	// A parser state that indicates failure.
	var fail = new ParserState(-1, null);

	// Check for failure.
	var failed = function(state) {
		return (state.head === -1);
	};

	// Advance a parser state by n characters.
	var advance = function(state, n) {
		return new ParserState(state.head + n, state.tail);
	};

	// Match a specified string.
	var token = function(tok) {
		var len = tok.length;
		return function(s, state) {
			return (s.substr(state.head, len) === tok) ? advance(state, len) : fail;
		};
	};

	// Match a string without regard to case.
	var caseInsensitiveToken = function(tok) {
		var len = tok.length;
		tok = tok.toLowerCase();
		return function(s, state) {
			return (s.substr(state.head, len).toLowerCase() === tok) ? advance(state, len) : fail;
		};
	};

	// Match a single character in a specified range.
	var range = function(startChar, endChar) {
		var startCode = startChar.charCodeAt(0);
		var endCode = endChar.charCodeAt(0);
		return function(s, state) {
			var code = s.charCodeAt(state.head);
			return ((code >= startCode) && (code <= endCode)) ? advance(state, 1) : fail;
		};
	};

	// Match any character outside a certain set.
	//   This combinator is intended only for single character parsers.
	var anythingExcept = function(parser) {
		return function(s, state) {
			return ((s.length > state.head) && failed(parser(s, state))) ? advance(state, 1) : fail;
		};
	};

	// Match thing1, then thing2, ..., then thingN.
	var sequence = function(parsers) {
		return function(s, state) {
			for (var i = 0; i < parsers.length; i++) {
				state = parsers[i](s, state);
				if (failed(state)) {
					return fail;
                }
			}
			return state;
		};
	};

	// Match thing1, or thing2, ..., or thingN.
	var choice = function(parsers) {
		return function(s, state) {
			for (var i = 0; i < parsers.length; i++) {
				var newState = parsers[i](s, state);
				if (!failed(newState)) {
					return newState;
                }
			}
			return fail;
		};
	};

	// Match immediately, without regard to what's in the string.
	var nothing = function(s, state) {
		return state;
	};

	// Match this thing or nothing.
	var maybe = function(parser) {
		return choice([parser, nothing]);
	};

	// Match minCount or more repetitions of this thing.
	var repeat = function(minCount, parser) {
		return function(s, state) {
			var count = 0;
			while (true) {
				var newState = parser(s, state);
				if (failed(newState)) {
					return (count >= minCount) ? state : fail;
				} else {
					count += 1;
					state = newState;
				}
			}
			// return fail;
		};
	};

	// Match a list of minCount or more instances of thing1, separated by thing2.
	var separatedList = function(minCount, parser, separator) {
		var parser1 = sequence([parser, repeat(minCount - 1, sequence([separator, parser]))]);
		return (minCount > 0) ? parser1 : choice([parser1, nothing]);
	};

	var whitespace = repeat(0, choice([
		token(' '),
		token('\t'),
		token('\n')
	]));

	// Same as separatedList, but can have whitespace between items and separators.
	var whitespaceSeparatedList = function(minCount, parser, separator) {
		return separatedList(minCount, parser, sequence([whitespace, separator, whitespace]));
	};

	// Same as sequence, but can have whitespace between items.
	var whitespaceSeparatedSequence = function(parsers) {
		var newParsers = [];
		for (var i = 0; i < parsers.length; i++) {
			if (newParsers.length > 0) { newParsers.push(whitespace); }
			newParsers.push(parsers[i]);
		}
		return sequence(newParsers);
	};

	// This combinator captures the string that the parser matched
	//   and adds it to the current parser state, consing a new state.
	var capture = function(parser) {
		return function(s, state) {
			var newState = parser(s, state);
			return failed(newState) ? fail : new ParserState(newState.head, new LinkedList(s.substr(state.head, newState.head - state.head), newState.tail));
		};
	};

	// This combinator passes the accumulated parser state to a given
	//  function for processing. The result goes into the new state.
	var action = function(parser, func) {
		return function(s, state) {
			var oldState = state;
			var newState = parser(s, new ParserState(oldState.head, null));
			return failed(newState) ? fail : new ParserState(newState.head, new LinkedList(func(newState.tail), oldState.tail));
		};
	};

	// Define a syntactic subset of SQL WHERE clauses.
	var fieldName = capture(repeat(1, choice([
		range('a', 'z'),
		range('A', 'Z'),
		range('а', 'я'),
		range('А', 'Я'),
		range('0', '9'),
		token('_')
	])));

	var fieldNameWithSpaces = capture(repeat(1, choice([
		range('a', 'z'),
		range('A', 'Z'),
		range('а', 'я'),
		range('А', 'Я'),
		range('0', '9'),
		token('_'),
		token(' ')
	])));

	var quotedFieldName = choice([
		fieldName,
		sequence([token('"'), fieldNameWithSpaces, token('"')]),
		sequence([token('`'), fieldNameWithSpaces, token('`')])
	]);

	var stringLiteral = sequence([
		token('\''),
		capture(repeat(0, anythingExcept(token('\'')))),
		token('\'')
	]);

	var digits = repeat(1, range('0', '9'));

	var numberLiteral = capture(sequence([
		maybe(token('-')),
		digits,
		maybe(sequence([token('.'), digits]))
	]));

	var literal = choice([numberLiteral, stringLiteral]);

	var applyParser = function(s, parser) {
		return parser(s, new ParserState(0, null));
	};

	// Order is important here: longer ops should be tried first.
	var opTerm = action(
		whitespaceSeparatedSequence([
			quotedFieldName,
			capture(choice([
				token('=='),
				token('!='),
				token('<>'),
				token('<='),
				token('>='),
				token('='),
				token('<'),
				token('>'),
				caseInsensitiveToken('LIKE')
			])),
            choice([literal, quotedFieldName])
		]),
		function(state) {
			// Linked list contains fieldname, operation, value
			// (in reverse order).

			var fieldName = state.tail.tail.head;
			var op = state.tail.head;
			var referenceValue = state.head;

			var matchPattern = null;
			if (op.toUpperCase() === 'LIKE') {
				matchPattern = function(fieldValue) {
					var matchFrom = null;
					matchFrom = function(referenceIdx, fieldIdx) {
						var referenceChar = referenceValue.charAt(referenceIdx);
						var fieldChar = fieldValue.charAt(fieldIdx);
						if (referenceChar === '') {
							return (fieldChar === '');
						} else if (referenceChar === '%') {
							return matchFrom(referenceIdx + 1, fieldIdx) || ((fieldChar !== '') && matchFrom(referenceIdx, fieldIdx + 1));
						} else {
							return (referenceChar === fieldChar) && matchFrom(referenceIdx + 1, fieldIdx + 1);
                        }
					};
					return matchFrom(0, 0);
				};
			}

			return function(props, indexes, types) {
				var fieldValue = props[indexes[fieldName]],
                    rValue = referenceValue;
                if (referenceValue in indexes) { rValue = props[indexes[rValue]]; }
                if (types[fieldName] === 'date' && typeof rValue === 'string') { rValue = L.gmxUtil.getUnixTimeFromStr(rValue); }
                if (typeof fieldValue === 'boolean' && typeof rValue === 'string') {
                    fieldValue = fieldValue ? 'True' : 'False';
                }
				if (fieldValue === null) { return false; }
				if (matchPattern !== null) { return matchPattern(fieldValue);
/*eslint-disable eqeqeq */
                } else if ((op === '=') || (op === '==')) { return (fieldValue == rValue);
				} else if ((op === '!=') || (op === '<>')) { return (fieldValue != rValue);
/*eslint-enable */
                } else {
                    var f1, f2;
					if (!(referenceValue in indexes) && typeof rValue === 'string' && applyParser(rValue, numberLiteral).head === rValue.length) {
						f1 = parseFloat(fieldValue);
						f2 = parseFloat(rValue);
						if (op === '<') { return (f1 < f2);
						} else if (op === '>') { return (f1 > f2);
						} else if (op === '<=') { return (f1 <= f2);
						} else if (op === '>=') { return (f1 >= f2);
						} else { return false;
                        }
					} else {
						f1 = fieldValue;
						f2 = rValue;
						if (op === '<') { return (f1 < f2);
						} else if (op === '>') { return (f1 > f2);
						} else if (op === '<=') { return (f1 <= f2);
						} else if (op === '>=') { return (f1 >= f2);
						} else { return false;
                        }
					}
				}
			};
		}
	);

	var inTerm = action(
		whitespaceSeparatedSequence([
			quotedFieldName,
			caseInsensitiveToken('IN'),
			token('('),
			whitespaceSeparatedList(0, literal, token(',')),
			token(')')
		]),
		function(state) {
			// Linked list contains fieldname and multiple values
			//   (in reverse order).

			var node = state;
			while (node.tail != null) {
				node = node.tail;
			}
            var fieldName = node.head;

			return function(props, indexes) {
				var value = props[indexes[fieldName]];
				if (value == null) { return false; }
				var node = state;
				while (node.tail !== null) {
					if (node.head === value) { return true; }
					node = node.tail;
				}
				return false;
			};
		}
	);

	// Forward declarations to allow mutually recursive grammar definitions.
	var term = function(s, state) { return term(s, state); };
	var expression = function(s, state) { return expression(s, state); };

	var notTerm = action(
		whitespaceSeparatedSequence([caseInsensitiveToken('NOT'), term]),
		function(state) {
			// Linked list contains only processed inner term.
			var innerTerm = state.head;
			return function(props, indexes, types) {
				return !innerTerm(props, indexes, types);
			};
		}
	);

	term = choice([
		notTerm,
		opTerm,
		inTerm,
		whitespaceSeparatedSequence([token('('), expression, token(')')])
	]);

	// AND and OR expressions must have at least 2 terms,
	//   to disambiguate them from a single term.

	var andExpression = action(
		whitespaceSeparatedList(2, term, caseInsensitiveToken('AND')),
		function(state) {
			// Linked list contains multiple processed inner terms
			//   (in reverse order).
			return function(props, indexes, types) {
				var flag = true;
				var node = state;
				while (node != null) {
					flag = flag && node.head(props, indexes, types);
					node = node.tail;
				}
				return flag;
			};
		}
	);

	var orExpression = action(
		whitespaceSeparatedList(2, term, caseInsensitiveToken('OR')),
		function(state) {
			// Linked list contains multiple processed inner terms
			//   (in reverse order).
			return function(props, indexes, types) {
				var flag = false;
				var node = state;
				while (node != null) {
					flag = flag || node.head(props, indexes, types);
					node = node.tail;
				}
				return flag;
			};
		}
	);

	// Order is important here: term should be tried last,
	//   because andExpression and orExpression start with it.
	expression = choice([
		andExpression,
		orExpression,
		term
	]);

	var whereClause = sequence([whitespace, expression, whitespace]);

	Parsers.parseSQL = function(str) {
		var result = applyParser(str, whereClause);
		return result.head === str.length ?
			result.tail.head :
            (applyParser(str, whitespace).head === str.length) ?
				function(/*props*/) { return true; } :
				null;
	};

	var additiveExpression = function(s, state) { return additiveExpression(s, state); };
	var multiplicativeExpression = function(s, state) { return multiplicativeExpression(s, state); };
	additiveExpression = action(
		whitespaceSeparatedList(
			1,
			multiplicativeExpression,
			capture(choice([token('+'), token('-')]))
		),
		function(state)
		{
			return function(props, indexes, types)
			{
				var pos = state;
				var term = 0.0;
				while (pos !== null) {
					term += pos.head(props, indexes, types);
					if (pos.tail === null) {
						return term;
					} else {
						if (pos.tail.head === '-') { term = -term; }
						pos = pos.tail.tail;
					}
				}
				return term;
			};
		}
	);

	var multiplicativeTerm = choice([
		action(
			numberLiteral,
			function(state) {
				return function(/*props, indexes, types*/) {
					return parseFloat(state.head);
				};
			}
		),
		action(
			sequence([token('floor('), additiveExpression, token(')')]),
			function(state) {
				return function(props, indexes, types) {
					var res = state.head(props, indexes, types);
					return Math.floor(res);
				};
			}
		),
		action(
			sequence([token('['), fieldName, token(']')]),
			function(state) {
				return function(props, indexes) {
					return parseFloat(props[indexes[state.head]]);
				};
			}
		),
		whitespaceSeparatedSequence([
			token('('),
			additiveExpression,
			token(')')
		])
	]);
	multiplicativeTerm = choice([
		multiplicativeTerm,
		action(
			whitespaceSeparatedSequence([token('-'), multiplicativeTerm]),
			function(state) {
				return function(props, indexes, types) {
					return -state.head(props, indexes, types);
				};
			}
		)
	]);
	multiplicativeExpression = action(
		whitespaceSeparatedList(
			1,
			multiplicativeTerm,
			capture(choice([token('*'), token('/')]))
		),
		function(state)
		{
			return function(props, indexes, types) {
				var pos = state;
				var term = 1.0;
				while (pos !== null) {
					term *= pos.head(props, indexes, types);
					if (pos.tail === null) {
						return term;
					} else {
						if (pos.tail.head === '/') { term = 1.0 / term; }
						pos = pos.tail.tail;
					}
				}
				return term;
			};
		}
	);

	multiplicativeTerm = choice([
		multiplicativeTerm,
		action(
			whitespaceSeparatedSequence([token('-'), multiplicativeTerm]),
			function(state) {
				return function(props, indexes, types) {
					return -state.head(props, indexes, types);
				};
			}
		)
	]);

	var arithmeticExpression = sequence([whitespace, additiveExpression, whitespace]);
	Parsers.parseExpression = function(s) {
		var result = applyParser(s, arithmeticExpression);
        return result.head === s.length ? result.tail.head : null;
        // return result.head === s.length ? Parsers.functionFromExpression(s) : null;
	};

	var svgPath = action(
		repeat(0, choice([
			numberLiteral,
			token(','),
			token('M'),
			token('C'),
			repeat(1, choice([
				token(' '),
				token('\t'),
				token('\r'),
				token('\n')
			]))
		])),
		function(state) {
			var coords = [];
			while (state !== null) {
				coords.push(parseFloat(state.head));
				state = state.tail;
			}
			coords.reverse();
			return coords;
		}
	);

	Parsers.parseSVGPath = function(s) {
		var result = applyParser(s, svgPath);
		if (result.head === s.length) {
			return result.tail.head;
		} else {
			return [];
        }
	};

	//extend L.gmx namespace
    L.gmx = L.gmx || {};
	L.gmx.Parsers = Parsers;
})();


//all the methods can be called without instance itself
//For example:
//
// var def = new Deferred();
// doSomething(def.resolve) (instead of doSomething(def.resolve.bind(def))
var Deferred = function(cancelFunc) {
    var resolveCallbacks = [],
        rejectCallbacks = [],
        isFulfilled = false,
        isResolved = false,
        fulfilledData,
        onceAdded = false,
        isCancelled = false;

    var fulfill = this._fulfill = function(resolved /*, data*/) {
        if (isFulfilled) {
            return;
        }
        var callbacks = resolved ? resolveCallbacks : rejectCallbacks;
        fulfilledData = [].slice.call(arguments, 1);
        isFulfilled = true;
        isResolved = resolved;

        callbacks.forEach(function(callback) { callback.apply(null, fulfilledData); });
        resolveCallbacks = rejectCallbacks = [];
    };

    this.resolve = function(/*data*/) {
        isCancelled || fulfill.apply(null, [true].concat([].slice.call(arguments)));
    };

    this.reject = function(/*data*/) {
        isCancelled || fulfill.apply(null, [false].concat([].slice.call(arguments)));
    };

    var cancel = this.cancel = function() {
        if (!isCancelled && !isFulfilled) {
            isCancelled = true;
            cancelFunc && cancelFunc();
        }
    };

    var then = this.then = function(resolveCallback, rejectCallback) {
        if (isCancelled) {
            return null;
        }

        var userFuncDef = null;
        var def = new Deferred(function() {
            cancel();
            userFuncDef && userFuncDef.cancel();
        });

        var fulfillFunc = function(func, resolved) {
            return function(/*data*/) {
                if (!func) {
                    def._fulfill.apply(null, [resolved].concat([].slice.call(arguments)));
                } else {
                    var res = func.apply(null, arguments);
                    if (res instanceof Deferred) {
                        userFuncDef = res;
                        res.then(def.resolve, def.reject);
                    } else {
                        def.resolve(res);
                    }
                }
            };
        };

        if (isFulfilled) {
            fulfillFunc(isResolved ? resolveCallback : rejectCallback, isResolved).apply(null, fulfilledData);
        } else {
            resolveCallbacks.push(fulfillFunc(resolveCallback, true));
            rejectCallbacks.push(fulfillFunc(rejectCallback, false));
        }
        return def;
    };

    this.once = function(onceResolveCallback) {
        if (!onceAdded) {
            onceAdded = true;
            then(onceResolveCallback);
        }
    };

    this.always = function(callback) {
        then(callback, callback);
    };

    this.getFulfilledData = function() {
        return fulfilledData;
    };
};

Deferred.all = function() {
    var defArray = [].slice.apply(arguments);
    var resdef = new Deferred();
    var left = defArray.length;
    var results = new Array(defArray.length);

    if (left) {
        defArray.forEach(function(def, i) {
            def.then(function(res) {
                results[i] = res;
                left--;
                if (left === 0) {
                    resdef.resolve.apply(resdef, results);
                }
            }, function() {
                resdef.reject();
            });
        });
    } else {
        resdef.resolve();
    }

    return resdef;
};

L.gmx = L.gmx || {};
L.gmx.Deferred = Deferred;


(function() {

var ImageRequest = function(id, url, options) {
    this._id = id;
    this.def = new L.gmx.Deferred(L.gmx.imageLoader._cancelRequest.bind(L.gmx.imageLoader, this));
    this.remove = L.gmx.imageLoader._removeRequestFromCache.bind(L.gmx.imageLoader, this);
    this.url = url;
    this.options = options || {};
};

var GmxImageLoader = L.Class.extend({
    includes: L.Mixin.Events,
    statics: {
        MAX_COUNT: 20 // max number of parallel requests
    },

    initialize: function() {
        this.curCount = 0;        // number of currently processing requests (number of items in "inProgress")
        this.requests = [];       // not yet processed image requests
        this.inProgress = {};     // hash of in progress image loadings
        this.requestsCache = {};  // for requests cache by uniqueID
        this.uniqueID = 0;
    },

    _resolveRequest: function(request, image, canceled) {
        var def = request.def;
        if (image) {
            if (!canceled && request.options.cache) {
                var url = request.url,
                    cacheItem = this.requestsCache[url],
                    cacheKey = request._id;
                if (!cacheItem) { cacheItem = this.requestsCache[url] = {image: image, requests:{}}; }
                if (!cacheItem.requests[cacheKey]) { cacheItem.requests[cacheKey] = request; }
            }
            def.resolve(image);
        } else if (!canceled) {
            def.reject();
        }
        this.fire('requestdone', {request: request});
    },

    _imageLoaded: function(url, image, canceled) {
        if (url in this.inProgress) {
            var resolveRequest = function(it) {
                this._resolveRequest(it, image, canceled);
            };
            this.inProgress[url].requests.forEach(resolveRequest.bind(this));
            --this.curCount;
            delete this.inProgress[url];
        }
        L.gmxUtil.loaderStatus(url, true);
        this.fire('imageloaded', {url: url});
        this._nextLoad();
    },

    _nextLoad: function() {  // загрузка следующего
        if (this.curCount >= GmxImageLoader.MAX_COUNT || !this.requests.length) {
            return;
        }

        var request = this.requests.shift(),
            url = request.url;

        if (url in this.inProgress) {
            this.inProgress[url].requests.push(request);
        } else {
            var requests = [request];
            this.inProgress[url] = {requests: requests};
            ++this.curCount;

            for (var k = this.requests.length - 1; k >= 0; k--) {
                if (this.requests[k].url === url) {
                    requests.push(this.requests[k]);
                    this.requests.splice(k, 1);
                }
            }

            var image = this._loadImage(request);
            if (!image.width) {
                L.gmxUtil.loaderStatus(url);
            }

            //theoretically image loading can be synchronous operation
            if (this.inProgress[url]) {
                this.inProgress[url].image = image;
            }
        }
    },

    _loadImage: function(request) {
        var imageObj = new Image(),
            url = request.url,
            _this = this;

        if (request.options.crossOrigin) {
            imageObj.crossOrigin = request.options.crossOrigin;
        }

        imageObj.onload = this._imageLoaded.bind(this, url, imageObj, false);
        imageObj.onerror = function() {
            _this._imageLoaded(url);
        };
        imageObj.src = url;

        this.fire('imageloadstart', {url: url});

        return imageObj;
    },

    _cancelRequest: function(request) {
        var id = request._id,
            url = request.url,
            i = 0, len;
        if (url in this.inProgress) {
            var loadingImg = this.inProgress[url],
                requests = loadingImg.requests;

            len = requests.length;
            if (len === 1 && requests[0]._id === id) {
                loadingImg.image.onload = L.Util.falseFn;
                loadingImg.image.onerror = L.Util.falseFn;
                loadingImg.image.src = L.Util.emptyImageUrl;
                this._imageLoaded(url, null, true);
            } else {
                for (i = 0; i < len; i++) {
                    if (requests[i]._id === id) {
                        requests.splice(i, 1);
                        break;
                    }
                }
            }
        } else {
            for (i = 0, len = this.requests.length; i < len; i++) {
                if (this.requests[i]._id === id) {
                    this.requests.splice(i, 1);
                    break;
                }
            }
        }

        this.fire('requestdone', {request: request});
    },

    _removeRequestFromCache: function(request) {    // remove request from cache
        this._cancelRequest(request);
        this._clearCacheItem(request.url, request._id);
    },

    _clearCacheItem: function(url, cacheKey) {    // remove cache item
        if (this.requestsCache[url]) {
            var cacheItem = this.requestsCache[url];
            delete cacheItem.requests[cacheKey];
            if (Object.keys(cacheItem.requests).length === 0) {
                delete this.requestsCache[url];
            }
        }
    },
    _add: function(atBegin, url, options) {
        var id = 'id' + (++this.uniqueID),
            request = new ImageRequest(id, url, options);

        if (url in this.inProgress) {
            this.inProgress[url].requests.push(request);
        } else {
            atBegin ? this.requests.unshift(request) : this.requests.push(request);
            this._nextLoad();
        }

        this.fire('request', {request: request});

        return request;
    },

    push: function(url, options) {  // добавить запрос в конец очереди
        return this._add(false, url, options);
    },

    unshift: function(url, options) {   // добавить запрос в начало очереди
        return this._add(true, url, options);
    }
});

L.gmx.imageLoader = new GmxImageLoader();

})();


/**
* @name L.gmxUtil
* @namespace
*/
var gmxAPIutils = {
    lastMapId: 0,

    newId: function()
    {
        gmxAPIutils.lastMapId += 1;
        return '_' + gmxAPIutils.lastMapId;
    },

    uniqueGlobalName: function(thing)
    {
        var id = gmxAPIutils.newId();
        window[id] = thing;
        return id;
    },

    isPageHidden: function()	{		// Видимость окна браузера
        return document.hidden || document.msHidden || document.webkitHidden || document.mozHidden || false;
    },

    normalizeHostname: function(hostName) {
        var parsedHost = L.gmxUtil.parseUri((hostName.substr(0, 4) !== 'http' ? 'http://' : '') + hostName); // Bug in gmxAPIutils.parseUri for 'localhost:8000'

        hostName = parsedHost.host + parsedHost.directory;

        if (hostName[hostName.length - 1] === '/') {
            hostName = hostName.substring(0, hostName.length - 1);
        }

        return hostName;
    },

	getLayerItemFromServer: function(options) {
        var query = options.query ? options.query : '[' + options.field + ']=' + options.value,
            req = {
                WrapStyle: 'func',
                geometry: true,
                layer: options.layerID,
                query: query
            };
        if (options.border) { req.border = options.border; }
        return gmxAPIutils.requestJSONP(
            options.url || (window.serverBase || 'http://maps.kosmosnimki.ru/') + 'VectorLayer/Search.ashx',
            req,
            options
        );
    },

	getCadastreFeatures: function(options) {
		// example: L.gmxUtil.getCadastreFeatures({latlng: L.latLng(48.350039, 45.152757), callbackParamName: 'callback'});
        if (options.latlng) {
			var latlng = options.latlng,
				req = {
					WrapStyle: 'func',
					text: (latlng.lat + ' ' + latlng.lng).replace(/\./g, ','),
					tolerance: options.tolerance || 0
				};
			return gmxAPIutils.requestJSONP(
				options.url || 'http://pkk5.rosreestr.ru/api/features/',
				req,
				options
			);
		} else {
			return null;
		}
    },

    /** Sends JSONP requests
     * @memberof L.gmxUtil
     * @param {String} url - request URL
     * @param {Object} params - request params
     * @param {Object} [options] - additional request options
     * @param {String} [options.callbackParamName=CallbackName] - Name of param, that will be used for callback id.
       If callbackParamName is set to null, no params will be added (StaticJSONP)
     * @return {Deferred} Promise with server JSON response or with error status
    */
	requestJSONP: function(url, params, options) {
        options = options || {};
        var def = new L.gmx.Deferred();

        var script = document.createElement('script');
        script.setAttribute('charset', 'UTF-8');
        var callbackParamName = 'callbackParamName' in options ? options.callbackParamName : 'CallbackName';
        var urlParams = L.extend({}, params);

        if (callbackParamName) {
            var callbackName = gmxAPIutils.uniqueGlobalName(function(obj) {
                delete window[callbackName];
                def.resolve(obj, options);
            });

            urlParams[callbackParamName] = callbackName;
        }

        var paramsStringItems = [];

        for (var p in urlParams) {
            paramsStringItems.push(p + '=' + encodeURIComponent(urlParams[p]));
        }

        var src = url + (url.indexOf('?') === -1 ? '?' : '&') + paramsStringItems.join('&');

        script.onerror = function(e) {
            def.reject(e);
            L.gmxUtil.loaderStatus(src, true);
            script.parentNode.removeChild(script);
        };
        script.onload = function() {
            L.gmxUtil.loaderStatus(src, true);
            script.parentNode.removeChild(script);
        };
        L.gmxUtil.loaderStatus(src, null, 'vector');
        script.setAttribute('src', src);

        document.getElementsByTagName('head').item(0).appendChild(script);
        return def;
    },
    getXmlHttp: function() {
        var xmlhttp;
        if (typeof XMLHttpRequest !== 'undefined') {
            xmlhttp = new XMLHttpRequest();
        } else {
          try {
            xmlhttp = new ActiveXObject('Msxml2.XMLHTTP');
          } catch (e) {
            try {
              xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');
            } catch (E) {
              xmlhttp = false;
            }
          }
        }
        return xmlhttp;
    },
    request: function(ph) { // {'type': 'GET|POST', 'url': 'string', 'callback': 'func'}
        var xhr = gmxAPIutils.getXmlHttp();
        if (xhr) {
            xhr.open((ph.type ? ph.type : 'GET'), ph.url, ph.async || false);
            if (ph.headers) {
                for (var key in ph.headers) {
                    xhr.setRequestHeader(key, ph.headers[key]);
                }
            }
            var reqId = L.gmxUtil.loaderStatus();
            if (ph.async) {
                if (ph.withCredentials) {
                    xhr.withCredentials = true;
                }
                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        L.gmxUtil.loaderStatus(reqId, true);
                        if (xhr.status === 200) {
                            ph.callback(xhr.responseText);
                            xhr = null;
                        } else if (ph.onError) {
                            ph.onError(xhr);
                        }
                    }
                };
            }
            xhr.send((ph.params ? ph.params : null));
            if (!ph.async && xhr.status === 200) {
                ph.callback(xhr.responseText);
                L.gmxUtil.loaderStatus(reqId, true);
                return xhr.status;
            }
            return true;
        }
        if (ph.onError) {
            ph.onError({Error: 'bad XMLHttpRequest!'});
        }
        return false;
    },

    tileSizes: [], // Размеры тайла по zoom
    getTileNumFromLeaflet: function (tilePoint, zoom) {
        if ('z' in tilePoint) {
            zoom = tilePoint.z;
        }
        var pz = Math.pow(2, zoom),
            tx = tilePoint.x % pz + (tilePoint.x < 0 ? pz : 0),
            ty = tilePoint.y % pz + (tilePoint.y < 0 ? pz : 0);
        return {
            z: zoom,
            x: tx % pz - pz / 2,
            y: pz / 2 - 1 - ty % pz
        };
    },

	getTilePosZoomDelta: function(tilePoint, zoomFrom, zoomTo) {		// получить смещение тайла на меньшем zoom
        var dz = Math.pow(2, zoomFrom - zoomTo),
            size = 256 / dz,
            dx = tilePoint.x % dz,
            dy = tilePoint.y % dz;
		return {
			size: size,
			zDelta: dz,
			x: size * (dx < 0 ? dz + dx : dx),
			y: size * (dy < 0 ? -(1 + tilePoint.y) % dz : dz - 1 - dy)
		};
    },

    geoItemBounds: function(geo) {  // get item bounds array by geometry
        if (!geo) {
            return {
                bounds: null,
                boundsArr: []
            };
        }
        var type = geo.type,
            coords = geo.coordinates,
            b = null,
            i = 0,
            len = 0,
            bounds = null,
            boundsArr = [];
        if (type === 'MULTIPOLYGON' || type === 'MultiPolygon') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                var arr1 = [];
                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    b = gmxAPIutils.bounds(coords[i][j]);
                    arr1.push(b);
                    if (j === 0) { bounds.extendBounds(b); }
                }
                boundsArr.push(arr1);
            }
        } else if (type === 'POLYGON' || type === 'Polygon') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                b = gmxAPIutils.bounds(coords[i]);
                boundsArr.push(b);
                if (i === 0) { bounds.extendBounds(b); }
            }
        } else if (type === 'POINT' || type === 'Point') {
            bounds = gmxAPIutils.bounds([coords]);
        } else if (type === 'MULTIPOINT' || type === 'MultiPoint') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                b = gmxAPIutils.bounds([coords[i]]);
                bounds.extendBounds(b);
            }
        } else if (type === 'LINESTRING' || type === 'LineString') {
            bounds = gmxAPIutils.bounds(coords);
            //boundsArr.push(bounds);
        } else if (type === 'MULTILINESTRING' || type === 'MultiLineString') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                b = gmxAPIutils.bounds(coords[i]);
                bounds.extendBounds(b);
                //boundsArr.push(b);
            }
        }
        return {
            bounds: bounds,
            boundsArr: boundsArr
        };
    },

    getUnFlattenGeo: function(geo) {  // get unFlatten geometry
        var type = geo.type,
            isLikePolygon = type.indexOf('POLYGON') !== -1 || type.indexOf('Polygon') !== -1,
            coords = geo.coordinates,
            coordsOut = coords;

        if (isLikePolygon) {
            coordsOut = [];
            var isPolygon = type === 'POLYGON' || type === 'Polygon';
            if (isPolygon) { coords = [coords]; }
            for (var i = 0, len = coords.length; i < len; i++) {
                var ring = [];
                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    ring[j] = gmxAPIutils.unFlattenRing(coords[i][j]);
                }
                coordsOut.push(ring);
            }
            if (isPolygon) { coordsOut = coordsOut[0]; }
        }
        return {type: type, coordinates: coordsOut};
    },

    unFlattenRing: function(arr) {
        if (typeof arr[0] !== 'number') {
            return arr;
        }
        var len = arr.length,
            cnt = 0,
            res = new Array(len / 2);

        for (var i = 0; i < len; i += 2) {
            res[cnt++] = [arr[i], arr[i + 1]];
        }
        return res;
    },

    geoFlatten: function(geo) {  // get flatten geometry
        var type = geo.type,
            isLikePolygon = type.indexOf('POLYGON') !== -1 || type.indexOf('Polygon') !== -1,
            isPolygon = type === 'POLYGON' || type === 'Polygon',
            coords = geo.coordinates;

        if (isLikePolygon) {
            if (isPolygon) { coords = [coords]; }
            for (var i = 0, len = coords.length; i < len; i++) {
                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    coords[i][j] = gmxAPIutils.flattenRing(coords[i][j]);
                }
            }
        }
    },

    flattenRing: function(arr) {
        var len = arr.length,
            cnt = 0,
            CurArray = typeof Float64Array === 'function' ? Float64Array : Array,
            res = new CurArray(2 * len);

        for (var i = 0; i < len; i++) {
            res[cnt++] = arr[i][0];
            res[cnt++] = arr[i][1];
        }
        return res;
    },

    /** Check rectangle type by coordinates
     * @memberof L.gmxUtil
     * @param {coordinates} coordinates - geoJSON coordinates data format
     * @return {Boolean}
    */
    isRectangle: function(coords) {
        return (coords && coords[0] && (coords[0].length === 5 || coords[0].length === 4)
            && ((coords[0][0][0] === coords[0][1][0]) || (coords[0][0][1] === coords[0][1][1]))
            && ((coords[0][1][0] === coords[0][2][0]) || (coords[0][1][1] === coords[0][2][1]))
            && ((coords[0][2][0] === coords[0][3][0]) || (coords[0][2][1] === coords[0][3][1]))
            && ((coords[0][3][0] === coords[0][0][0]) || (coords[0][3][1] === coords[0][0][1]))
        );
    },

    /** Get bounds from geometry
     * @memberof L.gmxUtil
     * @param {geometry} geometry - Geomixer or geoJSON data format
     * @return {Object} bounds
    */
    getGeometryBounds: function(geo) {
        var pt = gmxAPIutils.geoItemBounds(geo);
        return pt.bounds;
    },

    getMarkerPolygon: function(bounds, dx, dy) {
        var x = (bounds.min.x + bounds.max.x) / 2,
            y = (bounds.min.y + bounds.max.y) / 2;
        return [
            [x - dx, y - dy],
            [x - dx, y + dy],
            [x + dx, y + dy],
            [x + dx, y - dy],
            [x - dx, y - dy]
        ];
    },

    getQuicklookPointsFromProperties: function(pArr, gmx) {
        var indexes = gmx.tileAttributeIndexes;
        var points = {
                x1: gmxAPIutils.getPropItem(gmx.quicklookX1 || ('x1' in indexes ? 'x1' : 'X1'), pArr, indexes) || 0,
                y1: gmxAPIutils.getPropItem(gmx.quicklookY1 || ('y1' in indexes ? 'y1' : 'Y1'), pArr, indexes) || 0,
                x2: gmxAPIutils.getPropItem(gmx.quicklookX2 || ('x2' in indexes ? 'x2' : 'X2'), pArr, indexes) || 0,
                y2: gmxAPIutils.getPropItem(gmx.quicklookY2 || ('y2' in indexes ? 'y2' : 'Y2'), pArr, indexes) || 0,
                x3: gmxAPIutils.getPropItem(gmx.quicklookX3 || ('x3' in indexes ? 'x3' : 'X3'), pArr, indexes) || 0,
                y3: gmxAPIutils.getPropItem(gmx.quicklookY3 || ('y3' in indexes ? 'y3' : 'Y3'), pArr, indexes) || 0,
                x4: gmxAPIutils.getPropItem(gmx.quicklookX4 || ('x4' in indexes ? 'x4' : 'X4'), pArr, indexes) || 0,
                y4: gmxAPIutils.getPropItem(gmx.quicklookY4 || ('y4' in indexes ? 'y4' : 'Y4'), pArr, indexes) || 0
            },
            bounds = gmxAPIutils.bounds([
                [points.x1, points.y1],
                [points.x2, points.y2],
                [points.x3, points.y3],
                [points.x4, points.y4]
            ]);

        if (bounds.max.x === bounds.min.x || bounds.max.y === bounds.min.y) {
            return null;
        }

        if (!gmx.quicklookPlatform) {
            var merc = L.Projection.Mercator.project(L.latLng(points.y1, points.x1));
            points.x1 = merc.x; points.y1 = merc.y;
            merc = L.Projection.Mercator.project(L.latLng(points.y2, points.x2));
            points.x2 = merc.x; points.y2 = merc.y;
            merc = L.Projection.Mercator.project(L.latLng(points.y3, points.x3));
            points.x3 = merc.x; points.y3 = merc.y;
            merc = L.Projection.Mercator.project(L.latLng(points.y4, points.x4));
            points.x4 = merc.x; points.y4 = merc.y;
        }

        return points;
    },

    /** Get hash properties from array properties
     * @memberof L.gmxUtil
     * @param {Array} properties in Array format
     * @param {Object} keys indexes
     * @return {Object} properties in Hash format
    */
    getPropertiesHash: function(arr, indexes) {
        var properties = {};
        for (var key in indexes) {
            properties[key] = arr[indexes[key]];
        }
        return properties;
    },

    getPropItem: function(key, arr, indexes) {
        return key in indexes ? arr[indexes[key]] : '';
    },

    dec2rgba: function(i, a)	{				// convert decimal to rgb
        var r = (i >> 16) & 255,
            g = (i >> 8) & 255,
            b = i & 255;
		return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
	},

    dec2hex: function(i) {					// convert decimal to hex
        return (i + 0x1000000).toString(16).substr(-6);
    },

    dec2color: function(i, a)   {   // convert decimal to canvas color
        return a < 1 ? this.dec2rgba(i, a) : '#' + this.dec2hex(i);
    },

    oneDay: 60 * 60 * 24,			// один день

    isTileKeysIntersects: function(tk1, tk2) { // пересечение по номерам двух тайлов
        if (tk1.z < tk2.z) {
            var t = tk1; tk1 = tk2; tk2 = t;
        }

        var dz = tk1.z - tk2.z;
        return tk1.x >> dz === tk2.x && tk1.y >> dz === tk2.y;
	},

    rotatePoints: function(arr, angle, iconScale, center) {			// rotate - массива точек
        var out = [];
        angle *= Math.PI / 180.0;
        var sin = Math.sin(angle);
        var cos = Math.cos(angle);
        if (!iconScale) { iconScale = 1; }
        for (var i = 0; i < arr.length; i++) {
            var x = iconScale * arr[i].x - center.x;
            var y = iconScale * arr[i].y - center.y;
            out.push({
                'x': cos * x - sin * y + center.x,
                'y': sin * x + cos * y + center.y
            });
        }
        return out;
    },
    getPatternIcon: function(item, style, indexes) { // получить bitmap стиля pattern
        if (!style.fillPattern) { return null; }

        var notFunc = true,
            pattern = style.fillPattern,
            prop = item ? item.properties : null,
            step = pattern.step > 0 ? pattern.step : 0,
            patternDefaults = {
                minWidth: 1,
                maxWidth: 1000,
                minStep: 0,
                maxStep: 1000
            };
        if (pattern.patternStepFunction && prop !== null) {
            step = pattern.patternStepFunction(prop, indexes);
            notFunc = false;
        }
        if (step > patternDefaults.maxStep) {
            step = patternDefaults.maxStep;
        }
        else if (step < patternDefaults.minStep) {
            step = patternDefaults.minStep;
        }

        var size = pattern.width > 0 ? pattern.width : 8;
        if (pattern.patternWidthFunction && prop !== null) {
            size = pattern.patternWidthFunction(prop, indexes);
            notFunc = false;
        }
        if (size > patternDefaults.maxWidth) {
            size = patternDefaults.maxWidth;
        } else if (size < patternDefaults.minWidth) {
            size = patternDefaults.minWidth;
        }

        var op = style.fillOpacity;
        if (style.opacityFunction && prop !== null) {
            op = style.opacityFunction(prop, indexes) / 100;
            notFunc = false;
        }

        var rgb = [0xff0000, 0x00ff00, 0x0000ff],
            arr = (pattern.colors != null ? pattern.colors : rgb),
            count = arr.length,
            resColors = [],
            i = 0;

        for (i = 0; i < count; i++) {
            var col = arr[i];
            if (pattern.patternColorsFunction && pattern.patternColorsFunction[i] !== null) {
                col = (prop !== null ? pattern.patternColorsFunction[i](prop, indexes) : rgb[i % 3]);
                notFunc = false;
            }
            resColors.push(col);
        }
        if (count === 0) { resColors = [0]; op = 0; count = 1; }   // pattern without colors

        var delta = size + step,
            allSize = delta * count,
            center = 0,
            //radius,
            rad = 0,
            hh = allSize,				// высота битмапа
            ww = allSize,				// ширина битмапа
            type = pattern.style || 'horizontal',
            flagRotate = false;

        if (type === 'diagonal1' || type === 'diagonal2' || type === 'cross' || type === 'cross1') {
            flagRotate = true;
        } else if (type === 'circle') {
            ww = hh = 2 * delta;
            center = Math.floor(ww / 2);	// центр круга
            //radius = Math.floor(size / 2);	// радиус
            rad = 2 * Math.PI / count;		// угол в рад.
        } else if (type === 'vertical') {
            hh = 1;
        } else if (type === 'horizontal') {
            ww = 1;
        }
        if (ww * hh > patternDefaults.maxWidth) {
            console.log({'func': 'getPatternIcon', 'Error': 'MAX_PATTERN_SIZE', 'alert': 'Bitmap from pattern is too big'});
            return null;
        }

        var canvas = document.createElement('canvas');
        canvas.width = ww; canvas.height = hh;
        var ptx = canvas.getContext('2d');
        ptx.clearRect(0, 0, canvas.width, canvas.height);
        if (type === 'diagonal2' || type === 'vertical') {
            ptx.translate(ww, 0);
            ptx.rotate(Math.PI / 2);
        }

        for (i = 0; i < count; i++) {
            ptx.beginPath();
            var fillStyle = gmxAPIutils.dec2color(resColors[i], op);
            ptx.fillStyle = fillStyle;

            if (flagRotate) {
                var x1 = i * delta; var xx1 = x1 + size;
                ptx.moveTo(x1, 0); ptx.lineTo(xx1, 0); ptx.lineTo(0, xx1); ptx.lineTo(0, x1); ptx.lineTo(x1, 0);

                x1 += allSize; xx1 = x1 + size;
                ptx.moveTo(x1, 0); ptx.lineTo(xx1, 0); ptx.lineTo(0, xx1); ptx.lineTo(0, x1); ptx.lineTo(x1, 0);
                if (type === 'cross' || type === 'cross1') {
                    x1 = i * delta; xx1 = x1 + size;
                    ptx.moveTo(ww, x1); ptx.lineTo(ww, xx1); ptx.lineTo(ww - xx1, 0); ptx.lineTo(ww - x1, 0); ptx.lineTo(ww, x1);

                    x1 += allSize; xx1 = x1 + size;
                    ptx.moveTo(ww, x1); ptx.lineTo(ww, xx1); ptx.lineTo(ww - xx1, 0); ptx.lineTo(ww - x1, 0); ptx.lineTo(ww, x1);
                }
            } else if (type === 'circle') {
                ptx.arc(center, center, size, i * rad, (i + 1) * rad);
                ptx.lineTo(center, center);
            } else {
                ptx.fillRect(0, i * delta, ww, size);
            }
            ptx.closePath();
            ptx.fill();
        }
        var canvas1 = document.createElement('canvas');
        canvas1.width = ww;
        canvas1.height = hh;
        var ptx1 = canvas1.getContext('2d');
        ptx1.drawImage(canvas, 0, 0, ww, hh);
        return {'notFunc': notFunc, 'canvas': canvas1};
    },

    getSVGIcon: function (options) {
        var svg = '<svg xmlns="' + L.Path.SVG_NS + '" xmlns:xlink="http://www.w3.org/1999/xlink"',
            type = options.type,
            fill = options.fillStyle || 'rgba(255, 255, 255, 0.5)',
            stroke = options.strokeStyle || '#0000ff',
            strokeWidth = options.lineWidth || 2,
            iconOptions = {
                className: 'gmx-svg-icon'
            };

        if (options.className) {
            iconOptions.className = options.className;
        }
        var size = options.iconSize;
        iconOptions.iconSize = [size, size];
        svg += ' height = "' + size + 'px"  width = "' + size + 'px">';

        if (type === 'circle') {
            if (options.fillRadialGradient) {
                svg += '<defs><radialGradient id="myRadialGradient4" spreadMethod="pad">';
                var stopColor = options.fillRadialGradient.colorStop || options.fillRadialGradient.addColorStop
                    || [     // [%, color, opacity]
                        [0, '#ffff00', 0.8],
                        [1, '#ff0000', 0.8]
                    ];

                for (var i = 0, len = stopColor.length; i < len; i++) {
                    var it = stopColor[i];
                    svg += '<stop offset="' + (100 * it[0]) + '%"   stop-color="' + it[1] + '" stop-opacity="' + it[2] + '"/>';
                }
                svg += '</radialGradient></defs>';
                fill = 'url(#myRadialGradient4)';
                stroke = strokeWidth = null;
            }
            size /= 2;
            svg += '<g><circle cx="' + size + '" cy="' + size + '" r="' + size + '" style="';
            if (fill) { svg += ' fill:' + fill + ';'; }
            if (stroke) { svg += ' stroke:"' + stroke + ';'; }
            if (strokeWidth) { svg += ' stroke-width:"' + strokeWidth + ';'; }
            svg += ';" />';
        } else if (type === 'square') {
            svg += '<g><rect width="' + size + '" height="' + size + '" style="';
            if (fill) { svg += ' fill:' + fill + ';'; }
            if (stroke) { svg += ' stroke:' + stroke + ';'; }
            if (strokeWidth) { svg += ' stroke-width:' + 2 * strokeWidth + ';'; }
            svg += '" />';
        }
        if (options.text) {
            var text = options.text;
            svg += '<text x="50%" y="50%" dy="0.4em"';
            for (var key in text) {
                if (key !== 'count') { svg += ' ' + key + '="' + text[key] + '"'; }
            }
            svg += '>' + text.count + '</text>';
        }
        svg += '</g></svg>';
        iconOptions.html = svg;

        return new L.DivIcon(iconOptions);
    },

    toPixels: function(p, tpx, tpy, mInPixel) { // get pixel point
        var px1 = p[0] * mInPixel; 	px1 = (0.5 + px1) << 0;
        var py1 = p[1] * mInPixel;	py1 = (0.5 + py1) << 0;
        return [px1 - tpx, tpy - py1].concat(p.slice(2));
    },

    getPixelPoint: function(attr, coords) {
        var gmx = attr.gmx,
            mInPixel = gmx.mInPixel,
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys || {},
            style = attr.style || {},
            iconScale = currentStyle.iconScale || 1,
            iconCenter = currentStyle.iconCenter || false,
            sx = currentStyle.sx || style.sx || 4,
            sy = currentStyle.sy || style.sy || 4,
            weight = currentStyle.weight || style.weight || 0,
            iconAnchor = currentStyle.iconAnchor || style.iconAnchor || null,
            px = attr.tpx,
            py = attr.tpy;

        if (!iconCenter && iconAnchor) {
            px1 -= iconAnchor[0];
            py1 -= iconAnchor[1];
        }
        sx *= iconScale;
        sy *= iconScale;
        sx += weight;
        sy += weight;

        var py1 = py - coords[1] * mInPixel,
			px1 = coords[0] * mInPixel - px;

		if (px1 - sx > 256) {
			px1 = (coords[0] - 2 * gmxAPIutils.worldWidthMerc) * mInPixel - px;
		} else if (px1 < -sx) {
			px1 = (coords[0] + 2 * gmxAPIutils.worldWidthMerc) * mInPixel - px;
		}

        return py1 - sy > 256 || px1 - sx > 256 || px1 + sx < 0 || py1 + sy < 0
			? null :
            {
                sx: sx,
                sy: sy,
                px1: (0.5 + px1) << 0,
                py1: (0.5 + py1) << 0
            }
        ;
    },
    getImageData: function(img) {
        if (L.gmxUtil.isIE9 || L.gmxUtil.isIE10) { return null; }
        var canvas = document.createElement('canvas'),
            ww = img.width,
            hh = img.height;

        canvas.width = ww; canvas.height = hh;
        var ptx = canvas.getContext('2d');
        ptx.drawImage(img, 0, 0);
        return ptx.getImageData(0, 0, ww, hh).data;
    },
    DEFAULT_REPLACEMENT_COLOR: 0xff00ff,
    isIE: function(v) {
        return v === gmxAPIutils.getIEversion();
    },
    gtIE: function(v) {
        return v < gmxAPIutils.getIEversion();
    },

    getIEversion: function() {
        var ua = navigator.userAgent || '',
            msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
            // IE 11 => return version number
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
            // Edge (IE 12+) => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        // other browser
        return -1;
    },

    replaceColor: function(img, color, fromData) {
        if (L.gmxUtil.isIE9 || L.gmxUtil.isIE10) { return img; }
        var canvas = document.createElement('canvas'),
            ww = img.width,
            hh = img.height;

        canvas.width = ww; canvas.height = hh;
        var flag = false,
            imageData,
            ptx = canvas.getContext('2d');

        if (typeof color === 'string') {
            color = parseInt('0x' + color.replace(/#/, ''));
        }
        if (color !== this.DEFAULT_REPLACEMENT_COLOR) {
            var r = (color >> 16) & 255,
                g = (color >> 8) & 255,
                b = color & 255;

            if (fromData) {
                imageData = ptx.createImageData(ww, hh);
            } else {
                ptx.drawImage(img, 0, 0);
                imageData = ptx.getImageData(0, 0, ww, hh);
                fromData = imageData.data;
            }
            var toData = imageData.data;
            for (var i = 0, len = fromData.length; i < len; i += 4) {
                if ((fromData[i] === 0xff || fromData[i] === 238)
                    && fromData[i + 1] === 0
                    && fromData[i + 2] === 0xff
                    ) {
                    toData[i] = r;
                    toData[i + 1] = g;
                    toData[i + 2] = b;
                    toData[i + 3] = fromData[i + 3];
                    flag = true;
                }
            }
        }
        if (flag) {
            ptx.putImageData(imageData, 0, 0);
        } else {
            ptx.drawImage(img, 0, 0);
        }
        return canvas;
    },

    drawIconPath: function(path, attr) { // draw iconPath in canvas
        if (!L.Util.isArray(path) || path.length < 3 || !attr.ctx) { return; }
        var trFlag = false,
            ctx = attr.ctx,
            rad = attr.radian;

        if (attr.px || attr.py) { ctx.translate(attr.px || 0, attr.py || 0); trFlag = true; }
        if (!rad && attr.rotateRes) { rad = Math.PI + gmxAPIutils.degRad(attr.rotateRes); }
        if (rad) { ctx.rotate(rad); trFlag = true; }
        ctx.moveTo(path[0], path[1]);
        for (var i = 2, len = path.length; i < len; i += 2) {
            ctx.lineTo(path[i], path[i + 1]);
        }
        if (trFlag) { ctx.setTransform(1, 0, 0, 1, 0, 0); }
    },

    pointToCanvas: function(attr) { // Точку в canvas
        var gmx = attr.gmx,
            pointAttr = attr.pointAttr,
            style = attr.style || {},
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys,
            iconScale = currentStyle.iconScale || 1,
            image = currentStyle.image,
            sx = pointAttr.sx,
            sy = pointAttr.sy,
            px1 = pointAttr.px1,
            py1 = pointAttr.py1,
            px1sx = px1,
            py1sy = py1,
            ctx = attr.ctx;

        if (currentStyle.type === 'image') {
            sx = style.sx;
            sy = style.sy;
            image = style.image;
        }
        if (currentStyle.iconCenter) {
            px1sx -= sx / 2;
            py1sy -= sy / 2;
        } else if (style.type === 'circle') {
            px1 += sx / 2;
            py1 += sy / 2;
        }
        if (currentStyle.iconPath) {
            attr.px = px1;
            attr.py = py1;
            attr.rotateRes = currentStyle.rotate || 0;
        }
        if (image) {
            if ('iconColor' in currentStyle) {
                image = this.replaceColor(image, currentStyle.iconColor, attr.imageData);
            }
            style.rotateRes = currentStyle.rotate || 0;
            if ('opacity' in style) { ctx.globalAlpha = currentStyle.opacity || style.opacity; }
            if (gmx.transformFlag) {
                ctx.setTransform(gmx.mInPixel, 0, 0, gmx.mInPixel, -attr.tpx, attr.tpy);
                ctx.drawImage(image, px1, -py1, sx, sy);
                ctx.setTransform(gmx.mInPixel, 0, 0, -gmx.mInPixel, -attr.tpx, attr.tpy);
            } else {
				if (iconScale !== 1) {
					sx *= iconScale;
					sy *= iconScale;
					px1 = pointAttr.px1;
					py1 = pointAttr.py1;
					px1sx = px1;
					py1sy = py1;
					if (currentStyle.iconCenter) {
						px1sx -= sx / 2;
						py1sy -= sy / 2;
					}
				}
				if (style.rotateRes) {
					ctx.translate(px1, py1);
					ctx.rotate(gmxAPIutils.degRad(style.rotateRes));
					ctx.translate(-px1, -py1);
					ctx.drawImage(image, px1sx, py1sy, sx, sy);
					ctx.setTransform(1, 0, 0, 1, 0, 0);
				} else {
					ctx.drawImage(image, px1sx, py1sy, sx, sy);
				}
            }
            if ('opacity' in style) { ctx.globalAlpha = 1; }
        } else if (style.fillColor || currentStyle.fillRadialGradient) {
            ctx.beginPath();
            if (currentStyle.iconPath) {
                gmxAPIutils.drawIconPath(currentStyle.iconPath, attr);
            } else if (style.type === 'circle' || currentStyle.fillRadialGradient) {
                var circle = style.iconSize / 2;
                if (currentStyle.fillRadialGradient) {
                    var rgr = currentStyle.fillRadialGradient;
                    circle = rgr.r2 * iconScale;
                    var radgrad = ctx.createRadialGradient(px1 + rgr.x1, py1 + rgr.y1, rgr.r1 * iconScale, px1 + rgr.x2, py1 + rgr.y2, circle);
                    for (var i = 0, len = rgr.addColorStop.length; i < len; i++) {
                        var arr = rgr.addColorStop[i];
                        radgrad.addColorStop(arr[0], arr[1]);
                    }
                    ctx.fillStyle = radgrad;
                }
                ctx.arc(px1, py1, circle, 0, 2 * Math.PI);
            } else {
                ctx.fillRect(px1sx, py1sy, sx, sy);
            }
            ctx.fill();
        }
        if (currentStyle.strokeStyle) {
            ctx.beginPath();
            if (currentStyle.iconPath) {
                gmxAPIutils.drawIconPath(currentStyle.iconPath, attr);
            } else if (style.type === 'circle') {
                ctx.arc(px1, py1, style.iconSize / 2, 0, 2 * Math.PI);
            } else {
                ctx.strokeRect(px1sx, py1sy, sx, sy);
            }
            ctx.stroke();
        }
    },
    lineToCanvasAsIcon: function(pixels, attr) {  // add line(as icon) to canvas
        var len = pixels.length,
            ctx = attr.ctx,
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys,
            iconPath = currentStyle.iconPath;

        if (len > 0) {
            if ('getLineDash' in ctx && ctx.getLineDash().length > 0) {
                ctx.setLineDash([]);
            }
            ctx.beginPath();
            for (var i = 0, p; i < len; i++) {
                p = pixels[i];
                gmxAPIutils.drawIconPath(iconPath, {ctx: ctx, px: p.x, py: p.y, radian: p.radian});
            }
            if (currentStyle.strokeStyle) {
                ctx.stroke();
            }
            if (currentStyle.fillStyle) {
                ctx.fill();
            }
        }
    },
    lineToCanvas: function(attr) {  // Lines in canvas
        var gmx = attr.gmx,
            coords = attr.coords,
            ctx = attr.ctx,
            item = attr.item,
            currentStyle = item.currentStyle || item.parsedStyleKeys,
            pixels = currentStyle.iconPath ? [] : null;

        var lastX = null, lastY = null;
        ctx.beginPath();
        for (var i = 0, len = coords.length; i < len; i++) {
            var p = gmxAPIutils.toPixels(coords[i], attr.tpx, attr.tpy, gmx.mInPixel),
                x = p[0],
                y = p[1];
            if (lastX !== x || lastY !== y) {
                if (pixels) { pixels.push({x: x, y: y, radian: p[2]}); }
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                lastX = x; lastY = y;
            }
        }
        ctx.stroke();
        return pixels;
    },

    getCoordsPixels: function(attr) {
        var gmx = attr.gmx,
            coords = attr.coords,
            hiddenLines = attr.hiddenLines || [],
            pixels = [],
            hidden = [],
            hiddenFlag = false,
            hash = {
                gmx: gmx,
                tpx: attr.tpx,
                tpy: attr.tpy,
                coords: null,
                hiddenLines: null
            };
        for (var j = 0, len = coords.length; j < len; j++) {
            var coords1 = coords[j],
                hiddenLines1 = hiddenLines[j] || [],
                pixels1 = [], hidden1 = [];
            for (var j1 = 0, len1 = coords1.length; j1 < len1; j1++) {
                hash.coords = coords1[j1];
                hash.hiddenLines = hiddenLines1[j1] || [];
                var res = gmxAPIutils.getRingPixels(hash);
                pixels1.push(res.coords);
                hidden1.push(res.hidden);
                if (res.hidden) {
                    hiddenFlag = true;
                }
            }
            pixels.push(pixels1);
            hidden.push(hidden1);
        }
        return {coords: pixels, hidden: hiddenFlag ? hidden : null, z: gmx.currentZoom};
    },

    getRingPixels: function(attr) {
        if (attr.coords.length === 0) { return null; }
        var gmx = attr.gmx,
            mInPixel = gmx.mInPixel,
            coords = attr.coords,
            hiddenLines = attr.hiddenLines || null,
            px = attr.tpx,
            py = attr.tpy,
            cnt = 0, cntHide = 0,
            lastX = null, lastY = null,
            vectorSize = typeof coords[0] === 'number' ? 2 : 1,
            pixels = [], hidden = [];
        for (var i = 0, len = coords.length; i < len; i += vectorSize) {
            var lineIsOnEdge = false;
            if (hiddenLines && i === hiddenLines[cntHide]) {
                lineIsOnEdge = true;
                cntHide++;
            }
            var c = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]],
                x1 = c[0] * mInPixel, y1 = c[1] * mInPixel,
                x2 = Math.round(x1 - px), y2 = Math.round(py - y1);

            if (lastX !== x2 || lastY !== y2) {
                lastX = x2; lastY = y2;
                if (lineIsOnEdge) {
                    hidden.push(cnt);
                }
                pixels[cnt++] = x1;
                pixels[cnt++] = y1;
            }
        }
        return {coords: pixels, hidden: hidden.length ? hidden : null};
    },

    polygonToCanvas: function(attr) {       // Polygons in canvas
        if (attr.coords.length === 0) { return null; }
        var hiddenLines = attr.hiddenLines || null,
            coords = attr.coords,
            ctx = attr.ctx,
            px = attr.tpx,
            py = attr.tpy,
            cnt = 0, cntHide = 0,
            vectorSize = typeof coords[0] === 'number' ? 2 : 1,
            lastX = null, lastY = null;

        ctx.beginPath();
        for (var i = 0, len = coords.length; i < len; i += vectorSize) {
            var c = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]],
                x = Math.round(c[0] - px),
                y = Math.round(py - c[1]),
                lineIsOnEdge = false;

            if (hiddenLines && i === hiddenLines[cntHide]) {
                lineIsOnEdge = true;
                cntHide++;
            }

            if (lastX !== x || lastY !== y) {
                ctx[(lineIsOnEdge ? 'moveTo' : 'lineTo')](x, y);
                lastX = x; lastY = y;
                cnt++;
            }
        }
        if (cnt === 1) { ctx.lineTo(lastX + 1, lastY); }
        ctx.stroke();
    },

    polygonToCanvasFill: function(attr) {     // Polygon fill
        if (attr.coords.length < 3) { return; }
        var coords = attr.coords,
            px = attr.tpx,
            py = attr.tpy,
            vectorSize = 1,
            ctx = attr.ctx;

        ctx.lineWidth = 0;
        if (typeof coords[0] === 'number') {
            vectorSize = 2;
            ctx.moveTo(Math.round(coords[0] - px), Math.round(py - coords[1]));
        } else {
            ctx.moveTo(Math.round(coords[0][0] - px), Math.round(py - coords[0][1]));
        }
        for (var i = vectorSize, len = coords.length; i < len; i += vectorSize) {
            var c = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]];
            ctx.lineTo(Math.round(c[0] - px), Math.round(py - c[1]));
        }
    },

    isPatternNode: function(it) {
        return it instanceof HTMLCanvasElement || it instanceof HTMLImageElement;
    },
    labelCanvasContext: null,    // 2dContext canvas for Label size
    getLabelWidth: function(txt, style) {   // Get label size Label
        if (style) {
            if (!gmxAPIutils.labelCanvasContext) {
                var canvas = document.createElement('canvas');
                canvas.width = canvas.height = 512;
                gmxAPIutils.labelCanvasContext = canvas.getContext('2d');
            }
            var ptx = gmxAPIutils.labelCanvasContext;
            ptx.clearRect(0, 0, 512, 512);

            if (ptx.font !== style.font) { ptx.font = style.font; }
            //if (ptx.strokeStyle !== style.strokeStyle) { ptx.strokeStyle = style.strokeStyle; }
            if (ptx.fillStyle !== style.fillStyle) { ptx.fillStyle = style.fillStyle; }
            ptx.fillText(txt, 0, 0);
            return ptx.measureText(txt).width;
        }
        return 0;
    },
    setLabel: function(ctx, txt, coord, style) {
        var x = coord[0],
            y = coord[1];

        if (ctx.shadowColor !== style.strokeStyle) { ctx.shadowColor = style.strokeStyle; }
        if (ctx.shadowBlur !== style.shadowBlur) { ctx.shadowBlur = style.shadowBlur; }
        if (ctx.font !== style.font) { ctx.font = style.font; }
        if (ctx.strokeStyle !== style.strokeStyle) { ctx.strokeStyle = style.strokeStyle; }
        if (ctx.fillStyle !== style.fillStyle) { ctx.fillStyle = style.fillStyle; }
        ctx.strokeText(txt, x, y);
        ctx.fillText(txt, x, y);
    },
    worldWidthMerc: 20037508,
    rMajor: 6378137.000,
    degRad: function(ang) {
        return ang * (Math.PI / 180.0);
    },

    distVincenty: function(lon1, lat1, lon2, lat2) {
        var p1 = {
            lon: gmxAPIutils.degRad(lon1),
            lat: gmxAPIutils.degRad(lat1)
        },
            p2 = {
            lon: gmxAPIutils.degRad(lon2),
            lat: gmxAPIutils.degRad(lat2)
        },
            a = gmxAPIutils.rMajor,
            b = 6356752.3142,
            f = 1 / 298.257223563;  // WGS-84 ellipsiod

        var L1 = p2.lon - p1.lon,
            U1 = Math.atan((1 - f) * Math.tan(p1.lat)),
            U2 = Math.atan((1 - f) * Math.tan(p2.lat)),
            sinU1 = Math.sin(U1), cosU1 = Math.cos(U1),
            sinU2 = Math.sin(U2), cosU2 = Math.cos(U2),
            lambda = L1,
            lambdaP = 2 * Math.PI,
            iterLimit = 20;
        while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
                var sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda),
                    sinSigma = Math.sqrt((cosU2 * sinLambda) * (cosU2 * sinLambda) +
                    (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda));
                if (sinSigma === 0) { return 0; }
                var cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda,
                    sigma = Math.atan2(sinSigma, cosSigma),
                    sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma,
                    cosSqAlpha = 1 - sinAlpha * sinAlpha,
                    cos2SigmaM = cosSigma - 2 * sinU1 * sinU2 / cosSqAlpha;
                if (isNaN(cos2SigmaM)) { cos2SigmaM = 0; }
                var C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
                lambdaP = lambda;
                lambda = L1 + (1 - C) * f * sinAlpha *
                    (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
        }
        if (iterLimit === 0) { return NaN; }

        var uSq = cosSqAlpha * ((a * a) / (b * b) - 1),
        //var uSq = cosSqAlpha * (a * a - b * b) / (b*b),
            A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq))),
            B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq))),
            deltaSigma = B * sinSigma * (cos2SigmaM + B / 4 * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
                B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM))),
            s = b * A * (sigma - deltaSigma);

        //s = s.toFixed(3);
        return s;
    },

    _vfi: function(fi, a, b) {
        return [
            -Math.cos(fi) * Math.sin(a) + Math.sin(fi) * Math.sin(b) * Math.cos(a),
            Math.cos(fi) * Math.cos(a) + Math.sin(fi) * Math.sin(b) * Math.sin(a),
            -Math.sin(fi) * Math.cos(b)
        ];
    },

    getCircleLatLngs: function(latlng, r) {   // Get latlngs for circle
        var x = 0, y = 0;
        if (latlng instanceof L.LatLng) {
            x = latlng.lng;
            y = latlng.lat;
        } else if (L.Util.isArray(latlng)) {
            x = latlng[1];
            y = latlng[0];
        } else {
            return null;
        }

        var rad = Math.PI / 180,
            a = x * rad,  //долгота центра окружности в радианах
            b = y * rad,  //широта центра окружности в радианах
            R = gmxAPIutils.rMajor,
            d = R * Math.sin(r / R),
            Rd = R * Math.cos(r / R),
            VR = [
                Rd * Math.cos(b) * Math.cos(a),
                Rd * Math.cos(b) * Math.sin(a),
                Rd * Math.sin(b)
            ],
            latlngs = [];

        for (var fi = 0, limit = 2 * Math.PI + 0.000001; fi < limit; fi += rad) {
            var v = gmxAPIutils._vfi(fi, a, b),
                circle = [];
            for (var i = 0; i < 3; i++) { circle[i] = VR[i] + d * v[i]; }

            var t2 = Math.acos(circle[0] / Math.sqrt(circle[0] * circle[0] + circle[1] * circle[1])) / rad;
            if (circle[1] < 0) { t2 = -t2; }

            if (t2 < x - 180) {
                t2 += 360;
            } else if (t2 > x + 180) {
                t2 -= 360;
            }
            latlngs.push([Math.asin(circle[2] / R) / rad, t2]);
        }
        return latlngs;
    },

    /** Get point coordinates from string
     * @memberof L.gmxUtil
     * @param {String} text - point coordinates in following formats:
         <br/><i>55.74312, 37.61558</i>
         <br/><i>55°44'35" N, 37°36'56" E</i>
         <br/><i>4187347, 7472103</i>
         <br/><i>4219783, 7407468 (EPSG:3395)</i>
         <br/><i>4219783, 7442673 (EPSG:3857)</i>
     * @return {Array} [lat, lng] or null
    */
    parseCoordinates: function(text) {
        var crs = null,
            regex = /\(EPSG:(\d+)\)/g,
            t = regex.exec(text);

        if (t) {
            crs = t[1];
            text = text.replace(regex, '');
        }

        if (text.match(/[йцукенгшщзхъфывапролджэячсмитьбюЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮqrtyuiopadfghjklzxcvbmQRTYUIOPADFGHJKLZXCVBM_:]/)) {
            return null;
        }

        //there should be a separator in the string (exclude strings like "11E11")
        if (text.indexOf(' ') === -1 && text.indexOf(',') === -1) {
            return null;
        }

        if (text.indexOf(' ') !== -1) {
            text = text.replace(/,/g, '.');
        }
        var results = [];
        regex = /(-?\d+(\.\d+)?)([^\d\-]*)/g;
        t = regex.exec(text);
        while (t) {
            results.push(t[1]);
            t = regex.exec(text);
        }
        if (results.length < 2) {
            return null;
        }
        var ii = Math.floor(results.length / 2),
            y = 0,
            mul = 1,
            i;
        for (i = 0; i < ii; i++) {
            y += parseFloat(results[i]) * mul;
            mul /= 60;
        }
        var x = 0;
        mul = 1;
        for (i = ii; i < results.length; i++) {
            x += parseFloat(results[i]) * mul;
            mul /= 60;
        }

        if (Math.max(text.indexOf('N'), text.indexOf('S')) > Math.max(text.indexOf('E'), text.indexOf('W'))) {
            t = x;
            x = y;
            y = t;
        }

        var pos;
        if (crs === '3857') {
            pos = L.Projection.SphericalMercator.unproject(new L.Point(y, x)._divideBy(6378137));
            x = pos.lng;
            y = pos.lat;
        }
        if (Math.abs(x) > 180 || Math.abs(y) > 180) {
            pos = L.Projection.Mercator.unproject(new L.Point(y, x));
            x = pos.lng;
            y = pos.lat;
        }

        if (text.indexOf('W') !== -1) {
            x = -x;
        }

        if (text.indexOf('S') !== -1) {
            y = -y;
        }
        return [y, x];
    },

	pad2: function(t) {
		return (t < 10) ? ('0' + t) : ('' + t);
	},

	trunc: function(x) {
		return ('' + (Math.round(10000000 * x) / 10000000 + 0.00000001)).substring(0, 9);
	},

	formatDegrees: function(angle) {
		angle = Math.round(10000000 * angle) / 10000000 + 0.00000001;
		var a1 = Math.floor(angle);
		var a2 = Math.floor(60 * (angle - a1));
		var a3 = gmxAPIutils.toPrecision(3600 * (angle - a1 - a2 / 60), 2);
		return gmxAPIutils.pad2(a1) + '°' + gmxAPIutils.pad2(a2) + '\'' + gmxAPIutils.pad2(a3) + '"';
	},

    /** Get point coordinates in string format with degrees
     * @memberof L.gmxUtil
     * @param {Number} lng - point longitude
     * @param {Number} lat - point latitude
     * @return {String} point coordinates in string format with degrees
    */
	latLonFormatCoordinates: function(x, y) {
        x %= 360;
        if (x > 180) { x -= 360; }
        else if (x < -180) { x += 360; }
		return  gmxAPIutils.formatDegrees(Math.abs(y)) + (y > 0 ? ' N, ' : ' S, ') +
			gmxAPIutils.formatDegrees(Math.abs(x)) + (x > 0 ? ' E' : ' W');
	},

	formatCoordinates: function(x, y) {
		return  gmxAPIutils.latLonFormatCoordinates(x, y);
	},

    /** Get point coordinates in string format
     * @memberof L.gmxUtil
     * @param {Number} lng - point longitude
     * @param {Number} lat - point latitude
     * @return {String} point coordinates in string format
    */
	latLonFormatCoordinates2: function(x, y) {
		return  gmxAPIutils.trunc(Math.abs(y)) + (y > 0 ? ' N, ' : ' S, ') +
			gmxAPIutils.trunc(Math.abs(x)) + (x > 0 ? ' E' : ' W');
	},
	formatCoordinates2: function(x, y) {
		return  gmxAPIutils.latLonFormatCoordinates2(x, y);
	},

    getPixelScale: function(zoom) {
        return 256 / gmxAPIutils.tileSizes[zoom];
    },

    forEachPoint: function(coords, callback) {
        if (!coords || coords.length === 0) { return []; }
        var i, len, ret = [];
        if (!coords[0].length) {
            if (coords.length === 2) {
                return callback(coords);
            } else {
                for (i = 0, len = coords.length / 2; i < len; i++) {
                    ret.push(callback([coords[i * 2], coords[i * 2 + 1]]));
                }
            }
        } else {
            for (i = 0, len = coords.length; i < len; i++) {
                if (typeof coords[i] !== 'string') {
                    ret.push(gmxAPIutils.forEachPoint(coords[i], callback));
                }
            }
        }
        return ret;
    },
/*
	getQuicklookPoints: function(coord) { // получить 4 точки привязки снимка
		var d1 = Number.MAX_VALUE;
		var d2 = Number.MAX_VALUE;
		var d3 = Number.MAX_VALUE;
		var d4 = Number.MAX_VALUE;
		var x1, y1, x2, y2, x3, y3, x4, y4;
		this.forEachPoint(coord, function(p) {
			var x = p[0];
			var y = p[1];
			if ((x - y) < d1) {
				d1 = x - y;
				x1 = p[0];
				y1 = p[1];
			}
			if ((-x - y) < d2) {
				d2 = -x - y;
				x2 = p[0];
				y2 = p[1];
			}
			if ((-x + y) < d3) {
				d3 = -x + y;
				x3 = p[0];
				y3 = p[1];
			}
			if ((x + y) < d4) {
				d4 = x + y;
				x4 = p[0];
				y4 = p[1];
			}
		});
		return {x1: x1, y1: y1, x2: x2, y2: y2, x3: x3, y3: y3, x4: x4, y4: y4};
	},
*/
    getItemCenter: function(item, geoItems) {
        var bounds = item.bounds,
            min = bounds.min, max = bounds.max,
            type = item.type,
            isPoint = type === 'POINT' || type === 'MULTIPOINT',
            center = isPoint ? [min.x, min.y] : [(min.x + max.x) / 2, (min.y + max.y) / 2];

        if (type === 'MULTIPOLYGON') {
			return center;
		} else if (type === 'POLYGON') {
            for (var i = 0, len = geoItems.length; i < len; i++) {
                var it = geoItems[i],
                    geom = it.geo,
                    coords = geom.coordinates,
                    dataOption = it.dataOption,
                    bbox = dataOption.bounds;

                if (bbox.contains(center)) {
                    if (geom.type === 'POLYGON') { coords = [coords]; }
                    for (var j = 0, len1 = coords.length; j < len1; j++) {
                        for (var j1 = 0, coords1 = coords[j], len2 = coords1.length; j1 < len2; j1++) {
                            var pt = gmxAPIutils.getHSegmentsInPolygon(center[1], coords1[j1]);
                            if (pt) {
                                return pt.max.center;
                            }
                        }
                    }
                }
            }
        } else if (type === 'POINT' || type === 'MULTIPOINT') {
            return center;
        } else if (type === 'LINESTRING' || type === 'MULTILINESTRING') {
            return center;
        }
        return null;
    },

    getHSegmentsInPolygon: function(y, poly) {
        var s = [], i, len, out,
            vectorSize = 1,
            p1 = poly[0];

        if (typeof poly[0] === 'number') {
            vectorSize = 2;
            p1 = [poly[0], poly[1]];
        }
        var isGt1 = y > p1[1];
        for (i = vectorSize, len = poly.length; i < len; i += vectorSize) {
            var p2 = vectorSize === 1 ? poly[i] : [poly[i], poly[i + 1]],
                isGt2 = y > p2[1];
            if (isGt1 !== isGt2) {
                s.push(p1[0] - (p1[0] - p2[0]) * (p1[1] - y) / (p1[1] - p2[1]));
            }
            p1 = p2;
            isGt1 = isGt2;
        }
        len = s.length;
        if (len) {
            s = s.sort();
            var max = 0,
                index = -1;
            for (i = 1; i < len; i += 2) {
                var j = i - 1,
                    d = Math.abs(s[i] - s[j]);
                if (d > max) {
                    max = d;
                    index = j;
                }
            }
            out = {
                y: y,
                segArr: s,
                max: {
                    width: max,
                    center: [(s[index] + s[index + 1]) / 2, y]
                }
            };
        }
        return out;
    },

    isPointInPolygonArr: function(chkPoint, coords) { // Проверка точки на принадлежность полигону в виде массива
        var isIn = false,
            x = chkPoint[0],
            y = chkPoint[1],
            vectorSize = 1,
            p1 = coords[0];

        if (typeof coords[0] === 'number') {
            vectorSize = 2;
            p1 = [coords[0], coords[1]];
        }

        for (var i = vectorSize, len = coords.length; i < len; i += vectorSize) {
            var p2 = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]],
                xmin = Math.min(p1[0], p2[0]),
                xmax = Math.max(p1[0], p2[0]),
                ymax = Math.max(p1[1], p2[1]);
            if (x > xmin && x <= xmax && y <= ymax && p1[0] !== p2[0]) {
                var xinters = (x - p1[0]) * (p2[1] - p1[1]) / (p2[0] - p1[0]) + p1[1];
                if (p1[1] === p2[1] || y <= xinters) { isIn = !isIn; }
            }
            p1 = p2;
        }
        return isIn;
    },

    /** Is point in polygon with holes
     * @memberof L.gmxUtil
     * @param {chkPoint} chkPoint - point in [x, y] format
     * @param {coords} coords - polygon from geoJSON coordinates data format
     * @return {Boolean} true if polygon contain chkPoint
    */
    isPointInPolygonWithHoles: function(chkPoint, coords) {
        if (!gmxAPIutils.isPointInPolygonArr(chkPoint, coords[0])) { return false; }
        for (var j = 1, len = coords.length; j < len; j++) {
            if (gmxAPIutils.isPointInPolygonArr(chkPoint, coords[j])) { return false; }
        }
        return true;
    },

    /** Is polygon clockwise
     * @memberof L.gmxUtil
     * @param {ring} ring - ring from geoJSON coordinates data format
     * @return {Boolean} true if ring is clockwise
    */
    isClockwise: function(ring) {
        var area = 0;
        for (var i = 0, j, len = ring.length; i < len; i++) {
            j = (i + 1) % len;
            area += ring[i][0] * ring[j][1];
            area -= ring[j][0] * ring[i][1];
        }
        return (area < 0);
    },

    isPointInPolyLine: function(chkPoint, lineHeight, coords, hiddenLines) {
        // Проверка точки(с учетом размеров) на принадлежность линии
        var dx = chkPoint[0], dy = chkPoint[1],
            nullPoint = {x: dx, y: dy},
            minx = dx - lineHeight, maxx = dx + lineHeight,
            miny = dy - lineHeight, maxy = dy + lineHeight,
            cntHide = 0;

        lineHeight *= lineHeight;
        for (var i = 1, len = coords.length; i < len; i++) {
            if (hiddenLines && i === hiddenLines[cntHide]) {
                cntHide++;
            } else {
                var p1 = coords[i - 1], p2 = coords[i],
                    x1 = p1[0], y1 = p1[1],
                    x2 = p2[0], y2 = p2[1];

                if (!(Math.max(x1, x2) < minx
                    || Math.min(x1, x2) > maxx
                    || Math.max(y1, y2) < miny
                    || Math.min(y1, y2) > maxy)) {
                    var sqDist = L.LineUtil._sqClosestPointOnSegment(nullPoint, {x: x1, y: y1}, {x: x2, y: y2}, true);
                    if (sqDist < lineHeight) {
                        return true;
                    }
                }
            }
        }
        return false;
    },

    isPointInLines: function (attr) {
        var arr = attr.coords,
            point = attr.point,
            delta = attr.delta,
            boundsArr = attr.boundsArr,
            hidden = attr.hidden;
        for (var j = 0, len = arr.length, flag = false; j < len; j++) {
            flag = boundsArr[j] ? boundsArr[j].contains(point) : true;
            if (flag
                && gmxAPIutils.isPointInPolyLine(point, delta, arr[j], hidden ? hidden[j] : null)
            ) {
               return true;
            }
        }
        return false;
    },

    /** Get length
     * @memberof L.gmxUtil
     * @param {Array} latlngs array
     * @param {Boolean} isMerc - true if coordinates in Mercator
     * @return {Number} length
    */
    getLength: function(latlngs, isMerc) {
        var length = 0;
        if (latlngs && latlngs.length) {
            var lng = false,
                lat = false;

            isMerc = isMerc === undefined || isMerc;
            latlngs.forEach(function(latlng) {
                if (L.Util.isArray(latlng)) {
                    if (L.Util.isArray(latlng[0])) {
                        length += gmxAPIutils.getLength(latlng, isMerc);
                        return length;
                    } else if (isMerc) {   // From Mercator array
                        latlng = L.Projection.Mercator.unproject({x: latlng[0], y: latlng[1]});
                    }
                }
                if (lng !== false && lat !== false) {
                    length += parseFloat(gmxAPIutils.distVincenty(lng, lat, latlng.lng, latlng.lat));
                }
                lng = latlng.lng;
                lat = latlng.lat;
            });
        }
        return length;
    },

    /** Get prettify length
     * @memberof L.gmxUtil
     * @param {Number} area
     * @param {String} type: ('km', 'm', 'nm')
     * @return {String} prettify length
    */
    prettifyDistance: function(length, type) {
        var km = ' ' + L.gmxLocale.getText('units.km');
        if (type === 'nm') {
            return (Math.round(0.539956803 * length) / 1000) + ' ' + L.gmxLocale.getText('units.nm');
        } else if (type === 'km') {
            return (Math.round(length) / 1000) + km;
        } else if (length < 2000 || type === 'm') {
            return Math.round(length) + ' ' + L.gmxLocale.getText('units.m');
        } else if (length < 200000) {
            return (Math.round(length / 10) / 100) + km;
        }
        return Math.round(length / 1000) + km;
    },

    /** Get geoJSON length
     * @memberof L.gmxUtil
     * @param {Object} geoJSON - object in <a href="http://geojson.org/geojson-spec.html">GeoJSON format</a>
     * @return {Number} length
    */
    geoJSONGetLength: function(geoJSON) {
        var out = 0,
            i, j, len, len1, coords;

        if (geoJSON.type === 'GeometryCollection') {
            out += geoJSON.geometries.forEach(gmxAPIutils.geoJSONGetLength);
        } else if (geoJSON.type === 'Feature') {
            out += gmxAPIutils.geoJSONGetLength(geoJSON.geometry);
        } else if (geoJSON.type === 'FeatureCollection') {
            out += geoJSON.features.forEach(gmxAPIutils.geoJSONGetLength);
        } if (geoJSON.type === 'LineString' || geoJSON.type === 'MultiLineString') {
            coords = geoJSON.coordinates;
            if (geoJSON.type === 'LineString') { coords = [coords]; }
            for (i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.getRingLength(coords[i]);
            }
        } if (geoJSON.type === 'Polygon' || geoJSON.type === 'MultiPolygon') {
            coords = geoJSON.coordinates;
            if (geoJSON.type === 'Polygon') { coords = [coords]; }
            for (i = 0, len = coords.length; i < len; i++) {
                for (j = 0, len1 = coords[i].length; j < len1; j++) {
                    out += gmxAPIutils.getRingLength(coords[i][j]);
                }
            }
        }
        return out;
    },

    getRingLength: function(coords) {
        var length = 0;
        if (coords && coords.length) {
            var lng = false, lat = false;
            coords.forEach(function(lnglat) {
                if (L.Util.isArray(lnglat)) {
                    if (lnglat.length > 2) {
                        length += gmxAPIutils.getRingLength(lnglat);
                        return length;
                    }
                }
                if (lng !== false && lat !== false) {
                    length += parseFloat(gmxAPIutils.distVincenty(lng, lat, lnglat[0], lnglat[1]));
                }
                lng = lnglat[0];
                lat = lnglat[1];
            });
        }
        return length;
    },

    /** Get geoJSON area
     * @memberof L.gmxUtil
     * @param {Object} geojson - object in <a href="http://geojson.org/geojson-spec.html">GeoJSON format</a>
     * @return {Number} area in square meters
    */
    geoJSONGetArea: function(geoJSON) {
        var out = 0;

        if (geoJSON.type === 'GeometryCollection') {
            out += geoJSON.geometries.forEach(gmxAPIutils.geoJSONGetArea);
        } else if (geoJSON.type === 'Feature') {
            out += gmxAPIutils.geoJSONGetArea(geoJSON.geometry);
        } else if (geoJSON.type === 'FeatureCollection') {
            out += geoJSON.features.forEach(gmxAPIutils.geoJSONGetArea);
        } if (geoJSON.type === 'Polygon' || geoJSON.type === 'MultiPolygon') {
            var coords = geoJSON.coordinates;
            if (geoJSON.type === 'Polygon') { coords = [coords]; }
            for (var i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.getRingArea(coords[i][0]);
                for (var j = 1, len1 = coords[i].length; j < len1; j++) {
                    out -= gmxAPIutils.getRingArea(coords[i][j]);
                }
            }
        }
        return out;
    },

    geoJSONGetLatLng: function(geoJSON) {
        if (geoJSON.type === 'Feature') {
            return gmxAPIutils.geoJSONGetLatLng(geoJSON.geometry);
        } else if (geoJSON.type === 'Point') {
            return L.latLng(geoJSON.coordinates[1], geoJSON.coordinates[0]);
        } else {
            throw new Error('cannot get ' + geoJSON.type + ' latLng');
        }
    },

    getRingArea: function(coords) {
        var area = 0;
        for (var i = 0, len = coords.length; i < len; i++) {
            var ipp = (i === (len - 1) ? 0 : i + 1),
                p1 = coords[i], p2 = coords[ipp];
            area += p1[0] * Math.sin(gmxAPIutils.degRad(p2[1])) - p2[0] * Math.sin(gmxAPIutils.degRad(p1[1]));
        }
        var out = Math.abs(area * gmxAPIutils.lambertCoefX * gmxAPIutils.lambertCoefY / 2);
        return out;
    },

    /** Get area
     * @memberof L.gmxUtil
     * @param {Array} L.latLng array
     * @return {Number} area in square meters
    */
    getArea: function(arr) {
        var area = 0;
        for (var i = 0, len = arr.length; i < len; i++) {
            var ipp = (i === (len - 1) ? 0 : i + 1),
                p1 = arr[i], p2 = arr[ipp];
            area += p1.lng * Math.sin(gmxAPIutils.degRad(p2.lat)) - p2.lng * Math.sin(gmxAPIutils.degRad(p1.lat));
        }
        return Math.abs(area * gmxAPIutils.lambertCoefX * gmxAPIutils.lambertCoefY / 2);
    },

    /** Get prettified size of area
     * @memberof L.gmxUtil
     * @param {Number} area in square meters
     * @param {String} type: ('km2', 'ha', 'm2')
     * @return {String} prettified area
    */
    prettifyArea: function(area, type) {
        var km2 = ' ' + L.gmxLocale.getText('units.km2');

        if (type === 'km2') {
            return ('' + (Math.round(area / 100) / 10000)) + km2;
        } else if (type === 'ha') {
            return ('' + (Math.round(area / 100) / 100)) + ' ' + L.gmxLocale.getText('units.ha');
        } else if (area < 100000 || type === 'm2') {
            return Math.round(area) + ' ' + L.gmxLocale.getText('units.m2');
        } else if (area < 3000000) {
            return ('' + (Math.round(area / 1000) / 1000)).replace('.', ',') + km2;
        } else if (area < 30000000) {
            return ('' + (Math.round(area / 10000) / 100)).replace('.', ',') + km2;
        } else if (area < 300000000) {
            return ('' + (Math.round(area / 100000) / 10)).replace('.', ',') + km2;
        }
        return (Math.round(area / 1000000)) + km2;
    },

    geoLength: function(geom) {
        var ret = 0,
            type = geom.type;
        if (type === 'MULTILINESTRING' || type === 'MultiLineString') {
            for (var i = 0, len = geom.coordinates.length; i < len; i++) {
                ret += gmxAPIutils.geoLength({type: 'LINESTRING', coordinates: geom.coordinates[i]});
            }
            return ret;
        } else if (type === 'LINESTRING' || type === 'LineString') {
            ret = gmxAPIutils.getLength(geom.coordinates);
        }
        return ret;
    },

    /** Converts Geomixer geometry to geoJSON geometry
     * @memberof L.gmxUtil
     * @param {Object} geometry - Geomixer geometry
     * @param {Boolean} mercFlag - true if coordinates in Mercator
     * @return {Object} geoJSON geometry
    */
    geometryToGeoJSON: function (geom, mercFlag) {
        if (!geom) {
            return null;
        }

        var type = geom.type === 'MULTIPOLYGON' ? 'MultiPolygon'
                : geom.type === 'POLYGON' ? 'Polygon'
                : geom.type === 'MULTILINESTRING' ? 'MultiLineString'
                : geom.type === 'LINESTRING' ? 'LineString'
                : geom.type === 'MULTIPOINT' ? 'MultiPoint'
                : geom.type === 'POINT' ? 'Point'
                : geom.type,
            coords = geom.coordinates;
        if (mercFlag) {
            coords = gmxAPIutils.coordsFromMercator(type, coords);
        }
        return {
            type: type,
            coordinates: coords
        };
    },

    convertGeometry: function (geom, fromMerc) {
        var type = geom.type === 'MULTIPOLYGON' ? 'MultiPolygon'
                : geom.type === 'POLYGON' ? 'Polygon'
                : geom.type === 'MULTILINESTRING' ? 'MultiLineString'
                : geom.type === 'LINESTRING' ? 'LineString'
                : geom.type === 'MULTIPOINT' ? 'MultiPoint'
                : geom.type === 'POINT' ? 'Point'
                : geom.type,
            coords = geom.coordinates;
        if (fromMerc) {
            coords = gmxAPIutils.coordsFromMercator(type, coords);
        } else {
            coords = gmxAPIutils.coordsToMercator(type, coords);
        }
        return {
            type: geom.type,
            coordinates: coords
        };
    },

    /** Converts GeoJSON object into GeoMixer format
     * @memberof L.gmxUtil
     * @param {Object} geometry - GeoJSON object
     * @param {Boolean} mercFlag - true if resulting Geomixer object should has coordinates in Mercator projection
     * @return {Object} Geometry in GeoMixer format
    */
    geoJSONtoGeometry: function (geoJSON, mercFlag) {
        if (geoJSON.type === 'FeatureCollection') {
            return gmxAPIutils.geoJSONtoGeometry(geoJSON.features[0], mercFlag);
        } else if (geoJSON.type === 'Feature') {
            return gmxAPIutils.geoJSONtoGeometry(geoJSON.geometry, mercFlag);
        } else if (geoJSON.type === 'FeatureCollection') {
            return gmxAPIutils.geoJSONtoGeometry(geoJSON.features[0], mercFlag);
        }

        var type = geoJSON.type === 'MultiPolygon' ? 'MULTIPOLYGON'
                : geoJSON.type === 'Polygon' ? 'POLYGON'
                : geoJSON.type === 'MultiLineString' ? 'MULTILINESTRING'
                : geoJSON.type === 'LineString' ? 'LINESTRING'
                : geoJSON.type === 'MultiPoint' ? 'MULTIPOINT'
                : geoJSON.type === 'Point' ? 'POINT'
                : geoJSON.type,
            coords = geoJSON.coordinates;
        if (mercFlag) {
            coords = gmxAPIutils.coordsToMercator(geoJSON.type, coords);
        }
        return {
            type: type,
            coordinates: coords
        };
    },

    _coordsConvert: function(type, coords, toMerc) {
        var i, len, p,
            resCoords = [];
        if (type === 'Point') {
            if (toMerc) {
                p = L.Projection.Mercator.project({lat: coords[1], lng: coords[0]});
                resCoords = [p.x, p.y];
            } else {
                p = L.Projection.Mercator.unproject({y: coords[1], x: coords[0]});
                resCoords = [p.lng, p.lat];
            }
        } else if (type === 'LineString' || type === 'MultiPoint') {
            for (i = 0, len = coords.length; i < len; i++) {
                resCoords.push(gmxAPIutils._coordsConvert('Point', coords[i], toMerc));
            }
        } else if (type === 'Polygon' || type === 'MultiLineString') {
            for (i = 0, len = coords.length; i < len; i++) {
                resCoords.push(gmxAPIutils._coordsConvert('MultiPoint', coords[i], toMerc));
            }
        } else if (type === 'MultiPolygon') {
            for (i = 0, len = coords.length; i < len; i++) {
                resCoords.push(gmxAPIutils._coordsConvert('Polygon', coords[i], toMerc));
            }
        }
        return resCoords;
    },

    coordsFromMercator: function(type, coords) {
        return gmxAPIutils._coordsConvert(type, coords, false);
    },

    coordsToMercator: function(type, coords) {
        return gmxAPIutils._coordsConvert(type, coords, true);
    },

    transformGeometry: function(geom, callback) {
        return !geom ? geom : {
            type: geom.type,
            coordinates: gmxAPIutils.forEachPoint(geom.coordinates, function(p) {
                return callback(p);
            })
        };
    },

    /** Get area for geometry
     * @memberof L.gmxUtil
     * @param {Object} geometry
     * @param {Boolean} [isMerc=true] - true if coordinates in Mercator
     * @return {Number} area in square meters
    */
    geoArea: function(geom, isMerc) {
        var i, len, ret = 0,
            type = geom.type || '';
        isMerc = isMerc === undefined || isMerc;
        if (type === 'MULTIPOLYGON' || type === 'MultiPolygon') {
            for (i = 0, len = geom.coordinates.length; i < len; i++) {
                ret += gmxAPIutils.geoArea({type: 'POLYGON', coordinates: geom.coordinates[i]}, isMerc);
            }
            return ret;
        } else if (type === 'POLYGON' || type === 'Polygon') {
            ret = gmxAPIutils.geoArea(geom.coordinates[0], isMerc);
            for (i = 1, len = geom.coordinates.length; i < len; i++) {
                ret -= gmxAPIutils.geoArea(geom.coordinates[i], isMerc);
            }
            return ret;
        } else if (geom.length) {
            var latlngs = [],
                vectorSize = typeof geom[0] === 'number' ? 2 : 1;

            for (i = 0, len = geom.length; i < len; i += vectorSize) {
                var p = vectorSize === 1 ? geom[i] : [geom[i], geom[i + 1]];
                latlngs.push(
                    isMerc ?
                    L.Projection.Mercator.unproject({y: p[1], x: p[0]}) :
                    {lat: p[1], lng: p[0]}
                );
            }
            return gmxAPIutils.getArea(latlngs);
        }
        return 0;
    },

    /** Get summary for geoJSON geometry
     * @memberof L.gmxUtil
     * @param {Object} geoJSON geometry
     * @param {Object} unitOptions {
     *                  distanceUnit: '',   // m - meters, km - kilometers, nm - nautilus miles, auto - default
     *                  squareUnit: ''      // m2 - square meters, km2 - square kilometers, ha - hectares, auto - default
     *               }
     * @return {String} Summary string for geometry
    */
    getGeoJSONSummary: function(geom, unitOptions) {
        var type = geom.type,
            units = unitOptions || {},
            out = 0,
            i, len, coords;
        if (type === 'Point') {
            coords = geom.coordinates;
            out = gmxAPIutils.formatCoordinates(coords[0], coords[1]);
        } else if (type === 'Polygon') {
            out = gmxAPIutils.prettifyArea(gmxAPIutils.geoArea(geom, false), units.squareUnit);
        } else if (type === 'MultiPolygon') {
            coords = geom.coordinates;
            for (i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.geoArea({type: 'Polygon', coordinates: coords[i]}, false);
            }
            out = gmxAPIutils.prettifyArea(out, units.squareUnit);
        } else if (type === 'LineString') {
            out = gmxAPIutils.prettifyDistance(gmxAPIutils.geoJSONGetLength(geom), units.distanceUnit);
        } else if (type === 'MultiLineString') {
            coords = geom.coordinates;
            for (i = 0, len = coords.length; i < len; i++) {
                out += gmxAPIutils.geoJSONGetLength({type: 'LineString', coordinates: coords[i]});
            }
            out = gmxAPIutils.prettifyDistance(out, units.distanceUnit);
        }
        return out;
    },

    /** Get summary for point
     * @memberof L.gmxUtil
     * @param {latlng} point
     * @param {num} format number:
     *         0: 62°52'30.68" N, 22°48'27.42" E
     *         1: 62.875188 N, 22.807617 E
     *         2: 2538932, 9031643 (EPSG:3395)
     *         3: 2538932, 9069712 (EPSG:3857)
     * @return {String} Summary string for LatLng point
    */
    getCoordinatesString: function(latlng, num) {
        var x = latlng.lng,
            y = latlng.lat,
            formats = [
                '',
                '',
                ' (EPSG:3395)',
                ' (EPSG:3857)'
            ],
            len = formats.length,
            merc,
            out = '';
        num = num || 0;
        if (x > 180) { x -= 360; }
        if (x < -180) { x += 360; }
        if (num % len === 0) {
            out = gmxAPIutils.formatCoordinates2(x, y);
        } else if (num % len === 1) {
            out = gmxAPIutils.formatCoordinates(x, y);
        } else if (num % len === 2) {
            merc = L.Projection.Mercator.project(new L.LatLng(y, x));
            out = '' + Math.round(merc.x) + ', ' + Math.round(merc.y) + formats[2];
        } else {
            merc = L.CRS.EPSG3857.project(new L.LatLng(y, x));
            out = '' + Math.round(merc.x) + ', ' + Math.round(merc.y) + formats[3];
        }
        return out;
    },

    /** Get summary for geometries array
     * @memberof L.gmxUtil
     * @param {Array} geometries array in Geomixer format
     * @param {Object} units Options for length and area
     * @return {String} Summary string for geometries array
    */
    getGeometriesSummary: function(arr, unitOptions) {
        var out = '',
            type = '',
            res = 0;
        if (!unitOptions) { unitOptions = {}; }
        if (arr) {
            arr.forEach(function(geom) {
                if (geom) {
                    type = geom.type.toUpperCase();
                    if (type.indexOf('POINT') !== -1) {
                        var latlng = L.Projection.Mercator.unproject({y: geom.coordinates[1], x: geom.coordinates[0]});
                        out = '<b>' + L.gmxLocale.getText('Coordinates') + '</b>: '
                            + gmxAPIutils.getCoordinatesString(latlng, unitOptions.coordinatesFormat);
                    } else if (type.indexOf('LINESTRING') !== -1) {
                        res += gmxAPIutils.geoLength(geom);
                    } else if (type.indexOf('POLYGON') !== -1) {
                        res += gmxAPIutils.geoArea(geom);
                    }
                }
            });
        }
        if (!out) {
            if (type.indexOf('LINESTRING') !== -1) {
                out = '<b>' + L.gmxLocale.getText('Length') + '</b>: '
                    + gmxAPIutils.prettifyDistance(res, unitOptions.distanceUnit);
            } else if (type.indexOf('POLYGON') !== -1) {
                out = '<b>' + L.gmxLocale.getText('Area') + '</b>: '
                    + gmxAPIutils.prettifyArea(res, unitOptions.squareUnit);
            }
        }
        return out;
    },

    getGeometrySummary: function(geom, unitOptions) {
        return gmxAPIutils.getGeometriesSummary([geom], unitOptions || {});
    },

    chkOnEdge: function(p1, p2, ext) { // отрезок на границе
        if ((p1[0] < ext.min.x && p2[0] < ext.min.x) || (p1[0] > ext.max.x && p2[0] > ext.max.x)) { return true; }
        if ((p1[1] < ext.min.y && p2[1] < ext.min.y) || (p1[1] > ext.max.y && p2[1] > ext.max.y)) { return true; }
        return false;
    },

    getHidden: function(coords, tb) {  // массив точек на границах тайлов
        var hiddenLines = [],
            vectorSize = typeof coords[0] === 'number' ? 2 : 1,
            prev = null;
        for (var i = 0, len = coords.length; i < len; i += vectorSize) {
            var p = vectorSize === 1 ? coords[i] : [coords[i], coords[i + 1]];
            if (prev && gmxAPIutils.chkOnEdge(p, prev, tb)) {
                hiddenLines.push(i);
            }
            prev = p;
        }
        return hiddenLines;
    },

    getNormalizeBounds: function (screenBounds, mercDeltaY) { // get bounds array from -180 180 lng
        var northWest = screenBounds.getNorthWest(),
            southEast = screenBounds.getSouthEast(),
            minX = northWest.lng,
            maxX = southEast.lng,
            w = (maxX - minX) / 2,
            minX1 = null,
            maxX1 = null,
            out = [];

        if (w >= 180) {
            minX = -180; maxX = 180;
        } else if (maxX > 180 || minX < -180) {
            var center = ((maxX + minX) / 2) % 360;
            if (center > 180) { center -= 360; }
            else if (center < -180) { center += 360; }
            minX = center - w; maxX = center + w;
            if (minX < -180) {
                minX1 = minX + 360; maxX1 = 180; minX = -180;
            } else if (maxX > 180) {
                minX1 = -180; maxX1 = maxX - 360; maxX = 180;
            }
        }
        var m1 = {x: minX, y: southEast.lat},
            m2 = {x: maxX, y: northWest.lat};

        if (mercDeltaY !== undefined) {
            m1 = L.Projection.Mercator.project(new L.LatLng([southEast.lat, minX]));
            m2 = L.Projection.Mercator.project(new L.LatLng([northWest.lat, maxX]));
            m1.y -= mercDeltaY;
            m2.y -= mercDeltaY;
        }
        out.push(gmxAPIutils.bounds([[m1.x, m1.y], [m2.x, m2.y]]));

        if (minX1) {
            var m11 = {x: minX1, y: southEast.lat},
                m12 = {x: maxX1, y: northWest.lat};
            if (mercDeltaY !== undefined) {
                m11 = L.Projection.Mercator.project(new L.LatLng([southEast.lat, minX1]));
                m12 = L.Projection.Mercator.project(new L.LatLng([northWest.lat, maxX1]));
                m11.y -= mercDeltaY;
                m12.y -= mercDeltaY;
            }
            out.push(gmxAPIutils.bounds([[m11.x, m11.y], [m12.x, m12.y]]));
        }
        return out;
    },

    toPrecision: function(x, prec) {
        var zn = Math.pow(10, prec ? prec : 4);
        return Math.round(zn * x) / zn;
    },

    getTileBounds: function(x, y, z) {  //x, y, z - GeoMixer tile coordinates
        var tileSize = gmxAPIutils.tileSizes[z],
            minx = x * tileSize,
            miny = y * tileSize;
        return gmxAPIutils.bounds([[minx, miny], [minx + tileSize, miny + tileSize]]);
    },

    parseTemplate: function(str, properties) {
        var matches = str.match(/\[([^\]]+)\]/ig);
        if (matches) {
            for (var i = 0, len = matches.length; i < len; i++) {
                var key1 = matches[i],
                    key = key1.substr(1, key1.length - 2),
                    res = key in properties ? properties[key] : '';

                str = str.replace(key1, res);
            }
        }
        return str;
    },

    getDefaultBalloonTemplate: function(properties) {
        var str = '';
        for (var key in properties) {
            str += '<b>' + key + ':</b> [' +  key + ']<br />';
        }
        str += '<br />[SUMMARY]<br />';
        return str;
    },

    parseBalloonTemplate: function(str, options) {
        var properties = options.properties;

        if (!str) {
            str = gmxAPIutils.getDefaultBalloonTemplate(properties);
        }
        var matches = str.match(/\[([^\]]+)\]/ig);
        if (matches) {
            var tileAttributeTypes = options.tileAttributeTypes,
                unitOptions = options.unitOptions,
                geometries = options.geometries;
            for (var i = 0, len = matches.length; i < len; i++) {
                var key1 = matches[i],
                    key = key1.substr(1, key1.length - 2),
                    res = '';

                if (key in properties) {
                    res = L.gmxUtil.attrToString(tileAttributeTypes[key], properties[key]);
                } else if (key === 'SUMMARY') {
                    res = options.summary || L.gmxUtil.getGeometriesSummary(geometries, unitOptions);
                }
                str = str.replace(key1, res);
            }
        }
        return str;
    },

    styleKeys: {
        marker: {
            server: ['image',   'angle',     'scale',     'minScale',     'maxScale',     'size',         'circle',     'center',     'color'],
            client: ['iconUrl', 'iconAngle', 'iconScale', 'iconMinScale', 'iconMaxScale', 'iconSize', 'iconCircle', 'iconCenter', 'iconColor']
        },
        outline: {
            server: ['color',  'opacity',   'thickness', 'dashes'],
            client: ['color',  'opacity',   'weight',    'dashArray']
        },
        fill: {
            server: ['color',     'opacity',   'image',       'pattern',     'radialGradient',     'linearGradient'],
            client: ['fillColor', 'fillOpacity', 'fillIconUrl', 'fillPattern', 'fillRadialGradient', 'fillLinearGradient']
        },
        label: {
            server: ['text',      'field',      'template',      'color',      'haloColor',      'size',          'spacing',      'align'],
            client: ['labelText', 'labelField', 'labelTemplate', 'labelColor', 'labelHaloColor', 'labelFontSize', 'labelSpacing', 'labelAlign']
        }
    },
    styleFuncKeys: {
        iconSize: 'iconSizeFunction',
        iconAngle: 'rotateFunction',
        iconScale: 'scaleFunction',
        iconColor: 'iconColorFunction',
        opacity: 'opacityFunction',
        fillOpacity: 'fillOpacityFunction',
        color: 'colorFunction',
        fillColor: 'fillColorFunction'
    },
    styleFuncError: {
        iconSize: function() { return 8; },
        iconAngle: function() { return 0; },
        iconScale: function() { return 1; },
        iconColor: function() { return 0xFF; },
        opacity: function() { return 1; },
        fillOpacity: function() { return 0.5; },
        color: function() { return 0xFF; },
        fillColor: function() { return 0xFF; }
    },
    defaultStyles: {
       MinZoom: 1,
       MaxZoom: 21,
       Filter: '',
       Balloon: '',
       DisableBalloonOnMouseMove: true,
       DisableBalloonOnClick: false,
       RenderStyle: {
            point: {    // old = {outline: {color: 255, thickness: 1}, marker:{size: 8}},
                color: 0xFF,
                weight: 1,
                iconSize: 8
            },
            linestring: {    // old = {outline: {color: 255, thickness: 1}},
                color: 0xFF,
                weight: 1
            },
            polygon: {    // old = {outline: {color: 255, thickness: 1}},
                color: 0xFF,
                weight: 1
            }
        }
    },

    getDefaultStyle: function(type) {
        var from = gmxAPIutils.defaultStyles,
            out = L.extend({}, from);
        out.RenderStyle = from.RenderStyle[type];
        return out;
    },

    toServerStyle: function(style) {   // Style leaflet->Scanex
        var out = {};

        for (var key in gmxAPIutils.styleKeys) {
            var keys = gmxAPIutils.styleKeys[key];
            for (var i = 0, len = keys.client.length; i < len; i++) {
                var key1 = keys.client[i];
                if (key1 in style) {
                    if (!out[key]) { out[key] = {}; }
                    var zn = style[key1];
                    if (key1 === 'opacity' || key1 === 'fillOpacity') {
                        zn *= 100;
                    }
                    out[key][keys.server[i]] = zn;
                }
            }
        }
        if ('iconAnchor' in style) {
            if (!out.marker) { out.marker = {}; }
            out.marker.dx = -style.iconAnchor[0];
            out.marker.dy = -style.iconAnchor[1];
        }
        return out;
    },

    fromServerStyle: function(style) {   // Style Scanex->leaflet
        var st, i, len, key1,
            out = {
                type: ''    // 'polygon', 'line', 'circle', 'square', 'image'
            };

        for (var key in gmxAPIutils.styleKeys) {
            var keys = gmxAPIutils.styleKeys[key];
            for (i = 0, len = keys.client.length; i < len; i++) {
                key1 = keys.client[i];
                if (key1 in style) {
                    out[key1] = style[key1];
                }
            }
            st = style[key];
            if (st && typeof (st) === 'object') {
                for (i = 0, len = keys.server.length; i < len; i++) {
                    key1 = keys.server[i];
                    if (key1 in st) {
                        var newKey = keys.client[i],
                            zn = st[key1];
                        if (typeof (zn) === 'string') {
                            if (gmxAPIutils.styleFuncKeys[newKey]) {
                                if (zn.match(/[^\d\.]/) === null) {
                                    zn = Number(zn);
                                } else {
                                    var func = L.gmx.Parsers.parseExpression(zn);
                                    if (func === null) {
                                        zn = gmxAPIutils.styleFuncError[newKey]();
                                    } else {
                                        out[gmxAPIutils.styleFuncKeys[newKey]] = func;
                                    }
                                }
                            }
                        } else if (key1 === 'opacity') {
                            zn /= 100;
                        }
                        out[newKey] = zn;
                    }
                }
            }
        }
        if (style.marker) {
            st = style.marker;
            if ('dx' in st || 'dy' in st) {
                var dx = st.dx || 0,
                    dy = st.dy || 0;
                out.iconAnchor = [-dx, -dy];    // For leaflet type iconAnchor
            }
        }
        return out;
    },

    getUnixTimeFromStr: function(st) {
		var arr = L.Util.trim(st).split(' ');
		arr = arr[0].split('.');

        if (arr[2].length === 4) {
			arr = arr.reverse();
		}
		return Date.UTC(arr[0], arr[1] - 1, arr[2]) / 1000;
    },

    getDateFromStr: function(st) {
		var arr = L.Util.trim(st).split(' ');
		arr = arr[0].split('.');

        if (arr[2].length === 4) {
			arr = arr.reverse();
		}
		var dt = new Date(arr[0], arr[1] - 1, arr[2]);
        return dt;
    },

    getUTCdate: function(utime) {
        var dt = new Date(utime * 1000);

        return [
            dt.getUTCFullYear(),
            gmxAPIutils.pad2(dt.getUTCMonth() + 1),
            gmxAPIutils.pad2(dt.getUTCDate())
        ].join('.');
    },

    getUTCtime: function(utime) {
        var h = Math.floor(utime / 3600),
            m = Math.floor((utime - h * 3600) / 60),
            s = Math.floor(utime - h * 3600 - m * 60);

        return [
            //gmxAPIutils.pad2(h - new Date().getTimezoneOffset() / 60),
            gmxAPIutils.pad2(h),
            gmxAPIutils.pad2(m),
            gmxAPIutils.pad2(s)
        ].join(':');
    },

    getUTCdateTime: function(utime) {
        var time = utime % (3600 * 24);

        if (time) {
            return [
                gmxAPIutils.getUTCdate(utime),
                gmxAPIutils.getUTCtime(utime % (3600 * 24))
            ].join(' ');
        } else {
            return gmxAPIutils.getUTCdate(utime);
        }
    },

    attrToString: function(type, value) {
        if (type === 'date') {
            return value ? L.gmxUtil.getUTCdate(value) : value;
        } else if (type === 'time') {
            return value ? L.gmxUtil.getUTCtime(value) : value;
        } else if (type === 'datetime') {
            return value ? L.gmxUtil.getUTCdateTime(value) : value;
        } else {
            return value;
        }
    },

    getTileAttributes: function(prop) {
        var tileAttributeIndexes = {},
            tileAttributeTypes = {};
        if (prop.attributes) {
            var attrs = prop.attributes,
                attrTypes = prop.attrTypes || null;
            if (prop.identityField) { tileAttributeIndexes[prop.identityField] = 0; }
            for (var a = 0; a < attrs.length; a++) {
                var key = attrs[a];
                tileAttributeIndexes[key] = a + 1;
                tileAttributeTypes[key] = attrTypes ? attrTypes[a] : 'string';
            }
        }
        return {
            tileAttributeTypes: tileAttributeTypes,
            tileAttributeIndexes: tileAttributeIndexes
        };
    }
};

gmxAPIutils.lambertCoefX = 100 * gmxAPIutils.distVincenty(0, 0, 0.01, 0);				// 111319.5;
gmxAPIutils.lambertCoefY = 100 * gmxAPIutils.distVincenty(0, 0, 0, 0.01) * 180 / Math.PI;	// 6335440.712613423;

(function() {
    //pre-calculate tile sizes
    for (var z = 0; z < 30; z++) {
        gmxAPIutils.tileSizes[z] = 40075016.685578496 / Math.pow(2, z);
    }
})();

gmxAPIutils.Bounds = function(arr) {
    this.min = {
        x: Number.MAX_VALUE,
        y: Number.MAX_VALUE
    };
    this.max = {
        x: -Number.MAX_VALUE,
        y: -Number.MAX_VALUE
    };
    this.extendArray(arr);
};
gmxAPIutils.Bounds.prototype = {
    extend: function(x, y) {
        if (x < this.min.x) { this.min.x = x; }
        if (x > this.max.x) { this.max.x = x; }
        if (y < this.min.y) { this.min.y = y; }
        if (y > this.max.y) { this.max.y = y; }
        return this;
    },
    extendBounds: function(bounds) {
        return this.extendArray([[bounds.min.x, bounds.min.y], [bounds.max.x, bounds.max.y]]);
    },
    extendArray: function(arr) {
        if (!arr || !arr.length) { return this; }
        var i, len;
        if (typeof arr[0] === 'number') {
            for (i = 0, len = arr.length; i < len; i += 2) {
                this.extend(arr[i], arr[i + 1]);
            }
        } else {
            for (i = 0, len = arr.length; i < len; i++) {
                this.extend(arr[i][0], arr[i][1]);
            }
        }
        return this;
    },
    addBuffer: function(dxmin, dymin, dxmax, dymax) {
        this.min.x -= dxmin;
        this.min.y -= dymin || dxmin;
        this.max.x += dxmax || dxmin;
        this.max.y += dymax || dymin || dxmin;
        return this;
    },
    contains: function (point) { // ([x, y]) -> Boolean
        var min = this.min, max = this.max,
            x = point[0], y = point[1];
        return x >= min.x && x <= max.x && y >= min.y && y <= max.y;
    },
    getCenter: function () {
        var min = this.min, max = this.max;
        return [(min.x + max.x) / 2, (min.y + max.y) / 2];
    },
    addOffset: function (offset) {
        this.min.x += offset[0]; this.max.x += offset[0];
        this.min.y += offset[1]; this.max.y += offset[1];
        return this;
    },
    intersects: function (bounds) { // (Bounds) -> Boolean
        var min = this.min,
            max = this.max,
            min2 = bounds.min,
            max2 = bounds.max;
        return max2.x > min.x && min2.x < max.x && max2.y > min.y && min2.y < max.y;
    },
    intersectsWithDelta: function (bounds, dx, dy) { // (Bounds, dx, dy) -> Boolean
        var min = this.min,
            max = this.max,
            x = dx || 0,
            y = dy || 0,
            min2 = bounds.min,
            max2 = bounds.max;
        return max2.x + x > min.x && min2.x - x < max.x && max2.y + y > min.y && min2.y - y < max.y;
    },
    isEqual: function (bounds) { // (Bounds) -> Boolean
        var min = this.min,
            max = this.max,
            min2 = bounds.min,
            max2 = bounds.max;
        return max2.x === max.x && min2.x === min.x && max2.y === max.y && min2.y === min.y;
    },
    isNodeIntersect: function (coords) {
        for (var i = 0, len = coords.length; i < len; i++) {
            if (this.contains(coords[i])) {
                return {
                    num: i,
                    point: coords[i]
                };
            }
        }
        return null;
    },
    clipPolygon: function (coords) { // (coords) -> clip coords
        var min = this.min,
            max = this.max,
            clip = [[min.x, min.y], [max.x, min.y], [max.x, max.y], [min.x, max.y]],
            cp1, cp2, s, e,
            inside = function (p) {
                return (cp2[0] - cp1[0]) * (p[1] - cp1[1]) > (cp2[1] - cp1[1]) * (p[0] - cp1[0]);
            },
            intersection = function () {
                var dc = [cp1[0] - cp2[0], cp1[1] - cp2[1]],
                    dp = [s[0] - e[0], s[1] - e[1]],
                    n1 = cp1[0] * cp2[1] - cp1[1] * cp2[0],
                    n2 = s[0] * e[1] - s[1] * e[0],
                    n3 = 1.0 / (dc[0] * dp[1] - dc[1] * dp[0]);
                return [(n1 * dp[0] - n2 * dc[0]) * n3, (n1 * dp[1] - n2 * dc[1]) * n3];
            };

        var outputList = coords;
        cp1 = clip[3];
        for (var j = 0; j < 4; j++) {
            cp2 = clip[j];
            var inputList = outputList,
                len = inputList.length;
            outputList = [];
            s = inputList[len - 1]; //last on the input list
            for (var i = 0; i < len; i++) {
                e = inputList[i];
                if (inside(e)) {
                    if (!inside(s)) { outputList.push(intersection()); }
                    outputList.push(e);
                } else if (inside(s)) {
                    outputList.push(intersection());
                }
                s = e;
            }
            cp1 = cp2;
        }
        return outputList;
    },
    clipPolyLine: function (coords, angleFlag, delta) { // (coords) -> clip coords
        delta = delta || 0;
        var min = this.min,
            max = this.max,
            bbox = [min.x - delta, min.y - delta, max.x + delta, max.y + delta],
            bitCode = function (p) {
                var code = 0;

                if (p[0] < bbox[0]) code |= 1; // left
                else if (p[0] > bbox[2]) code |= 2; // right

                if (p[1] < bbox[1]) code |= 4; // bottom
                else if (p[1] > bbox[3]) code |= 8; // top

                return code;
            },
            getAngle = function (a, b) {
                return Math.PI / 2 + Math.atan2(b[1] - a[1], a[0] - b[0]);
            },
            intersect = function (a, b, edge) {
                return edge & 8 ? [a[0] + (b[0] - a[0]) * (bbox[3] - a[1]) / (b[1] - a[1]), bbox[3]] : // top
                       edge & 4 ? [a[0] + (b[0] - a[0]) * (bbox[1] - a[1]) / (b[1] - a[1]), bbox[1]] : // bottom
                       edge & 2 ? [bbox[2], a[1] + (b[1] - a[1]) * (bbox[2] - a[0]) / (b[0] - a[0])] : // right
                       edge & 1 ? [bbox[0], a[1] + (b[1] - a[1]) * (bbox[0] - a[0]) / (b[0] - a[0])] : // left
                       null;
            },
            result = [],
            len = coords.length,
            codeA = bitCode(coords[0], bbox),
            part = [],
            i, a, b, c, codeB, lastCode;

        for (i = 1; i < len; i++) {
            a = coords[i - 1];
            b = coords[i];
            if (a[0] === b[0] && a[1] === b[1]) { continue; }
            codeB = lastCode = bitCode(b, bbox);

            while (true) {

                if (!(codeA | codeB)) { // accept
                    if (angleFlag) {
                        a[2] = getAngle(a, b);
                        c = coords[i + 1];
                        b[2] = c ? getAngle(b, c) : a[2];
                    }
                    part.push(a);

                    if (codeB !== lastCode) { // segment went outside
                        part.push(b);

                        if (i < len - 1) { // start a new line
                            result.push(part);
                            part = [];
                        }
                    } else if (i === len - 1) {
                        part.push(b);
                    }
                    break;

                } else if (codeA & codeB) { // trivial reject
                    break;

                } else if (codeA) { // a outside, intersect with clip edge
                    a = intersect(a, b, codeA, bbox);
                    codeA = bitCode(a, bbox);

                } else { // b outside
                    b = intersect(a, b, codeB, bbox);
                    codeB = bitCode(b, bbox);
                }
            }

            codeA = lastCode;
        }

        if (part.length) result.push(part);

        return result;
    }
};

gmxAPIutils.bounds = function(arr) {
    return new gmxAPIutils.Bounds(arr);
};

//скопирована из API для обеспечения независимости от него
gmxAPIutils.parseUri = function (str) {
    var	o   = gmxAPIutils.parseUri.options,
        m   = o.parser[o.strictMode ? 'strict' : 'loose'].exec(str),
        uri = {},
        i   = 14;

    while (i--) {
        uri[o.key[i]] = m[i] || '';
    }

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function ($0, $1, $2) {
        if ($1) { uri[o.q.name][$1] = $2; }
    });

    uri.hostOnly = uri.host;
    uri.host = uri.authority; // HACK

    return uri;
};

gmxAPIutils.parseUri.options = {
    strictMode: false,
    key: ['source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'],
    q:   {
        name:   'queryKey',
        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
        loose:  /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
};

if (!L.gmxUtil) { L.gmxUtil = {}; }

//public interface
L.extend(L.gmxUtil, {
    newId: gmxAPIutils.newId,
    loaderStatus: function () {},
    isIE9: gmxAPIutils.isIE(9),
    isIE10: gmxAPIutils.isIE(10),
    isIE11: gmxAPIutils.isIE(11),
    gtIE11: gmxAPIutils.gtIE(11),
    requestJSONP: gmxAPIutils.requestJSONP,
    getCadastreFeatures: gmxAPIutils.getCadastreFeatures,
    request: gmxAPIutils.request,
    getLayerItemFromServer: gmxAPIutils.getLayerItemFromServer,
    fromServerStyle: gmxAPIutils.fromServerStyle,
    toServerStyle: gmxAPIutils.toServerStyle,
    getDefaultStyle: gmxAPIutils.getDefaultStyle,
    bounds: gmxAPIutils.bounds,
    getGeometryBounds: gmxAPIutils.getGeometryBounds,
    tileSizes: gmxAPIutils.tileSizes,
    getDateFromStr: gmxAPIutils.getDateFromStr,
    getUnixTimeFromStr: gmxAPIutils.getUnixTimeFromStr,
    getUTCdate: gmxAPIutils.getUTCdate,
    getUTCtime: gmxAPIutils.getUTCtime,
    getUTCdateTime: gmxAPIutils.getUTCdateTime,
    attrToString: gmxAPIutils.attrToString,
    getTileAttributes: gmxAPIutils.getTileAttributes,
    formatCoordinates: function (latlng, type) {
        return gmxAPIutils['formatCoordinates' + (type ? '2' : '')](latlng.lng, latlng.lat);
    },
    formatDegrees: gmxAPIutils.formatDegrees,
    pad2: gmxAPIutils.pad2,
    dec2hex: gmxAPIutils.dec2hex,
	dec2rgba: gmxAPIutils.dec2rgba,
    trunc: gmxAPIutils.trunc,
    latLonFormatCoordinates: gmxAPIutils.latLonFormatCoordinates,
    latLonFormatCoordinates2: gmxAPIutils.latLonFormatCoordinates2,
    getLength: gmxAPIutils.getLength,
    geoLength: gmxAPIutils.geoLength,
    prettifyDistance: gmxAPIutils.prettifyDistance,
    getArea: gmxAPIutils.getArea,
    prettifyArea: gmxAPIutils.prettifyArea,
    geoArea: gmxAPIutils.geoArea,
    parseBalloonTemplate: gmxAPIutils.parseBalloonTemplate,
    getSVGIcon: gmxAPIutils.getSVGIcon,
    getCoordinatesString: gmxAPIutils.getCoordinatesString,
    getGeometriesSummary: gmxAPIutils.getGeometriesSummary,
    getGeometrySummary: gmxAPIutils.getGeometrySummary,
    getGeoJSONSummary: gmxAPIutils.getGeoJSONSummary,
    getPropertiesHash: gmxAPIutils.getPropertiesHash,
    distVincenty: gmxAPIutils.distVincenty,
    parseCoordinates: gmxAPIutils.parseCoordinates,
    geometryToGeoJSON: gmxAPIutils.geometryToGeoJSON,
    convertGeometry: gmxAPIutils.convertGeometry,
    transformGeometry: gmxAPIutils.transformGeometry,
    geoJSONtoGeometry: gmxAPIutils.geoJSONtoGeometry,
    geoJSONGetArea: gmxAPIutils.geoJSONGetArea,
    geoJSONGetLength: gmxAPIutils.geoJSONGetLength,
    geoJSONGetLatLng: gmxAPIutils.geoJSONGetLatLng,
    parseUri: gmxAPIutils.parseUri,
    isRectangle: gmxAPIutils.isRectangle,
    isClockwise: gmxAPIutils.isClockwise,
    isPointInPolygonWithHoles: gmxAPIutils.isPointInPolygonWithHoles,
    getPatternIcon: gmxAPIutils.getPatternIcon,
    getCircleLatLngs: gmxAPIutils.getCircleLatLngs,
    normalizeHostname: gmxAPIutils.normalizeHostname,
    getTileBounds: gmxAPIutils.getTileBounds,
    parseTemplate: gmxAPIutils.parseTemplate
});

(function() {
    var requests = {};
    var lastRequestId = 0;

    var processMessage = function(e) {

        if (!(e.origin in requests)) {
            return;
        }

        var dataStr = decodeURIComponent(e.data.replace(/\n/g, '\n\\'));
        try {
            var dataObj = JSON.parse(dataStr);
        } catch (ev) {
            console.log({Status:'error', ErrorInfo: {ErrorMessage: 'JSON.parse exeption', ExceptionType: 'JSON.parse', StackTrace: dataStr}});
        }
        var request = requests[e.origin][dataObj.CallbackName];
        if (!request) {
            return;    // message от других запросов
        }

        delete requests[e.origin][dataObj.CallbackName];
        delete dataObj.CallbackName;

        if (request.iframe.parentNode) {
            request.iframe.parentNode.removeChild(request.iframe);
        }
        if ('callback' in request) { request.callback(dataObj); }
    };

    L.DomEvent.on(window, 'message', processMessage);

    function createPostIframe2(id, callback, url) {
        var uniqueId = 'gmxAPIutils_id' + (lastRequestId++),
            iframe = L.DomUtil.create('iframe');

        iframe.style.display = 'none';
        iframe.setAttribute('id', id);
        iframe.setAttribute('name', id);    /*eslint-disable no-script-url */
        iframe.src = 'javascript:true';     /*eslint-enable */
        iframe.callbackName = uniqueId;

        var parsedURL = gmxAPIutils.parseUri(url);
        var origin = (parsedURL.protocol ? (parsedURL.protocol + ':') : window.location.protocol) + '//' + (parsedURL.host || window.location.host);

        requests[origin] = requests[origin] || {};
        requests[origin][uniqueId] = {callback: callback, iframe: iframe};

        return iframe;
    }

	//расширяем namespace
    gmxAPIutils.createPostIframe2 = createPostIframe2;

})();

// кроссдоменный POST запрос
(function()
{
	/** Посылает кроссдоменный POST запрос
	* @namespace L.gmxUtil
    * @ignore
	* @function
	*
	* @param url {string} - URL запроса
	* @param params {object} - хэш параметров-запросов
	* @param callback {function} - callback, который вызывается при приходе ответа с сервера. Единственный параметр ф-ции - собственно данные
	* @param baseForm {DOMElement} - базовая форма запроса. Используется, когда нужно отправить на сервер файл.
	*                                В функции эта форма будет модифицироваться, но после отправления запроса будет приведена к исходному виду.
	*/
	function sendCrossDomainPostRequest(url, params, callback, baseForm) {
        var form,
            id = '$$iframe_' + gmxAPIutils.newId();

        var iframe = gmxAPIutils.createPostIframe2(id, callback, url),
            originalFormAction;

        if (baseForm) {
            form = baseForm;
            originalFormAction = form.getAttribute('action');
            form.setAttribute('action', url);
            form.target = id;
        } else if (L.Browser.ielt9) {
            var str = '<form id=' + id + '" enctype="multipart/form-data" style="display:none" target="' + id + '" action="' + url + '" method="post"></form>';
            form = document.createElement(str);
        } else {
            form = document.createElement('form');
            form.style.display = 'none';
            form.setAttribute('enctype', 'multipart/form-data');
            form.target = id;
            form.setAttribute('method', 'POST');
            form.setAttribute('action', url);
            form.id = id;
        }

        var hiddenParamsDiv = document.createElement('div');
        hiddenParamsDiv.style.display = 'none';

        if (params.WrapStyle === 'window') {
            params.WrapStyle = 'message';
        }

        if (params.WrapStyle === 'message') {
            params.CallbackName = iframe.callbackName;
        }

        for (var paramName in params) {
            var input = document.createElement('input');
            var value = typeof params[paramName] !== 'undefined' ? params[paramName] : '';
            input.setAttribute('type', 'hidden');
            input.setAttribute('name', paramName);
            input.setAttribute('value', value);
            hiddenParamsDiv.appendChild(input);
        }

        form.appendChild(hiddenParamsDiv);

        if (!baseForm) {
            document.body.appendChild(form);
        }
        document.body.appendChild(iframe);

        form.submit();

        if (baseForm) {
            form.removeChild(hiddenParamsDiv);
            if (originalFormAction !== null) {
                form.setAttribute('action', originalFormAction);
            } else {
                form.removeAttribute('action');
            }
        } else {
            form.parentNode.removeChild(form);
        }
    }
    //расширяем namespace
    L.gmxUtil.sendCrossDomainPostRequest = gmxAPIutils.sendCrossDomainPostRequest = sendCrossDomainPostRequest;
})();


var styleCanvasKeys = ['strokeStyle', 'fillStyle', 'lineWidth'],
    styleCanvasKeysLen = styleCanvasKeys.length,
    utils = gmxAPIutils;

var setCanvasStyle = function(prop, indexes, ctx, style) {
    for (var i = 0; i < styleCanvasKeysLen; i++) {
        var key = styleCanvasKeys[i],
            valKey = style[key];
        if (valKey !== ctx[key]) {
            ctx[key] = valKey;
        }
    }
    if (style.dashArray) {
        var dashes = style.dashArray,
            dashOffset = style.dashOffset || 0;
        if ('setLineDash' in ctx) {
            ctx.setLineDash(dashes);
            if (ctx.lineDashOffset !== dashOffset) {
                ctx.lineDashOffset = dashOffset;
            }
        }
    } else if ('getLineDash' in ctx && ctx.getLineDash().length > 0) {
        ctx.setLineDash([]);
    }
    if (ctx.lineCap !== 'round') { ctx.lineCap = 'round'; }
    if (ctx.lineJoin !== 'round') { ctx.lineJoin = 'round'; }

    if (style.canvasPattern) {
        ctx.fillStyle = ctx.createPattern(style.canvasPattern.canvas, 'repeat');
    } else if (style.fillLinearGradient) {
        var rgr = style.fillLinearGradient,
            x1 = rgr.x1Function ? rgr.x1Function(prop, indexes) : rgr.x1,
            y1 = rgr.y1Function ? rgr.y1Function(prop, indexes) : rgr.y1,
            x2 = rgr.x2Function ? rgr.x2Function(prop, indexes) : rgr.x2,
            y2 = rgr.y2Function ? rgr.y2Function(prop, indexes) : rgr.y2,
            lineargrad = ctx.createLinearGradient(x1, y1, x2, y2);
        for (var j = 0, len = rgr.addColorStop.length; j < len; j++) {
            var arr1 = rgr.addColorStop[j],
                arrFunc = rgr.addColorStopFunctions[j],
                p0 = (arrFunc[0] ? arrFunc[0](prop, indexes) : arr1[0]),
                p2 = (arr1.length < 3 ? 100 : (arrFunc[2] ? arrFunc[2](prop, indexes) : arr1[2])),
                p1 = utils.dec2color(arrFunc[1] ? arrFunc[1](prop, indexes) : arr1[1], p2 > 1 ? p2 / 100 : p2);
            lineargrad.addColorStop(p0, p1);
        }
        ctx.fillStyle = style.fillStyle = lineargrad;
    }
};

/*
geoItem
     properties: объект (в формате векторного тайла)
     dataOption: дополнительные свойства объекта
item
     skipRasters: скрыть растр
     currentStyle: текущий canvas стиль объекта
     parsedStyleKeys: стиль прошедший парсинг
options
     ctx: canvas context
     tbounds: tile bounds
     tpx: X смещение тайла
     tpy: Y смещение тайла
     gmx: ссылка на layer._gmx
        gmx.currentZoom
        gmx.lastHover
        gmx.tileAttributeIndexes
     bgImage: растр для background
     rasters: растры по объектам для background
currentStyle
    текущий стиль
style
    стиль в новом формате
    style.image - для type='image' (`<HTMLCanvasElement || HTMLImageElement>`)
*/
L.gmxUtil.drawGeoItem = function(geoItem, item, options, currentStyle, style) {
    var propsArr = geoItem.properties,
        idr = propsArr[0],
        i, len, j, len1,
        gmx = options.gmx,
        ctx = options.ctx,
        geom = propsArr[propsArr.length - 1],
        coords = null,
        dataOption = geoItem.dataOption,
        rasters = options.rasters || {},
        tbounds = options.tbounds;

    item.currentStyle = L.extend({}, currentStyle);
    if (style) {
        if (gmx.styleHook) {
            if (!geoItem.styleExtend) {
                geoItem.styleExtend = gmx.styleHook(item, gmx.lastHover && idr === gmx.lastHover.id);
            }
            if (geoItem.styleExtend) {
                item.currentStyle = L.extend(item.currentStyle, geoItem.styleExtend);
            } else {
                return false;
            }
        }
        setCanvasStyle(propsArr, gmx.tileAttributeIndexes, ctx, item.currentStyle);
    } else {
        style = {};
    }

    var geoType = geom.type,
        dattr = {
            gmx: gmx,
            item: item,
            style: style,
            styleExtend: geoItem.styleExtend || {},
            ctx: ctx,
            tpx: options.tpx,
            tpy: options.tpy
        };
    if (geoType === 'POINT') {
        dattr.pointAttr = utils.getPixelPoint(dattr, geom.coordinates);
        if (!dattr.pointAttr) { return false; }   // point not in canvas tile
    }
    if (geoType === 'POINT' || geoType === 'MULTIPOINT') { // Отрисовка геометрии точек
        coords = geom.coordinates;
        if ('iconColor' in style && style.image) {
            if (style.lastImage !== style.image) {
                style.lastImage = style.image;
                style.lastImageData = utils.getImageData(style.image);
            }
            dattr.imageData = style.lastImageData;
        }

        if (geoType === 'MULTIPOINT') {
            for (i = 0, len = coords.length; i < len; i++) {
                dattr.coords = coords[i];
                utils.pointToCanvas(dattr);
            }
        } else {
            dattr.coords = coords;
            utils.pointToCanvas(dattr);
        }
    } else if (geoType === 'POLYGON' || geoType === 'MULTIPOLYGON') {
        if (style.image) { // set MULTIPOLYGON as marker
            dattr.coords = [(dataOption.bounds.min.x + dataOption.bounds.max.x) / 2, (dataOption.bounds.min.y + dataOption.bounds.max.y) / 2];
            dattr.pointAttr = utils.getPixelPoint(dattr, dattr.coords);
            if (dattr.pointAttr) {
                utils.pointToCanvas(dattr);
            }
        } else {
            coords = geom.coordinates;
            if (geoType === 'POLYGON') { coords = [coords]; }

            var hiddenLines = dataOption.hiddenLines || [],
                pixelsMap = dataOption.pixels,
                flagPixels = true;

            if (!pixelsMap || pixelsMap.z !== gmx.currentZoom) {
                pixelsMap = dataOption.pixels = utils.getCoordsPixels({
                    gmx: gmx,
                    coords: coords,
                    tpx: options.tpx,
                    tpy: options.tpy,
                    hiddenLines: hiddenLines
                });
            }

            var coordsToCanvas = function(func, flagFill) {
                coords = pixelsMap.coords;
                hiddenLines = pixelsMap.hidden || [];
                dattr.flagPixels = flagPixels;
                for (i = 0, len = coords.length; i < len; i++) {
                    var coords1 = coords[i];
                    var hiddenLines1 = hiddenLines[i] || [];
                    ctx.beginPath();
                    for (j = 0, len1 = coords1.length; j < len1; j++) {
                        dattr.coords = coords1[j];
                        dattr.hiddenLines = hiddenLines1[j] || [];
                        func(dattr);
                    }
                    ctx.closePath();
                    if (flagFill) { ctx.fill(); }
                }
            };
            var strokeStyle = item.currentStyle.strokeStyle || style.strokeStyle,
                lineWidth = item.currentStyle.lineWidth || style.lineWidth;
            if (strokeStyle && lineWidth) {
                coordsToCanvas(utils.polygonToCanvas);
            }
            if (options.bgImage) {
                dattr.bgImage = options.bgImage;
            } else if (rasters[idr]) {
                dattr.bgImage = rasters[idr];
            }
            if (dattr.styleExtend.skipRasters || item.skipRasters) {
                delete dattr.bgImage;
            }
            if (style.imagePattern) {
                item.currentStyle.fillStyle = ctx.createPattern(style.imagePattern, 'repeat');
            } else if (dattr.bgImage && tbounds.intersectsWithDelta(dataOption.bounds, -1, -1)) {
                if (utils.isPatternNode(dattr.bgImage)) {
                    if ('rasterOpacity' in gmx) { ctx.globalAlpha = gmx.rasterOpacity; }
                    ctx.fillStyle = ctx.createPattern(dattr.bgImage, 'no-repeat');
                    style.bgImage = true;
                }
                coordsToCanvas(utils.polygonToCanvasFill, true);
                ctx.globalAlpha = 1;
            }
            if (item.currentStyle.fillStyle || item.currentStyle.canvasPattern) {
                ctx.fillStyle = item.currentStyle.canvasPattern || item.currentStyle.fillStyle;
                coordsToCanvas(utils.polygonToCanvasFill, true);
            }
        }
    } else if (geoType === 'LINESTRING' || geoType === 'MULTILINESTRING') {
        coords = geom.coordinates;
        if (geoType === 'LINESTRING') { coords = [coords]; }
        var size = (item.currentStyle.maxSize || item.currentStyle.lineWidth) / gmx.mInPixel;
        for (i = 0, len = coords.length; i < len; i++) {
            var arr = tbounds.clipPolyLine(coords[i], true, size);
            for (j = 0, len1 = arr.length; j < len1; j++) {
                dattr.coords = arr[j];
                var pixels = utils.lineToCanvas(dattr);
                if (pixels) {
                    ctx.save();
                    utils.lineToCanvasAsIcon(pixels, dattr);
                    ctx.restore();
                }
            }
        }
    }
    return true;
};


/** Asynchronously request session keys from GeoMixer servers (given apiKey and server host)
*/
var gmxSessionManager = {
    APIKEY_PARAM: 'key',
    SCRIPT_REGEXP: [
		/\bleaflet-geomixer(-\w*)?\.js\b/,
		/\bgeomixer(-\w*)?\.js\b/
	],
    _scriptSearched: false,
    _scriptAPIKey: null,
    _searchScriptAPIKey: function() {
        var _this = this;
        if (this._scriptSearched) {
            return this._scriptAPIKey;
        }

        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].getAttribute('src'),
				arr = this.SCRIPT_REGEXP;
			for (var j = 0, len = arr.length; j < len; j++) {
				if (arr[j].exec(src)) {
					var query = src.split('?')[1];

					if (query) {
						var params = query.split('&');
						for (var p = 0; p < params.length; p++) {
							var parsedParam = params[p].split('=');
							if (parsedParam[0] === _this.APIKEY_PARAM) {
								_this._scriptAPIKey = parsedParam[1];
								break;
							}
						}
					}
					break;
				}
            }
			if (_this._scriptAPIKey) {
				break;
			}
        }
        this._scriptSearched = true;
        return this._scriptAPIKey;
    },

    //we will search apiKey in script tags iff apiKey parameter is undefined.
    //if it is defined as falsy (null, '', etc), we won't send any requests to server
    requestSessionKey: function(serverHost, apiKey) {
        var keys = this._sessionKeys;

        if (!(serverHost in keys)) {
            apiKey = typeof apiKey === 'undefined' ? this._searchScriptAPIKey() : apiKey;
            keys[serverHost] = new L.gmx.Deferred();
            if (apiKey) {
                gmxAPIutils.requestJSONP(
                    'http://' + serverHost + '/ApiKey.ashx',
                    {
                        WrapStyle: 'func',
                        Key: apiKey
                    }
                ).then(function(response) {
                    if (response && response.Status === 'ok') {
                        keys[serverHost].resolve(response.Result.Key);
                    } else {
                        keys[serverHost].reject();
                    }
                }, keys[serverHost].reject);
            } else {
                keys[serverHost].resolve('');
            }
        }
        return keys[serverHost];
    },

    //get already received session key
    getSessionKey: function(serverHost) {
        var keyPromise = this._sessionKeys[serverHost];

        return keyPromise && keyPromise.getFulfilledData() && keyPromise.getFulfilledData()[0];
    },
    _sessionKeys: {} //deferred for each host
};
L.gmx = L.gmx || {};
L.gmx.gmxSessionManager = gmxSessionManager;


/** Asynchronously request information about map given server host and map name
*/
var gmxMapManager = {
    //serverHost should be host only string like 'maps.kosmosnimki.ru' without any slashes or 'http://' prefixes
    getMap: function(serverHost, apiKey, mapName, skipTiles) {
        var maps = this._maps;
        if (!maps[serverHost] || !maps[serverHost][mapName]) {
            var def = new L.gmx.Deferred();
            maps[serverHost] = maps[serverHost] || {};
            maps[serverHost][mapName] = {promise: def};

            gmxSessionManager.requestSessionKey(serverHost, apiKey).then(function(sessionKey) {
                gmxAPIutils.requestJSONP(
                    'http://' + serverHost + '/TileSender.ashx',
                    {
                        WrapStyle: 'func',
                        skipTiles: skipTiles || 'None', // All, NotVisible, None
                        key: sessionKey,
                        MapName: mapName,
                        ModeKey: 'map'
                    }
                ).then(function(json) {
                    if (json && json.Status === 'ok' && json.Result) {
                        json.Result.properties.hostName = serverHost;
                        def.resolve(json.Result);
                    } else {
                        def.reject(json);
                    }
                }, def.reject);
            }, def.reject);
        }
        return maps[serverHost][mapName].promise;
    },

    //we will (lazy) create index by layer name to speed up multiple function calls
    findLayerInfo: function(serverHost, mapID, layerID) {
        var hostMaps = this._maps[serverHost],
            mapInfo = hostMaps && hostMaps[mapID];

        if (!mapInfo) {
            return null;
        }

        if (mapInfo.layers) {
            return mapInfo.layers[layerID];
        }

        var serverData = mapInfo.promise.getFulfilledData();

        if (!serverData) {
            return null;
        }

        mapInfo.layers = {};

        //create index by layer name
        gmxMapManager.iterateLayers(serverData[0], function(layerInfo) {
            mapInfo.layers[layerInfo.properties.name] = layerInfo;
        });

        return mapInfo.layers[layerID];
    },
    iterateLayers: function(treeInfo, callback) {
        var iterate = function(arr) {
            for (var i = 0, len = arr.length; i < len; i++) {
                var layer = arr[i];

                if (layer.type === 'group') {
                    iterate(layer.content.children);
                } else if (layer.type === 'layer') {
                    callback(layer.content);
                }
            }
        };

        treeInfo && iterate(treeInfo.children);
    },
    _maps: {} //Promise for each map. Structure: maps[serverHost][mapID]: {promise:, layers:}
};

L.gmx.gmxMapManager = gmxMapManager;


//Helper class, that represents layers of single Geomixer's map
//Creates layers from given map description
var gmxMap = function(mapInfo, commonLayerOptions) {
    this.layers = [];
    this.layersByTitle = {};
    this.layersByID = {};
    this.dataManagers = {};

    var _this = this;

    this.properties = L.extend({}, mapInfo.properties);
    this.properties.BaseLayers = this.properties.BaseLayers ? JSON.parse(this.properties.BaseLayers) : [];
    this.rawTree = mapInfo;

    this.layersCreated = new L.gmx.Deferred();

    var missingLayerTypes = {},
		dataSources = {};

    gmxMapManager.iterateLayers(mapInfo, function(layerInfo) {
        var props = layerInfo.properties,
			meta = props.MetaProperties || {},
			options = {
                mapID: mapInfo.properties.name,
                layerID: props.name
            };

        props.hostName = mapInfo.properties.hostName;

        var type = props.ContentID || props.type,
            layerOptions = L.extend(options, commonLayerOptions);

		if ('parentLayer' in meta) {      	// Set parent layer
			layerOptions.parentLayer = meta.parentLayer.Value || '';
			dataSources[options.layerID] = {
                info: layerInfo,
                options: layerOptions
            };
		} else if (type in L.gmx._layerClasses) {
            _this.addLayer(L.gmx.createLayer(layerInfo, layerOptions));
        } else {
            missingLayerTypes[type] = missingLayerTypes[type] || [];
            missingLayerTypes[type].push({
                info: layerInfo,
                options: layerOptions
            });
        }
    });

    //load missing layer types
    var loaders = [];
    for (var type in missingLayerTypes) {
        loaders.push(L.gmx._loadLayerClass(type).then(/*eslint-disable no-loop-func */function (type) {/*eslint-enable */
			var it = missingLayerTypes[type];
            for (var i = 0, len = it.length; i < len; i++) {
                _this.addLayer(L.gmx.createLayer(it[i].info, it[i].options));
            }
        }.bind(null, type)));
    }
    var hosts = {}, host, id, it;
    for (id in dataSources) {
		it = dataSources[id];
		var opt = it.options,
			pId = opt.parentLayer,
			pLayer = this.layersByID[pId];
		if (pLayer) {
			it.options.parentOptions = pLayer.getGmxProperties();
			it.options.dataManager = this.dataManagers[pId] || new DataManager(it.options.parentOptions);
			this.dataManagers[pId] = it.options.dataManager;
            this.addLayer(L.gmx.createLayer(it.info, it.options));
		} else {
			host = opt.hostName;
			if (!hosts[host]) { hosts[host] = {}; }
			if (!hosts[host][pId]) { hosts[host][pId] = []; }
			hosts[host][pId].push(id);
		}
    }
    for (host in hosts) {
		var arr = [],
			prefix = 'http://' + host;
		for (id in hosts[host]) {
			arr.push({Layer: id});
		}
        loaders.push(L.gmxUtil.requestJSONP(prefix + '/Layer/GetLayerJson.ashx',
			{
				WrapStyle: 'func',
				Layers: JSON.stringify(arr)
			},
			{
				ids: hosts[host]
			}
		).then(function(json, opt) {
			if (json && json.Status === 'ok' && json.Result) {
				json.Result.forEach(function(it) {
					var dataManager = _this.addDataManager(it),
						props = it.properties,
						pId = props.name;
					if (opt && opt.ids && opt.ids[pId]) {
						opt.ids[pId].forEach(function(id) {
							var pt = dataSources[id];
							pt.options.parentOptions = it.properties;
							pt.options.dataManager = dataManager;
							_this.addLayer(L.gmx.createLayer(pt.info, pt.options));
						});
					}
				});
			} else {
				console.info('Error: loading ', prefix + '/Layer/GetLayerJson.ashx', json.ErrorInfo);
				if (opt && opt.ids) {
					for (var pId in opt.ids) {
						opt.ids[pId].forEach(function(id) {
							_this.addLayer(new L.gmx.DummyLayer(dataSources[id].info.properties));
						});
					}
				}
			}
		}));
    }
    L.gmx.Deferred.all.apply(null, loaders).then(this.layersCreated.resolve);
};

gmxMap.prototype = {
	addDataManager: function(it) {
		var pid = it.properties.name;
		if (!this.dataManagers[pid]) {
			this.dataManagers[pid] = new DataManager(it.properties);
		}
		return this.dataManagers[pid];
	},
	getDataManager: function(id) {
		return this.dataManagers[id];
	},

	addLayer: function(layer) {
		var props = layer.getGmxProperties();

		this.layers.push(layer);
		this.layersByTitle[props.title] = layer;
		this.layersByID[props.name] = layer;

		return this;
	},

	removeLayer: function(layer) {
		var props = layer.getGmxProperties();

		for (var i = 0; i < this.layers.length; i++) {
			if (this.layers[i].getGmxProperties().name === props.name) {
				this.layers.splice(i, 1);
				break;
			}
		}

		delete this.layersByTitle[props.title];
		delete this.layersByID[props.name];

		return this;
	},

	addLayersToMap: function(leafletMap) {
		for (var l = this.layers.length - 1; l >= 0; l--) {
			var layer = this.layers[l];
			if (layer.getGmxProperties().visible) {
				leafletMap.addLayer(layer);
			}
		}

		return this;
	}
};


/*
 * gmxEventsManager - handlers manager
 */
var GmxEventsManager = L.Handler.extend({
    options: {
    },

    initialize: function (map) {
        this._map = map;
        this._layers = {};
        this._lastLayer = null;
        this._lastId = null;
        var _this = this;
        this._drawstart = null;
        this._lastCursor = '';

        var isDrawing = function () {
            if (_this._drawstart) {
                return true;
            } else if (_this._drawstart === null) {
                if (map.gmxControlsManager) {
                    var drawingControl = map.gmxControlsManager.get('drawing');
                    if (drawingControl) {
                        drawingControl.on('activechange', function (ev) {
                            _this._drawstart = ev.activeIcon;
                            map._container.style.cursor = _this._drawstart ? 'pointer' : '';
                        });
                    }
                }
                _this._drawstart = false;
            }
            return false;
        };

        var getDomIndex = function (layer) {
            var container = layer._container;
            if (container) {
                var arr = container.parentNode.childNodes;
                for (var i = 0, len = arr.length; i < len; i++) {
                    if (container === arr[i]) {
                        return i;
                    }
                }
            }
            return 0;
        };

        var skipNodeName = {
            IMG: true,
            DIV: true,
            path: true
        };

        var clearLastHover = function () {
            if (_this._lastLayer) {
                _this._lastLayer.gmxEventCheck({type: 'mousemove'}, true);
                _this._lastLayer = null;
            }
        };

        var eventCheck = function (ev) {
            var type = ev.type,
                map = _this._map,
                skipNode = false;
            if (ev.originalEvent) {
                map.gmxMouseDown = L.Browser.webkit ? ev.originalEvent.which : ev.originalEvent.buttons;
                var target = ev.originalEvent.target;
                skipNode = skipNodeName[target.nodeName] && !L.DomUtil.hasClass(target, 'leaflet-tile') && !L.DomUtil.hasClass(target, 'leaflet-popup-tip-container');
            }
            if (map._animatingZoom ||
                isDrawing() ||
                skipNode ||
                (type === 'click' &&  map._skipClick) ||        // from drawing
                (type === 'mousemove' &&  map.gmxMouseDown)
                ) {
                clearLastHover();
                map._skipClick = false;
                return;
            }
            if (ev.layerPoint) {
                map._gmxMouseLatLng = ev.latlng;
                map.gmxMousePos = map.getPixelOrigin().add(ev.layerPoint);
            }

            var arr = Object.keys(_this._layers).sort(function(a, b) {
                var la = map._layers[a],
                    lb = map._layers[b];
                if (la && lb) {
                    var oa = la.options, ob = lb.options,
                        za = (oa.zIndexOffset || 0) + (oa.zIndex || 0),
                        zb = (ob.zIndexOffset || 0) + (ob.zIndex || 0),
                        delta = zb - za;
                    return delta ? delta : _this._layers[b] - _this._layers[a];
                }
                return 0;
            });

            var layer,
                foundLayer = null,
                cursor = '';

            for (var i = 0, len = arr.length; i < len; i++) {
                var id = arr[i];
                layer = map._layers[id];
                if (layer && layer._map && !layer._animating && layer.options.clickable) {
                    if (layer.gmxEventCheck(ev)) {
                        if (layer.hasEventListeners('mouseover')) {
                            cursor = 'pointer';
                        }
                        foundLayer = layer;
                        break;
                    }
                }
            }
            if (_this._lastCursor !== cursor && !isDrawing()) {
                map._container.style.cursor = cursor;
            }
            _this._lastCursor = cursor;

            if (type !== 'zoomend') {
                if (foundLayer) {
                    if (_this._lastLayer !== foundLayer) {
                        clearLastHover();
                    }
                    _this._lastLayer = foundLayer;
                } else {
                    clearLastHover();
                }
            }
        };

        map.on({
            zoomend: function () {
                if (map._gmxMouseLatLng) {
                    setTimeout(function () {
                        eventCheck({type: 'mousemove', latlng: map._gmxMouseLatLng});
                    }, 0);
                }
            },
            click: eventCheck,
            dblclick: eventCheck,
            mousedown: eventCheck,
            mouseup: eventCheck,
            mousemove: eventCheck,
            contextmenu: eventCheck,
            layeradd: function (ev) {
                var layer = ev.layer;
                if ('gmxEventCheck' in layer && layer.options.clickable) {
                    _this._layers[layer._leaflet_id] = getDomIndex(layer);
                }
            },
            layerremove: function (ev) {
                var id = ev.layer._leaflet_id;
                delete _this._layers[id];
                if (_this._lastLayer && _this._lastLayer._leaflet_id === id) {
                    _this._lastLayer = null;
                    _this._lastId = 0;
                }
            }
        }, this);
    }
});

L.Map.addInitHook(function () {
    // Check to see if handler has already been initialized.
    if (!this._gmxEventsManager) {
        this._gmxEventsManager = new GmxEventsManager(this);
		this.isGmxDrawing = function () {
			return this._gmxEventsManager._drawstart;
		};

        this.on('remove', function () {
            if (this._gmxEventsManager) {
                this._gmxEventsManager.removeHooks();
            }
        });
    }
});


(function() {
    var DEFAULT_LANGUAGE = 'rus',
        _setKeyText = function(lang, key, item, hash) {
            if (!hash[lang]) { hash[lang] = {}; }
            hash[lang][key] = item;
        };
    L.gmxLocale = {

        setLanguage: function(lang) {
            this._language = lang;
        },

        getLanguage: function() {
            return window.language || this._language || DEFAULT_LANGUAGE;
        }
    };

    L.gmxLocaleMixin = {
        addText: function() {
            var lang = arguments[0],
                newHash = arguments[1];
            if (arguments.length === 1) {
                newHash = lang;
                lang = null;
            }
            for (var k in newHash) {
                if (lang === null) {
                    for (var k1 in newHash[k]) {
                        _setKeyText(k, k1, newHash[k][k1], this);
                    }
                } else {
                    _setKeyText(lang, k, newHash[k], this);
                }
            }
            return this;
        },

        getText: function(key) {
            var lang = L.gmxLocale.getLanguage(),
                locale = this[lang] || {};

            var keyArr = key ? key.split(/\./) : [];
            for (var i = 0, len = keyArr.length; i < len; i++) {
                if (!locale) { break; }
                locale = locale[keyArr[i]];
            }
            return locale;
        }
    };
    L.extend(L.gmxLocale, L.gmxLocaleMixin);
})();


L.extend(L.gmxLocale, {
    rus: {
        Coordinates : 'Координаты',
        Length : 'Длина',
        nodeLength : 'Длина от начала',
        edgeLength : 'Длина сегмента',
        Area : 'Площадь',
        Perimeter : 'Периметр',
        units: {
            m: 'м',
            nm: 'м.мили',
            km: 'км',
            m2: 'кв. м',
            km2: 'кв. км',
            ha: 'га',
            m2html: 'м<sup>2',
            km2html: 'км<sup>2'
        }
    }
});


L.extend(L.gmxLocale, {
    eng: {
        Coordinates : 'Coordinates',
        Length : 'Length',
        nodeLength : 'From start point',
        edgeLength : 'Segment length',
        Area : 'Area',
        Perimeter : 'Perimeter',
        units: {
            m: 'm',
            nm: 'nmi',
            km: 'km',
            m2: 'sq. m',
            km2: 'sq. km',
            ha: 'ha',
            m2html: 'm<sup>2',
            km2html: 'km<sup>2'
        }
    }
});


var gmxVectorTileLoader = {
    _loadedTiles: {},
    _getKey: function(ti) {
        return [ti.layerID, ti.x, ti.y, ti.z, typeof ti.d === 'undefined' ? -1 : ti.d, typeof ti.s === 'undefined' ? -1 : ti.s, ti.v].join(':');
    },
    load: function(tileSenderPrefix, tileInfo) {
        var key = gmxVectorTileLoader._getKey(tileInfo);

        if (!this._loadedTiles[key]) {
            var def = new L.gmx.Deferred();
            this._loadedTiles[key] = def;

            var requestParams = {
                ModeKey: 'tile',
                r: 'j',
                LayerName: tileInfo.layerID,
                z: tileInfo.z,
                x: tileInfo.x,
                y: tileInfo.y,
                v: tileInfo.v
            };

            if (tileInfo.d !== -1) {
                requestParams.Level = tileInfo.d;
                requestParams.Span = tileInfo.s;
            }

            gmxAPIutils.requestJSONP(tileSenderPrefix, requestParams, {callbackParamName: null}).then(null, function() {
                def.reject();
            });
        }

        return this._loadedTiles[key];
    }
};

window.gmxAPI = window.gmxAPI || {};
window.gmxAPI._vectorTileReceiver = window.gmxAPI._vectorTileReceiver || function(data) {
    var key = gmxVectorTileLoader._getKey({
        layerID: data.LayerName,
        x: data.x,
        y: data.y,
        z: data.z,
        d: data.level,
        s: data.span,
        v: data.v
    });

    gmxVectorTileLoader._loadedTiles[key] && gmxVectorTileLoader._loadedTiles[key].resolve(data.values, data.bbox);
};


//Single vector tile, received from GeoMixer server
//  dataProvider: has single method "load": function(x, y, z, v, s, d, callback), which calls "callback" with the following parameters:
//      - {Object[]} data - information about vector objects in tile
//      - {Number[4]} [bbox] - optional bbox of objects in tile
//  options:
//      x, y, z, v, s, d: GeoMixer vector tile point
//      dateZero: zero Date for temporal layers
//      isGeneralized: flag for generalized tile
var VectorTile = function(dataProvider, options) {
    this.dataProvider = dataProvider;
    this.loadDef = new L.gmx.Deferred();
    this.data = null;
    this.dataOptions = null;

    this.x = options.x;
    this.y = options.y;
    this.z = options.z;
    this.v = options.v;
    this.s = options.s || -1;
    this.d = options.d || -1;
    this.isGeneralized = options.isGeneralized;
    this.isFlatten = options.isFlatten;
    this.bounds = gmxAPIutils.getTileBounds(this.x, this.y, this.z);
    this.gmxTilePoint = {x: this.x, y: this.y, z: this.z, s: this.s, d: this.d};
    this.vectorTileKey = VectorTile.makeTileKey(this.x, this.y, this.z, this.v, this.s, this.d);

    if (this.s >= 0 && options.dateZero) {
        this.beginDate = new Date(options.dateZero.valueOf() + this.s * this.d * gmxAPIutils.oneDay * 1000);
        this.endDate = new Date(options.dateZero.valueOf() + (this.s + 1) * this.d * gmxAPIutils.oneDay * 1000);
    }

    this.state = 'notLoaded'; //notLoaded, loading, loaded
};

VectorTile.prototype = {
    addData: function(data, keys) {

        if (keys) {
            this.removeData(keys, true);
        }

        var len = data.length,
            dataOptions = new Array(len),
            dataBounds = gmxAPIutils.bounds();
        for (var i = 0; i < len; i++) {
            var dataOption = this._parseItem(data[i]);
            dataOptions[i] = dataOption;
            dataBounds.extendBounds(dataOption.bounds);
        }

        if (!this.data) {
            this.data = data;
            this.dataOptions = dataOptions;
        } else {
            this.data = this.data.concat(data);
            this.dataOptions = this.dataOptions.concat(dataOptions);
        }

        this.state = 'loaded';

        this.loadDef.resolve(this.data);
        return dataBounds;
    },

    removeData: function(keys) {
        for (var arr = this.data || [], i = arr.length - 1; i >= 0; i--) {
            if (keys[arr[i][0]]) {
                arr.splice(i, 1);
                if (this.dataOptions) { this.dataOptions.splice(i, 1); }
            }
        }
    },

    load: function() {
        if (this.state === 'notLoaded') {
            this.state = 'loading';
            var _this = this;
            this.dataProvider.load(_this.x, _this.y, _this.z, _this.v, _this.s, _this.d, function(data, bbox) {
                _this.bbox = bbox;
                _this.addData(data);
            });
        }

        return this.loadDef;
    },

    clear: function() {
        this.state = 'notLoaded';
        this.data = null;
        this.dataOptions = null;

        this.loadDef = new L.gmx.Deferred();
    },

    _parseItem: function(it) {
        var len = it.length,
            i;

        // TODO: old properties null = ''
        for (i = 0; i < len; i++) {
            if (it[i] === null) { it[i] = ''; }
        }

        var geo = it[len - 1],
            needFlatten = this.isFlatten,
            type = geo.type,
            isLikePolygon = type.indexOf('POLYGON') !== -1 || type.indexOf('Polygon') !== -1,
            isPolygon = type === 'POLYGON' || type === 'Polygon',
            coords = geo.coordinates,
            hiddenLines = [],
            bounds = null,
            boundsArr = [];

        if (isLikePolygon) {
            if (isPolygon) { coords = [coords]; }
            bounds = gmxAPIutils.bounds();
            var edgeBounds = gmxAPIutils.bounds().extendBounds(this.bounds).addBuffer(-0.05),
                hiddenFlag = false;
            for (i = 0, len = coords.length; i < len; i++) {
                var arr = [],
                    hiddenLines1 = [];

                for (var j = 0, len1 = coords[i].length; j < len1; j++) {
                    if (needFlatten && typeof coords[i][j][0] !== 'number') {
                        coords[i][j] = gmxAPIutils.flattenRing(coords[i][j]);
                    }
                    var b = gmxAPIutils.bounds(coords[i][j]);
                    arr.push(b);
                    if (j === 0) { bounds.extendBounds(b); }
                    // EdgeLines calc
                    var edgeArr = gmxAPIutils.getHidden(coords[i][j], edgeBounds);
                    hiddenLines1.push(edgeArr);
                    if (edgeArr.length) {
                        hiddenFlag = true;
                    }
                }
                boundsArr.push(arr);
                hiddenLines.push(hiddenLines1);
            }
            if (!hiddenFlag) { hiddenLines = null; }
            if (isPolygon) { boundsArr = boundsArr[0]; }
        } else if (type === 'POINT' || type === 'Point') {
            bounds = gmxAPIutils.bounds([coords]);
        } else if (type === 'MULTIPOINT' || type === 'MultiPoint') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                bounds.extendBounds(gmxAPIutils.bounds([coords[i]]));
            }
        } else if (type === 'LINESTRING' || type === 'LineString') {
            bounds = gmxAPIutils.bounds(coords);
        } else if (type === 'MULTILINESTRING' || type === 'MultiLineString') {
            bounds = gmxAPIutils.bounds();
            for (i = 0, len = coords.length; i < len; i++) {
                bounds.extendBounds(gmxAPIutils.bounds(coords[i]));
            }
        }
        var dataOption = {
            bounds: bounds,
            boundsArr: boundsArr
        };
        if (hiddenLines) {
            dataOption.hiddenLines = hiddenLines;
        }
        return dataOption;
    }
};
//class methods

VectorTile.makeTileKey = function(x, y, z, v, s, d) {
    return z + '_' + x + '_' + y + '_' + v + '_' + s + '_' + d;
};

VectorTile.createTileKey = function(opt) {
    return [opt.z, opt.x, opt.y, opt.v, opt.s, opt.d].join('_');
};

VectorTile.parseTileKey = function(gmxTileKey) {
    var p = gmxTileKey.split('_').map(function(it) { return Number(it); });
    return {z: p[0], x: p[1], y: p[2], v: p[3], s: p[4], d: p[5]};
};

VectorTile.boundsFromTileKey = function(gmxTileKey) {
    var p = VectorTile.parseTileKey(gmxTileKey);
    return gmxAPIutils.getTileBounds(p.x, p.y, p.z);
};


//Single observer with vector data
var Observer = L.Class.extend({
    includes: L.Mixin.Events,
    /* options : {
            type: 'resend | update',    // `resend` - send all data (like screen tile observer)
                                        // `update` - send only changed data
            callback: Func,             // will be called when layer's data for this observer is changed
            dateInterval: [dateBegin,dateEnd], // temporal interval
            bbox: bbox,                 // bbox to observe on Mercator
            filters: [String]           // filter keys array
            active: [Boolean=true]      // is this observer active
            targetZoom: [Number]        // for zoom generalized type default(null)
        }
    */
    initialize: function(options) {
        this.type = options.type || 'update';
        this._callback = options.callback;
        this._items = null;
        this.bbox = options.bbox;      // set bbox by Mercator bounds
        this.filters = options.filters || [];
        this.targetZoom = options.targetZoom || null;
        this.active = 'active' in options ? options.active : true;

        if (options.bounds) {   // set bbox by LatLngBounds
            this.setBounds(options.bounds);
        }

		var w = gmxAPIutils.worldWidthMerc,
			dx;
        if (!this.bbox) {
            this.bbox = gmxAPIutils.bounds([[-w, -w], [w, w]]);
            this.world = true;
        } else if (this.bbox.max.x > w) {
			dx = this.bbox.max.x - w;
            this.bbox1 = gmxAPIutils.bounds([[dx - w, this.bbox.max.y], [-(dx + w), this.bbox.min.y]]);
        } else if (this.bbox.min.x < -w) {
			dx = this.bbox.min.x + w;
            this.bbox1 = gmxAPIutils.bounds([[dx + w, this.bbox.max.y], [w - dx, this.bbox.min.y]]);
        }

        if (options.dateInterval) {
            this._setDateInterval(options.dateInterval[0], options.dateInterval[1]);
        }
    },

    hasFilter: function(filterName) {
        for (var i = 0, len = this.filters.length; i < len; i++) {
            if (this.filters[i] === filterName) {
                return true;
            }
        }
        return false;
    },

    activate: function() {
        if (!this.active) {
            this.active = true;
            this.fire('activate');
        }
        return this;
    },

    deactivate: function() {
        if (this.active) {
            this.active = false;
            this.fire('activate');
        }
        return this;
    },

    toggleActive: function(isActive) {
        return isActive ? this.activate() : this.deactivate();
    },

    isActive: function() {
        return this.active;
    },

    updateData: function(data) {
        var len = data.length,
            out = {count: len};

        if (this.type === 'update') {
            //calculate difference with previous data
            if (!this._items) { this._items = {}; }
            var prevItems = this._items,
                newItems = {},
                added = [],
                removed = [],
                key;

            for (var i = 0; i < len; i++) {
                var it = data[i];

                key = it.id + '_' + it.tileKey;

                newItems[key] = it;

                if (!prevItems[key]) {
                    added.push(it);
                }
            }

            for (key in prevItems) {
                if (!newItems[key]) {
                    removed.push(prevItems[key]);
                }
            }

            if (added.length) {
                out.added = added;
            }
            if (removed.length) {
                out.removed = removed;
            }

            this._items = newItems;

        } else {
            out.added = data;
        }
        this._callback(out);
        out = null;
        data = null;

        return this;
    },

    removeData: function(keys) {
        if (this.type !== 'update' || !this._items) {
            return this;
        }

        var items = this._items,
            removed = [];

        for (var id in keys) {
            if (items[id]) {
                removed.push(items[id]);
                delete items[id];
            }
        }

        if (removed.length) {
            this._callback({removed: removed});
        }

        return this;
    },

    /*setFilter: function (func) {
        this._filters.userFilter = func;
        this.fire('update');
        return this;
    },

    removeFilter: function () {
        delete this._filters.userFilter;
        this.fire('update');
        return this;
    },*/

    setBounds: function(bounds) {
        var w;
        if (!bounds) {
            if (!this.world) {
                w = gmxAPIutils.worldWidthMerc;
                this.bbox = gmxAPIutils.bounds([[-w, -w], [w, w]]);
                this.bbox1 = null;
                this.world = true;
                this.fire('update');
            }
            return this;
        }

        var min = bounds.min,
            max = bounds.max;
        if (!min || !max) {
            var latLngBounds = L.latLngBounds(bounds),
                sw = latLngBounds.getSouthWest(),
                ne = latLngBounds.getNorthEast();
            min = {x: sw.lng, y: sw.lat};
            max = {x: ne.lng, y: ne.lat};
        }
        var minX = min.x, maxX = max.x,
            minY = min.y, maxY = max.y,
            minX1 = null,
            maxX1 = null;

        this.world = false;
        w = (maxX - minX) / 2;
        if (w >= 180) {
            minX = -180; maxX = 180;
            this.world = true;
        } else if (maxX > 180 || minX < -180) {
            var center = ((maxX + minX) / 2) % 360;
            if (center > 180) { center -= 360; }
            else if (center < -180) { center += 360; }
            minX = center - w; maxX = center + w;
            if (minX < -180) {
                minX1 = minX + 360; maxX1 = 180; minX = -180;
            } else if (maxX > 180) {
                minX1 = -180; maxX1 = maxX - 360; maxX = 180;
            }
        }
        var m1 = L.Projection.Mercator.project(L.latLng(minY, minX)),
            m2 = L.Projection.Mercator.project(L.latLng(maxY, maxX));

        this.bbox = gmxAPIutils.bounds([[m1.x, m1.y], [m2.x, m2.y]]);
        this.bbox1 = null;
        if (minX1) {
            m1 = L.Projection.Mercator.project(L.latLng(minY, minX1));
            m2 = L.Projection.Mercator.project(L.latLng(maxY, maxX1));
            this.bbox1 = gmxAPIutils.bounds([[m1.x, m1.y], [m2.x, m2.y]]);
        }

        this.fire('update');
        return this;
    },

    intersects: function(bounds) {
        return this.world || this.bbox.intersects(bounds) || !!(this.bbox1 && this.bbox1.intersects(bounds));
    },

    intersectsWithTile: function(tile) {
        if (this.targetZoom) {
            var z = this.targetZoom + (this.targetZoom % 2 ? 1 : 0);
            if ((tile.isGeneralized && tile.z !== z) || tile.z > z) { return false; }
        }
        var di = this.dateInterval;
        return this.intersects(tile.bounds) && (!tile.beginDate || (di && di.endDate >= tile.beginDate && di.beginDate <= tile.endDate));
    },

    _setDateInterval: function(beginDate, endDate) {
        if (beginDate && endDate) {
            // var beginValue = beginDate.valueOf(),
                // endValue = endDate.valueOf();
            this.dateInterval = {
                beginDate: beginDate,
                endDate: endDate
            };
        } else {
            this.dateInterval = null;
        }
    },

    setDateInterval: function(beginDate, endDate) {
        var isValid = beginDate && endDate;

        if (!this.dateInterval !== !isValid ||
            isValid && (
                this.dateInterval.beginDate.valueOf() !== beginDate.valueOf() ||
                this.dateInterval.endDate.valueOf() !== endDate.valueOf()
            )
        ) {
            this._setDateInterval(beginDate, endDate);
            this.fire('update', {temporalFilter: true});
        }
        return this;
    }
});
L.gmx.observer = function(options) {
    return new Observer(options);
};


(function() {
//tree for fast tiles selection inside temporal interval
//  options:
//      TemporalTiles: tilePoints array
//      TemporalVers: tiles version array
//      TemporalPeriods: periods
//      ZeroDate: start Date
var TilesTree = function(options) {
    var _rootNodes = [],
        tiles = options.TemporalTiles || [],
        vers = options.TemporalVers || [],
        periods = options.TemporalPeriods || [],
        maxPeriod = periods[periods.length - 1],
        smin = Number.MAX_VALUE,
        arr = options.ZeroDate.split('.'),
        zn = new Date(
            (arr.length > 2 ? arr[2] : 2008),
            (arr.length > 1 ? arr[1] - 1 : 0),
            (arr.length > 0 ? arr[0] : 1)
        ),
        dateZero = new Date(zn.getTime()  - zn.getTimezoneOffset() * 60000),
        zeroUT = dateZero.getTime() / 1000;

    this.dateZero = dateZero;

    var addTile = function (node, tile, key) {
        var d = node.d;
        if (tile.d === periods[d]) {
            node.count++;
            node.tiles.push(key);
            return;
        }

        var pd = periods[d - 1],
            childrenCount = periods[d] / pd;

        if (!('children' in node)) {
            node.children = new Array(childrenCount);
        }

        var sChild = Math.floor(tile.s * tile.d / pd),
            ds = sChild - node.s * childrenCount;

        if (!node.children[ds]) {
            var pdOneDay = pd * gmxAPIutils.oneDay,
                t1 = sChild * pdOneDay + zeroUT;
            node.children[ds] = {
                d: d - 1,
                s: sChild,
                t1: t1,
                t2: t1 + pdOneDay,
                count: 0,
                tiles: []
            };
        }

        addTile(node.children[ds], tile, key);
    };

    var dmax = periods.length - 1,
        dmaxOneDay = periods[dmax] * gmxAPIutils.oneDay,
        i, len;

    for (i = 0, len = tiles.length; i < len; i++) {
        arr = tiles[i];
        var s = Number(arr[1]),
            d = Number(arr[0]);

        if (d === maxPeriod) {
            smin = Math.min(smin, s);
        }
    }
    for (i = 0, len = tiles.length; i < len; i++) {
        arr = tiles[i];
        var t = {
            x: Number(arr[2]),
            y: Number(arr[3]),
            z: Number(arr[4]),
            v: Number(vers[i]),
            s: Number(arr[1]),
            d: Number(arr[0])
        };
        if (t.d < 0) {
            continue;
        }

        var ds = Math.floor(t.s * t.d / periods[dmax]) - smin,
            cs = ds + smin;

        _rootNodes[ds] = _rootNodes[ds] || {
            d: dmax,
            s: cs,
            t1: cs * dmaxOneDay + zeroUT,
            t2: (cs + 1) * dmaxOneDay + zeroUT,
            count: 0,
            tiles: []
        };
        var key = VectorTile.createTileKey(t);

        addTile(_rootNodes[ds], t, key);
    }
    tiles = vers = null;

    //options: bounds (in mercator projection)
    this.selectTiles = function(t1, t2, options) {

        options = options || {};

        var t1Val = t1.valueOf() / 1000,
            t2Val = t2.valueOf() / 1000;

        // We will restrict tile levels by the nearest two levels to target date interval length
        // For example, if date interval length is 3 days, we wll search tiles among 1-day and 4-day tiles
        var minLevel = 0,
            dateIntervalLength = (t2Val - t1Val) / 3600 / 24;

        for (var i = 0; i < periods.length; i++) {
            if (periods[i] > dateIntervalLength) {
                minLevel = Math.max(0, i - 1);
                break;
            }
        }

        if (periods[periods.length - 1] <= dateIntervalLength) {
            minLevel = periods.length - 1;
        }

        var maxLevel = Math.min(periods.length - 1, minLevel + Number(dateIntervalLength > periods[minLevel]));

        var getCountOfIntersected = function(tileBounds, bounds) {
            var count = 0;
            for (var t = 0; t < tileBounds.length; t++) {
                if (tileBounds[t].intersects(bounds)) {
                    count++;
                }
            }

            return count;
        };

        // --------------------
        var selectTilesForNode = function(node, t1, t2) {
            if (t1 >= node.t2 || t2 <= node.t1) {
                return {count: 0, tiles: [], nodes: []};
            }

            if (options.bounds && !node.tileBounds) {
                node.tileBounds = node.tiles.map(function(it) {
                    return VectorTile.boundsFromTileKey(it);
                });
            }

            if (node.d === minLevel) {
                var count = options.bounds ? getCountOfIntersected(node.tileBounds, options.bounds) : node.count;
                return {
                    tiles: node.tiles,
                    count: count,
                    nodes: [node]
                };
            }

            var childrenCount = 0, //number of tiles if we use shorter intervals
                childrenRes = [],
                ds;

            for (ds = 0; ds < node.children.length; ds++) {
                if (node.children[ds]) {
                    childrenRes[ds] = selectTilesForNode(node.children[ds], Math.max(t1, node.t1), Math.min(t2, node.t2));
                } else {
                    childrenRes[ds] = {count: 0, tiles: [], nodes: []};
                }
                childrenCount += childrenRes[ds].count;
            }

            var intersectCount = options.bounds ? getCountOfIntersected(node.tileBounds, options.bounds) : node.count;

            if (node.d > maxLevel || childrenCount < intersectCount) {
                var resTilesArr = [],
                    resNodesArr = [];
                for (ds = 0; ds < childrenRes.length; ds++) {
                    resNodesArr.push(childrenRes[ds].nodes);
                    resTilesArr.push(childrenRes[ds].tiles);
                }

                return {
                    tiles: [].concat.apply([], resTilesArr),
                    count: childrenCount,
                    nodes: [].concat.apply([], resNodesArr)
                };
            } else {
                return {
                    tiles: node.tiles,
                    count: intersectCount,
                    nodes: [node]
                };
            }
        };

        var resTiles = [];
        for (var ds = 0; ds < _rootNodes.length; ds++) {
            if (_rootNodes[ds]) {
                var nodeSelection = selectTilesForNode(_rootNodes[ds], t1Val, t2Val);
                if (nodeSelection.tiles.length) {
                    resTiles = resTiles.concat(nodeSelection.tiles);
                }
            }
        }

        var resTilesHash = {};
        for (var t = 0; t < resTiles.length; t++) {
            resTilesHash[resTiles[t]] = true;
        }

        return {tiles: resTilesHash};
    };

    this.getNode = function(d, s) {
        if (d < 0 || s < 0) {
            return null;
        }

        var findNode = function(node, d, s) {
            if (!node) { return null; }

            if (periods[node.d] === d) {
                return node.s === s ? node : null;
            }

            var childrenCount = periods[node.d] / periods[node.d - 1];
            var sChild = Math.floor(s * d / periods[node.d - 1]);
            var ds = sChild - node.s * childrenCount;

            return node.children[ds] ? findNode(node.children[ds], d, s) : null;
        };

        for (var ds = 0; ds < _rootNodes.length; ds++) {
            var node = findNode(_rootNodes[ds], d, s);
            if (node) {
                return node;
            }
        }

        return null;
    };
};
L.gmx.tilesTree = function(options) {
    return new TilesTree(options);
};
})();


var ObserverTileLoader = L.Class.extend({
    includes: L.Mixin.Events,
    initialize: function(dataManager) {
        this._dataManager = dataManager;
        this._observerData = {};
        this._tileData = {};
    },

    addObserver: function(observer) {
        this._observerData[observer.id] = {
            observer: observer,
            tiles: {},
            leftToLoad: 0,
            loadingState: false //are we loading any tiles for this observer?
        };

        observer.on('update', this._updateObserver.bind(this, observer));

        this._updateObserver(observer);

        return this;
    },

    removeObserver: function(id) {
        var obsTiles = this._observerData[id].tiles;

        for (var tileId in obsTiles) {
            delete this._tileData[tileId].observers[id];
        }

        delete this._observerData[id];

        return this;
    },

    addTile: function(tile) {
        var leftToLoadDelta = tile.state === 'loaded' ? 0 : 1;
        tile.loadDef.then(this._tileLoadedCallback.bind(this, tile));

        var tileObservers = {};

        for (var key in this._observerData) {
            var obsInfo = this._observerData[key];

            if (obsInfo.observer.intersectsWithTile(tile)) {
                obsInfo.tiles[tile.vectorTileKey] = true;
                obsInfo.leftToLoad += leftToLoadDelta;
                tileObservers[key] = true;
            }
        }

        this._tileData[tile.vectorTileKey] = {
            observers: tileObservers,
            tile: tile
        };

        return this;
    },

    removeTile: function(tileId) {
        var tileData = this._tileData[tileId],
            leftToLoadDelta = tileData.tile.state === 'loaded' ? 0 : 1;

        for (var id in tileData.observers) {
            var observerData = this._observerData[id];
            observerData.leftToLoad -= leftToLoadDelta;
            delete observerData.tiles[tileId];
        }

        delete this._tileData[tileId];

        return this;
    },

    startLoadTiles: function(observer) {

        //force active tile list update
        this._dataManager._getActiveTileKeys();

        var obsData = this._observerData[observer.id];
        if (obsData.leftToLoad === 0) {
            this.fire('observertileload', {observer: observer});
            return this;
        }

        if (!obsData.loadingState) {
            obsData.loadingState = true;
            observer.fire('startLoadingTiles');
        }

        for (var tileId in obsData.tiles) {
            this._tileData[tileId].tile.load();
        }

        return this;
    },

    getTileObservers: function(tileId) {
        return this._tileData[tileId].observers;
    },

    getObserverLoadingState: function(observer) {
        return this._observerData[observer.id].loadingState;
    },

    _updateObserver: function(observer) {
        var obsData = this._observerData[observer.id],
            newObserverTiles = {},
            leftToLoad = 0,
            key;

        for (key in this._tileData) {
            var tile = this._tileData[key].tile;
            if (observer.intersectsWithTile(tile)) {
                newObserverTiles[key] = true;
                if (tile.state !== 'loaded') {
                    leftToLoad++;
                }
                this._tileData[key].observers[observer.id] = true;
            }
        }

        for (key in obsData.tiles) {
            if (!(key in newObserverTiles)) {
                delete this._tileData[key].observers[observer.id];
            }
        }

        obsData.tiles = newObserverTiles;
        obsData.leftToLoad = leftToLoad;
    },

    _tileLoadedCallback: function(tile) {
        this.fire('tileload', {tile: tile});

        if (!(tile.vectorTileKey in this._tileData)) {
            return;
        }

        var tileObservers = this._tileData[tile.vectorTileKey].observers;
        for (var id in tileObservers) {
            var obsData = this._observerData[id];
            obsData.leftToLoad--;

            if (obsData.leftToLoad === 0) {
                if (obsData.loadingState) {
                    obsData.loadingState = false;
                    obsData.observer.fire('stopLoadingTiles');
                }
                this.fire('observertileload', {observer: obsData.observer});
            }
        }
    }
});

var DataManager = L.Class.extend({
    includes: L.Mixin.Events,

    options: {
        name: null,                         // layer ID
        identityField: '',                  // attribute name for identity items
        attributes: [],                     // attributes names
        attrTypes: [],                      // attributes types
        tiles: null,                        // tiles array for nontemporal data
        tilesVers: null,                    // tiles version array for nontemporal data
        LayerVersion: 0,                    // layer version
        GeoProcessing: null,                // processing data
        Temporal: false,                    // only for temporal data
        TemporalColumnName: '',             // temporal attribute name
        ZeroDate: '01.01.2008',             // 0 date string
        TemporalPeriods: [],                // temporal periods
        TemporalTiles: [],                  // temporal tiles array
        TemporalVers: [],                   // temporal version array
        hostName: 'maps.kosmosnimki.ru',    // default hostName
        sessionKey: '',                     // session key
        isGeneralized: false,               // flag for use generalized tiles
        isFlatten: false                    // flag for flatten geometry
    },

    setOptions: function(options) {
        this._clearProcessing();
        if (options.GeoProcessing) {
            this.processingTile = this.addData([]);
            this._chkProcessing(options.GeoProcessing);
        }
        L.setOptions(this, options);
        this.optionsLink = options;

        this._isTemporalLayer = this.options.Temporal;

        var tileAttributes = L.gmxUtil.getTileAttributes(this.options);
        this.tileAttributeIndexes = tileAttributes.tileAttributeIndexes;
        var hostName = this.options.hostName,
            sessionKey = this.options.sessionKey;
        if (!sessionKey) {
            sessionKey = L.gmx.gmxSessionManager.getSessionKey(hostName);
        }
        this.tileSenderPrefix = 'http://' + hostName + '/' +
            'TileSender.ashx?WrapStyle=None' +
            '&key=' + encodeURIComponent(sessionKey);

        this._needCheckActiveTiles = true;
    },

    _vectorTileDataProviderLoad: function(x, y, z, v, s, d, callback) {
        var _this = this;
        gmxVectorTileLoader.load(
            _this.tileSenderPrefix,
            {x: x, y: y, z: z, v: v, s: s, d: d, layerID: _this.options.name}
        ).then(callback, function() {
            console.log('Error loading vector tile');
            callback([]);
            _this.fire('chkLayerUpdate', {dataProvider: _this}); //TODO: do we really need event here?
        });
    },

    initialize: function(options) {
        this._tilesTree = null;
        this._activeTileKeys = {};
        this._endDate = null;
        this._beginDate = null;

        this._tiles = {};
        this._filters = {};
        this._freeSubscrID = 0;
        this._items = {};
        this._observers = {};

        this._needCheckDateInterval = false;
        this._needCheckActiveTiles = true;

        var _this = this;
        this._vectorTileDataProvider = {
            load: this._vectorTileDataProviderLoad.bind(this)
        };

        this._observerTileLoader = new ObserverTileLoader(this);
        this._observerTileLoader.on('tileload', function(event) {
            var tile = event.tile;
            _this._updateItemsFromTile(tile);

            if (_this._tilesTree) {
                var treeNode = _this._tilesTree.getNode(tile.d, tile.s);
                treeNode && treeNode.count--; //decrease number of tiles to load inside this node
            }
        });

        this._observerTileLoader.on('observertileload', function(event) {
            var observer = event.observer;
            if (observer.isActive()) {
                observer.needRefresh = false;
                observer.updateData(_this.getItems(observer.id));
            }
        });
        this.setOptions(options);
        if (this._isTemporalLayer) {
            this.addFilter('TemporalFilter', function(item, tile, observer) {
                var unixTimeStamp = item.options.unixTimeStamp,
                    dates = observer.dateInterval;
                return dates && unixTimeStamp >= dates.beginDate.valueOf() && unixTimeStamp < dates.endDate.valueOf();
            });
        }
    },

    _getActiveTileKeys: function() {

        this._chkMaxDateInterval();
        if (!this._needCheckActiveTiles) {
            return this._activeTileKeys;
        }

        this._needCheckActiveTiles = false;

        if (this._isTemporalLayer) {
            var newTileKeys = {};
            if (this._beginDate && this._endDate) {
                if (!this._tilesTree) {
                    this.initTilesTree();
                }

                /*var commonBounds = L.gmxUtil.bounds();
                for (var obs in this._observers) {
                    commonBounds.extendBounds(this._observers[obs].bbox);
                }*/

                newTileKeys = this._tilesTree.selectTiles(this._beginDate, this._endDate).tiles;
            }
            this._updateActiveTilesList(newTileKeys);
        } else {
            this.initTilesList();
        }

        return this._activeTileKeys;
    },

    _getObserversByFilterName: function(filterName) {
        var oKeys = {};
        for (var id in this._observers) {
            if (this._observers[id].hasFilter(filterName)) {
                oKeys[id] = true;
            }
        }
        return oKeys;
    },

    addFilter: function(filterName, filterFunc) {
        this._filters[filterName] = filterFunc;
        this._triggerObservers(this._getObserversByFilterName(filterName));
    },

    removeFilter: function(filterName) {
        if (this._filters[filterName]) {
            var oKeys = this._getObserversByFilterName(filterName);
            delete this._filters[filterName];
            this._triggerObservers(oKeys);
        }
    },

    getItems: function(oId) {
        var resItems = [],
            observer = this._observers[oId];

        if (!observer) {
            return [];
        }

        //add internal filters
        var filters = observer.filters.concat('processingFilter');
        this._isTemporalLayer && filters.push('TemporalFilter');

        filters = filters.filter(function(filter) {
            return filter in this._filters;
        }.bind(this));

        var _this = this,
            putData = function(tile) {
                var data = tile.data;
                for (var i = 0, len = data.length; i < len; i++) {
                    var dataOption = tile.dataOptions[i];
                    if (!observer.intersects(dataOption.bounds)) { continue; }

                    var it = data[i],
                        id = it[0],
                        item = _this.getItem(id);

                    var geom = it[it.length - 1],
                        isFiltered = false;

                    for (var f = 0; f < filters.length; f++) {
                        var filterFunc = _this._filters[filters[f]];
                        if (!filterFunc(item, tile, observer, geom, dataOption)) {
                            isFiltered = true;
                            break;
                        }
                    }

                    if (!isFiltered) {
                        resItems.push({
                            id: id,
                            properties: it,
                            item: item,
                            dataOption: dataOption,
                            tileKey: tile.vectorTileKey
                        });
                    }
                }
            };
        var activeTileKeys =  this._getActiveTileKeys();
        for (var tkey in activeTileKeys) {
            var tile = _this._tiles[tkey].tile;
            if (tile.data && tile.data.length > 0 && (tile.z === 0 || observer.intersectsWithTile(tile))) {
                putData(tile);
            }
        }

        return resItems;
    },

    _updateItemsFromTile: function(tile) {
        var vectorTileKey = tile.vectorTileKey,
            data = tile.data || [],
            len = data.length,
            geomIndex = data[0] && (data[0].length - 1);

        for (var i = 0; i < len; i++) {
            var it = data[i],
                geom = it[geomIndex],
                id = it[0],
                item = this._items[id];
            if (item) {
                if (!item.processing) {
                    item.properties = it;
                    if (item.type.indexOf('MULTI') === -1) {
                        item.type = 'MULTI' + item.type;
                    }
                } else {
                    tile.data[i] = item.properties;
                }
                delete item.bounds;
                item.currentFilter = null;
            } else {
                item = {
                    id: id,
                    type: geom.type,
                    properties: it,
                    options: {
                        fromTiles: {}
                    }
                };
                this._items[id] = item;
            }
            item.options.fromTiles[vectorTileKey] = i;
            if (tile.isGeneralized) {
                item.options.isGeneralized = true;
            }

            if (this.options.TemporalColumnName) {
                var zn = it[this.tileAttributeIndexes[this.options.TemporalColumnName]];
                item.options.unixTimeStamp = zn * 1000;
            }
        }
        return len;
    },

    getMaxDateInterval: function() {
        this._chkMaxDateInterval();
		return {
			beginDate: this._beginDate,
			endDate: this._endDate
		};
    },

    _chkMaxDateInterval: function() {
        if (this._isTemporalLayer && this._needCheckDateInterval) {
            this._needCheckDateInterval = false;
            var observers = this._observers,
                newBeginDate = null,
                newEndDate = null;
            for (var oId in observers) {
                var observer = observers[oId],
                    dateInterval = observer.dateInterval;

                if (!dateInterval) {
                    continue;
                }

                if (!newBeginDate || dateInterval.beginDate < newBeginDate) {
                    newBeginDate = dateInterval.beginDate;
                }

                if (!newEndDate || dateInterval.endDate > newEndDate) {
                    newEndDate = dateInterval.endDate;
                }
            }
            if (newBeginDate && newEndDate && (this._beginDate !== newBeginDate || this._endDate !== newEndDate)) {
                this._beginDate = newBeginDate;
                this._endDate = newEndDate;
                this._needCheckActiveTiles = true;
            }
        }
    },

    addObserver: function(options, id) {
        id = id || 's' + (++this._freeSubscrID);
        var _this = this,
            observer = new Observer(options);

        observer.id = id;
        observer.needRefresh = true;
        this._observerTileLoader.addObserver(observer);

        observer
            .on('update', function(ev) {
                observer.needRefresh = true;
                if (ev.temporalFilter) {
                    _this._needCheckDateInterval = true;
                }

                _this._waitCheckObservers();
            })
            .on('activate', function() {
                _this.fire('observeractivate');
                _this.checkObserver(observer);
            });

        _this._needCheckDateInterval = true;
        this._observers[id] = observer;
        this._waitCheckObservers();

        if (observer.isActive()) {
            this.fire('observeractivate');
        }

        return observer;
    },

    getActiveObserversCount: function() {
        var count = 0;
        for (var k in this._observers) {
            if (this._observers[k].isActive()) { count++; }
        }
        return count;
    },

    getObserver: function(id) {
        return this._observers[id];
    },

    removeObserver: function(id) {
        if (this._observers[id]) {
            this._observerTileLoader.removeObserver(id);
            var isActive = this._observers[id].isActive();

            delete this._observers[id];

            if (isActive) {
                this.fire('observeractivate');
            }
        }
    },

    getObserverLoadingState: function(observer) {
        return this._observerTileLoader.getObserverLoadingState(observer);
    },

    getItemsBounds: function() {
        if (!this._itemsBounds) {
            this._itemsBounds = gmxAPIutils.bounds();
            for (var id in this._items) {
                var item = this.getItem(id);
                this._itemsBounds.extendBounds(item.bounds);
            }
        }
        return this._itemsBounds;
    },

    //combine and return all parts of geometry
    getItem: function(id) {
        var item = this._items[id];
        if (item && !item.bounds) {
            var fromTiles = item.options.fromTiles,
                arr = [];
            for (var key in fromTiles) {    // get full object bounds
                if (this._tiles[key]) {
                    var num = fromTiles[key],
                        tile = this._tiles[key].tile;
                    if (tile.state === 'loaded' && tile.dataOptions[num]) {
                        arr.push(tile.dataOptions[num].bounds);
                    } else {
                        delete fromTiles[key];
                    }
                }
            }
            if (arr.length === 1) {
                item.bounds = arr[0];
            } else {
                item.bounds = gmxAPIutils.bounds();
                var w = gmxAPIutils.worldWidthMerc;
                for (var i = 0, len = arr.length; i < len; i++) {
                    var it = arr[i];
                    if (item.bounds.max.x - it.min.x > w) {
                        it = gmxAPIutils.bounds([
                            [it.min.x + 2 * w, it.min.y],
                            [it.max.x + 2 * w, it.max.y]
                        ]);
                    }
                    item.bounds.extendBounds(it);
                }
            }
        }
        return item;
    },

    getItemMembers: function(id) {
        var fromTiles = this._items[id].options.fromTiles,
            members = [];
        for (var key in fromTiles) {
            if (this._tiles[key]) {
                var tile = this._tiles[key].tile;
                if (tile.data) {
                    var objIndex = fromTiles[key],
                        props = tile.data[objIndex],
                        dataOption = tile.dataOptions[objIndex],
                        bbox = dataOption.bounds;

                    members.push({
                        geo: props[props.length - 1],
                        width: bbox.max.x - bbox.min.x,
                        dataOption: dataOption
                    });
                }

            }
        }
        return members.sort(function(a, b) {
            return b.width - a.width;
        });
    },

    getItemGeometries: function(id) {
        var fromTiles = this._items[id] ? this._items[id].options.fromTiles : {},
            geomItems = [];
        for (var key in fromTiles) {
            if (this._tiles[key] && this._tiles[key].tile.data) {
                var tileData = this._tiles[key].tile.data,
                    props = tileData[fromTiles[key]];

                geomItems.push(gmxAPIutils.getUnFlattenGeo(props[props.length - 1]));
            }
        }
        return geomItems;
    },

    addTile: function(tile) {
        this._tiles[tile.vectorTileKey] = {tile: tile};
        this._getActiveTileKeys()[tile.vectorTileKey] = true;
        this._observerTileLoader.addTile(tile);
        this.checkObservers();
    },

    checkObserver: function(observer) {
        if (observer.needRefresh && observer.isActive()) {
            this._observerTileLoader.startLoadTiles(observer);
        }
    },

    checkObservers: function() {
        var observers = this._observers;
        for (var id in this._observers) {
            this.checkObserver(observers[id]);
        }
    },

    _waitCheckObservers: function() {
        //TODO: refactor
        if (this._checkObserversTimer) {
            clearTimeout(this._checkObserversTimer);
        }

        this._checkObserversTimer = setTimeout(L.bind(this.checkObservers, this), 0);
    },

    _triggerObservers: function(oKeys) {
        var keys = oKeys || this._observers;

        for (var id in keys) {
            if (this._observers[id]) {
                this._observers[id].needRefresh = true;
            }
        }
        this._waitCheckObservers();
    },

    _removeDataFromObservers: function(data) {
        var keys = this._observers;
        for (var id in keys) {
            this._observers[id].removeData(data);
        }
        this._waitCheckObservers();
    },

    preloadTiles: function(dateBegin, dateEnd, bounds) {
        var tileKeys = {};
        if (this._isTemporalLayer) {
            if (!this._tilesTree) {
                this.initTilesTree();
            }
            tileKeys = this._tilesTree.selectTiles(dateBegin, dateEnd).tiles;
        } else {
            this._needCheckActiveTiles = true;
            tileKeys = this._getActiveTileKeys();
        }

        var loadingDefs = [];
        for (var key in tileKeys) {
            var tile = this._getVectorTile(key, true).tile;

            if (tile.state !== 'notLoaded') {
                continue;
            }

            if (bounds && !bounds.intersects(tile.bounds)) {
                continue;
            }

            var loadDef = tile.load();
            loadingDefs.push(loadDef);
        }

        return Deferred.all.apply(null, loadingDefs);
    },

    _updateActiveTilesList: function(newTilesList) {

        if (this._tileFilteringHook) {
            var filteredTilesList = {};
            for (var tk in newTilesList) {
                if (this._tileFilteringHook(this._getVectorTile(tk, true).tile)) {
                    filteredTilesList[tk] = true;
                }
            }
            newTilesList = filteredTilesList;
        }

        var oldTilesList = this._activeTileKeys || {};

        var observersToUpdate = {},
            _this = this,
            key;

        if (this.processingTile) {
            newTilesList[this.processingTile.vectorTileKey] = true;
        }
        if (this._rasterVectorTile) {
			key = this._rasterVectorTile.vectorTileKey;
            newTilesList[key] = true;
			this._tiles[key] = {tile: this._rasterVectorTile};
		}

        var checkSubscription = function(vKey) {
            var observerIds = _this._observerTileLoader.getTileObservers(vKey);
            for (var sid in observerIds) {
                observersToUpdate[sid] = true;
            }
        };

        for (key in newTilesList) {
            if (!oldTilesList[key]) {
                this._observerTileLoader.addTile(this._getVectorTile(key, true).tile);
                checkSubscription(key);
            }
        }

        for (key in oldTilesList) {
            if (!newTilesList[key]) {
                checkSubscription(key);
                this._observerTileLoader.removeTile(key);
            }
        }

        this._activeTileKeys = newTilesList;

        this._triggerObservers(observersToUpdate);
    },

    _propertiesToArray: function(it) {
        var prop = it.properties,
            indexes = this.tileAttributeIndexes,
            arr = [];

        for (var key in indexes)
            arr[indexes[key]] = prop[key];

        arr[arr.length] = it.geometry;
        arr[0] = it.id;
        return arr;
    },

    _clearProcessing: function() {
        if (this.processingTile) {
            var _items = this._items,
                tile = this.processingTile,
                vKey = tile.vectorTileKey,
                data = tile.data || [];
            for (var i = 0, len = data.length; i < len; i++) {
                var id = data[i][0];
                if (_items[id]) {
                    var item = _items[id];
                    item.processing = null;
                    item.currentFilter = null;
                    delete item.options.fromTiles[vKey];
                    delete item.fromServerProps;
                    delete item.geometry;
               }
            }
            tile.clear();
        }
    },

    _chkProcessing: function(processing) {
        var _items = this._items,
            needProcessingFilter = false,
            skip = {},
            id, i, len, it, data;

        if (processing) {
            if (processing.Deleted) {
                for (i = 0, len = processing.Deleted.length; i < len; i++) {
                    id = processing.Deleted[i];
                    skip[id] = true;
                    if (_items[id]) {
                        _items[id].processing = true;
                        _items[id].currentFilter = null;
                    }
                    if (len > 0) { needProcessingFilter = true; }
                }
            }

            var out = {};
            if (processing.Inserted) {
                for (i = 0, len = processing.Inserted.length; i < len; i++) {
                    it = processing.Inserted[i];
                    if (!skip[it[0]]) { out[it[0]] = it; }
                }
            }

            if (processing.Updated) {
                for (i = 0, len = processing.Updated.length; i < len; i++) {
                    it = processing.Updated[i];
                    if (!skip[it[0]]) { out[it[0]] = it; }
                }
                if (!needProcessingFilter && len > 0) { needProcessingFilter = true; }
            }

            data = [];
            for (id in out) {
                if (this._items[id]) {
                    this._items[id].properties = out[id];
                    this._items[id].processing = true;
                    this._items[id].currentFilter = null;
                }
                data.push(out[id]);
            }

            if (data.length > 0) {
                this.processingTile = this.addData(data);
            }
        }
        if (needProcessingFilter) {
            this.addFilter('processingFilter', function(item, tile) {
                return tile.z === 0 || !item.processing;
            });
        } else {
            this.removeFilter('processingFilter');
        }
    },

    enableGeneralization: function() {
        if (!this.options.isGeneralized) {
            this.options.isGeneralized = true;
            this._resetTilesTree();
        }
    },

    disableGeneralization: function() {
        if (this.options.isGeneralized) {
            this.options.isGeneralized = false;
            this._resetTilesTree();
        }
    },

    _resetTilesTree: function() {
        this._tilesTree = null;
        this._needCheckActiveTiles = true;
        this._getActiveTileKeys(); //force list update
    },

    updateVersion: function(options) {
        if (options) {
            this.setOptions(options);
        }
        this._resetTilesTree();
		// this.fire('versionchange');
    },

    _getDataKeys: function(data) {
        var chkKeys = {};
        for (var i = 0, len = data.length; i < len; i++) {
            chkKeys[data[i][0]] = true;
        }
        return chkKeys;
    },

    _getProcessingTile: function() {
        if (!this.processingTile) {
        var x = -0.5, y = -0.5, z = 0, v = 0, s = -1, d = -1, isFlatten = this.options.isFlatten;

            this.processingTile = new VectorTile({load: function(x, y, z, v, s, d, callback) {
                            callback([]);
            }}, {x: x, y: y, z: z, v: v, s: s, d: d, isFlatten: isFlatten});

            this.addTile(this.processingTile);
        }
        return this.processingTile;
    },

    addData: function(data) {
        if (!data) {
            data = [];
        }
        var vTile = this._getProcessingTile(),
            chkKeys = this._getDataKeys(data),
            dataBounds = vTile.addData(data, chkKeys);

        if (this._itemsBounds) {
            this._itemsBounds.extendBounds(dataBounds);
        }
        this._updateItemsFromTile(vTile);
        this._triggerObservers();
        return vTile;
    },

    removeData: function(data) {
        this._itemsBounds = null;
        var vTile = this.processingTile;
        if (vTile) {
            var chkKeys = {};

            if (!data || !data.length) {
                return vTile;
            }

            for (var i = 0, len = data.length; i < len; i++) {
                var id = data[i];
                chkKeys[id] = true;
                delete this._items[id];
            }
            this._removeDataFromObservers(chkKeys);
            vTile.removeData(chkKeys, true);
            this._updateItemsFromTile(vTile);

            this._triggerObservers();
        }

        return vTile;
    },

    initTilesTree: function() {
        this._tilesTree = L.gmx.tilesTree(this.options);
        this.options.TemporalTiles = this.options.TemporalVers = null;

        if ('TemporalTiles' in this.optionsLink) {
            this.optionsLink.TemporalVers = this.optionsLink.TemporalTiles = null;
        }
        this.dateZero = this._tilesTree.dateZero;
        if (this.processingTile) {
            this._tiles[this.processingTile.vectorTileKey] = {
                tile: this.processingTile
            };
        }
    },

    _getVectorTile: function(vKey, createFlag) {
        if (!this._tiles[vKey] && createFlag) {
            var info = VectorTile.parseTileKey(vKey);
            info.dateZero = this.dateZero;
            this._addVectorTile(info);
        }
        return this._tiles[vKey];
    },

    _addVectorTile: function(info) {
        info.isFlatten = this.options.isFlatten;
        var tile = new VectorTile(this._vectorTileDataProvider, info),
            vKey = tile.vectorTileKey;

        this._tiles[vKey] = {tile: tile};
        return vKey;
    },

    _getGeneralizedTileKeys: function(vTilePoint) {
        var dz = vTilePoint.z % 2 ? 1 : 2,
            pz = Math.pow(2, dz),
            z = vTilePoint.z - dz,
            x = Math.floor(vTilePoint.x / pz),
            y = Math.floor(vTilePoint.y / pz),
            temp = {v: vTilePoint.v, s: -1, d: -1, isGeneralized: true},
            keys = {};

        while (z > 1) {
            var gKey = [z, x, y].join('_');
            keys[gKey] = L.extend({}, temp, {x: x, y: y, z: z});
            z -= 2;
            x = Math.floor(x / 4);
            y = Math.floor(y / 4);
        }
        return keys;
    },

    initTilesList: function() {         // For non temporal layers we create all Vector tiles
        var newActiveTileKeys = {};
        if (this.options.tiles) {
            var arr = this.options.tiles || [],
                vers = this.options.tilesVers,
                generalizedKeys = this.options.isGeneralized ? {} : null,
                newTiles = {},
                gKey, tKey, info, tHash;

            for (var i = 0, cnt = 0, len = arr.length; i < len; i += 3, cnt++) {
                info = {
                    x: Number(arr[i]),
                    y: Number(arr[i + 1]),
                    z: Number(arr[i + 2]),
                    v: Number(vers[cnt]),
                    s: -1,
                    d: -1
                };

                tHash = this._getVectorTile(VectorTile.createTileKey(info), true);
                tKey = tHash.tile.vectorTileKey;
                newTiles[tKey] = tHash;
                newActiveTileKeys[tKey] = true;
                if (generalizedKeys) {
                    var gKeys = this._getGeneralizedTileKeys(info);
                    for (gKey in gKeys) {
                        var gPoint = gKeys[gKey];
                        if (generalizedKeys[gKey]) {
                            generalizedKeys[gKey].v = Math.max(gPoint.v, generalizedKeys[gKey].v);
                        } else {
                            generalizedKeys[gKey] = gPoint;
                        }
                    }
                }
            }
            if (generalizedKeys) {
                for (gKey in generalizedKeys) {
                    info = generalizedKeys[gKey];
                    tKey = VectorTile.createTileKey(info);
                    if (!newTiles[tKey]) {
                        if (!this._tiles[tKey]) { this._addVectorTile(info); }
                        newTiles[tKey] = this._tiles[tKey];
                        newActiveTileKeys[tKey] = true;
                    }
                }
            }
            this._tiles = newTiles;
            if (this.processingTile) {
                this._tiles[this.processingTile.vectorTileKey] = {
                    tile: this.processingTile
                };
            }
        }
        this._updateActiveTilesList(newActiveTileKeys);
    },

    //Tile filtering hook filters out active vector tiles.
    //Can be used to prevent loading data from some spatial-temporal region
    setTileFilteringHook: function(filteringHook) {
        this._tileFilteringHook = filteringHook;
        this._needCheckActiveTiles = true;
        this._getActiveTileKeys(); //force list update
    },

    removeTileFilteringHook: function() {
        this._tileFilteringHook = null;
        this._needCheckActiveTiles = true;
        this._getActiveTileKeys(); //force list update
    }

});
L.gmx = L.gmx || {};
L.gmx.DataManager = DataManager;


L.gmx.VectorLayer = L.TileLayer.Canvas.extend(
{
    options: {
        openPopups: [],
        minZoom: 1,
        zIndexOffset: 0,
        isGeneralized: true,
        isFlatten: false,
        useWebGL: false,
        clickable: true
    },

    initialize: function(options) {
        options = L.setOptions(this, options);

        this.initPromise = new L.gmx.Deferred();

        this._drawQueue = [];
        this._drawQueueHash = {};

        this._drawInProgress = {};

        this._anyDrawings = false; //are we drawing something?
        this.repaintObservers = {};    // external observers like screen

        var _this = this;

        this._gmx = {
            hostName: gmxAPIutils.normalizeHostname(options.hostName || 'maps.kosmosnimki.ru'),
            mapName: options.mapID,
            useWebGL: options.useWebGL,
            layerID: options.layerID,
            beginDate: options.beginDate,
            endDate: options.endDate,
            sortItems: options.sortItems || null,
            styles: options.styles || [],
            tileSubscriptions: {},
            _tilesToLoad: 0,
            shiftXlayer: 0,
            shiftYlayer: 0,
            renderHooks: [],
            preRenderHooks: [],
            _needPopups: {}
        };
        if (options.crossOrigin) {
            this._gmx.crossOrigin = options.crossOrigin;
        }

        this.on('tileunload', function(e) {
            _this._clearTileSubscription(e.tile.zKey);
        });
    },

    // extended from L.TileLayer.Canvas
    _removeTile: function (zKey) {
        var tileLink = this._tiles[zKey];
        if (tileLink) {
            var tile = tileLink.el;
            if (tile && tile.parentNode) {
                tile.parentNode.removeChild(tile);
            }

            delete this._tiles[zKey];
        }
    },

    onAdd: function(map) {
        if (map.options.crs !== L.CRS.EPSG3857 && map.options.crs !== L.CRS.EPSG3395) {
            throw 'GeoMixer-Leaflet: map projection is incompatible with GeoMixer layer';
        }
        var gmx = this._gmx;

        gmx.shiftY = 0;
        gmx.applyShift = map.options.crs === L.CRS.EPSG3857;
        gmx.currentZoom = map.getZoom();
        gmx.styleManager.initStyles();

        L.TileLayer.Canvas.prototype.onAdd.call(this, map);

        map.on('zoomstart', this._zoomStart, this);
        map.on('zoomend', this._zoomEnd, this);
        if (gmx.properties.type === 'Vector') {
            map.on('moveend', this._moveEnd, this);
        }
        if (this.options.clickable === false) {
            this._container.style.pointerEvents = 'none';
        }
        if (gmx.balloonEnable && !this._popup) { this.bindPopup(''); }
        this.on('stylechange', this._onStyleChange, this);
        this.on('versionchange', this._onVersionChange, this);

        this._zIndexOffsetCheck();
        L.gmx.layersVersion.add(this);
        this.fire('add');
    },

    onRemove: function(map) {
        if (this._container) {
            this._container.parentNode.removeChild(this._container);
        }

        map.off({
            'viewreset': this._reset,
            'moveend': this._update
        }, this);

        if (this._animated) {
            map.off({
                'zoomanim': this._animateZoom,
                'zoomend': this._endZoomAnim
            }, this);
        }

        if (!this.options.updateWhenIdle) {
            map.off('move', this._limitedUpdate, this);
        }
        this._container = null;
        this._map = null;

        this._clearAllSubscriptions();
        map.off('zoomstart', this._zoomStart, this);
        map.off('zoomend', this._zoomEnd, this);
        this.off('stylechange', this._onStyleChange, this);

        var gmx = this._gmx;

        delete gmx.map;
        if (gmx.properties.type === 'Vector') {
            map.off('moveend', this._moveEnd, this);
        }
        if (gmx.dataManager && !gmx.dataManager.getActiveObserversCount()) {
            L.gmx.layersVersion.remove(this);
        }
        this.fire('remove');
    },

    _initContainer: function () {
        L.TileLayer.Canvas.prototype._initContainer.call(this);
        this._prpZoomData();
        this.setZIndexOffset();
    },

    _updateZIndex: function () {
        if (this._container) {
            var options = this.options,
                zIndex = options.zIndex || 0,
                zIndexOffset = options.zIndexOffset || 0;

            this._container.style.zIndex = zIndexOffset + zIndex;
        }
    },

    _update: function () {
        if (!this._map ||
            this.isExternalVisible && this.isExternalVisible(this._map._zoom) // External layer enabled on this.zoom
            ) {
            this._clearAllSubscriptions();
            return;
        }
        this._gmx.styleManager.deferred.then(this.__update.bind(this));
    },

    _addTile: function (tilePoint) {
        var myLayer = this,
            zoom = this._map._zoom,
            gmx = this._gmx;

        if (!gmx.layerType || !gmx.styleManager.isVisibleAtZoom(zoom)) {
            this._tileLoaded();
            return;
        }

        var zKey = this._tileCoordsToKey(tilePoint, zoom);
        if (!gmx.tileSubscriptions[zKey]) {
            gmx._tilesToLoad++;
            var isDrawnFirstTime = false,
                gmxTilePoint = gmxAPIutils.getTileNumFromLeaflet(tilePoint, zoom),
                done = function() {
                    if (!isDrawnFirstTime) {
                        gmx._tilesToLoad--;
                        myLayer._tileLoaded();
                        isDrawnFirstTime = true;
                    }
                },
                attr = {
                    type: 'resend',
                    active: false,
                    bbox: gmx.styleManager.getStyleBounds(gmxTilePoint),
                    filters: ['clipFilter', 'userFilter_' + gmx.layerID, 'styleFilter', 'userFilter'],
                    callback: function(data) {
                        myLayer._drawTileAsync(tilePoint, zoom, data).always(done);
                    }
                };
            if (this.options.isGeneralized) {
                attr.targetZoom = zoom;
            }
            if (gmx.layerType === 'VectorTemporal') {
                attr.dateInterval = [gmx.beginDate, gmx.endDate];
            }

            var observer = gmx.dataManager.addObserver(attr, zKey);
            observer.on('activate', function() {
                //if observer is deactivated before drawing,
                //we can consider corresponding tile as already drawn
                if (!observer.isActive()) {
                    done();
                }
            });

            observer.on('startLoadingTiles', this._chkDrawingState, this);

            gmx.tileSubscriptions[zKey] = {
                z: zoom,
                x: tilePoint.x,
                y: tilePoint.y,
                px: 256 * gmxTilePoint.x,
                py: 256 * (1 + gmxTilePoint.y)
            };
            observer.activate();
        }
    },

    _chkDrawingState: function() {
        var gmx = this._gmx,
            isDrawing = this._drawQueue.length > 0 || Object.keys(this._drawInProgress).length > 0;

        if (!isDrawing) {
            for (var key in gmx.tileSubscriptions) {
                var observer = gmx.dataManager.getObserver(key);
                if (observer && gmx.dataManager.getObserverLoadingState(observer)) {
                    isDrawing = true;
                    break;
                }
            }
        }

        if (!isDrawing && this._anyDrawings) {
            this.fire('doneDraw');
        } else  if (isDrawing && !this._anyDrawings) {
            this.fire('startDraw');
        }

        this._anyDrawings = isDrawing;
    },

    _getLoadedTilesPercentage: function (container) {
        if (!container) { return 0; }
        var len = 0, count = 0;
        var arr = ['img', 'canvas'];
        for (var key in arr) {
            var tiles = container.getElementsByTagName(arr[key]);
            if (tiles && tiles.length > 0) {
                len += tiles.length;
                for (var i = 0, len1 = tiles.length; i < len1; i++) {
                    if (tiles[i]._tileComplete) {
                        count++;
                    }
                }
            }
        }
        if (len < 1) { return 0; }
        return count / len;
    },

    _tileLoaded: function () {
        if (this._animated) {
            L.DomUtil.addClass(this._tileContainer, 'leaflet-zoom-animated');
        }
        if (this._gmx._tilesToLoad === 0) {
            this.fire('load');

            if (this._animated) {
                // clear scaled tiles after all new tiles are loaded (for performance)
                this._setClearBgBuffer(0);
            }
        }
    },

    _tileOnLoad: function (tile) {
        if (tile) { L.DomUtil.addClass(tile, 'leaflet-tile-loaded'); }
        this._tileLoaded();
    },

    _tileOnError: function () {
    },

    tileDrawn: function (tile) {
        this._tileOnLoad(tile);
    },

    // prepare for Leaflet 1.0 - this methods exists in L.GridLayer
    // converts tile coordinates to key for the tile cache
    _tileCoordsToKey: function (coords, zoom) {
        return coords.x + ':' + coords.y + ':' + (coords.z || zoom);
    },

    _getTiledPixelBounds: function (center) {
        var map = this._map,
            gmx = this._gmx,
            shiftPoint = new L.Point(gmx.shiftX, gmx.shiftY),
            pixelCenter = map.project(center, this._tileZoom).add(shiftPoint)._floor(),
            halfSize = map.getSize().divideBy(2);

        return new L.Bounds(pixelCenter.subtract(halfSize), pixelCenter.add(halfSize));
    },

    _pxBoundsToTileRange: function (bounds) {
        var tileSize = this.options.tileSize;
        return new L.Bounds(
            bounds.min.divideBy(tileSize)._floor(),
            bounds.max.divideBy(tileSize)._round());
    },

    // original for L.gmx.VectorLayer

    //public interface
    initFromDescription: function(ph) {
        var gmx = this._gmx;

        gmx.properties = ph.properties;
        gmx.geometry = ph.geometry;

        if (gmx.properties._initDone) {    // need delete tiles key
            delete gmx.properties[gmx.properties.Temporal ? 'TemporalTiles' : 'tiles'];
        }
        gmx.properties._initDone = true;

        if (!gmx.geometry) {
            var worldSize = gmxAPIutils.tileSizes[1];
            gmx.geometry = {
                type: 'POLYGON',
                coordinates: [[[-worldSize, -worldSize], [-worldSize, worldSize], [worldSize, worldSize], [worldSize, -worldSize], [-worldSize, -worldSize]]]
            };
        }

        // Original properties from the server.
        // Descendant classes can override this property
        // Not so good solution, but it works
        gmx.rawProperties = ph.rawProperties || ph.properties;

        this._updateProperties(ph.properties);

        ph.properties.isGeneralized = this.options.isGeneralized;
        ph.properties.isFlatten = this.options.isFlatten;

        gmx.dataManager = this.options.dataManager || new DataManager(ph.properties);

        if (this.options.parentOptions) {
			if (!ph.properties.styles) { ph.properties.styles = this.options.parentOptions.styles; }
			gmx.dataManager.on('versionchange', this._onVersionChange, this);
		}

		gmx.styleManager = new StyleManager(gmx);
        this.options.minZoom = gmx.styleManager.minZoom;
        this.options.maxZoom = gmx.styleManager.maxZoom;

        gmx.dataManager.on('observeractivate', function() {
            if (gmx.dataManager.getActiveObserversCount()) {
                L.gmx.layersVersion.add(this);
            } else {
                L.gmx.layersVersion.remove(this);
            }
        }, this);

        if (gmx.properties.type === 'Vector' && !('chkUpdate' in this.options)) {
            this.options.chkUpdate = true; //Check updates for vector layers by default
        }
        if (gmx.rawProperties.type !== 'Raster' && this._objectsReorderInit) {
            this._objectsReorderInit(this);
        }

        if (gmx.clusters) {
            this.bindClusters(JSON.parse(gmx.clusters));
        }
        if (gmx.filter) {
            var func = L.gmx.Parsers.parseSQL(gmx.filter.replace(/[\[\]]/g, '"'));
            if (func) {
				gmx.dataManager.addFilter('userFilter_' + gmx.layerID, function(item) {
					return gmx.layerID !== this._gmx.layerID || !func || func(item.properties, gmx.tileAttributeIndexes) ? item.properties : null;
				}.bind(this));
            }
        }
        if (gmx.dateBegin && gmx.dateEnd) {
            this.setDateInterval(gmx.dateBegin, gmx.dateEnd);
        }

        this.initPromise.resolve();
        return this;
    },

    getDataManager: function () {
		return this._gmx.dataManager;
    },

    enableGeneralization: function () {
        if (!this.options.isGeneralized) {
            this.options.isGeneralized = true;
            if (this._gmx.dataManager) {
                this._clearAllSubscriptions();
                this._gmx.dataManager.enableGeneralization();
                this.redraw();
            }
        }
    },

    disableGeneralization: function () {
        if (this.options.isGeneralized) {
            this.options.isGeneralized = false;
            if (this._gmx.dataManager) {
                this._clearAllSubscriptions();
                this._gmx.dataManager.disableGeneralization();
                this.redraw();
            }
        }
    },

    setRasterOpacity: function (opacity) {
        var _this = this;
        if (this._gmx.rasterOpacity !== opacity) {
            this._gmx.rasterOpacity = opacity;
            this.initPromise.then(function() {
                _this.repaint();
            });
        }
        return this;
    },

    getStyles: function () {
        return this._gmx.styleManager.getStyles();
    },

    getIcons: function (callback) {
        this._gmx.styleManager.getIcons(callback);
        return this;
    },

    setStyles: function (styles) {
        var _this = this;

        this.initPromise.then(function() {
            _this._gmx.styleManager.clearStyles();
            if (styles) {
                styles.forEach(function(it, i) {
                    _this.setStyle(it, i, true);
                });
            } else {
                _this.fire('stylechange');
            }
        });
        return this;
    },

    getStyle: function (num) {
        return this.getStyles()[num];
    },

    setStyle: function (style, num, createFlag) {
        var _this = this,
            gmx = this._gmx;
        this.initPromise.then(function() {
            gmx.styleManager.setStyle(style, num, createFlag).then(function () {
                _this.fire('stylechange', {num: num || 0});
            });
        });
        return this;
    },

    setStyleHook: function (func) {
        this._gmx.styleHook = func;
        this.repaint();
        return this;
    },

    removeStyleHook: function () {
        this._gmx.styleHook = null;
        return this;
    },

    setRasterHook: function (func) {
        this._gmx.rasterProcessingHook = func;
        this.repaint();
        return this;
    },

    removeRasterHook: function () {
        this._gmx.rasterProcessingHook = null;
        this.repaint();
        return this;
    },

    setFilter: function (func) {
        var gmx = this._gmx;
        gmx.dataManager.addFilter('userFilter', function(item) {
            return gmx.layerID !== this._gmx.layerID || !func || func(item) ? item.properties : null;
        }.bind(this));
        return this;
    },

    removeFilter: function () {
        this._gmx.dataManager.removeFilter('userFilter');
        return this;
    },

    setDateInterval: function (beginDate, endDate) {
        var gmx = this._gmx;

        if (gmx.dateBegin && gmx.dateEnd) {
			beginDate = gmx.dateBegin;
			endDate = gmx.dateEnd;
		}

        //check that something changed
        if (!gmx.beginDate !== !beginDate ||
            !gmx.endDate !== !endDate ||
            beginDate && (gmx.beginDate.valueOf() !== beginDate.valueOf()) ||
            endDate && (gmx.endDate.valueOf() !== endDate.valueOf())
        ) {
            if (gmx.rawProperties.maxShownPeriod && beginDate) {
                var msecPeriod = gmx.rawProperties.maxShownPeriod * 24 * 3600 * 1000;
                beginDate = new Date(Math.max(beginDate.valueOf(), endDate.valueOf() - msecPeriod));
            }

            gmx.beginDate = beginDate;
            gmx.endDate = endDate;

            var observer = null;
            for (var key in gmx.tileSubscriptions) {
                observer = gmx.dataManager.getObserver(key);
                observer.setDateInterval(beginDate, endDate);
            }
            observer = gmx.dataManager.getObserver('_Labels');
            if (observer) {
                observer.setDateInterval(beginDate, endDate);
            }
			if (window.gmxSkipTiles === 'NotVisible' || gmx.properties.UseTiles === false) {
				gmx.properties.LayerVersion = -1;
				if (this._map) {
					L.gmx.layersVersion.now();
				}
			}
            this.fire('dateIntervalChanged');
        }

        return this;
    },

    getDateInterval: function() {
        return {
            beginDate: this._gmx.beginDate,
            endDate: this._gmx.endDate
        };
    },

    addObserver: function (options) {
        return this._gmx.dataManager.addObserver(options);
    },

    removeObserver: function(observer) {
        return this._gmx.dataManager.removeObserver(observer.id);
    },

    setPositionOffset: function(dx, dy) {
        var gmx = this._gmx;
        gmx.shiftXlayer = dx;
        gmx.shiftYlayer = dy;
        this._update();
        return this;
    },

    getPositionOffset: function() {
        var gmx = this._gmx;
        return {shiftX: gmx.shiftXlayer, shiftY: gmx.shiftYlayer};
    },

    setZIndexOffset: function (offset) {
        if (arguments.length) {
            this.options.zIndexOffset = offset;
        }
        this._updateZIndex();
        return this;
    },

    repaint: function (zKeys) {
        if (this._map) {
            if (!zKeys) {
                zKeys = {};
                for (var key in this._gmx.tileSubscriptions) { zKeys[key] = true; }
                L.extend(zKeys, this.repaintObservers);
            }
            this._gmx.dataManager._triggerObservers(zKeys);
        }
    },

    redrawItem: function (id) {
        if (this._map) {
            var item = this._gmx.dataManager.getItem(id),
                gmxTiles = this._getTilesByBounds(item.bounds);

            this.repaint(gmxTiles);
        }
    },

    gmxGetCanvasTile: function (tilePoint) {
        var zKey = this._tileCoordsToKey(tilePoint);

        if (zKey in this._tiles) {
            return this._tiles[zKey];
        }
        // save tile in cache
        var tile = this._getTile();
        this._tiles[zKey] = {
            el: tile,
            coords: tilePoint,
            current: true
        };

        // tile._zKey = zKey;
        tile._zoom = this._map._zoom;
        tile._tileComplete = true;
        tile._tilePoint = tilePoint;
        this.tileDrawn(tile);
        return this._tiles[zKey];
    },

    appendTileToContainer: function (tile) {
        this._tileContainer.appendChild(tile);
        var tilePos = this._getTilePos(tile._tilePoint);
        L.DomUtil.setPosition(tile, tilePos, L.Browser.chrome || L.Browser.android23);
    },

    addData: function(data, options) {
        if (!this._gmx.mapName) {     // client side layer
            this._gmx.dataManager.addData(data, options);
            this.repaint();
        }
        return this;
    },

    removeData: function(data, options) {
        if (!this._gmx.mapName) {     // client side layer
            this._gmx.dataManager.removeData(data, options);
            this.repaint();
        }
        return this;
    },

    getStylesByProperties: function(propArray, zoom) {
        return this._gmx.styleManager.getCurrentFilters(propArray, zoom);
    },

    getItemStyle: function(id) {
        var gmx = this._gmx,
            item = gmx.dataManager.getItem(id);
        return gmx.styleManager.getObjStyle(item);
    },

    getTileAttributeTypes: function() {
        return this._gmx.tileAttributeTypes;
    },

    getTileAttributeIndexes: function() {
        return this._gmx.tileAttributeIndexes;
    },

    getItemBalloon: function(id) {
        var gmx = this._gmx,
            item = gmx.dataManager.getItem(id),
            styles = this.getStyles(),
            out = '';

        if (item && styles[item.currentFilter]) {
            var propsArr = item.properties;
            out = L.gmxUtil.parseBalloonTemplate(styles[item.currentFilter].Balloon, {
                properties: this.getItemProperties(propsArr),
                geometries: [propsArr[propsArr.length - 1]],
                tileAttributeTypes: gmx.tileAttributeTypes,
                unitOptions: this._map ? this._map.options : {}
            });
        }
        return out;
    },

    getItemProperties: function(propArray) {
        var properties = {},
            indexes = this._gmx.tileAttributeIndexes;
        for (var key in indexes) {
            properties[key] = propArray[indexes[key]];
        }
        return properties;
    },

    addPreRenderHook: function(renderHook) {
        this._gmx.preRenderHooks.push(renderHook);
        this.repaint();
    },

    removePreRenderHook: function(hook) {
        var arr = this._gmx.preRenderHooks;
        for (var i = 0, len = arr.length; i < len; i++) {
            if (arr[i] === hook) {
                arr.splice(i, 1);
                this.repaint();
                break;
            }
        }
    },

    addRenderHook: function(renderHook) {
        this._gmx.renderHooks.push(renderHook);
        this.repaint();
    },

    removeRenderHook: function(hook) {
        var arr = this._gmx.renderHooks;
        for (var i = 0, len = arr.length; i < len; i++) {
            if (arr[i] === hook) {
                arr.splice(i, 1);
                this.repaint();
                break;
            }
        }
    },

    //get original properties from the server
    getGmxProperties: function() {
        return this._gmx.rawProperties;
    },

    //returns L.LatLngBounds
    getBounds: function() {
        var proj = L.Projection.Mercator,
            gmxBounds = this._gmx.layerID ? gmxAPIutils.geoItemBounds(this._gmx.geometry).bounds : this._gmx.dataManager.getItemsBounds();

        if (gmxBounds) {
            return L.latLngBounds([proj.unproject(gmxBounds.min), proj.unproject(gmxBounds.max)]);
        } else {
            return new L.LatLngBounds();
        }
    },

    getGeometry: function() {
        if (!this._gmx.latLngGeometry) {
            this._gmx.latLngGeometry = L.gmxUtil.geometryToGeoJSON(this._gmx.geometry, true);
        }

        return this._gmx.latLngGeometry;
    },

    // internal methods
    _clearTileSubscription: function(zKey) {
        var gmx = this._gmx;

        if (zKey in gmx.tileSubscriptions) {
            var subscription = gmx.tileSubscriptions[zKey];
            if (subscription.screenTile) {
                subscription.screenTile.destructor();
            }
			var observer = gmx.dataManager.getObserver(zKey);
            if (observer) { observer.deactivate(); }
            delete gmx.tileSubscriptions[zKey];
            this._removeTile(zKey);

            if (this._anyDrawings) {
                this._chkDrawingState();
            }
        }

        if (zKey in this._drawQueueHash) {
            this._drawQueueHash[zKey].cancel();
        }
    },

    _clearAllSubscriptions: function() {
        while (this._drawQueue.length) {
            this._drawQueue[0].def.cancel();
        }

        var gmx = this._gmx;

        for (var zKey in gmx.tileSubscriptions) {
            var subscription = gmx.tileSubscriptions[zKey];
            if (subscription.screenTile) {
                subscription.screenTile.destructor();
            }
			var observer = gmx.dataManager.getObserver(zKey);
            if (observer) { observer.deactivate(); }
            gmx.dataManager.removeObserver(zKey);
            delete gmx.tileSubscriptions[zKey];
            delete this._tiles[zKey];
        }

        if (this._anyDrawings) {
            this._chkDrawingState();
        }

        gmx._tilesToLoad = 0;
    },

    _zoomStart: function() {
        this._gmx.zoomstart = true;
    },

    _zoomEnd: function() {
        this._gmx.zoomstart = false;
        this.setCurrentZoom(this._map);
        this._zIndexOffsetCheck();
    },

    _moveEnd: function() {
        if ('dataManager' in this._gmx) {
            this._gmx.dataManager.fire('moveend');
        }
    },

    _onStyleChange: function() {
        var gmx = this._gmx;
        if (!gmx.balloonEnable && this._popup) {
            this.unbindPopup();
        } else if (gmx.balloonEnable && !this._popup) {
            this.bindPopup('');
        }
        if (this._map) {
            if (this.options.minZoom !== gmx.styleManager.minZoom || this.options.maxZoom !== gmx.styleManager.maxZoom) {
                this.options.minZoom = gmx.styleManager.minZoom;
                this.options.maxZoom = gmx.styleManager.maxZoom;
                this._map._updateZoomLevels();
            }
            if (gmx.labelsLayer) {
                this._map._labelsLayer.add(this);
            } else if (!gmx.labelsLayer) {
                this._map._labelsLayer.remove(this);
            }
            if (Object.keys(gmx.tileSubscriptions).length > 0) {
                for (var key in gmx.tileSubscriptions) {    // recheck bbox on screen observers
                    var observer = gmx.dataManager.getObserver(key),
                        parsedKey = gmx.tileSubscriptions[key],
                        gmxTilePoint = gmxAPIutils.getTileNumFromLeaflet(parsedKey, parsedKey.z),
                        bbox = gmx.styleManager.getStyleBounds(gmxTilePoint);
                    if (!observer.bbox.isEqual(bbox)) {
                        var proj = L.Projection.Mercator;
                        observer.setBounds(L.latLngBounds([proj.unproject(bbox.min), proj.unproject(bbox.max)]));
                    }
                }
            } else {
                this.redraw();
            }
        }
    },

    _removeInProgressDrawing: function(zKey) {
        delete this._drawInProgress[zKey];
        this._chkDrawingState();
    },

    _drawTileAsync: function (tilePoint, zoom, data) {
        var queue = this._drawQueue,
            isEmpty = queue.length === 0,
            zKey = this._tileCoordsToKey(tilePoint, zoom),
            _this = this;

        if (this._drawQueueHash[zKey]) {
            this._drawQueueHash[zKey].cancel();
        }

        var drawNextTile = function() {
            _this._chkDrawingState();

            if (!queue.length) {
                return;
            }

            var queueItem = queue.shift();
            delete _this._drawQueueHash[queueItem.zKey];
            if (_this._map && queueItem.z === _this._map._zoom) {
                queueItem.drawDef = _this._gmxDrawTile(queueItem.tp, queueItem.z, queueItem.data);

                _this._drawInProgress[queueItem.zKey] = true;

                queueItem.drawDef.always(_this._removeInProgressDrawing.bind(_this, queueItem.zKey));

                queueItem.drawDef.then(
                    queueItem.def.resolve.bind(queueItem.def, queueItem.data),
                    queueItem.def.reject
                );
            } else {
                queueItem.def.reject();
            }
            setTimeout(drawNextTile, 0);
        };

        var gtp = gmxAPIutils.getTileNumFromLeaflet(tilePoint, zoom);
        var queueItem = {gtp: gtp, tp: tilePoint, z: zoom, zKey: zKey, data: data};
        var def = queueItem.def = new L.gmx.Deferred(function() {
            queueItem.drawDef && queueItem.drawDef.cancel();

            _this._removeInProgressDrawing(zKey);

            delete _this._drawQueueHash[zKey];
            for (var i = queue.length - 1; i >= 0; i--) {
                var elem = queue[i];
                if (elem.zKey === zKey) {
                    queue.splice(i, 1);
                    break;
                }
            }
        });
        queue.push(queueItem);

        this._drawQueueHash[zKey] = def;

        if (isEmpty) {
            setTimeout(drawNextTile, 0);
        }

        return def;
    },

    _updateShiftY: function() {
        var gmx = this._gmx,
            map = this._map,
            deltaY = 0;

        if (map) {
            var pos = map.getCenter();
            deltaY = map.options.crs.project(pos).y - L.Projection.Mercator.project(pos).y;
        }

        gmx.shiftX = Math.floor(gmx.mInPixel * (gmx.shiftXlayer || 0));
        gmx.shiftY = Math.floor(gmx.mInPixel * (deltaY + (gmx.shiftYlayer || 0)));
        gmx.shiftPoint = new L.Point(gmx.shiftX, -gmx.shiftY);     // Сдвиг слоя

        L.DomUtil.setPosition(this._tileContainer, gmx.shiftPoint);
    },

    _prpZoomData: function() {
        this.setCurrentZoom(this._map);
        // this.repaint();
    },

    setCurrentZoom: function(map) {
        var gmx = this._gmx;
        gmx.currentZoom = map._zoom;
        gmx.tileSize = gmxAPIutils.tileSizes[gmx.currentZoom];
        gmx.mInPixel = 256 / gmx.tileSize;
    },

    _zIndexOffsetCheck: function() {
        var gmx = this._gmx;
        if (gmx.properties.fromType !== 'Raster' && (gmx.IsRasterCatalog || gmx.Quicklook)) {
            var minZoom = gmx.IsRasterCatalog ? gmx.minZoomRasters : gmx.minZoomQuicklooks;
            var zIndexOffset = this._map._zoom < minZoom ? L.gmx.VectorLayer.prototype.options.zIndexOffset : 0;
            if (zIndexOffset !== this.options.zIndexOffset) {
                this.setZIndexOffset(zIndexOffset);
            }
        }
    },

    _setClearBgBuffer: function (zd) {
        if (this._clearBgBufferTimer) { clearTimeout(this._clearBgBufferTimer); }
        var _this = this;
        this._clearBgBufferTimer = setTimeout(function () {
            if (_this._bgBuffer) {
                _this._clearBgBuffer();
            }
        }, zd || 0);
    },

    _getNeedPopups: function () {
        var out = {},
            openPopups = this.options.openPopups;
        for (var i = 0, len = openPopups.length; i < len; i++) {
            out[openPopups[i]] = false;
        }
        return out;
    },

    __update: function () {
        var map = this._map;
        if (!map) { return; }
        var zoom = map.getZoom(),
            center = map.getCenter();

        if (this._gmx.applyShift) {
            this._updateShiftY();
        }
        this._tileZoom = zoom;
        if (this.options.openPopups.length) {
            this._gmx._needPopups = this._getNeedPopups();
            this.options.openPopups = [];
        }

        var pixelBounds = this._getTiledPixelBounds(center),
            tileRange = this._pxBoundsToTileRange(pixelBounds),
            limit = this._getWrapTileNum();

        if (tileRange.min.y < 0) { tileRange.min.y = 0; }
        if (tileRange.max.y >= limit.y) { tileRange.max.y = limit.y - 1; }

        this._chkTileSubscriptions(zoom, tileRange);

        if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
            this._setClearBgBuffer(500);
            return;
        }

        // create a queue of coordinates to load tiles from
        for (var j = tileRange.min.y; j <= tileRange.max.y; j++) {
            for (var i = tileRange.min.x; i <= tileRange.max.x; i++) {
                var coords = new L.Point(i, j);
                coords.z = this._tileZoom;

                if (!this._tiles[this._tileCoordsToKey(coords)]) {
                    this._addTile(coords);
                }
            }
        }
    },

    _chkTileSubscriptions: function (zoom, tileRange) {
        //L.TileVector will remove all tiles from other zooms.
        //But it will not remove subscriptions without tiles - we should do it ourself
        var gmx = this._gmx,
            min = tileRange.min,
            max = tileRange.max;

        for (var zKey in gmx.tileSubscriptions) {
            var subscription = gmx.tileSubscriptions[zKey];
            if (subscription.z !== zoom
                || subscription.x < min.x
                || subscription.x > max.x
                || subscription.y < min.y
                || subscription.y > max.y
            ) {
                this._clearTileSubscription(zKey);
            }
        }
    },

    _getScreenTile: function (tilePoint, zoom) {
        var gmx = this._gmx,
            zKey = this._tileCoordsToKey(tilePoint, zoom),
            subscription = gmx.tileSubscriptions[zKey],
            screenTile = null;
        if (subscription) {
            if (subscription.screenTile) {
                screenTile = subscription.screenTile;
            } else {
                subscription.screenTile = screenTile = new ScreenVectorTile(this, tilePoint, zoom);
            }
        }
        return screenTile;
    },

    _gmxDrawTile: function (tilePoint, zoom, data) {
        var gmx = this._gmx,
            cancelled = false,
            screenTileDrawPromise = null,
            def = new L.gmx.Deferred(function() {
                cancelled = true;
                screenTileDrawPromise && screenTileDrawPromise.cancel();
            });

        if (!this._map) {
            def.reject();
            return def;
        }
        var screenTile = this._getScreenTile(tilePoint, zoom || this._map._zoom);
        if (screenTile) {
            gmx.styleManager.deferred.then(function () {
                if (!cancelled) {
                    screenTileDrawPromise = screenTile.drawTile(data);
                    screenTileDrawPromise.then(def.resolve.bind(def, data), def.reject);
                }
            });
        }
       return def;
    },

    _getTilesByBounds: function (bounds) {    // Получить список gmxTiles по bounds
        var gmx = this._gmx,
            zoom = this._map._zoom,
            shiftX = gmx.shiftX || 0,   // Сдвиг слоя
            shiftY = gmx.shiftY || 0,   // Сдвиг слоя + OSM
            minLatLng = L.Projection.Mercator.unproject(new L.Point(bounds.min.x, bounds.min.y)),
            maxLatLng = L.Projection.Mercator.unproject(new L.Point(bounds.max.x, bounds.max.y)),
            screenBounds = this._map.getBounds(),
            sw = screenBounds.getSouthWest(),
            ne = screenBounds.getNorthEast(),
            dx = 0;

        if (ne.lng - sw.lng < 360) {
            if (maxLatLng.lng < sw.lng) {
                dx = 360 * (1 + Math.floor((sw.lng - maxLatLng.lng) / 360));
            } else if (minLatLng.lng > ne.lng) {
                dx = 360 * Math.floor((ne.lng - minLatLng.lng) / 360);
            }
        }
        minLatLng.lng += dx;
        maxLatLng.lng += dx;

        var pixelBounds = this._map.getPixelBounds(),
            minPoint = this._map.project(minLatLng),
            maxPoint = this._map.project(maxLatLng);

        var minY, maxY, minX, maxX;
        if (pixelBounds) {
            minY = Math.floor((Math.max(maxPoint.y, pixelBounds.min.y) + shiftY) / 256);
            maxY = Math.floor((Math.min(minPoint.y, pixelBounds.max.y) + shiftY) / 256);
            minX = minLatLng.lng <= -180 ? pixelBounds.min.x : Math.max(minPoint.x, pixelBounds.min.x);
            minX = Math.floor((minX + shiftX) / 256);
            maxX = maxLatLng.lng >= 180 ? pixelBounds.max.x : Math.min(maxPoint.x, pixelBounds.max.x);
            maxX = Math.floor((maxX + shiftX) / 256);
        } else {
            minY = Math.floor((maxPoint.y + shiftY) / 256);
            maxY = Math.floor((minPoint.y + shiftY) / 256);
            minX = Math.floor((minPoint.x + shiftX) / 256);
            maxX = Math.floor((maxPoint.x + shiftX) / 256);
        }
        var gmxTiles = {};
        for (var x = minX; x <= maxX; x++) {
            for (var y = minY; y <= maxY; y++) {
                var zKey = this._tileCoordsToKey({x: x, y: y}, zoom);
                gmxTiles[zKey] = true;
            }
        }
        return gmxTiles;
    },

    _updateProperties: function (prop) {
        var gmx = this._gmx,
            apikeyRequestHost = this.options.apikeyRequestHost || gmx.hostName;

        gmx.sessionKey = prop.sessionKey = this.options.sessionKey || gmxSessionManager.getSessionKey(apikeyRequestHost); //should be already received

        if (this.options.parentOptions) {
			prop = this.options.parentOptions;
		}

        gmx.identityField = prop.identityField; // ogc_fid
        gmx.GeometryType = (prop.GeometryType || '').toLowerCase();   // тип геометрий обьектов в слое
        gmx.minZoomRasters = prop.RCMinZoomForRasters || 1;// мин. zoom для растров
        gmx.minZoomQuicklooks = gmx.minZoomRasters; // по умолчанию minZoom для квиклуков и КР равны

        var type = prop.type || 'Vector';
        if (prop.Temporal) { type += 'Temporal'; }
        gmx.layerType = type;   // VectorTemporal Vector
        gmx.items = {};

        L.extend(gmx, L.gmxUtil.getTileAttributes(prop));
        if (gmx.dataManager) {
            gmx.dataManager.setOptions(prop);
        }
        if ('ZIndexField' in prop) {
            if (prop.ZIndexField in gmx.tileAttributeIndexes) {
                gmx.zIndexField = gmx.tileAttributeIndexes[prop.ZIndexField];   // sort field index
            }
        }
        if (this._objectsReorder) {
            this._objectsReorder.initialize();
        }

        // if ('clusters' in prop) {
            // gmx.clusters = prop.clusters;
        // }

        if ('MetaProperties' in gmx.rawProperties) {
            var meta = gmx.rawProperties.MetaProperties;
            if ('filter' in meta) {  // фильтр слоя
                gmx.filter = meta.filter.Value || '';
            }
            if ('dateBegin' in meta) {  // фильтр для мультивременного слоя
                gmx.dateBegin = L.gmxUtil.getDateFromStr(meta.dateBegin.Value || '01.01.1980');
            }
            if ('dateEnd' in meta) {  // фильтр для мультивременного слоя
                gmx.dateEnd = L.gmxUtil.getDateFromStr(meta.dateEnd.Value || '01.01.1980');
            }
            if ('shiftX' in meta || 'shiftY' in meta) {  // сдвиг всего слоя
                gmx.shiftXlayer = meta.shiftX ? Number(meta.shiftX.Value) : 0;
                gmx.shiftYlayer = meta.shiftY ? Number(meta.shiftY.Value) : 0;
            }
            if ('shiftXfield' in meta || 'shiftYfield' in meta) {    // поля сдвига растров объектов слоя
                if (meta.shiftXfield) { gmx.shiftXfield = meta.shiftXfield.Value; }
                if (meta.shiftYfield) { gmx.shiftYfield = meta.shiftYfield.Value; }
            }
            if ('quicklookPlatform' in meta) {    // тип спутника
                gmx.quicklookPlatform = meta.quicklookPlatform.Value;
                if (gmx.quicklookPlatform === 'image') { delete gmx.quicklookPlatform; }
            }
            if ('quicklookX1' in meta) { gmx.quicklookX1 = meta.quicklookX1.Value; }
            if ('quicklookY1' in meta) { gmx.quicklookY1 = meta.quicklookY1.Value; }
            if ('quicklookX2' in meta) { gmx.quicklookX2 = meta.quicklookX2.Value; }
            if ('quicklookY2' in meta) { gmx.quicklookY2 = meta.quicklookY2.Value; }
            if ('quicklookX3' in meta) { gmx.quicklookX3 = meta.quicklookX3.Value; }
            if ('quicklookY3' in meta) { gmx.quicklookY3 = meta.quicklookY3.Value; }
            if ('quicklookX4' in meta) { gmx.quicklookX4 = meta.quicklookX4.Value; }
            if ('quicklookY4' in meta) { gmx.quicklookY4 = meta.quicklookY4.Value; }

            if ('multiFilters' in meta) {    // проверка всех фильтров для обьектов слоя
                gmx.multiFilters = meta.multiFilters.Value === '1' ? true : false;
            }
            if ('isGeneralized' in meta) {    // Set generalization
                this.options.isGeneralized = meta.isGeneralized.Value !== 'false';
            }
            if ('isFlatten' in meta) {        // Set flatten geometry
                this.options.isFlatten = meta.isFlatten.Value !== 'false';
            }
        }
        if (prop.Temporal) {    // Clear generalization flag for Temporal layers
            this.options.isGeneralized = false;
        }

        if (prop.IsRasterCatalog) {
            gmx.IsRasterCatalog = prop.IsRasterCatalog;
            var layerLink = gmx.tileAttributeIndexes.GMX_RasterCatalogID;
            if (layerLink) {
                gmx.rasterBGfunc = function(x, y, z, item) {
                    var properties = item.properties;
                    return 'http://' + gmx.hostName
                        + '/TileSender.ashx?ModeKey=tile'
                        + '&x=' + x
                        + '&y=' + y
                        + '&z=' + z
                        + '&LayerName=' + properties[layerLink]
                        + '&key=' + encodeURIComponent(gmx.sessionKey);
                };
            }
        }
        if (prop.Quicklook) {
            var quicklookParams;

            //раньше это была просто строка с шаблоном квиклука, а теперь стало JSON'ом
            if (prop.Quicklook[0] === '{') {
                quicklookParams = JSON.parse(prop.Quicklook);
            } else {
                quicklookParams = {
                    minZoom: gmx.minZoomRasters,
                    template: prop.Quicklook
                };
            }

            if ('X1' in quicklookParams) { gmx.quicklookX1 = quicklookParams.X1; }
            if ('Y1' in quicklookParams) { gmx.quicklookY1 = quicklookParams.Y1; }
            if ('X2' in quicklookParams) { gmx.quicklookX2 = quicklookParams.X2; }
            if ('Y2' in quicklookParams) { gmx.quicklookY2 = quicklookParams.Y2; }
            if ('X3' in quicklookParams) { gmx.quicklookX3 = quicklookParams.X3; }
            if ('Y3' in quicklookParams) { gmx.quicklookY3 = quicklookParams.Y3; }
            if ('X4' in quicklookParams) { gmx.quicklookX4 = quicklookParams.X4; }
            if ('Y4' in quicklookParams) { gmx.quicklookY4 = quicklookParams.Y4; }

            var template = gmx.Quicklook = quicklookParams.template;
            if ('minZoom' in quicklookParams) { gmx.minZoomQuicklooks = quicklookParams.minZoom; }
            gmx.quicklookBGfunc = function(item) {
                var url = template,
                    reg = /\[([^\]]+)\]/,
                    matches = reg.exec(url);
                while (matches && matches.length > 1) {
                    url = url.replace(matches[0], item.properties[gmx.tileAttributeIndexes[matches[1]]]);
                    matches = reg.exec(url);
                }
                return url;
            };
            gmx.imageQuicklookProcessingHook = L.gmx.gmxImageTransform;
        }
        this.options.attribution = prop.Copyright || '';
    },

    _onVersionChange: function () {
        this._updateProperties(this._gmx.rawProperties);
    },

    getPropItem: function (key, propArr) {
        return gmxAPIutils.getPropItem(key, propArr, this._gmx.tileAttributeIndexes);
    }
});


// Single tile on screen with vector data
function ScreenVectorTile(layer, tilePoint, zoom) {
    this.layer = layer;
    this.tilePoint = tilePoint;
    this.zoom = zoom;
    this.gmx = layer._gmx;
    this.zKey = this.layer._tileCoordsToKey(tilePoint, zoom);
    var utils = gmxAPIutils;
    this.worldWidthMerc = utils.worldWidthMerc;
    var gmxTilePoint = utils.getTileNumFromLeaflet(tilePoint, zoom);
    this.tbounds = utils.getTileBounds(gmxTilePoint.x, gmxTilePoint.y, gmxTilePoint.z);
    this.tpx = 256 * gmxTilePoint.x;
    this.tpy = 256 * (1 + gmxTilePoint.y);
    this.gmxTilePoint = gmxTilePoint;

    this.showRaster =
        (zoom >= this.gmx.minZoomRasters && 'rasterBGfunc' in this.gmx) ||
        (zoom >= this.gmx.minZoomQuicklooks && 'quicklookBGfunc' in this.gmx);
    this.rasters = {}; //combined and processed canvases for each vector item in tile
    this.rasterRequests = {};   // all cached raster requests
    this._uniqueID = 0;         // draw attempt id
    this.gmx.badTiles = this.gmx.badTiles || {};
}

ScreenVectorTile.prototype = {

    //return promise, which resolves with object {gtp, image}
    _loadTileRecursive: function (gtp, urlFunction) {
        var gmx = this.gmx,
            _this = this,
            requestPromise = null,
            currentUrl,
            def = new L.gmx.Deferred(function() {
                if (requestPromise) {
                    //don't store cancelled requests in request cache
                    delete _this.rasterRequests[currentUrl];
                    requestPromise.cancel();
                }
            });

        var tryLoad = function(gtp, crossOrigin) {
            var rUrl = urlFunction(gtp);

            var tryHigherLevelTile = function() {
                if (gtp.z > 1) {
                    tryLoad({
                        x: Math.floor(gtp.x / 2),
                        y: Math.floor(gtp.y / 2),
                        z: gtp.z - 1
                    }, ''); // 'anonymous' 'use-credentials'
                } else {
                    def.reject();
                }
            };

            if (gmx.badTiles[rUrl] || (gmx.maxNativeZoom && gmx.maxNativeZoom < gtp.z)) {
                tryHigherLevelTile();
                return;
            }
            var request = _this.rasterRequests[rUrl];
            if (!request) {
                if (gmx.rasterProcessingHook) {
                    crossOrigin = 'anonymous';
                }
                request = L.gmx.imageLoader.push(rUrl, {
                    tileRastersId: _this._uniqueID,
                    zoom: _this.zoom,
                    cache: true,
                    crossOrigin: crossOrigin || ''
                });
                _this.rasterRequests[rUrl] = request;
            } else {
                request.options.tileRastersId = _this._uniqueID;
            }
            currentUrl = rUrl;
            requestPromise = request.def;

            requestPromise.then(
                function(imageObj) {
                    def.resolve({gtp: gtp, image: imageObj});
                },
                function() {
                    gmx.badTiles[rUrl] = true;
                    tryHigherLevelTile();
                }
            );
        };

        tryLoad(gtp);
        return def;
    },

    _rasterHook: function (attr) {
        var source = attr.sourceTilePoint || attr.destinationTilePoint,
            info = {
                geoItem: attr.geoItem,
                destination: {
                    z: attr.destinationTilePoint.z,
                    x: attr.destinationTilePoint.x,
                    y: attr.destinationTilePoint.y
                },
                source: {
                    z: source.z,
                    x: source.x,
                    y: source.y
                }
            };
        if (attr.url) { info.quicklook = attr.url; }
        return (this.gmx.rasterProcessingHook || this._defaultRasterHook)(
            attr.res, attr.image,
            attr.sx || 0, attr.sy || 0, attr.sw || 256, attr.sh || 256,
            attr.dx || 0, attr.dy || 0, attr.dw || 256, attr.dh || 256,
            info
        );
    },

    // default rasterHook: res - result canvas other parameters as http://www.w3schools.com/tags/canvas_drawimage.asp
    _defaultRasterHook: function (res, image, sx, sy, sw, sh, dx, dy, dw, dh) {
        var ptx = res.getContext('2d');
        ptx.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh);
    },

    // get pixels parameters for shifted object
    _getShiftPixels: function (it) {
        var w = it.dx + (it.dx < 0 ? 256 : 0),
            h = it.dy + (it.dy < 0 ? 256 : 0),
            sx = 0, sw = 256 - w, dx = w, dw = sw;
        if (it.tx > it.x) {
            sx = sw; sw = w; dx = 0; dw = sw;
        }
        if (sx === 256 || sw < 1) { return null; }

        var sy = h, sh = 256 - h, dy = 0, dh = sh;
        if (it.ty > it.y) {
            sy = 0; dy = sh; sh = h; dh = sh;
        }
        if (sy === 256 || sh < 1) { return null; }

        return {
            sx: sx, sy: sy, sw: sw, sh: sh,
            dx: dx, dy: dy, dw: dw, dh: dh
        };
    },

    // get tiles parameters for shifted object
    _getShiftTilesArray: function (bounds, shiftX, shiftY) {
        var mInPixel = this.gmx.mInPixel,
            gmxTilePoint = this.gmxTilePoint,
            px = shiftX * mInPixel,
            py = shiftY * mInPixel,
            deltaX = Math.floor(0.5 + px % 256),            // shift on tile in pixel
            deltaY = Math.floor(0.5 + py % 256),
            tileSize = 256 / mInPixel,
            tminX = gmxTilePoint.x - shiftX / tileSize,     // by screen tile
            tminY = gmxTilePoint.y - shiftY / tileSize,
            rminX = Math.floor(tminX),
            rmaxX = rminX + (tminX === rminX ? 0 : 1),
            rminY = Math.floor(tminY),
            rmaxY = rminY + (tminY === rminY ? 0 : 1),
            minX = Math.floor((bounds.min.x - shiftX) / tileSize),  // by geometry bounds
            maxX = Math.floor((bounds.max.x - shiftX) / tileSize),
            minY = Math.floor((bounds.min.y - shiftY) / tileSize),
            maxY = Math.floor((bounds.max.y - shiftY) / tileSize);

        if (rminX < minX) { rminX = minX; }
        if (rmaxX > maxX) { rmaxX = maxX; }
        if (rminY < minY) { rminY = minY; }
        if (rmaxY > maxY) { rmaxY = maxY; }

        var arr = [];
        for (var j = rminY; j <= rmaxY; j++) {
            for (var i = rminX; i <= rmaxX; i++) {
                arr.push({
                    z: gmxTilePoint.z,
                    x: i,
                    y: j,
                    dx: deltaX,
                    dy: deltaY,
                    tx: tminX,
                    ty: tminY
                });
            }
        }
        return arr;
    },

    // Loads missing rasters for single item and combines them in canvas.
    // Stores resulting canvas in this.rasters
    _getItemRasters: function (geo) {
        var properties = geo.properties,
            idr = properties[0],
            _this = this,
            gmx = this.gmx,
            indexes = gmx.tileAttributeIndexes,
            rasters = this.rasters,
            mainRasterLoader = null,
            recursiveLoaders,
            shiftX = Number(gmx.shiftXfield ? gmxAPIutils.getPropItem(gmx.shiftXfield, properties, indexes) : 0) % this.worldWidthMerc,
            shiftY = Number(gmx.shiftYfield ? gmxAPIutils.getPropItem(gmx.shiftYfield, properties, indexes) : 0),
            isShift = shiftX || shiftY,
            urlBG = gmxAPIutils.getPropItem('urlBG', properties, indexes),
            url = '',
            itemImageProcessingHook = null,
            isTiles = false,
            item = gmx.dataManager.getItem(idr),
            gmxTilePoint = this.gmxTilePoint,
            resCanvas = null,
            imageItem = null;

        if (gmx.IsRasterCatalog && (gmx.rawProperties.type === 'Raster' || gmxAPIutils.getPropItem('GMX_RasterCatalogID', properties, indexes))) {
            isTiles = true;                     // Raster Layer
        } else if (gmx.quicklookBGfunc) {
            url = gmx.quicklookBGfunc(item);    // Quicklook
            itemImageProcessingHook = gmx.imageQuicklookProcessingHook;
        } else if (urlBG) {
            url = urlBG;                        // Image urlBG from properties
            itemImageProcessingHook = gmx.imageQuicklookProcessingHook;
        }
        if (isTiles) {
            mainRasterLoader = new L.gmx.Deferred(function() {
                recursiveLoaders.forEach(function(it) {
                    it.cancel();
                });
                recursiveLoaders = null;
            });
        } else {
            url += (url.indexOf('?') === -1 ? '?' : '&') + gmx.sessionKey;  //  for browser cache from another tabs
            var request = this.rasterRequests[url];
            if (!request) {
                request = L.gmx.imageLoader.push(url, {
                    tileRastersId: _this._uniqueID,
                    crossOrigin: gmx.crossOrigin || 'anonymous'
                });
                this.rasterRequests[url] = request;
            } else {
                request.options.tileRastersId = this._uniqueID;
            }

            // in fact, we want to return request.def, but need to do additional action during cancellation.
            // so, we consctruct new promise and add pipe it with request.def
            mainRasterLoader = new L.gmx.Deferred(function() {
                //don't cache cancelled requests
                delete _this.rasterRequests[url];
                request.def.cancel();
            });
            request.def.then(mainRasterLoader.resolve, mainRasterLoader.reject);
        }
        var itemRasterPromise = new L.gmx.Deferred(function() {
            if (mainRasterLoader) {
                mainRasterLoader.cancel();
                mainRasterLoader = null;
            }
        });

        if (isTiles) {
            var dataOption = geo.dataOption || {},
                tileToLoadPoints = isShift ? this._getShiftTilesArray(dataOption.bounds, shiftX, shiftY) : [gmxTilePoint],
                cnt = tileToLoadPoints.length,
                chkReadyRasters = function() {
                    if (cnt < 1) { mainRasterLoader.resolve(); }
                },
                skipRasterFunc = function() {
                    cnt--;
                    chkReadyRasters();
                },
                urlFunction = function(gtp) {
                    return gmx.rasterBGfunc(gtp.x, gtp.y, gtp.z, item);
                },
                onLoadFunction = function(gtp, p, img) {
                    item.skipRasters = false;
                    var isImage = true;

                    if (itemImageProcessingHook) {
                        img = itemImageProcessingHook(img, {
                            gmx: gmx,
                            geoItem: geo,
                            item: item,
                            gmxTilePoint: gtp
                        });
                        isImage = false;
                    }

                    var info = {
                            geoItem: geo,
                            image: img,
                            destinationTilePoint: gmxTilePoint,
                            sourceTilePoint: gtp,
                            sx: 0, sy: 0, sw: 256, sh: 256,
                            dx: 0, dy: 0, dw: 256, dh: 256
                        };

                    if (isShift) {
                        var pos = _this._getShiftPixels(p);
                        if (pos === null) {
                            skipRasterFunc();
                            return;
                        }
                        L.extend(info, pos);
                        isImage = false;
                    }

                    if (gtp.z !== gmxTilePoint.z) {
                        var posInfo = gmxAPIutils.getTilePosZoomDelta(gmxTilePoint, gmxTilePoint.z, gtp.z);
                        if (posInfo.size < 1 / 256) {// меньше 1px
                            chkReadyRasters();
                            return;
                        }
                        isImage = false;
                        info.sx = Math.floor(posInfo.x);
                        info.sy = Math.floor(posInfo.y);
                        info.sw = info.sh = posInfo.size;
                        if (isShift) {
                            var sw = Math.floor(info.dw / posInfo.zDelta);
                            info.sx = (info.dx === 0 ? info.sw : 256) - sw;
                            info.sw = sw;

                            var sh = Math.floor(info.dh / posInfo.zDelta);
                            info.sy = (info.dy === 0 ? info.sh : 256) - sh;
                            info.sh = sh;
                        }
                    }
                    if (isImage && !gmx.rasterProcessingHook) {
                        cnt--;
                        resCanvas = img;
                        chkReadyRasters();
                    } else {
                        if (!resCanvas) {
                            resCanvas = document.createElement('canvas');
                            resCanvas.width = resCanvas.height = 256;
                        }
                        info.res = resCanvas;
                        var hookResult = _this._rasterHook(info),
                            then = function() {
                                cnt--;
                                p.resImage = resCanvas;
                                chkReadyRasters();
                            };

                        if (hookResult) {
                            if (hookResult instanceof L.gmx.Deferred) {
                                hookResult.then(then);
                            }
                        } else if (hookResult === null) {
                            item.skipRasters = true;
                            skipRasterFunc();
                        } else {
                            then();
                        }
                    }
                };
            recursiveLoaders = tileToLoadPoints.map(function(it) {
                var loader = _this._loadTileRecursive(it, urlFunction);
                loader.then(function(loadResult) {
                    onLoadFunction(loadResult.gtp, it, loadResult.image);
                }, skipRasterFunc);
                return loader;
            });

            mainRasterLoader.then(function() {
                rasters[idr] = resCanvas;
                itemRasterPromise.resolve();
            });
        } else {
            // for quicklook
            item.skipRasters = false;
            var imageLoaded = function(img) {
                var imgAttr = {
                    gmx: gmx,
                    geoItem: geo,
                    item: item,
                    gmxTilePoint: gmxTilePoint
                };
                if (!resCanvas) {
                    resCanvas = document.createElement('canvas');
                    resCanvas.width = resCanvas.height = 256;
                }
                var prepareItem = function(imageElement) {
                    var promise = _this._rasterHook({
                            geoItem: geo,
                            res: resCanvas,
                            image: itemImageProcessingHook ? itemImageProcessingHook(imageElement, imgAttr) : imageElement,
                            destinationTilePoint: gmxTilePoint,
                            url: url
                        }),
                        then = function() {
                            rasters[idr] = resCanvas;
                            itemRasterPromise.resolve();
                        };
                    if (promise) {
                        if (promise instanceof L.gmx.Deferred) {
                            promise.then(then);
                        }
                    } else if (promise === null) {
                        item.skipRasters = true;
                        itemRasterPromise.resolve();
                    } else {
                        then();
                    }
                };
                prepareItem(img);
                delete _this.rasterRequests[url];
            };
            if (imageItem) {
                imageLoaded(imageItem);
            } else {
                mainRasterLoader.then(imageLoaded.bind(this), itemRasterPromise.resolve);
            }
        }
        itemRasterPromise.always(function() {
            mainRasterLoader = null;
            if (recursiveLoaders) {
                recursiveLoaders = null;
            }
        });
        return itemRasterPromise;
    },

    _getVisibleItems: function (geoItems) {
        if (geoItems.length < 2) {
            return geoItems;
        }
        if (!gmxAPIutils._tileCanvas) {
            gmxAPIutils._tileCanvas = document.createElement('canvas');
            gmxAPIutils._tileCanvas.width = gmxAPIutils._tileCanvas.height = 256;
        }
        var i, len,
            gmx = this.gmx,
            dm = gmx.dataManager,
            canvas = gmxAPIutils._tileCanvas,
            ctx = canvas.getContext('2d'),
            dattr = {
                tbounds: this.tbounds,
                gmx: gmx,
                tpx: this.tpx,
                tpy: this.tpy,
                ctx: ctx
            };
        ctx.clearRect(0, 0, 256, 256);
        ctx.imageSmoothingEnabled = false;
        for (i = 0, len = geoItems.length; i < len; i++) {
            ctx.fillStyle = gmxAPIutils.dec2rgba(i + 1, 1);
            var geoItem = geoItems[i];
            L.gmxUtil.drawGeoItem(
                geoItem,
                dm.getItem(geoItem.properties[0]),
                dattr,
                {fillStyle: ctx.fillStyle}
            );
        }
        var items = {},
            data = ctx.getImageData(0, 0, 256, 256).data;

        for (i = 0, len = data.length; i < len; i += 4) {
            if (data[i + 3] === 255) {
                var color = data[i + 2];
                if (data[i + 1]) { color += (data[i + 1] << 8); }
                if (data[i]) { color += (data[i] << 16); }
                if (color) { items[color] = true; }
            }
        }
        var out = [];
        for (var num in items) {
            var it = geoItems[Number(num) - 1];
            if (it) { out.push(it); }
        }
        return out;
    },

    _getNeedRasterItems: function (geoItems) {
        var gmx = this.gmx,
            indexes = gmx.tileAttributeIndexes,
            tbounds = this.tbounds,
            out = [];
        for (var i = 0, len = geoItems.length; i < len; i++) {
            var geo = geoItems[i],
                properties = geo.properties,
                idr = properties[0],
                dataOption = geo.dataOption || {},
                skipRasters = false;

            if (gmx.quicklookBGfunc && !gmxAPIutils.getPropItem('GMX_RasterCatalogID', properties, indexes)) {
                if (gmx.minZoomQuicklooks && this.zoom < gmx.minZoomQuicklooks) { continue; }
                var platform = gmxAPIutils.getPropItem(gmx.quicklookPlatform, properties, indexes) || gmx.quicklookPlatform || '';
                if ((!platform || platform === 'imageMercator') &&
                    !gmxAPIutils.getQuicklookPointsFromProperties(properties, gmx)
                ) {
                    continue;
                }
            }

            if (gmx.styleHook) {
                geo.styleExtend = gmx.styleHook(
                    gmx.dataManager.getItem(idr),
                    gmx.lastHover && idr === gmx.lastHover.id
                );
                skipRasters = geo.styleExtend && geo.styleExtend.skipRasters;
            }
            if (!skipRasters && tbounds.intersectsWithDelta(dataOption.bounds, -1, -1)) {
                out.push(geo);
            }
        }
        return this._getVisibleItems(out);
    },

    _getTileRasters: function (geoItems) {   //load all missing rasters for items we are going to render
        var itemPromises = [],
            def = new L.gmx.Deferred(function() {
                itemPromises.forEach(function(promise) {
                    promise.cancel();
                });
                itemPromises = null;
            }),
            itemRasters = this._getNeedRasterItems(geoItems),
            needLoadRasters = itemRasters.length;

        if (needLoadRasters) {
            var _this = this,
                chkReadyRasters = function() {
                    if (needLoadRasters < 1) {
                        def.resolve();
                    }
                };
            itemRasters.forEach(function (geo) {
                var itemRasterPromise = _this._getItemRasters(geo);
                itemRasterPromise.then(function() {
                    needLoadRasters--;
                    chkReadyRasters();
                });
                itemPromises.push(itemRasterPromise);
            });
        } else {
            def.resolve();
        }
        return def;
    },

    _chkItems: function (data) {
        var layer = this.layer;
        if (!layer._map) {
            return null;
        }
        var items = data && data.added && data.added.length ? data.added : null;

        if (!items) {
            var tLink = layer._tiles[this.zKey];
            if (tLink && tLink.el) {
                tLink.el.getContext('2d').clearRect(0, 0, 256, 256);
            }
            return null;
        }
        return this.gmx.sortItems ? layer.getSortedItems(items) : items;
    },

    _cancelRastersPromise: function () {
        if (this.rastersPromise) {
            this.rastersPromise.cancel();
            this.rastersPromise = null;
        }
    },

    drawTile: function (data) {
        var drawPromise = this.currentDrawPromise,
            _this = this;

        this._uniqueID++;       // count draw attempt

        if (drawPromise) {
            this._cancelRastersPromise();
            if (this._preRenderPromise) {
                this._preRenderPromise.cancel();        // cancel preRenderHooks chain if exists
            }
            if (this._renderPromise) {
                this._renderPromise.cancel();           // cancel renderHooks chain if exists
            }
            drawPromise.reject();
        }
        drawPromise = new L.gmx.Deferred(this._cancelRastersPromise.bind(this));
        drawPromise.always(function() {
            _this._drawDone();
            _this.currentDrawPromise = null;
            _this.rastersPromise = null;
            _this._preRenderPromise = null;
            _this._renderPromise = null;
        });

        this.currentDrawPromise = drawPromise;

        var geoItems = this._chkItems(data);
        if (!geoItems) {
            drawPromise.resolve();
            return drawPromise;
        }
        var tileLink = this.layer.gmxGetCanvasTile(this.tilePoint),
            tile = tileLink.el,
            ctx = tile.getContext('2d'),
            gmx = this.gmx,
            dattr = {
                tbounds: this.tbounds,
                rasters: this.rasters,
                gmx: gmx,
                tpx: this.tpx,
                tpy: this.tpy,
                ctx: ctx
            };
        tile.zKey = tileLink.el._zKey = this.zKey;

        var doDraw = function() {
            ctx.clearRect(0, 0, 256, 256);
            var hookInfo = {
                    tpx: _this.tpx,
                    tpy: _this.tpy,
                    x: _this.tilePoint.x,
                    y: _this.tilePoint.y,
                    z: _this.zoom
                },
                bgImage = null;

            _this._preRenderPromise = new L.gmx.Deferred();
            _this._preRenderPromise.resolve(bgImage);

            gmx.preRenderHooks.forEach(function (f) {
                _this._preRenderPromise = _this._preRenderPromise.then(function(hookBgImage) {

                    //in-place modifications are possible
                    bgImage = hookBgImage || bgImage;

                    if (!bgImage) {
                        bgImage = document.createElement('canvas');
                        bgImage.width = bgImage.height = 256;
                    }
                    return f(bgImage, hookInfo);
                });
            });
            _this._preRenderPromise.then(function(hookBgImage) {
                bgImage = hookBgImage || bgImage;
                if (bgImage) { dattr.bgImage = bgImage; }
                //ctx.save();
                for (var i = 0, len = geoItems.length; i < len; i++) {
                    var geoItem = geoItems[i],
                        id = geoItem.id,
                        item = gmx.dataManager.getItem(id);
                    if (item) {     // skip removed items   (bug with screen tile screenTileDrawPromise.cancel on hover repaint)
                        var style = gmx.styleManager.getObjStyle(item),
                            hover = gmx.lastHover && gmx.lastHover.id === geoItem.id && style;

                        if (gmx.multiFilters) {
                            for (var j = 0, len1 = item.multiFilters.length; j < len1; j++) {
                                var it = item.multiFilters[j];
                                L.gmxUtil.drawGeoItem(geoItem, item, dattr, hover ? it.parsedStyleHover : it.parsedStyle, it.style);
                            }
                        } else {
                            L.gmxUtil.drawGeoItem(geoItem, item, dattr, hover ? item.parsedStyleHover : item.parsedStyleKeys, style);
                        }
                        if (id in gmx._needPopups && !gmx._needPopups[id]) {
                            gmx._needPopups[id] = true;
                        }
                    }
                }
                //ctx.restore();
                _this.rasters = {}; // clear rasters
                if (_this.layer._map && !tile.parentNode) {
                    _this.layer.appendTileToContainer(tile);
                }
                //async chain
                _this._renderPromise = new L.gmx.Deferred();
                _this._renderPromise.resolve(tile);
                gmx.renderHooks.forEach(function (f) {
                    _this._renderPromise = _this._renderPromise.then(function(hookTile) {
                        tile = hookTile || tile;
                        return f(tile, hookInfo);
                    });
                });
                _this._renderPromise.then(drawPromise.resolve, drawPromise.reject);
            }, drawPromise.reject);
        };

        if (this.showRaster) {
            this.rastersPromise = this._getTileRasters(geoItems);
            this.rastersPromise.then(doDraw, drawPromise.reject); //first load all raster images, then render all of them at once
        } else {
            doDraw();
        }

        return drawPromise;
    },

    destructor: function () {
        this._cancelRastersPromise();
        this._clearCache();

        this.currentDrawPromise && this.currentDrawPromise.reject();
    },

    _drawDone: function () {
        for (var url in this.rasterRequests) {
            var req = this.rasterRequests[url];
            if (this._uniqueID !== req.options.tileRastersId) {
                req.remove();
                delete this.rasterRequests[url];
            }
        }
        // this.layer.fire('tiledrawdone', {zKey: this.zKey});
    },

    _clearCache: function () {
        for (var url in this.rasterRequests) {
            this.rasterRequests[url].remove();
        }
        this.rasterRequests = {};
    }
};


/*
 * ObjectsReorder  - Reorder objects in Gemixer layer
 */
(function() {

var MAX = 1000000,
    ObjectsReorder = function (layer) {
        this.all = {};
        this.userSetSortFunc = false;     // user sort func flag
        this.sortFunc = null;
        this.count = 0;
        this.disabled = false;
        this.layer = layer;
        layer.on('add', this.onAdd, this);
        layer.on('remove', this.onRemove, this);
    };
    ObjectsReorder.prototype = {
        addToReorder: function (id, bottomFlag) {
            ++this.count;
            this.all[id] = bottomFlag ? -this.count : this.count;
        },
        clickFunc: function (ev) {
            if (!this.disabled) {
                var id = ev.gmx.id;
                this.addToReorder(id, ev.originalEvent.ctrlKey);
                this.layer.redrawItem(id);
            }
        },
        sortItems: function(a, b) {     // layer context
            var reorder = this._objectsReorder;
            if (reorder.count > 0) {
                var ap = reorder.all[a.id],
                    bp = reorder.all[b.id];

                if (ap || bp) {
                    ap = ap ? ap + (ap > 0 ? MAX : -MAX) : 0;
                    bp = bp ? bp + (bp > 0 ? MAX : -MAX) : 0;
                    return ap - bp;
                }
            }
            return reorder.sortFunc ? reorder.sortFunc.call(this, a, b) : 0;
        },
        resetSortFunc: function () {
            var layer = this.layer,
                gmx = layer._gmx,
                zIndexField = gmx.zIndexField;
            gmx.sortItems = this.sortItems;
            this.sortFunc = (zIndexField && !this.userSetSortFunc ?
                function(a, b) {    // layer context
                    var res = Number(a.properties[zIndexField]) - Number(b.properties[zIndexField]);
                    return res ? res : a.id - b.id;
                }
                :
                function(a, b) {
                    return a.id - b.id;
                }
            );
        },
        initialize: function () {
            var gmx = this.layer._gmx;
            if (!this.userSetSortFunc && (gmx.GeometryType === 'polygon' || gmx.GeometryType === 'linestring')) {
                this.resetSortFunc();
            }
        },
        onAdd: function () {
            this.initialize();
            this.layer.on('click', this.clickFunc, this);
        },
        onRemove: function () {
            this.layer.off('click', this.clickFunc, this);
        }
    };

L.gmx.VectorLayer.include({
    _objectsReorder: null,

    _objectsReorderInit: function () {
        if (!this._objectsReorder) {
            this._objectsReorder = new ObjectsReorder(this);
        }
    },

    getReorderArrays: function () {
        var out = {top: [], bottom: []};
        if (this._objectsReorder) {
            var reorder = this._objectsReorder,
                arr = Object.keys(reorder.all).sort(function(a, b) {
                    return reorder.all[a] - reorder.all[b];
                });

            for (var i = 0, len = arr.length; i < len; i++) {
                var id = arr[i];
                if (reorder.all[id] > 0) {
                    out.top.push(id);
                } else {
                    out.bottom.push(id);
                }
            }
        }
        return out;
    },

    bringToTopItem: function (id) {
        this._objectsReorderInit();
        this._objectsReorder.addToReorder(id);
        this.redrawItem(id);
        return this;
    },

    bringToBottomItem: function (id) {
        this._objectsReorderInit();
        this._objectsReorder.addToReorder(id, true);
        this.redrawItem(id);
        return this;
    },

    clearReorderArrays: function () {
        if (this._objectsReorder) {
            var reorder = this._objectsReorder;
            reorder.all = {};
            reorder.count = 0;
            this.repaint();
        }
        return this;
    },

    setReorderArrays: function (top, bottom) {
        this._objectsReorderInit();
        var reorder = this._objectsReorder;
        reorder.all = {};
        reorder.count = 0;
        bottom.forEach(function (id) { reorder.addToReorder(id, true); });
        top.forEach(function (id) { reorder.addToReorder(id); });
        this.repaint();
        return this;
    },

    getSortedItems: function (arr) {
        this._objectsReorderInit();
        return arr.sort(L.bind(this._objectsReorder.count > 0 ? this._gmx.sortItems : this._objectsReorder.sortFunc, this));
    },

    setSortFunc: function (func) {
        this._objectsReorderInit();
        var reorder = this._objectsReorder;
        reorder.sortFunc = func;
        reorder.userSetSortFunc = func ? true : false;
        this._gmx.sortItems = reorder.sortItems;
        this.repaint();
        return this;
    },
    disableFlip: function() {
        this._objectsReorderInit();
        this._objectsReorder.disabled = true;
        return this;
    },
    enableFlip: function() {
        this._objectsReorderInit();
        this._objectsReorder.disabled = false;
        return this;
    }
});
})();


var StyleManager = function(gmx) {
    this.gmx = gmx;
    this.deferred = new L.gmx.Deferred();

    this._maxVersion = 0;
    this._maxStyleSize = 0;
    this._styles = [];
    this._deferredIcons = [];
    this._parserFunctions = {};
    this._serverStylesParsed = false;

    var minZoom = Infinity,
        maxZoom = -Infinity,
        arr = gmx.properties.styles || [];

    for (var i = 0, len = arr.length; i < len; i++) {
        var st = arr[i];
        minZoom = Math.min(minZoom, st.MinZoom);
        maxZoom = Math.max(maxZoom, st.MaxZoom);
    }
    this.minZoom = minZoom === Infinity ? 0 : minZoom;
    this.maxZoom = maxZoom === -Infinity ? 18 : maxZoom;
};
StyleManager.prototype = {
    _getMaxStyleSize: function(zoom) {  // estimete style size for arbitrary object
        var maxSize = 0;
        for (var i = 0, len = this._styles.length; i < len; i++) {
            var style = this._styles[i];
            if (zoom > style.MaxZoom || zoom < style.MinZoom) { continue; }
            var RenderStyle = style.RenderStyle;
            // if (this._needLoadIcons || !RenderStyle || !RenderStyle.common || !('maxSize' in RenderStyle)) {
            if (this._needLoadIcons || !RenderStyle || !('maxSize' in RenderStyle)) {
                maxSize = StyleManager.MAX_STYLE_SIZE;
                break;
            }
            var maxShift = 0;
            if ('iconAnchor' in RenderStyle && !RenderStyle.iconCenter) {
                maxShift = Math.max(
                    Math.abs(RenderStyle.iconAnchor[0]),
                    Math.abs(RenderStyle.iconAnchor[1])
                );
            }
            maxSize = Math.max(RenderStyle.maxSize + maxShift, maxSize);
        }
        return maxSize;
    },

    getStyleBounds: function(gmxTilePoint) {
        if (!gmxTilePoint) {
            return gmxAPIutils.bounds();
        }

        this._maxStyleSize = this._getMaxStyleSize(this.gmx.currentZoom);

        var mercSize = 2 * this._maxStyleSize * gmxAPIutils.tileSizes[gmxTilePoint.z] / 256; //TODO: check formula
        return gmxAPIutils.getTileBounds(gmxTilePoint.x, gmxTilePoint.y, gmxTilePoint.z).addBuffer(mercSize);
    },

    //is any style is visible at given zoom?
    isVisibleAtZoom: function(zoom) {
        for (var i = 0, len = this._styles.length; i < len; i++) {
            var style = this._styles[i];
            if (zoom >= style.MinZoom && zoom <= style.MaxZoom) {
                return true;
            }
        }
        return false;
    },

    getIcons: function(callback) {
        var _this = this;
        this.deferred.then(function() {
            var out = [];
            for (var i = 0, len = _this._styles.length; i < len; i++) {
                var style = _this._styles[i],
                    pt = {};
                if (style.RenderStyle) {
                    pt.RenderStyle = {image: style.RenderStyle.image};
                }
                if (style.HoverStyle) {
                    pt.HoverStyle = {image: style.HoverStyle.image};
                }
                out.push(pt);
            }
            if (callback) {
                callback(out);
            }
        });
        this.initStyles();
    },

    _chkReady: function() {
        if (this._needLoadIcons < 1) {
            var _this = this;
			if (this.gmx.dataManager) {
				this.gmx.dataManager.addFilter('styleFilter', function(it) { return _this._chkStyleFilter(it); });
			}
            this.deferred.resolve();
        }
    },

    initStyles: function() {
        if (!this._serverStylesParsed) {
            this._parseServerStyles();
        }
        for (var i = 0, len = this._deferredIcons.length; i < len; i++) {
            this._getImageSize(this._deferredIcons[i]);
        }
        this._deferredIcons = [];
        this._chkReady();
        return this.deferred;
    },

    getStyles: function () {
        if (!this._serverStylesParsed) {
            this._parseServerStyles();
        }
        var out = [];
        for (var i = 0, len = this._styles.length; i < len; i++) {
            var style = L.extend({}, this._styles[i]);
            style.RenderStyle = StyleManager.getStyleKeys(style.RenderStyle);
            if (style.HoverStyle) {
                style.HoverStyle = StyleManager.getStyleKeys(style.HoverStyle);
            }
            delete style.filterFunction;
            delete style.version;
            delete style.common;
            delete style.type;
            out.push(style);
        }
        return out;
    },

    clearStyles: function () {
        this._styles = [];
        this.gmx.balloonEnable = false;
        this.gmx.labelsLayer = false;
    },

    _changeStylesVersion: function () {
        var _this = this;
        this._styles.map(function(it) {
            it.version = ++_this._maxVersion;
        });
    },

    setStyle: function(st, num, createFlag) {
        num = num || 0;
        if (num < this._styles.length || createFlag) {
            var style = this._styles[num];
            if (!style) {
                style = this._prepareItem({});
                this._styles[num] = style;
            }
            this.deferred = new L.gmx.Deferred();
            style.version = ++this._maxVersion;
            if ('Filter' in st) {
                style.Filter = st.Filter;
                var type = typeof (st.Filter);
                style.filterFunction = type === 'string' ? L.gmx.Parsers.parseSQL(style.Filter.replace(/[\[\]]/g, '"'))
                    : type === 'function' ? style.Filter : null;

                this._changeStylesVersion();
            }
            for (var i = 0, len = StyleManager.DEFAULT_KEYS.length; i < len; i++) {
                var key = StyleManager.DEFAULT_KEYS[i];
                if (key in st) { style[key] = st[key]; }
            }
            if (st.RenderStyle) {
                style.RenderStyle = this._parseStyle(st.RenderStyle);
            }
            if (st.HoverStyle) { style.HoverStyle = this._parseStyle(st.HoverStyle, style.RenderStyle); }
            this._checkStyles();
        }
        return this.initStyles();
    },

    getItemBalloon: function(id) {
        var item = this.gmx.dataManager.getItem(id),
            currentFilter = item ? item.currentFilter : 0,
            style = this._styles[currentFilter];
        return style ? {
                DisableBalloonOnMouseMove: style.DisableBalloonOnMouseMove || false,
                DisableBalloonOnClick: style.DisableBalloonOnClick || false,
                templateBalloon: style.Balloon || null,
                isSummary: /\[SUMMARY\]/.test(style.Balloon)
            }
            : null
        ;
    },

    // apply styleHook func
    // applyStyleHook: function(item, hoverFlag) {
        // return this._itemStyleParser(item, this.gmx.styleHook(item, hoverFlag));
    // },

    getObjStyle: function(item) {
        this._chkStyleFilter(item);
        var style = this._styles[item.currentFilter],
            version;

        if (!style) { return null; }
        if (style.hoverDiff && this.gmx.lastHover && item.id === this.gmx.lastHover.id) {
            if (style.HoverStyle) {
                version = style.HoverStyle.version || -1;
                if (version !== item.styleVersion) {
                    item.parsedStyleHover = this._itemStyleParser(item, style.HoverStyle);
                }
                return style.HoverStyle;
            } else {
                delete item.parsedStyleHover;
            }
            return null;
        }
        version = style.version || -1;
        if (version !== item.styleVersion) {
            item.parsedStyleKeys = this._itemStyleParser(item, style.RenderStyle);
        }
        return style.RenderStyle;
    },

    _needLoadIcons: 0,
    _getImageSize: function(pt) {     // check image size
        var url = pt.iconUrl || pt.fillIconUrl,
            opt = pt.iconAngle || pt.iconScale ? {crossOrigin: 'anonymous'} : {},
            _this = this;

        if (L.gmxUtil.isIE11 && /\.svg$/.test(url)) {
            opt = {};   // skip bug in IE11
        }
        opt.layerID = this.gmx.layerID;
        ++this._needLoadIcons;
        L.gmx.imageLoader.unshift(url, opt).def.then(
            function(it) {
                pt.version = ++_this._maxVersion;
                if (pt.fillIconUrl) {
                    pt.imagePattern = it;
                } else {
                    var w = it.width,
                        h = it.height;
                    if (L.gmxUtil.isIE11 && /\.svg$/.test(url)) {   // skip bug in IE11
                        document.body.appendChild(it);
                        w = it.offsetWidth;
                        h = it.offsetHeight;
                        document.body.removeChild(it);
                    }
                    pt.sx = w;
                    pt.sy = h;
                    pt.image = it;
                    var maxSize = pt.iconAngle ? Math.sqrt(pt.sx * pt.sx + pt.sy * pt.sy) : Math.max(pt.sx, pt.sy);
                    if (!pt.scaleFunction && !pt.rotateFunction) {
                        if (pt.iconScale || pt.iconScale === 1) { maxSize *= pt.iconScale; }
                        pt.common = true;
                    }
                    pt.maxSize = Number(maxSize.toFixed());
                }
                _this._needLoadIcons--;
                _this._chkReady();
            },
            function() {
                pt.version = ++_this._maxVersion;
                pt.sx = 1;
                pt.sy = 0;
                pt.image = null;
                _this._needLoadIcons--;
                _this._chkReady();
                console.log({url: url, func: '_getImageSize', Error: 'image not found'});
            }
        );
    },

    getCurrentFilters: function(propArray, zoom) {
        var gmx = this.gmx,
            indexes = gmx.tileAttributeIndexes,
            types = gmx.tileAttributeTypes,
            z = zoom || 1,
            out = [];

        if (!this._serverStylesParsed) {
            this._parseServerStyles();
        }
        for (var i = 0, len = this._styles.length; i < len; i++) {
            var st = this._styles[i];
            if (z > st.MaxZoom || z < st.MinZoom
                || (st.filterFunction && !st.filterFunction(propArray, indexes, types))) {
                continue;
            }
            out.push(i);
            if (!gmx.multiFilters) { break; }
        }
        return out;
    },

    _chkStyleFilter: function(item) {
        var gmx = this.gmx,
            zoom = gmx.currentZoom,
            fnum = gmx.multiFilters ? -1 : item.currentFilter,
            curr = this._styles[fnum],
            needParse = !curr || curr.version !== item.styleVersion;

        if (needParse || item._lastZoom !== zoom) {
            item.currentFilter = -1;
            item.multiFilters = [];
            var filters = this.getCurrentFilters(item.properties, zoom);
            for (var i = 0, len = filters.length; i < len; i++) {
                var num = filters[i],
                    st = this._styles[num];
                item.hoverDiff = st.hoverDiff;
                item.currentFilter = num;
                if (needParse || fnum !== num) {
                    var parsed = st.common && st.common.RenderStyle || this._itemStyleParser(item, st.RenderStyle),
                        parsedHover = null;

                    item.parsedStyleKeys = parsed;
                    if (st.HoverStyle) {
                        parsedHover = st.common && st.common.HoverStyle || this._itemStyleParser(item, st.HoverStyle);
                        item.parsedStyleHover = parsedHover;
                    }
                    if (gmx.multiFilters) {
                        item.multiFilters.push({
                            style: st.RenderStyle,
                            styleHover: st.HoverStyle,
                            parsedStyle: parsed,
                            parsedStyleHover: parsedHover
                        });
                    }
                }
                item.styleVersion = st.version;
                if (!gmx.multiFilters) { break; }
            }
            item._lastZoom = zoom;
        }
        if (this._styles[item.currentFilter]) {
            return true;
        } else {
            item.currentFilter = -1;
            return false;
        }
    },

    _parseServerStyles: function() {
        var gmx = this.gmx,
            props = gmx.properties,
            arr = props.styles || [{MinZoom: 1, MaxZoom: 21, RenderStyle: StyleManager.DEFAULT_STYLE}],
            len = Math.max(arr.length, gmx.styles.length);

        for (var i = 0; i < len; i++) {
            if (!this._styles[i]) {
                var gmxStyle = gmx.styles[i] || arr[i];
                if (!gmxStyle.RenderStyle) { gmxStyle.RenderStyle = StyleManager.DEFAULT_STYLE; }
                if (gmxStyle.HoverStyle === undefined) {
                    var hoveredStyle = JSON.parse(JSON.stringify(gmxStyle.RenderStyle));
                    if (hoveredStyle.outline) { hoveredStyle.outline.thickness += 1; }
                    gmxStyle.HoverStyle = hoveredStyle;
                } else if (gmxStyle.HoverStyle === null) {
                    delete gmxStyle.HoverStyle;
                }
                var pt = this._prepareItem(gmxStyle);
                this._styles.push(pt);
                if (this._isLabel(pt.RenderStyle)) { gmx.labelsLayer = true; }
            }
        }
        this._checkStyles();
        this._serverStylesParsed = true;
    },

    _checkStyles: function() {
        var minZoom = Infinity,
            maxZoom = -Infinity,
            balloonEnable = false,
            labelsLayer = false;

        for (var i = 0, len = this._styles.length; i < len; i++) {
            var st = this._styles[i];

            st.DisableBalloonOnMouseMove = st.DisableBalloonOnMouseMove === false ? false : true;
            st.DisableBalloonOnClick = st.DisableBalloonOnClick || false;
            if (st.DisableBalloonOnMouseMove === false || st.DisableBalloonOnClick === false) {
                balloonEnable = true;
                st.BalloonEnable = true;
            }
            st.hoverDiff = null;
            st.common = {};
            if (st.RenderStyle) {
                if (!labelsLayer) {
                    if (this._isLabel(st.RenderStyle)) {
                        labelsLayer = true;
                    }
                }
                if (st.RenderStyle.common) {
                    st.common.RenderStyle = this._itemStyleParser({}, st.RenderStyle);
                }
                if (st.HoverStyle) {
                    st.hoverDiff = StyleManager.checkDiff(st.RenderStyle, st.HoverStyle);
                }
            }
            if (st.HoverStyle && st.HoverStyle.common) {
                st.common.HoverStyle = this._itemStyleParser({}, st.HoverStyle);
            }
            minZoom = Math.min(minZoom, st.MinZoom);
            maxZoom = Math.max(maxZoom, st.MaxZoom);
        }
        if (this.minZoom !== Infinity) { this.minZoom = minZoom; }
        if (this.maxZoom !== -Infinity) { this.maxZoom = maxZoom; }
        this.gmx.balloonEnable = balloonEnable;
        this.gmx.labelsLayer = labelsLayer;
    },

    _parseStyle: function(st, renderStyle) {
        if (st) {
            st.common = true;
            for (var key in st) {
                if (gmxAPIutils.styleFuncKeys[key]) {
                    var fkey = gmxAPIutils.styleFuncKeys[key],
                        val = st[key];
                    if (typeof (val) === 'string') {
                        st.common = false;
                        if (renderStyle && renderStyle[key] === val) {
                            st[fkey] = renderStyle[fkey];
                        } else {
                            if (!this._parserFunctions[val]) {
                                this._parserFunctions[val] = L.gmx.Parsers.parseExpression(val);
                            }
                            st[fkey] = this._parserFunctions[val];
                        }
                    } else if (typeof (val) === 'function') {
                        st.common = false;
                        st[fkey] = val;
                    }
                }
            }

            var type = '';
            if ('iconUrl' in st) {
                type = 'image';
                if (st.iconUrl) {
                    st.maxSize = 256;
                    this._deferredIcons.push(st);
                }
            } else if (st.fillIconUrl) {
                type = 'square';
                this._deferredIcons.push(st);
            } else if (st.fillPattern) {
                type = 'square';
                st.common = StyleManager.parsePattern(st.fillPattern);
                st.canvasPattern = gmxAPIutils.getPatternIcon(null, st);
            } else if (st.iconCircle) {
                type = 'circle';
                if (!('iconSize' in st)) { st.iconSize = 4; }
            } else if (st.iconPath) {
                type = 'iconPath';
                var iconSize = 0,
                    arr = L.Util.isArray(st.iconPath) ? st.iconPath : StyleManager.DEFAULT_ICONPATH;
                st.iconPath = StyleManager.DEFAULT_ICONPATH.map(function(it, i) {
                    var z = arr[i] || it;
                    iconSize = Math.max(iconSize, z);
                    return z;
                });
                st.iconSize = 2 * iconSize;
            } else if (st.fillRadialGradient) {
                type = 'circle';
                if (!('iconCenter' in st)) { st.iconCenter = true; }
                var size = StyleManager.parseRadialGradient(st.fillRadialGradient);
                if (size === null) {
                    st.common = false;
                } else {
                    st.iconSize = size;
                }
            } else if (st.fillLinearGradient) {
                type = 'square';
                st.common = StyleManager.parseLinearGradient(st.fillLinearGradient);
            } else if (st.iconSize) {
                type = 'square';
                if (!('iconCenter' in st)) { st.iconCenter = true; }
            }
            st.type = type;
            if (st.common && !st.maxSize) {
                st.maxSize = st.iconSize || 0;
                st.maxSize += st.weight ? st.weight : 0;
                if ('iconScale' in st) { st.maxSize *= st.iconScale; }
            }
        }
        return st;
    },

    _prepareItem: function(style) { // Style Scanex->leaflet
        var pt = {
            MinZoom: style.MinZoom || 0,
            MaxZoom: style.MaxZoom || 18,
            Filter: style.Filter || null,
            Balloon: style.Balloon || '',
            RenderStyle: (style.RenderStyle ? this._parseStyle(L.gmxUtil.fromServerStyle(style.RenderStyle)) : {}),
            version: ++this._maxVersion
        };
        pt.DisableBalloonOnMouseMove = style.DisableBalloonOnMouseMove === false ? false : true;
        pt.DisableBalloonOnClick = style.DisableBalloonOnClick || false;
        if (style.HoverStyle) {
            pt.HoverStyle = this._parseStyle(L.gmxUtil.fromServerStyle(style.HoverStyle), pt.RenderStyle);
        }

        if ('Filter' in style) {
            var ph = L.gmx.Parsers.parseSQL(style.Filter.replace(/[\[\]]/g, '"'));
            if (ph) { pt.filterFunction = ph; }
        }
        return pt;
    },

    _isLabel: function(st) {
        var indexes = this.gmx.tileAttributeIndexes;
        return (st && (st.labelTemplate || (st.labelField && st.labelField in indexes)));
    },

    _itemStyleParser: function(item, pt) {
        pt = pt || {};
        var out = {}, arr, i, len,
            indexes = this.gmx.tileAttributeIndexes,
            prop = item.properties || {},
            itemType = item.type,
            type = pt.type,
            color = 'color' in pt ? pt.color : 255,
            opacity = 'opacity' in pt ? pt.opacity : 1;

        out.sx = pt.sx;
        out.sy = pt.sy;
        if (pt.maxSize) {
            out.maxSize = pt.maxSize;
        }
        if (pt.iconAngle) {
            var rotateRes = pt.iconAngle || 0;
            if (rotateRes && typeof (rotateRes) === 'string') {
                rotateRes = (pt.rotateFunction ? pt.rotateFunction(prop, indexes) : 0);
            }
            out.rotate = rotateRes || 0;
        }
        if ('iconColor' in pt) {
            out.iconColor = 'iconColorFunction' in pt ? pt.iconColorFunction(prop, indexes) : pt.iconColor;
        }
        if ('iconScale' in pt) {
            out.iconScale = 'scaleFunction' in pt ? (pt.scaleFunction ? pt.scaleFunction(prop, indexes) : 1) : pt.iconScale;
        }
        if (type === 'image') {
            out.type = type;
            if (pt.iconUrl) { out.iconUrl = pt.iconUrl; }
            if (pt.image) { out.image = pt.image; }
        } else if (pt.fillRadialGradient) {
            var rgr = pt.fillRadialGradient,
                r1 = (rgr.r1Function ? rgr.r1Function(prop, indexes) : rgr.r1),
                r2 = (rgr.r2Function ? rgr.r2Function(prop, indexes) : rgr.r2),
                x1 = (rgr.x1Function ? rgr.x1Function(prop, indexes) : rgr.x1),
                y1 = (rgr.y1Function ? rgr.y1Function(prop, indexes) : rgr.y1),
                x2 = (rgr.x2Function ? rgr.x2Function(prop, indexes) : rgr.x2),
                y2 = (rgr.y2Function ? rgr.y2Function(prop, indexes) : rgr.y2);
            if (rgr.r2max) {
                r2 = Math.min(r2, rgr.r2max);
            }
            var colorStop = [];
            len = rgr.addColorStop.length;
            if (!rgr.addColorStopFunctions) {
                rgr.addColorStopFunctions = new Array(len);
            }
            for (i = 0; i < len; i++) {
                arr = rgr.addColorStop[i];
                var arrFunc = rgr.addColorStopFunctions[i] || [],
                    p0 = (arrFunc[0] ? arrFunc[0](prop, indexes) : arr[0]),
                    p3 = arr[3];
                if (arr.length < 4) {
                    var op = arr.length < 3 ? 1 : arrFunc[2] ? arrFunc[2](prop, indexes) : arr[2];
                    p3 = gmxAPIutils.dec2color(arrFunc[1] ? arrFunc[1](prop, indexes) : arr[1], op);
                 }
                colorStop.push([p0, p3]);
            }
            out.maxSize = out.sx = out.sy = out.iconSize = r2;
            out.fillRadialGradient = {
                x1:x1, y1:y1, r1:r1, x2:x2, y2:y2, r2:r2,
                addColorStop: colorStop
            };
            out._radialGradientParsed = {
                create: [x1, y1, r1, x2, y2, r2],
                colorStop: colorStop
            };
        } else if (pt.fillLinearGradient) {
            out.fillLinearGradient = pt.fillLinearGradient;
        } else {
            if (pt.fillPattern) {
                out.canvasPattern = (pt.canvasPattern ? pt.canvasPattern : gmxAPIutils.getPatternIcon(item, pt, indexes));
            }

            if (type === 'iconPath') {
                out.type = type;
                out.iconPath = pt.iconPath;
            }

            if (itemType === 'POLYGON' || itemType === 'MULTIPOLYGON' || this.gmx.GeometryType === 'polygon') {
                type = 'polygon';
            }
            if (pt.iconSize) {
                var iconSize = ('sizeFunction' in pt ? pt.sizeFunction(prop, indexes) : pt.iconSize);
                out.sx = out.sy = iconSize;
                // iconSize += pt.weight ? pt.weight : 0;
                out.iconSize = iconSize;
                if ('iconScale' in pt) {
                    out.iconSize *= pt.iconScale;
                }
                out.maxSize = iconSize;
            }
            out.stroke = true;
            if ('colorFunction' in pt || 'opacityFunction' in pt) {
                color = 'colorFunction' in pt ? pt.colorFunction(prop, indexes) : color;
                opacity = 'opacityFunction' in pt ? pt.opacityFunction(prop, indexes) : opacity;
            }
            out.strokeStyle = gmxAPIutils.dec2color(color, opacity);
            out.lineWidth = 'weight' in pt ? pt.weight : 1;
        }

        if ('iconScale' in pt) {
            out.iconScale = 'scaleFunction' in pt ? (pt.scaleFunction ? pt.scaleFunction(prop, indexes) : 1) : pt.iconScale;
        }
        if ('iconAnchor' in pt) {
            out.iconAnchor = pt.iconAnchor;
        }
        if ('iconCenter' in pt) {
            out.iconCenter = pt.iconCenter;
        }

        if (type === 'square' || type === 'polygon' || type === 'circle' || type === 'iconPath') {
            out.type = type;
            var fop = pt.fillOpacity,
                fc = pt.fillColor,
                fcDec = typeof (fc) === 'string' ? parseInt(fc.replace(/#/, ''), 16) : fc;

            if ('fillColor' in pt) {
                out.fillStyle = gmxAPIutils.dec2color(fcDec, 1);
            }
            if ('fillColorFunction' in pt || 'fillOpacityFunction' in pt) {
                color = ('fillColorFunction' in pt ? pt.fillColorFunction(prop, indexes) : fc || 255);
                opacity = ('fillOpacityFunction' in pt ? pt.fillOpacityFunction(prop, indexes) : fop || 1);
                out.fillStyle = gmxAPIutils.dec2color(color, opacity);
            } else if ('fillOpacity' in pt && 'fillColor' in pt) {
                out.fillStyle = gmxAPIutils.dec2color(fcDec, fop);
            }
        }

        if ('dashArray' in pt) { out.dashArray = pt.dashArray; }
        if ('dashOffset' in pt) { out.dashOffset = pt.dashOffset; }

        if (this.gmx.labelsLayer) {
            arr = gmxAPIutils.styleKeys.label.client;
            for (i = 0, len = arr.length; i < len; i++) {
                var it = arr[i];
                if (it in pt) {
                    if (it === 'labelField') {
                        if (!indexes[pt[it]]) {
                            continue;
                        }
                    } else if (it === 'labelTemplate') {
                        var properties = gmxAPIutils.getPropertiesHash(prop, indexes);
                        out.labelText = gmxAPIutils.parseTemplate(pt[it], properties);
                    }
                    out[it] = pt[it];
                }
            }
            if ('labelAnchor' in pt) {
                out.labelAnchor = pt.labelAnchor;
            }
        }
        return out;
    }
};
StyleManager.MAX_STYLE_SIZE = 256;
//StyleManager.DEFAULT_STYLE = {outline: {color: 255, thickness: 1}, marker: {size: 8, circle: true}};
StyleManager.DEFAULT_STYLE = {outline: {color: 255, thickness: 1}, marker: {size: 8}};
StyleManager.DEFAULT_KEYS = ['MinZoom', 'MaxZoom', 'Balloon', 'BalloonEnable', 'DisableBalloonOnMouseMove', 'DisableBalloonOnClick'];
StyleManager.DEFAULT_ICONPATH = [0, 10, 5, -10, -5, -10, 0, 10];  // [TL.x, TL.y, BR.x, BR.y, BL.x, BL.y, TL.x, TL.y]

StyleManager.parsePattern = function(pattern) {
    var common = true,
        parsers = L.gmx.Parsers;
    if ('step' in pattern && typeof (pattern.step) === 'string') {
        pattern.patternStepFunction = parsers.parseExpression(pattern.step);
        common = false;
    }
    if ('width' in pattern && typeof (pattern.width) === 'string') {
        pattern.patternWidthFunction = parsers.parseExpression(pattern.width);
        common = false;
    }
    if ('colors' in pattern) {
        var arr = [];
        for (var i = 0, len = pattern.colors.length; i < len; i++) {
            var rt = pattern.colors[i];
            if (typeof (rt) === 'string') {
                arr.push(parsers.parseExpression(rt));
                common = false;
            } else {
                arr.push(null);
            }
        }
        pattern.patternColorsFunction = arr;
    }
    return common;
};

StyleManager.getStyleKeys = function(style) {
    var out = {};
    for (var key in gmxAPIutils.styleKeys) {
        var keys = gmxAPIutils.styleKeys[key];
        for (var i = 0, len = keys.client.length; i < len; i++) {
            var key1 = keys.client[i];
            if (key1 in style) {
                if (style[key1] !== undefined) {
                    out[key1] = JSON.parse(JSON.stringify(style[key1]));
                }
                if (key1 === 'fillPattern') { delete out[key1].patternColorsFunction; }
                else if (key1 === 'fillLinearGradient') { delete out[key1].addColorStopFunctions; }
            }
        }
    }
    if ('iconAnchor' in style) {
        out.iconAnchor = style.iconAnchor;
    }
    if ('labelAnchor' in style) {
        out.labelAnchor = style.labelAnchor;
    }
    return out;
};

StyleManager.checkDiff = function(st, st1) {
    for (var key in st) {
        if (st[key] !== st1[key]) {
            return key;
        }
    }
    return null;
};

StyleManager.parseRadialGradient = function(rg) {
    //	x1,y1,r1 — координаты центра и радиус первой окружности;
    //	x2,y2,r2 — координаты центра и радиус второй окружности.
    //	addColorStop - стоп цвета объекта градиента [[position, color]...]
    //		position — положение цвета в градиенте. Значение должно быть в диапазоне 0.0 (начало) до 1.0 (конец);
    //		color — код цвета или формула.
    //		opacity — прозрачность
    //		canvasStyleColor — результрующий цвет в формате canvas
    var common = true,
        parsers = L.gmx.Parsers,
        i = 0,
        arr = ['r1', 'x1', 'y1', 'r2', 'x2', 'y2'],
        len = arr.length;
    for (i = 0; i < len; i++) {
        var it = arr[i];
        if (!rg[it]) { rg[it] = 0; }
        if (typeof (rg[it]) === 'string') {
            rg[it + 'Function'] = parsers.parseExpression(rg[it]);
            common = false;
        }
    }

    rg.addColorStop = rg.addColorStop || [[0, 0xFF0000, 0.5], [1, 0xFFFFFF, 0.5]];
    rg.addColorStopFunctions = [];
    for (i = 0, len = rg.addColorStop.length; i < len; i++) {
        arr = rg.addColorStop[i];
        var resFunc = [
                (typeof (arr[0]) === 'string' ? parsers.parseExpression(arr[0]) : null),
                (typeof (arr[1]) === 'string' ? parsers.parseExpression(arr[1]) : null),
                (typeof (arr[2]) === 'string' ? parsers.parseExpression(arr[2]) : null)
            ];
        rg.addColorStopFunctions.push(resFunc);
        if (resFunc[1] === null && resFunc[2] === null) {
            arr[3] = gmxAPIutils.dec2color(arr[1], arr[2] > 1 ? arr[2] / 100 : arr[2]);
        } else {
            common = false;
        }
    }
    if ('r2Function' in rg) { common = false; }
    return common ? Math.max(rg.r1, rg.r2) : null;
};

StyleManager.parseLinearGradient = function(lg) {
    var common = true;
    //	x1,y1 — координаты начальной точки
    //	x2,y2 — координаты конечной точки
    //	addColorStop - стоп цвета объекта градиента [[position, color]...]
    //		position — положение цвета в градиенте. Значение должно быть в диапазоне 0.0 (начало) до 1.0 (конец);
    //		color — код цвета или формула.
    //		opacity — прозрачность
    var i = 0,
        parsers = L.gmx.Parsers,
        arr = ['x1', 'y1', 'x2', 'y2'],
        def = [0, 0, 0, 256],
        len = arr.length;
    for (i = 0; i < len; i++) {
        var it = arr[i];
        if (it in lg) {
            if (typeof (lg[it]) === 'string') {
                lg[it + 'Function'] = parsers.parseExpression(lg[it]);
                common = false;
            }
        } else {
            lg[it] = def[i];
        }
    }

    lg.addColorStop = lg.addColorStop || [[0, 0xFF0000], [1, 0xFFFFFF]];
    lg.addColorStopFunctions = [];
    for (i = 0, len = lg.addColorStop.length; i < len; i++) {
        arr = lg.addColorStop[i];
        lg.addColorStopFunctions.push([
            (typeof (arr[0]) === 'string' ? parsers.parseExpression(arr[0]) : null),
            (typeof (arr[1]) === 'string' ? parsers.parseExpression(arr[1]) : null),
            (typeof (arr[2]) === 'string' ? parsers.parseExpression(arr[2]) : null)
        ]);
    }
    return common;
};


L.gmx.VectorLayer.include({
    bindPopup: function (content, options) {
        var popupOptions = L.extend({maxWidth: 10000, className: 'gmxPopup', layerId: this._gmx.layerID}, options);

        if (this._popup) { this.unbindPopup(); }
        if (content instanceof L.Popup) {
            this._popup = content;
        } else {
            if (!this._popup || options) {
                this._popup = new L.Popup(popupOptions);
            }
            this._popup.setContent(content);
        }
        this._popup._initContent = content;
        this._popup._state = '';

        if (!this._popupHandlersAdded) {
            this
                .on('click', this._openClickPopup, this)
                .on('mousemove', this._movePopup, this)
                .on('mouseover', this._overPopup, this)
                .on('mouseout', this._outPopup, this)
                .on('doneDraw', this._chkNeedOpenPopup, this);

            this._popupHandlersAdded = true;
        }
        if (popupOptions && popupOptions.popupopen) {
            this._popupopen = popupOptions.popupopen;
        }

        this._popup.updateLayout = this._popup._updateLayout;

        return this;
    },

	unbindPopup: function () {
		if (this._popup) {
			this._popup = null;
			this
			    .off('click', this._openClickPopup, this)
                .off('mousemove', this._movePopup, this)
			    .off('mouseover', this._overPopup, this)
                .off('mouseout', this._outPopup, this)
                .off('doneDraw', this._chkNeedOpenPopup, this);

            this._popupopen = null;
			this._popupHandlersAdded = false;
		}
        this._gmx.balloonEnable = false;
		return this;
	},

    _chkNeedOpenPopup: function () {
        for (var id in this._gmx._needPopups) {
            if (this._gmx._needPopups[id]) {
                this.addPopup(id);
                delete this._gmx._needPopups[id];
            }
        }
    },

    disablePopup: function () {
        this._popupDisabled = true;
		return this;
    },

    enablePopup: function () {
        this._popupDisabled = false;
		return this;
    },

	openPopup: function (latlng, options) {

		if (this._popup) {
			// open the popup from one of the path's points if not specified
			latlng = latlng || this._latlng ||
			         this._latlngs[Math.floor(this._latlngs.length / 2)];

			options = options || {};
            options.latlng = latlng;
            this._openPopup(options);
		}

		return this;
	},

	closePopup: function () {
		if (this._popup) {
			this._popup._close();
            this.fire('popupclose', {popup: this._popup});
		}
		return this;
	},

    _movePopup: function (options) {
        if (this._popup._state === 'mouseover') {
            var id = this._popup.options._gmxID || -1;
            if (id !== options.gmx.id) {
                this._setPopupContent(options);
            }
            this._popup.setLatLng(options.latlng);
        }
    },

    _overPopup: function (options) {
        var _popup = this._popup;
        if (!_popup._map) {
            this._openPopup(options);
        } else {
            this.fire('popupopen', {
                popup: _popup,
                gmx: this._setPopupContent(options, _popup)
            });
        }
        if (_popup._state === 'mouseover') {
            _popup.setLatLng(options.latlng);
        }
    },

    _outPopup: function (ev) {
        if (this._popup._state === 'mouseover' && !ev.gmx.prevId) {
            this.closePopup();
        }
    },

    _callBalloonHook: function (props, div) {

        var spans = div.getElementsByTagName('span'),
            hooksCount = {},
            key, i, len;
        for (key in this._balloonHook) {    // collect hook counts
            var hookID = this._balloonHook[key].hookID;
            hooksCount[key] = 0;
            for (i = 0, len = spans.length; i < len; i++) {
                if (spans[i].id === hookID) {
                    hooksCount[key]++;
                }
            }
        }

        for (key in this._balloonHook) {
            var hook = this._balloonHook[key],
                fid = hook.hookID,
                notFound = true;

            for (i = 0, len = spans.length; i < len; i++) {
                var node = spans[i];
                if (node.id === fid) {
                    notFound = false;
                    node.id += '_' + i;
                    hook.callback(props, div, node, hooksCount);
                }
            }
            if (notFound) {
                hook.callback(props, div, null, hooksCount);
            }
        }
    },

    _setPopupContent: function (options, _popup) {
        if (!_popup) { _popup = this._popup; }
        var gmx = options.gmx || {},
            balloonData = gmx.balloonData || {},
            properties = L.extend({}, gmx.properties),
            target = gmx.target || {},
            geometry = target.geometry || {},
            offset = target.offset,
            templateBalloon = _popup._initContent || balloonData.templateBalloon || '',
            type = options.type,
            skipSummary = this.options.isGeneralized && (type === 'mouseover' || type === 'mousemove'),
            outItem = {
                id: gmx.id,
                type: type,
                nodePoint: gmx.nodePoint,
                latlng: options.latlng,
                properties: properties,
                templateBalloon: templateBalloon
            };

        if (geometry.type === 'POINT') {
            var coord = geometry.coordinates;
            outItem.latlng = L.Projection.Mercator.unproject({x: coord[0], y: coord[1]});
        }
        if (offset) {
            var protoOffset = L.Popup.prototype.options.offset;
            _popup.options.offset = [-protoOffset[0] - offset[0], protoOffset[1] - offset[1]];
        }

        if (this._popupopen) {
            this._popupopen({
                popup: _popup,
                latlng: outItem.latlng,
                layerPoint: options.layerPoint,
                contentNode: _popup._contentNode,
                containerPoint: options.containerPoint,
                originalEvent: options.originalEvent,
                gmx: outItem
            });
        } else if (!(templateBalloon instanceof L.Popup)) {
            if (!(templateBalloon instanceof HTMLElement)) {
                var geometries,
                    summary = '',
                    unitOptions = this._map ? this._map.options : {};

                if (!skipSummary) {
                    geometries = target.geometry ? [target.geometry] : (gmx.geometries || this._gmx.dataManager.getItemGeometries(gmx.id) || []);
                    outItem.summary = summary = L.gmxUtil.getGeometriesSummary(geometries, unitOptions);
                }
                if (this._balloonHook) {
                    if (!templateBalloon) {
                        templateBalloon = gmxAPIutils.getDefaultBalloonTemplate(properties);
                    }
                    for (var key in this._balloonHook) {
                        properties[key] = gmxAPIutils.parseTemplate(this._balloonHook[key].resStr, properties);
                    }
                }
                templateBalloon = L.gmxUtil.parseBalloonTemplate(templateBalloon, {
                    properties: properties,
                    tileAttributeTypes: this._gmx.tileAttributeTypes,
                    unitOptions: unitOptions,
                    summary: summary,
                    geometries: geometries
                });
            }

            var contentDiv = L.DomUtil.create('div', '');
            contentDiv.innerHTML = templateBalloon;
            _popup.setContent(contentDiv);
            if (this._balloonHook) {
                this._callBalloonHook(gmx.properties, _popup.getContent());
            }
            //outItem.templateBalloon = templateBalloon;
        }
        _popup.options._gmxID = gmx.id;
        return outItem;
    },

    _openClickPopup: function (options) {
        var originalEvent = options.originalEvent || {},
            skip = !options.gmx || this._popupDisabled || originalEvent.ctrlKey || originalEvent.altKey || originalEvent.shiftKey;

        if (!skip) {
            var type = options.type,
                gmx = options.gmx,
                balloonData = gmx.balloonData,
                flag = type === 'click' && balloonData.isSummary && !balloonData.DisableBalloonOnClick,
                item = gmx.target;

            if (flag && item.options.isGeneralized && !item.geometry) {
                var layerProp = gmx.layer.getGmxProperties();
                gmxAPIutils.getLayerItemFromServer({
                    options: options,
                    layerID: layerProp.name,
                    value: item.id,
                    field: layerProp.identityField
                }).then(function(json, params) {
                    if (json && json.Status === 'ok' && json.Result) {
                        var pArr = json.Result.values[0];
                        params.options.gmx.target.fromServerProps = pArr;
                        params.options.gmx.target.geometry = pArr[pArr.length - 1];
                        this._openPopup(params.options);
                    }
                }.bind(this));
            } else {
                this._openPopup(options);
            }
        }
    },

    _openPopup: function (options, notSkip) {
        var map = this._map,
            originalEvent = options.originalEvent || {},
            skip = notSkip ? !notSkip : this._popupDisabled || originalEvent.ctrlKey || originalEvent.altKey || originalEvent.shiftKey;

        if (!skip) {
            var type = options.type,
                _popup = this._popup,
                gmx = options.gmx || {},
                balloonData = gmx.balloonData || {};

            if (type === 'click') {
                if (!notSkip && balloonData.DisableBalloonOnClick && !this.hasEventListeners('popupopen')) { return; }

                if (!('_gmxPopups' in map)) {
                    map._gmxPopups = [];
                }
                if (!('maxPopupCount' in map.options)) { map.options.maxPopupCount = 1; }
                if (!this._gmx._gmxPopupsInit) {
                    this._gmx._gmxPopupsInit = true;
                    map.on({
                        layerremove: function (ev) {
                            if (ev.layer instanceof L.Popup) {
                                this._clearPopup(ev.layer);
                            } else if (ev.layer === this) {
                                if (map._gmxPopups) {
                                    var layerId = this._gmx.layerID;
                                    map._gmxPopups = map._gmxPopups.reduce(function(p, c) {
                                        if (c._map) {
                                            if (c.options.layerId === layerId) { c._map.removeLayer(c); }
                                            else { p.push(c); }
                                        }
                                        return p;
                                    }, []);
                                }
                                this.closePopup();
                            }
                        }
                    }, this);
                }

                this._clearPopup(gmx.id);
                var opt = this._popup ? this._popup.options : {maxWidth: 10000, className: 'gmxPopup', layerId: this._gmx.layerID};
                _popup = new L.Popup(L.extend({}, opt, {closeOnClick: map.options.maxPopupCount === 1, autoPan: true}));
            } else if (type === 'mouseover') {
                if (balloonData.DisableBalloonOnMouseMove) {
                    _popup._state = '';
                    return;
                }
                _popup.options.autoPan = false;
            } else {
                return;
            }
            _popup.options.objectId = gmx.id;
            _popup._state = type;
            var outItem = this._setPopupContent(options, _popup);
            _popup.setLatLng(outItem.latlng);

            this.fire('popupopen', {
                popup: _popup,
                gmx: outItem
            });
            if (type === 'click') {
                if (map._gmxPopups.length >= map.options.maxPopupCount) {
                    map.removeLayer(map._gmxPopups.shift());
                }
                map._gmxPopups.push(_popup);
            }
            _popup.addTo(map);    // this._map.openPopup(_popup);

            if (_popup._closeButton) {
                var closeStyle = _popup._closeButton.style;
                if (type === 'mouseover' && closeStyle !== 'hidden') {
                    closeStyle.visibility = 'hidden';
                    _popup._container.style.marginBottom = '7px';
                    _popup._container.style.pointerEvents = 'none';
                } else if (type === 'click' && closeStyle !== 'inherit') {
                    closeStyle.visibility = 'inherit';
                    _popup._container.style.marginBottom = '';
                    _popup._container.style.pointerEvents = '';
                }
            }
        }
    },

	_clearPopup: function (item /* <L.Popup> or objectId */) {
        var map = this._map;
        if (map && map._gmxPopups) {
            var layerId = this._gmx.layerID,
                flagPopup = item instanceof L.Popup;
            map._gmxPopups = map._gmxPopups.reduce(function(p, c) {
                if (c._map) {
                    if (flagPopup && c === item) { c._map.removeLayer(c); }
                    else if (c.options.layerId === layerId && c.options.objectId === item) { c._map.removeLayer(c); }
                    else { p.push(c); }
                }
                return p;
            }, []);
        }
    },

    getPopups: function (flag) {
        var map = this._map,
            out = [];
        if (map && map._gmxPopups) {
            var layerId = this._gmx.layerID;
            map._gmxPopups.reduce(function(p, c) {
                if (c.options.layerId === layerId) { p.push(flag ? c : c.options.objectId); }
                return p;
            }, out);
        }
        return out;
    },

    addPopup: function (id) {
        var gmx = this._gmx,
            item = gmx.dataManager.getItem(id);
        if (!item || !this._map) {
            gmx._needPopups[id] = false;
        } else {
            var center = item.bounds.getCenter(),
                latlng = L.Projection.Mercator.unproject(new L.Point(center[0], center[1]));
            this._openPopup({
                type: 'click',
                latlng: latlng,
                gmx: this.getHoverOption(item)
            }, true);
            delete gmx._needPopups[id];
        }
        return this;
    },

    addPopupHook: function (key, callback) {
        if (!this._balloonHook) { this._balloonHook = {}; }
        if (!this._balloonHook[key]) {
            var hookID = '_' + L.stamp({});
            this._balloonHook[key] = {
                key: key,
                hookID: hookID,
                resStr: '<span id="' + hookID + '"></span>',
                callback: callback
            };
        }
        return this;
    },

    removePopupHook: function(key) {
        if (this._balloonHook) { delete this._balloonHook[key]; }
        return this;
    }
});


L.gmx.VectorLayer.include({
    _gmxFirstObjectsByPoint: function (geoItems, mercPoint, bounds) {    // Получить верхний объект по координатам mouseClick
        var gmx = this._gmx,
            mInPixel = gmx.mInPixel,
            j,
            len;

        for (var i = geoItems.length - 1; i >= 0; i--) {
            var geoItem = geoItems[i].properties,
                idr = geoItem[0],
                dataOption = geoItems[i].dataOption || {},
                item = gmx.dataManager.getItem(idr),
                currentStyle = item.currentStyle || item.parsedStyleKeys || {},
                iconScale = currentStyle.iconScale || 1,
                iconCenter = currentStyle.iconCenter,
                iconAnchor = !iconCenter && currentStyle.iconAnchor ? currentStyle.iconAnchor : null,
                parsedStyle = gmx.styleManager.getObjStyle(item),
                lineWidth = currentStyle.lineWidth || parsedStyle.lineWidth || 0,
                sx = lineWidth + (parsedStyle.sx || currentStyle.sx || 0),
                sy = lineWidth + (parsedStyle.sy || currentStyle.sy || 0),
                offset = [
                    iconScale * sx / 2,
                    iconScale * sy / 2
                ],
                point = mercPoint,
                geom = geoItem[geoItem.length - 1],
                type = geom.type;

            if (type === 'POINT' && parsedStyle.type === 'circle') {
                offset[0] *= 2;
                offset[1] *= 2;
            }
            var radius = offset[0],
                objBounds = gmxAPIutils.bounds()
                    .extendBounds(dataOption.bounds)
                    .addBuffer(offset[0] / mInPixel, offset[1] / mInPixel);
            if (iconAnchor) {
                offset = [
                    iconAnchor[0] - offset[0],
                    iconAnchor[1] - offset[1]
                ];
                point = [
                    mercPoint[0] + offset[0] / mInPixel,
                    mercPoint[1] - offset[1] / mInPixel
                ];
            }
            if (!objBounds.contains(point)) { continue; }

            var fill = currentStyle.fillStyle || currentStyle.canvasPattern || parsedStyle.bgImage || parsedStyle.fillColor,
                marker = parsedStyle && parsedStyle.image ? parsedStyle.image : null,
                chktype = type,
                hiddenLines = dataOption.hiddenLines || [],
                boundsArr = dataOption.boundsArr,
                coords = geom.coordinates,
                nodePoint = null,
                ph = {
                    point: mercPoint,
                    bounds: bounds,
                    coords: coords,
                    boundsArr: boundsArr
                };

            if (type === 'MULTIPOLYGON' || type === 'POLYGON') {
                if (marker) {
                    chktype = 'POINT';
                } else if (!fill) {
                    if (type === 'POLYGON') {
                        chktype = 'MULTILINESTRING';
                        hiddenLines = hiddenLines[0];
                    } else {
                        chktype = 'LIKEMULTILINESTRING';
                    }
                    ph.hidden = hiddenLines;
                }
            }

            if (chktype === 'LINESTRING') {
                if (!gmxAPIutils.isPointInPolyLine(mercPoint, lineWidth / mInPixel, coords)) {
                    nodePoint = gmxAPIutils.bounds([point]).addBuffer(offset[0] / mInPixel, offset[1] / mInPixel).isNodeIntersect(coords);
                    if (nodePoint === null) { continue; }
                }
            } else if (chktype === 'LIKEMULTILINESTRING') {
                ph.delta = lineWidth / mInPixel;
                var flag = false;
                for (j = 0, len = coords.length; j < len; j++) {
                    ph.coords = coords[j];
                    ph.hidden = hiddenLines ? hiddenLines[j] : null;
                    ph.boundsArr = boundsArr[j];
                    if (gmxAPIutils.isPointInLines(ph)) {
                        flag = true;
                        break;
                    }
                }
                if (!flag) { continue; }
            } else if (chktype === 'MULTILINESTRING') {
                ph.delta = lineWidth / mInPixel;
                ph.hidden = hiddenLines;
                if (!gmxAPIutils.isPointInLines(ph)) {
                    var pBounds = gmxAPIutils.bounds([point]).addBuffer(offset[0] / mInPixel, offset[1] / mInPixel);
                    for (j = 0, len = coords.length; j < len; j++) {
                        nodePoint = pBounds.isNodeIntersect(coords[j]);
                        if (nodePoint !== null) {
                            nodePoint.ring = j;
                            break;
                        }
                    }
                    if (nodePoint === null) { continue; }
                }
            } else if (chktype === 'MULTIPOLYGON' || chktype === 'POLYGON') {
                var chkPoint = mercPoint;
                flag = false;
                if (chktype === 'POLYGON') {
                    coords = [geom.coordinates];
                    boundsArr = [dataOption.boundsArr];
                }
                for (j = 0, len = coords.length; j < len; j++) {
                    var arr = coords[j],
                        bbox = boundsArr[j];
                    for (var j1 = 0, len1 = arr.length; j1 < len1; j1++) {
                        var b = bbox[j1];
                        if (b.intersects(bounds)) {
                            if (gmxAPIutils.isPointInPolygonWithHoles(chkPoint, arr)) {
                                flag = j1 === 0 ? true : false;
                                break;
                            }
                        }
                    }
                }
                if (!flag) { continue; }
            } else if (chktype === 'POINT') {
                if (parsedStyle.type === 'circle') {
                    var x = (coords[0] - point[0]) * mInPixel,
                        y = (coords[1] - point[1]) * mInPixel;
                    if (x * x + y * y > radius * radius) { continue; }
                }
            }
            if (!this.isPointInClipPolygons(mercPoint)) {
                continue;
            }

            return {
                id: idr,
                properties: item.properties,
                geometry: geom,
                bounds: item.bounds,
                nodePoint: nodePoint,
                offset: iconAnchor ? offset : null,
                parsedStyle: parsedStyle
            };
        }
        return null;
    },

    gmxEventCheck: function (ev, skipOver) {
        if (!this._map) {
            return 0;
        }
        var layer = this,
            gmx = layer._gmx,
            type = ev.type,
            lastHover = gmx.lastHover,
            chkHover = function (evType) {
                if (lastHover && type === 'mousemove') {
                    if (evType && layer.hasEventListeners(evType)) {
                        ev.gmx = lastHover;
                        layer.fire(evType, ev);
                    }
                    if (lastHover.hoverDiff) { layer.redrawItem(lastHover.id); }
                }
            };

        var zoom = this._map.getZoom();
        if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
            skipOver = true;
        }
        if (skipOver) {
            if (lastHover) { lastHover.prevId = null; }
            chkHover('mouseout');
            gmx.lastHover = null;
        } else if (
            this.hasEventListeners('mouseover') ||
            this.hasEventListeners('mouseout') ||
            this.hasEventListeners(type) ||
            (type === 'mousemove' && gmx.properties.fromType !== 'Raster')
            ) {

            var lng = ev.latlng.lng % 360,
                latlng = new L.LatLng(ev.latlng.lat, lng + (lng < -180 ? 360 : (lng > 180 ? -360 : 0))),
                point = L.Projection.Mercator.project(latlng)._subtract(
                    {x: gmx.shiftXlayer || 0, y: gmx.shiftYlayer || 0}
                ),
                delta = Math.max(5, gmx.styleManager._getMaxStyleSize(zoom)) / gmx.mInPixel,
                mercatorPoint = [point.x, point.y];

            //создаём observer только для того, чтобы сделать выборку данных вокруг курсора
            var observerOptions = {
                type: 'resend',
                bbox: gmxAPIutils.bounds([mercatorPoint]).addBuffer(delta),
                dateInterval: gmx.layerType === 'VectorTemporal' ? [gmx.beginDate, gmx.endDate] : null,
                filters: ['clipFilter', 'userFilter_' + gmx.layerID, 'styleFilter', 'userFilter'],
                active: false //делаем его неактивным, так как потом будем явно выбирать данные
            };
            if (this.options.isGeneralized) {
                observerOptions.targetZoom = zoom;
            }

            gmx.dataManager.addObserver(observerOptions, 'hover');

            var geoItems = gmx.dataManager.getItems('hover');

            gmx.dataManager.removeObserver('hover');

            if (geoItems && geoItems.length) {
                if (geoItems.length > 1 && gmx.sortItems) { geoItems = this.getSortedItems(geoItems); }

                var target = this._gmxFirstObjectsByPoint(geoItems, mercatorPoint, observerOptions.bbox);
                if (target) {
                    var idr = target.id,
                        item = gmx.dataManager.getItem(idr),
                        prevId = lastHover ? lastHover.id : null,
                        changed = !lastHover || lastHover.id !== idr;
                    if (type === 'mousemove' && lastHover) {
                        if (!changed) {
                            ev.gmx = lastHover;
                            this.fire(type, ev);
                            return idr;
                        }
                        chkHover(item.currentFilter !== lastHover.currentFilter ? 'mouseout' : '');
                        gmx.lastHover = null;
                    }

                    ev.gmx = L.extend(this.getHoverOption(item), {
                        targets: geoItems,
                        nodePoint: target.nodePoint,
                        prevId: prevId,
                        hoverDiff: item.hoverDiff
                    });
                    if (this.hasEventListeners(type)) { this.fire(type, ev); }
                    if (type === 'mousemove' && changed) {
                        lastHover = gmx.lastHover = ev.gmx;
                        chkHover('mouseover');
                        gmx.lastMouseover = gmx.lastHover;
                    }
                    this._map.doubleClickZoom.disable();
                    return idr;
                }
            }
        }
        if (this._map) {
            this._map.doubleClickZoom.enable();
        }
        return 0;
    },

    getHoverOption: function (item) {
        return {
            layer: this,
            target: item,
            balloonData: this._gmx.styleManager.getItemBalloon(item.id),
            properties: this.getItemProperties(item.properties),
            currentFilter: item.currentFilter || 0,
            id: item.id
        };
    }
});


(function() {
var delay = 20000,
    layers = {},
    dataManagersLinks = {},
    script = '/Layer/CheckVersion.ashx',
    intervalID = null,
    timeoutID = null,
    lastLayersStr = '';

var isExistsTiles = function(prop) {
    var tilesKey = prop.Temporal ? 'TemporalTiles' : 'tiles';
    return tilesKey in prop;
};
var getParams = function(prop, dm, layerDateInterval) {
    var pt = {
        Name: prop.name,
        Version: isExistsTiles(prop) ? prop.LayerVersion : -1
    };
	if (dm && (prop.UseTiles === false || window.gmxSkipTiles === 'NotVisible')) {
		var maxDateInterval = dm.getMaxDateInterval(),
			beginDate = maxDateInterval.beginDate || layerDateInterval.beginDate,
			endDate = maxDateInterval.endDate || layerDateInterval.endDate;
        if (beginDate) { pt.dateBegin = Math.floor(beginDate.getTime() / 1000); }
        if (endDate) { pt.dateEnd = Math.floor(endDate.getTime() / 1000); }
    }
    return pt;
};
var getRequestParams = function(layer) {
    var hosts = {},
        prop, hostName, dm, layerDateInterval;
    if (layer) {
        if (layer instanceof L.gmx.DataManager) {
			dm = layer;
			prop = dm.options;
		} else {
			prop = layer._gmx.properties;
			dm = layer._gmx.dataManager;
			layerDateInterval = layer._gmx;
		}
        hostName = prop.hostName || layer._gmx.hostName;
		hosts[hostName] = [getParams(prop, dm, layerDateInterval)];
    } else {
        var skipItems = {};
        for (var id in layers) {
            var obj = layers[id],
				isDataManager = obj instanceof L.gmx.DataManager;
            if (obj.options.chkUpdate || isDataManager) {
				dm = isDataManager ? obj : obj._gmx.dataManager;
                prop = isDataManager ? obj.options : obj._gmx.properties;
				layerDateInterval = isDataManager ? obj : obj._gmx;
                hostName = prop.hostName || obj._gmx.hostName;
                var pt = getParams(prop, dm, layerDateInterval),
                    key = pt.Name + pt.Version;
                if (!skipItems[key]) {
                    if (hosts[hostName]) { hosts[hostName].push(pt); }
                    else { hosts[hostName] = [pt]; }
                }
                skipItems[key] = true;
            }
        }
    }
    return hosts;
};

var chkVersion = function (layer, callback) {
    var processResponse = function(res) {
        if (res && res.Status === 'ok' && res.Result) {
            for (var i = 0, len = res.Result.length; i < len; i++) {
                var item = res.Result[i],
                    id = item.properties.name;
				if (layer && layer._gmx.properties.name === id && 'updateVersion' in layer) { layer.updateVersion(item); }
                for (var key in layers) {
                    var curLayer = layers[key];
					if (layer && layer === curLayer) { continue; }
                    if (curLayer._gmx && curLayer._gmx.properties.name === id && 'updateVersion' in curLayer) { curLayer.updateVersion(item); }
					else {
						curLayer.updateVersion(item.properties);
					}
                }
            }
        }
        lastLayersStr = '';
        if (callback) { callback(res); }
    };

    if (document.body && !gmxAPIutils.isPageHidden()) {
        var hosts = getRequestParams(layer),
            chkHost = function(hostName) {
                var url = 'http://' + hostName + script,
                    layersStr = JSON.stringify(hosts[hostName]);

                if (lastLayersStr !== layersStr) {
                    lastLayersStr = layersStr;
                    if ('FormData' in window) {
                        gmxAPIutils.request({
                            url: url,
                            async: true,
                            headers: {
                                'Content-type': 'application/x-www-form-urlencoded'
                            },
                            type: 'POST',
                            params: 'WrapStyle=None&layers=' + encodeURIComponent(layersStr),
                            withCredentials: true,
                            callback: function(response) {
                                processResponse(JSON.parse(response));
                            },
                            onError: function(response) {
                                console.log('Error: LayerVersion ', response);
                            }
                        });
                    } else {
                        gmxAPIutils.sendCrossDomainPostRequest(url, {
                            WrapStyle: 'message',
                            layers: layersStr
                        }, processResponse);
                    }
                    var timeStamp = Date.now();
                    for (var key in layers) {
                        var it = layers[key];
                        var options = it._gmx || it.options;
                        if (options.hostName === hostName) { options._stampVersionRequest = timeStamp; }
                    }
                }
            };
        for (var hostName in hosts) {
            chkHost(hostName);
        }
    }
};

var layersVersion = {

    addDataManager: function(dataManager) {
        var id = dataManager.options.name;
        if (id in layers) {
            return;
		}
		dataManager.on('chkLayerUpdate', chkVersion.bind(dataManager));
		layers[id] = dataManager;
    },

    removeDataManager: function(dataManager) {
        var id = dataManager.options.name;
        if (id in layers) {
			dataManager.off('chkLayerUpdate', chkVersion.bind(dataManager));
			delete layers[id];
		}
    },

    remove: function(layer) {
        delete layers[layer._leaflet_id];
        var _gmx = layer._gmx,
			pOptions = layer.options.parentOptions;
		if (pOptions) {
			var pId = pOptions.name;
			if (dataManagersLinks[pId]) {
				delete dataManagersLinks[pId][_gmx.properties.name];
				if (!Object.keys(dataManagersLinks[pId]).length) {
					layersVersion.removeDataManager(_gmx.dataManager);
					delete dataManagersLinks[pId];
				}
			}
		} else {
			_gmx.dataManager.off('chkLayerUpdate', _gmx._chkVersion);
		}
    },

    add: function(layer) {
        var id = layer._leaflet_id;
        if (id in layers) {
            return;
		}

        var _gmx = layer._gmx,
            prop = _gmx.properties;
        if ('LayerVersion' in prop) {
            layers[id] = layer;
            _gmx._chkVersion = function () {
                chkVersion(layer);
            };
            _gmx.dataManager.on('chkLayerUpdate', _gmx._chkVersion);
			var pOptions = layer.options.parentOptions;
			if (pOptions) {
				var pId = pOptions.name;
				layersVersion.addDataManager(_gmx.dataManager);
				if (!dataManagersLinks[pId]) { dataManagersLinks[pId] = {}; }
				dataManagersLinks[pId][prop.name] = layer;
			}

            layersVersion.start();
            if (!_gmx._stampVersionRequest || _gmx._stampVersionRequest < Date.now() - 19000 || !isExistsTiles(prop)) {
				layersVersion.now();
            }
        }
    },

    chkVersion: chkVersion,

    now: function() {
		if (timeoutID) { clearTimeout(timeoutID); }
		timeoutID = setTimeout(chkVersion, 0);
    },

    stop: function() {
        if (intervalID) { clearInterval(intervalID); }
        intervalID = null;
    },

    start: function(msec) {
        if (msec) { delay = msec; }
        layersVersion.stop();
        intervalID = setInterval(chkVersion, delay);
    }
};

if (!L.gmx) { L.gmx = {}; }
L.gmx.layersVersion = layersVersion;

L.gmx.VectorLayer.include({
    updateVersion: function (layerDescription) {
        if (layerDescription) {
            var gmx = this._gmx;
            if (layerDescription.geometry) {
                gmx.geometry = layerDescription.geometry;
            }
            if (layerDescription.properties) {
                L.extend(gmx.properties, layerDescription.properties);
                gmx.properties.GeoProcessing = layerDescription.properties.GeoProcessing;
                gmx.rawProperties = gmx.properties;
                this.fire('versionchange');
                gmx.dataManager.updateVersion(gmx.rawProperties);
            }
        }
    }
});
})();


//Raster layer is just vector layer with the single object and special background tiles
L.gmx.RasterLayer = L.gmx.VectorLayer.extend(
{
    options: {
        isGeneralized: false,
        zIndexOffset: 0
        //clickable: false
    },
    initFromDescription: function(ph) {
        var props = ph.properties,
            styles = props.styles[0] || {MinZoom: props.MinZoom || 0, MaxZoom: props.MaxZoom || 21},
            vectorProperties = {
                type: 'Vector',
                fromType: props.type,
                identityField: 'ogc_fid',
                GeometryType: 'POLYGON',
                IsRasterCatalog: true,
                Copyright: props.Copyright || '',
                RCMinZoomForRasters: styles.MinZoom,
                visible: props.visible,
                styles: [{
                    DisableBalloonOnClick: true,
                    MinZoom: styles.MinZoom,
                    MaxZoom: styles.MaxZoom,
                    RenderStyle: {outline: {thickness: 0}, fill: {opacity: 100}},
                    HoverStyle: null
                }]
            },
            gmx = this._gmx,
            worldSize = gmxAPIutils.tileSizes[1];

        if (props.MaxZoom) {
            gmx.maxNativeZoom = props.MaxZoom;
        }
        if (!ph.geometry) {
            ph.geometry = {
                type: 'POLYGON',
                coordinates: [[[-worldSize, -worldSize], [-worldSize, worldSize], [worldSize, worldSize], [worldSize, -worldSize], [-worldSize, -worldSize]]]
            };
        }

		L.gmx.VectorLayer.prototype.initFromDescription.call(this, {geometry: ph.geometry, properties: vectorProperties, rawProperties: ph.properties});

        gmx.rasterBGfunc = function(x, y, z) {
			return 'http://' + gmx.hostName + '/' +
				'TileSender.ashx?ModeKey=tile' +
				'&key=' + encodeURIComponent(gmx.sessionKey) +
				'&LayerName=' + gmx.layerID +
				'&z=' + z +
				'&x=' + x +
				'&y=' + y;
		};

		var vectorDataProvider = {load: function(x, y, z, v, s, d, callback) {
            var objects = [[777, ph.geometry]],
                itemBounds = gmxAPIutils.geoItemBounds(ph.geometry),
                bounds = itemBounds.bounds;

            if (bounds.max.x > worldSize) {
                // for old layers geometry
                var ww2 = 2 * worldSize,
                    id = 777,
                    coords = ph.geometry.coordinates,
                    bboxArr = itemBounds.boundsArr;

                objects = [];
                if (ph.geometry.type === 'POLYGON') {
                    coords = [coords];
                    bboxArr = [bboxArr];
                }

                for (var i = 0, len = coords.length; i < len; i++) {
                    var it = coords[i],
                        bbox = bboxArr[i][0],
                        arr = it;
                    objects.push([id++, {type: 'POLYGON', coordinates: arr}]);
                    if (bbox.max.x > worldSize) {
                        arr = [];
                        for (var j = 0, len1 = it.length; j < len1; j++) {
                            var it1 = it[j];
                            for (var j1 = 0, arr1 = [], len2 = it1.length; j1 < len2; j1++) {
                                var it2 = it1[j1];
                                arr1.push([it2[0] - ww2, it2[1]]);
                            }
                            arr.push(arr1);
                        }
                        objects.push([id++, {type: 'POLYGON', coordinates: arr}]);
                    }
                }
            }
			callback(objects, [bounds.min.x, bounds.min.y, bounds.max.x, bounds.max.y]);
		}};
		gmx.dataManager._rasterVectorTile = new VectorTile(vectorDataProvider, {x: -0.5, y: -0.5, z: 0, v: 0, s: -2, d: -2});
		gmx.dataManager.addTile(gmx.dataManager._rasterVectorTile);

        return this;
    },

    setZoomBounds: function(minZoom, maxZoom) {
        var styles = this.getStyles().slice(0);
        styles[0] = L.extend({}, styles[0]);
        styles[0].MinZoom = minZoom;
        styles[0].MaxZoom = maxZoom;
        this.setStyles(styles);
    }
});


/*
 (c) 2014, Sergey Alekseev
 Leaflet.LabelsLayer, plugin for Gemixer layers.
*/
L.LabelsLayer = L.Class.extend({

    options: {
        pane: 'overlayPane'
    },

    initialize: function (map, options) {
        L.setOptions(this, options);
        this._observers = {};
        this._styleManagers = {};
        this._labels = {};
        var _this = this;

        this.bbox = gmxAPIutils.bounds();

        var chkData = function (data, layer) {
            if (!data.added && !data.removed) { return; }

            var opt = layer.options,
                added = map._zoom >= opt.minZoom && map._zoom <= opt.maxZoom ? data.added : [],
                layerId = '_' + layer._leaflet_id,
                gmx = layer._gmx,
                labels = {};

            for (var i = 0, len = added.length; i < len; i++) {
                var item = added[i].item,
                    isPoint = item.type === 'POINT' || item.type === 'MULTIPOINT',
                    currentStyle = item.parsedStyleKeys || item.currentStyle || {};

                if (gmx.styleHook) {
                    var styleExtend = gmx.styleHook(item, gmx.lastHover && item.id === gmx.lastHover.id);
                    if (styleExtend) {
                        currentStyle = L.extend({}, currentStyle, styleExtend);
                    } else {
                        continue;
                    }
                }
                if (item.multiFilters) {
                    for (var j = 0, len1 = item.multiFilters.length; j < len1; j++) {
                        var st = item.multiFilters[j].parsedStyle;
                        if ('labelField' in st || 'labelText' in st) {
                            currentStyle = st;
                            break;
                        }
                    }
                }
                var style = gmx.styleManager.getObjStyle(item) || {},
                    labelText = currentStyle.labelText || style.labelText,
                    labelField = currentStyle.labelField || style.labelField,
                    fieldType = gmx.tileAttributeTypes[labelField],
                    txt = labelText || L.gmxUtil.attrToString(fieldType, layer.getPropItem(labelField, item.properties));

                if (txt || txt === 0) {
                    var fontSize = currentStyle.labelFontSize || style.labelFontSize || 12,
                        id = '_' + item.id,
                        changed = true,
                        width = 0,
                        options = item.options,
                        labelStyle = {
                            font: fontSize + 'px "Arial"',
                            labelHaloColor: currentStyle.labelHaloColor || style.labelHaloColor || 0,
                            labelColor: currentStyle.labelColor || style.labelColor,
                            labelAlign: currentStyle.labelAlign || style.labelAlign,
                            labelAnchor: currentStyle.labelAnchor || style.labelAnchor,
                            labelFontSize: fontSize
                        };
                    if (options) {
                        if (!('center' in options)) {
                            var center = gmxAPIutils.getItemCenter(item, gmx.dataManager.getItemMembers(item.id));
                            if (!center) { continue; }
                            options.center = center;
                        }
                        if (options.label) {
                            width = options.label.width;
                            var pstyle = options.label.style;
                            changed = options.label.txt !== txt ||
                                pstyle.labelHaloColor !== labelStyle.labelHaloColor ||
                                pstyle.labelColor !== labelStyle.labelColor ||
                                pstyle.labelAlign !== labelStyle.labelAlign ||
                                pstyle.labelAnchor !== labelStyle.labelAnchor ||
                                pstyle.labelFontSize !== labelStyle.labelFontSize;
                        }
                    }
                    if (changed) {
                        width = gmxAPIutils.getLabelWidth(txt, labelStyle);
                        if (!width) {
                            delete labels[id];
                            continue;
                        }
                        width += 4;
                        item.options.labelStyle = null;
                    }
                    options.label = {
                        isPoint: isPoint,
                        width: width,
                        sx: style.sx || 0,
                        txt: txt,
                        style: labelStyle
                    };
                    labels[id] = item;
                }
            }
            _this._labels[layerId] = labels;
        };

        var addObserver = function (layer) {
            var gmx = layer._gmx,
                filters = ['styleFilter', 'userFilter'],
                options = {
                    type: 'resend',
                    bbox: _this.bbox,
                    filters: filters,
                    callback: function(data) {
                        chkData(data, layer);
                        _this.redraw();
                    }
                };
            if (gmx.beginDate && gmx.endDate) {
                options.dateInterval = [gmx.beginDate, gmx.endDate];
            }
            return gmx.dataManager.addObserver(options, '_Labels');
        };
        this.add = function (layer) {
            var id = layer._leaflet_id,
                gmx = layer._gmx;

            if (!_this._observers[id] && gmx && gmx.labelsLayer && id) {
                gmx.styleManager.deferred.then(function () {
                    var observer = addObserver(layer);
                    if (!gmx.styleManager.isVisibleAtZoom(_this._map._zoom)) {
                        observer.deactivate();
                    }
                    _this._observers[id] = observer;
                    _this._styleManagers[id] = gmx.styleManager;

                    _this._labels['_' + id] = {};
                    _this._updateBbox();
                });
            }
        };
        this.remove = function (layer) {
            var id = layer._leaflet_id;
            if (_this._observers[id]) {
                var gmx = layer._gmx,
                    dataManager = gmx.dataManager;
                dataManager.removeObserver(_this._observers[id].id);
                delete _this._observers[id];
                delete _this._styleManagers[id];
                delete _this._labels['_' + id];
                _this.redraw();
            }
        };
        this._layeradd = function (ev) {
            _this.add(ev.layer);
        };
        this._layerremove = function (ev) {
            _this.remove(ev.layer);
        };
    },

    redraw: function () {
        if (!this._frame && !this._map._animating) {
            this._frame = L.Util.requestAnimFrame(this._redraw, this);
        }
        return this;
    },

    _addToPane: function () {
        var pane = this._map.getPanes()[this.options.pane];
        if (pane) {
            pane.insertBefore(this._canvas, pane.firstChild);
        }
    },

    onAdd: function (map) {
        this._map = map;

        if (!this._canvas) {
            this._initCanvas();
        }
        // this._addToPane();

        map.on('moveend', this._reset, this);
        map.on({
            layeradd: this._layeradd,
            layerremove: this._layerremove
        });
        if (map.options.zoomAnimation && L.Browser.any3d) {
            map.on('zoomanim', this._animateZoom, this);
        }

        this._reset();
    },

    onRemove: function (map) {
        if (this._canvas.parentNode) {
            this._canvas.parentNode.removeChild(this._canvas);
        }

        map.off('moveend', this._reset, this);
        map.off('layeradd', this._layeradd);
        map.off('layerremove', this._layerremove);

        if (map.options.zoomAnimation) {
            map.off('zoomanim', this._animateZoom, this);
        }
    },

    addTo: function (map) {
        map.addLayer(this);
        return this;
    },

    _initCanvas: function () {
        var canvas = L.DomUtil.create('canvas', 'leaflet-labels-layer leaflet-layer'),
            size = this._map.getSize();
        canvas.width  = size.x; canvas.height = size.y;
        canvas.style.pointerEvents = 'none';
        this._canvas = canvas;

        var animated = this._map.options.zoomAnimation && L.Browser.any3d;
        L.DomUtil.addClass(canvas, 'leaflet-zoom-' + (animated ? 'animated' : 'hide'));
    },

    _updateBbox: function () {
        var _map = this._map,
            screenBounds = _map.getBounds(),
            southWest = screenBounds.getSouthWest(),
            northEast = screenBounds.getNorthEast(),
            m1 = L.Projection.Mercator.project(southWest),
            m2 = L.Projection.Mercator.project(northEast);

        this.mInPixel = gmxAPIutils.getPixelScale(_map.getZoom());
        this._ctxShift = [m1.x * this.mInPixel, m2.y * this.mInPixel];
        for (var id in this._observers) {
            this._observers[id].setBounds({
                min: {x: southWest.lng, y: southWest.lat},
                max: {x: northEast.lng, y: northEast.lat}
            });
        }
    },

    _reset: function () {
        this._updateBbox();
        for (var id in this._observers) {
            var observer = this._observers[id];
            if (!observer.isActive() &&
                this._styleManagers[id].isVisibleAtZoom(this._map.getZoom())
            ) {
                observer.activate();
            }
            observer.fire('update');
        }
    },

    _redraw: function () {
        var out = [],
            _map = this._map,
            mapSize = _map.getSize(),
            _canvas = this._canvas,
            offset = _map.latLngToContainerPoint(_map.getBounds().getNorthWest()),
            topLeft = _map.containerPointToLayerPoint(offset);

		_canvas.width = mapSize.x; _canvas.height = mapSize.y;
        L.DomUtil.setPosition(_canvas, topLeft);

        var w2 = 2 * this.mInPixel * gmxAPIutils.worldWidthMerc,
            start = w2 * Math.floor(_map.getPixelBounds().min.x / w2),
            ctx = _canvas.getContext('2d'),
            i, len, it;

        for (var layerId in this._labels) {
            var labels = this._labels[layerId];
            for (var id in labels) {
                it = labels[id];
                var options = it.options,
                    label = options.label,
                    style = label.style,
                    width = label.width,
                    width2 = width / 2,
                    size = style.labelFontSize || 12,
                    size2 = size / 2,
                    center = options.center,
                    pos = [center[0] * this.mInPixel, center[1] * this.mInPixel],
                    isFiltered = false;

                if (label.isPoint) {
                    var labelAlign = style.labelAlign || 'center',
                        delta = label.sx;
                    if (labelAlign === 'left') {
                        pos[0] += width2 + delta;
                    } else if (labelAlign === 'right') {
                        pos[0] -= width + delta;
                    }
                }
                pos[0] -= width2 + this._ctxShift[0];
                pos[1] = size2 - pos[1] + this._ctxShift[1];
                if (style.labelAnchor) {
                    pos[0] += style.labelAnchor[0];
                    pos[1] += style.labelAnchor[1];
                }

                for (var tx = pos[0] + start; tx < mapSize.x; tx += w2) {
                    var coord = [Math.floor(tx), Math.floor(pos[1])],
                        bbox = gmxAPIutils.bounds([
                            [coord[0] - width2, coord[1] - size2],
                            [coord[0] + width2, coord[1] + size2]
                        ]);
                    for (i = 0, len = out.length; i < len; i++) {
                        if (bbox.intersects(out[i].bbox)) {
                            isFiltered = true;
                            break;
                        }
                    }
                    if (isFiltered) { continue; }

                    if (!options.labelStyle) {
                        options.labelStyle = {
                            font: size + 'px "Arial"',
                            fillStyle: gmxAPIutils.dec2color(style.labelColor || 0, 1),
                            shadowBlur: 4
                        };
                        if (style.labelHaloColor !== -1) {
                            options.labelStyle.strokeStyle =
                            options.labelStyle.shadowColor =
                                gmxAPIutils.dec2color(style.labelHaloColor, 1);
                        }
                    }
                    out.push({
                        arr: it.properties,
                        bbox: bbox,
                        txt: label.txt,
                        style: options.labelStyle,
                        coord: coord
                    });
                }
            }
        }
        if (out.length) {
            ctx.clearRect(0, 0, _canvas.width, _canvas.height);
            for (i = 0, len = out.length; i < len; i++) {
                it = out[i];
                gmxAPIutils.setLabel(ctx, it.txt, it.coord, it.style);
            }
            if (!_canvas.parentNode) { this._addToPane(); }
        } else if (_canvas.parentNode) {
            _canvas.parentNode.removeChild(_canvas);
        }

        this._frame = null;
    },

    _animateZoom: function (e) {
        var scale = this._map.getZoomScale(e.zoom),
            pixelBoundsMin = this._map.getPixelBounds().min;

        var offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());
        if (pixelBoundsMin.y < 0) {
            offset.y += pixelBoundsMin.multiplyBy(-scale).y;
        }

        this._canvas.style[L.DomUtil.TRANSFORM] = L.DomUtil.getTranslateString(offset) + ' scale(' + scale + ')';
    }
});

L.labelsLayer = function (map, options) {
    return new L.LabelsLayer(map, options);
};

L.Map.addInitHook(function () {
	// Check to see if Labels has already been initialized.
    if (!this._labelsLayer) {
        this._labelsLayer = new L.LabelsLayer(this);
        this._labelsLayer.addTo(this);
    }
});


(function() {
var isBoundsIntersects = function (bounds, clipPolygons) {
    for (var key in clipPolygons) {
        var arr = clipPolygons[key];
        for (var i = 0, len = arr.length; i < len; i++) {
            var it = arr[i],
                type = it.geometry.type,
                boundsArr = it.boundsArr;
            for (var j = 0, len1 = boundsArr.length; j < len1; j++) {
                var bbox = boundsArr[j];
                if (type === 'Polygon') { bbox = [bbox]; }
                for (var j1 = 0, len2 = bbox.length; j1 < len2; j1++) {
                    if (bbox[j1].intersects(bounds)) { return true; }
                }
            }
        }
    }
    return false;
};
var isObserverIntersects = function (observer, clipPolygons) {
    for (var key in clipPolygons) {
        var arr = clipPolygons[key];
        for (var i = 0, len = arr.length; i < len; i++) {
            var it = arr[i],
                type = it.geometry.type,
                boundsArr = it.boundsArr;
            for (var j = 0, len1 = boundsArr.length; j < len1; j++) {
                var bbox = boundsArr[j];
                if (type === 'Polygon') { bbox = [bbox]; }
                for (var j1 = 0, len2 = bbox.length; j1 < len2; j1++) {
                    if (observer.intersects(bbox[j1])) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
};

var isPointInClipPolygons = function (chkPoint, clipPolygons) {
    if (!clipPolygons || Object.keys(clipPolygons).length === 0) { return true; }
    for (var key in clipPolygons) {
        var arr = clipPolygons[key];
        for (var i = 0, len = arr.length; i < len; i++) {
            var it = arr[i],
                type = it.geometry.type,
                boundsArr = it.boundsArr;
            for (var j = 0, len1 = boundsArr.length; j < len1; j++) {
                var bbox = boundsArr[j];
                if (type === 'Polygon') { bbox = [bbox]; }
                for (var j1 = 0, len2 = bbox.length; j1 < len2; j1++) {
                    if (bbox[j1].contains(chkPoint)) {
                        var coords = it.geometry.coordinates,
                            isIn = false;
                        if (type === 'Polygon') { coords = [coords]; }
                        for (var j2 = 0, len3 = coords.length; j2 < len3; j2++) {
                            if (gmxAPIutils.isPointInPolygonWithHoles(chkPoint, coords[j2])) {
                                isIn = true;
                                break;
                            }
                        }
                        if (isIn) { return true; }
                    }
                }
            }
        }
    }
    return false;
};

var getClipPolygonItem = function (geo) {
    var geometry = gmxAPIutils.convertGeometry(geo),
        bboxArr = gmxAPIutils.geoItemBounds(geometry);
    bboxArr.geometry = geometry;
    return bboxArr;
};

var clipTileByPolygon = function (dattr) {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    var ctx = canvas.getContext('2d'),
        clipPolygons = dattr.clipPolygons;

    dattr.ctx = ctx;
    ctx.fillStyle = ctx.createPattern(dattr.tile, 'no-repeat');

    for (var key in clipPolygons) {
        var arr = clipPolygons[key];
        for (var i = 0, len = arr.length; i < len; i++) {
            var geo = arr[i].geometry,
                coords = geo.coordinates;
            if (geo.type === 'Polygon') { coords = [coords]; }
            for (var i1 = 0, len1 = coords.length; i1 < len1; i1++) {
                var coords1 = coords[i1];
                ctx.beginPath();
                for (var j1 = 0, len2 = coords1.length; j1 < len2; j1++) {
                    dattr.coords = coords1[j1];
                    var pixels = gmxAPIutils.getRingPixels(dattr);
                    dattr.coords = pixels.coords;
                    gmxAPIutils.polygonToCanvasFill(dattr);
                }
                ctx.closePath();
                ctx.fill();
            }
        }
    }
    ctx = dattr.tile.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(canvas, 0, 0);
};

L.gmx.VectorLayer.include({

    isPointInClipPolygons: function (point) { // point [x, y] in Mercator
        return isPointInClipPolygons(point, this._gmx._clipPolygons);
    },

    addClipPolygon: function (polygon) { // (L.Polygon) or (L.GeoJSON with Polygons)
        var item = [],
            i, len;

        if ('coordinates' in polygon && 'type' in polygon) {
            item.push(getClipPolygonItem(polygon));
        } else if (polygon instanceof L.Polygon) {
            item.push(getClipPolygonItem(polygon.toGeoJSON().geometry));
        } else if (polygon instanceof L.GeoJSON) {
            var layers = polygon.getLayers();
            for (i = 0, len = layers.length; i < len; i++) {
                var layer = layers[i];
                if (layer instanceof L.Polygon && layer.feature) {
                    item.push(getClipPolygonItem(layer.feature.geometry));
                } else if (layer instanceof L.MultiPolygon && layer.feature) {
                    item.push(getClipPolygonItem(layer.feature.geometry));
                }
            }
        }
        if (item.length) {
            var gmx = this._gmx,
                dataManager = gmx.dataManager,
                _this = this,
                id = L.stamp(polygon);

            if (!this._gmx._clipPolygons) { this._gmx._clipPolygons = {}; }
            this._gmx._clipPolygons[id] = item;
            dataManager.setTileFilteringHook(function (tile) {
                return isBoundsIntersects(tile.bounds, _this._gmx._clipPolygons);
            });

            dataManager.addFilter('clipFilter', function (item, tile, observer) {
                return isObserverIntersects(observer, _this._gmx._clipPolygons);
            });

            dataManager.addFilter('clipPointsFilter', function (item) {
                if (item.type === 'POINT') {
                    var propArr = item.properties,
                        geom = propArr[propArr.length - 1];
                    return isPointInClipPolygons(geom.coordinates, _this._gmx._clipPolygons);
                }
                return true;
            });
            if (Object.keys(this._gmx._clipPolygons).length === 1) {
                gmx.renderHooks.unshift(function (tile, hookInfo) {
                    if (tile && Object.keys(_this._gmx._clipPolygons).length > 0) {
                        clipTileByPolygon({
                            tile: tile,
                            tpx: hookInfo.tpx,
                            tpy: hookInfo.tpy,
                            gmx: {mInPixel: gmx.mInPixel},
                            clipPolygons: _this._gmx._clipPolygons
                        });
                    }
                });
            }
        }
        return this;
    },

    removeClipPolygon: function (polygon) {
        var id = L.stamp(polygon);
        if (this._gmx._clipPolygons) {
            delete this._gmx._clipPolygons[id];
            if (Object.keys(this._gmx._clipPolygons).length === 0) {
                this._gmx.dataManager.removeTileFilteringHook();
                this._gmx.dataManager.removeFilter('clipFilter');
            }
        }
        return this;
    }
});
})();


L.gmx.gmxImageTransform = function(img, hash) {
    var gmx = hash.gmx,
        gmxTilePoint = hash.gmxTilePoint,
        mInPixel = gmx.mInPixel,
        geoItem = hash.geoItem,
        properties = geoItem.properties,
        dataOption = geoItem.dataOption || {},
        geom = properties[properties.length - 1],
        coord = geom.coordinates[0],
        indexes = gmx.tileAttributeIndexes,
        quicklookPlatform = properties[indexes[gmx.quicklookPlatform]] || gmx.quicklookPlatform || '',
        points = {};

    if (geom.type === 'MULTIPOLYGON') { coord = coord[0]; }
    if (quicklookPlatform === 'LANDSAT8') {
        points.x1 = dataOption.bounds.min.x; points.y1 = dataOption.bounds.max.y;
        points.x2 = dataOption.bounds.max.x; points.y2 = dataOption.bounds.max.y;
        points.x3 = dataOption.bounds.max.x; points.y3 = dataOption.bounds.min.y;
        points.x4 = dataOption.bounds.min.x; points.y4 = dataOption.bounds.min.y;
    } else {
        points = gmxAPIutils.getQuicklookPointsFromProperties(properties, gmx);
    }

    var x1 = mInPixel * points.x1, y1 = mInPixel * points.y1,
        x2 = mInPixel * points.x2, y2 = mInPixel * points.y2,
        x3 = mInPixel * points.x3, y3 = mInPixel * points.y3,
        x4 = mInPixel * points.x4, y4 = mInPixel * points.y4,
        boundsP = gmxAPIutils.bounds([[x1, y1], [x2, y2], [x3, y3], [x4, y4]]),
        ww = Math.round(boundsP.max.x - boundsP.min.x),
        hh = Math.round(boundsP.max.y - boundsP.min.y),
        dx = boundsP.min.x - 256 * gmxTilePoint.x,
        dy = 256 - boundsP.max.y + 256 * gmxTilePoint.y;

    x1 -= boundsP.min.x; y1 = boundsP.max.y - y1;
    x2 -= boundsP.min.x; y2 = boundsP.max.y - y2;
    x3 -= boundsP.min.x; y3 = boundsP.max.y - y3;
    x4 -= boundsP.min.x; y4 = boundsP.max.y - y4;

    var shiftPoints = [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];

    if (!gmx.ProjectiveImage) {
        gmx.ProjectiveImage = (gmx.useWebGL ? L.gmx.projectiveImageWebGL() : null) || L.gmx.projectiveImage();
    }
    var pt = gmx.ProjectiveImage.getCanvas({
        imageObj: img,
        points: shiftPoints,
        wView: ww,
        hView: hh,
        deltaX: dx,
        deltaY: dy
    });
    return pt.canvas;
};


(function() {
var ProjectiveImageWebGL = L.Class.extend({
    options: {
        antialias: true,
        depth: false,
        preserveDrawingBuffer: true,
        shaderVS: 'attribute vec2 aVertCoord;\
            uniform mat4 uTransformMatrix;\
            varying vec2 vTextureCoord;\
            void main(void) {\
                vTextureCoord = aVertCoord;\
                gl_Position = uTransformMatrix * vec4(aVertCoord, 0.0, 1.0);\
            }\
        ',
        shaderFS: 'precision mediump float;\
            varying vec2 vTextureCoord;\
            uniform sampler2D uSampler;\
            void main(void) {\
                gl_FragColor = texture2D(uSampler, vTextureCoord);\
            }\
        '
    },

    setOptions: function(options) {
        L.setOptions(this, options);
    },

    initialize: function(options) {
        this.setOptions(options);

        var canvas = document.createElement('canvas'),
            glOpts = {
                antialias: this.options.antialias,
                depth: this.options.depth,
                preserveDrawingBuffer: this.options.preserveDrawingBuffer
            },
            gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
        if (!gl) { return; }
        var glResources = this._setupGlContext(gl);
        if (!glResources) { return; }

        canvas.width = canvas.height = 256;
        glResources.canvas = canvas;

        this.glResources = glResources;
        this.canvas = canvas;
        this.gl = gl;
    },

    _getShader: function (type, source, gl) {
        var shader = gl.createShader(type);

        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    },

    _setupGlContext: function (gl) {
        // Store return values here
        var vertexShader = this._getShader(gl.VERTEX_SHADER, this.options.shaderVS, gl),
            fragmentShader = this._getShader(gl.FRAGMENT_SHADER, this.options.shaderFS, gl);

        if (vertexShader && fragmentShader) {
            // Compile the program
            var shaderProgram = gl.createProgram();
            gl.attachShader(shaderProgram, vertexShader);
            gl.attachShader(shaderProgram, fragmentShader);
            gl.linkProgram(shaderProgram);

            if (gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                // Find and set up the uniforms and attributes
                gl.useProgram(shaderProgram);
                this.vertices = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
                var vertexBuffer = gl.createBuffer(),    // Create a buffer to hold the vertices
                    vertAttrib = gl.getAttribLocation(shaderProgram, 'aVertCoord');
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.vertices), gl.STATIC_DRAW);

                // draw the triangles
                gl.enableVertexAttribArray(vertAttrib);
                gl.vertexAttribPointer(vertAttrib, 2, gl.FLOAT, false, 0, 0);
                return {
                    transMatUniform: gl.getUniformLocation(shaderProgram, 'uTransformMatrix'),
                    samplerUniform: gl.getUniformLocation(shaderProgram, 'uSampler'),
                    screenTexture: gl.createTexture() // Create a texture to use for the screen image
                };
            }
        }
        return null;
    },

    _bindTexture: function (gl, image, texture) {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        // gl.NEAREST is also allowed, instead of gl.LINEAR, as neither mipmap.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        // Prevents s-coordinate wrapping (repeating).
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        // Prevents t-coordinate wrapping (repeating).
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
    },

    getCanvas: function (attr) {
        var p = attr.points,
            deltaX = attr.deltaX,
            deltaY = attr.deltaY,
            dstPoints = new Float32Array([
                (p[0][0] + deltaX) / 128 - 1, 1 - (p[0][1] + deltaY) / 128,
                (p[1][0] + deltaX) / 128 - 1, 1 - (p[1][1] + deltaY) / 128,
                (p[3][0] + deltaX) / 128 - 1, 1 - (p[3][1] + deltaY) / 128,
                (p[2][0] + deltaX) / 128 - 1, 1 - (p[2][1] + deltaY) / 128
            ]);

        var v = ProjectiveImageWebGL.Utils.general2DProjection(this.vertices, dstPoints),
            gl = this.gl,
            glResources = this.glResources;

        this._bindTexture(gl, attr.imageObj, glResources.screenTexture);

        gl.viewport(0, 0, 256, 256);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);    // set background to full transparency

        gl.uniformMatrix4fv(
            glResources.transMatUniform,
            false, [
                v[0], v[3],    0, v[6],
                v[1], v[4],    0, v[7],
                   0,    0,    1,    0,
                v[2], v[5],    0,    1
            ]);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, glResources.screenTexture);
        gl.uniform1i(glResources.samplerUniform, 0);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        return this;
    }
});

function adj(m) { // Compute the adjugate of m
    return [
        m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
        m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
        m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]
    ];
}

function multmm(a, b) { // multiply two matrices
    var c = Array(9);
    for (var i = 0; i !== 3; ++i) {
        for (var j = 0; j !== 3; ++j) {
            var cij = 0;
            for (var k = 0; k !== 3; ++k) {
                cij += a[3 * i + k] * b[3 * k + j];
            }
            c[3 * i + j] = cij;
        }
    }
    return c;
}

function multmv(m, v) { // multiply matrix and vector
    return [
        m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
        m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
        m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
}

function basisToPoints(p) {
    var m = [
        p[0], p[2], p[4],
        p[1], p[3], p[5],
        1,  1,  1
    ];
    var v = multmv(adj(m), [p[6], p[7], 1]);
    return multmm(m, [
        v[0], 0, 0,
        0, v[1], 0,
        0, 0, v[2]
    ]);
}

ProjectiveImageWebGL.Utils = {
    general2DProjection: function(from, to) {
        var arr = multmm(basisToPoints(to), adj(basisToPoints(from)));
        if (arr[8]) {
            for (var i = 0; i !== 9; ++i) {
                arr[i] = arr[i] / arr[8];
            }
        }
        return arr;
    },

    getWebGlResources: function(options) {
        var obj = new ProjectiveImageWebGL(options);
        return obj.gl ? obj : null;
    }
};
L.gmx.projectiveImageWebGL = function(options) {
    var res = new ProjectiveImageWebGL(options);
    return res.gl ? res : null;
};
})();


(function() {
// ProjectiveImage - projective transform that maps [0,1]x[0,1] onto the given set of points.
var ProjectiveImage = function() {
	var cnt = 0,
        limit = 4,
        patchSize = 64,
        transform = null;

	var allocate = function (w, h) {
	  var values = [];
	  for (var i = 0; i < h; ++i) {
		values[i] = [];
		for (var j = 0; j < w; ++j) {
		  values[i][j] = 0;
		}
	  }
	  return values;
	};

	var Matrix = function (w, h, values) {
	  this.w = w;
	  this.h = h;
	  this.values = values || allocate(h);
	};

	var cloneValues = function (values) {
		var clone = [];
		for (var i = 0; i < values.length; ++i) {
			clone[i] = [].concat(values[i]);
		}
		return clone;
	};

	Matrix.prototype = {
		add : function (operand) {
			if (operand.w !== this.w || operand.h !== this.h) {
				throw new Error('Matrix add size mismatch');
			}

			var values = allocate(this.w, this.h);
			for (var y = 0; y < this.h; ++y) {
				for (var x = 0; x < this.w; ++x) {
				  values[y][x] = this.values[y][x] + operand.values[y][x];
				}
			}
			return new Matrix(this.w, this.h, values);
		},
		transformProjectiveVector : function (operand) {
			var out = [], x, y;
			for (y = 0; y < this.h; ++y) {
				out[y] = 0;
				for (x = 0; x < this.w; ++x) {
					out[y] += this.values[y][x] * operand[x];
				}
			}
			var zn = out[out.length - 1];
			if (zn) {
				var iz = 1 / (out[out.length - 1]);
				for (y = 0; y < this.h; ++y) {
					out[y] *= iz;
				}
			}
			return out;
		},
		multiply : function (operand) {
			var values, x, y;
			if (+operand !== operand) {
				// Matrix mult
				if (operand.h !== this.w) {
					throw new Error('Matrix mult size mismatch');
				}
				values = allocate(this.w, this.h);
				for (y = 0; y < this.h; ++y) {
					for (x = 0; x < operand.w; ++x) {
						var accum = 0;
						for (var s = 0; s < this.w; s++) {
							accum += this.values[y][s] * operand.values[s][x];
						}
						values[y][x] = accum;
					}
				}
				return new Matrix(operand.w, this.h, values);
			}
			else {
				// Scalar mult
				values = allocate(this.w, this.h);
				for (y = 0; y < this.h; ++y) {
					for (x = 0; x < this.w; ++x) {
						values[y][x] = this.values[y][x] * operand;
					}
				}
				return new Matrix(this.w, this.h, values);
			}
		},
		rowEchelon : function () {
			if (this.w <= this.h) {
				throw new Error('Matrix rowEchelon size mismatch');
			}

			var temp = cloneValues(this.values);

			// Do Gauss-Jordan algorithm.
			for (var yp = 0; yp < this.h; ++yp) {
				// Look up pivot value.
				var pivot = temp[yp][yp];
				while (pivot === 0) {
					// If pivot is zero, find non-zero pivot below.
					for (var ys = yp + 1; ys < this.h; ++ys) {
						if (temp[ys][yp] !== 0) {
							// Swap rows.
							var tmpRow = temp[ys];
							temp[ys] = temp[yp];
							temp[yp] = tmpRow;
							break;
						}
					}
					if (ys === this.h) {
						// No suitable pivot found. Abort.
						return new Matrix(this.w, this.h, temp);
					}
					else {
						pivot = temp[yp][yp];
					}
				}
				// Normalize this row.
				var scale = 1 / pivot;
				for (var x = yp; x < this.w; ++x) {
					temp[yp][x] *= scale;
				}
				// Subtract this row from all other rows (scaled).
				for (var y = 0; y < this.h; ++y) {
					if (y === yp) { continue; }
					var factor = temp[y][yp];
					temp[y][yp] = 0;
					for (x = yp + 1; x < this.w; ++x) {
						temp[y][x] -= factor * temp[yp][x];
					}
				}
			}

			return new Matrix(this.w, this.h, temp);
		},
		invert : function () {
			var x, y;

			if (this.w !== this.h) {
				throw new Error('Matrix invert size mismatch');
			}

			var temp = allocate(this.w * 2, this.h);

			// Initialize augmented matrix
			for (y = 0; y < this.h; ++y) {
				for (x = 0; x < this.w; ++x) {
					temp[y][x] = this.values[y][x];
					temp[y][x + this.w] = (x === y) ? 1 : 0;
				}
			}

			temp = new Matrix(this.w * 2, this.h, temp);
			temp = temp.rowEchelon();

			// Extract right block matrix.
			var values = allocate(this.w, this.h);
			for (y = 0; y < this.w; ++y) {
				// @todo check if "x < this.w;" is mistake
				for (x = 0; x < this.w; ++x) {
					values[y][x] = temp.values[y][x + this.w];
				}
			}
			return new Matrix(this.w, this.h, values);
		}
	};

	var getProjectiveTransform = function (points) {
	  var eqMatrix = new Matrix(9, 8, [
		[1, 1, 1,   0, 0, 0, -points[2][0], -points[2][0], -points[2][0]],
		[0, 1, 1,   0, 0, 0,  0, -points[3][0], -points[3][0]],
		[1, 0, 1,   0, 0, 0, -points[1][0], 0, -points[1][0]],
		[0, 0, 1,   0, 0, 0,  0, 0, -points[0][0]],

		[0, 0, 0,  -1, -1, -1,  points[2][1], points[2][1], points[2][1]],
		[0, 0, 0,   0, -1, -1,  0, points[3][1], points[3][1]],
		[0, 0, 0,  -1,  0, -1,  points[1][1], 0, points[1][1]],
		[0, 0, 0,   0,  0, -1,  0, 0, points[0][1]]

	  ]);

	  var kernel = eqMatrix.rowEchelon().values;
	  var transform = new Matrix(3, 3, [
		[-kernel[0][8], -kernel[1][8], -kernel[2][8]],
		[-kernel[3][8], -kernel[4][8], -kernel[5][8]],
		[-kernel[6][8], -kernel[7][8],             1]
	  ]);
	  return transform;
	};

	var divide = function (u1, v1, u4, v4, p1, p2, p3, p4, limit, attr) {
		if (limit) {
			// Measure patch non-affinity.
			var d1 = [p2[0] + p3[0] - 2 * p1[0], p2[1] + p3[1] - 2 * p1[1]];
			var d2 = [p2[0] + p3[0] - 2 * p4[0], p2[1] + p3[1] - 2 * p4[1]];
			var d3 = [d1[0] + d2[0], d1[1] + d2[1]];
			var r = Math.abs((d3[0] * d3[0] + d3[1] * d3[1]) / (d1[0] * d2[0] + d1[1] * d2[1]));

			// Measure patch area.
			d1 = [p2[0] - p1[0] + p4[0] - p3[0], p2[1] - p1[1] + p4[1] - p3[1]];
			d2 = [p3[0] - p1[0] + p4[0] - p2[0], p3[1] - p1[1] + p4[1] - p2[1]];
			var area = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);

			// Check area > patchSize pixels (note factor 4 due to not averaging d1 and d2)
			// The non-affinity measure is used as a correction factor.
			if ((u1 === 0 && u4 === 1) || ((.25 + r * 5) * area > (patchSize * patchSize))) {
				// Calculate subdivision points (middle, top, bottom, left, right).
				var umid = (u1 + u4) / 2;
				var vmid = (v1 + v4) / 2;
				var pmid = transform.transformProjectiveVector([umid, vmid, 1]);
				var pt   = transform.transformProjectiveVector([umid, v1, 1]);
				var pb   = transform.transformProjectiveVector([umid, v4, 1]);
				var pl   = transform.transformProjectiveVector([u1, vmid, 1]);
				var pr   = transform.transformProjectiveVector([u4, vmid, 1]);

				// Subdivide.
				limit--;
				divide.call(this, u1,   v1, umid, vmid,   p1,   pt,   pl, pmid, limit, attr);
				divide.call(this, umid,   v1,   u4, vmid,   pt,   p2, pmid,   pr, limit, attr);
				divide.call(this, u1,  vmid, umid,   v4,   pl, pmid,   p3,   pb, limit, attr);
				divide.call(this, umid, vmid,   u4,   v4, pmid,   pr,   pb,   p4, limit, attr);
				return;
			}
		}

		var ctx = attr.ctx;

		// Get patch edge vectors.
		var d12 = [p2[0] - p1[0], p2[1] - p1[1]];
		var d24 = [p4[0] - p2[0], p4[1] - p2[1]];
		var d43 = [p3[0] - p4[0], p3[1] - p4[1]];
		var d31 = [p1[0] - p3[0], p1[1] - p3[1]];

		// Find the corner that encloses the most area
		var a1 = Math.abs(d12[0] * d31[1] - d12[1] * d31[0]);
		var a2 = Math.abs(d24[0] * d12[1] - d24[1] * d12[0]);
		var a4 = Math.abs(d43[0] * d24[1] - d43[1] * d24[0]);
		var a3 = Math.abs(d31[0] * d43[1] - d31[1] * d43[0]);
		var amax = Math.max(Math.max(a1, a2), Math.max(a3, a4));
		var dx = 0, dy = 0, padx = 0, pady = 0;

		// Align the transform along this corner.
		// Calculate 1.05 pixel padding on vector basis.
		if (amax === a1) {
				ctx.setTransform(d12[0], d12[1], -d31[0], -d31[1], p1[0] + attr.deltaX, p1[1] + attr.deltaY);
				if (u4 !== 1) { padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]); }
				if (v4 !== 1) { pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]); }
		} else if (amax === a2) {
				ctx.setTransform(d12[0], d12[1],  d24[0],  d24[1], p2[0] + attr.deltaX, p2[1] + attr.deltaY);
				if (u4 !== 1) { padx = 1.05 / Math.sqrt(d12[0] * d12[0] + d12[1] * d12[1]); }
				if (v4 !== 1) { pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]); }
				dx = -1;
		} else if (amax === a4) {
				ctx.setTransform(-d43[0], -d43[1], d24[0], d24[1], p4[0] + attr.deltaX, p4[1] + attr.deltaY);
				if (u4 !== 1) { padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]); }
				if (v4 !== 1) { pady = 1.05 / Math.sqrt(d24[0] * d24[0] + d24[1] * d24[1]); }
				dx = -1;
				dy = -1;
		} else if (amax === a3) {
				ctx.setTransform(-d43[0], -d43[1], -d31[0], -d31[1], p3[0] + attr.deltaX, p3[1] + attr.deltaY);
				if (u4 !== 1) { padx = 1.05 / Math.sqrt(d43[0] * d43[0] + d43[1] * d43[1]); }
				if (v4 !== 1) { pady = 1.05 / Math.sqrt(d31[0] * d31[0] + d31[1] * d31[1]); }
				dy = -1;
		}

		// Calculate image padding to match.
		var du = (u4 - u1);
		var dv = (v4 - v1);
		padx++;
		pady++;

        var iw = attr.imageObj.width,
            ih = attr.imageObj.height,
            sx = Math.floor(u1 * iw),
            sy = Math.floor(v1 * ih),
            sw = Math.floor(Math.min(padx * du, 1) * iw),
            sh = Math.floor(Math.min(pady * dv, 1) * ih);

		cnt++;
        ctx.drawImage(
            attr.imageObj,
            sx, sy,
            sw, sh,
            dx, dy,
            padx, pady
        );
	};

	this.getCanvas = function (attr) {
		cnt = 0;
		transform = getProjectiveTransform(attr.points);
		// Begin subdivision process.

		var ptl = transform.transformProjectiveVector([0, 0, 1]),
            ptr = transform.transformProjectiveVector([1, 0, 1]),
            pbl = transform.transformProjectiveVector([0, 1, 1]),
            pbr = transform.transformProjectiveVector([1, 1, 1]);

		var canvas = document.createElement('canvas');
		canvas.width = canvas.height = 256;
		attr.canvas = canvas;
		attr.ctx = canvas.getContext('2d');

		var	boundsP = gmxAPIutils.bounds([ptl, ptr, pbr, pbl]),
            maxSize = Math.max(boundsP.max.x - boundsP.min.x, boundsP.max.y - boundsP.min.y);

		limit = 'limit' in attr ? attr.limit : (maxSize < 200 ? 1 : 4);
		patchSize = 'patchSize' in attr ? attr.patchSize : maxSize / 8;

		try {
			divide(0, 0, 1, 1, ptl, ptr, pbl, pbr, limit, attr);
		} catch (e) {
			console.log('Error: ProjectiveImage event:', e);
			canvas = null;
		}
		return {
			canvas: canvas,
			ptl: ptl,
			ptr: ptr,
			pbl: pbl,
			pbr: pbr,
			cnt: cnt
		};
	};
};
L.gmx.projectiveImage = function() {
    return new ProjectiveImage();
};
})();


// https://github.com/bbecquet/Leaflet.PolylineDecorator/blob/master/src/L.RotatedMarker.js

L.RotatedMarker = L.Marker.extend({
    options: {
        angle: 0
    },

    statics: {
        TRANSFORM_ORIGIN: L.DomUtil.testProp(
            ['transformOrigin', 'WebkitTransformOrigin', 'OTransformOrigin', 'MozTransformOrigin', 'msTransformOrigin'])
    },

    _initIcon: function() {
        L.Marker.prototype._initIcon.call(this);

        this._icon.style[L.RotatedMarker.TRANSFORM_ORIGIN] = this._getTransformOrigin();
    },

    _getTransformOrigin: function() {
        var iconAnchor = this.options.icon.options.iconAnchor;

        if (!iconAnchor) {
            return '50% 50%';
        }

        return iconAnchor[0] + 'px ' + iconAnchor[1] + 'px';
    },

    _setPos: function(pos) {
        L.Marker.prototype._setPos.call(this, pos);

        if (L.DomUtil.TRANSFORM) {
            // use the CSS transform rule if available
            this._icon.style[L.DomUtil.TRANSFORM] += ' rotate(' + this.options.angle + 'deg)';
        } else if (L.Browser.ie) {
            // fallback for IE6, IE7, IE8
            var rad = this.options.angle * (Math.PI / 180),
                costheta = Math.cos(rad),
                sintheta = Math.sin(rad);
            this._icon.style.filter += ' progid:DXImageTransform.Microsoft.Matrix(sizingMethod=\'auto expand\', M11=' +
                costheta + ', M12=' + (-sintheta) + ', M21=' + sintheta + ', M22=' + costheta + ')';
        }
    },

    setAngle: function(ang) {
        this.options.angle = ang;
    }
});

L.rotatedMarker = function(pos, options) {
    return new L.RotatedMarker(pos, options);
};


L.gmx.ExternalLayer = L.Class.extend({
    createExternalLayer: function () {          // extend: must return <ILayer> or null = this.externalLayer
        return null;
    },

    isExternalVisible: function (/*zoom*/) {    // extend: return true view this.externalLayer, return false view this.parentLayer
        return true;
    },

    updateData: function (/*data*/) {           // extend: for data update in this.externalLayer
    },

    setDateInterval: function () {
        if (this._observer) {
            var gmx = this.parentLayer._gmx;
            this._observer.setDateInterval(gmx.beginDate, gmx.endDate);
        }
    },

    options: {
        useDataManager: true,
        observerOptions: {
            filters: ['clipFilter', 'userFilter', 'clipPointsFilter']
        }
    },

    initialize: function (options, layer) {
        L.setOptions(this, options);
        this.parentLayer = layer;
        layer
            .on('add', this._addEvent, this)
            .on('dateIntervalChanged', this.setDateInterval, this);

        if (this.options.useDataManager) {
            this._addObserver(this.options.observerOptions);
        }

        this.externalLayer = this.createExternalLayer();

        if (layer._map) {
            this._addEvent({target:{_map: layer._map}});
            this._updateBbox();
        }
    },

    _addObserver: function (opt) {
        this._items = {};
        this._observer = this.parentLayer.addObserver(
            L.extend({
                bbox: gmxAPIutils.bounds([[Number.MAX_VALUE, Number.MAX_VALUE]]),
                callback: L.bind(this.updateData, this)
            }, opt)
        ).deactivate();
    },

    unbindLayer: function () {
        this.parentLayer
            .off('add', this._addEvent, this)
            .off('dateIntervalChanged', this.setDateInterval, this);

        if (this._observer) { delete this.parentLayer.repaintObservers[this._observer.id]; }
        var map = this._map || this.parentLayer._map;
        this._onRemove(!map);
        this._removeMapHandlers();
    },

    _addMapHandlers: function (map) {
        this._map = map;
        this._map.on({
            moveend: this._updateBbox,
            zoomend: this._chkZoom,
            layeradd: this._layeradd,
            layerremove: this._layerremove
        }, this);
    },

    _removeMapHandlers: function () {
        if (this._map) {
            this._map.off({
                moveend: this._updateBbox,
                zoomend: this._chkZoom,
                layeradd: this._layeradd,
                layerremove: this._layerremove
            }, this);
        }
        this._map = null;
    },

    _addEvent: function (ev) {
        this._addMapHandlers(ev.target._map);
        this._updateBbox();
        this._chkZoom();
    },

    _isParentLayer: function (ev) {
        var layer = ev.layer;
        return layer._gmx && layer._gmx.layerID === this.parentLayer.options.layerID;
    },

    _layeradd: function (ev) {
        if (this._isParentLayer(ev)) {
            this._chkZoom();
        }
    },

    _layerremove: function (ev) {
        if (this._isParentLayer(ev)) {
            this._onRemove(true);
            this._removeMapHandlers();
        }
    },

    _onRemove: function (fromMapFlag) {    // remove external layer from parent layer
        if (this._observer) {
            this._observer.deactivate();
        }
        var map = this._map;
        if (map) {
            if (map.hasLayer(this.externalLayer)) {
                this._chkZoom();
                map.removeLayer(this.externalLayer);
            }
            if (!fromMapFlag) {
                this.parentLayer.onAdd(map);
            }
        }
    },

    _chkZoom: function () {
        if (!this._map) { return; }

        var layer = this.parentLayer,
            observer = this._observer,
            map = this._map,
            isExtLayerOnMap = map.hasLayer(this.externalLayer);

        layer.setCurrentZoom(map);
        if (!this.isExternalVisible(map.getZoom())) {
            if (observer) { observer.deactivate(); }
            if (!layer._map) {
                if (isExtLayerOnMap) {
                    map.removeLayer(this.externalLayer);
                }
                layer.onAdd(map);
            }
            layer.enablePopup();
        } else if (layer._map) {
            layer.onRemove(map);
            if (!isExtLayerOnMap) {
                map.addLayer(this.externalLayer);
            }
            this.setDateInterval();
            if (observer) {
                layer.getIcons(function () {
                    observer.activate();
                }.bind(this));
            }
            layer.disablePopup();
        }
    },


    _updateBbox: function () {
        if (!this._map || !this._observer) { return; }

        var screenBounds = this._map.getBounds(),
            p1 = screenBounds.getNorthWest(),
            p2 = screenBounds.getSouthEast(),
            bbox = L.gmxUtil.bounds([[p1.lng, p1.lat], [p2.lng, p2.lat]]);
        this._observer.setBounds(bbox);
    }
});


(function() {
    'use strict';
    var BindWMS = L.gmx.ExternalLayer.extend({
        options: {
            minZoom: 1,
            maxZoom: 6,
            useDataManager: false,
            format: 'png',
            transparent: true
        },

        createExternalLayer: function () {
            var poptions = this.parentLayer.options,
                opt = {
                    map: poptions.mapID,
                    layers: poptions.layerID,
                    format: this.options.format,
                    transparent: this.options.transparent
                },
                rawProperties = this.parentLayer.getGmxProperties();

            if (rawProperties && rawProperties.Temporal) { this._extendOptionsByDateInterval(opt); }
            if (this.options.apikey) { opt.apikey = this.options.apikey; }
            return L.tileLayer.wms('http://' + poptions.hostName + '/TileService.ashx', opt);
        },

        _extendOptionsByDateInterval: function (options) {
            var dateInterval = this.parentLayer.getDateInterval(),
                beginDate = dateInterval.beginDate,
                endDate = dateInterval.endDate;
            L.extend(options, {
                StartDate: beginDate && beginDate.toLocaleDateString(),
                EndDate: endDate && endDate.toLocaleDateString()
            });
        },

        setDateInterval: function () {
            this._extendOptionsByDateInterval(this.externalLayer.wmsParams);
            this.externalLayer.redraw();
        },

        isExternalVisible: function (zoom) {
            return !(zoom < this.options.minZoom || zoom > this.options.maxZoom);
        }
    });

    L.gmx.VectorLayer.include({
        bindWMS: function (options) {
            if (this._layerWMS) {
                this._layerWMS.unbindLayer();
            }
            this._layerWMS = new BindWMS(options, this);
            this.isExternalVisible = this._layerWMS.isExternalVisible;
            return this;
        },

        unbindWMS: function () {
            if (this._layerWMS) {
                this._layerWMS.unbindLayer();
                this._layerWMS = null;
                this.isExternalVisible = null;
                this.enablePopup();
            }
            return this;
        }
    });
})();


(function() {
    'use strict';
    var GmxHeatMap = L.gmx.ExternalLayer.extend({
        options: {
            minHeatMapZoom: 1,
            maxHeatMapZoom: 6,
            intensityField: '',
            intensityScale: 1,
            observerOptions: {
                type: 'resend'
            }
        },

        createExternalLayer: function () {
            return L.heatLayer([], L.extend({
                 // minOpacity: 0.05,
                 // maxZoom: 18,
                 // radius: 25,
                 // blur: 15,
                 // max: 1.0
            }, this.options));
        },

        isExternalVisible: function (zoom) {
            return !(zoom < this.options.minHeatMapZoom || zoom > this.options.maxHeatMapZoom);
        },

        updateData: function (data) {
            if (data.added) {
                var latlngs = [],
                    indexes = this.parentLayer.getTileAttributeIndexes(),
                    altIndex = null,
                    intensityField = this.options.intensityField || '',
                    intensityScale = this.options.intensityScale || 1;

                if (intensityField && intensityField in indexes) {
                    altIndex = indexes[intensityField];
                }
                for (var i = 0, len = data.added.length; i < len; i++) {
                    var it = data.added[i].properties,
                        alt = altIndex !== null ? it[altIndex] : 1,
                        geo = it[it.length - 1],
                        coord = geo.coordinates,
                        point = L.Projection.Mercator.unproject({x: coord[0], y: coord[1]});

                    latlngs.push([point.lat, point.lng, typeof intensityScale === 'function' ? intensityScale(alt) : intensityScale * alt]);
                }
                this.externalLayer.setLatLngs(latlngs);
            }
        }
    });


    L.gmx.VectorLayer.include({
        bindHeatMap: function (options) {
            if (L.heatLayer) {
                if (this._heatmap) {
                    this._heatmap.unbindLayer();
                }
                this._heatmap = new GmxHeatMap(options, this);
            }
            return this;
        },

        unbindHeatMap: function () {
            if (L.heatLayer) {
                if (this._heatmap) {
                    this._heatmap.unbindLayer();
                    this._heatmap = null;
                    this.enablePopup();
                }
            }
            return this;
        }
    });
})();


(function() {
    'use strict';
    var _DEFAULTS = {
        radiusFunc: function (count) {
            var r = Math.floor(count / 15);
            if (r > 40) {
                r = 40;
            } else if (r < 20) {
                r = 20;
            }
            return r;
        },
        text: {
            stroke: 'black',
            'stroke-width': 1,
            'text-anchor': 'middle',
            fill: 'white'
        }
    };
    var GmxMarkerCluster = L.gmx.ExternalLayer.extend({
        options: {
            observerOptions: {
                filters: ['clipFilter', 'styleFilter', 'userFilter', 'clipPointsFilter']
            },
            spiderfyOnMaxZoom: true,
            minZoom: 1,
            maxZoom: 6
        },

        createExternalLayer: function () {
            var mOptions = L.extend({
                showCoverageOnHover: false,
                disableClusteringAtZoom: 1 + Number(this.options.maxZoom)
            }, this.options);

            if ('clusterIconOptions' in this.options) {
                var opt = this.options.clusterIconOptions;
                if ('radialGradient' in opt) {
                    var radialGradient = opt.radialGradient,
                        text = opt.text || _DEFAULTS.text;
                    mOptions.iconCreateFunction = function (cluster) {
                        var childCount = cluster.getChildCount();

                        text.count = childCount;
                        return  L.gmxUtil.getSVGIcon({
                            type: 'circle',
                            iconSize: 2 * (radialGradient.radiusFunc || _DEFAULTS.radiusFunc)(childCount),
                            text: text,
                            fillRadialGradient: radialGradient
                        });
                    };
                }
            }

            if (this.options.clusterclick) {
                mOptions.clusterclick = this.options.clusterclick;
                if (mOptions.clusterclick === true) { mOptions.zoomToBoundsOnClick = false; }
            }

            this._popup = new L.Popup({maxWidth: 10000, className: 'gmxPopup'});
            var markers = new L.MarkerClusterGroup(mOptions);

            // текущий развёрнутый кластер
            var currentSpiderfiedCluster = null;

            markers
                .on('click', function (ev) {
                    var propsArr = ev.layer.options.properties,
                        properties = this.parentLayer.getItemProperties(propsArr),
                        geometry = [propsArr[propsArr.length - 1]],
                        id = propsArr[0];

                    if (currentSpiderfiedCluster && !(currentSpiderfiedCluster.getAllChildMarkers().indexOf(ev.layer) + 1)) {
                        currentSpiderfiedCluster.unspiderfy();
                        markers.once('unspiderfied', function () {
                            this._openPopup(propsArr, ev.latlng);
                        }, this);
                    } else {
                        this._openPopup(propsArr, ev.latlng);
                    }

                    this.parentLayer.fire('click', L.extend(ev, {
                        eventFrom: 'markerClusters',
                        originalEventType: 'click',
                        gmx: {
                            id: id,
                            layer: this.parentLayer,
                            properties: properties,
                            target: {
                                id: id,
                                properties: propsArr,
                                geometry: geometry
                            }
                        }
                    }));
                }, this)
                .on('animationend', function () {
                    if (this._popup && this._popup._map) {
                        this._popup._map.removeLayer(this._popup);
                    }
                }, this)
                .on('clusterclick', function (ev) {
                    this.parentLayer.fire('clusterclick', L.extend(ev, {
                        eventFrom: 'markerClusters',
                        originalEventType: 'clusterclick'
                    }));
                }, this)
                .on('spiderfied', function (ev) {
                    currentSpiderfiedCluster = ev.cluster;
                }, this)
                .on('unspiderfied', function () {
                    currentSpiderfiedCluster = null;
                }, this);

            if (mOptions.clusterclick) {
                markers.on('clusterclick', mOptions.clusterclick instanceof Function ? mOptions.clusterclick : function (a) {
                    a.layer.spiderfy();
                });
            }

            return markers;
        },

        isExternalVisible: function (zoom) {
            return !(zoom < this.options.minZoom || zoom > this.options.maxZoom);
        },

        updateData: function (data) {
            var arr = [],
                i, len, vectorTileItem, id, marker;
            if (data.removed) {
                for (i = 0, len = data.removed.length; i < len; i++) {
                    vectorTileItem = data.removed[i];
                    id = vectorTileItem.id;
                    marker = this._items[id];
                    if (marker) {
                        arr.push(marker);
                    }
                    delete this._items[id];
                }
                this.externalLayer.removeLayers(arr);
                arr = [];
            }
            if (data.added) {
                for (i = 0, len = data.added.length; i < len; i++) {
                    vectorTileItem = data.added[i];
                    id = vectorTileItem.id;
                    marker = this._items[id];
                    var item = vectorTileItem.properties;
                    if (marker && item.processing) {
                        this.externalLayer.removeLayer(marker);
                        marker = null;
                    }
                    if (!marker) {
                        if (!vectorTileItem.item.parsedStyleKeys) {
                            vectorTileItem.item.parsedStyleKeys = this.parentLayer.getItemStyle(id);
                        }
                        var geo = item[item.length - 1],
                            parsedStyle = vectorTileItem.item.parsedStyleKeys,
                            p = geo.coordinates,
                            latlng = L.Projection.Mercator.unproject({x: p[0], y: p[1]}),
                            opt = {
                                properties: vectorTileItem.properties,
                                mPoint: p
                            };

                        if (this.options.notClusteredIcon) {
                            var icon = this.options.notClusteredIcon;
                            if (icon instanceof L.Icon) {
                                opt.icon = icon;
                            } else {
                                opt.icon = L.icon(icon);
                            }
                        } else if (parsedStyle) {
                            if (parsedStyle.iconUrl) {
                                var iconAnchor = parsedStyle.iconAnchor;
                                if (!iconAnchor) {
                                    var style = this.parentLayer.getItemStyle(id);
                                    iconAnchor = style.image ? [style.sx / 2, style.sy / 2] : [8, 10];
                                }
                                opt.icon = L.icon({
                                    iconAnchor: iconAnchor,
                                    iconUrl: parsedStyle.iconUrl
                                });
                            } else {
                                opt.icon = L.gmxUtil.getSVGIcon(parsedStyle);
                            }
                        }
                        if (parsedStyle.rotate) {
                            marker = L.rotatedMarker(latlng, L.extend(opt, {
                                angle: parsedStyle.rotate
                            }));
                        } else {
                            marker = L.marker(latlng, L.extend(opt, {
                                angle: parsedStyle.rotate
                            }));
                        }
                        this._items[id] = marker;
                    }
                    arr.push(marker);
                }
                this.externalLayer.addLayers(arr);
            }
        },

        _openPopup: function (propsArr, latlng) {
            var gmx = this.parentLayer._gmx,
                id = propsArr[0],
                balloonData = gmx.styleManager.getItemBalloon(id),
                properties = this.parentLayer.getItemProperties(propsArr),
                geometry = [propsArr[propsArr.length - 1]];

            if (balloonData && !balloonData.DisableBalloonOnClick) {
                var style = this.parentLayer.getItemStyle(id);
                if (style && style.iconAnchor) {
                    var protoOffset = L.Popup.prototype.options.offset;
                    this._popup.options.offset = [-protoOffset[0] - style.iconAnchor[0] + style.sx / 2,
                        protoOffset[1] - style.iconAnchor[1] + style.sy / 2
                    ];
                }
                this._popup
                    .setLatLng(latlng)
                    .setContent(L.gmxUtil.parseBalloonTemplate(balloonData.templateBalloon, {
                        properties: properties,
                        tileAttributeTypes: gmx.tileAttributeTypes,
                        unitOptions: this._map.options || {},
                        geometries: geometry
                    }))
                    .openOn(this._map);
            }
        }
    });

    L.gmx.VectorLayer.include({
        bindClusters: function (options) {
            if (L.MarkerClusterGroup) {
                if (this._clusters) {
                    this._clusters.unbindLayer();
                }
                this._clusters = new GmxMarkerCluster(options, this);
            }
            return this;
        },

        unbindClusters: function () {
            if (L.MarkerClusterGroup) {
                if (this._clusters) {
                    this._clusters.unbindLayer();
                    this._clusters = null;
                    this.enablePopup();
                }
            }
            return this;
        }
    });
})();


L.gmx = L.gmx || {};

var DEFAULT_HOSTNAME = 'maps.kosmosnimki.ru';
var DEFAULT_VECTOR_LAYER_ZINDEXOFFSET = 2000000;

//Build in layer classes
L.gmx._layerClasses = {
    'Raster': L.gmx.RasterLayer,
    'Vector': L.gmx.VectorLayer,
    'VectorView': L.gmx.DummyLayer
};

L.gmx._loadingLayerClasses = {};

L.gmx.addLayerClass = function(type, layerClass) {
    L.gmx._layerClasses[type] = layerClass;
};

L.gmx._layerClassLoaders = [];

L.gmx.addLayerClassLoader = function(layerClassLoader) {
    L.gmx._layerClassLoaders.push(layerClassLoader);

    //delete all loading promises to ensure that new loader will be invoked
    L.gmx._loadingLayerClasses = {};
};

L.gmx._loadLayerClass = function(type) {
    if (!L.gmx._loadingLayerClasses[type]) {
        var promise = new L.gmx.Deferred();
        promise.resolve();

        L.gmx._layerClassLoaders.forEach(function(loader) {
            promise = promise.then(function(layerClass) {
                if (layerClass) {
                    L.gmx._layerClasses[type] = layerClass;
                    return layerClass;
                }

                return loader(type);
            },
            function(){
                //just skip loader errors
            });
        });

        promise = promise.then(function(layerClass) {
            if (layerClass) {
                L.gmx._layerClasses[type] = layerClass;
                return layerClass;
            }
        }, function(){
            //just skip loader errors
        });

        L.gmx._loadingLayerClasses[type] = promise;
    }

    return L.gmx._loadingLayerClasses[type];
};

L.gmx.loadLayer = function(mapID, layerID, options) {

    var promise = new L.gmx.Deferred(),
        layerParams = {
            mapID: mapID,
            layerID: layerID
        };

    options = options || {};

    for (var p in options) {
        layerParams[p] = options[p];
    }

    var hostName = gmxAPIutils.normalizeHostname(options.hostName || DEFAULT_HOSTNAME);
    layerParams.hostName = hostName;

    gmxMapManager.getMap(hostName, options.apiKey, mapID, options.skipTiles).then(
        function() {
            var layerInfo = gmxMapManager.findLayerInfo(hostName, mapID, layerID);

            if (!layerInfo) {
                promise.reject('There is no layer ' + layerID + ' in map ' + mapID);
                return;
            }

            //to know from what host the layer was loaded
            layerInfo.properties.hostName = hostName;

            var type = layerInfo.properties.ContentID || layerInfo.properties.type;

            var doCreateLayer = function() {
                var layer = L.gmx.createLayer(layerInfo, layerParams);
                if (layer) {
                    promise.resolve(layer);
                } else {
                    promise.reject('Unknown type of layer ' + layerID);
                }
            };

            if (type in L.gmx._layerClasses) {
                doCreateLayer();
            } else {
                L.gmx._loadLayerClass(type).then(doCreateLayer);
            }
        },
        function(response) {
            promise.reject('Can\'t load layer ' + layerID + ' from map ' + mapID + ': ' + response.error);
        }
    );

    return promise;
};

L.gmx.loadLayers = function(layers, globalOptions) {
    var defs = layers.map(function(layerInfo) {
        var options = L.extend({}, globalOptions, layerInfo.options);
        return L.gmx.loadLayer(layerInfo.mapID, layerInfo.layerID, options);
    });

    return L.gmx.Deferred.all.apply(null, defs);
};

L.gmx.loadMap = function(mapID, options) {
    options = L.extend({}, options);
    options.hostName = gmxAPIutils.normalizeHostname(options.hostName || DEFAULT_HOSTNAME);

    var def = new L.gmx.Deferred();

    gmxMapManager.getMap(options.hostName, options.apiKey, mapID, options.skipTiles, options.isGeneralized).then(function(mapInfo) {
/*eslint-disable new-cap */
        var loadedMap = new gmxMap(mapInfo, options);
/*eslint-enable */

        loadedMap.layersCreated.then(function() {
            if (options.leafletMap || options.setZIndex) {
                var curZIndex = 0,
                    layer, rawProperties;

                for (var l = loadedMap.layers.length - 1; l >= 0; l--) {
                    layer = loadedMap.layers[l];
					rawProperties = layer.getGmxProperties();
					if (mapInfo.properties.LayerOrder === 'VectorOnTop' && layer.setZIndexOffset && rawProperties.type !== 'Raster') {
                        layer.setZIndexOffset(DEFAULT_VECTOR_LAYER_ZINDEXOFFSET);
                    }
                    if (options.setZIndex && layer.setZIndex) {
                        layer.setZIndex(++curZIndex);
                    }

                    if (options.leafletMap && rawProperties.visible) {
                        layer.addTo(options.leafletMap);
                    }
                }
            }
            def.resolve(loadedMap);
        });
    },
    function(response) {
        var errorMessage = (response && response.ErrorInfo && response.ErrorInfo.ErrorMessage) || 'Server error';
        def.reject('Can\'t load map ' + mapID + ' from ' + options.hostName + ': ' + errorMessage);
    });
    return def;
};

L.gmx.DummyLayer = function(props) {
    this.onAdd = this.onRemove = function() {};
    this.getGmxProperties = function() { return props; };
};

L.gmx.createLayer = function(layerInfo, options) {
    if (!layerInfo) { layerInfo = {}; }
    if (!layerInfo.properties) { layerInfo.properties = {type: 'Vector'}; }

    var type = layerInfo.properties.ContentID || layerInfo.properties.type || 'Vector',
        layer;

		if (type in L.gmx._layerClasses) {
        try {
            layer = new L.gmx._layerClasses[type](options);
            layer = layer.initFromDescription(layerInfo);
        } catch (e) {
            layer = new L.gmx.DummyLayer(layerInfo.properties);
        }
    } else {
        layer = new L.gmx.DummyLayer(layerInfo.properties);
    }

    return layer;
};


}());

L.Map.addInitHook(function() {
	this.gmxControlsManager.setSvgSprites('http://www.kosmosnimki.ru/lib/geomixer/img/svg-symbols.svg');
});
}());
