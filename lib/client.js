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

var Client = function (oprator, password, bucket, domain) {
  this.oprator = oprator;
  this.password = password;
  this.bucket = bucket;
  this.domain = domain || ''; // 可选的独立域名
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
  var opts = {
    method: method,
    headers: {
      'Authorization': that.getAuthorization(method, uri, date, size || 0),
      'Date': date
    }
  };
  if (method === 'POST' || method === 'PUT') {
    opts.headers['Content-Length'] = size || 0;
  }
  if (filepath) {
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
    urllib.request(that.uri + uri, opts, callback);
  });
};

Client.prototype.getFile = function (filename, callback) {
  var uri = '/' + this.bucket + filename;
  var opts = makeOptions(this, 'GET', uri);
  urllib.request(this.uri + uri, opts, callback);
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
      type: headers['x-upyun-file-type'],
      size: Number(headers['x-upyun-file-size']),
      lastModified: date
    });
  });
};

Client.prototype.deleteFile = function (filename, callback) {
  var uri = '/' + this.bucket + filename;
  var opts = makeOptions(this, 'DELETE', uri);
  urllib.request(this.uri + uri, opts, callback);
};

Client.prototype.putFolder = function (foldername, callback) {
  var uri = '/' + this.bucket + filename;
  var url = this.uri + uri;
  var opts = makeOptions(this, 'POST', uri, foldername, 0);
  opts.headers.Folder = 'true';
  opts.headers.Mkdir = 'true';
  urllib.request(url, opts, callback);
};

Client.prototype.deleteFolder = Client.prototype.deleteFile;

Client.prototype.getFolder = function (dirpath, callback) {
  var uri = '/' + this.bucket + dirpath;
  var opts = makeOptions(this, 'GET', uri);
  urllib.request(this.uri + uri, opts, function (err, data, res) {
    if (err) {
      return callback(err);
    }
    var result = data.toString();
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
    callback(null, list);
  });
};

Client.prototype.bucketUsage = function (callback) {
  var uri = '/' + this.bucket + '/?usage';
  var opts = makeOptions(this, 'GET', uri);
  urllib.request(this.uri + uri, opts, function (err, data, res) {
    if (err) {
      return callback(err);
    }
    callback(null, Number(data));
  });
};

module.exports = Client;
