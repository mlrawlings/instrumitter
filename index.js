var path = require('path')
var EventEmitter = require('events').EventEmitter
var resolve = require('resolve')
var _cache = new Map()

module.exports = function instrumitter(object, capture, options) {
    var instrumitter = getInstrumitter(object, options)
    ensureCapture(instrumitter, capture)
    return instrumitter.emitter
}

function getInstrumitter(object, options) {
    var modulePath, instrumitter

    if(typeof object === 'string') {
        modulePath = resolve.sync(object, { basedir:path.dirname(getCallerFilePath()) })
        object = require(modulePath)
    }

    instrumitter = _cache.get(object)

    if(!instrumitter) {
        instrumitter = { object, modulePath, events:{}, options:{}, emitter:new EventEmitter() }
        _cache.set(object, instrumitter)
    }

    Object.keys(options || {}).forEach(option => {
        instrumitter.options[option] = options[option]
    })

    return instrumitter
}

function ensureCapture(instrumitter, capture) {
    capture.map(parseEvents).forEach(capture => {
        var parent = instrumitter.object
        var key = capture.fn

        if(instrumitter.events[key]) {
            Object.keys(capture.events).forEach(event => {
                instrumitter.events[key][event] = capture[event]
            })
            return
        }

        instrumitter.events[key] = capture.events

        if(!capture.fn) {
            if(!instrumitter.modulePath) throw new Error(
                'You cannot instrument a function directly.  ' +
                'You must pass an object that the function is ' +
                'a property of, or the path to the module that ' +
                'exports the function.'
            )
            capture.fn = ''
            parent = require.cache[instrumitter.modulePath]
            key = 'exports'
        }

        if(!isFunction(parent[key])) throw new Error(
            'The property you are trying to instrument is not a function'
        )

        parent[key] = wrapFn(parent[key], capture, instrumitter.emitter, instrumitter.options)
    })
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
        data.stack = getCallStack(2)
    }

    if(hasEvent(capture, 'invoke')) {
        emitter.emit(capture.fn+':invoke', data)
    }
}

function handleReturnEvent(data, capture, emitter, result, before, after) {
    data.time = hrTimeToMilliSeconds(before)
    data.return = { value:result, time:hrTimeToMilliSeconds(after) }
    data.return.elapsed = data.return.time - data.time

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
                elapsed:time - data.time
            }
            emitter.emit(capture.fn+':callback', data)
            callback.apply(this, arguments)
        }
    }
}

function handlePromiseEvent(data, capture, emitter) {
    var result = data.return.value

    if(isPromise(result) && hasEvent(capture, 'promise')) {
        result.then(function(value) {
            var time = hrTimeToMilliSeconds(process.hrtime())
            data.promise = {
                time,
                value,
                elapsed:time - data.time
            }
            emitter.emit(capture.fn+':promise', data)
        }).catch(function(error) {
            var time = hrTimeToMilliSeconds(process.hrtime())
            data.promise = {
                time,
                error,
                elapsed:time - data.time
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

function getCallStack(levelsAbove) {
    var origPrepareStackTrace = Error.prepareStackTrace
    Error.prepareStackTrace = (_, stack) => stack
    var stack = (new Error).stack
    Error.prepareStackTrace = origPrepareStackTrace
    return stack.slice((levelsAbove||0)+1).map(callsite => {
        return {
            name:callsite.getFunctionName(),
            file:callsite.getFileName(),
            line:callsite.getLineNumber(),
            char:callsite.getColumnNumber()
        }
    })
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