const mongoose = require("mongoose");

const connectDB = async () => {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("MONGO_URI not defined. Did you load dotenv?");
        process.exit(1);
    }

    try {
        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // useCreateIndex: true, // not needed on newer mongoose versions
        });
        console.log("MongoDB connected");
    } catch (err) {
        console.error("MongoDB connection failed:", err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
