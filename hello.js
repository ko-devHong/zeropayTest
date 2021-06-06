// Load HTTP module
var http = require('http');

http
  .createServer(function (request, response) {
    // Set the response HTTP header with HTTP status and Content type
    response.writeHead(200, { 'Content-Type': 'text/plain' });

    // Send the response body "Hello world"
    response.end('Hello world \n');
  })
  .listen(8000);

console.log('Sever running at http://127.0.0.1:8000');
