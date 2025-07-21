import SimulatorLayout from "@/components/SimulatorLayout";

export default function GmailSimulatorPage() {
  return (
    <SimulatorLayout 
      title="Gmail Simulator" 
      description="Simulate Gmail integration preview environment"
    >
      <div className="text-sm text-gray-600 space-y-1">
        <div><strong>Status:</strong> <span className="text-green-600">Connected</span></div>
        <div><strong>Account:</strong> vargas.jr.dev@gmail.com</div>
        <div><strong>API Quota:</strong> 1,000,000 requests/day</div>
        <div><strong>Last Sync:</strong> 5 minutes ago</div>
      </div>
    </SimulatorLayout>
  );
}
