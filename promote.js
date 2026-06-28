const dns = require('node:dns');
dns.setServers(['1.1.1.1', '1.0.0.1']);
const { MongoClient } = require("mongodb");

const uri = "mongodb+srv://aiverse:tzYgZPbqu95SNMIr@cluster0.r9kv2xz.mongodb.net/?appName=Cluster0";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db("aiverse");
    const usersCollection = db.collection("user");
    
    const result = await usersCollection.updateOne(
      { email: "myadmin@gmail.com" },
      { $set: { role: "admin" } }
    );
    console.log("PROMOTION RESULT:", result);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

run();
