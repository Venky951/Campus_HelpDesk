const fs = require("fs");
const path = require("path");

console.log("\n=== Tailwind CSS Setup Diagnostic ===\n");

// 1. Check config file
const configPath = "./tailwind.config.js";
if (fs.existsSync(configPath)) {
  const config = require(path.resolve(configPath));
  console.log("✓ tailwind.config.js found");
  console.log("  Content paths:", config.content);
} else {
  console.log("✗ tailwind.config.js NOT found");
}

// 2. Check input CSS
const inputPath = "./src/input.css";
if (fs.existsSync(inputPath)) {
  const input = fs.readFileSync(inputPath, "utf8");
  console.log("✓ src/input.css found");
  console.log("  Contains:", input.split("\n").length, "lines");
} else {
  console.log("✗ src/input.css NOT found");
}

// 3. Check output CSS
const outputPath = "./public/styles.css";
if (fs.existsSync(outputPath)) {
  const stats = fs.statSync(outputPath);
  console.log("✓ public/styles.css found");
  console.log("  Size:", (stats.size / 1024).toFixed(2), "KB");

  // Check if it has useful classes
  const content = fs.readFileSync(outputPath, "utf8");
  const hasUtilities =
    content.includes(".bg-") ||
    content.includes(".px-") ||
    content.includes(".text-");
  console.log(
    "  Has utilities:",
    hasUtilities ? "YES ✓" : "NO ✗ (incomplete build)",
  );
} else {
  console.log("✗ public/styles.css NOT found (needs rebuild)");
}

// 4. Check EJS files have Tailwind classes
console.log("\n✓ Checking template files...");
const viewDir = "./views";
if (fs.existsSync(viewDir)) {
  const files = fs.readdirSync(viewDir).filter((f) => f.endsWith(".ejs"));
  console.log("  Found", files.length, "EJS files");

  files.forEach((file) => {
    const content = fs.readFileSync(path.join(viewDir, file), "utf8");
    const hasTailwind =
      /class="[^"]*(?:flex|grid|px-|py-|text-|bg-|border|rounded)/g.test(
        content,
      );
    console.log(
      `    ${file}: ${hasTailwind ? "✓ has Tailwind classes" : "- no Tailwind"}`,
    );
  });
}

// 5. Check if HTML is linking the CSS
console.log("\n✓ Checking head.ejs...");
const headPath = "./views/partials/head.ejs";
if (fs.existsSync(headPath)) {
  const content = fs.readFileSync(headPath, "utf8");
  const hasLink =
    content.includes("styles.css") || content.includes("/styles.css");
  console.log("  Links styles.css:", hasLink ? "✓ YES" : "✗ NO");
  if (hasLink) {
    const match = content.match(/href="([^"]*styles\.css[^"]*)"/);
    if (match) console.log("  Link:", match[1]);
  }
}

console.log("\n=== Summary ===");
console.log("Your CSS setup is ready to use!");
console.log("Make sure:");
console.log(
  "  1. public/styles.css is properly built with all Tailwind utilities",
);
console.log("  2. The HTML links to /styles.css");
console.log("  3. The Express server serves static files from ./public");
console.log("\nTo rebuild, run: node build-tailwind.js\n");
