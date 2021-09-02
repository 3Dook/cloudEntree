
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
  if(req.body.theme == null || req.body.type == null || req.body.date == null){
      return res.status(400).json({Error: "The request object is missing at least one of the required attributes"})
  }

  var data = {
      "theme": req.body.theme,
      "type": req.body.type,
      "date": req.body.date,
      "owner": req.user.sub,
      "courses": [] 
  }

  post_Entity("Menu", data)
  .then( key =>{
      //console.log(key)
      var url = req.get('host')
      url = HEADER + url + '/menus/' + key.id
      var boatData = {id: key.id, self: url, theme: req.body.theme, type: req.body.type, date: req.body.date, owner: req.user.sub, courses: []}
      res.status(201).json(boatData)
  })
});


app.use(function (err, req, res, next) {
  // if the check JWT FAILS - THIS WOULD HAPPEN, it will check path if it isnt right it will move on.
  if (err.name === 'UnauthorizedError' && req.path == '/menus' &&req.method == 'POST') {
    res.status(401).send({'Error' : 'invalid token...'});
  } 
  
  next()
})

app.get('/', checkJwt, function(req, res){
  get_PagUser(req, "/menus", 'Menu', req.user.sub)
  .then( (kind) =>{
    get_owner(req.user.sub, 'Menu')
    .then( count => {
      kind["total_count"] = count.length;
      var url = req.get('host')
      url = HEADER + url + '/menus/'
      var foodUrl = req.get('host')
      foodUrl = HEADER + foodUrl + '/entree/'
      kind['items'].forEach( element => {
          element['self'] = url + element.id;

          var new_temp = [];
          element['courses'].forEach(food =>{
              var temp = {};
              temp['self'] = foodUrl + food
              temp['id'] = food;
              new_temp.push(temp)
          })
          element['courses'] = new_temp;
          //console.log(element['loads'])                
      })

      return res.status(200).send(kind);
    })
  })
});

app.use(function (err, req, res, next) {
  // if the check JWT FAILS - THIS WOULD HAPPEN, it will check path if it isnt right it will move on.
  if (err.name === 'UnauthorizedError' && req.path == '/menus' &&req.method == 'GET') {
    get_Pag(req, "/menus", 'Menu')
    .then( (kind) =>{
      get_KIND('Menu')
      .then( count => {
        kind["total_count"] = count.length;
        var url = req.get('host')
        url = HEADER + url + '/menus/'
        var foodUrl = req.get('host')
        foodUrl = HEADER + foodUrl + '/entree/'
        kind['items'].forEach( element => {
            element['self'] = url + element.id;
            var new_temp = [];
            element['courses'].forEach(food =>{
                var temp = {};
                temp['self'] = foodUrl + food
                temp['id'] = food;
                new_temp.push(temp)
            })
            element['courses'] = new_temp
            //console.log(element['loads'])                
        })
        return res.status(200).send(kind);
      })
    })
  }
})

app.get('/:id',checkJwt, function(req, res){
  //check to see if Accept flags are good.
  
  if (req.headers.accept != '*/*' && req.headers.accept != 'application/json'){
      return res.status(406).json({Error: "Not Acceptable – Server only sends application/json data"})
  }

  get_entity('Menu', req.params.id)
  .then( (results) => {
      //console.log(results)
      //the content we want is in the first portion of the array - reset it to make it easier to load
      results = results[0]
      //if we can't find entity then it doesn't exist return 400
      if(results == null){
          return res.status(404).json({Error: "No Menu with this menu_id Exists"})
      }
      else if(results.owner != req.user.sub){
        // bad owner
        return res.status(403).json({Error: "Menu is own by someone else"})
      }
      else{
          var foodUrl = req.get('host')
          foodUrl = HEADER + foodUrl + '/entree/'
          var new_temp = [];
          results['courses'].forEach(food =>{
              var temp = {};
              temp['self'] = foodUrl + food
              temp['id'] = food;
              new_temp.push(temp)
          })
          results['courses'] = new_temp

          var url = req.get('host')
          url = HEADER + url + '/menus/' + req.params.id
          var payload = {id: req.params.id, self: url, theme: results.theme, type: results.type, date: results.date, owner: results.owner, courses: results.courses}
          return res.status(200).json(payload)

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
    get_entity('Menu', req.params.id)
    .then( (results) => {
      //console.log(results)
      //the content we want is in the first portion of the array - reset it to make it easier to load
      results = results[0]
      //if we can't find entity then it doesn't exist return 400
      if(results == null){
          return res.status(404).json({Error: "No Menu with this menu_id Exists"})
      }
      else if(results.owner != req.user.sub){
        // bad owner
        return res.status(403).json({Error: "Menu is own by someone else"})
      }
      else{
          // Boat exist and then we can build new data to past to the boat
          var new_data = {}
          if(req.body.theme != null){
              new_data["theme"] = req.body.theme
          }else{
              new_data["theme"] = results.theme;
          }
          if(req.body.type != null){
              new_data["type"] = req.body.type
          }else{
              new_data["type"] = results.type;
          }

          if(req.body.date != null){
              new_data["date"] = req.body.date
          }else{
              new_data["date"] = results.date;
          }

          new_data["owner"] = results.owner;
          new_data["courses"] = results.courses;


          // new data is updated. then can be pass to put and update data
          //console.log(new_data)
          put_entity('Menu', req.params.id, new_data)
          .then( key => {
              //console.log(key)
              //return new load data
              var url = req.get('host')
              url = HEADER + url + '/menus/' + req.params.id 
              new_data["self"] = url;
              new_data["id"] = req.params.id;
              return res.status(200).json(new_data)
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
    
    if(req.body.theme == null || req.body.type == null || req.body.date == null){
        return res.status(400).json({Error: "The request object is missing at least one of the required attributes or Client is attempting to update ID"})
    }

    // Server REQ atempts to update ID - Reject with 403 ?\
    if(req.body.id != null){
        return res.status(400).json({ERROR: "The request object is missing at least one of the required attributes or Client is attempting to update ID"})
    }

    //it past all the check so we will try to find the ID and update the variables
    get_entity('Menu', req.params.id)
    .then( (results) => {
      //console.log(results)
      //the content we want is in the first portion of the array - reset it to make it easier to load
      results = results[0]
      //if we can't find entity then it doesn't exist return 400
      if(results == null){
          return res.status(404).json({Error: "No Menu with this menu_id Exists"})
      }
      else if(results.owner != req.user.sub){
        // bad owner
        return res.status(403).json({Error: "Menu is own by someone else"})
      }
      else{
          // Boat exist and then we can build new data to past to the boat
          var new_data = {"theme": req.body.theme, "type": req.body.type, "date": req.body.date, "owner": results.owner, "courses": results.courses}

          // new data is updated. then can be pass to put and update data
          //console.log(new_data)
          put_entity('Menu', req.params.id, new_data)
          .then( key => {
              //console.log(key)
              //return new load data
              var url = req.get('host')
              url = HEADER + url + '/menus/' + req.params.id 
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
function clear_sideEntree(mid, sid){
    const l_key = datastore.key(["Entree", parseInt(sid,10)])
    return datastore.get(l_key)
    .then(load => {
      load[0].featured = load[0].featured.filter(item => item !== mid)
      // carrier will only have id, so we can simply remove it  
      //promise....
      return datastore.save({"key":l_key, "data": load[0]})
    })
}

app.delete('/:menu_id', checkJwt, function(req, res){
  //delete_guest(req.params.id).then(res.status(200).end())
  //console.log(req.params.boat_id)
  //console.log(req.user.sub)

  get_entity("Menu", req.params.menu_id)
  .then( boat =>{
    if(boat[0] == null){
      //no boat exist
      return res.status(404).json({Error: "No Menu with this menu_id Exists"})
    }
    else if(boat[0].owner != req.user.sub){
      // bad owner
      return res.status(403).json({Error: "Menu is own by someone else"})
    }
    else{

      boat[0].courses.forEach( element =>{
          // delete each load
          //console.log(element)
          clear_sideEntree(req.params.menu_id, element)
          .then(results => {
              //console.log(results)
          })
      })

      //console.log(boat[0].loads)
      delete_entity("Menu", req.params.menu_id)
      .then(()=>{
          res.status(204).end()
      })

    }
  })
});
app.use(function (err, req, res, next) {
  // if the check JWT FAILS - THIS WOULD HAPPEN, it will check path if it isnt right it will move on.
  if (err.name === 'UnauthorizedError' &&req.method == 'DELETE') {
    res.status(401).send({'Error' : 'invalid token...'});
  } 
  next()
})

/* SUB EXTRA ITEMS ROUTES ***************************************/

//this function will put a entree onto a Menu
// we have already check to see if load is not assigned to a boat.
// we do not have to check if the load is already assign since well reject if there
// any assignment
function put_entreeOnMenu(bid, lid){
    const b_key = datastore.key(['Menu', parseInt(bid,10)])
    const l_key = datastore.key(['Entree', parseInt(lid,10)])
    var temp = {}
    var temp_boat;
    return datastore.get(b_key)
    .then( (boat) => {
        //make sure there is a type of in boat data
        /*
        if( typeof(boat[0].loads === 'undefined')){
            boat[0].loads = []
        }
        */
        //console.log(boat[0])
        boat[0].courses.push(lid);
        temp_boat = boat[0] // saving the content to load and put into load
        //console.log(boat[0])
        temp["boat"] = datastore.save({"key":b_key, "data": boat[0]})
        return datastore.get(l_key)
    })
    .then(load => {
        if( typeof(load[0].entree === 'undefined')){
            load[0].featured = []
        }
        // carrier will only have id and we will populate data in the get request
        //console.log(temp_boat)
        load[0].featured.push(bid)
        //promise....
        //console.log(load[0].carrier)
        return datastore.save({"key":l_key, "data": load[0]})
        //temp["load"] = datastore.save({"key":l_key, "data": load[0]})
        /*
        console.log(temp)
        return temp;
        */
    })
}


// for this route we will assign both Menu and Entree
// need to make sure both are valid entities
// need to make sure load is not already assigned. 
app.put('/:mid/entree/:eid',checkJwt, function(req, res){
    // We will need to check both entity to make sure that they are both valid
    // first, then if so we will add and update the required changes to the entity
    get_entity('Entree', req.params.eid)
    .then( load => {
        //content we want is in [0]
        load = load[0]
        //console.log("the load is - ", load)
        if(load == null){
            //invalid id
            return res.status(404).json({Error:"The specified Menu and/or Entree does not exist"})
        } else{
            get_entity("Menu", req.params.mid)
            .then( boat => {
                // if we got here, we know that load is valid and not assigned to another boat
                boat = boat[0]
                //console.log(boat)
                //console.log(load)
                if(boat == null){
                    return res.status(404).json({Error:"The specified Menu and/or Entree does not exist"})
                }
                else if(boat.owner != req.user.sub){
                  // bad owner
                  return res.status(403).json({Error: "Menu is own by someone else"})
                } 
                else{
                  //Need to double check to see if Entree is already in Menu 
                  if(boat.courses.includes(req.params.eid)){
                    return res.status(403).json({Error: "Entree is already assigned to Menu"})
                  }
                  // boat is valid as well and can be assigned the load
                  put_entreeOnMenu(req.params.mid, req.params.eid)
                  .then( results => {
                      //console.log(results[0])
                      res.status(200).end() 
                  })
                }
            })
        }
    })
    .catch( (error)=>{
        res.status(404).json({Error: "The Specified Menu and/or Entree does not exist"})
    })
});
app.use(function (err, req, res, next) {
  // if the check JWT FAILS - THIS WOULD HAPPEN, it will check path if it isnt right it will move on.
  if (err.name === 'UnauthorizedError' &&req.method == 'PUT') {
    res.status(401).send({'Error' : 'invalid token...'});
  } 
  next()
})

function delete_entreeOnMenu(bid, lid){
    const b_key = datastore.key(['Menu', parseInt(bid,10)])
    const l_key = datastore.key(['Entree', parseInt(lid,10)])
    var temp = {}
    return datastore.get(b_key)
    .then( (boat) => {
        //make sure there is a type of in boat data
        /*
        if( typeof(boat[0].loads === 'undefined')){
            boat[0].loads = []
        }
        */
        //console.log(boat[0])
        //boat[0].loads.push(lid);
        boat[0].courses = boat[0].courses.filter(item => item !== lid)
        //console.log(boat[0])
        temp["boat"] = datastore.save({"key":b_key, "data": boat[0]})
        return datastore.get(l_key)
    })
    .then(load => {
        // carrier will only have id, so we can simply remove it  
        load[0].featured = load[0].featured.filter(item => item !== bid)
        //promise....
        return datastore.save({"key":l_key, "data": load[0]})
        //temp["load"] = datastore.save({"key":l_key, "data": load[0]})
        /*
        console.log(temp)
        return temp;
        */
    })
}

app.delete('/:mid/entree/:eid',checkJwt, function(req, res){
    // We will need to check both entity to make sure that they are both valid
    // first, then if so we will add and update the required changes to the entity
    get_entity('Entree', req.params.eid)
    .then( load => {
        //content we want is in [0]
        load = load[0]
        //console.log("the load is - ", load)
        if(load == null){
            //invalid id
            return res.status(404).json({Error:"The specified Menu and/or Entree does not exist"})
        }/* else if (load.carrier.length == 0){
            //load is not assign a carrier and can't be deleted.
            return res.status(403).json({Error: "Load is  not assigned to a boat"})
        } else if (load.carrier != req.params.bid){
            //load is not assign to specifc boat carrier and can't be deleted.
            return res.status(403).json({Error: "Load is  not assigned to a boat"})
        }*/ else{
            get_entity("Menu", req.params.mid)
            .then( boat => {
                // if we got here, we know that load is valid and not assigned to another boat
                boat = boat[0]
                //console.log(boat)
                //console.log(load)
                if(boat == null){
                    return res.status(404).json({Error:"The specified Menu and/or Entree does not exist"})
                }
                else if(boat.owner != req.user.sub){
                  // bad owner
                  return res.status(403).json({Error: "Menu is own by someone else"})
                }
                else{                       
                  // check the follow now in this order.
                  // check that the entree contains Menu
                  // chekc that the menu contains Entree
                  
                  if(boat.courses.includes(req.params.eid)){
                    // Menu has the entree in the list
                    // good to delete
                    delete_entreeOnMenu(req.params.mid, req.params.eid)
                    .then( () =>{
                        return res.status(204).end()
                    })
                  }
                  else{
                    return res.status(403).json({Error: "Menu and/or Entree not assign to specific Entree and/or Menu"})
                  }
                }
            })
        }

    })
    .catch( (error)=>{
        res.status(404).json({Error: "The Specified Boat and/or load does not exist"})
    })

});
app.use(function (err, req, res, next) {
  // if the check JWT FAILS - THIS WOULD HAPPEN, it will check path if it isnt right it will move on.
  if (err.name === 'UnauthorizedError' &&req.method == 'DELETE') {
    res.status(401).send({'Error' : 'invalid token...'});
  } 
  next()
})

module.exports = app