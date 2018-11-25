import { default as c } from "chalk";
import commander = require("commander");
import { createWriteStream, existsSync, readFileSync, removeSync, unlinkSync, writeFileSync } from "fs-extra";
import mongoose = require("mongoose");
import prompts = require("prompts");
import { generate } from "randomstring";
import { get } from "request";
import { Extract } from "unzipper";
import { FRONTEND_PATH, PACKAGE_PATH } from "./constant";
import { ISystemConfig } from "./interfaces/system";

const version = JSON.parse(readFileSync(PACKAGE_PATH).toString()).version;

commander
    .version(version);

const readbool = async (message: string, initial: boolean = false) => (await prompts({ type: "confirm", name: "v", message, initial })).v;
const readpass = async () => (await prompts({ type: "password", name: "v", message: "Please input password" })).v;

const uninstall = async () => {
    console.log("[INFO] config.json exists.");
    if (await readbool("continue will overwrite exist data. confirm?")) {
        console.log("[INFO] removing managed files...");
        const oldConfig = JSON.parse(readFileSync("config.json").toString());
        try {
            removeSync("files");
            unlinkSync("config.json");
            unlinkSync("app.log");
        } catch (e) {
            console.log("[ERROR] " + e.message);
            if (!await readbool("continue?")) { process.exit(0); }
        }
        console.log("[INFO] Droping database...");
        await mongoose.connect(oldConfig.db.url, oldConfig.db.options);
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    } else {
        process.exit(0);
    }
};

const generateConfig = async () => {
    const questions = [
        {
            type: "text",
            name: "db_url",
            message: "Mongodb URL",
            initial: "mongodb://localhost:27017/perilla",
        },
        {
            type: "text",
            name: "redis_host",
            message: "REDIS database hostname/IP address",
            initial: "127.0.0.1",
        },
        {
            type: "number",
            name: "redis_port",
            message: "REDIS database port",
            initial: 6379,
            min: 1,
            max: 65535,
        },
        {
            type: "number",
            name: "redis_index",
            message: "REDIS database index",
            initial: 0,
            min: 0,
            max: 15,
        },
        {
            type: "text",
            name: "redis_prefix",
            message: "REDIS database prefix",
            initial: "perilla",
        },
        {
            type: "text",
            name: "db_url",
            message: "Mongodb URL",
            initial: "mongodb://localhost:27017/perilla",
        },
        {
            type: "text",
            name: "http_hostname",
            message: "HTTP Hostname",
            initial: "localhost",
        },
        {
            type: "number",
            name: "http_port",
            message: "HTTP Port",
            initial: 8680,
            min: 1,
            max: 65535,
        },
        {
            type: "text",
            name: "session_secret",
            message: "session secret",
            initial: generate(25),
        },
    ];
    const answers = await prompts(questions);
    const config: ISystemConfig = {
        db: {
            url: answers.db_url,
            options: {
                useNewUrlParser: true,
                useCreateIndex: true,
            },
        },
        redis: {
            host: answers.redis_host,
            port: answers.redis_port,
            db: answers.redis_index,
            prefix: answers.redis_prefix,
        },
        http: {
            port: answers.http_port,
            hostname: answers.http_hostname,
            https: false,
        },
        sessionSecret: answers.session_secret,
    };
    writeFileSync("config.json", JSON.stringify(config, null, "\t"));
};

const InitializeDatabase = async () => {
    await require("./database").connectDB();
    const { Entry, EntryType } = require("./schemas/entry");
    const admin = new Entry();
    admin._id = "Administrator";
    admin.description = "System administrator";
    admin.email = "admin@perilla.js.org";
    admin.type = EntryType.user;
    admin.setPassword(await readpass());
    await admin.save();
    const { SystemMap } = require("./schemas/systemmap");
    const map = new SystemMap();
    map.user = admin._id;
    await map.save();
};

commander
    .command("init")
    .description("Initialize the system")
    .action(async () => {
        // 0. remove exists installition
        // 1. Compile typescript code into javascript
        // 2. Generate configuration file
        // 3. Initialize database

        console.log("[INFO] Initializing the system...");
        console.log("[INFO] [STEP 1/4] Checking environment...");
        if (existsSync("config.json")) { await uninstall(); }
        console.log("[INFO] [STEP 2/4]  Generating config...");
        await generateConfig();
        console.log("[INFO] [STEP 3/4] Initializing database...");
        await InitializeDatabase();
        console.log("[INFO] ✔️ Done");
        console.log("[TIP] use `yarn start` to start perilla");
        console.log("[TIP] Edit config.json to customize perilla.");
        console.log("[TIP] Please read https://perilla.js.org for more information");
        const { gracefulExit } = require("./utils");
        gracefulExit("cli finished");
    });

const createEntry = async (id: string) => {
    await require("./database").connectDB();
    const questions = [
        {
            type: "text",
            name: "email",
            message: "Entry email",
        },
        {
            type: "select",
            name: "type",
            message: "Entry type",
            choices: [
                { title: "User", value: 0 },
                { title: "Group", value: 1 },
            ],
        },
    ];
    const answers = await prompts(questions);
    const { Entry, EntryType } = require("./schemas/entry");
    const entry = new Entry();
    entry._id = id;
    entry.email = answers.email;
    entry.type = answers.type;
    if (entry.type === EntryType.user) {
        entry.setPassword(await readpass());
    }
    await entry.save();
    console.log(`[INFO] 😙 Welcome, ${id}.`);
};

const removeEntry = async (id: string) => {
    await require("./database").connectDB();
    const { Entry, EntryType } = require("./schemas/entry");
    const entry = await Entry.findById(id);
    if (!entry) { throw new Error("Entry not found"); }
    await entry.remove();
    console.log(`[INFO] 🗑 ${id} removed.`);
};

const cp = (obj: any, key: any) => {
    return c.blueBright(key) + "\t" + c.redBright(obj[key]);
};

const modifyEntry = async (id: string) => {
    await require("./database").connectDB();
    const { Entry, EntryType } = require("./schemas/entry");
    const entry = await Entry.findById(id);
    if (!entry) { throw new Error("Entry not found"); }
    console.log(cp(entry, "_id"));
    console.log(cp(entry, "description"));
    console.log(cp(entry, "email"));
    console.log(cp(entry, "created"));
    console.log(cp(entry, "type"));
    if (entry.type === EntryType.user) {
        if (await readbool("Change password")) {
            entry.setPassword(await readpass());
        }
    }
    await entry.save();
};

commander
    .command("entry <id>")
    .description("Entry utils")
    .option("-c, --create", "Create entry")
    .option("-r, --remove", "Delete entry")
    .option("-m, --modify", "Modify entry")
    .action(async (id, cmd) => {
        try {
            if (cmd.create) {
                await createEntry(id);
            }
            if (cmd.remove) {
                await removeEntry(id);
            }
            if (cmd.modify) {
                await modifyEntry(id);
            }
        } catch (e) {
            console.log(e.message);
        }
        const { gracefulExit } = require("./utils");
        gracefulExit("cli finished");
    });

const fetchLatestFrontendTag = async () => {
    const url = "https://github.com/ZhangZisu/perilla-frontend/releases/latest";
    return new Promise<string>((resolve, reject) => {
        get("https://github.com/ZhangZisu/perilla-frontend/releases/latest", (err, res) => {
            if (err) { return reject(err); }
            const span = /<span class="css-truncate-target" style="max-width: 125px">[a-zA-Z0-9.]+<\/span>/.exec(res.body)[0];
            if (!span) { return reject("Fetch latest frontend version failed"); }
            const latest = span.substr(59, span.length - 66);
            console.log(`Version ${latest} found.`);
            resolve(latest);
        });
    });
};

const downloadFrontendRelease = async (tag: string) => {
    const url = `https://github.com/ZhangZisu/perilla-frontend/releases/download/${tag}/dist.zip`;
    removeSync(FRONTEND_PATH);
    console.log("Downloading...");
    return new Promise<void>((resolve, reject) => {
        get(url).pipe(Extract({ path: FRONTEND_PATH })).on("close", resolve).on("error", reject);
    });
};

commander
    .command("frontend")
    .description("Frontend utils")
    .option("-d, --download", "Download frontend file")
    .action(async (cmd) => {
        try {
            if (cmd.download) {
                const latest = await fetchLatestFrontendTag();
                await downloadFrontendRelease(latest);
            }
        } catch (e) {
            console.log(e.message);
        }
        const { gracefulExit } = require("./utils");
        gracefulExit("cli finished");
    });

commander.parse(process.argv);
