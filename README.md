# Instrumitter

[![Build Status](https://travis-ci.org/mlrawlings/instrumitter.svg?branch=master)](https://travis-ci.org/mlrawlings/instrumitter)
[![Coverage Status](https://coveralls.io/repos/github/mlrawlings/instrumitter/badge.svg?branch=master)](https://coveralls.io/github/mlrawlings/instrumitter?branch=master)

Instrumitter makes it dead simple to instrument function calls and emit information about those calls so you can get insight into what is happening in your node.js application.

```
npm install instrumitter
```

## Example

```js
var instrumitter = require('instrumitter');
var httpEvents = instrumitter('http').watch('get')

// now we can listen for any time require('http').get is called
// and get information about its return value and callback value

httpEvents
    .on('get:return', function(fn) {
        console.log('http.get was called with', fn.arguments)
        console.log('http.get returned', fn.return.value, 'in', fn.return.elapsed, 'ms');
    })
    .on('get:callback', function(fn) {
        console.log('http.get calledback ', fn.callback.value, 'in', fn.callback.elapsed, 'ms');
    });
```

## Usage

Instrumitter exposes a single function with the following signature:

```js
instrumitter(object)
```

`object` is an object that has a function as a property (or properties) that we want to listen to. If `object` is a string, it will be treated as a path to require a module.

### Methods

Once you have an instrumitter, you can call methods on it:

#### `watch`

```js
myInstrumitter.watch(method1, method2, method3, ..., methodN)
```

The method names passed to `watch` are properties of the object for which the instrumitter was created.  You can pass any number of arguments to watch.  The value `*` as an argument will watch all properties of the object that are functions.  The value `.` as an argument will watch the object itself (assuming it is a function).

`watch` returns the instrumitter it was called on, so it can be easily used in an assignment statement when setting up the instrumitter:

```js
var httpEvents = instrumitter('http').watch('get', 'post')
```

> NOTE: to directly watch a function the instrumitter must be created by passing the path to a module that exports the function.

#### `on` & `once`

For the most part, these events follow the [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) spec, but allow passing options and listening to an event actually triggers additional work to be done in order to emit that event.  Most notably, the `:callback` event causes the last function argument to be wrapped so that we can get the data that is passed to it.

```js
myInstrumitter.on(event[, options], handler)
```

- **`event`**: the methodName/eventName combo to watch (ex. `get:return` to watch the return event of the get method)
- **`options`**: an optional [options](#options) object
- **`handler`**: the function to handle the event

### Events

Instrumitter supports four events: `invoke`, `return`, `callback`, and `promise`.  The data object that is emitted for the `invoke` event will be the same data object that is passed to subsequent events, but each event will add its own data to the object.

#### `:invoke`

`invoke` is emitted at the time that the function is called.
At this point the emitted data looks like this:

```js
{
    this,               // context the function was run in
    arguments           // arguments passed to the function
}
```

> NOTE: To get the best measure of how long a function call takes, we do not
> capture the start time until after all handlers for the invoke event have finished

#### `:return`

`return` is emitted directly following the completion of the function call.  
A `return` object will be added to the emitted data:

```js
{
    this,               // context the function was run in
    arguments,          // arguments passed to the function
    time,               // time the function was invoked
    return: {
        value,          // return value
        error,          // error, if one was thrown
        time,           // time return was called
        elapsed     // time since the invocation of the function
    }
}
```

#### `:callback`

`callback` will be emitted when the callback to a function is called
and will contain the following data:

```js
{
    this,               // context the function was run in
    arguments,          // arguments passed to the function
    time,               // time the function was invoked
    return: {
        value,          // return value
        error,          // error, if one was thrown
        time,           // time return was called
        elapsed     // time since the invocation of the function
    },
    callback: {
        this,           // the context the callback was run in
        arguments,      // all arguments passed to the callback
        error,          // the first argument passed to the callback
        value,          // the second argument passed to the callback
        time,           // the time the callback was called
        elapsed,    // time since the invocation of the original function
    }
}
```

#### `:promise`

`promise` will be emitted when the promise returned from the function is resolved
and will contain the following data:

```js
{
    this,               // context the function was run in
    arguments,          // arguments passed to the function
    time,               // time the function was invoked
    return: {
        value,          // return value
        error,          // error, if one was thrown
        time,           // time return was called
        elapsed     // time since the invocation of the function
    },
    promise: {
        value,          // the resolved value of the promise
        error,          // error, if one was thrown
        time,           // the time the promise was resolved
        elapsed,    // time since the invocation of the original function
    }
}
```

### Options

#### Adding Stack Traces

Because adding stack traces introduces a bit more overhead they are disabled by default.  You can turn them on when you listen to your instrumitter by adding `stack:true` to an options object:

```js
var httpEvents = instrumitter('http').watch('get');
httpEvents.on('get:return', { stack:true }, function(fn) {
    console.log(fn.stack)
})
```

```js
{
    // ...
    stack:[{
        name,   // name of the function in the stack
        file,   // file in which the function resides
        line,   // file line number
        char    // line character position
    }],
    // ...
}
```

## More Examples

Capturing the methods of a class that is exported by a module:

```js
var instrumitter = require('instrumitter');
var FooEvents = instrumitter(require('./Foo').prototype).watch('bar')

FooEvents.on('bar:return', function(fn) {
    console.log(fn.return.value)
})
```

Capturing a function exported by a module:

```js
var instrumitter = require('instrumitter');
var doSomethingEvents = instrumitter('./doSomething').watch('.')

doSomethingEvents.on(':return', function(fn) {
    console.log(fn.return.value)
})
```
