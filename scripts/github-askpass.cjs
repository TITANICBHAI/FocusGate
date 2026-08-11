const prompt = (process.argv[2] || '').toLowerCase();
const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

if (!token) {
  process.stderr.write(
    'GITHUB_PERSONAL_ACCESS_TOKEN is not configured in this environment.\n',
  );
  process.exit(1);
}

process.stdout.write(prompt.includes('username') ? 'x-access-token' : token);