import { readFileSync } from 'fs';
import { postGitHubComment } from './utils';

async function main() {
  try {
    const knowledgeContent = readFileSync('knowledge-preview.txt', 'utf8');
    
    await postGitHubComment(
      knowledgeContent,
      'vargasjr-dev-apply-knowledge-script',
      'Posted knowledge preview comment to PR'
    );
    
    console.log('✅ Successfully posted knowledge preview to PR');
  } catch (error) {
    console.error('Failed to post knowledge preview:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
