import InstanceCard from "@/components/instance-card";
import { EC2 } from "@aws-sdk/client-ec2";
import { getEnvironmentPrefix } from "@/app/api/constants";
import { retryWithBackoff } from "@/scripts/utils";

async function getCurrentPRNumber(): Promise<string | null> {
  if (process.env.VERCEL_GIT_PULL_REQUEST_ID) {
    console.log(`✅ Found PR from VERCEL_GIT_PULL_REQUEST_ID: ${process.env.VERCEL_GIT_PULL_REQUEST_ID}`);
    return process.env.VERCEL_GIT_PULL_REQUEST_ID;
  }
  
  const commitRef = process.env.VERCEL_GIT_COMMIT_REF;
  if (commitRef) {
    const branchName = commitRef.replace('refs/heads/', '');
    
    if (branchName.startsWith('devin/')) {
      const prNumber = branchName.replace('devin/', '').split('-')[0];
      if (prNumber && /^\d+$/.test(prNumber)) {
        console.log(`✅ Found PR from branch name regex: ${prNumber}`);
        return prNumber;
      }
    }
    
    const githubToken = process.env.GITHUB_TOKEN;
    const githubRepo = process.env.GITHUB_REPOSITORY;
    
    if (!githubToken) {
      throw new Error("GITHUB_TOKEN environment variable is not defined");
    }
    if (!githubRepo) {
      throw new Error("GITHUB_REPOSITORY environment variable is not defined");
    }
    if (!branchName) {
      throw new Error("Branch name could not be determined from VERCEL_GIT_COMMIT_REF");
    }
    
    if (githubToken && githubRepo && branchName) {
      try {
        const prNumber = await retryWithBackoff(async () => {
          const [owner] = githubRepo.split('/');
          const headFilter = `${owner}:${branchName}`;
          
          const response = await fetch(`https://api.github.com/repos/${githubRepo}/pulls?head=${headFilter}&state=open`, {
            headers: {
              "Authorization": `Bearer ${githubToken}`,
              "Accept": "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28"
            }
          });
          
          if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
          }
          
          const prs = await response.json();
          if (prs.length === 1) {
            console.log(`✅ Found PR #${prs[0].number} for branch: ${branchName}`);
            return prs[0].number.toString();
          } else if (prs.length === 0) {
            throw new Error(`No open PRs found for branch: ${branchName}`);
          } else {
            throw new Error(`Multiple open PRs found for branch: ${branchName}`);
          }
        }, 3, 2000);
        
        return prNumber;
      } catch (error) {
        console.warn(`⚠️ GitHub API lookup failed after retries: ${error}`);
      }
    }
  }
  
  console.warn('⚠️ Unable to determine PR number from any method');
  return null;
}

export default async function AdminPage() {
  const ec2 = new EC2({
    region: "us-east-1",
  });
  
  const environmentPrefix = getEnvironmentPrefix();
  let currentPRNumber: string | null = null;
  let prNumberError: string | null = null;
  
  try {
    currentPRNumber = await getCurrentPRNumber();
  } catch (error) {
    console.error('Failed to get PR number:', error);
    prNumberError = error instanceof Error ? error.message : 'Unknown error occurred while getting PR number';
  }
  
  if (environmentPrefix === 'PREVIEW' && !currentPRNumber) {
    return (
      <div className="flex flex-col gap-4 justify-start items-start">
        <h1 className="text-2xl font-bold">Vargas JR</h1>
        <p className="text-sm text-gray-500">Manage Vargas Jr Settings</p>
        
        {/* Environment Info */}
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-yellow-800 mb-2">Environment Info</h3>
          <div className="text-sm font-mono space-y-1 text-gray-700">
            <div><strong>Environment Prefix:</strong> &quot;{environmentPrefix}&quot;</div>
            <div><strong>Current PR Number:</strong> {currentPRNumber || 'null'}</div>
            <div><strong>Total Instances Found:</strong> 0</div>
          </div>
        </div>
        
        {/* No instances message for preview without PR */}
        <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-gray-800 mb-2">No Instances Available</h3>
          <p className="text-sm text-gray-600 mb-3">
            Preview environments require a valid PR number to show instances.
          </p>
          <div className="text-sm text-gray-500">
            <p>Current environment is in preview mode but no PR number was detected.</p>
          </div>
        </div>
      </div>
    );
  }
  
  const filters = [
    { Name: "tag:Project", Values: ["VargasJR"] },
    { Name: "instance-state-name", Values: ["running", "stopped", "pending"] }
  ];
  
  if (environmentPrefix === '') {
    filters.push({ Name: "tag:Type", Values: ["main"] });
  } else if (environmentPrefix === 'PREVIEW' && currentPRNumber) {
    filters.push({ Name: "tag:PRNumber", Values: [currentPRNumber] });
  }
  
  let instances: Array<{
    InstanceId?: string;
    State?: { Name?: string };
    KeyName?: string;
    PublicDnsName?: string;
    InstanceType?: string;
    ImageId?: string;
    Tags?: Array<{ Key?: string; Value?: string }>;
  }> = [];
  let errorMessage: string | null = null;
  
  try {
    instances = await ec2
      .describeInstances({ Filters: filters })
      .then((data) => data.Reservations?.flatMap(r => r.Instances || []) || []);
  } catch (error) {
    console.error('Failed to query EC2 instances:', error);
    errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
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
      
      {/* Environment Variable Errors */}
      {prNumberError && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-red-800 mb-2">Environment Configuration Error</h3>
          <p className="text-sm text-red-600 mb-3">
            Failed to determine PR number due to missing or invalid environment variables.
          </p>
          <div className="text-sm text-red-500 font-mono bg-red-100 p-2 rounded">
            {prNumberError}
          </div>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Required for PR environments:</strong> GITHUB_TOKEN, GITHUB_REPOSITORY, and VERCEL_GIT_COMMIT_REF must be properly configured.
            </p>
          </div>
        </div>
      )}
      
      {/* Instances Section */}
      {errorMessage ? (
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-red-800 mb-2">Unable to Query Instances</h3>
          <p className="text-sm text-red-600 mb-3">
            Failed to connect to AWS EC2 service. This is likely due to missing or invalid AWS credentials.
          </p>
          <div className="text-sm text-red-500 font-mono bg-red-100 p-2 rounded">
            {errorMessage}
          </div>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> In production, this page should have proper AWS credentials configured 
              to query EC2 instances. This error is expected in local development without AWS setup.
            </p>
          </div>
        </div>
      ) : instances.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg w-full max-w-2xl">
          <h3 className="font-semibold text-gray-800 mb-2">No Instances Found</h3>
          <p className="text-sm text-gray-600 mb-3">
            No EC2 instances were found matching the current environment filters.
          </p>
          <div className="text-sm text-gray-500">
            <p><strong>Expected tags:</strong></p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Project: VargasJR</li>
              {environmentPrefix === '' && <li>Type: main</li>}
              {environmentPrefix === 'PREVIEW' && currentPRNumber && <li>PRNumber: {currentPRNumber}</li>}
              <li>State: running, stopped, or pending</li>
            </ul>
          </div>
          {environmentPrefix === '' && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Production Environment:</strong> No production instances are currently running. 
                You may need to create a production agent using the create-agent script.
              </p>
            </div>
          )}
        </div>
      ) : (
        instances.map((instance) => (
          <InstanceCard key={instance.InstanceId} instance={instance} />
        ))
      )}
    </div>
  );
}
