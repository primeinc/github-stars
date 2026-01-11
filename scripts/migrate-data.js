const fs = require('fs');
const { execSync } = require('child_process');

// Ensure yq exists
if (!fs.existsSync('yq')) {
  console.log('Downloading yq...');
  execSync('wget -qO ./yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64');
  execSync('chmod +x ./yq');
}

console.log('Converting YAML to JSON...');
const yaml = fs.readFileSync('repos.yml', 'utf8');
const json = execSync('./yq eval -o=json -', { input: yaml, encoding: 'utf8', maxBuffer: 50*1024*1024 });
const data = JSON.parse(json);

console.log('Migrating data...');
let count = 0;

if (data.manifest_metadata.last_updated) {
  data.manifest_metadata.manifest_updated_at = data.manifest_metadata.last_updated;
  delete data.manifest_metadata.last_updated;
}

data.repositories.forEach(repo => {
  // Migrate starred_at -> user_starred_at
  if (repo.starred_at) {
    repo.user_starred_at = repo.starred_at;
    delete repo.starred_at;
  }

  // Migrate github_metadata.updated_at -> repo_pushed_at
  if (repo.github_metadata && repo.github_metadata.updated_at) {
    repo.github_metadata.repo_pushed_at = repo.github_metadata.updated_at;
    delete repo.github_metadata.updated_at;
  }

  // Migrate ai_classification.timestamp -> classified_at
  if (repo.ai_classification && repo.ai_classification.timestamp) {
    repo.ai_classification.classified_at = repo.ai_classification.timestamp;
    delete repo.ai_classification.timestamp;
  }
  
  count++;
});

console.log(`Migrated ${count} repositories.`);

fs.writeFileSync('.github-stars/data/manifest.json', JSON.stringify(data, null, 2));

console.log('Converting JSON back to YAML...');
execSync('./yq eval \'.\' .github-stars/data/manifest.json -o=yaml > repos.yml');

console.log('Migration complete.');
