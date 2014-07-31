var crypto = require('crypto');
var urllib = require('urllib');
var fs = require('fs');

var md5 = function (data) {
  var hash = crypto.createHash('md5');
  hash.update(data);
  return hash.digest('hex');
};

var signature = function (method, uri, date, contentLength, password) {
  // md5(METHOD & URI & DATE & CONTENT_LENGTH & md5(PASSWORD))
  return md5([method, uri, date, contentLength, md5(password)].join('&'));
};

var handle = function (callback) {
  return function (err, data, res) {
    if (err) {
      return callback(err);
    }
    if (res.statusCode < 200 || res.statusCode > 204) {
      err = new Error(data.toString());
      err.name = 'UpYun' + err.name;
      err.code = res.statusCode;
      return callback(err);
    }
    callback(err, data, res);
  };
};

var Client = function (oprator, password, bucket) {
  this.oprator = oprator;
  this.password = password;
  this.bucket = bucket;
  this.uri = 'http://v0.api.upyun.com';
};

Client.prototype.setAddress = function (version) {
  var map = {
    v0: 'http://v0.api.upyun.com', // 自动判断
    v1: 'http://v1.api.upyun.com', // 电信
    v2: 'http://v2.api.upyun.com', // 联通网通
    v3: 'http://v3.api.upyun.com' // 移动铁通
  };
  this.uri = map[version] || version || map.v0;
};

Client.prototype.getAuthorization = function (method, uri, date, contentLength) {
  // UpYun demouser:signature
  var sign = signature(method, uri, date, contentLength, this.password);
  return 'UpYun ' + this.oprator + ':' + sign;
};

var makeOptions = function (that, method, uri, filepath, size) {
  var date = (new Date()).toGMTString();
  size = size || 0;
  var opts = {
    method: method,
    headers: {
      'Authorization': that.getAuthorization(method, uri, date, size),
      'Date': date
    }
  };
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    opts.headers['Content-Length'] = size;
  }
  if (filepath && size > 0) {
    opts.stream = fs.createReadStream(filepath);
  }
  return opts;
};

/**
 * @param {String} filepath 文件实际地址
 */
Client.prototype.putFile = function (filepath, filename, callback) {
  var uri = '/' + this.bucket + filename;
  var method = 'PUT';
  var that = this;
  fs.stat(filepath, function (err, stat) {
    if (err) {
      return callback(err);
    }
    var opts = makeOptions(that, 'PUT', uri, filepath, stat.size);
    opts.headers.Mkdir = 'true';
    urllib.request(that.uri + uri, opts, handle(callback));
  });
};

Client.prototype.getFile = function (filename, callback) {
  var uri = '/' + this.bucket + filename;
  var opts = makeOptions(this, 'GET', uri);
  urllib.request(this.uri + uri, opts, handle(callback));
};

// 流式
Client.prototype.pipe = function (filename, writable) {
  var uri = '/' + this.bucket + filename;
  var opts = makeOptions(this, 'GET', uri);
  opts.writeStream = writable;
  urllib.request(this.uri + uri, opts);
};

Client.prototype.getFileInfo = function (filename, callback) {
  var uri = '/' + this.bucket + filename;
  var opts = makeOptions(this, 'HEAD', uri);
  urllib.request(this.uri + uri, opts, function (err, data, res) {
    if (err) {
      return callback(err);
    }
    var headers = res.headers;
    var date = new Date();
    date.setTime(Number(headers['x-upyun-file-date']));
    callback(null, {
      type: headers['x-upyun-file-type'] || 'file',
      size: Number(headers['x-upyun-file-size']) || 0,
      lastModified: date
    }, res);
  });
};

Client.prototype.deleteFile = function (filename, callback) {
  var uri = '/' + this.bucket + filename;
  var opts = makeOptions(this, 'DELETE', uri);
  urllib.request(this.uri + uri, opts, handle(callback));
};

Client.prototype.putFolder = function (foldername, callback) {
  var uri = '/' + this.bucket + foldername;
  var url = this.uri + uri;
  var opts = makeOptions(this, 'POST', uri, foldername, 0);
  opts.headers.Folder = 'true';
  opts.headers.Mkdir = 'true';
  urllib.request(url, opts, handle(callback));
};

Client.prototype.deleteFolder = Client.prototype.deleteFile;

Client.prototype.getFolder = function (dirpath, callback) {
  var uri = '/' + this.bucket + dirpath;
  var opts = makeOptions(this, 'GET', uri);
  urllib.request(this.uri + uri, opts, handle(function (err, data, res) {
    if (err) {
      return callback(err);
    }
    var result = data.toString();
    if (!result) {
      return callback(null, [], res);
    }
    var list = result.split('\n').map(function (line) {
      var parts = line.split('\t');
      var date = new Date();
      date.setTime(Number(parts[3]));
      return {
        name: parts[0],
        type: (parts[1] === 'N' ? 'file' : 'folder'),
        size: Number(parts[2]),
        lastModified: date
      };
    });
    callback(null, list, res);
  }));
};

Client.prototype.bucketUsage = function (callback) {
  var uri = '/' + this.bucket + '/?usage';
  var opts = makeOptions(this, 'GET', uri);
  urllib.request(this.uri + uri, opts, handle(function (err, data, res) {
    if (err) {
      return callback(err);
    }
    callback(null, Number(data));
  }));
};

Client.create = function (oprator, password, bucket) {
  return new Client(oprator, password, bucket);
};

module.exports = Client;
