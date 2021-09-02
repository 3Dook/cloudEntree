const express = require('express');
const app = express();
const path = require('path')
const json2html = require('json-to-html');

//COMMENT OUT IF PRODUCTION - For environment variables
require('dotenv').config();

const {Datastore} = require('@google-cloud/datastore');
const bodyParser = require('body-parser');
const request = require('request');

const datastore = new Datastore();
// below is from HW5 to help with pagination
const ds = require('./datastore');
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
app.enable("trust proxy");
//NEED THIS EXPRESS HTTP Session to create a session to store and check our state.
// this is for making self url; it will be either https || http
//const HEADER = "http://";
const HEADER = "https://";
var session = require('express-session');
const { timeStamp } = require('console');
const { post } = require('request');
app.use(session({
  secret: 'I really dont know how this works',
  resave: false,
  saveUninitialized: true
}))

const { 
  post_Entity, 
  get_entity, 
  get_KIND, 
  get_Pag, 
  get_PagUser, 
  put_entity, 
  delete_entity, 
  get_owner
} = require('./helper.js')

const client_id = process.env.CLIENTID;
const client_secret = process.env.CLIENTSECRET; 
const redirect_uri = 'http://localhost:8080/oauth';
app.use(bodyParser.json());

function fromDatastore(item){
    item.id = item[Datastore.KEY].id;
    return item;
}

const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      //jwksUri: `https://${DOMAIN}/.well-known/jwks.json`
      jwksUri: `https://www.googleapis.com/oauth2/v3/certs`
      //jwksUri: `https://www.googleapis.com/oauth2/v3/certsh`
    }),
  
    // Validate the audience and the issuer.
    //issuer: `https://${DOMAIN}/`,
    issuer: `https://accounts.google.com`,
    algorithms: ['RS256']
  });

/* ------------- Begin Lodging Model Functions ------------- */

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/views/welcome.html'));
});

// this is a  unique check were going to see if there is a unique ID
// It will return something if there is else it will create a user
function get_uniqueUser(KIND, uniqueId){
  const q = datastore.createQuery(KIND);
  return datastore.runQuery(q).then( (entities) => {
      return entities[0].map(fromDatastore).filter( item => item.uniqueId == uniqueId);
    });
}

app.post('/middleUser', checkJwt, function(req, res){
  //console.log(req.user.sub)
  
  get_uniqueUser("Users", req.user.sub)
  .then( (payload) =>{
    // if the payload return something then there is an entity
    if(payload[0] != null){
      //console.log(payload)
      res.status(200).json({uniqueId: req.user.sub, message: "User Already Exist"})
    }
    else{
      // make an entity
      // user data goes here
      //console.log(payload)
      var data = {
        firstName: req.body.first,
        lastName: req.body.last,
        uniqueId: req.user.sub
      }

      post_Entity("Users", data)
      .then( key=>{
        res.status(200).json({key: key.id, uniqueId: req.user.sub, Message: "User Created"})
      })
      
    }
  })
});
app.get('/userInfo', (req, res) => {
  // Make a if statement here to stop it load the hello stuff
  if(req.query.first == null){
    res.redirect('/')
  }else{
    //console.log("userInfo")
    //console.log(req.query)
    var data = {
      FirstName: req.query.first,
      LastName: req.query.last,
      UniqueUserID: req.query.uniqueId,
      JWT: req.query.id_token
    }
    res.send(data)
  };
});

app.get('/checkUser', function(req, res){
    request.post({
      url: "http://localhost:8080/middleUser",
      json:{
        first: req.query.first,
        last: req.query.last
      },
      headers:{
        'Content-Type': 'Application/json',
        'Authorization': 'Bearer ' + req.query.id_token
      }
      }, function(err, response, body){
      //console.log(response)
      //console.log('Got the access code now')
      //console.log(body)

      res.redirect('/userInfo?first='+ req.query.first+'&last='+req.query.last+'&uniqueId='+body.uniqueId+'&id_token='+req.query.id_token)

    });
});

app.post('/oauth', (req, res) =>{
  //CREATE A RANDOM STATE AND STORE IT FOR USE LATER.
  randomState= Math.random().toString(36).substr(2,7) 
  req.session.state = randomState; 
  //console.log(req.session)

  let url = `https://accounts.google.com/o/oauth2/v2/auth?\
response_type=code&\
client_id=`+ client_id + `&\
redirect_uri=`+ redirect_uri + `&\
scope=profile&\
state=`+randomState;
  //console.log(url)
  return res.redirect(url)
})

app.get('/oauth', (req, res) =>{
  
  if(req.query.code != null){
    if(req.session.state != req.query.state){
      return res.status(403).json({Error: 'INVALID STATE MISMATCH'})
    }
    //get the authorization code.
    request.post({
      url: "https://www.googleapis.com/oauth2/v4/token",
      json:{
        code: req.query.code,
        client_id: client_id,
        client_secret: client_secret,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers:{
        'Content-Type': 'Application/json'
      }
      }, function(err, response, body){
      //console.log('Got the access code now')
      //console.log(body)
      res.redirect('/oauth?access_token=' + body.access_token+'&state='+req.query.state+'&id_token='+body.id_token)
    });
  }else{
    //access code stuff redirect to home.
    request.get({
      url: "https://people.googleapis.com/v1/people/me?personFields=names",
      /*json:{
        personFields: 'names'
      },*/
      headers:{
        //'Content-Type': 'Application/json',
        'Authorization': 'Bearer ' + req.query.access_token
      }
      }, function(err, response, body){
      body = JSON.parse(body)
      // here we will make an account for the user if they never use this app before.
      // If they have then it wil skip to the next function. 
      // we will use the email as a marker,
      // user: name = First, email = 
      // We will send jwt and info to another url to make sure user is in system.
      res.redirect('/checkUser?first='+body.names[0].givenName+'&last='+body.names[0].familyName+'&state='+req.query.state+'&id_token='+req.query.id_token)
    });
  }
})



/************************************************* PART 2  */

/*ROUTES ***************************************/


//below are catches for 405 status codes
app.post('/users', (req, res)=>{
  return res.status(405).json({Error: "Invalid Method for path"})
})

app.delete('/menus', (req, res)=>{
  return res.status(405).json({Error: "Invalid Method for path"})
})

app.delete('/entree', (req, res)=>{
  return res.status(405).json({Error: "Invalid Method for path"})
})
/* SUB ROUTES ***************************************/
app.use('/users', require('./user.js'))
app.use('/menus', require('./menu.js'))
app.use('/entree', require('./entree.js'))

/*STOP ROUTES ***************************************/

app.use(function (err, req, res, next) {

  if (err.name === 'UnauthorizedError') {
    res.status(401).send({'Error' : 'invalid token...'});
  } else {
    console.error(err.stack)
    res.status(500).send('Something broke!')
  }

})
// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});