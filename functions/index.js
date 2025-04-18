const {initializeApp} = require('firebase-admin/app');
const functions = require('firebase-functions');
const {getICalForUserId} = require('./gameCalendar');
const {getBirthdayICalForUserId} = require('./birthdayCalendar');

const rawTokenLookup = functions.params.defineString('TOKEN_LOOKUP');

initializeApp();

exports.volocal = functions.https.onRequest(async (req, res) => {
  console.log(
    'Received request from origin',
    JSON.stringify(req.headers),
    JSON.stringify(req.query)
  );

  const userId = req.query.userId;

  const tokenLookup = JSON.parse(rawTokenLookup.value());
  const authToken = tokenLookup[userId] || req.query.authToken;

  try {
    const calendar = await getICalForUserId(userId, authToken);
    console.log(calendar);
    res.status(200).send(calendar.toString());
  } catch (err) {
    console.log('Error generating iCal', err);
    res.status(500).send(err);
  }
});

exports.volobirthday = functions.https.onRequest(async (req, res) => {
  console.log(
    'Received request from origin',
    JSON.stringify(req.headers),
    JSON.stringify(req.query)
  );

  const userId = req.query.userId;

  const tokenLookup = JSON.parse(rawTokenLookup.value());
  const authToken = tokenLookup[userId] || req.query.authToken;

  try {
    const calendar = await getBirthdayICalForUserId(userId, authToken);
    console.log(calendar);
    res.status(200).send(calendar.toString());
  } catch (err) {
    console.log('Error generating iCal', err);
    res.status(500).send(err);
  }
});
