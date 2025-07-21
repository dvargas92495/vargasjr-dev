export default function SlackSimulatorPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Slack Simulator</h1>
        <p className="text-sm text-gray-500">Simulate Slack workspace preview environment</p>
      </div>

      <div className="bg-white border border-gray-300 rounded-lg">
        <div className="bg-gray-500 px-6 py-3 rounded-t-lg">
          <h2 className="text-lg font-semibold text-white">Preview Environment</h2>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 border border-gray-200 rounded p-4">
            <div className="text-sm text-gray-600 space-y-1">
              <div><strong>Status:</strong> <span className="text-green-600">Active</span></div>
              <div><strong>Workspace:</strong> vargas-jr-dev.slack.com</div>
              <div><strong>Bot Token:</strong> xoxb-****-****-****</div>
              <div><strong>Last Activity:</strong> 2 minutes ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
