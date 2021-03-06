/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Mickael Jeanroy
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/* jshint eqnull:true */

/* global _ */
/* global $parse */
/* global HashMap */
/* exported Collection */

/**
 * Collection implementation that can be used
 * to keep internal data indexed using key identifier.
 * Collection is an array like object and implement most
 * methods of array prototype.
 *
 * Limitations:
 *  - Null or undefined data are not allowed (since it must be
 *    indexed using internal property).
 *  - Property must identify uniquely data. Multiple data with
 *    same key are not allowed.
 *  - Key identifier must be a simple type (numeric, string or
 *    boolean).
 */

var Collection = (function() {

  var ArrayProto = Array.prototype;
  var keepNativeArray = (function() {
    try {
      var obj = {};
      obj[0] = 1;
      return !!ArrayProto.toString.call(obj);
    } catch(error) {
      return false;
    }
  })();

  var callNativeArrayWrapper = function(fn) {
    return function() {
      // Some browsers, including phantomjs 1.x need a real array
      // to be called as the context of Array prototype function (array like
      // object are not permitted)
      // Newer browsers does not need this, so keep it fast for them !
      var array = keepNativeArray ? this : _.toArray(this);
      return ArrayProto[fn].apply(array, arguments);
    };
  };

  var callNativeArrayFn = function(fn, ctx, args) {
    return callNativeArrayWrapper(fn).apply(ctx, args);
  };

  var Constructor = function(data, options) {
    this.$$map = new HashMap();

    var opts = options || {};

    this.$$key = opts.key || 'id';

    // Use Object as a fallback since every object is already an instance of Object !
    this.$$model = opts.model || Object;

    if (!_.isFunction(this.$$key)) {
      this.$$key = $parse(this.$$key);
    }

    this.$$observers = [];
    this.$$changes = [];
    this.$$trigger = _.bind(this.$$trigger, this);

    // Initialize collection
    this.length = 0;
    if (data && data.length) {
      this.push.apply(this, data);
    }
  };

  // == Private functions

  // To Int function
  // See: http://es5.github.io/#x9.4
  var toInt = function(nb) {
    return parseInt(Number(nb) || 0, 10);
  };

  // Create a change object according to Object.observe API
  var TYPE_SPLICE = 'splice';
  var TYPE_UPDATE = 'update';
  var createChange = function(type, removed, index, addedCount, collection) {
    return {
      type: type,
      removed: removed,
      index: index,
      addedCount: addedCount,
      object: collection
    };
  };

  // Unset data at given index.
  var unsetAt = function(collection, idx) {
    delete collection[idx];
  };

  // Unset id entry in internal map of object index.
  var unsetId = function(collection, id) {
    collection.$$map.remove(id);
  };

  // Unset data from collection
  var unset = function(collection, obj) {
    var id = collection.$$key(obj);
    var idx = collection.$$map.get(id);
    if (idx != null) {
      unsetAt(collection, idx);
      unsetId(collection, id);
    }
  };

  // Convert parameter to a model instance.
  var toModel = function(collection, o) {
    return o instanceof collection.$$model ? o : new collection.$$model(o);
  };

  // Add entry at given index.
  // Internal map is updated to keep track of indexes.
  var put = function(collection, o, i) {
    collection[i] = o;
    if (o != null) {
      collection.$$map.put(collection.$$key(o), i);
    }
  };

  // Swap elements at given index
  // Internal map is updated to keep track of indexes.
  var swap = function(collection, i, j) {
    var oj = collection.at(j);
    var oi = collection.at(i);
    put(collection, oi, j);
    put(collection, oj, i);
  };

  // Move all elements of collection to the right.
  // Start index is specified by first parameter.
  // Number of move is specified by second parameter.
  // Size of collection is automatically updated.
  // Exemple:
  //   [0, 1, 2] => shiftRight(0, 2) => [undefined, undefined, 0, 1, 2]
  //   [0, 1, 2] => shiftRight(1, 2) => [0, undefined, undefined, 1, 2]
  //   [0, 1, 2] => shiftRight(2, 2) => [0, 1, undefined, undefined, 2]
  var shiftRight = function(collection, start, size) {
    var absSize = Math.abs(size);

    // Swap elements index by index
    for (var i = collection.length - 1; i >= start; --i) {
      swap(collection, i, i + absSize);
    }

    collection.length += absSize;
  };

  // Move all elements of collection to the left.
  // Start index is specified by first parameter.
  // Number of move is specified by second parameter.
  // Size of collection is automatically updated.
  // Removed elements are returned
  // Exemple:
  //   shiftLeft([0, 1, 2], 0, 2) => [2]
  //   shiftLeft([0, 1, 2], 1, 1) => [0, 2]
  //   shiftLeft([0, 1, 2], 2, 1) => [0, 1]
  var shiftLeft = function(collection, start, size) {
    var absSize = Math.abs(size);
    var oldLength = collection.length;
    var newLength = oldLength - absSize;
    var max = start + absSize;

    var removed = [];

    // Swap elements index by index
    for (var i = max; i < oldLength; ++i) {
      swap(collection, i, i - absSize);
    }

    // Clean last elements of array
    for (var k = newLength; k < oldLength; ++k) {
      var o = collection.at(k);
      removed.unshift(o);
      unset(collection, o);
    }

    collection.length = newLength;

    return removed;
  };

  var merge = function(collection, array) {
    var sortFn = collection.$$sortFn;
    var sizeCollection = collection.length;
    var sizeArray = array.length;
    var newSize = sizeCollection + sizeArray;

    var changes = [], change;
    var j = sizeCollection - 1;
    var k = sizeArray - 1;
    for (var i = newSize - 1; i >= 0; --i) {
      if (j < 0 || sortFn(collection[j], array[k]) < 0) {
        put(collection, array[k--], i);

        // New change occurs
        change = _.first(changes);
        if (!change || change.index !== (i + 1)) {
          change = createChange(TYPE_SPLICE, [], i, 1, collection);
          changes.unshift(change);
        } else {
          change.index = i;
          change.addedCount++;
        }

        if (k < 0) {
          // Array is 100% merged
          break;
        }
      } else {
        put(collection, collection[j--], i);
      }
    }

    // Update collection length
    collection.length = newSize;

    return changes;
  };

  // == Public prototype

  Constructor.prototype = {
    // Get element at given index
    // Shortcut to array notation
    at: function(index) {
      return this[index];
    },

    // Get item by its key value
    byKey: function(key) {
      var index = this.indexByKey(key);
      return index >= 0 ? this.at(index) : undefined;
    },

    // Get index of item by its key
    indexByKey: function(key) {
      return this.$$map.contains(key) ? this.$$map.get(key) : -1;
    },

    // Returns an index in the array, if an element in the array
    // satisfies the provided testing function. Otherwise -1 is returned.
    findIndex: function(callback, ctx) {
      for (var i = 0, size = this.length; i < size; ++i) {
        if (callback.call(ctx, this.at(i), i, this)) {
          return i;
        }
      }
      return -1;
    },

    // Add new elements at given index
    // This is a shortcut for splice(start, O, models...)
    add: function(start, models) {
      var args = [start, 0].concat(models);
      this.splice.apply(this, args);
      return this.length;
    },

    // Remove elements at given index
    // This is a shortcut for splice(start, deleteCount)
    remove: function(start, deleteCount) {
      return this.splice.call(this, start, deleteCount);
    },

    // Adds one or more elements to the end of the collection
    // and returns the new length of the collection.
    // Semantic is the same as [].push function
    push: function() {
      return this.add.call(this, this.length, _.toArray(arguments));
    },

    // adds one or more elements to the beginning of the collection
    // and returns the new length of the collection.
    // Semantic is the same as [].unshift function
    unshift: function() {
      return this.add.call(this, 0, _.toArray(arguments));
    },

    // Removes the last element from the collection
    // and returns that element.
    pop: function() {
      return this.remove(this.length - 1, 1)[0];
    },

    // removes the first element from the collection
    // and returns that element.
    shift: function() {
      return this.remove(0, 1)[0];
    },

    // Clear collection
    clear: function() {
      if (this.length > 0) {
        var array = [];
        for (var i = 0, size = this.length; i < size; ++i) {
          array[i] = this.at(i);
          unsetAt(this, i);
        }

        this.$$map.clear();
        this.length = 0;
        this.trigger(createChange(TYPE_SPLICE, array, 0, 0, this));
      }

      return this;
    },

    // Reset entire collection with new data array
    reset: function(array) {
      var oldSize = this.length;
      var newSize = array.length;

      var sortFn = this.$$sortFn;
      if (sortFn) {
        array.sort(sortFn);
      }

      this.$$map.clear();

      var removed = [];
      var addedCount = array.length;

      for (var i = 0; i < newSize; ++i) {
        if (i < oldSize) {
          removed.push(this.at(i));
        }

        put(this, toModel(this, array[i]), i);
      }

      for (; i < oldSize; ++i) {
        removed.push(this.at(i));
        unsetAt(this, i);
      }

      this.length = newSize;

      this.trigger([
        createChange(TYPE_SPLICE, removed, 0, addedCount, this)
      ]);

      return this;
    },

    // Check if collection is empty
    isEmpty: function() {
      return this.length === 0;
    },

    // Returns a new collection comprised of the collection on which it is called
    // joined with the collection(s) and/or value(s) provided as arguments.
    concat: function() {
      var newArray = ArrayProto.concat.apply(this.toArray(), arguments);
      return new Constructor(newArray, {
        key: this.$$key,
        model: this.$$model
      });
    },

    // returns a shallow copy of a portion of the collection
    // into a new collection object.
    slice: function() {
      var results = callNativeArrayFn('slice', this, arguments);
      return new Constructor(results, {
        key: this.$$key,
        model: this.$$model
      });
    },

    // Changes the content of the collection by removing existing
    // elements and/or adding new elements.
    // If collection is sorted, splice will insert new elements
    // in order (collection remains sorted).
    splice: function(start, deleteCount) {
      var sortFn = this.$$sortFn;
      var size = this.length;
      var data = _.rest(arguments, 2);

      // Iterator that will translate object to model elements
      var iteratee = function(m) {
        return toModel(this, m);
      };

      var added = _.map(data, iteratee, this);
      var addedCount = added.length;

      // Index at which to start changing the array.
      // If greater than the length of the array, actual starting index will
      // be set to the length of the array.
      // If negative, will begin that many elements from the end.
      // See: http://es5.github.io/#x15.4.4.10
      var actualStart = toInt(start);
      if (actualStart >= 0) {
        actualStart = Math.min(size, actualStart);
      } else {
        actualStart = Math.max(size + actualStart, 0);
      }

      // An integer indicating the number of old array elements to remove.
      // If deleteCount is 0, no elements are removed.
      // In this case, you should specify at least one new element.
      // If deleteCount is greater than the number of elements left in the array
      // starting at start, then all of the elements through the end of
      // the array will be deleted.
      // See: http://es5.github.io/#x15.4.4.10
      var actualDeleteCount = Math.min(Math.max(toInt(deleteCount) || 0, 0), size - actualStart);

      // Track removed elements
      var removed = [];

      // First delete elements
      if (actualDeleteCount > 0) {
        for (var i = 0; i < actualDeleteCount; ++i) {
          removed.push(this[i + actualStart]);
        }

        shiftLeft(this, actualStart, actualDeleteCount);
      }

      var changes;

      // Add new elements
      if (addedCount > 0) {
        if (sortFn) {
          // We need to keep sort: sort added elements and merge everything
          added.sort(sortFn);
          changes = merge(this, added);
        }
        else {
          // Shift and put elements at given indexes
          shiftRight(this, actualStart, addedCount);

          for (var k = 0; k < addedCount; ++k) {
            put(this, added[k], actualStart + k);
          }

          changes = [createChange(TYPE_SPLICE, removed, actualStart, addedCount, this)];
        }
      } else {
        changes = [];
      }

      // Add change for removed elements
      if (removed.length > 0) {
        var change = _.find(changes, function(c) {
          return c.index === actualStart;
        });

        if (change) {
          // Merge change for removed elements with added elements changes
          change.removed = removed;
        } else {
          // Prepend changes with change for removed elements
          changes.unshift(createChange(TYPE_SPLICE, removed, actualStart, 0, this));
        }
      }

      // Trigger changes
      if (changes && changes.length > 0) {
        this.trigger(changes);
      }

      // An array containing the deleted elements.
      // If only one element is removed, an array of one element is returned.
      // If no elements are removed, an empty array is returned.
      return removed;
    },

    // Reverses collection in place.
    // The first array element becomes the last and the last becomes the first.
    reverse: function() {
      if (this.$$sortFn) {
        // If collection is sorted, reverse is a no-op
        return this;
      }

      var size = this.length;
      var mid = Math.floor(size / 2);

      // Track changes using two arrays to have changes in order
      var changesStart = [];
      var changesEnd = [];

      for (var i = 0, j = size - 1; i < mid; ++i, --j) {
        swap(this, i, j);
        changesStart.push(createChange(TYPE_UPDATE, [], i, 0, this));
        changesEnd.unshift(createChange(TYPE_UPDATE, [], j, 0, this));
      }

      // Trigger changes in order
      var changes = changesStart.concat(changesEnd);
      if (changes.length) {
        this.trigger(changes);
      }

      return this;
    },

    // Split collection into smaller arrays
    // Returned value is an array of smaller arrays.
    split: function(size) {
      var actualSize = size || 20;
      var chunks = [];

      var chunk = [];
      for (var i = 0, length = this.length; i < length; ++i) {
        chunk.push(this.at(i));
        if (chunk.length === actualSize) {
          chunks.push(chunk);
          chunk = [];
        }
      }

      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      return chunks;
    },

    // Custom json representation
    // Need JSON.stringify to be available
    toJSON: function() {
      return JSON.stringify(this.toArray());
    },

    // Sort given collection in place
    // Sorted collection is returned
    sort: function(sortFn) {
      this.$$sortFn = sortFn;
      return this.reset(this.toArray())
                 .clearChanges();
    },

    // Extract property of collection items
    pluck: function(name) {
      return this.map($parse(name));
    },

    // Add new observer
    observe: function(callback, observer) {
      this.$$observers.push({
        ctx: observer || null,
        callback: callback
      });

      return this;
    },

    // Remove observer
    unobserve: function(callback, observer) {
      if (arguments.length === 0) {
        // Unobserve everything
        this.$$observers = [];
      }
      else {
        var ctx = observer || null;
        this.$$observers = _.reject(this.$$observers, function(o) {
          return o.ctx === ctx && callback === o.callback;
        });
      }

      return this;
    },

    // Trigger changes
    // Note that callbacks will be called asynchronously
    trigger: function(changes) {
      this.$$changes = this.$$changes.concat(changes);
      setTimeout(this.$$trigger);
      return this;
    },

    // Clear pending changes
    clearChanges: function() {
      this.$$changes = [];
      return this;
    },

    // Trigger changes to observers
    // Private function
    $$trigger: function() {
      if (this.$$changes.length > 0) {
        _.forEach(this.$$observers, function(o) {
          o.callback.call(o.ctx, this.$$changes);
        }, this);

        this.$$changes = [];
      }

      return this;
    }
  };

  _.forEach(['indexOf', 'size', 'lastIndexOf', 'first', 'last', 'initial', 'rest', 'partition', 'forEach', 'map', 'every', 'some', 'reduce', 'reduceRight', 'filter', 'reject', 'find', 'toArray'], function(fn) {
    if (_[fn]) {
      Constructor.prototype[fn] = function() {
        var args = [this].concat(_.toArray(arguments));
        return _[fn].apply(_, args);
      };
    }
  });

  _.forEach(['countBy', 'groupBy', 'indexBy'], function(fn) {
    Constructor.prototype[fn] = function(callback, ctx) {
      // Support nested property in collection object
      if (_.isString(callback)) {
        callback = $parse(callback);
      }

      return _[fn].call(_, this, callback, ctx);
    };
  });

  _.forEach(['toString', 'toLocaleString', 'join'], function(fn) {
    Constructor.prototype[fn] = callNativeArrayWrapper(fn);
  });

  return Constructor;
})();
