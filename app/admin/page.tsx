import InstanceCard from "@/components/instance-card";
import { EC2 } from "@aws-sdk/client-ec2";
import { notFound } from "next/navigation";
import { getEnvironmentPrefix } from "@/app/api/constants";

async function getCurrentPRNumber(): Promise<string | null> {
  if (process.env.VERCEL_GIT_PULL_REQUEST_ID) {
    return process.env.VERCEL_GIT_PULL_REQUEST_ID;
  }
  
  const commitRef = process.env.VERCEL_GIT_COMMIT_REF;
  if (commitRef) {
    const branchName = commitRef.replace('refs/heads/', '');
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPOSITORY;
    
    if (githubToken && githubRepo && branchName) {
      try {
        const [owner] = githubRepo.split('/');
        const headFilter = `${owner}:${branchName}`;
        
        const response = await fetch(`https://api.github.com/repos/${githubRepo}/pulls?head=${headFilter}&state=open`, {
          headers: {
            "Authorization": `Bearer ${githubToken}`,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
          }
        });
        
        if (response.ok) {
          const prs = await response.json();
          if (prs.length === 1) {
            console.log(`✅ Found PR #${prs[0].number} for branch: ${branchName}`);
            return prs[0].number.toString();
          }
        }
      } catch (error) {
        console.warn(`⚠️ GitHub API lookup failed: ${error}`);
      }
    }
  }
  
  return null;
}

export default async function AdminPage() {
  const ec2 = new EC2({
    region: "us-east-1",
  });
  
  const environmentPrefix = getEnvironmentPrefix();
  const currentPRNumber = await getCurrentPRNumber();
  
  const filters = [
    { Name: "tag:Project", Values: ["VargasJR"] },
    { Name: "instance-state-name", Values: ["running", "stopped", "pending"] }
  ];
  
  if (environmentPrefix === '') {
    filters.push({ Name: "tag:Type", Values: ["main"] });
  } else if (environmentPrefix === 'PREVIEW' && currentPRNumber) {
    filters.push({ Name: "tag:PRNumber", Values: [currentPRNumber] });
  }
  
  const instances = await ec2
    .describeInstances({ Filters: filters })
    .then((data) => data.Reservations?.flatMap(r => r.Instances || []) || []);

  if (instances.length === 0) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-4 justify-start items-start">
      <h1 className="text-2xl font-bold">Vargas JR</h1>
      <p className="text-sm text-gray-500">Manage Vargas Jr Settings</p>
      
      {/* Environment Info */}
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg w-full max-w-2xl">
        <h3 className="font-semibold text-yellow-800 mb-2">Environment Info</h3>
        <div className="text-sm font-mono space-y-1 text-gray-700">
          <div><strong>Environment Prefix:</strong> &quot;{environmentPrefix}&quot; {environmentPrefix === '' ? '(empty string = production)' : ''}</div>
          <div><strong>Current PR Number:</strong> {currentPRNumber || 'null'}</div>
          <div><strong>Total Instances Found:</strong> {instances.length}</div>
        </div>
      </div>
      
      {instances.map((instance) => (
        <InstanceCard key={instance.InstanceId} instance={instance} />
      ))}
    </div>
  );
}
