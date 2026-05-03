require("dotenv").config({ path: "../.env" });
const chalk = require("chalk");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");

const setupDB = require("./db");
const { ROLES } = require("../constants");

const User = require("../models/user");
const Brand = require("../models/brand");
const Product = require("../models/product");
const Category = require("../models/category");

const NUM_PRODUCTS = 100;
const NUM_BRANDS = 10;
const NUM_CATEGORIES = 10;

// 🔥 helper to hash password
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

const seedUsers = async () => {
    console.log(`${chalk.yellow("!")} Seeding users...`);

    // 🔴 SUPER ADMIN
    const superAdminExists = await User.findOne({
        role: ROLES.SuperAdmin,
    });

    if (!superAdminExists) {
        await new User({
            email: "superadmin@test.com",
            password: await hashPassword("123456"),
            firstName: "Super",
            lastName: "Admin",
            role: ROLES.SuperAdmin,
        }).save();

        console.log(`${chalk.green("✓")} Super Admin created`);
    }

    // 🔴 ADMINS
    const admins = [
        {
            email: "admin1@test.com",
            firstName: "Admin",
            lastName: "One",
        },
        {
            email: "admin2@test.com",
            firstName: "Admin",
            lastName: "Two",
        },
    ];

    for (const admin of admins) {
        const exists = await User.findOne({ email: admin.email });

        if (!exists) {
            await new User({
                ...admin,
                password: await hashPassword("123456"),
                role: ROLES.Admin,
            }).save();
        }
    }

    console.log(`${chalk.green("✓")} Admins seeded`);
};

const seedCategories = async () => {
    let categories = [];

    const count = await Category.countDocuments();

    if (count >= NUM_CATEGORIES) {
        console.log(`${chalk.yellow("!")} Categories already exist`);
        return await Category.find().select("_id");
    }

    for (let i = 0; i < NUM_CATEGORIES; i++) {
        const category = new Category({
            name: faker.commerce.department(),
            description: faker.lorem.sentence(),
            isActive: true,
        });

        await category.save();
        categories.push(category);
    }

    console.log(`${chalk.green("✓")} Categories seeded`);
    return categories;
};

const seedBrands = async () => {
    const count = await Brand.countDocuments();

    if (count >= NUM_BRANDS) {
        console.log(`${chalk.yellow("!")} Brands already exist`);
        return;
    }

    for (let i = 0; i < NUM_BRANDS; i++) {
        await new Brand({
            name: faker.company.name(),
            description: faker.lorem.sentence(),
            isActive: true,
        }).save();
    }

    console.log(`${chalk.green("✓")} Brands seeded`);
};

const seedProducts = async (categories) => {
    const count = await Product.countDocuments();

    if (count >= NUM_PRODUCTS) {
        console.log(`${chalk.yellow("!")} Products already exist`);
        return;
    }

    const brands = await Brand.find().select("_id");

    for (let i = 0; i < NUM_PRODUCTS; i++) {
        const randomCategoryIndex = faker.number.int(categories.length - 1);

        const product = new Product({
            sku: faker.string.alphanumeric(10),
            name: faker.commerce.productName(),
            description: faker.lorem.sentence(),
            quantity: faker.number.int({ min: 1, max: 100 }),
            price: faker.commerce.price(),
            taxable: faker.datatype.boolean(),
            isActive: true,
            brand: brands[faker.number.int(brands.length - 1)]._id,
            category: categories[randomCategoryIndex]._id,
        });

        await product.save();

        await Category.updateOne(
            { _id: categories[randomCategoryIndex]._id },
            { $push: { products: product._id } },
        );
    }

    console.log(`${chalk.green("✓")} Products seeded`);
};

const seedDB = async () => {
    try {
        console.log(`${chalk.blue("✓")} Seed started`);

        await seedUsers();
        const categories = await seedCategories();
        await seedBrands();
        await seedProducts(categories);
    } catch (error) {
        console.log(`${chalk.red("x")} Error seeding database`);
        console.log(error);
    } finally {
        await mongoose.connection.close();
        console.log(`${chalk.blue("✓")} DB connection closed`);
    }
};

(async () => {
    try {
        await setupDB();
        await seedDB();
    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
})();
