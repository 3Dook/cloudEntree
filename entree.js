
const express = require('express');
const bodyParser = require('body-parser');
const app = express.Router();
const {Datastore} = require('@google-cloud/datastore');
const ds = require('./datastore');
//const e = require('express');
const datastore = ds.datastore;
app.use(bodyParser.json());
// this is for making self url; it will be either https || http
//const HEADER = "http://";
const HEADER = "http://";


const { 
    checkJwt,
    post_Entity, 
    get_entity, 
    get_KIND, 
    get_Pag, 
    get_PagUser, 
    put_entity, 
    delete_entity, 
    get_owner
  } = require('./helper.js')




app.post('/', checkJwt, function(req, res){

  // ANY CHECKS GOES HERE
  if(req.get('content-type') !== 'application/json'){
      res.set("Content", "application/json")
      return res.status(415).set("Allow", "Post").json({Error: "Not Acceptable – Server only accepts application/json data"})
  } else if (req.headers.accept !== '*/*' && req.headers.accept != 'application/json'){
      return res.status(406).set("Allow", "Post").json({Error: "Not Acceptable – Server only sends application/json data"})
  }
  // make the object to send the data.
  if(req.body.name == null || req.body.description == null || req.body.price == null){
      return res.status(400).json({Error: "The request object is missing at least one of the required attributes"})
  }

  var data = {
      "name": req.body.name,
      "description": req.body.description,
      "price": req.body.price,
      "owner": req.user.sub,
      "featured":[] 
  }

  post_Entity("Entree", data)
  .then( key =>{
      //console.log(key)
      var url = req.get('host')
      url = HEADER + url + '/entree/' + key.id
      var boatData = {id: key.id, self: url, name: req.body.name, description: req.body.description, price: req.body.price, owner: req.user.sub, featured: []}
      res.status(201).json(boatData)
  })
});
app.use(function (err, req, res, next) {
  // if the check JWT FAILS - THIS WOULD HAPPEN, it will check path if it isnt right it will move on.
  if (err.name === 'UnauthorizedError' && req.path == '/entree' && req.method == "POST") {
    res.status(401).send({'Error' : 'invalid token...'});
  }
  next()
})

app.get('/', checkJwt, function(req, res){
  get_PagUser(req, "/entree", 'Entree', req.user.sub)
  .then( (kind) =>{
    get_owner(req.user.sub, 'Entree')
    .then( count => {
      kind["total_count"] = count.length;
      var url = req.get('host')
      url = HEADER + url + '/entree/'
      var foodUrl = req.get('host')
      foodUrl = HEADER + foodUrl + '/menus/'
      kind['items'].forEach( element => {
          element['self'] = url + element.id;
          var new_temp = [];
          element['featured'].forEach(food =>{
              var temp = {};
              temp['self'] = foodUrl + food
              temp['id'] = food;
              new_temp.push(temp)
          })
          element['featured'] = new_temp;
          //console.log(element['loads'])                
      })

      return res.status(200).send(kind);
    })
  })
});
app.use(function (err, req, res, next) {
  // if the check JWT FAILS - THIS WOULD HAPPEN, it will check path if it isnt right it will move on.
  if (err.name === 'UnauthorizedError' && req.path == '/entree' &&req.method == 'GET') {
    get_Pag(req, "/entree", 'Entree')
    .then( (kind) =>{
      get_KIND('Entree')
      .then( count => {
        kind["total_count"] = count.length;
        var url = req.get('host')
        url = HEADER + url + '/entree/'
        var foodUrl = req.get('host')
        foodUrl = HEADER + foodUrl + '/menus/'
        kind['items'].forEach( element => {
            element['self'] = url + element.id;
            var new_temp = [];
            element['featured'].forEach(food =>{
                var temp = {};
                temp['self'] = foodUrl + food
                temp['id'] = food;
                new_temp.push(temp)
            })
            element['featured'] = new_temp
            //console.log(element['loads'])                
        })
        return res.status(200).send(kind);
      })
    })
  }

})

app.get('/:id',checkJwt, function(req, res){
  //check to see if Accept flags are good.
  
  if (req.headers.accept != '*/*' && req.headers.accept != 'application/json' && req.headers.accept != 'text/html'){
      return res.status(406).json({Error: "Not Acceptable – Server only sends application/json data"})
  }

  
  get_entity('Entree', req.params.id)
  .then( (results) => {
      //console.log(results)
      //the content we want is in the first portion of the array - reset it to make it easier to load
      results = results[0]
      //if we can't find entity then it doesn't exist return 400
      if(results == null){
          return res.status(404).json({Error: "No Entree with this entree_id Exists"})
      }
      else{
          //else it does exists, so we can simply return what we found 
          // and add a self link
          var foodUrl = req.get('host')
          foodUrl = HEADER + foodUrl + '/menus/'
          var new_temp = [];
          results['featured'].forEach(food =>{
              var temp = {};
              temp['self'] = foodUrl + food
              temp['id'] = food;
              new_temp.push(temp)
          })
          results['featured'] = new_temp

          var url = req.get('host')
          url = HEADER + url + '/entree/' + req.params.id
          results["self"] = url;
          results["id"] = req.params.id
          return res.status(200).json(results)
      }
  })
})
app.use(function (err, req, res, next) {
  // if the check JWT FAILS - THIS WOULD HAPPEN, it will check path if it isnt right it will move on.
  if (err.name === 'UnauthorizedError' &&req.method == 'GET') {
    res.status(401).send({'Error' : 'invalid token...'});
  } 
  next()
})

app.patch('/:id', checkJwt, function(req, res){
  // Server request and response must be in JSON
  if(req.get('content-type') !== 'application/json'){
      res.set("Content", "application/json")
      return res.status(415).set("Allow", "Put, Patch").send("Not Acceptable – Server only accepts application/json data")
  } else if (req.headers.accept !== '*/*' && req.headers.accept != 'application/json'){
      return res.status(406).set("Allow", "Put, Patch").send("Not Acceptable – Server only sends application/json data")
  }

  // Server REQ atempts to update ID - Reject with 403
  if(req.body.id != null){
      return res.status(400).json({Error: "The request object is missing at least one of the required attributes or Client is attempting to update ID"})
  }

  //it past all the check so we will try to find the ID and update the variables
  get_entity('Entree', req.params.id)
  .then( (results) => {
    //console.log(results)
    //the content we want is in the first portion of the array - reset it to make it easier to load
    results = results[0]
    //if we can't find entity then it doesn't exist return 400
    if(results == null){
      return res.status(404).json({Error: "No Entree with this entree_id Exists"})
    }
    else if(results.owner != req.user.sub){
      // bad owner
      return res.status(403).json({Error: "Entree is own by someone else"})
    }
    else{
        // Boat exist and then we can build new data to past to the boat
        if(req.body.name != null){
            results["name"] = req.body.name
        }

        if(req.body.description != null){
            results["description"] = req.body.description
        }

        if(req.body.price != null){
          results["price"] = req.body.price
        }

        // new data is updated. then can be pass to put and update data
        //console.log(new_data)
        put_entity('Entree', req.params.id, results)
        .then( key => {
            //console.log(key)
            //return new load data
            var url = req.get('host')
            url = HEADER + url + '/entree/' + req.params.id 
            results["self"] = url;
            results["id"] = req.params.id
            return res.status(200).json(results)
        })

      }
  })
})
app.use(function (err, req, res, next) {
  // if the check JWT FAILS - THIS WOULD HAPPEN, it will check path if it isnt right it will move on.
  if (err.name === 'UnauthorizedError' &&req.method == 'PATCH') {
    res.status(401).send({'Error' : 'invalid token...'});
  } 
  next()
})

app.put('/:id', checkJwt, function(req, res){
  // Server request and response must be in JSON
  if(req.get('content-type') !== 'application/json'){
      res.set("Content", "application/json")
      return res.status(415).set("Allow", "Put, Patch").json({Error: "Not Acceptable – Server only accepts application/json data"})
  } else if (req.headers.accept !== '*/*' && req.headers.accept != 'application/json'){
      return res.status(406).set("Allow", "Put, Patch").json({Error: "Not Acceptable – Server only sends application/json data"})
  }
  
  if(req.body.name == null || req.body.description == null || req.body.price == null){
      return res.status(400).json({Error: "The request object is missing at least one of the required attributes or Client is attempting to update ID"})
  }

  // Server REQ atempts to update ID - Reject with 403 ?\
  if(req.body.id != null){
      return res.status(400).json({ERROR: "The request object is missing at least one of the required attributes or Client is attempting to update ID"})
  }

  //it past all the check so we will try to find the ID and update the variables
  get_entity('Entree', req.params.id)
  .then( (results) => {
    //console.log(results)
    //the content we want is in the first portion of the array - reset it to make it easier to load
    results = results[0]
    //if we can't find entity then it doesn't exist return 400
    if(results == null){
        return res.status(404).json({Error: "No Entree with this entree_id Exists"})
    }
    else if(results.owner != req.user.sub){
      // bad owner
      return res.status(403).json({Error: "Entree is own by someone else"})
    }
    else{
        // Boat exist and then we can build new data to past to the boat
        var new_data = {"name": req.body.name, "description": req.body.description, "price": req.body.price, "owner": results.owner, "featured": results.featured}

        // new data is updated. then can be pass to put and update data
        //console.log(new_data)
        put_entity('Entree', req.params.id, new_data)
        .then( key => {
            //console.log(key)
            //return new load data
            var url = req.get('host')
            url = HEADER + url + '/entree/' + req.params.id 
            new_data["self"] = url;
            new_data["id"] = req.params.id;
            res.location(url)
            return res.status(303).json(new_data)
        })

    }
  })
})
app.use(function (err, req, res, next) {
  // if the check JWT FAILS - THIS WOULD HAPPEN, it will check path if it isnt right it will move on.
  if (err.name === 'UnauthorizedError' &&req.method == 'PUT') {
    res.status(401).send({'Error' : 'invalid token...'});
  } 
  next()
})
//helper function to clear side-effect content
function clear_sideMenu(mid, sid){
    const l_key = datastore.key(["Menu", parseInt(sid,10)])
    return datastore.get(l_key)
    .then(load => {
      load[0].courses = load[0].courses.filter(item => item !== mid)
      // carrier will only have id, so we can simply remove it  
      //promise....
      return datastore.save({"key":l_key, "data": load[0]})
    })
}

app.delete('/:entree_id', checkJwt, function(req, res){
  //delete_guest(req.params.id).then(res.status(200).end())
  //console.log(req.params.boat_id)
  //console.log(req.user.sub)

  get_entity("Entree", req.params.entree_id)
  .then( boat =>{
    if(boat[0] == null){
      //no boat exist
      return res.status(404).json({Error: "No Entree with this entree_id Exists"})
    }
    else if(boat[0].owner != req.user.sub){
      // bad owner
      return res.status(403).json({Error: "Entree is own by someone else"})
    }
    else{

      boat[0].featured.forEach( element =>{
          // delete each load
          //console.log(element)
          clear_sideMenu(req.params.entree_id, element)
          .then(results => {
              //console.log(results)
          })
      })
      //console.log(boat[0].loads)
      delete_entity("Entree", req.params.entree_id)
      .then(()=>{
          res.status(204).end()
      })

    }
  })
});
app.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError' && req.method =='DELETE') {
    res.status(401).send({'Error' : 'invalid token...'});
  } 
  next()
})

module.exports = app;