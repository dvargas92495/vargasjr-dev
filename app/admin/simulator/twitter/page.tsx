import SimulatorLayout from "@/components/SimulatorLayout";
import TwitterSimulatorClient from "@/components/TwitterSimulatorClient";

export default function TwitterSimulatorPage() {
  return (
    <SimulatorLayout
      title="Twitter Simulator"
      description="Simulate Twitter integration preview environment"
    >
      <div className="space-y-6">
        <div className="text-sm text-gray-600 space-y-1">
          <div>
            <strong>Status:</strong>{" "}
            <span className="text-green-600">Authenticated</span>
          </div>
          <div>
            <strong>Account:</strong> @VargasJRDev
          </div>
          <div>
            <strong>API Version:</strong> v2
          </div>
          <div>
            <strong>Rate Limit:</strong> 300 requests/15min
          </div>
        </div>

        <div className="border-t pt-6">
          <TwitterSimulatorClient />
        </div>
      </div>
    </SimulatorLayout>
  );
}
