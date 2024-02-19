const express = require("express");
require("dotenv").config();
const Joi = require("joi");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();
app.use(express.json());

// MongoDB connection URL and database name
const url = process.env.DB_URL;
const dbName = process.env.DB_NAME;

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
  return client.db(dbName); //return the database object to use in routes
}

// POST - endpoint to create a new subreddit
app.post("/subreddits", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const subredditsCollection = db.collection("subreddits");

    // validate request body against schema
    const { error, value } = subredditSchema.validate(req.body);
    if (error) return res.status(400).json(error.details);

    const { name, description } = value; //extract validated values

    // check if subreddit exists
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
app.post("/subreddits/:subredditId/posts", async (req, res) => {
  try {
    const { subredditId } = req.params; //extract subredditId from the route parameter
    const { title, content } = req.body;

    const db = await connectToDatabase();
    const subredditsCollection = db.collection("subreddits");
    const postsCollection = db.collection("posts");

    // check if subreddit exists
    const subredditExists = await subredditsCollection.findOne({
      _id: new ObjectId(subredditId),
    });
    if (!subredditExists) {
      return res.status(404).send({ message: "Subreddit does not exist" });
    }

    // validate request body against post schema
    const { error } = postSchema.validate({ title, content });
    if (error) return res.status(400).json(error.details);

    // create and insert the new post
    const newPost = {
      title,
      content,
      subredditId: new ObjectId(subredditId), // Store ObjectId reference to subreddit
      createdAt: new Date(),
    };
    const result = await postsCollection.insertOne(newPost);

    res.status(201).send({
      message: "Post created successfully",
      postId: result.insertedId,
    });
  } catch (err) {
    res.status(500).send({ message: "Internal server error" });
  }
});

// GET - endpoint to list a subreddit's posts
app.get("/subreddits/:subredditId/posts", async (req, res) => {
  try {
    const { subredditId } = req.params; //extract subredditId from the route parameter
    const db = await connectToDatabase();
    const postsCollection = db.collection("posts");

    // query database for posts associated with specified subreddit
    const posts = await postsCollection
      .find({ subredditId: new ObjectId(subredditId) })
      .toArray();

    // check if posts exist
    if (posts.length === 0) {
      return res
        .status(404)
        .send({ message: "No posts found for this subreddit" });
    }

    res.status(200).json(posts);
  } catch (err) {
    console.error("Error retrieving subreddit posts: ", err);
    res.status(500).send({ message: "Internal server error" });
  }
});

// GET - endpoint to get the comments for a post
app.get("/subreddits/:subredditId/posts/:postId/comments", async (req, res) => {
  try {
    const { postId } = req.params; //extract postId from the route parameter
    const db = await connectToDatabase();
    const commentsCollection = db.collection("comments");

    const comments = await commentsCollection
      .find({ postId: new ObjectId(postId) })
      .toArray();

    // check if comments for post exist
    if (comments.length === 0) {
      return res
        .status(404)
        .send({ message: "No comments found for this post" });
    }

    res.status(200).json(comments);
  } catch (err) {
    console.error("Error retrieving comments: ", err);
    res.status(500).send({ message: "Internal server error" });
  }
});

// PUT - endpoint to edit a post
app.put("/subreddits/:subredditId/posts/:postId", async (req, res) => {
  try {
    const { postId } = req.params; //extract postId from the route parameter
    const { title, content } = req.body;

    const db = await connectToDatabase();
    const postsCollection = db.collection("posts");

    // validate the updated data against the post schema
    const { error } = postSchema.validate({ title, content });
    if (error) return res.status(400).json(error.details);

    const updateResult = await postsCollection.updateOne(
      { _id: new ObjectId(postId) },
      { $set: { title, content } }
    );

    // check if post exists
    if (updateResult.matchedCount === 0) {
      return res.status(404).send({ message: "Post not found" });
    }

    res.status(200).send({ message: "Post updated successfully" });
  } catch (err) {
    console.error("Error updating post: ", err);
    res.status(500).send({ message: "Internal server error" });
  }
});

// start the express server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
