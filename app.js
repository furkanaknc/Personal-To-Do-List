require('dotenv').config();
const express = require(`express`);
const session = require('express-session');
const bodyParser = require(`body-parser`);
const mongoose = require('mongoose');
const bcrypt = require("bcrypt");
const _ = require("lodash");
const saltRounds = 10;

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + "/public"));
app.set(`view engine`, `ejs`);
app.set("trust proxy", 1);
app.use(session({
  secret: process.env.SECRET_KEY,
  resave: false,
  saveUninitialized: false,
}));

const url = process.env.MONGODB_URL;
mongoose.connect(url, { useNewUrlParser: true })
  .then(() => console.log("Connected to MongoDB!"))
  .catch((err) => console.error(err));

/*------------------Schemas---------------*/
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  email: { type: String, unique: true },
  password: String
});

const User = mongoose.model(`User`, UserSchema);

const ItemSchema = new Schema({
  item: String
});

const Item = mongoose.model("Item", ItemSchema);

const ListSchema = new Schema({
  userId: String,
  title: String,
  items: [ItemSchema]
});

const List = mongoose.model("List", ListSchema);

/*------------------Schemas---------------*/

app.get("/", async (req, res) => {
  if (req.session.loggedIn) {
    try {
      const foundList = await List.find();
      if (foundList.length === 0) {
        const createFirstList = new List({
          title: "To Do List",
          items: []
        });
        await createFirstList.save();
        res.redirect("/");
      } else {
        res.render("list", { title: foundList[0].title, List: foundList[0] });
      }
    } catch (err) {
      console.error(err);
      res.send(err);
    }
  } else {
    res.redirect("/login");
  }
});

app.post("/", async (req, res) => {
  try {
    const itemName = req.body.newTitle;
    const listId = req.body.listId;

    const newItem = new Item({
      item: itemName
    });
    await newItem.save();

    const foundList = await List.findById({ _id: listId });
    foundList.items.push({ item: itemName });
    await foundList.save();

    res.redirect(`/${req.session.userId}`);
  } catch (err) {
    console.error(err);
    res.send(err);
  }
});

app.post("/delete", function(req, res) {
  const checkedItemId = req.body.checkbox.trim();
  const listName = req.body.listName.trim();

  console.log("Deleting item with ID:", checkedItemId);

  List.findOneAndUpdate({ userId: req.session.userId, title: listName }, { $pull: { items: { _id: checkedItemId } } })
    .then(foundList => {
      if (foundList) {
        console.log("Successfully deleted item from list:", foundList);
        res.redirect(req.get("referer")); // Redirect back to the previous page (/:userId)
      } else {
        console.log("List not found");
        throw new Error("List not found");
      }
    })
    .catch(err => {
      console.log(err);
    });
});


app.get("/about", function(req, res){
  res.render("about");
});

app.get("/register", (req, res) => {
  if (!req.session.loggedIn) {
    res.render("register", { title: "Register", message: "Welcome!" });
  } else {
    res.redirect("/alert");
  }
});

app.post("/register", async (req, res) => {
  const userMail = req.body.userMail;
  const password = req.body.password;
  const password2 = req.body.password2;

  if (password.length < 8) {
    res.render("register", {
      title: "Register",
      message: "Password length must be greater than 7!",
    });
  } else if (password !== password2) {
    res.render("register", {
      title: "Register",
      message: "Passwords don't match!",
    });
  } else {
    try {
      const existingUser = await User.findOne({ email: userMail });
      if (existingUser) {
        res.render("register", {
          title: "Register",
          message: "Email already exists!",
        });
      } else {
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const user = new User({
          email: userMail,
          password: hashedPassword,
        });
        await user.save();
        res.render("login", {
          title: "Register",
          message: "You have successfully registered.",
        });
      }
    } catch (err) {
      console.error(err);
      res.send(err);
    }
  }
});

app.get('/login', (req, res) => {
  if (!req.session.loggedIn) {
    res.render('login', { title: 'Log-in', message: 'Welcome!' });
  } else {
    res.redirect('/alert');
  }
});

app.post('/login', (req, res) => {
  const userMail = req.body.userMail;
  const password = req.body.password;

  User.findOne({ email: userMail })
    .then((user) => {
      if (user) {
        bcrypt.compare(password, user.password, (err, result) => {
          if (result === true) {
            req.session.userMail = userMail;
            req.session.loggedIn = true;
            req.session.userId = user._id;
            res.redirect(`/${user._id}`);
          } else {
            res.render('login', { title: 'Log-in', message: 'Wrong password' });
          }
        });
      } else {
        res.render('login', { title: 'Log-in', message: 'Email is not registered' });
      }
    })
    .catch((err) => {
      res.render('login', { title: 'Log-in', message: 'Email is not registered' });
    });
});

app.get('/logout', function(req, res){
  if(req.session) {
    req.session.destroy(function(err) {
      if(err) {
        return console.log(err);
      }
    });
  }
  res.redirect('/');
});


app.get("/alert", (req, res) => {
  res.render("alert", { title: "ALERT" });
});

app.post("/alert", (req, res) => {
  req.session.loggedIn = false;
  res.redirect("/register");
});

app.get("/:userId", async (req, res) => {
  const userId = req.params.userId;
  if (req.session.loggedIn && req.session.userId === userId) {
    try {
      const foundList = await List.findOne({ userId });
      if (!foundList) {
        const newList = new List({
          userId,
          title: "To Do List",
          items: []
        });
        await newList.save();
        res.render("list", { title: newList.title, List: newList });
      } else {
        res.render("list", { title: foundList.title, List: foundList });
      }
    } catch (err) {
      console.error(err);
      res.send(err);
    }
  } else {
    res.redirect("/login");
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server started on port 3000");
});
