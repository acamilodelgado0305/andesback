//importamos router desde express
const { Router } = require("express");

//almacenamos Router en router
const router = Router();


const {createUser, loginUser, cookiefing, logout} = require("../controllers/user.controller");

router.route("/sigin")
 .post(createUser)

router.route("/login")
.post(loginUser);

router.route("/user")
.get(cookiefing);

router.route("/logout")
.post(logout);


module.exports = router;