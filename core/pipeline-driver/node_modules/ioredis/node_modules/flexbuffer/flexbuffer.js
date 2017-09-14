
function FlexBuffer(){
    this.originalArgs = arguments
   
    if (arguments[0] && typeof arguments[0] === "number") 
        this.buffer = new Buffer (arguments[0]);
    else
        this.buffer = Buffer.call(this,arguments);
    this.length = this.buffer.length
    this.tail = 0
}

FlexBuffer.prototype.rewind = function(){
    this.tail = 0
}

FlexBuffer.prototype.reset = function(){
    this.buffer = Buffer.call(this,this.originalArgs)
    this.length = this.buffer.length
    this.tail = 0
}

FlexBuffer.prototype.resizeBuffer = function(minLen){
    if(this.length == 0){
        this.length = 1
    }
    this.length = (this.length + minLen) * 2
    var oldBuffer = this.buffer
    this.buffer = new Buffer(this.length)
    oldBuffer.copy(this.buffer,0, 0, this.tail)
}

FlexBuffer.prototype.write = function(arg){
    if(!arg)
        return;
    if(!arg.length){
        arg = String(arg)
    }

    if(typeof arg === "string")
       var len = Buffer.byteLength(arg);
    else
       var len = arg.length;

    if(this.tail+len >= this.length)
        this.resizeBuffer(len)

    if(Buffer.isBuffer(arg)){
        arg.copy(this.buffer,this.tail)
    }else{
        this.buffer.write(arg,this.tail)
    }
    this.tail+=len   
}

FlexBuffer.prototype.getBufferReference = function(){
    return this.buffer.slice(0,this.tail)
}

FlexBuffer.prototype.getBuffer = function(){
    var buff = this.buffer.slice(0,this.tail)
    var b = new Buffer(buff.length)
    buff.copy(b)
    return b
}

FlexBuffer.prototype.delete = function(start, end) {
    checkParams(start, end, this.tail);
    var copy = this.buffer.slice(end, this.tail).copy(this.buffer, start)
    this.tail = this.tail - end + start
}

var checkParams = function (start, end, size) {
	if (end > size || start > size || start < 0 || end < 0 || start > end) {
		  throw new Error("Start and end not valid. start:["+start+"], end:["+end+"], size:["+size+"]");	
	}

}

FlexBuffer.prototype.deleteAndGet = function(start, end) {
    var b = new Buffer(end - start);
    this.buffer.slice(start, end).copy(b);
    this.delete(start, end);
    return b;
}

FlexBuffer.prototype.getLength = function() {
	return this.tail
}

FlexBuffer.prototype.getBufferLength = function() {
	return this.buffer.length;
}

module.exports.FlexBuffer = FlexBuffer

