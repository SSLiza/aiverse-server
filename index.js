const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);

const express = require("express");
const dontenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
dontenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "aiverse-super-secret-jsonwebtoken-key";

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
    const reviewCollection = db.collection("reviews");
    const bookmarkCollection = db.collection("bookmarks");
    const reportCollection = db.collection("reports");
    const usersCollection = db.collection("user");
    const premiumCollection = db.collection("premiums");

    // verifyJWT middleware
    const verifyJWT = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verifyAdmin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      const user = await usersCollection.findOne({ email });
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // verifyCreator middleware
    const verifyCreator = async (req, res, next) => {
      const email = req.decoded?.email;
      const user = await usersCollection.findOne({ email });
      if (user?.role !== "creator" && user?.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // JWT signing route
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
      res.send({ token });
    });


    app.post('/prompts', async (req, res) => {
      const prompt = req.body;

      try {
        // Check user plan in database
        const user = await usersCollection.findOne({ email: prompt.creatorEmail });
        const isPremium = user?.plan === "premium";

        if (!isPremium) {
          // Count user's current prompts
          const count = await promptCollection.countDocuments({ creatorEmail: prompt.creatorEmail });
          if (count >= 3) {
            return res.status(400).send({
              message: "Free users can only create up to 3 prompts. Please upgrade to Premium."
            });
          }
        }

        const result = await promptCollection.insertOne(prompt);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to create prompt" });
      }
    });
    app.post('/premiums', async (req, res) => {
      const data = req.body;
      const premiumInfo = {
        ...data,
        createdAt: new Date()
      }
      const result = await premiumCollection.insertOne(premiumInfo);
      const filter = { email: data.email};

      const updateDocument = {
        $set: {
          plan: 'premium',
        }
      }

      const updateResult = await usersCollection.updateOne(filter,updateDocument)
      res.send(updateResult);
    }
    );

    app.get('/prompts', async (req, res) => {
      try {
        const query = {};

        // Filter by creator if requested, otherwise public marketplace only returns approved prompts
        if (req.query.creatorId) {
          query.creatorId = req.query.creatorId;
        } else if (req.query.creatorEmail) {
          query.creatorEmail = req.query.creatorEmail;
        } else {
          query.status = "approved";
        }

        // Search: checks title, tags, and aiTool
        if (req.query.search) {
          const searchRegex = new RegExp(req.query.search, 'i');
          query.$or = [
            { title: searchRegex },
            { aiTool: searchRegex },
            { tags: searchRegex }
          ];
        }

        // Filters
        if (req.query.category) {
          query.category = req.query.category;
        }
        if (req.query.aiTool) {
          query.aiTool = req.query.aiTool;
        }
        if (req.query.difficulty) {
          query.difficulty = req.query.difficulty;
        }

        // Sorting
        let sortOption = { createdAt: -1 };
        if (req.query.sort === "mostPopular") {
          sortOption = { avgRating: -1 };
        } else if (req.query.sort === "mostCopied") {
          sortOption = { copyCount: -1 };
        } else if (req.query.sort === "latest") {
          sortOption = { createdAt: -1 };
        }

        // Determine if we need to paginate (checks for page or limit parameters)
        if (req.query.page || req.query.limit) {
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 6;
          const skip = (page - 1) * limit;

          const totalCount = await promptCollection.countDocuments(query);
          const cursor = promptCollection.find(query)
            .sort(sortOption)
            .skip(skip)
            .limit(limit);

          const prompts = await cursor.toArray();

          return res.send({
            data: prompts,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page
          });
        }

        // Fallback: return raw array without pagination
        const cursor = promptCollection.find(query).sort(sortOption);
        const results = await cursor.toArray();
        res.send(results);
      } catch (error) {
        console.error("Error in GET /prompts:", error);
        res.status(500).send({ message: "Failed to fetch prompts" });
      }
    });

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

    app.get("/customer-reviews", async (req, res) => {
      try {
        const reviews = await reviewCollection
          .find({})
          .sort({ createdAt: -1 })
          .limit(6)
          .toArray();

        res.send(reviews);
      } catch (error) {
        console.log(error);
        res.status(500).send({ error: "Failed to fetch reviews" });
      }
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

    app.patch("/prompts/copy/:id", async (req, res) => {
      const result = await promptCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $inc: {
            copyCount: 1,
          },
        }
      );

      res.send(result);
    });

    app.post("/bookmarks", async (req, res) => {
      const { userEmail, promptId } = req.body;

      const exists = await bookmarkCollection.findOne({
        userEmail,
        promptId,
      });

      if (exists) {
        return res.status(400).send({
          message: "Already bookmarked",
        });
      }

      const result = await bookmarkCollection.insertOne({
        userEmail,
        promptId,
        createdAt: new Date(),
      });

      res.send(result);
    });

    app.post("/reports", async (req, res) => {
      const report = {
        ...req.body,
        reportedAt: new Date(),
      };

      const result = await reportCollection.insertOne(
        report
      );

      res.send(result);
    });

    // Toggle Bookmark (if exists, remove. if not, add)
    app.post("/bookmarks/toggle", async (req, res) => {
      const { userEmail, promptId } = req.body;
      if (!userEmail || !promptId) {
        return res.status(400).send({ message: "Email and Prompt ID are required" });
      }

      const exists = await bookmarkCollection.findOne({ userEmail, promptId });
      if (exists) {
        await bookmarkCollection.deleteOne({ userEmail, promptId });
        return res.send({ status: "removed", message: "Bookmark removed" });
      } else {
        const result = await bookmarkCollection.insertOne({
          userEmail,
          promptId,
          createdAt: new Date(),
        });
        return res.send({ status: "added", message: "Prompt bookmarked" });
      }
    });

    // Check Bookmark Status
    app.get("/bookmarks/check", async (req, res) => {
      const { userEmail, promptId } = req.query;
      if (!userEmail || !promptId) {
        return res.status(400).send({ message: "Email and Prompt ID are required" });
      }

      const exists = await bookmarkCollection.findOne({ userEmail, promptId });
      res.send({ bookmarked: !!exists });
    });

    // Get User's Bookmarked Prompts
    app.get("/bookmarks/user/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const bookmarks = await bookmarkCollection.find({ userEmail: email }).toArray();
        const promptIds = bookmarks.map((b) => {
          try {
            return new ObjectId(b.promptId);
          } catch {
            return null;
          }
        }).filter(Boolean);

        const prompts = await promptCollection.find({ _id: { $in: promptIds } }).toArray();
        res.send(prompts);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch saved prompts" });
      }
    });

    // Get Creator Analytics & Stats (aggregates prompt copies and bookmarks via $lookup)
    app.get("/creator/stats/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const prompts = await promptCollection.find({ creatorEmail: email }).toArray();

        // 1. Total Prompts & Total Copies Aggregation
        const promptStats = await promptCollection.aggregate([
          { $match: { creatorEmail: email } },
          {
            $group: {
              _id: "$creatorEmail",
              totalPrompts: { $sum: 1 },
              totalCopies: { $sum: { $ifNull: ["$copyCount", 0] } }
            }
          }
        ]).toArray();

        // 2. Total Bookmarks Aggregation using $lookup
        const bookmarkStats = await promptCollection.aggregate([
          { $match: { creatorEmail: email } },
          {
            $addFields: {
              idStr: { $toString: "$_id" }
            }
          },
          {
            $lookup: {
              from: "bookmarks",
              localField: "idStr",
              foreignField: "promptId",
              as: "bookmarksInfo"
            }
          },
          {
            $project: {
              bookmarkCount: { $size: "$bookmarksInfo" }
            }
          },
          {
            $group: {
              _id: null,
              totalBookmarks: { $sum: "$bookmarkCount" }
            }
          }
        ]).toArray();

        res.send({
          totalPrompts: promptStats[0]?.totalPrompts || 0,
          totalCopies: promptStats[0]?.totalCopies || 0,
          totalBookmarks: bookmarkStats[0]?.totalBookmarks || 0,
          prompts
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch creator stats" });
      }
    });

    // Warn Creator
    app.post("/admin/reports/warn-creator", async (req, res) => {
      try {
        const { creatorEmail, message, promptId } = req.body;
        if (!creatorEmail) {
          return res.status(400).send({ message: "Creator email required" });
        }

        await usersCollection.updateOne(
          { email: creatorEmail },
          {
            $inc: { warningCount: 1 },
            $push: {
              warnings: {
                message: message || "General violation of platform guidelines",
                promptId,
                date: new Date()
              }
            }
          }
        );

        res.send({ success: true, message: "Warning sent successfully" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to warn creator" });
      }
    });

    // Get Admin Payments List
    app.get("/admin/payments", async (req, res) => {
      try {
        const payments = await premiumCollection.find({}).sort({ createdAt: -1 }).toArray();
        res.send(payments);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch payments data" });
      }
    });

    app.get("/admin/stats", async (req, res) => {
      try {
        const totalUsers = await usersCollection.countDocuments();

        const totalPrompts =
          await promptCollection.countDocuments();

        const totalReviews =
          await reviewCollection.countDocuments();

        const totalReports =
          await reportCollection.countDocuments();

        const copyResult = await promptCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalCopies: {
                  $sum: { $ifNull: ["$copyCount", 0] },
                },
              },
            },
          ])
          .toArray();

        const totalCopies =
          copyResult[0]?.totalCopies || 0;

        res.send({
          totalUsers,
          totalPrompts,
          totalReviews,
          totalReports,
          totalCopies,
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ message: "Failed to fetch stats" });
      }
    });

    app.get("/users", async (req, res) => {
      const users = await usersCollection.find({}).toArray();
      res.send(users);
    });

    app.patch("/users/:id/role", async (req, res) => {
      const { id } = req.params;
      const { role } = req.body;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { role },
        }
      );

      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const { id } = req.params;

      const result = await usersCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.get("/admin/prompts", async (req, res) => {
      const prompts = await promptCollection
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      res.send(prompts);
    });

    app.patch("/admin/prompts/:id/status", async (req, res) => {
      const { status, rejectionFeedback } = req.body;
      const updateData = { status };
      if (rejectionFeedback !== undefined) {
        updateData.rejectionFeedback = rejectionFeedback;
      }

      const result = await promptCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        {
          $set: updateData,
        }
      );

      res.send(result);
    });

    app.patch("/admin/prompts/:id/featured", async (req, res) => {
      const result = await promptCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        [
          {
            $set: {
              featured: {
                $not: "$featured",
              },
            },
          },
        ]
      );

      res.send(result);
    });

    app.get("/admin/reports", async (req, res) => {
  try {
    const reports = await reportCollection.find().toArray();

    const enrichedReports = await Promise.all(
      reports.map(async (report) => {
        const prompt = await promptCollection.findOne({
          _id: new ObjectId(report.promptId),
        });

        return {
          ...report,
          promptTitle: prompt?.title || "Deleted Prompt",
          creatorEmail: prompt?.creatorEmail || "Unknown",
        };
      })
    );

    res.send(enrichedReports);
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "Failed to fetch reports",
    });
  }
});

    app.delete("/admin/reports/:id", async (req, res) => {
      const result = await reportCollection.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      res.send(result);
    });


    app.delete("/admin/reports/prompt/:promptId", async (req, res) => {
      const promptResult = await promptCollection.deleteOne({
        _id: new ObjectId(req.params.promptId),
      });

      await reportCollection.deleteMany({
        promptId: req.params.promptId,
      });

      res.send(promptResult);
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