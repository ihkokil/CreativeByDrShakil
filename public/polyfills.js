(function () {
  'use strict';

  // globalThis
  if (typeof globalThis === 'undefined') {
    if (typeof self !== 'undefined') self.globalThis = self;
    else if (typeof window !== 'undefined') window.globalThis = window;
  }

  // queueMicrotask
  if (typeof queueMicrotask !== 'function') {
    var p = Promise.resolve();
    globalThis.queueMicrotask = function (cb) {
      p.then(cb).catch(function (err) {
        setTimeout(function () { throw err; }, 0);
      });
    };
  }

  // Promise.withResolvers
  if (typeof Promise.withResolvers !== 'function') {
    Promise.withResolvers = function () {
      var resolve, reject;
      var promise = new Promise(function (res, rej) {
        resolve = res;
        reject = rej;
      });
      return { promise: promise, resolve: resolve, reject: reject };
    };
  }

  // Promise.allSettled
  if (typeof Promise.allSettled !== 'function') {
    Promise.allSettled = function (promises) {
      return Promise.all(
        Array.from(promises).map(function (p) {
          return Promise.resolve(p).then(
            function (value) { return { status: 'fulfilled', value: value }; },
            function (reason) { return { status: 'rejected', reason: reason }; }
          );
        })
      );
    };
  }

  // Promise.any + AggregateError
  if (typeof AggregateError !== 'function') {
    globalThis.AggregateError = function AggregateError(errors, message) {
      var err = new Error(message);
      err.name = 'AggregateError';
      err.errors = Array.from(errors);
      return err;
    };
  }

  if (typeof Promise.any !== 'function') {
    Promise.any = function (promises) {
      return new Promise(function (resolve, reject) {
        var errors = [];
        var remaining = 0;
        var index = 0;
        var arr = Array.from(promises);

        if (arr.length === 0) {
          reject(new AggregateError([], 'All promises were rejected'));
          return;
        }

        arr.forEach(function (promise, i) {
          remaining++;
          Promise.resolve(promise).then(resolve, function (err) {
            errors[i] = err;
            remaining--;
            if (remaining === 0) {
              reject(new AggregateError(errors, 'All promises were rejected'));
            }
          });
        });
      });
    };
  }

  // structuredClone
  if (typeof structuredClone !== 'function') {
    globalThis.structuredClone = function (obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      return JSON.parse(JSON.stringify(obj));
    };
  }

  // crypto.randomUUID
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID !== 'function') {
    crypto.randomUUID = function () {
      if (typeof crypto.getRandomValues === 'function') {
        var bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        var hex = Array.from(bytes)
          .map(function (b) { return ('00' + b.toString(16)).slice(-2); })
          .join('');
        return [
          hex.slice(0, 8),
          hex.slice(8, 12),
          hex.slice(12, 16),
          hex.slice(16, 20),
          hex.slice(20, 32)
        ].join('-');
      }
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
    };
  }

  // String.prototype.replaceAll
  if (typeof String.prototype.replaceAll !== 'function') {
    String.prototype.replaceAll = function (search, replacement) {
      if (search instanceof RegExp) {
        if (!search.global) throw new TypeError('replaceAll must be called with a global RegExp');
        return this.replace(search, replacement);
      }
      return this.split(search).join(replacement);
    };
  }

  // Array.prototype.at
  if (typeof Array.prototype.at !== 'function') {
    Array.prototype.at = function (index) {
      var len = this.length;
      var i = index >= 0 ? index : len + index;
      return (i >= 0 && i < len) ? this[i] : undefined;
    };
  }

  // String.prototype.at
  if (typeof String.prototype.at !== 'function') {
    String.prototype.at = function (index) {
      var len = this.length;
      var i = index >= 0 ? index : len + index;
      return (i >= 0 && i < len) ? this.charAt(i) : undefined;
    };
  }

  // Object.hasOwn
  if (typeof Object.hasOwn !== 'function') {
    Object.hasOwn = function (obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    };
  }

  // Array.prototype.findLast
  if (typeof Array.prototype.findLast !== 'function') {
    Array.prototype.findLast = function (predicate) {
      for (var i = this.length - 1; i >= 0; i--) {
        if (predicate(this[i], i, this)) return this[i];
      }
      return undefined;
    };
  }

  // AbortSignal.timeout
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout !== 'function') {
    AbortSignal.timeout = function (ms) {
      var controller = new AbortController();
      setTimeout(function () { controller.abort(); }, ms);
      return controller.signal;
    };
  }

  // Object.groupBy
  if (typeof Object.groupBy !== 'function') {
    Object.groupBy = function (items, callbackFn) {
      var result = Object.create(null);
      var index = 0;
      var arrItems = Array.from(items);
      for (var i = 0; i < arrItems.length; i++) {
        var item = arrItems[i];
        var key = String(callbackFn(item, index++));
        if (!(key in result)) result[key] = [];
        result[key].push(item);
      }
      return result;
    };
  }

  console.log('[Polyfills] Legacy Safari support loaded');
})();
