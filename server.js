'use strict';

var express = require('express');
var mongo = require('mongodb');
var mongoose = require('mongoose');
var dns = require('dns');

var cors = require('cors');

var app = express();

// Basic Configuration 
var port = process.env.PORT || 3000;

/** this project needs a db !! **/ 
mongoose.connect(process.env.MONGOLAB_URI);

app.use(cors());

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
// NOTE: As of Express 4, body-parser is included w/ express
app.use(express.urlencoded({extended: false}));

var Schema = mongoose.Schema;

// Schema for mongo db document
var urlShortnerSchema = new Schema({
  originalURL : { type : String, required : true },
  shortnedURL : { type : Number, required : true }                                   
});

// Create URLShortner model
var URLShortner = mongoose.model('URLShortner', urlShortnerSchema);

app.use('/public', express.static(process.cwd() + '/public'));

app.get('/', function(req, res){
  res.sendFile(process.cwd() + '/views/index.html');
});
  
// your first API endpoint... 
app.get("/api/hello", function (req, res) {
  res.json({greeting: 'hello API'});
});

// POST endpoint to send URL to be shortened to
app.post("/api/shorturl/new", function (req, res, next) {
  
  var url = req.body.url;
     
 console.log(`The posted URL is ${req.body.url}`);
  
  // Remove the protocol if present or dns.lookup will fail
  var bareURL = url.replace(/^https?:\/\//,'');
  
  // Validate the url
  dns.lookup(bareURL, function( err, address, family) {
    console.log(`address = ${address}`);
    if (err) {
      console.log(`Invalid URL: ${err}`);
      res.json({error:"invalid URL"});
    }
    else {
      console.log("URL is valid");
      // Does the url already exist in the db?  If so, use it.
      getShortenedURLByURL(url, function(err, data) {
        if (err) {
          console.log(`Error in getShortenedURLByURL: ${err}`);
          next(err);
        }
        else {
          if (data) {
            console.log(`Entry exists: ${data}`);
            // Send back existing entry
            return res.json({orininal_url:url,short_url:data.shortnedURL});
          }
          else {
            console.log(`Entry for ${url} does not exists`);
            // Create new db entry
            insertShortenedURL(url, function(err, data) {
              if (err) {
                console.log(`Error inserting new entry: ${err}`);
                next(err);
              }
              else {
                return res.json({orininal_url:url,short_url:data.shortnedURL});
              }
            });
          }
        }
      });
    };
  });  
});

app.get("/api/shorturl/:id", function (req, res, next) {
  
  console.log(req.params);
  
  getShortenedURLByShortnedURL(Number(req.params.id), function(err, data) {
    if (err) {
      console.log(`Error: ${err}`);
      next(err);
    }
    else {
      if (data) {
        res.writeHead(301, {
          Location: data.originalURL
        });
        res.end();
      }
      else {
        var msg = `Shortned URL ${req.params.id} was not found`;
        console.log(msg);
        return res.json({error: msg});
      }
    }
  });
});

// Gets the max shortnedURL value in the db
function getMaxShortnedURLNumber(done) {
  URLShortner.findOne()
  .sort('-shortnedURL')
  .select({shortnedURL: 1})
  .exec( function(err, data) {
    if (err) return done(err);
    console.log(`getMaxShortnedURLNumber data = ${data}`);
    return done(null, data);
  });
};

// Gets a ShortenedURL based on the originalURL
function getShortenedURLByURL(originalURL, done) {
  URLShortner.findOne({originalURL: originalURL}, function(err, data) {
    if (err) return done(err);
      return done(null, data);
  });  
};

// Gets a shortnedURL entry based on the shortnedURL value
function getShortenedURLByShortnedURL(shortnedURL, done) {
  URLShortner.findOne({shortnedURL: shortnedURL}, function(err, data) {
    if (err) return done(err);
      return done(null, data);
  });  
};

// Insert new ShortenedURL
function insertShortenedURL(url, done) {
  // Get the max ShortnedURL value from DB
  getMaxShortnedURLNumber(function (err, data) {
    if (err) return done(err);
    
    // Create new URLShortner to insert into db
    // Data from getMaxShortnedURLNumber could be null if
    // there are no documents in the database
    var urlShortner = new URLShortner({
      originalURL: url,
      shortnedURL: data == null ? 1 : data.shortnedURL + 1
    });    
    
    // Save to database
    urlShortner.save(function (err, data) {
      if (err) return done(err);
      return done(null, data);
    });
  });
};


app.listen(port, function () {
  console.log('Node.js listening ...');
});