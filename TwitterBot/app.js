// Import deps.
var express = require('express'),
request = require('request').defaults({ encoding: null }),
fs = require('fs'),
cheerio = require('cheerio'),
waitUntil = require('wait-until'),
port = process.env.PORT || 8000;

// Process.env
require('dotenv').config();

// Setup firebase
var firebase = require('firebase-admin');
var serviceAccount = require('./app/firebase-config.json');
var firebaseApp = firebase.initializeApp({
  credential : firebase.credential.cert(serviceAccount),
  databaseURL : process.env.FIREBASE_DATABASE_URL
});
firebaseDB = firebaseApp.database();

// Setup app to use express
var app = express();


// Setup Twitter bot
var twit = require('twit'),
config = {
  consumer_key: process.env.TWITTER_KEY,  
  consumer_secret: process.env.TWITTER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,  
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  timeout_ms: 60*1000
},
Twitter = new twit(config);


function getRandomIndex() {
  return Math.floor(Math.random() * 3500) + 1;
}

function twitterPostCallback(retVal) {
  if (retVal) {
    console.log('Succesfully posted!');
  } else {
    postToTwitter(twitterPostCallback);
  }
}


function postToTwitter(cb) {
  // First we get a random index
  var randomIndex = getRandomIndex();
  console.log(randomIndex);
  
  // Now we want to get the data from Firebase and see if we've posted it before
  firebaseDB.ref('/' + randomIndex).once('value')
    .then(function(snap) {
      var item = snap.val();
      if (item) {
        // If item exists, check if it's been posted
        var posted = item.posted;
        if (!posted) {
          // Item has NOT been posted
          // Let's check that it has an image
          var imageUrl = item.imageUrl;
          if (!imageUrl || imageUrl == "" || imageUrl.length == 0) {
            // There is no image url
            cb(false);
          } else {
            // There IS an image URL
            // We should be good to go
            
            // Get the vars. from the item
            var artistName = item.artistName,
            date = item.date,
            description = item.description,
            pieceName = item.pieceName;
            
            // If there is no piece name we don't want to post this
            if (!pieceName || pieceName.length == 0 || pieceName == "") cb(false);
            
            // Update any that are unlisted/unknown
            if (!artistName || artistName.length == 0 || artistName == "") artistName = 'Unknown/Unlisted'
            if (!description || description.length == 0 || description == "") description = null;
            if (!date || date.length == 0 || date == "") date = "Unknown/Unlisted"
            
            // Let's post the image to twitter
            // 1st: Save the image locally
            // 2nd: Upload media to Twitter
            // 3rd: Post the media to Twitter
            // 4th: Delete locally saved image
            
            // Begin request
            request(imageUrl)
              .pipe(fs.createWriteStream('curPost.jpg')).on('close', function(err) {
                // Check if there was an error saving the image
                if (err) {
                  console.log('An error occured while trying to save the image! Check URL', err);
                  cb(false);
                }
                // If no error => continue
                else {
                  // Switch saved image to base64 stream
                  var b64content = fs.readFileSync('curPost.jpg', { encoding: 'base64' })
                  // Upload media to Twitter
                  Twitter.post('media/upload', { media_data: b64content }, 
                  function (err, data, response) {
                    // If there was an error getting the media id, log it
                    if(err) {
                      console.log('ERROR ADDING IMAGE TO TWITTER:', err);
                      cb(false);
                    }
                    // If no error uploading media, then continue
                    else {
                      // Now add the meta data
                      var mediaIdStr = data.media_id_string
                      var altText = pieceName
                      var meta_params = { 
                        media_id: mediaIdStr, 
                        alt_text: { text: altText } 
                      }
                      
                      // Post the media to Twitter
                      Twitter.post('media/metadata/create', meta_params, function (err, data, response) {
                        // If there was no error, continue
                        if (!err) {
                          // Now we can reference the media and post a tweet (media will attach to the tweet) 
                          
                          // Setup tweet paramters
                          var status = "Piece: " + pieceName;
                          // Add artist + date
                          if (artistName.indexOf(':') !== -1) status+= "\n" + artistName + "\nDate: " + date
                          else status+= "\nArtist: " + artistName + "\nDate: " + date
                          // Add description
                          if (description) status+= "\nDescription: " + description
                          // Add hashtags
                          status+= "\n\n#art #yuag #yuagbot #yale #university #museum #gallery"
                          
                          // Create param object
                          var params = { 
                            status: status, 
                            media_ids: [mediaIdStr] 
                          }
                          
                          // Post the full tweet to Twitter
                          Twitter.post('statuses/update', params, function (err, data, response) {
                            // If there was an error posting, throw and return false
                            if(err) {
                              console.log('There was an error posting the full tweet to Twitter, ', err);
                              cb(false);
                            }
                            // No error posting, continue and return true
                            else {
                              // Everything is kosher, let's log it and return true
                              console.log('ALL GOOD, WE POSTED THE SHIZ');
                              // Now we want to delete the image we saved (save disk space, why keep it) and return true
                              fs.unlink('curPost.jpg', function(err, result) {
                                // If there was an error here, we still return true, just log it
                                if (err) console.log('There was an error deleting the saved image', err);
                                else console.log('Succesfully deleted image, returning true');
                                
                                // Run callback with truthy value
                                cb(true);
                                
                                // Update posted status in Fbase
                                var time = new Date().getTime();
                                firebaseDB.ref('/' + randomIndex + '/posted').set(time, function(err) {
                                  if (err) console.log('Error setting posted value to true: ', err);
                                  else console.log('Set firebase item to posted');
                                });
                                
                              });
                            }
                          })
                        }
                        // There was an error posting to Twitter
                        else {
                          console.log('Error posting image to twitter AFTER upload', err);
                          cb(false);
                        }
                      })  
                    }
                  })
                }
              });
          }
        } else {
          // Item HAS been posted, we want to retry the function
          cb(false);
        }
      } else {
        // The item does NOT exist
        // Let's run the function again
        cb(false);
      }
    });
}

// Run the post to Twitter functions
var interval = 43200000; // 30 seconds
setInterval(function() {
  postToTwitter(twitterPostCallback)
}, interval)
postToTwitter(twitterPostCallback);

// To keep the instance running
app.get('/', function(req, res) {
  console.log('Keeping it running');
  res.json('Running!');
})
var http = require("http");
  setInterval(function() {
    http.get("http://yuag-bot.herokuapp.com");
}, 300000); // every 5 minutes (300000)

app.get('/addToDB', function(req, res) {
  function addToDB() {
    for (var i = 3900; i < 4200; i++) {
      (function(i) {
        var url = 'https://artgallery.yale.edu/collections/objects/' + i;
        console.log(url)
        
        request(url, function(err, response, html) {
          
          console.log('Started request/received resp');
          
          if (!err) {
            // Setup Cheerio to scrape
            var $ = cheerio.load(html);
            // Setup vars.
            var imageUrl, 
            artistName, 
            pieceName, 
            date, 
            description;
            
            var json = {
              imageUrl : "",
              artistName : "",
              pieceName : "",
              date : "",
              description : ""
            }
            
            // #block-system-main is the main content wrapper for the piece content
            // Extract the values and data
            $('#block-system-main').filter(function() {
              // Set data to $(this)
              var data = $(this);
              
              // Find the individual pieces of data
              // 1. Image URL
              imageUrl = data.find('.field-name-object-images img').attr('src')
              json.imageUrl = imageUrl
              // 2. Artist Name
              artistName = data.find('.field-name-object-artists .field').text()
              json.artistName = artistName
              // 3. Piece Name
              pieceName = data.find('.field-name-title h1').text();
              json.pieceName = pieceName;
              // 4. Date
              date = data.find('.field-name-field-dated .field-item').text()
              json.date = date
              // 5. Description
              description = data.find('.read-more-excerpt .field-item').text()
              json.description = description        
            })
            
            // Check if imageUrl is undefined
            if (json.imageUrl !== undefined && typeof(json.imageUrl) !== undefined) {
              firebaseDB.ref('/' + i).set(json, function(err) {
                if (err) console.log(err);
                else console.log('Added');
              });
            }
          } else {
            console.log('An error occured');
            throw(err);
          }
        })
      })(i)
    }
  } addToDB() 
})

// Make app listen + log
var server = app.listen(port, function(err) {
  if (err) {
    console.log('App listening error ', err)
  } else {
    console.log('App running at ', port)
  }
});


