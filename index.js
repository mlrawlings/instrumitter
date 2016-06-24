var path = require('path')
var EventEmitter = require('events').EventEmitter
var resolve = require('resolve')

module.exports = function instrumitter(object, capture, options) {
    var modulePath
    var emitter = new EventEmitter()
    options = options || {}

    if(typeof object === 'string') {
        modulePath = resolve.sync(object, { basedir:path.dirname(getCallerFilePath()) })
        object = require(modulePath)
    }

    capture.forEach(capture => {
        var parent, key
        capture = parseEvents(capture)
        parent = object
        key = capture.fn

        if(!capture.fn) {
            if(!modulePath) throw new Error(
                'You cannot instrument a function directly.  ' +
                'You must pass an object that the function is ' +
                'a property of, or the path to the module that ' +
                'exports the function.'
            )
            capture.fn = ''
            parent = require.cache
            key  = modulePath
        }

        parent[key] = wrapFn(parent[key], capture, emitter, options)
    })

    return emitter
}

function wrapFn(fn, capture, emitter, options) {
    var wrappedFn = function() {
        var data = {
            this:this,
            arguments:Array.from(arguments)
        }

        handleInvokeEvent(data, capture, emitter, options)
        handleCallbackEvent(data, capture, emitter)

        var args = data.arguments
        var before = process.hrtime()
        var result = fn.apply(this, args)
        var after = process.hrtime()

        handleReturnEvent(data, capture, emitter, result, before, after)
        handlePromiseEvent(data, capture, emitter)

        return result
    }

    copyFnProperties(wrappedFn, fn)

    return wrappedFn
}

function copyFnProperties(target, source) {
    Object.defineProperties(target, {
        name: { value:source.name },
        length: { value:source.length }
    })

    Object.keys(source).forEach(key => {
        target[key] = source[key]
    })
}

function handleInvokeEvent(data, capture, emitter, options) {
    if(options.stack) {
        data.stack = []
    }

    if(hasEvent(capture, 'invoke')) {
        emitter.emit(capture.fn+':invoke', data)
    }
}

function handleReturnEvent(data, capture, emitter, result, before, after) {
    data.time = hrTimeToMilliSeconds(before)
    data.return = { value:result, time:hrTimeToMilliSeconds(after) }
    data.return.elapsedTime = data.return.time - data.time

    if(hasEvent(capture, 'return')) {
        emitter.emit(capture.fn+':return', data)
    }
}

function handleCallbackEvent(data, capture, emitter) {
    var args = data.arguments
    var callback = args[args.length-1]

    if(capture.events.callback && !isFunction(callback)) {
        callback = function(){}
        args = args.push(callback)
    }

    if(hasEvent(capture, 'callback') && isFunction(callback)) {
        args[args.length-1] = function() {
            var time = hrTimeToMilliSeconds(process.hrtime())
            data.callback = {
                this:this,
                arguments:Array.from(arguments),
                error:arguments[0],
                value:arguments[1],
                time,
                elapsedTime:time - data.time
            }
            emitter.emit(capture.fn+':callback', data)
            callback.apply(this, arguments)
        }
    }
}

function handlePromiseEvent(data, capture, emitter) {
    var result = data.return

    if(isPromise(result) && hasEvent(capture, 'promise')) {
        result.then(function(value) {
            var time = hrTimeToMilliSeconds(process.hrtime())
            data.promise = {
                time,
                value,
                elapsedTime:time - data.time
            }
            emitter.emit(capture.fn+':promise', data)
        }).catch(function(error) {
            var time = hrTimeToMilliSeconds(process.hrtime())
            data.promise = {
                time,
                error,
                elapsedTime:time - data.time
            }
            emitter.emit(capture.fn+':promise', data)
        })
    }
}

function hasEvent(capture, eventName) {
    return capture.events.all || capture.events[eventName]
}

function isPromise(promise) {
    return promise.then instanceof Function
        && promise.catch instanceof Function
}

function isFunction(fn) {
    return fn instanceof Function
}

function getCallerFilePath() {
    var origPrepareStackTrace = Error.prepareStackTrace
    Error.prepareStackTrace =  (_, stack) => stack
    var stack = (new Error).stack
    Error.prepareStackTrace = origPrepareStackTrace
    return stack[2].getFileName()
}

function getCallStack() {
    var origPrepareStackTrace = Error.prepareStackTrace
    Error.prepareStackTrace = (_, stack) => stack
    var stack = (new Error).stack
    Error.prepareStackTrace = origPrepareStackTrace
    return stack.slice(2).map(s => s)
}

function parseEvents(string) {
    var parts = string.split(':')
    var fn = parts.splice(0, 1)[0]
    var events = parts.reduce((events, part) => {
        if(part == '*') {
            events.all = true
        } else {
            events[part] = true
        }
        return events
    }, {})

    return { fn, events }
}

function hrTimeToMilliSeconds(time) {
    return time[0] * 1e3 + time[1]/1e6
}