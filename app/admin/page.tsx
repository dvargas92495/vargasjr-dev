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

  return (
    <div>
      <h1>Vargas JR</h1>
      <p>Manage Vargas Jr Settings</p>
      <p>
        InstanceID: <span className="font-mono">{instance.InstanceId}</span>
      </p>
      <p>
        Instance Type:{" "}
        <span className="font-mono">{instance.InstanceType}</span>
      </p>
      <p>
        State: <span className="font-mono">{instance.State?.Name}</span>
      </p>
      <p>
        ImageID: <span className="font-mono">{instance.ImageId}</span>
      </p>
      <p>
        Public IP: <span className="font-mono">{instance.PublicIpAddress}</span>
      </p>
      <p>
        Private IP:{" "}
        <span className="font-mono">{instance.PrivateIpAddress}</span>
      </p>
      <p>
        Public DNS: <span className="font-mono">{instance.PublicDnsName}</span>
      </p>
      <p>
        Private DNS:{" "}
        <span className="font-mono">{instance.PrivateDnsName}</span>
      </p>
    </div>
  );
}
