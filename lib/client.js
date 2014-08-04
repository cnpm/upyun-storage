var crypto = require('crypto');
var urllib = require('urllib');
var fs = require('fs');

/**
 * MD5工具函数
 * @param {String} data 待求MD5值的字符串
 * @return {String} md5值
 */
var md5 = function (data) {
  var hash = crypto.createHash('md5');
  hash.update(data);
  return hash.digest('hex');
};

/**
 * 签名工具函数，详情参见<http://docs.upyun.com/api/http_api/#UPYUN签名认证>
 * @param {String} method HTTP请求方法
 * @param {String} uri 路径
 * @param {String} date GMT格式的时间字符串
 * @param {Number} contentLength 内容长度
 * @param {String} password 操作员的密码
 * @return {String} md5值
 */
var signature = function (method, uri, date, contentLength, password) {
  // md5(METHOD & URI & DATE & CONTENT_LENGTH & md5(PASSWORD))
  return md5([method, uri, date, contentLength, md5(password)].join('&'));
};

/**
 * 辅助函数，截获异常，并包装新异常对象
 * @param {Function} callback 回调函数
 */
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

/**
 * 辅助函数，截获异常，并包装新异常对象
 * @param {String} oprator 操作员
 * @param {String} password 操作员的密码
 * @param {String} bucket 又拍云空间名
 */
var Client = function (oprator, password, bucket) {
  this.oprator = oprator;
  this.password = password;
  this.bucket = bucket;
  this.uri = 'http://v0.api.upyun.com';
};

/**
 * 切换又拍云路线
 * Example:
 * ```
 * client.setAddress('v0');
 * ```
 * @param {String} version 版本。v0：自动判断，v1：电信，v2：联通网通，v3：移动铁通
 */
Client.prototype.setAddress = function (version) {
  var map = {
    v0: 'http://v0.api.upyun.com', // 自动判断
    v1: 'http://v1.api.upyun.com', // 电信
    v2: 'http://v2.api.upyun.com', // 联通网通
    v3: 'http://v3.api.upyun.com' // 移动铁通
  };
  this.uri = map[version] || version || map.v0;
};

/**
 * 生成Authorization值
 * @param {String} method HTTP请求方法
 * @param {String} uri 路径
 * @param {String} date GMT格式的时间字符串
 * @param {Number} contentLength 内容长度
 */
Client.prototype.getAuthorization = function (method, uri, date, contentLength) {
  // UpYun demouser:signature
  var sign = signature(method, uri, date, contentLength, this.password);
  return 'UpYun ' + this.oprator + ':' + sign;
};

/**
 * 生成urllib的opts对象
 * @param {Object} that client对象
 * @param {String} method HTTP请求方法
 * @param {String} uri 路径
 * @param {String} filepath 文件的位置
 * @param {Number} size 文件大小
 */
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
 * 上传文件
 * Example:
 * ```
 * client.putFile('/path/to/file', '/file.tgz', function (err, data, res) {
 *  // TODO
 * });
 * ```
 * Callback:
 *
 * - `err`, 异常对象
 * - `data`, 得到的数据。本方法中，data中不包含任何信息
 * - `res`, 响应HTTP response对象。
 *
 * @param {String} filepath 文件实际地址
 * @param {String} filename 上传后的位于空间中的位置。假定空间为/，你的文件为file.js，那么就是/file.js
 * @param {Function} callback 回调函数
 */
Client.prototype.putFile = function (filepath, filename, callback) {
  var uri = '/' + this.bucket + filename;
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

/**
 * 上传文件(通过Buffer)
 * Example:
 * ```
 * var buffer = fs.readFileSync('/path/to/file');
 * client.putFile(buffer, '/file.tgz', function (err, data, res) {
 *  // TODO
 * });
 * ```
 * Callback:
 *
 * - `err`, 异常对象
 * - `data`, 得到的数据。本方法中，data中不包含任何信息
 * - `res`, 响应HTTP response对象。
 *
 * @param {Buffer} buffer 从文件中读取到的buffer
 * @param {String} filename 上传后的位于空间中的位置。假定空间为/，你的文件为file.js，那么就是/file.js
 * @param {Function} callback 回调函数
 */
Client.prototype.putBuffer = function (buffer, filename, callback) {
  var uri = '/' + this.bucket + filename;
  var that = this;
  var opts = makeOptions(that, 'PUT', uri, '', buffer.length);
  opts.content = buffer;
  opts.headers.Mkdir = 'true';
  urllib.request(that.uri + uri, opts, handle(callback));
};

/**
 * 下载文件
 * Example:
 * ```
 * client.getFile('/file.tgz', function (err, data, res) {
 *  fs.writeFile('/path/to/file', data);
 * });
 * ```
 * Callback:
 *
 * - `err`, 异常对象
 * - `data`, 得到的数据，即文件的Buffer。
 * - `res`, 响应HTTP response对象。
 *
 * @param {String} filename 文件位于空间中的位置。
 * @param {Function} callback 回调函数
 */
Client.prototype.getFile = function (filename, callback) {
  var uri = '/' + this.bucket + filename;
  var opts = makeOptions(this, 'GET', uri);
  urllib.request(this.uri + uri, opts, handle(callback));
};

/**
 * 流式下载文件
 * Example:
 * ```
 * var writable = fs.createWriteStream('/path/to/file');
 * client.pipe('/file.tgz', writable);
 * ```
 * @param {String} filename 文件位于空间中的位置。
 * @param {Stream} writable 可写流对象。下载获得的数据会pipe到该writable对象
 */
Client.prototype.pipe = function (filename, writable, callback) {
  var uri = '/' + this.bucket + filename;
  var opts = makeOptions(this, 'GET', uri);
  opts.writeStream = writable;
  urllib.request(this.uri + uri, opts, handle(callback));
};

/**
 * 获取文件信息
 * Example:
 * ```
 * client.getFileInfo('/file.tgz', function (err, data, res) {
 *  // data => {type: file, size: 1024, lastModified: some date}
 * });
 * ```
 * Callback:
 *
 * - `err`, 异常对象
 * - `data`, 文件信息，包含type、size和lastModified
 * - `res`, 响应HTTP response对象。
 *
 * @param {String} filename 文件位于空间中的位置。
 * @param {Function} callback 回调函数
 */
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

/**
 * 删除文件
 * Example:
 * ```
 * client.deleteFile('/file.tgz', function (err, data, res) {
 *  // TODO
 * });
 * ```
 * Callback:
 *
 * - `err`, 异常对象
 * - `data`, 响应对象。本函数中data无实际意义，没有err，即表示成功
 * - `res`, 响应HTTP response对象。
 *
 * @param {String} filename 文件位于空间中的位置。
 * @param {Function} callback 回调函数
 */
Client.prototype.deleteFile = function (filename, callback) {
  var uri = '/' + this.bucket + filename;
  var opts = makeOptions(this, 'DELETE', uri);
  urllib.request(this.uri + uri, opts, handle(callback));
};

/**
 * 创建文件夹
 * Example:
 * ```
 * client.putFolder('/folder/', function (err, list, res) {
 *  // TODO
 * });
 * ```
 * Callback:
 *
 * - `err`, 异常对象
 * - `data`, 响应对象。本函数中data无实际意义，没有err，即表示成功
 * - `res`, 响应HTTP response对象。
 *
 * @param {String} foldername 文件夹位于空间中的位置。
 * @param {Function} callback 回调函数
 */
Client.prototype.putFolder = function (foldername, callback) {
  var uri = '/' + this.bucket + foldername;
  var url = this.uri + uri;
  var opts = makeOptions(this, 'POST', uri, foldername, 0);
  opts.headers.Folder = 'true';
  opts.headers.Mkdir = 'true';
  urllib.request(url, opts, handle(callback));
};

/**
 * 删除文件夹
 * Example:
 * ```
 * client.deleteFolder('/folder/', function (err, list, res) {
 *  // TODO
 * });
 * ```
 * Callback:
 *
 * - `err`, 异常对象
 * - `data`, 响应对象。本函数中data无实际意义，没有err，即表示成功
 * - `res`, 响应HTTP response对象。
 *
 * @param {String} foldername 文件夹位于空间中的位置。
 * @param {Function} callback 回调函数
 */
Client.prototype.deleteFolder = Client.prototype.deleteFile;

/**
 * 获取文件夹的信息
 * Example:
 * ```
 * client.getFolder('/folder/', function (err, list, res) {
 *  // list => [{name: 'test.js', type: 'file', size: 1024, lastModified: new Date()}]
 * });
 * ```
 * Callback:
 *
 * - `err`, 异常对象
 * - `data`, 文件夹信息，包含name、type、size和lastModified的数组
 * - `res`, 响应HTTP response对象。
 *
 * @param {String} dirpath 文件夹位于空间中的位置。
 * @param {Function} callback 回调函数
 */
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

/**
 * 获取空间的使用信息
 * Example:
 * ```
 * client.bucketUsage(function (err, used) {
 *  // used => 1024
 * });
 * ```
 * Callback:
 *
 * - `err`, 异常对象
 * - `data`, 使用信息，使用量
 * - `res`, 响应HTTP response对象
 *
 * @param {Function} callback 回调函数
 */
Client.prototype.bucketUsage = function (callback) {
  var uri = '/' + this.bucket + '/?usage';
  var opts = makeOptions(this, 'GET', uri);
  urllib.request(this.uri + uri, opts, handle(function (err, data, res) {
    if (err) {
      return callback(err);
    }
    callback(null, Number(data), res);
  }));
};

/**
 * 根据操作员、密码和空间名创建client实例
 * Example:
 * ```
 * var client = Client.create('oprator', 'password', 'bucket');
 * ```
 * @param {String} oprator 操作员
 * @param {String} password 回调函数
 * @param {String} bucket 空间名
 * @return {Object} 创建的Client实例
 */
Client.create = function (oprator, password, bucket) {
  return new Client(oprator, password, bucket);
};

/*!
 * export it.
 */
module.exports = Client;
