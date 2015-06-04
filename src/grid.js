/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2015 Mickael Jeanroy, Cedric Nisio
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

/* jshint eqnull: true */
/* global $doc */
/* global Collection */
/* global Column */
/* global $ */
/* global _ */
/* global $parse */
/* global $comparators */
/* global $util */
/* global EventBus */
/* global GridBuilder */
/* global GridDomHandlers */
/* global GridDataObserver */
/* global GridSelectionObserver */
/* global $$createComparisonFunction */
/* global CSS_GRID */
/* global CSS_SORTABLE_ASC */
/* global CSS_SORTABLE_DESC */
/* global CSS_SCROLLABLE */
/* global CSS_SELECTABLE */
/* global DATA_WAFFLE_ORDER */
/* global CHAR_ORDER_ASC */
/* global CHAR_ORDER_DESC */
/* exported Grid */

var Grid = (function() {

  // Save bytes
  var toPx = $util.toPx;
  var fromPx = $util.fromPx;

  // Normalize sort predicate
  // This function will return an array of id preprended with sort order
  // For exemple:
  //   parseSort('foo') => ['+foo']
  //   parseSort(['foo', 'bar']) => ['+foo', '+bar']
  //   parseSort(['-foo', 'bar']) => ['-foo', '+bar']
  //   parseSort(['-foo', '+bar']) => ['-foo', '+bar']
  var parseSort = function(ids) {
    var array = ids || [];
    if (!_.isArray(array)) {
      array = [array];
    }

    return _.map(array, function(current) {
      var firstChar = current.charAt(0);
      return firstChar !== CHAR_ORDER_ASC && firstChar !== CHAR_ORDER_DESC ? CHAR_ORDER_ASC + current : current;
    });
  };

  // == Private utilities

  // Get exisiting node or create it and append it to the table.
  var createNode = function(tagName) {
    // Get existing node or create it
    var varName = '$' + tagName;
    var $table = this.$table;

    // Get it...
    this[varName] = $($doc.byTagName(tagName, $table[0]));

    // ... or create it !
    if (!this[varName].length) {
      this[varName] = $($doc[tagName]());
    }

    // Just append at the end of the table
    $table.append(this[varName][0]);
  };

  var dataObserver = function(changes) {
    return GridDataObserver.on(this, changes);
  };

  var selectionObserver = function(changes) {
    return GridSelectionObserver.on(this, changes);
  };

  var callbackWrapper = function(name) {
    var fn = this.options.events[name];
    if (fn) {
      this.addEventListener(name.slice(2), this.options.events[name]);
    }
  };

  var Constructor = function(table, options) {
    if (!(this instanceof Constructor)) {
      return new Constructor(table, options);
    }

    var opts = options = options || {};
    var defaultOptions = Constructor.options;

    // Initialize nested object of options with default values.
    _.forEach(['events', 'selection', 'size'], function(optName) {
      var opt = opts[optName];
      if (_.isObject(opt) || _.isUndefined(opt)) {
        opts[optName] = _.defaults(opt || {}, defaultOptions[optName]);
      }
    });

    // Initialize options with default values.
    // Keep options as an internal property.
    this.options = _.defaults(opts, defaultOptions);

    // Translate size to valid numbers.
    opts.size = {
      width: fromPx(opts.size.width),
      height: fromPx(opts.size.height)
    };

    // Force scroll if height is specified.
    opts.scrollable = opts.scrollable || !!opts.size.height;

    // Options flags
    var isSelectable = this.isSelectable();
    var isSortable = this.isSortable();
    var isScrollable = opts.scrollable;

    // Initialize main table
    this.$table = $(table);

    // Initialize data
    this.$data = new Collection(opts.data, {
      key: opts.key,
      model: opts.model
    });

    if (!isSortable) {
      // Force column not to be sortable
      _.forEach(opts.columns, function(column) {
        column.sortable = false;
      });
    }

    this.$columns = new Collection(opts.columns, {
      key: 'id',
      model: Column
    });

    this.$sortBy = [];

    // Add appropriate css to table
    this.$table.addClass(CSS_GRID);

    if (isSelectable) {
      this.$table.addClass(CSS_SELECTABLE);
    }

    if (isScrollable) {
      this.$table.addClass(CSS_SCROLLABLE);
    }

    // Create main nodes
    _.forEach(['thead', 'tbody', 'tfoot'], createNode, this);

    // Bind dom handlers only if needed
    if (isSelectable || isSortable) {
      this.$thead.on('click', _.bind(GridDomHandlers.onClickThead, this));
      this.$tfoot.on('click', _.bind(GridDomHandlers.onClickTfoot, this));
    }

    // Observe collection to update grid accordingly
    this.$data.observe(dataObserver, this);

    if (isSelectable) {
      this.$selection = new Collection([], this.$data.options());
      this.$tbody.on('click', _.bind(GridDomHandlers.onClickTbody, this));
      this.$selection.observe(selectionObserver, this);
    }

    // Create event bus...
    this.$bus = new EventBus();

    // ... and wrap callbacks to events
    _.forEach(_.keys(opts.events), callbackWrapper, this);

    // If height is specified, we need to set column size.
    if (opts.size.height || opts.size.width) {
      this.assignWidth();
    }

    this.renderHeader()
        .renderFooter()
        .sortBy(options.sortBy, false)
        .renderBody();

    this.dispatchEvent('initialized');
  };

  // Create new grid
  Constructor.create = function(table, options) {
    return new Constructor(table, options);
  };

  Constructor.prototype = {
    // Get data collection
    data: function() {
      return this.$data;
    },

    // Get columns collection
    columns: function() {
      return this.$columns;
    },

    // Get selection collection
    selection: function() {
      return this.$selection;
    },

    // Check if grid is sortable
    isSortable: function() {
      return this.options.sortable;
    },

    // Check if grid is selectable
    isSelectable: function() {
      var selection = this.options.selection;
      return selection && selection.enable;
    },

    // Check if grid render checkbox as first column
    hasCheckbox: function() {
      return this.isSelectable() && this.options.selection.checkbox;
    },

    // Without parameter, check if grid is selected.
    // If first parameter is set, check if data is selected.
    isSelected: function(data) {
      if (!this.isSelectable()) {
        return false;
      }

      if (data) {
        return this.$selection.contains(data);
      }

      var s1 = this.$data.length;
      var s2 = this.$selection.length;
      return s1 > 0 && s1 === s2;
    },

    // Render entire grid
    render: function() {
      return this.renderHeader()
                 .renderFooter()
                 .renderBody();
    },

    // Calculate column width
    assignWidth: function() {
      var size = this.options.size;
      var rowWidth = size.width;

      if (size.height) {
        var px = toPx(size.width);
        this.$table.css({
                     width: px,
                     maxWidth: px,
                     minWidth: px
                   });

        this.$tbody.css({
          maxHeight: toPx(size.height)
        });

        rowWidth -= $doc.scrollbarWidth();

        if (this.hasCheckbox()) {
          rowWidth -= 30;
        }
      }

      var constrainedWidth = 0;
      var constrainedColumnCount = 0;
      this.$columns.forEach(function(col) {
        var width = col.width;
        if (width) {
          constrainedWidth += width;
          ++constrainedColumnCount;
        }
      });

      var columnCount = this.$columns.length;
      var remainingColumns = columnCount - constrainedColumnCount;
      var flooredCalculatedWidth = 0;
      var remains = 0;
      if (remainingColumns) {
        var calculatedWidthColumn = (rowWidth - constrainedWidth) / remainingColumns;
        flooredCalculatedWidth = Math.floor(calculatedWidthColumn);
        remains = calculatedWidthColumn - flooredCalculatedWidth;
      }

      var offset = 0;
      this.$columns.forEach(function(col) {
        var oldWidth = col.width;
        var newWidth = oldWidth || 0;

        // If size is not explicitly specified, we should compute a size
        // For now, use the same width for every column
        if (!newWidth) {
          offset += remains;
          if (offset >= 1) {
            newWidth = flooredCalculatedWidth + 1;
            offset--;
          } else {
            newWidth = flooredCalculatedWidth;
          }
        }

        // Update size if we detect a change
        if (newWidth !== oldWidth) {
          col.updateWidth(newWidth);
        }
      });

      return this;
    },

    // Render entire header of grid
    renderHeader: function() {
      var tr = GridBuilder.theadRow(this);
      this.$thead.empty().append(tr);
      return this;
    },

    // Render entire footer of grid
    renderFooter: function() {
      var tr = GridBuilder.tfootRow(this);
      this.$tfoot.empty().append(tr);
      return this;
    },

    // Render entire body of grid
    // Each row is appended to a fragment in memory
    // This fragment will be appended once to tbody element to avoid unnecessary DOM access
    // If render is asynchronous, data will be split into chunks, each chunks will be appended
    // one by one using setTimeout to let the browser to be refreshed periodically.
    renderBody: function(async) {
      var asyncRender = async == null ? this.options.async : async;
      var grid = this;

      var empty = _.once(function() {
        grid.$tbody.empty();
      });

      var build = function(data, startIdx) {
        var fragment = GridBuilder.tbodyRows(grid, data, startIdx);
        empty();
        grid.$tbody.append(fragment);
      };

      var onEnded = function() {
        grid.$data.clearChanges();

        grid.dispatchEvent('rendered', function() {
          return {
            data: this.$data,
            nodes: _.toArray(this.$tbody[0].childNodes)
          };
        });

        // Free memory
        grid = empty = build = onEnded = null;
      };

      if (asyncRender) {
        $util.asyncTask(this.$data.split(200), 10, build, onEnded);
      } else {
        build(this.$data, 0);
        onEnded();
      }

      return this;
    },

    // Select everything
    select: function() {
      if (this.$selection.length !== this.$data.length) {
        this.$selection.add(this.$data.toArray());
      }

      return this;
    },

    // Deselect everything
    deselect: function() {
      if (!this.$selection.isEmpty()) {
        this.$selection.clear();
      }

      return this;
    },

    // Sort grid by fields
    // Second parameter is a parameter used internally to disable automatic rendering after sort
    sortBy: function(sortBy, $$render) {
      // Store new sort
      var normalizedSortBy = parseSort(sortBy);

      // Check if sort predicate has changed
      // Compare array instance, or serialized array to string and compare string values (faster than array comparison)
      if (this.$sortBy === normalizedSortBy || this.$sortBy.join() === normalizedSortBy.join()) {
        return this;
      }

      this.$sortBy = normalizedSortBy;

      // Remove order flag
      var $headers = this.$thead.children().eq(0).children();
      var $footers = this.$tfoot.children().eq(0).children();

      $headers.removeClass(CSS_SORTABLE_ASC + ' ' + CSS_SORTABLE_DESC).removeAttr(DATA_WAFFLE_ORDER);
      $footers.removeClass(CSS_SORTABLE_ASC + ' ' + CSS_SORTABLE_DESC).removeAttr(DATA_WAFFLE_ORDER);

      // Create comparators object that will be used to create comparison function
      var $columns = this.$columns;
      var hasCheckbox = this.hasCheckbox();

      var comparators = _.map(this.$sortBy, function(id) {
        var flag = id.charAt(0);
        var columnId = id.substr(1);
        var asc = flag === CHAR_ORDER_ASC;

        var index = $columns.indexOf(columnId);
        var thIndex = hasCheckbox ? index + 1 : index;

        var column;

        if (index >= 0) {
          column = $columns.at(index);
          column.asc = asc;

          // Update order flag
          $headers.eq(thIndex)
                  .addClass(asc ? CSS_SORTABLE_ASC : CSS_SORTABLE_DESC)
                  .attr(DATA_WAFFLE_ORDER, flag);

          $footers.eq(thIndex)
                  .addClass(asc ? CSS_SORTABLE_ASC : CSS_SORTABLE_DESC)
                  .attr(DATA_WAFFLE_ORDER, flag);

        } else {
          column = {};
        }

        return {
          parser: column.$parser || $parse(id),
          fn: column.$comparator || $comparators.$auto,
          desc: !asc
        };
      });

      this.$data.sort($$createComparisonFunction(comparators));

      if ($$render !== false) {
        // Body need to be rendered since data is now sorted
        this.renderBody();
      }

      return this.dispatchEvent('sorted');
    },

    // Trigger events listeners
    // First argument is the name of the event.
    // For lazy evaluation of arguments, second argument is a function that
    // should return event argument. This function will be called if and only if
    // event need to be triggered.
    // If lazy evaluation is needless, just put arguments next to event name.
    dispatchEvent: function(name, argFn) {
      this.$bus.dispatchEvent(this, name, argFn);
      return this;
    },

    addEventListener: function(type, listener) {
      this.$bus.addEventListener(type, listener);
      return this;
    },

    removeEventListener: function(type, listener) {
      this.$bus.removeEventListener(type, listener);
      return this;
    },

    // Destroy datagrid
    destroy: function() {
      // Unbind dom events
      this.$thead.off();
      this.$tfoot.off();
      this.$tbody.off();

      // Unobserve collection
      this.$data.unobserve();
      this.$selection.unobserve();

      // Clear event bus
      this.$bus.clear();

      // Destroy internal property
      $util.destroy(this);
    }
  };

  // Define default options.
  Constructor.options = {
    // Default identifier for data.
    key: 'id',

    // Asynchronous rendering, disable by default.
    // Should be used to improve user experience with large dataset.
    async: false,

    // Global scrolling
    // Scrolling is automatically set to true if height is set
    // using size option.
    // If size is not set, scolling is enabled, but column and table
    // size have to be set using css.
    scrollable: false,

    // Global sorting
    // Sort can also be disabled per column
    sortable: true,

    // Selection configuration.
    // By default it is enable.
    selection: {
      enable: true,
      checkbox: true,
      multi: false
    },

    // Size of grid, default is to use automatic size.
    size: {
      width: null,
      height: null
    },

    // Set of events.
    events: {
    }
  };

  // Initialize events with noop
  _.forEach(['onInitialized', 'onRendered', 'onDataSpliced', 'onDataUpdated', 'onSelectionChanged', 'onSorted'], function(name) {
    Constructor.options.events[name] = null;
  });

  return Constructor;

})();
