
const {Datastore} = require('@google-cloud/datastore');
const ds = require('./datastore');
//const e = require('express');
const datastore = ds.datastore;
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
/*************************** HELPER FUNCTIONS */
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


// This will take in a KIND and an json object.
function post_Entity(KIND, data){
    var key = datastore.key(KIND);
    const new_entity = data;
    return datastore.save({"key": key, "data": new_entity}).then(() => {return key});
}

//this function will return ALL request Entity with pagination
// Will take in the KIND, and pagination LIMIT and OFFSET
//this function will take in a KIND and ID and will return the entity requested. 
function get_entity(kind, id){
    const key = datastore.key([kind, parseInt(id, 10)]);
    return datastore.get(key)
        .then( (entity) =>{
            //console.log(entity)
            return entity
        }).catch( (error) => {
            console.log('caught ', error);
            throw error;
        });
}

function get_KIND(KIND){
	const q = datastore.createQuery(KIND);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(fromDatastore);
		});;
}

//this function will return ALL request Entity with pagination
// Will take in the KIND, and pagination LIMIT and OFFSET

function get_Pag(req, path, KIND){
    var q = datastore.createQuery(KIND).limit(5);
    const results = {};
    var prev;
    if(Object.keys(req.query).includes("cursor")){
        prev = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + req.query.cursor;
        q = q.start(req.query.cursor);
    }

    return datastore.runQuery(q).then( (entities) => {
        // you can add a filter part in here.
        results.items = entities[0].map(ds.fromDatastore);
        /*
        if(typeof prev !== 'undefined'){
            results.previous = prev;
        }
        */ //temporary removing prev function || not sure how to properly implement.
        if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
            results.next = req.protocol + "://" + req.get("host") + path + req.baseUrl + "?cursor=" + entities[1].endCursor;
        }
        return results;
    });
}

//this function will return ALL request Entity with pagination
// Will take in the KIND, and pagination LIMIT and OFFSET

function get_PagUser(req, path, KIND, sub){
  var q = datastore.createQuery(KIND)
    .limit(5)
    .filter('owner', '=', sub);

  const results = {};
  var prev;
  if(Object.keys(req.query).includes("cursor")){
      prev = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + req.query.cursor;
      q = q.start(req.query.cursor);
  }

  return datastore.runQuery(q).then( (entities) => {
    // you can add a filter part in here.
    // maybe run a smaller count here to get the total count.
    results.items = entities[0].map(ds.fromDatastore);
    /*
    if(typeof prev !== 'undefined'){
        results.previous = prev;
    }
    */ //temporary removing prev function || not sure how to properly implement.
    if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
        results.next = req.protocol + "://" + req.get("host") + path + req.baseUrl + "?cursor=" + entities[1].endCursor;
    }
    return results;

  });
}

//this function will update and repopulate data. it will take in Kind, Id, and Data
function put_entity(KIND, id, data){
  const key = datastore.key([KIND, parseInt(id,10)]);
  const new_data = data;
  return datastore.save({"key": key, "data": new_data});
}


function delete_entity(KIND, id){
    const key = datastore.key([KIND, parseInt(id, 10)])
    return datastore.delete(key)
}

function get_owner(owner, KIND){
	const q = datastore.createQuery(KIND);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(fromDatastore).filter( item => item.owner === owner );
		});
}
/*************************** HELPER FUNCTIONS END */

module.exports = { 
    checkJwt,
    post_Entity, 
    get_entity, 
    get_KIND, 
    get_Pag, 
    get_PagUser, 
    put_entity, 
    delete_entity, 
    get_owner
};