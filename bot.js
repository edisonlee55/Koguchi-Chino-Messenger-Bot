/**
 * Copyright (c) 2017 MING-CHIEN LEE
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

//
// This is main file containing code implementing the Express server and functionality for the Express Koguchi Chino Messenger bot.
//
'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const request = require('request');
const path = require('path');
const crypto = require('crypto');
const appsecret_proof = crypto.createHmac('sha256', process.env.APP_SECRET).update(process.env.PAGE_ACCESS_TOKEN).digest('hex');
var messengerButton = "<html><head><title>Koguchi Chino Messenger Bot</title></head><body><h1>Koguchi Chino Messenger Bot</h1><script src=\"https://button.glitch.me/button.js\" data-style=\"glitch\"></script><div class=\"glitchButton\" style=\"position:fixed;top:20px;right:20px;\"></div></body></html>";

// The rest of the code implements the routes for our Express server.
let app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Webhook validation
app.get('/webhook', function (req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});

// Display the web page
app.get('/', function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.write(messengerButton);
  res.end();
});

// Message processing
app.post('/webhook', function (req, res) {
  console.log(req.body);
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function (entry) {
      var pageID = entry.id;
      var timeOfEvent = entry.time;

      // Iterate over each messaging event
      entry.messaging.forEach(function (event) {
        if (event.message) {
          receivedMessage(event);
        } else if (event.postback) {
          receivedPostback(event);
        } else {
          console.log("Webhook received unknown event: ", event);
        }
      });
    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know
    // you've successfully received the callback. Otherwise, the request
    // will time out and we will keep trying to resend.
    res.sendStatus(200);
  }
});


function getPixivImgLink(url, recipientId, callback) {
  console.log("Pixiv Img List Link: " + url);
  var illustIdList = [];
  request(url, function (err, res, body) {
    if (!err && res.statusCode == 200) {
      var $ = cheerio.load(body);
      $("#js-mount-point-search-result-list").each(function (index, element) {
        var data = element.attribs['data-items'];
        data = JSON.parse(data);
        for (var i = 0; i < data.length; i++) {
          illustIdList.push(data[i].illustId);
        }
      });
      callback(illustIdList);
    } else {
      console.error("getPixivImgLink " + err);
      sendErrorMessage(recipientId);
      callback("error");
    }
  });
}


// Incoming events handling
function receivedMessage(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfMessage = event.timestamp;
  var message = event.message;
  console.log("Received message for user %d and page %d at %d with message:",
    senderID, recipientID, timeOfMessage);
  console.log(JSON.stringify(message));

  var messageId = message.mid;

  var messageText = message.text;
  var messageAttachments = message.attachments;
  if (messageText) {
    // If we receive a text message, check to see if it matches a keyword
    // and send back the template example. Otherwise, just echo the text we received.
    switch (messageText) {
      case '開始使用':
        sendStartMessage(senderID);
        break;
      case 'start':
        sendStartMessage(senderID);
        break;
      case 'loli':
        sendLoliPhoto(senderID);
        break;
      case 'chino':
        sendChinoPhoto(senderID);
        break;
      case '來張智乃照片!':
        sendChinoPhoto(senderID);
        break;
      case '來張蘿莉照片!':
        sendLoliPhoto(senderID);
        break;
      default:
        sendDefaultMessage(senderID, messageText);
    }
  } else if (messageAttachments) {
    sendDefaultMessage(senderID);
  }
}

function receivedPostback(event) {
  var senderID = event.sender.id;
  var recipientID = event.recipient.id;
  var timeOfPostback = event.timestamp;

  // The 'payload' param is a developer-defined field which is set in a postback 
  // button for Structured Messages. 
  var payload = event.postback.payload;
  console.log("Received postback for user %d and page %d with payload '%s' " +
    "at %d", senderID, recipientID, payload, timeOfPostback);

  switch (payload) {
    case 'SEND_START_MESSAGE':
      sendStartMessage(senderID);
      break;
    case 'SEND_CHINO_PHOTO':
      sendChinoPhoto(senderID);
      break;
    case 'SEND_LOLI_PHOTO':
      sendLoliPhoto(senderID);
      break;
    default:
      console.error("Unexpected payload: " + payload);
  }
}

//////////////////////////
// Sending helpers
//////////////////////////
function sendStartMessage(recipientId) {
  var textMessageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "感謝您加入 Koguchi Chino Messenger Bot，請選擇您需要的功能:"
    }
  }
  var attachmentMessageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "我要看智乃!",
            subtitle: "",
            image_url: "https://cdn.edisonlee55.com/edisonlee55/resources/photo/313cc54d-25ad-4119-8b3b-1aadc0787564.png",
            buttons: [{
              type: "postback",
              title: "來張智乃照片!",
              payload: "SEND_CHINO_PHOTO",
            }],
          }, {
            title: "我要看蘿莉!",
            subtitle: "",
            image_url: "https://cdn.edisonlee55.com/edisonlee55/resources/photo/0cef8f2d-611a-403a-a768-0b1cd8ebfab1.jpg",
            buttons: [{
              type: "postback",
              title: "來張蘿莉照片!",
              payload: "SEND_LOLI_PHOTO",
            }]
          }]
        }
      },
      quick_replies: [
        {
          content_type: "text",
          title: "來張智乃照片!",
          payload: "SEND_CHINO_PHOTO",
        },
        {
          content_type: "text",
          title: "來張蘿莉照片!",
          payload: "SEND_LOLI_PHOTO",
        }
      ]
    }
  };

  callSendAPI(textMessageData);
  callSendAPI(attachmentMessageData);
}

function sendDefaultMessage(recipientId) {
  var textMessageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "抱歉，但系統並不了解您的指令，請選擇您需要的功能:"
    }
  }
  var attachmentMessageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "我要看智乃!",
            subtitle: "",
            image_url: "https://cdn.edisonlee55.com/edisonlee55/resources/photo/313cc54d-25ad-4119-8b3b-1aadc0787564.png",
            buttons: [{
              type: "postback",
              title: "來張智乃照片!",
              payload: "SEND_CHINO_PHOTO",
            }],
          }, {
            title: "我要看蘿莉!",
            subtitle: "",
            image_url: "https://cdn.edisonlee55.com/edisonlee55/resources/photo/0cef8f2d-611a-403a-a768-0b1cd8ebfab1.jpg",
            buttons: [{
              type: "postback",
              title: "來張蘿莉照片!",
              payload: "SEND_LOLI_PHOTO",
            }]
          }]
        }
      },
      quick_replies: [
        {
          content_type: "text",
          title: "來張智乃照片!",
          payload: "SEND_CHINO_PHOTO",
        },
        {
          content_type: "text",
          title: "來張蘿莉照片!",
          payload: "SEND_LOLI_PHOTO",
        }
      ]
    }
  };
  callSendAPI(textMessageData);
  callSendAPI(attachmentMessageData);
}

function sendErrorMessage(recipientId) {
  var textMessageData = {
    recipient: {
      id: recipientId
    },
    message: {
      text: "抱歉，系統發生錯誤，無法處理您的要求，請在試一次，請選擇您需要的功能:"
    }
  }
  var attachmentMessageData = {
    recipient: {
      id: recipientId
    },
    message: {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [{
            title: "我要看智乃!",
            subtitle: "",
            image_url: "https://cdn.edisonlee55.com/edisonlee55/resources/photo/313cc54d-25ad-4119-8b3b-1aadc0787564.png",
            buttons: [{
              type: "postback",
              title: "來張智乃照片!",
              payload: "SEND_CHINO_PHOTO",
            }],
          }, {
            title: "我要看蘿莉!",
            subtitle: "",
            image_url: "https://cdn.edisonlee55.com/edisonlee55/resources/photo/0cef8f2d-611a-403a-a768-0b1cd8ebfab1.jpg",
            buttons: [{
              type: "postback",
              title: "來張蘿莉照片!",
              payload: "SEND_LOLI_PHOTO",
            }]
          }]
        }
      },
      quick_replies: [
        {
          content_type: "text",
          title: "來張智乃照片!",
          payload: "SEND_CHINO_PHOTO",
        },
        {
          content_type: "text",
          title: "來張蘿莉照片!",
          payload: "SEND_LOLI_PHOTO",
        }
      ]
    }
  };
  callSendAPI(textMessageData);
  callSendAPI(attachmentMessageData);
}

function sendChinoPhoto(recipientId) {
  getPixivImgLink('https://www.pixiv.net/search.php?word=%E6%99%BA%E4%B9%83&order=date_d&p=' + Math.round(1 + Math.random() * 150), recipientId, function (illustIdList) {
    if (illustIdList !== "error") {
      console.log(illustIdList);
      var imgurl = "https://pixiv.cat/" + illustIdList[Math.round(Math.random() * illustIdList.length - 1)] + ".png";
      console.log("Chino Pixiv Img Link: " + imgurl);
      function check() {
        request(imgurl, function (err, res, body) {
          if (!err && res.statusCode == 200) {
            var messageData = {
              recipient: {
                id: recipientId
              },
              message: {
                attachment: {
                  type: "image",
                  payload: {
                    url: imgurl,
                    is_reusable: false
                  }
                },
                quick_replies: [
                  {
                    content_type: "text",
                    title: "來張智乃照片!",
                    payload: "SEND_CHINO_PHOTO",
                  },
                  {
                    content_type: "text",
                    title: "來張蘿莉照片!",
                    payload: "SEND_LOLI_PHOTO",
                  }
                ]
              }
            }
            callSendAPI(messageData);
          } else {
            imgurl = "https://pixiv.cat/" + illustIdList[Math.round(Math.random() * illustIdList.length - 1)] + ".png";
            console.log("Chino Pixiv Img Link: " + imgurl);
            check();
          }
        });
      }
      check();
    }
  });
}

function sendLoliPhoto(recipientId) {
  getPixivImgLink('https://www.pixiv.net/search.php?word=%E3%83%AD%E3%83%AA%20OR%20(%20loli%20)&order=date_d&p=' + Math.round(1 + Math.random() * 1000), recipientId, function (illustIdList) {
    if (illustIdList !== "error") {
      console.log(illustIdList);
      var imgurl = "https://pixiv.cat/" + illustIdList[Math.round(Math.random() * illustIdList.length - 1)] + ".png";
      console.log("Loli Pixiv Img Link: " + imgurl);
      function check() {
        request(imgurl, function (err, res, body) {
          if (!err && res.statusCode == 200) {
            var messageData = {
              recipient: {
                id: recipientId
              },
              message: {
                attachment: {
                  type: "image",
                  payload: {
                    url: imgurl,
                    is_reusable: false
                  }
                },
                quick_replies: [
                  {
                    content_type: "text",
                    title: "來張智乃照片!",
                    payload: "SEND_CHINO_PHOTO",
                  },
                  {
                    content_type: "text",
                    title: "來張蘿莉照片!",
                    payload: "SEND_LOLI_PHOTO",
                  }
                ]
              }
            }
            callSendAPI(messageData);
          } else {
            imgurl = "https://pixiv.cat/" + illustIdList[Math.round(Math.random() * illustIdList.length - 1)] + ".png";
            console.log("Loli Pixiv Img Link: " + imgurl);
            check();
          }
        });
      }
      check();
    }
  });
}

function setGetStartedButton() {
  var messageData = {
    get_started: {
      payload: "SEND_START_MESSAGE"
    }
  }

  callMessengerProfileAPI(messageData);
}

function setPersistentMenu() {
  var messageData = {
    persistent_menu: [{
      locale: "default",
      call_to_actions: [
        {
          title: "功能選單",
          type: "nested",
          call_to_actions: [
            {
              title: "開始使用",
              type: "postback",
              payload: "SEND_START_MESSAGE"
            },
            {
              title: "來張智乃照片!",
              type: "postback",
              payload: "SEND_CHINO_PHOTO"
            },
            {
              title: "來張蘿莉照片!",
              type: "postback",
              payload: "SEND_LOLI_PHOTO"
            }
          ]
        },
        {
          type: "web_url",
          title: "Koguchi Chino Bot v1.0.14",
          url: "https://github.com/edisonlee55/Koguchi-Chino-Messenger-Bot/",
          webview_height_ratio: "full"
        }
      ]
    }]
  }
  callMessengerProfileAPI(messageData);
}

function callSendAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.11/me/messages',
    qs: {
      access_token: process.env.PAGE_ACCESS_TOKEN,
      appsecret_proof: appsecret_proof
    },
    method: 'POST',
    json: messageData
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var recipientId = body.recipient_id;
      var messageId = body.message_id;

      console.log("Successfully sent message with id %s to recipient %s",
        messageId, recipientId);
    } else {
      console.error("Unable to send message.");
      console.error(response);
      console.error(error);
      // sendErrorMessage(recipientId);
    }
  });
}

function callMessengerProfileAPI(messageData) {
  request({
    uri: 'https://graph.facebook.com/v2.11/me/messenger_profile',
    qs: {
      access_token: process.env.PAGE_ACCESS_TOKEN,
      appsecret_proof: appsecret_proof
    },
    method: 'POST',
    json: messageData
  }, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      console.log("Successfully set messenger profile");
    } else {
      console.error("Unable to set messenger profile.");
      console.error(response);
      console.error(error);
      // sendErrorMessage(recipientId);
    }
  });
}

setGetStartedButton();
setPersistentMenu();

// Set Express to listen out for HTTP requests
var server = app.listen(process.env.PORT || 3000, function () {
  console.log("Koguchi Chino Messenger Bot v1.0.14");
  console.log("Copyright (c) 2017 MING-CHIEN LEE. All rights reserved.\n");
  console.log("Listening on port %s", server.address().port);
});