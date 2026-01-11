const fs = require('fs');

const filePath = 'repos.yml';
let content = fs.readFileSync(filePath, 'utf8');

// Replace timestamp fields
// 1. starred_at -> user_starred_at
// Look for "  starred_at:" (indentation varies but usually 2 or 4 spaces)
content = content.replace(/^(\s+)starred_at:/gm, '$1user_starred_at:');

// 2. updated_at -> repo_pushed_at (inside github_metadata)
// This one is tricky because updated_at might be used elsewhere.
// But based on the schema, updated_at is only in github_metadata.
// Let's look for "      updated_at:" which is deeply nested.
content = content.replace(/^(\s+)updated_at:/gm, '$1repo_pushed_at:');

// 3. timestamp -> classified_at (inside ai_classification)
// Look for "      timestamp:"
content = content.replace(/^(\s+)timestamp:/gm, '$1classified_at:');

// 4. last_updated -> manifest_updated_at (in manifest_metadata)
content = content.replace(/^(\s+)last_updated:/gm, '$1manifest_updated_at:');

fs.writeFileSync(filePath, content);
console.log('Migration complete via regex replacement.');
