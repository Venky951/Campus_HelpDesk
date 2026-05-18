const fs = require("fs");
const path = require("path");

const filePath = path.resolve("./public/styles.css");
if (fs.existsSync(filePath)) {
  fs.unlinkSync(filePath);
  console.log("✓ Deleted old styles.css");
} else {
  console.log("File doesn't exist");
}

// Now rebuild
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");

async function build() {
  try {
    const input = fs.readFileSync("./src/input.css", "utf8");
    console.log("🔨 Building fresh Tailwind CSS...");

    const result = await postcss(tailwindcss).process(input, {
      from: "./src/input.css",
      to: "./public/styles.css",
    });

    fs.mkdirSync("./public", { recursive: true });
    fs.writeFileSync("./public/styles.css", result.css);

    const size = (fs.statSync("./public/styles.css").size / 1024).toFixed(2);
    console.log(`✓ Built successfully! (${size} KB)`);
    console.log("✓ CSS file ready to use");
  } catch (error) {
    console.error("✗ Build failed:", error.message);
    process.exit(1);
  }
}

build();
