## YUAG Twitter Bot Documentation

By Abhi Nayar | March 2018

# About
This is a twitter bot that posts one image + metadata from YUAG collection (here)[https://artgallery.yale.edu/collections] every 12 hours. It was designed by Abhi Nayar, Yale '18, in collaboration with Ony Obiocha for Tsai CITY + Dwight Hall @ Yale. It should only post images in the public domain but if there are any issues please let the developer know at abhishek[dot]nayar[at]yale[dot]edu.

# How It Works
1. Uses Cheerio (server jQuery) to scrape https://artgallery.yale.edu/collections/ + INDEX NUMBER
1. Stores the scraped data/urls/metadata in a firebase server at refs = /INDEX NUMBER
1. Generates random index, queries firebase server for that index
1. If that index is (a) valid, (b) has filled in values (not all have full metadata), and has not been posted before, then continue
1. If conditions above are met, we first download the image associated with piece locally -> curPost.jpg (this is because the Twitter api requires any uploaded media to be local)
1. Then we upload this to Twitter via Twitter.post('media/upload'), receive media_id_string in return
1. Then we construct the post text using the metadata queried from Firebase
1. We dynamically update metadata with description, artist name, etc. filling in gaps with 'Unlisted' where appropriate
1. We then post this to twitter, delete the locally created curPost.jpg file (using fs.unlinkl) and add an entry to the firebase ref that indicated the item has been posted
1. We run a setInterval function which will repeat process once every 12 (current interval) hours
1. We can add more refs to the firebase DB through either (a) internally running a script, or by (b) incrementing offsets within app.js and visiting /addToDB
1. Lastly, we are curently running a heroku instance at yuag-bot.herokuapp.com. This is kept alive by sending a http request to the main page (which just returns json) every 5 minutes to prevent dyno sleeping. TODO: Upgrade to paid dyno or migrate to a different always-on provider.

# Questions? Concerns?
If anything doesn't make sense contact the developer at abhishek[dot]nayar[at]yale[dot]edu.

Currently all logins belong to me (Abhi), in the future plan on transferring to a Yale ITS or different tech employee.