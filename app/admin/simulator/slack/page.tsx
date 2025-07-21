import SimulatorLayout from "@/components/SimulatorLayout";

export default function SlackSimulatorPage() {
  return (
    <SimulatorLayout 
      title="Slack Simulator" 
      description="Simulate Slack workspace preview environment"
    >
      <div className="text-sm text-gray-600 space-y-1">
        <div><strong>Status:</strong> <span className="text-green-600">Active</span></div>
        <div><strong>Workspace:</strong> vargas-jr-dev.slack.com</div>
        <div><strong>Bot Token:</strong> xoxb-****-****-****</div>
        <div><strong>Last Activity:</strong> 2 minutes ago</div>
      </div>
    </SimulatorLayout>
  );
}
