const ghostContentAPI = require('@tryghost/content-api');
const ghostAdminAPI = require('@tryghost/admin-api');
const fs = require('fs');
const http = require('http');
const postmark = require('postmark');
const sql = require('sqlite3').verbose();
const {parse, stringify} = require('flatted');

if (process.argv.length < 3) {
  console.log('Error! You should pass the path to a configuration and log directory as follows: node index.js <config.json>');
  return
}

// Configure configuration and logging
const configfile_name = process.argv[2];
const config = JSON.parse(fs.readFileSync(configfile_name));
var date = new Date().toLocaleDateString(config.locale);
var currentime = new Date().toISOString();
var logfile_name = config.logDirectory + '/' + date + 'ghostmark.log';
var stream = fs.createWriteStream(logfile_name, {flags:'a'});

if (!fs.existsSync(config.logDirectory)){
  fs.mkdirSync(config.logDirectory);
}

function log(message) {
  date = new Date().toLocaleDateString(config.locale);
  currenttime = new Date().toISOString();
  
  if (! logfile_name.includes(date)) {
    logfile_name = config.logDirectory + '/' + date + 'ghostmark.log';	
    stream = fs.createWriteStream(logfile_name, {flags:'a'});
  }
  
  console.log(message);
  stream.write(currenttime + ' ' + message + '\n');
}

// create Ghost API object
const ghostContentApi = new ghostContentAPI({
  url: config.ghostUrl,
  key: config.ghostContentAPIkey,
  version: 'v3'
});

const ghostAdminApi = new ghostAdminAPI({
  url: config.ghostUrl,
  key: config.ghostAdminAPIkey,
  version: 'v3'
});

// create SQL API object
const db = new sql.Database(config.ghostDbPath, (err) => {
  if (err) {
    log(err.message);
    process.exit(1);
  };
});

// create Postmark API object
const postmarkClient = new postmark.Client(config.postmarkAPIkey);


// helper function to send batch email
function sendEmailBatch(from, to, subject, htmlBody, textBody, stream) {
  let mailJSON = [];
  to.forEach((recipient) => {
    mailJSON.push({
      'From': from,
      'To': recipient,
      'Subject': subject,
      'HtmlBody': htmlBody,
      'TextBody': textBody,
      'MessageStream': stream
    })
  });

  postmarkClient.sendEmailBatch(
    mailJSON
  ).then((response) => {
    log('response from postmark:');
    log(response);
  });
}

// helper function to send email
function sendEmail(from, to, subject, htmlBody, textBody, stream) {
  postmarkClient.sendEmail({
    'From': from,
    'To': to,
    'Subject': subject,
    'HtmlBody': htmlBody,
    'TextBody': textBody,
    'MessageStream': stream
  }).then(response => {
    log(response);
  });
}

// helper function to send newsletter to all users
function sendNewsletter() {

  var currentMemberEmails = [];

  // fetch members
  ghostAdminApi.members
    .browse()
    .then((members) => {
      members.forEach((member) => {
        currentMemberEmails.push(member.email);
      });
      
      if (config.testEmailaddress !== '') {
        currentMemberEmails = [config.testEmailaddress];
      }

      // fetch posts, including related tags and authors
      ghostContentApi.posts
        .browse({limit: 1, include: 'tags,authors'})
        .then((posts) => {
          posts.forEach((post) => {
              
            db.serialize(() => {
              db.all(`SELECT * FROM posts`, (err, results) => {
                if (err) {
                  log(err.message);
                }

                results.forEach((result) => {
                  if (result.title === post.title) {
                    if (result.codeinjection_foot === '<span id=sent></span>') {
                      log('Published a post which was already shared!');
                    } else {
                      log('Sending: ' + post.title);
                      sendEmailBatch(config.senderEmailaddress, currentMemberEmails, post.title, post.html, 'This newsletter requires you to view html', config.postmarkMessagestream);

                      // log which posts we sent
                      db.run('UPDATE posts SET codeinjection_foot = "<span id=sent></span>" WHERE title = ?', [post.title], function (error, results, fields) {
                        if (error) {
                          log(error);
                        }
                        log(results);
                        log(stringify(fields));
                      });

                    }
                  }
                });

              });
            });
          });
        })
        .catch((err) => {
            console.error(err);
        });
    });

}

http.createServer(function (req, res) {

  log(stringify(req));

  if (!req.headers.authorization || req.headers.authorization.indexOf('Basic ') === -1) {

    log('Missing Authorization Header');
    res.writeHead(404);

  } else {

    // Basic auth verification
    const base64Credentials =  req.headers.authorization.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    if (username != config.webhookUsername || password != config.webhookPassword) {

      log('Invalid Authentication Credentials');
      res.writeHead(404);
    
    } else {
    
      res.writeHead(200);
      sendNewsletter();
      log('A post was published!'); 
    
    }
  }
}).listen(config.port);

log('Starting server on port: ' + config.port);
