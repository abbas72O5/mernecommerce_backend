const rawApiURL = process.env.BASE_API_URL || "api/v1";
const normalizedApiURL = rawApiURL.replace(/^\/+|\/+$/g, "") || "api/v1";
const apiURL =
    normalizedApiURL === "api" || normalizedApiURL.startsWith("api/")
        ? normalizedApiURL
        : `api/${normalizedApiURL}`;

module.exports = {
    app: {
        name: "Mern Ecommerce",
        apiURL,
        clientURL: process.env.CLIENT_URL,
    },
    port: process.env.PORT || 3000,
    database: {
        url: process.env.MONGO_URI,
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        tokenLife: "7d",
    },
    mailchimp: {
        key: process.env.MAILCHIMP_KEY,
        listKey: process.env.MAILCHIMP_LIST_KEY,
    },
    mailgun: {
        key: process.env.MAILGUN_KEY,
        domain: process.env.MAILGUN_DOMAIN,
        sender: process.env.MAILGUN_EMAIL_SENDER,
    },
    postmark: {
        apiToken: process.env.POSTMARK_API_TOKEN,
        fromEmail: process.env.POSTMARK_FROM_EMAIL || 'noreply@app.com',
        fromName: process.env.POSTMARK_FROM_NAME || 'Your App',
    },
    aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        bucketName: process.env.AWS_BUCKET_NAME,
    },
};
