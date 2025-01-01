import StopInstanceButton from "@/components/stop-instance-button";
import { EC2 } from "@aws-sdk/client-ec2";
import { notFound } from "next/navigation";

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
        Public IP: <span className="font-mono">{instance.PublicIpAddress}</span>
      </p>
      {instanceState === "running" && instanceId && (
        <StopInstanceButton id={instanceId} />
      )}
    </div>
  );
}
