const fs = require('fs');
const path = require('path');
const postcss = require('postcss');
const tailwindConfig = require('./tailwind.config.js');
const autoprefixer = require('autoprefixer');

// Create a basic CSS file with Tailwind directives
const basicCss = `
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

/* Ensure proper spacing */
.card-body {
  padding: 1.5rem;
}

/* Fix for table overflow */
.overflow-x-auto {
  max-height: 400px;
  overflow-y: auto;
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  html {
    data-theme: "dark";
  }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .card-body {
    padding: 1rem;
  }
}
`;

// Write the basic CSS to a temporary file
fs.writeFileSync('temp.css', basicCss);

// Process the CSS with PostCSS, Tailwind, and Autoprefixer
postcss([
  require('tailwindcss')(tailwindConfig),
  autoprefixer
])
  .process(basicCss, {
    from: 'temp.css',
    to: 'styles.css'
  })
  .then(result => {
    // Write the processed CSS to styles.css
    fs.writeFileSync('styles.css', result.css);
    console.log('CSS build complete!');
    
    // Clean up the temporary file
    fs.unlinkSync('temp.css');
  })
  .catch(error => {
    console.error('Error processing CSS:', error);
  }); 