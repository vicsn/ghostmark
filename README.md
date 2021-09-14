# Ghostmark

This is a [Ghost](https://ghost.org/) integration to send newsletters using
[Postmark](https://postmarkapp.com/)! It can be triggered by receiving a
webhook from your Ghost website, after which it will connect to both the Ghost
API and database file to get your latest post and to send it to your subscribed
users. It uses the `codeinjection_foot` field of your posts to remember if
emails were sent out already, so if you use that field this integration won't
work for you.

Usage:
```
npm i
node index.js --config <file>
```

## Tested using
```
node v16.6.0
npm v7.19.1
```

## Example installation instructions

1. Add custom integration with webhook in
   `<your ghost website domain>/ghost/#/settings/integrations/new`. 
2. Set up a Postmark account and set up a message stream for batch emails / newsletters.
3. Populate `config.json` file (see `config.example.json` for an example).
4. Ensure this app is reachable on `<your ghostmark website domain>:<port>`.
5. Add a webhook in Ghost which can trigger for example when a new post is
   published. Make it point to:
```
<webhookUsername>:<webhookPassword>@<your ghostmark domain>:<port>
```
6. Populate your Ghost's `config.production.json`:
```

"database": {
  "client": "sqlite3",
  "connection": {
    "filename": "<path/to/ghost.db>"
  }
},
"mail": {
  "from": <Dog> <from@pets.com>",
  "transport": "SMTP",
  "options": {
    "service": "Postmark",
    "host": smtp.postmarkapp.com,
    "port": 587,
    "auth": {
      "user": <user>,
      "pass": <pass>
    }

```

## License
MIT, see LICENSE
