const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();


const app = express();
const Port = 5000;

// Middleware
app.use(express.json());
const allowedOrigins = [
  'https://www.futurefundbd.top',
  'https://futurefundbd.top',
  'https://admin.futurefundbd.top',
  'https://future-liart.vercel.app'
];

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    console.log('CORS Origin:', origin); // for debugging
    if (!origin) return callback(null, true); // allow non-browser requests
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Use CORS middleware
app.use(cors(corsOptions));

// Handle preflight OPTIONS requests
app.options('*', cors(corsOptions));

// MongoDB URI
const uri = "mongodb+srv://invest:eQdEBBniDCWRQarY@cluster0.t87ip2a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Collections
async function connectDB() {
  try {
    await client.connect();
    const db = client.db("invest");

    usersCollection          = db.collection("users");
    plansCollection          = db.collection("plans");
    depositsCollection       = db.collection('deposits');
    depositsProofCollection  = db.collection('deposit-proof');
    bannerCollection         = db.collection('banners');
    vouchersCollection       = db.collection("vouchers");
    newsCollection           = db.collection('news');
    aboutCollection          = db.collection('aboutus');
    adminCollection          = db.collection('admin');
    withdrawalsCollection    = db.collection('withdrawals'); 
    noticeCollection         = db.collection('notices')

    console.log("✅ Connected to MongoDB and ready.");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}


// Utility: Generate readable invite code
function generateReadableInviteCode(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

app.get("/", (req, res) => {
    res.send({ message: "Welcome to our server" });
});

app.post("/signup", async (req, res) => {
    try {
        const { phone, password, inviteCode: referrerCode } = req.body;
        if (!phone || !password) {
            return res.status(400).json({ message: "Phone and password are required" });
        }

        const existingUser = await usersCollection.findOne({ phone });
        if (existingUser) {
            return res.status(409).json({ message: "User already exists" });
        }

        // Generate unique code
        let inviteCode;
        let isUnique = false;

        while (!isUnique) {
            inviteCode = generateReadableInviteCode();
            const exists = await usersCollection.findOne({ inviteCode });
            if (!exists) isUnique = true;
        }

        const user = {
            phone,
            password,
            inviteCode,
            referredBy: referrerCode || null,
            balance: 10,
            createdAt: new Date()
        };

        const result = await usersCollection.insertOne(user);

        res.status(201).json({
            message: "Signup successful with welcome bonus",
            userId: result.insertedId,
            balance: user.balance,
            inviteCode
        });
    } catch (error) {
        console.error("❌ Signup error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: "Phone and password are required" });
    }

    const user = await usersCollection.findOne({ phone, isDeleted: { $ne: true } });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials or user deleted" });
    }

    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const { password: pwd, ...userWithoutPassword } = user;
    res.json({ message: "Login successful", user: userWithoutPassword });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get('/user', async (req, res) => {
    try {
        const phone = req.query.phone;
        if (!phone) {
            return res.status(400).json({ message: 'Phone query parameter is required' });
        }

        const user = await usersCollection.findOne({ phone });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.get('/users', async (req, res) => {
  try {
    const users = await usersCollection.find({ isDeleted: { $ne: true } }).toArray();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/users/deleted', async (req, res) => {
  try {
    const deletedUsers = await usersCollection.find({ isDeleted: true }).toArray();
    res.json(deletedUsers);
  } catch (error) {
    console.error('Error fetching deleted users:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { isDeleted: true } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'User already deleted' });
    }

    res.json({ message: 'User soft deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.patch('/user/:id/restore', async (req, res) => {
  try {
    const userId = req.params.id;
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { isDeleted: false } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'User is not deleted or already restored' });
    }

    res.json({ message: 'User restored successfully' });
  } catch (error) {
    console.error('Error restoring user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



app.patch('/user/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, phone, balance, password } = req.body;

    const updateFields = {};

    if (name !== undefined) updateFields.name = name;
    if (phone !== undefined) updateFields.phone = phone;
    if (balance !== undefined) updateFields.balance = parseFloat(balance);
    if (password !== undefined) updateFields.password = password;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.patch("/user-password/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "সব ফিল্ড প্রয়োজন।" });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).json({ message: "ব্যবহারকারী খুঁজে পাওয়া যায়নি।" });
    }

    if (user.password !== oldPassword) {
      return res.status(401).json({ message: "পুরাতন পাসওয়ার্ড সঠিক নয়।" });
    }

    const updateResult = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { password: newPassword } }
    );

    res.json({ message: "পাসওয়ার্ড সফলভাবে আপডেট হয়েছে।", result: updateResult });
  } catch (error) {
    console.error("Password update error:", error);
    res.status(500).json({ message: "সার্ভারে সমস্যা হয়েছে।" });
  }
});

app.get('/referrals-count', async (req, res) => {
    const { inviteCode } = req.query;
    if (!inviteCode) {
        return res.status(400).json({ message: 'inviteCode required' });
    }

    try {
        const count = await usersCollection.countDocuments({ referredBy: inviteCode });
        res.json({ teamSize: count });
    } catch (err) {
        console.error("Error getting referrals count:", err);
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/referrals-details', async (req, res) => {
    const { inviteCode } = req.query;
    if (!inviteCode) {
        return res.status(400).json({ message: 'inviteCode query parameter is required' });
    }

    try {
        const referredUsers = await usersCollection
            .find({ referredBy: inviteCode })
            .project({ phone: 1, purchasedPlans: 1, balance: 1, createdAt: 1 })
            .toArray();

        // Map users to include if they have any purchased plan
        const results = referredUsers.map(user => ({
            phone: user.phone,
            hasPurchasedPlan: Array.isArray(user.purchasedPlans) && user.purchasedPlans.length > 0,
            purchasedPlans: user.purchasedPlans || [],
            balance: user.balance || 0,
            createdAt: user.createdAt,
        }));

        res.json({ referrals: results });
    } catch (error) {
        console.error('Error fetching referrals details:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


app.get('/referrals-bonus', async (req, res) => {
  const { inviteCode } = req.query;
  if (!inviteCode) return res.status(400).json({ message: 'inviteCode is required' });

  try {
    // Find referred users who have bought plans (active referrals)
    const activeReferrals = await usersCollection
      .find({ referredBy: inviteCode, purchasedPlans: { $exists: true, $not: { $size: 0 } } })
      .toArray();

    const activeCount = activeReferrals.length;

    // Calculate bonus based on your rules
    let bonus = 0;
    if (activeCount >= 3) bonus = 100;
    else if (activeCount >= 1) bonus = 50;

    res.json({
      activeReferralsCount: activeCount,
      referralBonus: bonus,
      // Optionally, add more info here
    });
  } catch (error) {
    console.error('Error fetching referral bonus:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/active-refers', async (req, res) => {
  try {
    const inviteCode = req.query.inviteCode;
    if (!inviteCode) {
      return res.status(400).json({ error: 'Missing inviteCode parameter' });
    }

    // Example: find user by inviteCode
    const user = await usersCollection.findOne({ inviteCode });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user.referrals exist and is an array
    if (!Array.isArray(user.referrals)) {
      return res.status(200).json({ activeCount: 0 });
    }

    // Filter active referrals - must have hasPurchasedPlan = true AND purchasedPlans non-empty
    const activeCount = user.referrals.filter(referral => 
      referral.hasPurchasedPlan === true &&
      Array.isArray(referral.purchasedPlans) &&
      referral.purchasedPlans.length > 0
    ).length;

    res.json({ activeCount });
  } catch (error) {
    console.error('Error in /active-refers:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});





// ✅ Update balance
app.post('/update-balance', async (req, res) => {
    const { phone, balance } = req.body;
    if (!phone || balance === undefined) {
        return res.status(400).json({ message: 'Phone এবং balance প্রয়োজন' });
    }

    try {
        const result = await usersCollection.updateOne(
            { phone },
            { $set: { balance } }
        );
        if (result.modifiedCount === 1) {
            res.json({ message: 'ব্যালেন্স আপডেট হয়েছে' });
        } else {
            res.status(404).json({ message: 'ব্যবহারকারী পাওয়া যায়নি' });
        }
    } catch (error) {
        res.status(500).json({ message: 'সার্ভার এরর' });
    }
});

// ✅ Buy plan
app.post('/buy-plan', async (req, res) => {
    const { phone, plan, boughtAt } = req.body;

    if (!phone || !plan) {
        return res.status(400).json({ message: 'Phone এবং plan প্রয়োজন' });
    }

    try {
        const result = await usersCollection.updateOne(
            { phone },
            {
                $push: {
                    purchasedPlans: {
                        ...plan,
                        boughtAt: new Date(boughtAt || Date.now())
                    }
                }
            }
        );

        if (result.modifiedCount > 0) {
            res.json({ message: 'প্যাকেজ সফলভাবে যুক্ত হয়েছে', result });
        } else {
            res.status(404).json({ message: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি' });
        }
    } catch (error) {
        console.error("❌ Error in /buy-plan:", error);
        res.status(500).json({ message: "সার্ভার ত্রুটি" });
    }
});

app.post("/plans", async (req, res) => {
  try {
    const planData = req.body;

    // Optionally validate required fields
    if (!planData.title || !planData.buyAmount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = await plansCollection.insertOne(planData);
    res.status(201).json({ message: "Plan added successfully", id: result.insertedId });
  } catch (error) {
    console.error("❌ Error adding plan:", error);
    res.status(500).json({ message: "Failed to add plan" });
  }
});


// ✅ Fetch all plans
app.get("/plans", async (req, res) => {
    try {
        const plans = await plansCollection.find().toArray();
        res.json(plans);
    } catch (error) {
        console.error("❌ Error fetching plans:", error);
        res.status(500).json({ message: "Failed to fetch plans" });
    }
});

app.get('/plans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await plansCollection.findOne({ _id: new ObjectId(id) });
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json(plan);
  } catch (error) {
    console.error("Error fetching plan:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
app.patch('/plans/:id', async (req, res) => {
  const { id } = req.params;
  const { _id, ...updateData } = req.body; // 🔥 Exclude _id from being updated

  try {
    const result = await plansCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.json({ message: "Plan updated successfully" });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/plans/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await plansCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.json({ message: "Plan deleted successfully" });
  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// Get all banners
app.get("/banners", async (req, res) => {
  try {
    const banners = await bannerCollection.find().toArray();
    res.json(banners);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch banners" });
  }
});


// POST /banners
app.post("/banners", async (req, res) => {
  try {
    const banner = req.body;

    if (!banner.image) {
      return res.status(400).json({ message: "Image is required" });
    }

    const result = await bannerCollection.insertOne(banner);
    res.status(201).json(result);
  } catch (error) {
    console.error("❌ Error creating banner:", error);
    res.status(500).json({ message: "Failed to upload banner" });
  }
});


// Delete banner
app.delete("/banners/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await bannerCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Banner not found" });
    }

    res.json({ message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete banner" });
  }
});



app.post("/deposit", async (req, res) => {
  const { agentNumber, amount, transactionId, userPhone, userId, paymentChannel } = req.body;

  if (!agentNumber || !amount || !transactionId || (!userPhone && !userId) || !paymentChannel) {
    return res.status(400).json({ message: "All required fields must be provided" });
  }

  try {
    // Validate user
    let userQuery = {};
    if (userId) {
      userQuery = { _id: new ObjectId(userId) };
    } else {
      userQuery = { phone: userPhone };
    }

    const user = await usersCollection.findOne(userQuery);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const depositRecord = {
      userId: user._id,
      userPhone,
      agentNumber,
      amount,
      transactionId,
      paymentChannel,
      createdAt: new Date(),
      status: "pending",
    };

    const result = await depositsCollection.insertOne(depositRecord);

    res.status(201).json({
      message: "Deposit recorded successfully",
      depositId: result.insertedId,
    });
  } catch (error) {
    console.error("Error in /deposit:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get('/deposits', async (req, res) => {
  const { userId } = req.query;

  try {
    let query = {};

    if (userId) {
      query.userId = new ObjectId(userId); // only specific user's deposits
    }

    const deposits = await depositsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(deposits);
  } catch (err) {
    console.error("Deposits fetch error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});




app.patch('/deposits/:id/approve', async (req, res) => {
  const { id } = req.params;
  try {
    const deposit = await depositsCollection.findOne({ _id: new ObjectId(id) });
    if (!deposit) return res.status(404).json({ message: "Deposit not found" });

    const userId = deposit.userId;
    const amount = parseFloat(deposit.amount);

    await Promise.all([
      depositsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "Approved" } }
      ),
      usersCollection.updateOne(
        { _id: new ObjectId(userId) },
        { $inc: { balance: amount } }
      )
    ]);

    res.json({ message: "Deposit approved and balance updated." });
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ message: "Approval failed." });
  }
});


app.post('/deposit-proof', async (req, res) => {
  const {
    userId,
    userPhone,
    paymentChannel,
    number,
    transactionId,
    amount,         // <-- added amount here
    status,
    createdAt,
  } = req.body;

  // Validate all required fields including amount
  if (!userId || !userPhone || !paymentChannel || !number || !transactionId || !amount) {
    return res.status(400).json({ message: 'All fields including amount are required' });
  }

  try {
    const proofRecord = {
      userId: new ObjectId(userId),
      userPhone,
      paymentChannel,
      number,
      transactionId,
      amount: parseFloat(amount), // store amount as number
      status: status || 'Pending',
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    };

    const result = await depositsProofCollection.insertOne(proofRecord);
    res.status(201).json({ message: 'Proof submitted successfully', id: result.insertedId });
  } catch (error) {
    console.error('Error saving deposit proof:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/deposit-proofs', async (req, res) => {
  try {
    const proofs = await depositsProofCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(proofs);
  } catch (error) {
    console.error("Error fetching deposit proofs:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.patch('/deposit-proofs/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['pending', 'approved', 'rejected'].includes(status.toLowerCase())) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    // Find the deposit proof by id
    const proof = await depositsProofCollection.findOne({ _id: new ObjectId(id) });
    if (!proof) {
      return res.status(404).json({ message: 'Deposit proof not found' });
    }

    if (proof.status.toLowerCase() === 'approved') {
      return res.status(400).json({ message: 'Deposit already approved' });
    }

    // If approving, add amount to user's balance
    if (status.toLowerCase() === 'approved') {
      await usersCollection.updateOne(
        { _id: proof.userId },
        { $inc: { balance: proof.amount } }
      );
    }

    // Update deposit proof status
    await depositsProofCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    res.json({ message: `Deposit proof status updated to ${status}` });
  } catch (error) {
    console.error('Error updating deposit proof status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/withdraw', async (req, res) => {
  console.log('Withdraw Request Body:', req.body);

  const {
    userId,
    userPhone,
    amount,
    paymentChannel,
    withdrawNumber,
    referBalance: reqReferBalance,
    balance: reqBalance,
  } = req.body;

  if (!userId || !userPhone || !amount || !paymentChannel || !withdrawNumber) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const referralBalance = typeof reqReferBalance === 'number' ? reqReferBalance : (user.referBalance || 0);
    const mainBalance = typeof reqBalance === 'number' ? reqBalance : (user.balance || 0);

    const withdrawalAmount = Number(amount);
    const totalAvailable = referralBalance + mainBalance;

    if (totalAvailable < withdrawalAmount) {
      return res.status(400).json({ message: 'Insufficient total balance' });
    }

    let newReferralBalance = referralBalance;
    let newMainBalance = mainBalance;

    if (referralBalance >= withdrawalAmount) {
      newReferralBalance -= withdrawalAmount;
    } else {
      const remaining = withdrawalAmount - referralBalance;
      newReferralBalance = 0;
      newMainBalance -= remaining;
    }

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { referBalance: newReferralBalance, balance: newMainBalance } }
    );

    const withdrawal = {
      userId: user._id,
      userPhone,
      amount: withdrawalAmount,
      paymentChannel,
      withdrawNumber,
      status: 'pending',
      createdAt: new Date(),
    };

    await withdrawalsCollection.insertOne(withdrawal);

    res.status(200).json({
      message: "Withdrawal request submitted",
      newBalance: newMainBalance,
      newReferralBalance,
      withdrawal,
    });

  } catch (error) {
    console.error("❌ Withdrawal error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});





app.get('/withdrawals', async (req, res) => {
  const { userId } = req.query;

  try {
    const query = userId ? { userId: new ObjectId(userId) } : {};

    const withdrawals = await withdrawalsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(withdrawals);
  } catch (err) {
    console.error("Withdraw fetch error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});



// ✅ PATCH: update withdraw status
app.patch('/withdrawals/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['success', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  try {
    const withdrawal = await withdrawalsCollection.findOne({ _id: new ObjectId(id) });
    if (!withdrawal) return res.status(404).json({ message: "Withdrawal not found" });

    if (status === "cancelled") {
      await usersCollection.updateOne(
        { _id: new ObjectId(withdrawal.userId) },
        { $inc: { balance: withdrawal.amount } }
      );
    }

    await withdrawalsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    res.json({ message: `Withdrawal marked as ${status}` });
  } catch (error) {
    console.error("❌ Status update error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



// Assume you have a usersCollection with documents like:
// { _id, phone, balance, lastSpinDate, ... }

app.get('/spin-status', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const today = new Date().toISOString().slice(0, 10);
    const spunToday = user.lastSpinDate === today;

    res.json({ spunToday, balance: user.balance || 0, phone: user.phone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


app.post('/spin', async (req, res) => {
  try {
    const { userId, reward } = req.body;
    if (!userId || reward == null) return res.status(400).json({ error: 'Missing data' });

    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const today = new Date().toISOString().slice(0, 10);
    const lastSpinDate = user.lastSpinDate || null;
    let dailySpinCount = user.dailySpinCount || 0;

    if (lastSpinDate !== today) {
      // Reset daily spin count if new day
      dailySpinCount = 0;
    }

    // Increase daily spin count and update balance
    dailySpinCount++;
    const newBalance = (user.balance || 0) + reward;

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { lastSpinDate: today, balance: newBalance, dailySpinCount } }
    );

    res.json({ success: true, newBalance, dailySpinCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



app.post('/notice', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ message: "Invalid notice message" });
  }

  try {
    const notice = {
      message,
      createdAt: new Date(),
    };

    const result = await noticeCollection.insertOne(notice);

    res.status(201).json({ message: "Notice sent successfully", id: result.insertedId });
  } catch (error) {
    console.error("Notice error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get('/notices', async (req, res) => {
  try {
    const notices = await noticeCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(notices);
  } catch (error) {
    console.error("Failed to fetch notices:", error);
    res.status(500).json({ message: "Server error" });
  }
});



app.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Missing credentials' });
  }

  try {
    const admin = await adminCollection.findOne({ username });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin not found' });
    }

    if (admin.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    return res.json({ success: true, message: 'Login successful', adminId: admin._id });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});


app.post('/admin/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Missing fields' });
  }

  try {
    const admin = await adminCollection.findOne({ username: 'admin123' });

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    if (admin.password !== currentPassword) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    await adminCollection.updateOne(
      { _id: admin._id },
      { $set: { password: newPassword } }
    );

    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});


// Collection: depositNumber

app.put('/deposit-number', async (req, res) => {
  const { bkash, nagad } = req.body;

  if (!bkash || !nagad) {
    return res.status(400).json({ message: "Both bKash and Nagad numbers are required" });
  }

  try {
    const collection = client.db('invest').collection('depositNumber');

    // Only one document is maintained (use fixed _id or filter)
    const filter = { type: 'agent-numbers' };
    const update = {
      $set: {
        bkash,
        nagad,
        updatedAt: new Date(),
        type: 'agent-numbers'
      }
    };
    const options = { upsert: true };

    await collection.updateOne(filter, update, options);

    res.status(200).json({ message: "Deposit numbers updated successfully" });
  } catch (error) {
    console.error("Update deposit number error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get('/deposit-number', async (req, res) => {
  try {
    const collection = client.db('invest').collection('depositNumber');
    const result = await collection.findOne({ type: 'agent-numbers' });
    res.json(result || {});
  } catch (error) {
    console.error("Fetch deposit number error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


app.post('/reward', async (req, res) => {
  const { userId, task, reward } = req.body;
  if (!userId || reward == null) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    // Update user balance: increment by reward amount
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Optional: Check if user already claimed this task reward to prevent duplicates

    await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $inc: { balance: reward } }
    );

    res.json({ message: 'Reward added successfully' });
  } catch (error) {
    console.error('Reward error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/dashboard', async (req, res) => {
  try {
    const db = client.db("invest");

    // Count non-deleted users
    const totalUsers = await db.collection("users").countDocuments({ isDeleted: { $ne: true } });

    // Total deposit amount
    const depositAgg = await db.collection("deposits").aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]).toArray();
    const totalDeposits = depositAgg[0]?.total || 0;

    // Total withdraw amount
    const withdrawAgg = await db.collection("withdrawals").aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]).toArray();
    const totalWithdraws = withdrawAgg[0]?.total || 0;

    res.json({
      totalUsers,
      totalDeposits,
      totalWithdraws,
      insights: "Stable growth in user deposits this week."
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ message: "Failed to load dashboard data" });
  }
});



app.get("/vouchers", async (req, res) => {
  try {
    if (!vouchersCollection) {
      throw new Error("Vouchers collection is not initialized");
    }
    const vouchers = await vouchersCollection.find().sort({ createdAt: -1 }).toArray();
    res.json(vouchers);
  } catch (error) {
    console.error("Error fetching vouchers:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.post('/vouchers', async (req, res) => {
  try {
    console.log('Received voucher:', req.body);

    const { number, date, imgLink, msg } = req.body;

    if (!number || !date || !imgLink || !msg) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const voucher = {
      number,
      date: new Date(date),
      imgLink,
      msg,
      createdAt: new Date(),
    };

    const result = await vouchersCollection.insertOne(voucher);
    res.status(201).json({ message: "Voucher created", id: result.insertedId });
  } catch (error) {
    console.error("Error creating voucher:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



app.delete("/vouchers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await vouchersCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Voucher not found" });
    }
    res.json({ message: "Voucher deleted" });
  } catch (error) {
    console.error("Error deleting voucher:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// GET all news
app.get('/news', async (req, res) => {
  try {
    const news = await newsCollection.find().sort({ createdAt: -1 }).toArray();
    res.status(200).json(news);
  } catch (err) {
    console.error("Error fetching news:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// POST news
app.post('/news', async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ message: "Question and answer are required" });
    }

    const news = {
      question,
      answer,
      createdAt: new Date(),
    };

    const result = await newsCollection.insertOne(news);
    res.status(201).json({ message: "News added", id: result.insertedId });
  } catch (err) {
    console.error("Error adding news:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE news
app.delete('/news/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await newsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "News not found" });
    }

    res.status(200).json({ message: "News deleted" });
  } catch (err) {
    console.error("Error deleting news:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});


  app.get("/aboutus", async (req, res) => {
      try {
        const abouts = await aboutCollection.find().sort({ _id: -1 }).toArray();
        res.json(abouts);
      } catch (error) {
        console.error("Failed to fetch AboutUs data:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Add new AboutUs entry
    app.post("/aboutus", async (req, res) => {
      try {
        const { imageUrl, description } = req.body;
        if (!imageUrl || !description) {
          return res.status(400).json({ message: "Image URL and description are required" });
        }

        const newEntry = { imageUrl, description, createdAt: new Date() };
        const result = await aboutCollection.insertOne(newEntry);
        res.status(201).json({ message: "About Us entry added", id: result.insertedId });
      } catch (error) {
        console.error("Failed to add AboutUs entry:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Delete AboutUs entry by ID
    app.delete("/aboutus/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const result = await aboutCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Entry not found" });
        }
        res.json({ message: "Entry deleted" });
      } catch (error) {
        console.error("Failed to delete AboutUs entry:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });


async function startServer() {
  await connectDB();

  app.listen(Port, () => {
    console.log(`Server running on port ${Port}`);
  });
}

startServer();