var Instrumitter = require('./src/instrumitter')
var util = require('./src/util')
var resolve = require('resolve')
var _cache = new Map()

module.exports = function instrumitter(object) {
    var modulePath, instrumitter

    if(typeof object === 'string') {
        modulePath = resolve.sync(object, { basedir:util.getCallerDirName() })
        object = require(modulePath)
    }

    instrumitter = _cache.get(object)

    if(!instrumitter) {
        instrumitter = new Instrumitter({ object, modulePath })
        _cache.set(object, instrumitter)
    }

    return instrumitter
}
