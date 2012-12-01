var http = require('http'),
  url = require('url'),
  fs = require('fs'),

  defaultFavicon;

// Create the favicons directory.
if (!fs.exists(__dirname + '/favicons/')) {
  fs.mkdir(__dirname + '/favicons/');
}

// Keep default favicon in memory.
fs.readFile(__dirname + '/default.ico', function (err, favicon) {
  if (!err) {
    defaultFavicon = favicon;
  } else {
    console.log('Warning: Could not find default favicon in ' + __dirname + '/default.ico');
  }
});

// Downloads a favicon from a given URL
function getFavicon(url, callback) {
  http.get(url, function (res) {
    var favicon,
      chunks = [],
      length = 0;
    if (res.statusCode !== 404) {
      res.on('data', function (chunk) {
        chunks.push(chunk);
        length += chunk.length;
      }).on('end', function () {
        favicon = Buffer.concat(chunks, length);
        callback(favicon);
      });
    } else {
      console.log("file not found: " + url);
      callback(); // undefined
    }
  }).on('error', function (err) {
    console.log(err.message);
  });
}

function saveFavicon(filename, favicon) {
  fs.writeFile(__dirname + '/favicons/' + filename, favicon, function (err) {
    if (err) {
      console.log('Error saving favicon: ' + filename);
      console.log(err);
    }
  });
}

function getHTML(url, callback) {
  http.get(url, function (res) {
    var html,
      chunks = [],
      length = 0;
    res.setEncoding('utf-8');
    if (res.statusCode !== 404) {
      res.on('data', function (chunk) {
        chunks.push(chunk);
      }).on('end', function () {
        html = chunks.join('');
        callback(html);
      });
    } else {
      callback(); // undefined
    }
  }).on('error', function (err) {
    console.log(err.message);
  });
}

function parseFaviconURL(html, root) {
  var link_re = /<link (.*)>/gi,
    rel_re  = /rel=["'][^"]*icon[^"']*["']/i,
    href_re = /href=["']([^"']*)["']/i,
    match, ico_match, faviconURL;

  while (match = link_re.exec(html)) {
    if (rel_re.test(match[1]) && (ico_match = href_re.exec(match[1]))) {
      faviconURL = ico_match[1];
      if (faviconURL[0] === '/') {
        faviconURL = root + faviconURL;
      }
      break;
    }
  }
  return faviconURL;
}

// Initialize HTTP server.
http.createServer(function (request, response) {

  // Parse the request URL to identify the root.
  var root = request.url.substr(1),
    host;

  if (!/http[s]*:\/\//.test(root)) {
    root = 'http://' + root;
  }
  root = url.parse(root),
  host = root.host;
  root = root.protocol + '//' + host;

  // See if we have the favicon in our cache.
  fs.stat(__dirname + '/favicons/' + host + '.ico', function (err, stats) {
    // If there's an error, we don't have it.
    if (err) {
      console.log('http.get: ' + root + '/favicon.ico');
      // Try fetching the icon from the root of the domain.
      // TODO: Consider parsing HTML first (See www.msn.com use case) like browsers.
      getFavicon(root + '/favicon.ico', function (favicon) {
        // If we got one, save it to disk and return it.
        if (favicon) {
          response.writeHead(200, {'Content-Type': 'image/x-icon'});
          response.end(favicon);
          saveFavicon(host + '.ico', favicon);
        // If not, try parsing the HTML source for a favicon.
        } else {
          console.log('parsing html');
          getHTML(root, function (html) {
            // If we have HTML, parse out the favicon link.
            if (html) {
              var faviconURL = parseFaviconURL(html, root);
              // If we have a favicon URL, try to get it.
              if (faviconURL) {
                console.log('Found favicon in HTML: ' + faviconURL);
                getFavicon(faviconURL, function (favicon) {
                  // If we do not have a favicon by now, use the default favicon.
                  if (!favicon) {
                    favicon = defaultFavicon;
                  }
                  // Save it to disk and return it.
                  response.writeHead(200, {'Content-Type': 'image/x-icon'});
                  response.end(favicon);
                  saveFavicon(host + '.ico', favicon);
                });
              // No favicon could be found; use default favicon.
              } else {
                console.log("Could not find favicon in HTML.");
                response.writeHead(200, {'Content-Type': 'image/x-icon'});
                response.end(defaultFavicon);
                saveFavicon(host + '.ico', defaultFavicon);
              }
            } else {
              console.log("HTML failed to load.");
              response.writeHead(200, {'Content-Type': 'image/x-icon'});
              response.end(defaultFavicon);
              saveFavicon(host + '.ico', defaultFavicon);
            }
          });
        }
      });
    } else {
      fs.readFile(__dirname + '/favicons/' + host + '.ico', function (err, favicon) {
        if (!err) {
          response.writeHead(200, {'Content-Type': 'image/x-icon'});
          response.end(favicon);
        } else {
          console.log('Error reading ' + host + '.ico');
          response.end();
        }
      });
    }
  });

}).listen(8080, 'localhost');

console.log('Server running at http://localhost:8080/.');
