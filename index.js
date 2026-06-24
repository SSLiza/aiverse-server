const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const express = require("express");
const dontenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
dontenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(
  cors({
    credentials: true,
    origin: [process.env.CLIENT_URL],
  }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("aiverse");
    const promptCollection = db.collection("prompts");

    app.post('/prompts', async (req, res) => {
      const prompt = req.body;
      const result = await promptCollection.insertOne(prompt);
      res.send(result);
    }
    );

    app.get('/prompts', async (req, res) => {
      const query = {};
      if (req.query.creatorId) {
        query.creatorId = req.query.creatorId;
      }
      const cursor = await promptCollection.find(query);
      const results = await cursor.toArray();
      res.send(results);
    }
    );

    app.get("/prompts/:id", async (req, res) => {
      const id = req.params.id;

      const prompt = await promptCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!prompt) {
        return res.status(404).send({ message: "Prompt not found" });
      }

      res.send(prompt);
    });

    app.put("/prompts/:id", async (req, res) => {
      const id = req.params.id;
      const { _id, ...updatedPrompt } = req.body;

      const result = await promptCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: updatedPrompt,
        }
      );

      res.send(result);
    });

    app.delete("/prompts/:id", async (req, res) => {
      const id = req.params.id;

      const result = await promptCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });


    const reviewCollection = db.collection("reviews");

    // POST — add review
    app.post("/reviews", async (req, res) => {
      const { promptId, name, email, rating, comment } = req.body;

      // prevent duplicate review from same email on same prompt
      const existing = await reviewCollection.findOne({ promptId, email });
      if (existing) {
        return res.status(400).json({ message: "You already reviewed this prompt" });
      }

      const review = {
        promptId,
        name,
        email,
        rating: Number(rating),
        comment,
        createdAt: new Date(),
      };

      const result = await reviewCollection.insertOne(review);

      // update avgRating & totalReviews on the prompt using aggregation
      const agg = await reviewCollection.aggregate([
        { $match: { promptId } },
        {
          $group: {
            _id: "$promptId",
            avgRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ]).toArray();

      if (agg.length > 0) {
        await promptCollection.updateOne(
          { _id: new ObjectId(promptId) },
          {
            $set: {
              avgRating: parseFloat(agg[0].avgRating.toFixed(1)),
              totalReviews: agg[0].totalReviews,
            },
          }
        );
      }

      res.status(201).json({ insertedId: result.insertedId });
    });

    // GET — all reviews for a prompt
    app.get("/reviews/:promptId", async (req, res) => {
      const { promptId } = req.params;
      const reviews = await reviewCollection
        .find({ promptId })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(reviews);
    });

    // GET — reviews by a specific user (for My Reviews dashboard page)
    app.get("/reviews/user/:email", async (req, res) => {
      const { email } = req.params;
      const reviews = await reviewCollection
        .find({ email })
        .sort({ createdAt: -1 })
        .toArray();
      res.json(reviews);
    });

    // DELETE — user deletes their own review
    app.delete("/reviews/:id", async (req, res) => {
      const { id } = req.params;
      const result = await reviewCollection.deleteOne({ _id: new ObjectId(id) });
      res.json(result);
    });

    app.get("/featured-prompts", async (req, res) => {
      try {
        const prompts = await promptCollection
          .find({})
          .sort({ copyCount: -1 }) // trending based on copies
          .limit(6)
          .toArray();

        res.send(prompts);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch featured prompts" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});