const fs = require("fs");
const path = require("path");
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");

async function rebuild() {
  const configPath = path.resolve("./tailwind.config.js");
  const inputPath = path.resolve("./src/input.css");
  const outputPath = path.resolve("./public/styles.css");

  try {
    const input = fs.readFileSync(inputPath, "utf8");
    console.log("🔨 Building Tailwind CSS...");

    const result = await postcss(tailwindcss(configPath)).process(input, {
      from: inputPath,
      to: outputPath,
    });

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, result.css);

    const size = (fs.statSync(outputPath).size / 1024).toFixed(2);
    console.log(`✓ Built successfully! (${size} KB)`);
  } catch (error) {
    console.error("✗ Build failed!");
    console.error(error);
    process.exit(1);
  }
}

rebuild();
