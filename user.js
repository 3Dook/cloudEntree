const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
//const e = require('express');
router.use(bodyParser.json());
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


/* ROUTER */
router.get('/',(req, res) => {
    get_KIND("Users")
    .then( (kind) =>{
      //console.log(kind)
      res.status(200).json(kind);
    })
});

router.delete('/:user_id', function(req, res){
    //delete_guest(req.params.id).then(res.status(200).end())
    //console.log(req.params.boat_id)
    //console.log(req.user.sub)

    get_entity("Users", req.params.user_id)
    .then( boat =>{
      if(boat[0] == null){
        //no boat exist
        return res.status(404).json({Error: "No user with this user_id Exists"})
      }
      else{
        //console.log(boat[0].loads)
        delete_entity("Users", req.params.user_id)
        .then(()=>{
            res.status(204).end()
        })

      }
    })
});

module.exports = router;