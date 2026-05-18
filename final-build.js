const fs = require("fs");
const path = require("path");

// Delete old CSS
const cssPath = path.join(__dirname, "public", "styles.css");
if (fs.existsSync(cssPath)) {
  fs.unlinkSync(cssPath);
  console.log("🗑️  Deleted old CSS file");
}

// Now build with PostCSS
const postcss = require("postcss");
const tailwindcss = require("tailwindcss");

async function build() {
  try {
    const inputFile = path.join(__dirname, "src", "input.css");
    const outputFile = path.join(__dirname, "public", "styles.css");

    console.log("🔨 Building Tailwind CSS (using PostCSS config)...");

    const input = fs.readFileSync(inputFile, "utf8");

    // Use PostCSS with Tailwind plugin - it will read tailwind.config.js automatically
    const result = await postcss([tailwindcss]).process(input, {
      from: inputFile,
      to: outputFile,
    });

    // Ensure public dir exists
    const publicDir = path.join(__dirname, "public");
    fs.mkdirSync(publicDir, { recursive: true });

    // Write the CSS
    fs.writeFileSync(outputFile, result.css);

    const sizeKB = (fs.statSync(outputFile).size / 1024).toFixed(2);
    console.log(`✅ SUCCESS! Generated ${sizeKB} KB of Tailwind CSS`);
    console.log(`📁 Output: ${outputFile}`);
  } catch (error) {
    console.error("❌ Build failed:", error.message);
    if (error.code === "MODULE_NOT_FOUND") {
      console.error("\n⚠️  Missing dependency. Run: npm install");
    }
    process.exit(1);
  }
}

build();
