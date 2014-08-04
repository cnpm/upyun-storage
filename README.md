upyun-storage (又拍云存储Node SDK)
=================================
该SDK用于访问和调用又拍云存储空间。使用本SDK前，请自行申请[又拍云](https://www.upyun.com/index.html)的使用权限，以及得到操作员账号。

## Features
本SDK已完成如下功能：

### 文件功能

- [x]上传文件
- [x]下载文件（含流式API）
- [x]获取文件信息
- [x]删除文件
- [x]创建目录
- [x]删除目录
- [x]获取目录文件列表
- [x]获取空间使用情况

### 图片处理接口
- [ ]图片处理

## Installation

```bash
$ npm install upyun-storage
```

## Usage

```
var upyun = require('upyun-storage');
// 创建客户端
var client = upyun.create('oprator', 'password', 'bucket');
// 上传文件
client.putFile('/path/to/file.jpg', '/file.jpg', function (err, data, res) {
  if (err) {
    console.log('出现错误: ' + err.message);
    return;
  }
  console.log('上传成功');
});

// 下载文件
client.putFile('/path/to/file.jpg', '/file.jpg', function (err, data, res) {
  if (err) {
    console.log('出现错误: ' + err.message);
    return;
  }
  console.log('上传成功');
});
```
更多细节，参见[API文档](http://cnpm.github.io/upyun-storage/api.html)。更多又拍云存储细节，参见[官方文档](http://docs.upyun.com/api/http_api/)

## License
The MIT [License](https://github.com/cnpm/upyun-storage/blob/master/LICENSE). feel free to use it.


