var expect = require('chai').expect;
var sinon = require('sinon');
var os = require('os');
var winstonKibana = require('./index');

// Set NODE_ENV to 'test'.
process.env.NODE_ENV = 'test';

describe('Kibana rewriter', function() {
  var now, clock, meta;

  beforeEach(function() {
    now = (new Date('1984/12/27')).getTime();
    clock = sinon.useFakeTimers(now);
  });

  afterEach(function() {
    clock.restore();
  });

  describe('without original metadata', function() {
    beforeEach(function() {
      meta = winstonKibana()('info', 'my message');
    });

    it('should add meta.level', function() {
      expect(meta).to.have.property('level', 'info');
    });

    it('should add a kibana @timestamp property', function() {
      expect(meta['@timestamp']).to.be.ok;
      var logDate = new Date(meta['@timestamp']);
      expect(logDate.getTime()).to.equals(now);
    });

    it('should add current env', function() {
      expect(meta).to.have.property('env', 'test');
    });

    it('should add current hostname', function() {
      expect(meta).to.have.property('hostname', os.hostname());
    });
  });

  describe('with original metadata', function() {
    var originalMetadata;

    beforeEach(function() {
      originalMetadata = {foo: 'bar'};
      meta = winstonKibana()('info', 'my message', originalMetadata);
    });

    it('should keep original metadata information', function() {
      expect(meta).to.have.property('foo', 'bar');
    });

    it('should leave original metadata untouched', function() {
      expect(meta).to.not.equal(originalMetadata);
    });

    it('should add a default category', function() {
      expect(meta).to.have.property('category', 'no-category');
    });

    describe('when there is a provided category', function() {
      beforeEach(function() {
        originalMetadata.category = 'some';
        meta = winstonKibana()('info', 'my message', originalMetadata);
      });

      it('does not ovewrite provided category', function() {
        expect(meta.category).to.equals('some');
      });
    });
  });

  it('should be possible to extend with some metadata', function () {
    meta = winstonKibana({application: 'test'})('info', 'my message');
    expect(meta).to.have.property('application', 'test');
    expect(meta).to.have.property('level', 'info');
  });
});