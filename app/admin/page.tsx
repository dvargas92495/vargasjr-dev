import InstanceCard from "@/components/instance-card";
import { EC2 } from "@aws-sdk/client-ec2";
import { notFound } from "next/navigation";
import { getEnvironmentPrefix } from "@/app/api/constants";

function getCurrentPRNumber(): string | null {
  return process.env.VERCEL_GIT_PULL_REQUEST_ID || null;
}

/**
 * Steps takin to create Vargas JR:
 * - Create the EC2 instance
 * - Create the Key Pair
 * - `sudo apt update`
 * - `sudo apt install -y python3.12 python3.12-venv python3-pip`
 * - `sudo update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1`
 * - `sudo update-alternatives --install /usr/bin/python python /usr/bin/python3.12 1`
 * - `curl -sSL https://install.python-poetry.org | python - -y --version 1.8.3`
 * - source ~/.profile
 * - add `~/run_agent.sh` to the instance
 * - add `~/.env` to the instance with the following:
 *   - `POSTGRES_URL`
 *   - `LOG_LEVEL=INFO`
 *   - `VELLUM_API_KEY`
 *   - `AWS_ACCESS_KEY_ID`
 *   - `AWS_SECRET_ACCESS_KEY`
 *   - `AWS_DEFAULT_REGION=us-east-1`
 *   - Other Vargas Jr specific env vars
 * - chmod u+x ~/run_agent.sh
 * - curl -s https://api.github.com/repos/dvargas92495/vargasjs-dev/releases/latest | grep vargasjr_dev_agent-*.tar.gz
 * - 
 */

export default async function AdminPage() {
  const ec2 = new EC2({
    region: "us-east-1",
  });
  
  const environmentPrefix = getEnvironmentPrefix();
  const currentPRNumber = getCurrentPRNumber();
  
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
      
      {/* Debug Environment Variables */}
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg w-full max-w-2xl">
        <h3 className="font-semibold text-yellow-800 mb-2">🐛 Debug: Environment Variables</h3>
        <div className="text-sm font-mono space-y-1 text-gray-700">
          <div><strong>NODE_ENV:</strong> {process.env.NODE_ENV || 'undefined'}</div>
          <div><strong>VERCEL_URL:</strong> {process.env.VERCEL_URL || 'undefined'}</div>
          <div><strong>VERCEL_ENV:</strong> {process.env.VERCEL_ENV || 'undefined'}</div>
          <div><strong>VERCEL_GIT_PULL_REQUEST_ID:</strong> {process.env.VERCEL_GIT_PULL_REQUEST_ID || 'undefined'}</div>
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
