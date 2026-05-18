const fs = require("fs");
const postcss = require("postcss");
const tailwindcss = require("@tailwindcss/postcss");
const autoprefixer = require("autoprefixer");

const inputPath = "./src/input.css";
const outputPath = "./public/styles.css";

async function build() {
  try {
    const input = fs.readFileSync(inputPath, "utf8");
    const result = await postcss([
      tailwindcss(require("./tailwind.config.js")),
      autoprefixer,
    ]).process(input, {
      from: inputPath,
      to: outputPath,
      map: false,
    });

    fs.mkdirSync("./public", { recursive: true });
    fs.writeFileSync(outputPath, result.css);
    console.log("Built Tailwind CSS ->", outputPath);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

if (process.argv.includes("--watch")) {
  const chokidar = require("chokidar");
  const watcher = chokidar.watch(["./src/**/*.css", "./views/**/*.ejs"], {
    ignoreInitial: true,
  });
  watcher.on("all", (event, path) => {
    console.log(`${event} detected: ${path} — rebuilding...`);
    build();
  });
  console.log("Watching for CSS/view changes...");
  build();
} else {
  build();
}
