var should = require('should');

var fbuffers = require("../flexbuffer.js");
    
describe("tests" ,function(){
	afterEach(function(done){
		done();
	});
   	
	it ("write empty", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write();
		flexbuffer.getBufferReference().length.should.equal(0);
		done();
	});

	it ("simple write string", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.getBufferReference().length.should.equal(3);
		flexbuffer.getBufferReference().toString().should.equal("aaa")
		done();
	});

	it ("varios write string", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.write("ccc");
		flexbuffer.getBufferReference().length.should.equal(9);
		flexbuffer.getBufferReference().toString().should.equal("aaabbbccc")
		done();
	});

	it ("varios write buffer", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write(new Buffer("aaa"));
		flexbuffer.write(new Buffer("bbb"));
		flexbuffer.write(new Buffer("ccc"));
		flexbuffer.getBufferReference().length.should.equal(9);
		flexbuffer.getBufferReference().toString().should.equal("aaabbbccc")
		done();
	});


	it ("write number", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write(4545);
		flexbuffer.write(5656);
		flexbuffer.getBufferReference().length.should.equal(8);
		flexbuffer.getBufferReference().toString().should.equal("45455656")
		done();
	});

	it ("reset", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.write("ccc");
		flexbuffer.reset();
		flexbuffer.getBufferReference().length.should.equal(0);
		done();
	});

	it ("rewind", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.write("ccc");
		flexbuffer.rewind();
		flexbuffer.getBufferReference().length.should.equal(0);
		done();
	});

	it ("resizeBuffer de mas bytes", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.write("ccc");
		flexbuffer.resizeBuffer(60);
		flexbuffer.getBufferReference().length.should.equal(9);
		flexbuffer.getBufferReference().toString().should.equal("aaabbbccc")
		done();
	});

	it ("resizeBuffer menor al length", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.resizeBuffer(2);
		flexbuffer.getBufferReference().length.should.equal(6);
		flexbuffer.write("ccc");
		flexbuffer.getBufferReference().toString().should.equal("aaabbbccc")
		done();
	});


	it ("getBuffer", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.getBuffer().length.should.equal(6);
		flexbuffer.getBuffer().toString().should.equal("aaabbb")
		done();
	});

	it ("getBufferReference", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.getBufferReference().length.should.equal(6);
		flexbuffer.getBufferReference().toString().should.equal("aaabbb")
		done();
	});

	it ("getBufferReference validacion de referencia", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.getBufferReference().write("c", 0);
		flexbuffer.getBufferReference().toString().should.equal("caabbb");
		done();
	});


	it ("getBuffer validacion de copia", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.getBuffer().write("c", 0);
		flexbuffer.getBufferReference().toString().should.equal("aaabbb");
		done();
	});


	it ("getBuffer equal getBufferReference", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.getBuffer().toString().should.equal(flexbuffer.getBufferReference().toString());
		done();
	});

	it ("delete un caracter", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.delete(0,1);
		flexbuffer.getBuffer().toString().should.equal("aabbb");
		done();
	});


	it ("delete atras", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.delete(3,6);
		flexbuffer.getBuffer().toString().should.equal("aaa");
		done();
	});

	it ("delete medio", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.write("ccc");
		flexbuffer.delete(3,6);
		flexbuffer.getBuffer().toString().should.equal("aaaccc");
		done();
	});

	it ("delete adelante", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaaaaa");
		flexbuffer.write("bbb");
		flexbuffer.delete(0,6);
		flexbuffer.getBuffer().toString().should.equal("bbb");
		done();
	});

	it ("delete todo el buffer", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.delete(0,6);
		flexbuffer.getBufferReference().length.should.equal(0);
		done();
	});

	it ("getLength", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.getLength().should.equal(6);
		done();
	});

	it ("getLength after reset", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.getLength().should.equal(6);
		flexbuffer.reset();
		flexbuffer.getLength().should.equal(0);
		done();
	});

	it ("deleteAndGet atras", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		var buffer = flexbuffer.deleteAndGet(3,6);
		flexbuffer.getBuffer().toString().should.equal("aaa");
		buffer.toString().should.equal("bbb");
		done();
	});

	it ("deleteAndGet medio", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		flexbuffer.write("ccc");
		var buffer = flexbuffer.deleteAndGet(3,6);
		flexbuffer.getBuffer().toString().should.equal("aaaccc");
		buffer.toString().should.equal("bbb");
		done();
	});

	it ("deleteAndGet adelante", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaaaaa");
		flexbuffer.write("bbb");
		var buffer = flexbuffer.deleteAndGet(0,6);
		flexbuffer.getBuffer().toString().should.equal("bbb");
		buffer.toString().should.equal("aaaaaa");
		done();
	});

	it ("deleteAndGet todo el buffer", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		var buffer = flexbuffer.deleteAndGet(0,6);
		flexbuffer.getBufferReference().length.should.equal(0);
		buffer.toString().should.equal("aaabbb");
		done();
	});

	it ("deleteAndGet un caracter", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("aaa");
		flexbuffer.write("bbb");
		var buffer = flexbuffer.deleteAndGet(0,1);
		flexbuffer.getBuffer().toString().should.equal("aabbb");
		buffer.toString().should.equal("a");
		done();
	});

	it ("write string with \\n", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("Sab0tcj0lM+00000109&tms=1348070338843&tmsjson=2012-09-19T15:58:58.843Z&sid=bbbbbbbbbbbb&message=lelelele&consumer=0&consumidor=0\n");
		flexbuffer.getBufferReference().length.should.equal(129);
		flexbuffer.getBufferReference().toString().length.should.equal(129);
		flexbuffer.getBufferReference().toString().should.equal("Sab0tcj0lM+00000109&tms=1348070338843&tmsjson=2012-09-19T15:58:58.843Z&sid=bbbbbbbbbbbb&message=lelelele&consumer=0&consumidor=0\n");
		done();
	});

	it ("test write caracateres especiales", function (done) {
		var str = "\u00bd + \u00bc = \u00be";
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write(str);
		var buffer = new Buffer(str);
		flexbuffer.getBuffer().length.should.equal(buffer.length);
		done();
	});


	it ("write buffer con caracteres especiales", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		var buffer = new Buffer("\u00bd + \u00bc = \u00be");
		flexbuffer.write(buffer);
		flexbuffer.getBuffer().length.should.equal(buffer.length);
		done();
	});

	it ("create buffer with initial length", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer(50);
		flexbuffer.getBufferLength().should.equal(50);
		done();
	});


	it ("exception con start y end erroneos", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("123456789");
		try {
			flexbuffer.deleteAndGet(0,10);
		} catch (e) {
			done();
			return;
		}
		should.fail('expected an error!');
	});

	it ("exception con start negativo", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("123456789");
		try {
			flexbuffer.deleteAndGet(-1,10);
		} catch (e) {
			done();
			return;
		}
		should.fail('expected an error!');
	});

	it ("exception con end negativo", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("123456789");
		try {
			flexbuffer.deleteAndGet(0,-1);
		} catch (e) {
			done();
			return;
		}
		should.fail('expected an error!');
	});


	it ("exception con start y end erroneos", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("123456789");
		try {
			flexbuffer.deleteAndGet(0,10);
		} catch (e) {
			done();
			return;
		}
		should.fail('expected an error!');
	});

	it ("exception start > end", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("123456789");
		try {
			flexbuffer.deleteAndGet(9,8);
		} catch (e) {
			done();
			return;
		}
		should.fail('expected an error!');
	});

	it ("exception con start muy grande", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("123456789");
		try {
			flexbuffer.deleteAndGet(10,11);
		} catch (e) {
			done();
			return;
		}
		should.fail('expected an error!');
	});

	it ("no errores con start and end validos", function (done) {
		var flexbuffer = new fbuffers.FlexBuffer();
		flexbuffer.write("123456789");
		try {
			flexbuffer.deleteAndGet(0,9);
		} catch (e) {
			should.fail('No deberia dar error!', e);
			return;
		}
		done();
	});

});
