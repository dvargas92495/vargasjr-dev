import InstanceCard from "@/components/instance-card";
import { EC2 } from "@aws-sdk/client-ec2";
import { notFound } from "next/navigation";
import { getEnvironmentPrefix } from "@/app/api/constants";

function getCurrentPRNumber(): string | null {
  return process.env.VERCEL_GIT_PULL_REQUEST_ID || null;
}

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
