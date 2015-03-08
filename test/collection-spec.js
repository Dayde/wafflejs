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

describe('collection', function() {

  beforeEach(function() {
    jasmine.addCustomEqualityTester(function(actual, expected) {
      if (actual instanceof Collection && expected instanceof Collection) {
        if (actual === expected) {
          return true;
        }

        // Perform equal comparison without $$trigger function
        var t1 = actual.$$trigger;
        var t2 = expected.$$trigger;

        actual.$$trigger = expected.$$trigger = function() {};

        var result = jasmine.matchersUtil.equals(actual, expected);

        actual.$$trigger = t1;
        expected.$$trigger = t2;

        return result;
      }
    });
  });

  beforeEach(function() {
    jasmine.clock().install();
  });

  afterEach(function() {
    jasmine.clock().uninstall();
  });

  it('should initialize empty collection', function() {
    var collection = new Collection();
    expect(collection.length).toBe(0);
    expect(collection.$$map).toEqual({});
    expect(collection.$$model).toBeUndefined();
    expect(collection.$$key).toEqual(jasmine.any(Function));

    var id = collection.$$key({ id: 1 });
    expect(id).toBe(1);
  });

  it('should initialize empty collection with id attribute', function() {
    var collection = new Collection([], {
      key: 'name'
    });

    expect(collection.length).toBe(0);
    expect(collection.$$map).toEqual({});
    expect(collection.$$model).toBeUndefined();
    expect(collection.$$key).toEqual(jasmine.any(Function));

    var name = collection.$$key({ id: 1, name: 'foo' });
    expect(name).toBe('foo');
  });

  it('should initialize empty collection with model constructor', function() {
    var Model = function() { };

    var collection = new Collection([], {
      key: 'name',
      model: Model
    });

    expect(collection.length).toBe(0);
    expect(collection.$$map).toEqual({});
    expect(collection.$$model).toBe(Model);
    expect(collection.$$key).toEqual(jasmine.any(Function));
  });

  it('should initialize collection with array', function() {
    var o1 = { id: 1, name: 'foo' };
    var o2 = { id: 2, name: 'bar' };
    var items = [o1, o2];

    var collection = new Collection(items);

    expect(collection.length).toBe(2);
    expect(collection[0]).toBe(o1);
    expect(collection[1]).toBe(o2);

    expect(collection.$$map[1]).toBe(0);
    expect(collection.$$map[2]).toBe(1);
  });

  it('should initialize collection with array and model constructor', function() {
  	var Model = function(data) {
      this.id = data.id;
      this.name = data.name;
  	};

    var o1 = { id: 1, name: 'foo' };
    var o2 = { id: 2, name: 'bar' };
    var items = [o1, o2];

    var collection = new Collection(items, {
      model: Model
    });

    expect(collection.length).toBe(2);
    expect(collection[0]).not.toBe(o1);
    expect(collection[1]).not.toBe(o2);

    expect(collection[0]).toEqual(jasmine.objectContaining(o1));
    expect(collection[1]).toEqual(jasmine.objectContaining(o2));

    expect(collection.$$map[1]).not.toBe(o1);
    expect(collection.$$map[2]).not.toBe(o2);

    expect(collection.$$map[1]).toBe(0);
    expect(collection.$$map[2]).toBe(1);
  });

  describe('once initialized', function() {
    var o1;
    var o2;
    var collection;

    beforeEach(function() {
      o1 = { id: 1, name: 'foo' };
      o2 = { id: 2, name: 'bar' };

      o1.toString = function() {
        return this.id;
      };

       o2.toString = function() {
        return this.id;
      };

      collection = new Collection([o1, o2]);
      expect(collection.length).toBe(2);

      jasmine.clock().tick(1);
    });

    describe('without sort', function() {
      var o0;
      var o3;
      var o4;

      beforeEach(function() {
        spyOn(collection, 'trigger').and.callThrough();

        o0 = { id: 0, name: 'foobar' };
        o3 = { id: 3, name: 'foobar' };
        o4 = { id: 4, name: 'foobar' };
      });

      it('should remove last element', function() {
        var removedElement = collection.pop();

        expect(removedElement).toBe(o2);
        expect(collection.length).toBe(1);
        expect(collection[0]).toBe(o1);
        expect(collection[1]).toBeUndefined();
        expect(collection.$$map).toEqual({
          1: 0
        });

        expect(collection.trigger).toHaveBeenCalledWith({
          addedCount: 0,
          index: 1,
          removed: [o2],
          type: 'splice',
          object: collection
        });
      });

      it('should remove first element', function() {
        var removedElement = collection.shift();

        expect(removedElement).toBe(o1);
        expect(collection.length).toBe(1);
        expect(collection[0]).toBe(o2);
        expect(collection[1]).toBeUndefined();
        expect(collection.$$map).toEqual({
          2: 0
        });

        expect(collection.trigger).toHaveBeenCalledWith({
          addedCount: 0,
          index: 0,
          removed: [o1],
          type: 'splice',
          object: collection
        });
      });

      it('should push new elements at the end', function() {
        var newLength = collection.push(o0, o3);

        expect(newLength).toBe(4);
        expect(collection.length).toBe(4);
        expect(collection[0]).toBe(o1);
        expect(collection[1]).toBe(o2);
        expect(collection[2]).toBe(o0);
        expect(collection[3]).toBe(o3);

        expect(collection.$$map).toEqual({
          1: 0,
          2: 1,
          0: 2,
          3: 3
        });

        expect(collection.trigger).toHaveBeenCalledWith([
          { type: 'splice', addedCount: 2, index: 2, removed: [], object: collection }
        ]);
      });

      it('should unshift new elements', function() {
        var newLength = collection.unshift(o3, o4);

        expect(newLength).toBe(4);
        expect(collection.length).toBe(4);
        expect(collection[0]).toBe(o3);
        expect(collection[1]).toBe(o4);
        expect(collection[2]).toBe(o1);
        expect(collection[3]).toBe(o2);

        expect(collection.$$map).toEqual({
          1: 2,
          2: 3,
          3: 0,
          4: 1
        });

        expect(collection.trigger).toHaveBeenCalledWith([
          { type: 'splice', addedCount: 2, index: 0, removed: [], object: collection }
        ]);
      });
    });

    describe('once sorted', function() {
      var sortFn;
      var o5;
      var o10;

      beforeEach(function() {
        o5 = { id: 5, name: 'foobar' };
        o10 = { id: 10, name: 'foobar' };

        collection = new Collection([o1, o10, o5, o2]);

        var sortFn = jasmine.createSpy('sortFn').and.callFake(function(o1, o2) {
          return o1.id - o2.id
        });

        collection.sort(sortFn);

        spyOn(collection, 'trigger').and.callThrough();
      });

      it('should sort collection', function() {
        var result = collection.sort(sortFn);

        expect(result).toBe(collection);

        expect(collection.length).toBe(4);
        expect(collection[0]).toBe(o1);
        expect(collection[1]).toBe(o2);
        expect(collection[2]).toBe(o5);
        expect(collection[3]).toBe(o10);

        expect(collection.$$map).toEqual({
          1: 0,
          2: 1,
          5: 2,
          10: 3
        });

        expect(collection.$$sortFn).toBe(sortFn);
      });

      it('should compute sorted index of collection', function() {
        var o3 = { id: 3, name: 'foobar' };
        var o4 = { id: -1, name: 'foobar' };
        var o6 = { id: 6, name: 'foobar' };
        var o11 = { id: 11, name: 'foobar' };

        expect(collection.sortedIndex(o3)).toBe(2);
        expect(collection.sortedIndex(o4)).toBe(0);
        expect(collection.sortedIndex(o6)).toBe(3);
        expect(collection.sortedIndex(o11)).toBe(4);
      });

      it('should return sorted index as next available index', function() {
        var o3 = { id: 2, name: 'foobar' };
        expect(collection.sortedIndex(o3, true)).toBe(2);
      });

      it('should return sorted index as previous available index', function() {
        var o3 = { id: 2, name: 'foobar' };
        expect(collection.sortedIndex(o3, false)).toBe(1);
      });

      it('should return sorted index equal to last element + 1 if collection is not sorted', function() {
        collection.$$sortFn = undefined;

        var o3 = { id: 3, name: 'foobar' };
        var o4 = { id: -1, name: 'foobar' };

        expect(collection.sortedIndex(o3)).toBe(4);
        expect(collection.sortedIndex(o4)).toBe(4);
      });

      it('should return sorted index equal to default value if collection is not sorted', function() {
        collection.$$sortFn = undefined;

        var o3 = { id: 3, name: 'foobar' };
        var o4 = { id: -1, name: 'foobar' };

        expect(collection.sortedIndex(o3, false)).toBe(0);
        expect(collection.sortedIndex(o4, true)).toBe(4);
      });

      it('should push elements in order', function() {
        var o6 = { id: 6, name: 'foobar' };
        var o7 = { id: 7, name: 'foobar' };

        var newLength = collection.push(o6, o7);

        expect(newLength).toBe(6);
        expect(collection.length).toBe(6);

        expect(collection[0]).toBe(o1);
        expect(collection[1]).toBe(o2);
        expect(collection[2]).toBe(o5);
        expect(collection[3]).toBe(o6);
        expect(collection[4]).toBe(o7);
        expect(collection[5]).toBe(o10);

        expect(collection.$$map).toEqual({
          1: 0,
          2: 1,
          5: 2,
          6: 3,
          7: 4,
          10: 5
        });

        expect(collection.trigger).toHaveBeenCalledWith([
          { type: 'splice', addedCount: 2, index: 3, removed: [], object: collection }
        ]);
      });

      it('should unshift elements in order', function() {
        var o6 = { id: 6, name: 'foobar' };
        var o7 = { id: 7, name: 'foobar' };

        var newLength = collection.unshift(o6, o7);

        expect(newLength).toBe(6);
        expect(collection.length).toBe(6);

        expect(collection[0]).toBe(o1);
        expect(collection[1]).toBe(o2);
        expect(collection[2]).toBe(o5);
        expect(collection[3]).toBe(o6);
        expect(collection[4]).toBe(o7);
        expect(collection[5]).toBe(o10);

        expect(collection.$$map).toEqual({
          1: 0,
          2: 1,
          5: 2,
          6: 3,
          7: 4,
          10: 5
        });

        expect(collection.trigger).toHaveBeenCalledWith([
          { type: 'splice', addedCount: 2, index: 3, removed: [], object: collection }
        ]);
      });

      it('should push elements, keep order and trigger changes by index', function() {
        var o6 = { id: 6, name: 'foobar' };
        var o11 = { id: 11, name: 'foobar' };

        var newLength = collection.push(o6, o11);

        expect(newLength).toBe(6);
        expect(collection.length).toBe(6);

        expect(collection[0]).toBe(o1);
        expect(collection[1]).toBe(o2);
        expect(collection[2]).toBe(o5);
        expect(collection[3]).toBe(o6);
        expect(collection[4]).toBe(o10);
        expect(collection[5]).toBe(o11);

        expect(collection.$$map).toEqual({
          1: 0,
          2: 1,
          5: 2,
          6: 3,
          10: 4,
          11: 5
        });

        expect(collection.trigger).toHaveBeenCalledWith([
          { type: 'splice', addedCount: 1, index: 3, removed: [], object: collection },
          { type: 'splice', addedCount: 1, index: 5, removed: [], object: collection }
        ]);
      });

      it('should unshift elements in order and group changes', function() {
        var o6 = { id: 6, name: 'foobar' };
        var o11 = { id: 11, name: 'foobar' };

        var newLength = collection.unshift(o6, o11);

        expect(newLength).toBe(6);
        expect(collection.length).toBe(6);

        expect(collection[0]).toBe(o1);
        expect(collection[1]).toBe(o2);
        expect(collection[2]).toBe(o5);
        expect(collection[3]).toBe(o6);
        expect(collection[4]).toBe(o10);
        expect(collection[5]).toBe(o11);

        expect(collection.$$map).toEqual({
          1: 0,
          2: 1,
          5: 2,
          6: 3,
          10: 4,
          11: 5
        });

        expect(collection.trigger).toHaveBeenCalledWith([
          { type: 'splice', addedCount: 1, index: 3, removed: [], object: collection },
          { type: 'splice', addedCount: 1, index: 5, removed: [], object: collection }
        ]);
      });
    });

    describe('observer', function() {
      var callback1;
      var callback2;

      var ctx1;
      var ctx2;

      var change1;
      var change2;

      beforeEach(function() {
        callback1 = jasmine.createSpy('callback1');
        callback2 = jasmine.createSpy('callback2');

        ctx1 = { foo: 'bar' };
        ctx2 = { bar: 'foo' };

        change1 = { type: 'splice', addedCount: 1, index: 3, object: collection, removed: [] };
        change2 = { type: 'splice', addedCount: 1, index: 4, object: collection, removed: [] };
      });

      it('should register observer', function() {
        collection.observe(callback1);

        expect(collection.$$observers).toEqual([
          { ctx: null, callback: callback1 }
        ]);
      });

      it('should register observer with context', function() {
        collection.observe(callback1, ctx1);

        expect(collection.$$observers).toEqual([
          { ctx: ctx1, callback: callback1 }
        ]);
      });

      it('should unregister everything', function() {
        collection.$$observers.push({
          ctx: null,
          callback: callback1
        });

        collection.unobserve();

        expect(collection.$$observers).toEqual([]);
      });

      it('should unregister callback', function() {

        collection.$$observers.push({
          ctx: null,
          callback: callback1
        });

        collection.$$observers.push({
          ctx: null,
          callback: callback2
        });

        collection.unobserve(callback1);

        expect(collection.$$observers).toEqual([
          { ctx: null, callback: callback2 }
        ]);
      });

      it('should unregister callback with context', function() {
        collection.$$observers.push({
          ctx: ctx1,
          callback: callback1
        });

        collection.$$observers.push({
          ctx: ctx2,
          callback: callback1
        });

        collection.unobserve(callback1, ctx1);

        expect(collection.$$observers).toEqual([
          { ctx: ctx2, callback: callback1 }
        ]);
      });

      it('should trigger changes asynchronously', function() {
        collection.$$observers.push({
          ctx: null,
          callback: callback1
        });

        var changes = [change1, change2];

        collection.trigger(changes);

        expect(collection.$$changes).toEqual(changes);
        expect(callback1).not.toHaveBeenCalled();

        var $$changes = collection.$$changes;

        jasmine.clock().tick(1);

        expect(callback1).toHaveBeenCalledWith($$changes);
        expect(collection.$$changes).toEqual([]);
      });

      it('should trigger single change', function() {
        collection.$$observers.push({
          ctx: null,
          callback: callback1
        });

        collection.trigger(change1);

        expect(collection.$$changes).toEqual([change1]);
        expect(callback1).not.toHaveBeenCalled();

        var $$changes = collection.$$changes;

        jasmine.clock().tick(1);

        expect(callback1).toHaveBeenCalledWith($$changes);
        expect(collection.$$changes).toEqual([]);
      });

      it('should trigger all changes once asynchronously', function() {
        collection.$$observers.push({
          ctx: null,
          callback: callback1
        });

        var changes1 = [change1];

        collection.trigger(changes1);

        var changes2 = [change2];

        collection.trigger(changes2);

        expect(collection.$$changes).toEqual(changes1.concat(changes2));
        expect(callback1).not.toHaveBeenCalled();

        var $$changes = collection.$$changes;

        jasmine.clock().tick(1);

        expect(callback1).toHaveBeenCalledWith($$changes);
        expect(collection.$$changes).toEqual([]);
      });
    });

    it('get element by key', function() {
      var o1 = { id: 1, name: 'foo' };
      var o2 = { id: 2, name: 'bar' };
      var items = [o1, o2];

      var collection = new Collection(items);

      expect(collection.byKey(1)).toBe(o1);
      expect(collection.byKey(2)).toBe(o2);
      expect(collection.byKey(3)).toBe(undefined);
    });

    it('get element index by key', function() {
      var o1 = { id: 1, name: 'foo' };
      var o2 = { id: 2, name: 'bar' };
      var items = [o1, o2];

      var collection = new Collection(items);

      expect(collection.indexByKey(1)).toBe(0);
      expect(collection.indexByKey(2)).toBe(1);
      expect(collection.indexByKey(3)).toBe(-1);
    });

    it('should join elements', function() {
      expect(collection.join()).toBe('1,2');
      expect(collection.join(';')).toBe('1;2');
    });

    it('should get string value', function() {
      expect(collection.toString()).toBe('1,2');
    });

    it('should get locale string value', function() {
      expect(collection.toLocaleString()).toBe('1,2');
    });

    it('should get json representation', function() {
      expect(collection.toJSON()).toEqual(JSON.stringify([o1, o2]));
    });

    it('should check if collection is empty', function() {
      expect(new Collection().isEmpty()).toBe(true);
      expect(collection.isEmpty()).toBe(false);
    });

    it('should get size of collection', function() {
      expect(new Collection().size()).toBe(0);
      expect(collection.size()).toBe(2);
    });

    it('should get element at index', function() {
      expect(collection.at(0)).toBe(o1);
      expect(collection.at(1)).toBe(o2);
    });

    it('should concat collections', function() {
      var o3 = { id: 3 };
      var o4 = { id: 4 };

      var newCollection = collection.concat([o3, o4]);

      expect(newCollection).not.toBe(collection);
      expect(newCollection.length).toBe(4);
      expect(newCollection[0]).toBe(o1);
      expect(newCollection[1]).toBe(o2);
      expect(newCollection[2]).toBe(o3);
      expect(newCollection[3]).toBe(o4);
      expect(newCollection.$$map).toEqual({
        1: 0,
        2: 1,
        3: 2,
        4: 3
      });
    });

    it('should slice entire collection', function() {
      var c1 = collection.slice();
      jasmine.clock().tick(1);
      expect(c1).toEqual(collection);

      var c2 = collection.slice(0);
      jasmine.clock().tick(1);
      expect(c2).toEqual(collection);

      var c3 = collection.slice(0, collection.length);
      jasmine.clock().tick(1);
      expect(c3).toEqual(collection);
    });

    it('should slice part of collection', function() {
      var results = collection.slice(0, 1);
      expect(results.length).toBe(1);
      expect(results[0]).toBe(collection[0]);
      expect(results.$$map).toEqual({
        1: 0
      });
    });

    it('should get index of element', function() {
      expect(collection.indexOf(o1)).toBe(0);
      expect(collection.indexOf(o2)).toBe(1);
      expect(collection.indexOf({ id: 3 })).toBe(-1);
    });

    it('should get last index of element', function() {
      expect(collection.lastIndexOf(o1)).toBe(0);
      expect(collection.lastIndexOf(o2)).toBe(1);
      expect(collection.lastIndexOf({ id: 3 })).toBe(-1);
    });

    it('should get first element of collection', function() {
      expect(collection.first()).toBe(o1);
      expect(collection.first(1)).toEqual([o1]);
      expect(collection.first(2)).toEqual([o1, o2]);
    });

    it('should get last element of collection', function() {
      expect(collection.last()).toBe(o2);
      expect(collection.last(1)).toEqual([o2]);
      expect(collection.last(2)).toEqual([o1, o2]);
    });

    it('should apply callback on each elements', function() {
      var callback = jasmine.createSpy('callback');

      collection.forEach(callback);

      expect(callback).toHaveBeenCalledWith(collection[0], 0, collection);
      expect(callback).toHaveBeenCalledWith(collection[1], 1, collection);
    });

    it('should map elements', function() {
      var callback = jasmine.createSpy('callback').and.callFake(function(current) {
        return current.id;
      });

      var newArray = collection.map(callback);

      expect(newArray.length).toBe(2);
      expect(newArray[0]).toBe(collection[0].id);
      expect(newArray[1]).toBe(collection[1].id);

      expect(callback).toHaveBeenCalledWith(collection[0], 0, collection);
      expect(callback).toHaveBeenCalledWith(collection[1], 1, collection);
    });

    it('should check if every collection elements satisfies test', function() {
      var callback = jasmine.createSpy('callback').and.callFake(function(current) {
        return !!current.id;
      });

      var result = collection.every(callback);

      expect(result).toBe(true);
      expect(callback).toHaveBeenCalledWith(collection[0], 0, collection);
      expect(callback).toHaveBeenCalledWith(collection[1], 1, collection);
    });

    it('should check if some collection elements satisfies test', function() {
      var callback = jasmine.createSpy('callback').and.callFake(function(current) {
        return !!current.id;
      });

      var result = collection.some(callback);

      expect(result).toBe(true);
      expect(callback).toHaveBeenCalledWith(collection[0], 0, collection);
      expect(callback).not.toHaveBeenCalledWith(collection[1], 1, collection);
    });

    it('should reduce collection from left to right', function() {
      var callback = jasmine.createSpy('callback').and.callFake(function(previous, current) {
        return previous + current.id;
      });

      var result = collection.reduce(callback, 0);

      expect(result).toBe(3);
      expect(callback).toHaveBeenCalledWith(0, collection[0], 0, collection);
      expect(callback).toHaveBeenCalledWith(1, collection[1], 1, collection);
    });

    it('should reduce collection from right to left', function() {
      var callback = jasmine.createSpy('callback').and.callFake(function(previous, current) {
        return previous + current.id;
      });

      var result = collection.reduceRight(callback, 0);

      expect(result).toBe(3);
      expect(callback).toHaveBeenCalledWith(0, collection[1], 1, collection);
      expect(callback).toHaveBeenCalledWith(2, collection[0], 0, collection);
    });

    it('should filter collection', function() {
      var callback = jasmine.createSpy('callback').and.callFake(function(current) {
        return current.id === 2;
      });

      var results = collection.filter(callback);

      expect(results).toEqual([collection[1]]);
      expect(callback).toHaveBeenCalledWith(collection[0], 0, collection);
      expect(callback).toHaveBeenCalledWith(collection[1], 1, collection);
    });

    it('should reject collection', function() {
      var callback = jasmine.createSpy('callback').and.callFake(function(current) {
        return current.id === 2;
      });

      var results = collection.reject(callback);

      expect(results).toEqual([collection[0]]);
      expect(callback).toHaveBeenCalledWith(collection[0], 0, collection);
      expect(callback).toHaveBeenCalledWith(collection[1], 1, collection);
    });

    it('should find element in collection', function() {
      var callback = jasmine.createSpy('callback').and.callFake(function(current) {
        return current.id === 2;
      });

      var result = collection.find(callback);

      expect(result).toBe(collection[1]);
      expect(callback).toHaveBeenCalledWith(collection[0], 0, collection);
      expect(callback).toHaveBeenCalledWith(collection[1], 1, collection);
    });

    it('should find element index in collection', function() {
      var callback = jasmine.createSpy('callback').and.callFake(function(current) {
        return current.id === 2;
      });

      var result = collection.findIndex(callback);

      expect(result).toBe(1);
      expect(callback).toHaveBeenCalledWith(collection[0], 0, collection);
      expect(callback).toHaveBeenCalledWith(collection[1], 1, collection);
    });

    it('should partition array', function() {
      var callback = jasmine.createSpy('callback').and.callFake(function(value) {
        return value.id % 2 === 0;
      });

      var a = [0, 1, 2, 3, 4, 5];

      var partition = collection.partition(callback);

      expect(partition).toEqual([
        [collection[1]],
        [collection[0]]
      ]);

      expect(callback).toHaveBeenCalledWith(collection[0], 0, collection);
      expect(callback).toHaveBeenCalledWith(collection[1], 1, collection);
    });
  });
});
