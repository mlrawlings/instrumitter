"use strict"

var EventEmitter = require('events').EventEmitter
var util = require('./util')
var wrapFn = util.wrapFn
var isFunction = util.isFunction
var forEach = [].forEach;

module.exports = class Instrumitter extends EventEmitter {
    constructor(input) {
        super()
        this.object = input.object
        this.modulePath = input.modulePath
        this.methods = {}
    }

    watch() {
        forEach.call(arguments, methodName => {
            if(this.methods[methodName]) return

            var method = this.methods[methodName] = { fn:methodName }
            var parent = this.object
            var key = methodName

            if(methodName === '*') {
                return Object.keys(this.object).forEach(key => {
                    if(isFunction(this.object[key])) {
                        this.watch(key)
                    }
                })
            }

            if(methodName === '.') {
                if(!this.modulePath) throw new Error(
                    'You cannot instrument a function directly.  ' +
                    'You must pass an object that the function is ' +
                    'a property of, or the path to the module that ' +
                    'exports the function.'
                )
                method.fn = ''
                parent = require.cache[this.modulePath]
                key = 'exports'
            }

            if(!isFunction(parent[key])) throw new Error(
                'The property you are trying to instrument is not a function'
            )

            parent[key] = wrapFn(parent[key], method, this)
        })
        return this
    }

    on(event, options, listener) {
        if(!listener && isFunction(options)) {
            listener = options
            options = undefined
        }

        super.on(event, listener)
        this._onListen(event, options)
        return this
    }

    once(event, options, listener) {
        if(!listener && isFunction(options)) {
            listener = options
            options = undefined
        }

        super.once(event, listener)
        this._onListen(event, options)
        return this
    }

    _onListen(event, options) {
        var parts = event.split(':')
        if(parts.length !== 2) {
            return // not an instrumitter event...
        }

        var methodName = parts[0]
        var methodEvent = parts[1]
        var method = this.methods[methodName||'.']

        if(!method) {
            return console.warn('Capturing of '+methodName+' has not been set up')
        }

        method[methodEvent] = true

        Object.keys(options || {}).forEach(key => {
            method[key] = options[key]
        })
    }
}