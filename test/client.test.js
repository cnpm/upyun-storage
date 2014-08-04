var fs = require('fs');
var expect = require('expect.js');
var urllib = require('urllib');
var muk = require('muk');
var Client = require('../');

describe('client', function () {
  var randomId = (new Date()).getTime();
  var filepath = __dirname + '/figures/sticker.jpg';
  var unexist = __dirname + '/figures/unexist.jpg';
  var download = __dirname + '/figures/download.jpg';
  var size;
  before(function (done) {
    fs.readFile(filepath, function(err, data) {
      expect(err).to.not.be.ok();
      size = data.length;
      expect(size).to.be.above(0);
      done();
    });
  });

  it('create', function () {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    expect(client).to.be.ok();
    expect(client.oprator).to.be('test');
    expect(client.password).to.be('test1234');
    expect(client.bucket).to.be('jackson-test-space');
  });

  it('setAddress', function () {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    expect(client.uri).to.be('http://v0.api.upyun.com');
    client.setAddress('v1');
    expect(client.uri).to.be('http://v1.api.upyun.com');
    client.setAddress('http://www.baidu.com');
    expect(client.uri).to.be('http://www.baidu.com');
    client.setAddress();
    expect(client.uri).to.be('http://v0.api.upyun.com');
  });

  it('putFile', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    client.putFile(filepath, '/sticker_' + randomId + '.jpg', function (err, data, res) {
      expect(err).to.not.be.ok();
      expect(res.statusCode).to.be(200);
      done();
    });
  });

  it('putFile 401', function (done) {
    var client = Client.create('test', 'error_password', 'jackson-test-space');
    client.putFile(filepath, '/sticker_' + randomId + '.jpg', function (err, data, res) {
      expect(err).to.be.ok();
      expect(err.name).to.be('UpYunError');
      expect(err.code).to.be(401);
      done();
    });
  });

  it('putFile unexist file', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    client.putFile(unexist, '/sticker_fake_' + randomId + '.jpg', function (err, data, res) {
      expect(err).to.be.ok();
      expect(err.code).to.be('ENOENT');
      done();
    });
  });

  it('putBuffer', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    fs.readFile(filepath, function (err, data) {
      expect(err).to.not.be.ok();
      client.putBuffer(data, '/sticker_buffer_' + randomId + '.jpg', function (err, data, res) {
        expect(err).to.not.be.ok();
        expect(res.statusCode).to.be(200);
        done();
      });
    });
  });

  it('getFile', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    client.getFile('/sticker_' + randomId + '.jpg', function (err, data, res) {
      expect(err).to.not.be.ok();
      expect(data).to.be.a('object');
      expect(data.length).to.be(size);
      done();
    });
  });

  describe('pipe', function () {
    var randomId = new Date().getTime() + '_pipe';
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    before(function (done) {
      var pending = function (count, done) {
        return function () {
          count--;
          if (count === 0) {
            done();
          }
        };
      };
      done = pending(2, done);

      client.putFile(filepath, '/sticker_' + randomId + '.jpg', function (err, data, res) {
        expect(err).to.not.be.ok();
        expect(res.statusCode).to.be(200);
        done();
      });

      fs.unlink(download, function (err) {
        if (err) {
          expect(err.code).to.be('ENOENT');
        }
        done();
      });
    });

    it('ok', function (done) {
      var writable = fs.createWriteStream(download);
      client.pipe('/sticker_' + randomId + '.jpg', writable, function (err) {
        expect(err).to.not.be.ok();
        fs.readFile(download, function (err, file) {
          expect(err).to.not.be.ok();
          expect(file.length).to.be(size);
          done();
        });
      });
    });
  });

  it('getFileInfo', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    client.getFileInfo('/sticker_' + randomId + '.jpg', function (err, data, res) {
      expect(err).to.not.be.ok();
      expect(res.statusCode).to.be(200);
      expect(data.type).to.be('file');
      expect(data.size).to.be(size);
      expect(data.lastModified).to.be.a(Date);
      done();
    });
  });

  it('getFileInfo unexist', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    client.getFileInfo('/sticker_unexit.jpg', function (err, data, res) {
      expect(err).to.not.be.ok();
      expect(res.statusCode).to.be(404);
      expect(data.type).to.be('file');
      expect(data.size).to.be(0);
      expect(data.lastModified).to.be.a(Date);
      done();
    });
  });

  describe('getFileInfo mock err', function () {
    before(function () {
      muk(urllib, 'request', function (url, args, callback) {
        process.nextTick(function () {
          callback(new Error('mock error'));
        });
      });
    });

    after(function () {
      muk.restore();
    });

    it('mock', function (done) {
      var client = Client.create('test', 'test1234', 'jackson-test-space');
      client.getFileInfo('/sticker_unexit.jpg', function (err, data, res) {
        expect(err).to.be.ok();
        expect(err.message).to.be('mock error');
        done();
      });
    });
  });

  it('deleteFile', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    client.deleteFile('/sticker_' + randomId + '.jpg', function (err, data, res) {
      expect(err).to.not.be.ok();
      expect(res.statusCode).to.be(200);
      client.getFileInfo('/sticker_' + randomId + '.jpg', function (err, data, res) {
        expect(err).to.not.be.ok();
        expect(res.statusCode).to.be(404);
        expect(data.type).to.be('file');
        expect(data.size).to.be(0);
        expect(data.lastModified).to.be.a(Date);
        done();
      });
    });
  });

  it('putFolder', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    client.putFolder('/folder_' + randomId, function (err, data, res) {
      expect(err).to.not.be.ok();
      expect(res.statusCode).to.be(200);
      done();
    });
  });

  it('getFolder /folder', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    client.getFolder('/folder_' + randomId, function (err, data, res) {
      expect(err).to.not.be.ok();
      expect(res.statusCode).to.be(200);
      expect(data).to.be.an(Array);
      expect(data.length).to.be(0);
      done();
    });
  });

  it('getFolder /', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    client.getFolder('/', function (err, data, res) {
      expect(err).to.not.be.ok();
      expect(res.statusCode).to.be(200);
      expect(data).to.be.an(Array);
      expect(data.length).to.be.above(0);
      for (var i = 0; i < data.length; i++) {
        var item = data[i];
        expect(item.name).to.be.a('string');
        expect(item.type === 'file' || item.type === 'folder').to.be.ok();
        if (item.type === 'file') {
          expect(item.size).to.be.above(0);
        } else {
          expect(item.size).to.be(0);
        }
        expect(item.lastModified).to.be.a(Date);
      }
      done();
    });
  });

  describe('getFolder mock err', function () {
    before(function () {
      muk(urllib, 'request', function (url, args, callback) {
        process.nextTick(function () {
          callback(new Error('mock error'));
        });
      });
    });

    after(function () {
      muk.restore();
    });

    it('mock', function (done) {
      var client = Client.create('test', 'test1234', 'jackson-test-space');
      client.getFolder('/sticker_unexit.jpg', function (err, data, res) {
        expect(err).to.be.ok();
        expect(err.message).to.be('mock error');
        done();
      });
    });
  });

  it('bucketUsage', function (done) {
    var client = Client.create('test', 'test1234', 'jackson-test-space');
    client.bucketUsage(function (err, data) {
      expect(err).to.not.be.ok();
      expect(data).to.be.a('number');
      expect(data).to.be.above(0);
      done();
    });
  });

  describe('bucketUsage mock err', function () {
    before(function () {
      muk(urllib, 'request', function (url, args, callback) {
        process.nextTick(function () {
          callback(new Error('mock error'));
        });
      });
    });

    after(function () {
      muk.restore();
    });

    it('mock', function (done) {
      var client = Client.create('test', 'test1234', 'jackson-test-space');
      client.bucketUsage(function (err, data, res) {
        expect(err).to.be.ok();
        expect(err.message).to.be('mock error');
        done();
      });
    });
  });
});
