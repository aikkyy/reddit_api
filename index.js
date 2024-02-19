const express = require("express");
require("dotenv").config();
const Joi = require("joi");
const { MongoClient } = require("mongodb");

const app = express();
app.use(express.json());

// MongoDB connection URL and database name
const url = process.env.DB_URL;
const dbName = "reddit-api-db";

// validation schema for subreddit data
const subredditSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
});

// validation schema for post data
const postSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.string().required(),
});

// function to connect to the MongoDB database
async function connectToDatabase() {
  const client = new MongoClient(url);
  await client.connect();
  console.log("Connected successfully to MongoDB server");
  return client.db(dbName); // return the database object to use in routes
}

// POST - endpoint to create a new subreddit
app.post("/subreddits", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const subredditsCollection = db.collection("subreddits");

    // validate request body against schema
    const { error, value } = subredditSchema.validate(req.body);
    if (error) return res.status(400).json(error.details);

    const { name, description } = value; // extract validated values

    // check if subreddit already exists
    const subredditExists = await subredditsCollection.findOne({ name });
    if (subredditExists) {
      return res.status(409).send({ message: "Subreddit already exists" });
    }

    const newSubreddit = { name, description, createdAt: new Date() };
    const result = await subredditsCollection.insertOne(newSubreddit);

    res.status(201).send({
      message: "Subreddit created successfully",
      subredditId: result.insertedId,
    });
  } catch (err) {
    res.status(500).send({ message: "Internal server error" });
  }
});

// POST - endpoint to create a post in a subreddit
app.post("/subreddits/:subredditName/posts", async (req, res) => {
  try {
    const { subredditName } = req.params; //extract subredditName from the route parameter
    const { title, content } = req.body;

    const db = await connectToDatabase();
    const subredditsCollection = db.collection("subreddits");
    const postsCollection = db.collection("posts");

    // check if the specified subreddit exists
    const subredditExists = await subredditsCollection.findOne({
      name: subredditName,
    });
    if (!subredditExists) {
      return res.status(404).send({ message: "Subreddit does not exist" });
    }

    // validate request body against post schema
    const { error } = postSchema.validate({ title, content });
    if (error) return res.status(400).json(error.details);

    // create and insert the new post
    const newPost = { title, content, subredditName, createdAt: new Date() };
    const result = await postsCollection.insertOne(newPost);

    res.status(201).send({
      message: "Post created successfully",
      postId: result.insertedId,
    });
  } catch (err) {
    res.status(500).send({ message: "Internal server error" });
  }
});

// GET - endpoint to list a subredit's posts
app.get("/subreddits/:subredditName/posts", async (req, res) => {
  try {
    const { subredditName } = req.params; //extract subredditName from the route parameter
    const db = await connectToDatabase();
    const postsCollection = db.collection("posts");

    // query the database for posts associated with the specified subreddit
    const posts = await postsCollection.find({ subredditName }).toArray();

    if (posts.length === 0) {
      // if no posts found, error message
      return res
        .status(404)
        .send({ message: "No posts found for this subreddit" });
    }

    // if posts  found, return them in the response
    res.status(200).json(posts);
  } catch (err) {
    console.error("Error retrieving subreddit posts: ", err);
    res.status(500).send({ message: "Internal server error" });
  }
});

// GET - endpoint to get the comments for a post

// PUT - endpoint to edit a post

// start the express server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
