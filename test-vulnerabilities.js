/**
 * TEST FILE FOR CODEQL VULNERABILITY DETECTION
 * 
 * This file contains intentional security vulnerabilities
 * to verify that CodeQL security scanning is working correctly.
 * 
 * DO NOT USE THIS CODE IN PRODUCTION!
 * This file should be removed after testing.
 */

// Vulnerability 1: Cross-Site Scripting (XSS)
function displayUserContent(userInput) {
  // VULNERABLE: Directly injecting user input into innerHTML
  // This allows script injection attacks
  const container = document.getElementById('content');
  container.innerHTML = userInput; // CodeQL should flag this as XSS
}

// Vulnerability 2: Unsafe eval usage
function executeUserCode(code) {
  // VULNERABLE: eval() can execute arbitrary code
  eval(code); // CodeQL should flag this as code injection
}

// Vulnerability 3: DOM-based XSS via URL parameters
function displayWelcomeMessage() {
  // VULNERABLE: Using URL parameters directly in DOM
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name');
  document.getElementById('welcome').innerHTML = `Welcome, ${name}!`; // XSS via URL
}

// Vulnerability 4: Prototype pollution
function merge(target, source) {
  // VULNERABLE: Can pollute Object.prototype
  for (let key in source) {
    target[key] = source[key]; // No prototype check
  }
  return target;
}

// Vulnerability 5: Command injection (Node.js)
const { exec } = require('child_process');

function runUserCommand(userInput) {
  // VULNERABLE: Command injection via unsanitized input
  exec(`ls ${userInput}`, (error, stdout) => {
    console.log(stdout);
  });
}

// Vulnerability 6: Path traversal
const fs = require('fs');
const path = require('path');

function readUserFile(filename) {
  // VULNERABLE: No validation of filename, allows path traversal
  const content = fs.readFileSync(filename, 'utf8'); // Directory traversal
  return content;
}

// Expected CodeQL Results:
// - At least 6 security vulnerabilities should be detected
// - Severity levels should include High/Medium findings
// - Each vulnerability should have a clear description and remediation advice

module.exports = {
  displayUserContent,
  executeUserCode,
  displayWelcomeMessage,
  merge,
  runUserCommand,
  readUserFile
};
