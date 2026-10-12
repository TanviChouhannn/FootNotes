const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "1234";

const express = require("express");
const app = express();
const port = 3000;
const dns=require("dns");


const mongoose = require("mongoose");
const multer = require("multer");
const nodemailer = require("nodemailer");
const session = require("express-session");

dns.setServers(["8.8.8.8","8.8.4.4"])

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/uploads/");
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({ storage: storage });

const transport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: "tanvichouhan624@gmail.com",
        pass: "nvhy lcxk nxmk ajbc"
    }
});

mongoose.connect("mongodb+srv://tanvichouhan624_db_user:JbJhDsT4D5FBXHn7@cluster0.dpzpanf.mongodb.net/?appName=Cluster0")
    .then(() => console.log("Connected to MongoDB Atlas"))
    .catch(err => console.log("MongoDB Error:", err.message));

const bookSchema = new mongoose.Schema({
    title: String,
    author: String,
    price: Number,
    category: String,
    image: String
});

const Book = mongoose.model("Book", bookSchema, "books_details");

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: "bookstoresecret",
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }

    res.locals.isAdmin = req.session.isAdmin || false;

    res.locals.cartCount = req.session.cart.reduce((total, item) => {
        return total + item.quantity;
    }, 0);

    next();
});

function isAdmin(req, res, next) {
    if (req.session.isAdmin) {
        return next();
    }

    res.redirect("/admin/login");
}

function addBookToCart(req, book) {
    const bookId = book._id.toString();

    const existingBook = req.session.cart.find(
        item => item.bookId === bookId
    );

    if (existingBook) {
        existingBook.quantity += 1;
    } else {
        req.session.cart.push({
            bookId: bookId,
            title: book.title,
            author: book.author,
            price: Number(book.price) || 0,
            image: book.image || "",
            quantity: 1
        });
    }
}

app.get("/", (req, res) => {
    res.render("home.ejs");
});

app.get("/about", (req, res) => {
    res.render("about.ejs");
});

app.get("/books", async (req, res) => {
    try {
        const books = await Book.find();
        res.render("books.ejs", { books });
    } catch (err) {
        console.log("Error loading books:", err.message);
        res.status(500).send("Unable to load books. Check the terminal.");
    }
});

function getCategoryPattern(category) {
    if (category === "self-help") return /^Self Help$/i;
    if (category === "learning") return /^Learning$/i;
    if (category === "fantasy") return /Fantasy|Story|Mythology/i;
    return null;
}

app.get("/books/new", isAdmin, (req, res) => {
    res.render("newbook.ejs");
});

app.post("/books", isAdmin, upload.single("img"), async (req, res) => {
    try {
        const book = new Book({
            title: req.body.title,
            author: req.body.author,
            price: Number(req.body.price),
            category: req.body.category,
            image: req.file ? "/uploads/" + req.file.filename : ""
        });

        await book.save();
        res.redirect("/books");
    } catch (err) {
        console.log("Error adding book:", err.message);
        res.status(500).send("Unable to add book.");
    }
});

app.get("/books/edit/:id", isAdmin, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);

        if (!book) {
            return res.status(404).send("Book not found.");
        }

        res.render("editbook.ejs", { book });
    } catch (err) {
        console.log("Error opening edit page:", err.message);
        res.status(500).send("Unable to edit book.");
    }
});

app.post("/books/edit/:id", isAdmin, upload.single("img"), async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);

        if (!book) {
            return res.status(404).send("Book not found.");
        }

        book.title = req.body.title;
        book.author = req.body.author;
        book.price = Number(req.body.price);
        book.category = req.body.category;

        if (req.file) {
            book.image = "/uploads/" + req.file.filename;
        }

        await book.save();
        res.redirect("/books");
    } catch (err) {
        console.log("Error updating book:", err.message);
        res.status(500).send("Unable to update book.");
    }
});

app.post("/books/delete/:id", isAdmin, async (req, res) => {
    try {
        await Book.findByIdAndDelete(req.params.id);

        req.session.cart = req.session.cart.filter(
            item => item.bookId !== req.params.id
        );

        res.redirect("/books");
    } catch (err) {
        console.log("Error deleting book:", err.message);
        res.status(500).send("Unable to delete book.");
    }
});

app.get("/categories", async (req, res) => {
    try {
        const books = await Book.find();
        res.render("categories.ejs", { books });
    } catch (err) {
        console.log("Error loading categories:", err.message);
        res.status(500).send("Unable to load categories.");
    }
});

app.get("/categories/:category", async (req, res) => {
    try {
        const pattern = getCategoryPattern(req.params.category);

        if (!pattern) {
            return res.render("categories.ejs", { books: [] });
        }

        const books = await Book.find({ category: pattern });
        res.render("categories.ejs", { books });
    } catch (err) {
        console.log("Error loading category:", err.message);
        res.status(500).send("Unable to load category.");
    }
});

app.post("/cart/add/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);

        if (!book) {
            return res.status(404).send("Book not found.");
        }

        addBookToCart(req, book);
        res.redirect("/cart");
    } catch (err) {
        console.log("Error adding to cart:", err.message);
        res.status(500).send("Unable to add book to cart.");
    }
});

app.post("/buy/:id", async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);

        if (!book) {
            return res.status(404).send("Book not found.");
        }

        addBookToCart(req, book);
        res.redirect("/cart");
    } catch (err) {
        console.log("Error buying book:", err.message);
        res.status(500).send("Unable to buy book.");
    }
});

app.get("/cart", (req, res) => {
    const cart = req.session.cart || [];

    const total = cart.reduce((sum, item) => {
        return sum + (Number(item.price) || 0) * item.quantity;
    }, 0);

    res.render("cart.ejs", { cart, total });
});

app.post("/cart/increase/:id", (req, res) => {
    const item = req.session.cart.find(
        item => item.bookId === req.params.id
    );

    if (item) {
        item.quantity += 1;
    }

    res.redirect("/cart");
});

app.post("/cart/decrease/:id", (req, res) => {
    const item = req.session.cart.find(
        item => item.bookId === req.params.id
    );

    if (item) {
        item.quantity -= 1;

        if (item.quantity <= 0) {
            req.session.cart = req.session.cart.filter(
                cartItem => cartItem.bookId !== req.params.id
            );
        }
    }

    res.redirect("/cart");
});

app.post("/cart/remove/:id", (req, res) => {
    req.session.cart = req.session.cart.filter(
        item => item.bookId !== req.params.id
    );

    res.redirect("/cart");
});

app.get("/contact", (req, res) => {
    res.render("contact.ejs");
});

app.post("/contact", async (req, res) => {
    const { name, email, mobile, message } = req.body;

    try {
        await transport.sendMail({
            to: "tanvichouhan624@gmail.com",
            replyTo: email,
            subject: "New message from FootNotes Book Store",
            text: `Name: ${name}
Email: ${email}
Mobile: ${mobile}
Message: ${message}`
        });

        res.redirect("/contact");
    } catch (err) {
        console.log("Email error:", err.message);
        res.status(500).send("Unable to send email.");
    }
});

app.get("/admin/login", (req, res) => {
    res.render("adminlogin.ejs");
});

app.post("/admin/login", (req, res) => {
    const username = String(req.body.username || "").trim();
    const password = String(req.body.password || "");

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;

        return req.session.save(err => {
            if (err) {
                console.log("Session error:", err);
                return res.status(500).send("Unable to log in.");
            }

            res.redirect("/books");
        });
    }

    res.status(401).send("Invalid username or password.");
});

app.get("/admin/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.log("Logout error:", err);
        }

        res.redirect("/");
    });
});

app.listen(port, () => {
    console.log(`running on port ${port}`);
});