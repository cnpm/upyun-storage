var fs = require('fs');

var Client = require('../');

var client = new Client('test', 'test1234', 'jackson-test-space');
// client.putFile(__dirname + '/sticker.jpg', '/sticker2.jpg', function (err, data, res) {
//   console.log(data.toString());
//   console.log(res.headers);
// });
// client.getFolder('/', function (err, data, res) {
//   console.log(data);
// });

// client.getFile('/sticker2.jpg', function (err, data) {
//   console.log(data.toString('hex'));
// });

// client.pipe('/sticker2.jpg', fs.createWriteStream(__dirname + '/download.jpg'));

client.getFileInfo('/sticker2.jpg', function (err, data) {
  console.log(data);
});

client.bucketUsage(function (err, data) {
  console.log(arguments);
  console.log(data.toString());
});
