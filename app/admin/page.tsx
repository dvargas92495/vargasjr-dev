import StopInstanceButton from "@/components/stop-instance-button";
import StartInstanceButton from "@/components/start-instance-button";
import { EC2 } from "@aws-sdk/client-ec2";
import { notFound } from "next/navigation";
import PendingInstanceRefresh from "@/components/pending-instance-refresh";
import CopyableText from "@/components/copyable-text";

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
 *   - `AWS_REGION=us-east-1`
 *   - Other Vargas Jr specific env vars
 * - chmod u+x ~/run_agent.sh
 * - curl -s https://api.github.com/repos/dvargas92495/vargasjs-dev/releases/latest | grep vargasjr_dev_agent-*.tar.gz
 * - 
 */

export default async function AdminPage() {
  const ec2 = new EC2({});
  const instance = await ec2
    .describeInstances()
    .then((data) => data.Reservations?.[0]?.Instances?.[0]);

  if (!instance) {
    notFound();
  }

  const instanceState = instance.State?.Name;
  const instanceId = instance.InstanceId;
  const command = `ssh -i ~/.ssh/${instance.KeyName}.pem ubuntu@${instance.PublicDnsName}`;

  return (
    <div className="flex flex-col gap-2 justify-start items-start">
      <h1 className="text-2xl font-bold">Vargas JR</h1>
      <p className="text-sm text-gray-500">Manage Vargas Jr Settings</p>
      <p>
        Instance ID: <span className="font-mono">{instance.InstanceId}</span>
      </p>
      <p>
        Instance Type:{" "}
        <span className="font-mono">{instance.InstanceType}</span>
      </p>
      <p>
        State: <span className="font-mono">{instanceState}</span>
      </p>
      <p>
        ImageID: <span className="font-mono">{instance.ImageId}</span>
      </p>
      <p>
        Connect: <CopyableText className="font-mono" text={command} />
      </p>
      {instanceState === "running" && instanceId && (
        <StopInstanceButton id={instanceId} />
      )}
      {instanceState === "stopped" && instanceId && (
        <StartInstanceButton id={instanceId} />
      )}
      {instanceState === "pending" && <PendingInstanceRefresh />}
    </div>
  );
}
