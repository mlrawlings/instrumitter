var path = require('path')
var EventEmitter = require('events').EventEmitter
var resolve = require('resolve')

module.exports = function instrumitter(object, capture, options) {
    var modulePath
    var emitter = new EventEmitter()
    options = options || {}

    if(typeof object === 'string') {
        modulePath = resolve.sync(object, { basedir:getCallerFilePath() })
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
    var events = capture.events
    var wrappedFn = function() {
        var args = Array.from(arguments)
        var callback = args[args.length-1]

        var data = {
            this:this,
            arguments:args
        }

        if(options.stack) {
            data.stack = []
        }

        if(events.callback && !(callback instanceof Function)) {
            callback = function(){}
            args = args.concat([callback])
        }

        if((events.all || events.callback) && callback instanceof Function) {
            args = [].concat(args)
            var wrappedCallback = args[args.length-1] = function() {
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

        if(events.invoke || events.all) {
            emitter.emit(capture.fn+':invoke', data, args)
        }

        var before = process.hrtime()
        var result = fn.apply(this, args)
        var after = hrTimeToMilliSeconds(process.hrtime())

        data.time = hrTimeToMilliSeconds(before)
        data.return = { value:result, time:after }
        data.return.elapsedTime = data.return.time - data.time

        if(events.return || events.all) {
            emitter.emit(capture.fn+':return', data)
        }

        if(result.then instanceof Function
            && result.catch instanceof Function
            && (events.promise || events.all)
        ) {
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

        return result
    }

    Object.defineProperties(wrappedFn, {
        name: { value:fn.name },
        length: { value:fn.length }
    })

    Object.keys(fn).forEach(key => {
        wrappedFn[key] = fn[key]
    })

    return wrappedFn
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
    var events = {}

    parts.forEach(part => {
        if(part == '*') {
            events.all = true
        } else {
            events[part] = true
        }
    })

    return { fn, events }
}

function hrTimeToMilliSeconds(time) {
    return time[0] * 1e3 + time[1]/1e6
}