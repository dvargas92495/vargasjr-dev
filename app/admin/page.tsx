"use client";

import StopInstanceButton from "@/components/stop-instance-button";
import StartInstanceButton from "@/components/start-instance-button";
import RebootInstanceButton from "@/components/reboot-instance-button";
import HealthStatusIndicator from "@/components/health-status-indicator";
import { notFound } from "next/navigation";
import PendingInstanceRefresh from "@/components/pending-instance-refresh";
import CopyableText from "@/components/copyable-text";
import { useState, useEffect } from "react";

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

export default function AdminPage() {
  const [instances, setInstances] = useState<Array<{
    InstanceId?: string;
    State?: { Name?: string };
    KeyName?: string;
    PublicDnsName?: string;
    InstanceType?: string;
    ImageId?: string;
    Tags?: Array<{ Key?: string; Value?: string }>;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [healthStatuses, setHealthStatuses] = useState<Record<string, {status: string, error?: string}>>({});
  const [environmentPrefix, setEnvironmentPrefix] = useState('');
  const [currentPRNumber, setCurrentPRNumber] = useState<string | null>(null);

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const response = await fetch('/api/instances');
        if (response.ok) {
          const data = await response.json();
          setInstances(data.instances);
          setEnvironmentPrefix(data.environmentPrefix);
          setCurrentPRNumber(data.currentPRNumber);
        } else {
          console.error('Failed to fetch instances:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching instances:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInstances();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

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
      
      {instances.map((instance) => {
        const instanceState = instance.State?.Name;
        const instanceId = instance.InstanceId;
        const command = `ssh -i ~/.ssh/${instance.KeyName}.pem ubuntu@${instance.PublicDnsName}`;
        const instanceName = instance.Tags?.find((tag: {Key?: string, Value?: string}) => tag.Key === "Name")?.Value || "Unknown";
        const instanceType = instance.Tags?.find((tag: {Key?: string, Value?: string}) => tag.Key === "Type")?.Value || "main";
        const prNumber = instance.Tags?.find((tag: {Key?: string, Value?: string}) => tag.Key === "PRNumber")?.Value;
        
        const healthStatus = healthStatuses[instanceId || ''] || { status: "loading" };
        const handleHealthStatusChange = (status: {status: string, error?: string}) => {
          if (instanceId) {
            setHealthStatuses(prev => ({ ...prev, [instanceId]: status }));
          }
        };
        
        return (
          <div key={instanceId} className="border p-4 rounded-lg w-full max-w-2xl">
            <h2 className="text-lg font-semibold mb-2">
              {instanceName} 
              {instanceType === "preview" && prNumber && (
                <span className="ml-2 text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  PR #{prNumber}
                </span>
              )}
              {instanceType === "main" && (
                <span className="ml-2 text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                  Main
                </span>
              )}
            </h2>
            <div className="space-y-1 text-sm">
              <p>
                Instance ID: <span className="font-mono">{instance.InstanceId}</span>
              </p>
              <p>
                Instance Type: <span className="font-mono">{instance.InstanceType}</span>
              </p>
              <p>
                State: <span className="font-mono">{instanceState}</span>
              </p>
              <p className="flex items-center gap-2">
                Health: 
                <HealthStatusIndicator 
                  instanceId={instanceId!}
                  publicDns={instance.PublicDnsName || ""}
                  keyName={instance.KeyName || ""}
                  instanceState={instanceState || ""}
                  onHealthStatusChange={handleHealthStatusChange}
                />
              </p>
              <p>
                ImageID: <span className="font-mono">{instance.ImageId}</span>
              </p>
              <p>
                Connect: <CopyableText className="font-mono" text={command} />
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              {instanceState === "running" && instanceId && (
                <StopInstanceButton id={instanceId} />
              )}
              {instanceState === "stopped" && instanceId && (
                <StartInstanceButton id={instanceId} />
              )}
              {instanceState === "running" && instanceId && (healthStatus.status === "unhealthy" || healthStatus.status === "offline") && (
                <RebootInstanceButton id={instanceId} />
              )}
              {instanceState === "pending" && <PendingInstanceRefresh />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
