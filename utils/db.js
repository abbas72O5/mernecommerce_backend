require("dotenv").config();
const chalk = require("chalk");
const mongoose = require("mongoose");

const keys = require("../config/keys");
const { database } = keys;

const setupDB = async () => {
    try {
        await mongoose.connect(database.url);

        console.log(`${chalk.green("✓")} ${chalk.blue("MongoDB Connected!")}`);
    } catch (error) {
        console.log(`${chalk.red("x")} MongoDB connection failed`);
        console.log(error.message);
        process.exit(1);
    }
};

module.exports = setupDB;
