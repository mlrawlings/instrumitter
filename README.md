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
var httpEvents = instrumitter('http', ['get:return:callback'])

// now we can listen for any time require('http').get is called
// and get information about its return value and callback value

httpEvents
    .on('get:return', function(fn) {
        console.log('http.get was called with', fn.arguments)
        console.log('http.get returned', fn.return.value, 'in', fn.return.elapsedTime, 'ms');
    })
    .on('get:callback', function(fn) {
        console.log('http.get calledback ', fn.callback.value, 'in', fn.callback.elapsedTime, 'ms');
    });
```

## Usage

Instrumitter exposes a single function with the following signature:

```cpp
instrumitter(object, events[, options])
```

- **`object`**: An object that has a function as a property that we want to listen to.
    - If `object` is a string, it will be treated as a path to require a module
- **`events`**: An array of strings in the format `'functionName:eventName'`.
    - Multiple events can be strung together: `functionName:event1:event2`.
    - Wildcards
        - A wild card event can be to capture all events: `functionName:*`
        - A wild card function can be used to capture all function properties: `*:return`
        - And you can use a wildcard on both sides: `*:*`
- **`options`**: An optional [options](#options) object


### Events

Instrumitter supports four events: `invoke`, `return`, `callback`, and `promise`.  The data object that is emitted for the `invoke` event will be the same data object that is passed to subsequent events, but each event will add its own data to the object.

#### Invoke

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

#### return

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
        elapsedTime     // time since the invocation of the function
    }
}
```

#### callback

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
        elapsedTime     // time since the invocation of the function
    },
    callback: {
        this,           // the context the callback was run in
        arguments,      // all arguments passed to the callback
        error,          // the first argument passed to the callback
        value,          // the second argument passed to the callback
        time,           // the time the callback was called
        elapsedTime,    // time since the invocation of the original function
    }
}
```

#### promise

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
        elapsedTime     // time since the invocation of the function
    },
    promise: {
        value,          // the resolved value of the promise
        error,          // error, if one was thrown
        time,           // the time the promise was resolved
        elapsedTime,    // time since the invocation of the original function
    }
}
```

### Options

#### Adding Stack Traces

Because adding stack traces introduces a bit more overhead they are disabled by default.  You can turn them on when you create your instrumitter by adding `stack:true` to an options object:

```js
instrumitter('http', ['get:return'], { stack:true });
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
var FooEvents = instrumitter(require('./Foo').prototype, ['bar:return'])

FooEvents.on('bar:return', function(fn) {
    console.log(fn.return.value)
})
```

Capturing a function exported by a module:

```js
var instrumitter = require('instrumitter');
var doSomethingEvents = instrumitter('./doSomething', [':return'])

doSomethingEvents.on(':return', function(fn) {
    console.log(fn.return.value)
})
```
