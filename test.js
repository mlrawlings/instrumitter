var instrumitter = require('.')
var httpEmitter = instrumitter('http', ['get:*'])
var expect = require('chai').expect

describe('instrumitter', () => {
    it('should emit invocations', done => {
        var http = require('http')
        httpEmitter.once('get:invoke', fn => {
            expect(fn).to.eql({
                this:http,
                arguments:['http://www.google.com']
            })
            done()
        })
        http.get('http://www.google.com')
    })
    it('should allow passing an object', done => {
        var object = {
            test:function() {
                return 123
            }
        }

        var objectEvents = instrumitter(object, ['test:return'])
        objectEvents.once('test:return', fn => {
            expect(fn.arguments).to.eql(['abc'])
            expect(fn.return.value).to.eql(123)
            expect(fn.return.elapsed).to.be.above(0)
            done()
        })

        object.test('abc')
    })
    it('should have the same name and properties as the original function', () => {
        var object = { test:function testName(a, b, c) {} }
        object.test.property = 123
        var objectEmitter = instrumitter(object, ['test:return'])
        expect(object.test.name).to.equal('testName')
        expect(object.test.length).to.equal(3)
        expect(object.test.property).to.equal(123)
    })
    it('should handle callbacks', done => {
        var http = require('http')
        var called
        httpEmitter.once('get:callback', fn => {
            called = true
            expect(fn.callback.arguments.length).to.equal(1)
            expect(fn.callback.arguments[0]).to.be.instanceof(http.IncomingMessage)
            expect(fn.callback.elapsed).to.be.above(0)
        })
        http.get('http://www.google.com', (response) => {
            expect(called).to.be.true
            expect(response).to.be.instanceof(http.IncomingMessage)
            done()
        })
    })
    it('should force a callback when the `:callback` event is requested')
    it('should handle promises', done => {
        var object = {
            test: function() {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve(123)
                    }, 100)
                })
            }
        }
        var objectEvents = instrumitter(object, ['test:promise'])
        objectEvents.on('test:promise', fn => {
            expect(fn.promise.value).to.equal(123)
            done()
        })
        object.test()
    })
    it('should handle promises that reject', done => {
        var object = {
            test: function() {
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        reject(new Error())
                    }, 100)
                })
            }
        }
        var objectEvents = instrumitter(object, ['test:promise'])
        objectEvents.on('test:promise', fn => {
            expect(fn.promise.error).to.be.an.instanceof(Error)
            done()
        })
        object.test()
    })
    it('should include the stack when the option is present', done => {
        var object = {
            test: function() { return 123 }
        }
        var objectEvents = instrumitter(object, ['test:invoke'], { stack:true })
        objectEvents.once('test:invoke', fn => {
            expect(fn.stack[0].file).to.equal(__filename)
            expect(fn.stack[0].line).to.be.above(0)
            expect(fn.stack[0].char).to.be.above(0)
            expect(Object.keys(fn.stack[0]).length).to.equal(4)
            done()
        })
        object.test()
    })
    it('should allow you to instrument a function exported as `module.exports`', done => {
        var padEvents = instrumitter('left-pad', [':return'])
        var pad = require('left-pad')
        padEvents.on(':return', fn => {
            expect(fn.arguments).to.eql(['foo', 5])
            expect(fn.return.value).to.equal('  foo')
            done()
        })
        pad('foo', 5)
    })
    it('should throw if you try to instrument a function directly', () => {
        expect(() => {
            instrumitter(function(){}, [':return'])
        }).to.throw(/instrument a function directly/)
    })
    it('should throw if you try to instrument a property that is not a function', () => {
        expect(() => {
            instrumitter({}, ['abc:return'])
        }).to.throw(/not a function/)
    })
    it('should instrument all properties of an object that are functions when using a wildcard')
    it('should not reinstument a function, but rather emit addtional events if they are requested')
})
